import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  listAssignedDoctors,
  listDoctorAppointments,
  createSlotForDoctor,
  deleteSlotForDoctor,
  bookAppointmentOnBehalf,
  cancelAppointmentOnBehalf,
  listAppointmentsForReceptionist,
} from "../services/receptionist.service";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";

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

export const postDoctorSlot = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const doctorId = req.params.doctorId as string;
    const slot = await createSlotForDoctor(userId, doctorId, req.body);
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
    await deleteSlotForDoctor(userId, slotId);
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
