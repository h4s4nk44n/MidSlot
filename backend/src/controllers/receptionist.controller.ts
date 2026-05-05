import {prisma} from "../lib/prisma";
import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { listUsers, getUserDetails } from "../services/admin.service";
import { listAdminUsersQuerySchema } from "../validations/admin.validation";
import { Role } from "../generated/prisma";
import {
  listAssignedDoctors,
  listDoctorAppointments,
  listSlotsForDoctor,
  createSlotForDoctor,
  deleteSlotForDoctor,
  bookAppointmentOnBehalf,
  cancelAppointmentOnBehalf,
  listAppointmentsForReceptionist,
  searchPatients,
} from "../services/receptionist.service";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";

export const getPatients = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = String(req.query.search ?? "").trim();
    const limit = Math.min(Number(req.query.limit ?? 10), 25);
    if (q.length < 2) {
      res.status(200).json([]);
      return;
    }
    const patients = await searchPatients(q, limit);
    res.status(200).json(patients);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/receptionist/users — same shape as admin's /admin/users.
 * Receptionists need full directory access to look up any user's contact info.
 */
export const getUsersForReceptionist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = listAdminUsersQuerySchema.safeParse(req.query);
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
    // Pass viewerRole so the service hides ADMIN rows from non-admin staff.
    const result = await listUsers({ ...parsed.data, viewerRole: Role.RECEPTIONIST });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/** GET /api/receptionist/users/:id — full user details (same payload as admin's). */
export const getUserDetailForReceptionist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await getUserDetails(id, Role.RECEPTIONIST);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const getAssignedDoctors = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const doctors = await listAssignedDoctors(userId);
    res.status(200).json(doctors);
  } catch (error) {
    next(error);
  }
};

export const getDoctorAppointments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const doctorId = req.params.doctorId as string;
    const appointments = await listDoctorAppointments(userId, doctorId);
    res.status(200).json(appointments);
  } catch (error) {
    next(error);
  }
};

export const getDoctorSlots = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const doctorId = req.params.doctorId as string;
    const slots = await listSlotsForDoctor(userId, doctorId);
    res.status(200).json(slots);
  } catch (error) {
    next(error);
  }
};

export const postDoctorSlot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const doctorId = req.params.doctorId as string;
    const slot = await createSlotForDoctor(userId, doctorId, req.body);

    audit.log({
      actorId: userId,
      action: AuditAction.SLOT_CREATE,
      targetType: "TimeSlot",
      targetId: slot.id,
      metadata: {
        doctorId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        createdBy: "RECEPTIONIST",
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(201).json({
      message: "Time slot created successfully.",
      data: slot,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDoctorSlot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const slotId = req.params.slotId as string;

    // Fetch slot details BEFORE delete so we can audit-log them.
    // (deleteSlotForDoctor itself does the same lookup; we accept the
    // small duplication to keep audit metadata complete.)
    const slot = await prisma.timeSlot.findUnique({ where: { id: slotId } });

    await deleteSlotForDoctor(userId, slotId);

    audit.log({
      actorId: userId,
      action: AuditAction.SLOT_DELETE,
      targetType: "TimeSlot",
      targetId: slotId,
      metadata: slot
        ? {
            doctorId: slot.doctorId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            deletedBy: "RECEPTIONIST",
          }
        : { deletedBy: "RECEPTIONIST" },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(200).json({ message: "Time slot deleted successfully." });
  } catch (error) {
    next(error);
  }
};

export const postAppointmentOnBehalf = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const appointment = await bookAppointmentOnBehalf(userId, req.body);

    audit.log({
      actorId: userId,
      action: AuditAction.APPOINTMENT_BOOK,
      targetType: "Appointment",
      targetId: appointment.id,
      metadata: {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        timeSlotId: appointment.timeSlotId,
        bookedBy: "RECEPTIONIST",
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(201).json({
      message: "Appointment booked successfully.",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const appointmentId = req.params.id as string;
    const appointment = await cancelAppointmentOnBehalf(userId, appointmentId);

    audit.log({
      actorId: userId,
      action: AuditAction.APPOINTMENT_CANCEL,
      targetType: "Appointment",
      targetId: appointmentId,
      metadata: {
        prevStatus: "BOOKED", // service'te bu kontrolden sonra cancel ediyor
        cancelledBy: "RECEPTIONIST",
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    
    res.status(200).json({
      message: "Appointment cancelled successfully.",
      data: appointment,
    });
  } catch (error) {
    next(error);
  }
};

export const getAppointments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { status, doctorId, date } = req.query;
    const appointments = await listAppointmentsForReceptionist(userId, {
      status: status ? String(status) : undefined,
      doctorId: doctorId ? String(doctorId) : undefined,
      date: date ? String(date) : undefined,
    });
    res.status(200).json(appointments);
  } catch (error) {
    next(error);
  }
};
