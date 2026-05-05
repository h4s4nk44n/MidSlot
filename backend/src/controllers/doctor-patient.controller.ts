import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  getPatientProfileForDoctor,
  listActivePatientsForDoctor,
  setDoctorNoteForAppointment,
  startAppointmentSession,
  endAppointmentSession,
  getSessionForDoctor,
  updateSessionPatientProfile,
} from "../services/doctor-patient.service";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";
import { BLOOD_TYPES, PROFILE_GENDERS } from "../validations/profile.validation";

const doctorNoteSchema = z.object({
  note: z.string().max(4000),
});

const PHONE_REGEX = /^\+?[0-9 ()-]{6,20}$/;
const optionalNullableString = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();
const optionalNullablePhone = z
  .union([z.string().trim().regex(PHONE_REGEX, "Invalid phone number format"), z.null()])
  .optional();

/** Patch schema for the doctor's in-session edits. nationalId + insurance
 *  fields are intentionally absent (the service also strips them as defense
 *  in depth). */
const sessionPatientPatchSchema = z
  .object({
    phone: optionalNullablePhone,
    dateOfBirth: z.union([z.string().datetime(), z.string().date(), z.null()]).optional(),
    gender: z.enum(PROFILE_GENDERS).optional(),
    address: optionalNullableString(200),
    city: optionalNullableString(80),
    country: optionalNullableString(80),
    emergencyContactName: optionalNullableString(120),
    emergencyContactPhone: optionalNullablePhone,
    emergencyContactRelation: optionalNullableString(60),
    bloodType: z.enum(BLOOD_TYPES).optional(),
    allergies: optionalNullableString(1000),
    chronicConditions: optionalNullableString(1000),
    currentMedications: optionalNullableString(1000),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Provide at least one field to update.",
  });

/** GET /api/doctor/patients — patients with an appointment in the active window. */
export const getActivePatients = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const list = await listActivePatientsForDoctor(req.user!.userId);
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

/** GET /api/doctor/patients/:id/profile — full profile for a patient inside the window. */
export const getPatientProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const profile = await getPatientProfileForDoctor(
      req.user!.userId,
      req.params.id as string,
    );
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/doctor/appointments/:id/note — write the doctor's clinical note.
 * Only accepted while the appointment is in its active window (start → end+10m).
 */
export const putAppointmentNote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = doctorNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    const appointmentId = req.params.id as string;
    const updated = await setDoctorNoteForAppointment(
      req.user!.userId,
      appointmentId,
      parsed.data.note,
    );
    audit.log({
      actorId: req.user!.userId,
      action: AuditAction.APPOINTMENT_NOTE_UPDATE,
      targetType: "Appointment",
      targetId: appointmentId,
      metadata: { length: parsed.data.note.trim().length },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/** GET /api/doctor/appointments/:id/session — session payload for the in-person visit. */
export const getSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const session = await getSessionForDoctor(req.user!.userId, req.params.id as string);
    res.status(200).json(session);
  } catch (error) {
    next(error);
  }
};

/** POST /api/doctor/appointments/:id/start — open the session. Idempotent. */
export const postStartSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const session = await startAppointmentSession(req.user!.userId, id);
    audit.log({
      actorId: req.user!.userId,
      action: AuditAction.APPOINTMENT_START,
      targetType: "Appointment",
      targetId: id,
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(session);
  } catch (error) {
    next(error);
  }
};

/** POST /api/doctor/appointments/:id/end — close the session and mark COMPLETED. */
export const postEndSession = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await endAppointmentSession(req.user!.userId, id);
    audit.log({
      actorId: req.user!.userId,
      action: AuditAction.APPOINTMENT_END,
      targetType: "Appointment",
      targetId: id,
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/doctor/appointments/:id/session/patient — edit patient profile from the session. */
export const patchSessionPatient = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = sessionPatientPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
      return;
    }
    const id = req.params.id as string;
    const updated = await updateSessionPatientProfile(
      req.user!.userId,
      id,
      parsed.data as Record<string, unknown>,
    );
    audit.log({
      actorId: req.user!.userId,
      action: AuditAction.PROFILE_UPDATE_BY_DOCTOR,
      targetType: "User",
      targetId: updated.id,
      metadata: {
        appointmentId: id,
        fields: Object.keys(parsed.data),
      },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};
