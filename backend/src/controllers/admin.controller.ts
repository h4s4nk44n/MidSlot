import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { BadRequestError } from "../utils/errors";
import {
  listUsers,
  deleteUser,
  updateUser,
  createAssignment,
  deleteAssignment,
  listAssignments,
  getUserDetails,
  grantAdmin,
  revokeAdmin,
  transferAdmin,
} from "../services/admin.service";
import { Role } from "../generated/prisma";
import {
  listAdminUsersQuerySchema,
  updateAdminUserSchema,
} from "../validations/admin.validation";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";
import { prisma } from "../lib/prisma";
import { listAuditLogs } from "../services/audit.service";
import { listAuditLogsQuerySchema } from "../validations/audit.validation";

export const getUsers = async (
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
    const { role, q, active, page, pageSize } = parsed.data;
    const result = await listUsers({
      role,
      q,
      active,
      page,
      pageSize,
      viewerRole: Role.ADMIN,
    });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const getUserDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const user = await getUserDetails(id, Role.ADMIN);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

export const removeUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const currentUserId = req.user!.userId;
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, name: true },
    });
    await deleteUser(id, currentUserId);
    audit.log({
      actorId: currentUserId,
      action: AuditAction.USER_DELETE,
      targetType: "User",
      targetId: id,
      metadata: target
        ? { email: target.email, role: target.role, name: target.name }
        : {},
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    next(error);
  }
};

export const patchUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = updateAdminUserSchema.safeParse(req.body);
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
    const currentUserId = req.user!.userId;

    const before = await prisma.user.findUnique({
      where: { id },
      select: {
        role: true,
        isActive: true,
        doctor: {
          select: {
            title: true,
            specialization: true,
            gender: true,
            dateOfBirth: true,
          },
        },
      },
    });

    const updated = await updateUser(id, currentUserId, parsed.data);

    // Emit one audit entry per logical action so the audit log stays readable.
    if (parsed.data.role !== undefined && before && before.role !== parsed.data.role) {
      audit.log({
        actorId: currentUserId,
        action: AuditAction.USER_ROLE_CHANGE,
        targetType: "User",
        targetId: id,
        metadata: { from: before.role, to: parsed.data.role },
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 500),
      });
    }
    if (parsed.data.isActive !== undefined && before && before.isActive !== parsed.data.isActive) {
      audit.log({
        actorId: currentUserId,
        action: AuditAction.USER_DEACTIVATE,
        targetType: "User",
        targetId: id,
        metadata: { isActive: parsed.data.isActive },
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 500),
      });
    }
    if (parsed.data.title !== undefined && parsed.data.title !== before?.doctor?.title) {
      audit.log({
        actorId: currentUserId,
        action: AuditAction.USER_TITLE_CHANGE,
        targetType: "User",
        targetId: id,
        metadata: { from: before?.doctor?.title ?? null, to: parsed.data.title },
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 500),
      });
    }
    if (
      parsed.data.specialization !== undefined &&
      parsed.data.specialization !== before?.doctor?.specialization
    ) {
      audit.log({
        actorId: currentUserId,
        action: AuditAction.USER_SPECIALIZATION_CHANGE,
        targetType: "User",
        targetId: id,
        metadata: {
          from: before?.doctor?.specialization ?? null,
          to: parsed.data.specialization,
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 500),
      });
    }
    if (
      parsed.data.gender !== undefined &&
      parsed.data.gender !== before?.doctor?.gender
    ) {
      audit.log({
        actorId: currentUserId,
        action: AuditAction.USER_GENDER_CHANGE,
        targetType: "User",
        targetId: id,
        metadata: {
          from: before?.doctor?.gender ?? null,
          to: parsed.data.gender,
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"]?.slice(0, 500),
      });
    }
    if (parsed.data.dateOfBirth !== undefined) {
      const beforeDob = before?.doctor?.dateOfBirth ?? null;
      const nextDob = parsed.data.dateOfBirth;
      const beforeIso = beforeDob ? beforeDob.toISOString() : null;
      if (beforeIso !== nextDob) {
        audit.log({
          actorId: currentUserId,
          action: AuditAction.USER_DOB_CHANGE,
          targetType: "User",
          targetId: id,
          metadata: { from: beforeIso, to: nextDob },
          ip: req.ip,
          userAgent: req.headers["user-agent"]?.slice(0, 500),
        });
      }
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const postAssignment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { receptionistId, doctorId } = req.body;

    if (!receptionistId || !doctorId) {
      throw new BadRequestError("receptionistId and doctorId are required.");
    }

    const assignedByUserId = req.user!.userId;
    const assignment = await createAssignment(receptionistId, doctorId, assignedByUserId);

    audit.log({
      actorId: assignedByUserId,
      action: AuditAction.ASSIGNMENT_ADD,
      targetType: "ReceptionistAssignment",
      targetId: assignment.id,
      metadata: { receptionistId, doctorId },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(201).json(assignment);
  } catch (error) {
    next(error);
  }
};

export const removeAssignment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const actorId = req.user!.userId;
    const existing = await prisma.receptionistAssignment.findUnique({ where: { id } });

    await deleteAssignment(id);
    audit.log({
      actorId,
      action: AuditAction.ASSIGNMENT_REMOVE,
      targetType: "ReceptionistAssignment",
      targetId: id,
      metadata: existing
        ? { receptionistId: existing.receptionistId, doctorId: existing.doctorId }
        : {},
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json({ message: "Assignment deleted successfully." });
  } catch (error) {
    next(error);
  }
};

export const getAssignments = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const assignments = await listAssignments();
    res.status(200).json(assignments);
  } catch (error) {
    next(error);
  }
};

export const postGrantAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    const currentUserId = req.user!.userId;
    const updated = await grantAdmin(targetId, currentUserId);
    audit.log({
      actorId: currentUserId,
      action: AuditAction.USER_ROLE_CHANGE,
      targetType: "User",
      targetId,
      metadata: { to: "ADMIN", via: "grantAdmin" },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const postRevokeAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    const currentUserId = req.user!.userId;
    const updated = await revokeAdmin(targetId, currentUserId);
    audit.log({
      actorId: currentUserId,
      action: AuditAction.USER_ROLE_CHANGE,
      targetType: "User",
      targetId,
      metadata: { from: "ADMIN", to: "PATIENT", via: "revokeAdmin" },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const postTransferAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetId = req.params.id as string;
    const currentUserId = req.user!.userId;
    const updated = await transferAdmin(targetId, currentUserId);
    audit.log({
      actorId: currentUserId,
      action: AuditAction.USER_ROLE_CHANGE,
      targetType: "User",
      targetId,
      metadata: { to: "ADMIN", via: "transferAdmin", from: currentUserId },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = listAuditLogsQuerySchema.safeParse(req.query);
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

    const result = await listAuditLogs(parsed.data);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};