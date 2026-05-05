import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import logger from "../lib/logger";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError
} from "../utils/errors";
import { paginate } from "../utils/pagination";
import { listMyAppointmentsQuerySchema } from "../validations/appointment.validation";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";
import { autoCancelStaleAppointments } from "../services/doctor-patient.service";

// Module-scoped debounce for the auto-cancel sweep. The sweep is idempotent
// and cheap, but on a busy listing endpoint it would otherwise run on every
// request. One pass per minute is enough to keep status fresh from a user's
// perspective.
const SWEEP_INTERVAL_MS = 60_000;
let lastAutoCancelSweep = 0;

function maybeRunAutoCancelSweep(): void {
  const now = Date.now();
  if (now - lastAutoCancelSweep < SWEEP_INTERVAL_MS) return;
  lastAutoCancelSweep = now;
  autoCancelStaleAppointments().catch((err) => {
    logger.warn({ err }, "[appointment.controller] auto-cancel sweep failed");
  });
}

// --- MEDI-38: Role-Aware Listing + MEDI-50: Pagination/filters ---
export const getMyAppointments = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const userRole = (req as AuthRequest).user!.role;

    // Lazy auto-cancel pass: flips BOOKED → CANCELLED for any appointment
    // the doctor never opened within 1h after the slot ended. Debounced so
    // it runs at most once per minute across the process.
    maybeRunAutoCancelSweep();

    const parsed = listMyAppointmentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }

    const { page, pageSize, status, from, to } = parsed.data;

    // Role-based scoping: patients see their own, doctors see theirs,
    // receptionists see assigned doctors', admin sees all.
    const whereClause: Record<string, unknown> = {};

    if (userRole === "PATIENT") {
      whereClause.patientId = userId;
    } else if (userRole === "DOCTOR") {
      whereClause.doctor = { userId };
    } else if (userRole === "RECEPTIONIST") {
      const assignments = await prisma.receptionistAssignment.findMany({
        where: { receptionistId: userId },
        select: { doctorId: true },
      });
      whereClause.doctorId = { in: assignments.map((a) => a.doctorId) };
    }
    // ADMIN: no scoping added.

    if (status) whereClause.status = status;

    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.gte = new Date(from);
      if (to) range.lt = new Date(to);
      whereClause.timeSlot = { startTime: range };
    }

    // COMPLETED appointments are most useful with the latest first; everything
    // else (BOOKED, CANCELLED) reads naturally chronologically.
    const sortDir = status === "COMPLETED" ? "desc" : "asc";

    const result = await paginate(prisma.appointment, {
      where: whereClause,
      orderBy: { timeSlot: { startTime: sortDir } },
      page,
      pageSize,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        timeSlot: true,
        doctor: {
          select: {
            id: true,
            title: true,
            specialization: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// --- MEDI-39: Resepsiyonist Destekli Randevu Alma ---
export const createAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const userRole = (req as AuthRequest).user!.role;

    // CRIT-005: only PATIENT and RECEPTIONIST may book. Doctors and admins
    // must not be able to create appointments through this endpoint, and the
    // request body has already been validated by `createAppointmentSchema`.
    if (userRole !== "PATIENT" && userRole !== "RECEPTIONIST") {
      throw new ForbiddenError("Only patients or receptionists may book appointments.");
    }

    const { timeSlotId, notes } = req.body as {
      timeSlotId: string;
      notes?: string;
      patientId?: string;
    };
    let patientId: string;

    if (userRole === "RECEPTIONIST") {
      const bodyPatientId = (req.body as { patientId?: string }).patientId;
      if (!bodyPatientId) {
        throw new BadRequestError("patientId is required when booking as a receptionist.");
      }
      // HIGH-006: verify the patient exists AND has role PATIENT before
      // letting the receptionist target them. Foreign-key alone leaks staff
      // user IDs and produces noisy 500s.
      const targetPatient = await prisma.user.findUnique({
        where: { id: bodyPatientId },
        select: { id: true, role: true },
      });
      if (!targetPatient || targetPatient.role !== "PATIENT") {
        throw new BadRequestError("Target user is not a patient.");
      }
      patientId = bodyPatientId;
    } else {
      // Patient self-booking: ignore any body patientId (anti-fraud) and use
      // the authenticated user's id.
      patientId = userId;
    }

    const slot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotId },
    });

    if (!slot) throw new NotFoundError("Time slot not found.");
    if (new Date(slot.startTime) <= new Date()) throw new BadRequestError("Cannot book past slots.");

    if (userRole === "RECEPTIONIST") {
      const assignment = await prisma.receptionistAssignment.findUnique({
        where: { receptionistId_doctorId: { receptionistId: userId, doctorId: slot.doctorId } }
      });
      if (!assignment) throw new ForbiddenError("You are not assigned to this doctor.");
    }

    // Atomic claim: only flip isBooked → true if it is currently false. Two
    // concurrent bookers will see exactly one updateMany return count: 1; the
    // loser gets a clean 409 instead of an opaque 500. The unique constraint
    // on Appointment.timeSlotId is a backstop in case the slot was somehow
    // already linked to an appointment row.
    const appointment = await prisma.$transaction(async (tx) => {
      const claim = await tx.timeSlot.updateMany({
        where: { id: slot.id, isBooked: false },
        data: { isBooked: true },
      });
      if (claim.count === 0) {
        throw new ConflictError("This slot was just booked by someone else.");
      }

      return tx.appointment.create({
        data: {
          patientId,
          doctorId: slot.doctorId,
          timeSlotId: slot.id,
          notes,
        },
      });
    });

    audit.log({
      actorId: userId,
      action: AuditAction.APPOINTMENT_BOOK,
      targetType: "Appointment",
      targetId: appointment.id,
      metadata: {
        patientId,
        doctorId: slot.doctorId,
        timeSlotId: slot.id,
        bookedBy: userRole, // PATIENT or RECEPTIONIST
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(201).json({
      message: "Appointment booked successfully.",
      data: appointment,
    });
  } catch (err) {
    next(err);
  }
};

export const cancelAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = (req as AuthRequest).user!.userId;
    const userRole = (req as AuthRequest).user!.role;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, timeSlot: true },
    });

    if (!appointment) throw new NotFoundError("Appointment not found.");

    if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
      throw new ConflictError(`Cannot cancel an appointment that is already ${appointment.status}.`);
    }

    let isAuthorized = false;
    if (userRole === "PATIENT" && appointment.patientId === userId) {
      isAuthorized = true;
    } else if (userRole === "DOCTOR" && appointment.doctor.userId === userId) {
      isAuthorized = true;
    } else if (userRole === "RECEPTIONIST") {
      const assignment = await prisma.receptionistAssignment.findUnique({
        where: { receptionistId_doctorId: { receptionistId: userId, doctorId: appointment.doctorId } }
      });
      if (assignment) isAuthorized = true;
    }

    if (!isAuthorized) throw new ForbiddenError("You are not authorized to cancel this appointment.");

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAppt = await tx.appointment.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      await tx.timeSlot.update({
        where: { id: appointment.timeSlotId },
        data: { isBooked: false },
      });

      return updatedAppt;
    });

    audit.log({
      actorId: userId,
      action: AuditAction.APPOINTMENT_CANCEL,
      targetType: "Appointment",
      targetId: id,
      metadata: {
        prevStatus: appointment.status,
        cancelledBy: userRole,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(200).json({ message: "Appointment cancelled successfully.", data: updated });
  } catch (err) {
    next(err);
  }
};

export const completeAppointment = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = (req as AuthRequest).user!.userId;
    const userRole = (req as AuthRequest).user!.role;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, timeSlot: true },
    });

    if (!appointment) throw new NotFoundError("Appointment not found.");

    if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED") {
      throw new ConflictError(`Cannot complete an appointment that is already ${appointment.status}.`);
    }

    if (new Date() < new Date(appointment.timeSlot.endTime)) {
      throw new BadRequestError("Cannot complete an appointment before its end time has passed.");
    }

    let isAuthorized = false;
    if (userRole === "DOCTOR" && appointment.doctor.userId === userId) {
      isAuthorized = true;
    } else if (userRole === "RECEPTIONIST") {
      const assignment = await prisma.receptionistAssignment.findUnique({
        where: { receptionistId_doctorId: { receptionistId: userId, doctorId: appointment.doctorId } }
      });
      if (assignment) isAuthorized = true;
    }

    if (!isAuthorized) throw new ForbiddenError("Only the assigned doctor or receptionist can complete this appointment.");

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: "COMPLETED" },
    });

    audit.log({
      actorId: userId,
      action: AuditAction.APPOINTMENT_COMPLETE,
      targetType: "Appointment",
      targetId: id,
      metadata: {
        completedBy: userRole,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(200).json({ message: "Appointment marked as completed.", data: updated });
  } catch (err) {
    next(err);
  }
};
