import { Response, NextFunction } from "express";
import { z } from "zod";
import { AuthRequest } from "../middlewares/auth.middleware";
import { prisma } from "../lib/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "../utils/errors";
import { updateProfileSchema } from "../validations/profile.validation";
import {
  ensureNotSelfEdit,
  requestProfileChange,
  verifyCodeAndApply,
} from "../services/profile-change.service";
import {
  assertActiveAppointment,
  isMedicalOnlyPayload,
} from "../services/doctor-patient.service";
import { updateProfile } from "../services/profile.service";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";

const verifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

function parseProfilePatch(req: AuthRequest, res: Response) {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return null;
  }
  return parsed.data;
}

// ────────────────────────── Receptionist ──────────────────────────

/** POST /api/receptionist/patients/:id/profile-changes/request */
export const requestReceptionistProfileChange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const requesterId = req.user!.userId;
    ensureNotSelfEdit(targetUserId, requesterId);

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("Patient not found.");
    if (target.role !== "PATIENT") {
      throw new ForbiddenError("Receptionists can only edit patient profiles.");
    }

    const payload = parseProfilePatch(req, res);
    if (!payload) return;

    const result = await requestProfileChange({
      targetUserId,
      requesterId,
      purpose: "profile_edit_by_receptionist",
      payload,
    });
    audit.log({
      actorId: requesterId,
      action: AuditAction.VERIFICATION_CODE_REQUEST,
      targetType: "User",
      targetId: targetUserId,
      metadata: { purpose: "profile_edit_by_receptionist", fields: Object.keys(payload) },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

/** POST /api/receptionist/profile-changes/:requestId/verify */
export const verifyReceptionistProfileChange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const requesterId = req.user!.userId;
    const parsed = verifySchema.safeParse(req.body);
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
    const outcome = await verifyCodeAndApply(requestId, requesterId, parsed.data.code);
    if (!outcome.ok) {
      audit.log({
        actorId: requesterId,
        action: AuditAction.VERIFICATION_CODE_VERIFY_FAILED,
        targetType: "VerificationCode",
        targetId: requestId,
        metadata: { reason: outcome.reason, attemptsLeft: outcome.attemptsLeft },
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 500),
      });
      res.status(400).json({ error: outcome.reason, attemptsLeft: outcome.attemptsLeft });
      return;
    }
    audit.log({
      actorId: requesterId,
      action: AuditAction.VERIFICATION_CODE_VERIFY_SUCCESS,
      targetType: "VerificationCode",
      targetId: requestId,
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    audit.log({
      actorId: requesterId,
      action: AuditAction.PROFILE_UPDATE_BY_RECEPTIONIST,
      targetType: "User",
      targetId: outcome.updated.id,
      metadata: { verified: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(outcome.updated);
  } catch (error) {
    next(error);
  }
};

// ────────────────────────── Doctor ──────────────────────────

/**
 * POST /api/doctor/patients/:id/profile-changes/request
 *
 * Doctor must have an active appointment with the patient (window =
 * appointment.startTime → endTime + 10 min). Doctors can only target patients.
 *
 * If the payload contains ONLY medical fields (bloodType / allergies / chronic
 * conditions / current medications) we reject with 400 — the caller should use
 * PATCH /api/doctor/patients/:id/profile/medical instead, which doesn't require
 * a code.
 */
export const requestDoctorProfileChange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const requesterId = req.user!.userId;
    ensureNotSelfEdit(targetUserId, requesterId);

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("Patient not found.");
    if (target.role !== "PATIENT") {
      throw new ForbiddenError("Doctors can only edit patient profiles.");
    }
    await assertActiveAppointment(requesterId, targetUserId);

    const payload = parseProfilePatch(req, res);
    if (!payload) return;

    if (isMedicalOnlyPayload(payload as Record<string, unknown>)) {
      throw new BadRequestError(
        "Medical-only edits do not require a code. Use the medical-edit endpoint instead.",
      );
    }

    const result = await requestProfileChange({
      targetUserId,
      requesterId,
      purpose: "profile_edit_by_doctor",
      payload,
    });
    audit.log({
      actorId: requesterId,
      action: AuditAction.VERIFICATION_CODE_REQUEST,
      targetType: "User",
      targetId: targetUserId,
      metadata: { purpose: "profile_edit_by_doctor", fields: Object.keys(payload) },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
};

/** POST /api/doctor/profile-changes/:requestId/verify */
export const verifyDoctorProfileChange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const requesterId = req.user!.userId;
    const parsed = verifySchema.safeParse(req.body);
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
    const outcome = await verifyCodeAndApply(requestId, requesterId, parsed.data.code);
    if (!outcome.ok) {
      audit.log({
        actorId: requesterId,
        action: AuditAction.VERIFICATION_CODE_VERIFY_FAILED,
        targetType: "VerificationCode",
        targetId: requestId,
        metadata: { reason: outcome.reason, attemptsLeft: outcome.attemptsLeft },
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 500),
      });
      res.status(400).json({ error: outcome.reason, attemptsLeft: outcome.attemptsLeft });
      return;
    }
    audit.log({
      actorId: requesterId,
      action: AuditAction.VERIFICATION_CODE_VERIFY_SUCCESS,
      targetType: "VerificationCode",
      targetId: requestId,
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    audit.log({
      actorId: requesterId,
      action: AuditAction.PROFILE_UPDATE_BY_DOCTOR,
      targetType: "User",
      targetId: outcome.updated.id,
      metadata: { verified: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(outcome.updated);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/doctor/patients/:id/profile/medical
 *
 * Doctor edits the narrow set of clinical fields (bloodType, allergies,
 * chronicConditions, currentMedications) without patient code confirmation.
 * Any other field in the body is rejected.
 */
export const patchDoctorMedicalFields = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetUserId = req.params.id as string;
    const requesterId = req.user!.userId;
    ensureNotSelfEdit(targetUserId, requesterId);

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("Patient not found.");
    if (target.role !== "PATIENT") {
      throw new ForbiddenError("Doctors can only edit patient profiles.");
    }
    await assertActiveAppointment(requesterId, targetUserId);

    const payload = parseProfilePatch(req, res);
    if (!payload) return;

    if (!isMedicalOnlyPayload(payload as Record<string, unknown>)) {
      throw new BadRequestError(
        "This endpoint only accepts medical fields (bloodType, allergies, chronicConditions, currentMedications). " +
          "Other fields require patient code confirmation.",
      );
    }

    const updated = await updateProfile(targetUserId, payload);
    audit.log({
      actorId: requesterId,
      action: AuditAction.PROFILE_UPDATE_BY_DOCTOR,
      targetType: "User",
      targetId: targetUserId,
      metadata: { fields: Object.keys(payload), medicalOnly: true },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};
