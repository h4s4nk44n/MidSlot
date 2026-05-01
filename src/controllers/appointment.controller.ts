import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
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

// --- MEDI-38: Role-Aware Listing + MEDI-50: Pagination/filters ---
export const getMyAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const userRole = (req as AuthRequest).user!.role;

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

    const result = await paginate(prisma.appointment, {
      where: whereClause,
      orderBy: { timeSlot: { startTime: "asc" } },
      page,
      pageSize,
      include: {
        patient: { select: { id: true, name: true, email: true } },
        timeSlot: true,
        doctor: { select: { id: true, user: { select: { name: true } } } },
      },
    });

    res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[getMyAppointments] Error:", error);
    res.status(500).json({ message: "Internal Server Error", error: message });
  }
};

// --- MEDI-39: Resepsiyonist Destekli Randevu Alma ---
export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user!.userId;
    const userRole = (req as AuthRequest).user!.role;
    
    // patientId'yi body'den alıyoruz ama kimin yolladığına göre şekillenecek
    let { timeSlotId, notes, patientId } = req.body;

    // Kural 1: Resepsiyonist hasta ID'si yollamak ZORUNDA
    if (userRole === "RECEPTIONIST") {
      if (!patientId) throw new BadRequestError("patientId is required when booking as a receptionist.");
    } else {
      // Kural 2: Hasta kendi alıyorsa, body'deki patientId'yi yok say ve kendi userId'sini bas (Sahtekarlık koruması)
      patientId = userId;
    }

    const slot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotId },
    });

    if (!slot) throw new NotFoundError("Time slot not found.");
    if (slot.isBooked) throw new BadRequestError("This slot is already booked.");
    if (new Date(slot.startTime) <= new Date()) throw new BadRequestError("Cannot book past slots.");

    // Kural 3: Resepsiyonist bu doktorun randevusunu almaya YETKİLİ Mİ?
    if (userRole === "RECEPTIONIST") {
      const assignment = await prisma.receptionistAssignment.findUnique({
        where: { receptionistId_doctorId: { receptionistId: userId, doctorId: slot.doctorId } }
      });
      if (!assignment) throw new ForbiddenError("You are not assigned to this doctor.");
    }

    const appointment = await prisma.$transaction(async (tx) => {
      const newAppointment = await tx.appointment.create({
        data: {
          patientId,
          doctorId: slot.doctorId,
          timeSlotId: slot.id,
          notes,
        },
      });

      await tx.timeSlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      });

      return newAppointment;
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
  } catch (error: any) {
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ForbiddenError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Internal Server Error", details: error.message });
  }
};

export const cancelAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const userId = (req as AuthRequest).user!.userId;
    const userRole = (req as AuthRequest).user!.role;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true },
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
  } catch (error: any) {
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ForbiddenError || error instanceof ConflictError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Internal Server Error", details: error.message });
  }
};

export const completeAppointment = async (req: Request, res: Response): Promise<void> => {
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
  } catch (error: any) {
    if (error instanceof NotFoundError || error instanceof BadRequestError || error instanceof ForbiddenError || error instanceof ConflictError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: "Internal Server Error", details: error.message });
  }
};