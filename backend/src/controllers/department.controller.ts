import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  listDepartments,
  createDepartment,
  deleteDepartment,
} from "../services/department.service";
import { createDepartmentSchema } from "../validations/department.validation";
import audit from "../utils/audit";
import { AuditAction } from "../types/audit";
import { prisma } from "../lib/prisma";

export const getDepartments = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const departments = await listDepartments();
    res.status(200).json(departments);
  } catch (error) {
    next(error);
  }
};

export const postDepartment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = createDepartmentSchema.safeParse(req.body);
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

    const actorId = req.user!.userId;
    const department = await createDepartment(parsed.data.name);

    audit.log({
      actorId,
      action: AuditAction.DEPARTMENT_CREATE,
      targetType: "Department",
      targetId: department.id,
      metadata: { name: department.name },
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(201).json(department);
  } catch (error) {
    next(error);
  }
};

export const removeDepartment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const actorId = req.user!.userId;
    const existing = await prisma.department.findUnique({ where: { id } });

    await deleteDepartment(id);

    audit.log({
      actorId,
      action: AuditAction.DEPARTMENT_DELETE,
      targetType: "Department",
      targetId: id,
      metadata: existing ? { name: existing.name } : {},
      ip: req.ip,
      userAgent: req.headers["user-agent"]?.slice(0, 500),
    });

    res.status(200).json({ message: "Department deleted successfully." });
  } catch (error) {
    next(error);
  }
};
