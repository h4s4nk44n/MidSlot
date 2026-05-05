import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma";
import { ForbiddenError, NotFoundError, ConflictError } from "../utils/errors";

const ACTIVE_WINDOW_BUFFER_MS = 10 * 60 * 1000; // 10 min after end
/** A BOOKED appointment is auto-cancelled this long after its slot ends if it
 *  was never started by the doctor. */
const AUTO_CANCEL_AFTER_END_MS = 60 * 60 * 1000; // 1 hour

/**
 * Timezone in which "the day of the appointment" is evaluated. Defaults to the
 * runtime's resolved timezone so local dev works out of the box; production
 * deployments (which often run UTC) should set CLINIC_TIMEZONE explicitly
 * (e.g. "Europe/Istanbul"). Without this, a server running UTC would reject
 * "today" appointments for users in positive-offset timezones during the
 * early hours of their local day.
 */
const CLINIC_TIMEZONE =
  process.env.CLINIC_TIMEZONE ||
  Intl.DateTimeFormat().resolvedOptions().timeZone ||
  "UTC";

/** Formats a Date as a YYYY-MM-DD string in the clinic timezone. */
function clinicDayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Patient profile fields the treating doctor can edit during an in-session
 * encounter. Excludes immutable identity (nationalId) and insurance billing
 * fields (those stay restricted to admin / patient self-service).
 */
export const DOCTOR_SESSION_EDITABLE_FIELDS = [
  "phone",
  "dateOfBirth",
  "gender",
  "address",
  "city",
  "country",
  "emergencyContactName",
  "emergencyContactPhone",
  "emergencyContactRelation",
  "bloodType",
  "allergies",
  "chronicConditions",
  "currentMedications",
] as const;
export type DoctorSessionEditableField = (typeof DOCTOR_SESSION_EDITABLE_FIELDS)[number];

/**
 * Patient fields surfaced to the doctor during a session. Hides insurance
 * provider/policy number per spec — those stay restricted to admin / patient
 * self-service. National ID is visible so the doctor can verify identity.
 */
export const DOCTOR_SESSION_PATIENT_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  address: true,
  city: true,
  country: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelation: true,
  bloodType: true,
  allergies: true,
  chronicConditions: true,
  currentMedications: true,
  nationalId: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Returns the Doctor row for a User, or throws 404. Doctors auth as User —
 * we need the Doctor.id to query Appointment.doctorId.
 */
async function resolveDoctor(userId: string) {
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) throw new NotFoundError("Doctor profile not found.");
  return doctor;
}

/**
 * Patients the doctor is currently allowed to view.
 *
 * "Active" = at least one BOOKED appointment whose timeSlot.startTime ≤ now AND
 * timeSlot.endTime + 10min ≥ now AND status = BOOKED. Returns deduped patients
 * with their next active appointment window for the UI to render.
 */
export async function listActivePatientsForDoctor(userId: string) {
  const doctor = await resolveDoctor(userId);
  const now = new Date();
  const lowerBound = new Date(now.getTime() - ACTIVE_WINDOW_BUFFER_MS);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      status: "BOOKED",
      timeSlot: {
        startTime: { lte: now },
        endTime: { gte: lowerBound },
      },
    },
    orderBy: { timeSlot: { startTime: "asc" } },
    include: {
      timeSlot: true,
      patient: { select: { id: true, name: true, email: true } },
    },
  });

  // Dedupe by patient (same doctor + patient could have multiple slots in window).
  const seen = new Set<string>();
  const result: Array<{
    appointmentId: string;
    patient: { id: string; name: string; email: string };
    startTime: Date;
    endTime: Date;
  }> = [];
  for (const a of appointments) {
    if (seen.has(a.patientId)) continue;
    seen.add(a.patientId);
    result.push({
      appointmentId: a.id,
      patient: a.patient,
      startTime: a.timeSlot.startTime,
      endTime: a.timeSlot.endTime,
    });
  }
  return result;
}

/**
 * Throws 403 unless the doctor has an active appointment with the patient
 * (window: timeSlot.startTime ≤ now ≤ timeSlot.endTime + 10min).
 *
 * This is the gate for both reading and writing the patient's profile from
 * the doctor side. Used by every doctor → patient endpoint.
 */
export async function assertActiveAppointment(
  doctorUserId: string,
  patientUserId: string,
): Promise<void> {
  const doctor = await resolveDoctor(doctorUserId);
  const now = new Date();
  const lowerBound = new Date(now.getTime() - ACTIVE_WINDOW_BUFFER_MS);

  const appt = await prisma.appointment.findFirst({
    where: {
      doctorId: doctor.id,
      patientId: patientUserId,
      status: "BOOKED",
      timeSlot: {
        startTime: { lte: now },
        endTime: { gte: lowerBound },
      },
    },
    select: { id: true },
  });
  if (!appt) {
    throw new ForbiddenError(
      "You can only view this patient during their scheduled appointment (and 10 minutes after).",
    );
  }
}

