import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { BadRequestError } from "../utils/errors";
import {
  listUsers,
  deleteUser,
  createAssignment,
  deleteAssignment,
  listAssignments,
} from "../services/admin.service";
import { listAdminUsersQuerySchema } from "../validations/admin.validation";

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
    const { role, q, page, pageSize } = parsed.data;
    const result = await listUsers({ role, q, page, pageSize });
    res.status(200).json(result);
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
    await deleteUser(id, currentUserId);
    res.status(200).json({ message: "User deleted successfully." });
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
    await deleteAssignment(id);
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
