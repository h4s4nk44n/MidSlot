import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { ForbiddenError, NotFoundError } from "../utils/errors";
import { getProfile, updateProfile } from "../services/profile.service";
import { updateProfileSchema } from "../validations/profile.validation";
import { prisma } from "../lib/prisma";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";

/** GET /api/profile — current user reads own profile. */
export const getMyProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const profile = await getProfile(req.user!.userId);
    res.status(200).json(profile);
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/profile — current user updates own profile. */
export const patchMyProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
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
    const userId = req.user!.userId;
    const updated = await updateProfile(userId, parsed.data);
    audit.log({
      actorId: userId,
      action: AuditAction.PROFILE_UPDATE_SELF,
      targetType: "User",
      targetId: userId,
      // Only log the names of fields that changed, not the values — profile
      // data includes PII (national ID, address) we don't want in audit rows.
      metadata: { fields: Object.keys(parsed.data) },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/admin/users/:id/profile
 *
 * Admins can edit any user's profile fields. RBAC is enforced by the admin
 * router. Audited separately so it's distinguishable from self-edits in the
 * audit log.
 */
export const patchProfileByAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) throw new NotFoundError("User not found.");

    const parsed = updateProfileSchema.safeParse(req.body);
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
    const updated = await updateProfile(targetId, parsed.data);
    audit.log({
      actorId: req.user!.userId,
      action: AuditAction.PROFILE_UPDATE_BY_ADMIN,
      targetType: "User",
      targetId,
      metadata: { fields: Object.keys(parsed.data) },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/receptionist/patients/:id/profile
 *
 * Receptionists can edit a patient's profile (e.g. on intake at the desk).
 * Restricted to PATIENT targets so receptionists can't modify other staff.
 */
export const patchPatientProfileByReceptionist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, role: true },
    });
    if (!target) throw new NotFoundError("Patient not found.");
    if (target.role !== "PATIENT") {
      throw new ForbiddenError("Receptionists can only update patient profiles.");
    }

    const parsed = updateProfileSchema.safeParse(req.body);
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
    const updated = await updateProfile(targetId, parsed.data);
    audit.log({
      actorId: req.user!.userId,
      action: AuditAction.PROFILE_UPDATE_BY_RECEPTIONIST,
      targetType: "User",
      targetId,
      metadata: { fields: Object.keys(parsed.data) },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};