/** Patient profile read-only — only callable when {@link assertActiveAppointment} passes.
 *  Insurance fields are excluded; nationalId is included. */
export async function getPatientProfileForDoctor(
  doctorUserId: string,
  patientUserId: string,
) {
  await assertActiveAppointment(doctorUserId, patientUserId);
  const profile = await prisma.user.findUnique({
    where: { id: patientUserId },
    select: DOCTOR_SESSION_PATIENT_SELECT,
  });
  if (!profile) throw new NotFoundError("Patient not found.");
  return profile;
}

/**
 * The narrow set of medical fields a doctor may edit *without* requiring a
 * patient code. Anything else has to go through the SMS verification flow.
 */
export const DOCTOR_MEDICAL_FIELDS = [
  "bloodType",
  "allergies",
  "chronicConditions",
  "currentMedications",
] as const;

export type DoctorMedicalField = (typeof DOCTOR_MEDICAL_FIELDS)[number];

export function isMedicalOnlyPayload(payload: Record<string, unknown>): boolean {
  const keys = Object.keys(payload);
  if (keys.length === 0) return false;
  return keys.every((k) => (DOCTOR_MEDICAL_FIELDS as readonly string[]).includes(k));
}

/**
 * Save the doctor's clinical note on an appointment.
 *
 * Window: editable from `startedAt` until `(endedAt ?? slot.endTime) + 10 min`.
 * The doctor must have explicitly started the session — there is no implicit
 * clock-based fallback any more.
 */
export async function setDoctorNoteForAppointment(
  doctorUserId: string,
  appointmentId: string,
  note: string,
) {
  const doctor = await resolveDoctor(doctorUserId);

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { timeSlot: { select: { startTime: true, endTime: true } } },
  });
  if (!appt) throw new NotFoundError("Appointment not found.");
  if (appt.doctorId !== doctor.id) {
    throw new ForbiddenError("You can only edit notes on your own appointments.");
  }
  if (!appt.startedAt) {
    throw new ForbiddenError(
      "Start the appointment before writing notes.",
    );
  }
  const referenceEnd = appt.endedAt ?? appt.timeSlot.endTime;
  const windowEnd = new Date(referenceEnd.getTime() + ACTIVE_WINDOW_BUFFER_MS);
  if (new Date() > windowEnd) {
    throw new ForbiddenError(
      "Notes can no longer be edited (the 10-minute window after the appointment has closed).",
    );
  }

  const trimmed = note.trim();
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { doctorNote: trimmed.length === 0 ? null : trimmed },
    select: { id: true, doctorNote: true, updatedAt: true },
  });
}

/**
 * Auto-cancel BOOKED appointments that the doctor never opened within
 * 1 hour after the slot ended. Idempotent — safe to call from any list/read
 * path before serving results.
 *
 * HIGH-008: gated behind a Postgres session-scoped advisory lock so that
 * behind a load balancer the sweep runs at most once at a time across all
 * backend instances. The lock key (arbitrary 64-bit int) is constant across
 * the cluster.
 */
const AUTO_CANCEL_ADVISORY_LOCK_KEY = 7393104201n; // arbitrary stable bigint
export async function autoCancelStaleAppointments(): Promise<number> {
  // pg_try_advisory_lock returns false if another session already holds it.
  // We don't want to wait — we want to skip. The lock is released when the
  // surrounding $transaction commits.
  return await prisma.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<
      Array<{ pg_try_advisory_xact_lock: boolean }>
    >`SELECT pg_try_advisory_xact_lock(${AUTO_CANCEL_ADVISORY_LOCK_KEY}::bigint)`;
    const acquired = lock[0]?.pg_try_advisory_xact_lock === true;
    if (!acquired) {
      return 0;
    }

    const cutoff = new Date(Date.now() - AUTO_CANCEL_AFTER_END_MS);
    const result = await tx.appointment.updateMany({
      where: {
        status: "BOOKED",
        startedAt: null,
        timeSlot: { endTime: { lt: cutoff } },
      },
      data: { status: "CANCELLED" },
    });
    return result.count;
  });
}

/**
 * Open the in-person session for an appointment. Sets `startedAt` (idempotent
 * if already started) and returns the full session payload (appointment +
 * patient profile, with insurance fields stripped).
 *
 * Refuses if more than 1 hour has passed since the slot ended (the appointment
 * is past the auto-cancel cutoff).
 */
