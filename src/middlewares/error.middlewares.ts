import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";

const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  // Known operational errors (AppError subclasses)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  // Prisma known request errors
  if (err.name === "PrismaClientKnownRequestError") {
    const prismaErr = err as Error & { code?: string; meta?: Record<string, unknown> };

    // Unique constraint violation (e.g. duplicate email)
    if (prismaErr.code === "P2002") {
      res.status(409).json({
        error: `${prismaErr.meta?.target} already exists`,
        statusCode: 409,
      });
      return;
    }

    // Record not found
    if (prismaErr.code === "P2025") {
      res.status(404).json({
        error: "Resource not found",
        statusCode: 404,
      });
      return;
    }

    // Foreign key constraint failed
    if (prismaErr.code === "P2003") {
      res.status(400).json({
        error: "Related resource does not exist",
        statusCode: 400,
      });
      return;
    }
  }

  // Prisma validation error
  if (err.name === "PrismaClientValidationError") {
    res.status(400).json({
      error: "Invalid data provided",
      statusCode: 400,
    });
    return;
  }

  // Unexpected errors — log but never leak details to client
  console.error("Unexpected error:", err);
  res.status(500).json({
    error: "Internal server error",
    statusCode: 500,
  });
};

export default errorHandler;