export async function startAppointmentSession(
  doctorUserId: string,
  appointmentId: string,
) {
  const doctor = await resolveDoctor(doctorUserId);

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { timeSlot: true },
  });
  if (!appt) throw new NotFoundError("Appointment not found.");
  if (appt.doctorId !== doctor.id) {
    throw new ForbiddenError("This is not your appointment.");
  }
  if (appt.status === "CANCELLED") {
    throw new ConflictError("This appointment was cancelled.");
  }
  if (appt.status === "COMPLETED") {
    throw new ConflictError("This appointment is already completed.");
  }

  // Doctors may only start an appointment on the day it is scheduled.
  // Compare in the clinic timezone so a server running UTC does not reject
  // a "today" appointment for a doctor in a positive-offset timezone.
  if (!appt.startedAt) {
    const slotDayKey = clinicDayKey(appt.timeSlot.startTime);
    const todayKey = clinicDayKey(new Date());
    if (slotDayKey !== todayKey) {
      throw new ForbiddenError(
        "An appointment can only be started on the day it is scheduled.",
      );
    }
  }

  if (!appt.startedAt) {
    const cutoff = new Date(appt.timeSlot.endTime.getTime() + AUTO_CANCEL_AFTER_END_MS);
    if (new Date() > cutoff) {
      // Past the start window — flip and refuse.
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: { status: "CANCELLED" },
      });
      throw new ForbiddenError(
        "This appointment is more than 1 hour past its end time and has been auto-cancelled.",
      );
    }
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { startedAt: new Date() },
    });
  }

  return getSessionForDoctor(doctorUserId, appointmentId);
}

/**
 * End an in-progress session. Sets `endedAt` and flips status to COMPLETED.
 */
export async function endAppointmentSession(
  doctorUserId: string,
  appointmentId: string,
) {
  const doctor = await resolveDoctor(doctorUserId);

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { doctorId: true, status: true, startedAt: true },
  });
  if (!appt) throw new NotFoundError("Appointment not found.");
  if (appt.doctorId !== doctor.id) {
    throw new ForbiddenError("This is not your appointment.");
  }
  if (!appt.startedAt) {
    throw new ConflictError("Start the appointment before ending it.");
  }
  if (appt.status !== "BOOKED") {
    throw new ConflictError("Appointment is no longer active.");
  }
  return prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED", endedAt: new Date() },
    select: { id: true, status: true, endedAt: true },
  });
}

/**
 * Read the session payload for a started appointment — appointment metadata
 * plus the patient profile (insurance fields excluded). Read-only access stays
 * open for the same window as note editing (until endedAt+10min or
 * slot.endTime+10min). Before start, only the doctor's own appointment
 * metadata is returned (no patient profile).
 */
export async function getSessionForDoctor(
  doctorUserId: string,
  appointmentId: string,
) {
  const doctor = await resolveDoctor(doctorUserId);

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      timeSlot: true,
      patient: { select: DOCTOR_SESSION_PATIENT_SELECT },
    },
  });
  if (!appt) throw new NotFoundError("Appointment not found.");
  if (appt.doctorId !== doctor.id) {
    throw new ForbiddenError("This is not your appointment.");
  }
  return appt;
}

/**
 * Patch the patient's profile from the doctor's session. Only allowed while
 * the session window is open (started AND not past endedAt+10min). Restricted
 * to {@link DOCTOR_SESSION_EDITABLE_FIELDS} — nationalId and insurance fields
 * are silently dropped to prevent privilege escalation.
 */
export async function updateSessionPatientProfile(
  doctorUserId: string,
  appointmentId: string,
  patch: Record<string, unknown>,
) {
  const doctor = await resolveDoctor(doctorUserId);

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { timeSlot: { select: { endTime: true } } },
  });
  if (!appt) throw new NotFoundError("Appointment not found.");
  if (appt.doctorId !== doctor.id) {
    throw new ForbiddenError("This is not your appointment.");
  }
  if (!appt.startedAt) {
    throw new ForbiddenError("Start the appointment before editing the patient's profile.");
  }
  const referenceEnd = appt.endedAt ?? appt.timeSlot.endTime;
  const windowEnd = new Date(referenceEnd.getTime() + ACTIVE_WINDOW_BUFFER_MS);
  if (new Date() > windowEnd) {
    throw new ForbiddenError("The session has closed; profile changes are no longer accepted.");
  }

  // Filter to allowed keys only.
  const data: Prisma.UserUpdateInput = {};
  for (const key of DOCTOR_SESSION_EDITABLE_FIELDS) {
    if (!(key in patch)) continue;
    const v = patch[key];
    if (key === "dateOfBirth") {
      data.dateOfBirth = v === null ? null : new Date(v as string);
      continue;
    }
    if (key === "gender" || key === "bloodType") {
      // Enums — pass through as-is.
      (data as Record<string, unknown>)[key] = v;
      continue;
    }
    // Free-text: empty string → null.
    if (v === null || (typeof v === "string" && v.trim() === "")) {
      (data as Record<string, unknown>)[key] = null;
    } else {
      (data as Record<string, unknown>)[key] = v;
    }
  }
  if (Object.keys(data).length === 0) {
    throw new ForbiddenError("No editable fields supplied.");
  }

  return prisma.user.update({
    where: { id: appt.patientId },
    data,
    select: DOCTOR_SESSION_PATIENT_SELECT,
  });
}
