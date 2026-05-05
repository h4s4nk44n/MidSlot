import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  UnauthorisedError,
} from "../utils/errors";
import { paginate } from "../utils/pagination";
import { listSlotsQuerySchema } from "../validations/slot.validation";

/**
 * Resolve the Doctor row for the authenticated user. Throws 404 if the user
 * is authenticated as a doctor but has no Doctor profile, 401 if no user is
 * present on the request.
 */
async function resolveDoctorForRequest(req: Request) {
  const userId = (req as AuthRequest).user?.userId;
  if (!userId) {
    throw new UnauthorisedError("Unauthorized: User ID missing from token.");
  }
  const doctor = await prisma.doctor.findUnique({ where: { userId } });
  if (!doctor) {
    throw new NotFoundError("Doctor profile not found for this user.");
  }
  return doctor;
}

export const createSlot = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // Body has been validated by `validate(createSlotSchema)` in the route.
    const { date, startTime, endTime } = req.body as {
      date: Date;
      startTime: string;
      endTime: string;
    };
    const start = new Date(startTime);
    const end = new Date(endTime);
    const requestedDate = new Date(date);
    const now = new Date();

    if (start < now) {
      throw new BadRequestError("Cannot create slots in the past.");
    }

    const durationMs = end.getTime() - start.getTime();
    if (durationMs < 15 * 60 * 1000 || durationMs > 4 * 60 * 60 * 1000) {
      throw new BadRequestError("Slot duration must be between 15 minutes and 4 hours.");
    }

    const doctor = await resolveDoctorForRequest(req);

    const overlapping = await prisma.timeSlot.findFirst({
      where: {
        doctorId: doctor.id,
        date: requestedDate,
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    });

    if (overlapping) {
      throw new ConflictError("Time slot overlaps with existing slot");
    }

    const newSlot = await prisma.timeSlot.create({
      data: {
        doctorId: doctor.id,
        date: requestedDate,
        startTime: start,
        endTime: end,
      },
    });

    res.status(201).json({
      message: "Time slot created successfully.",
      data: newSlot,
    });
  } catch (err) {
    next(err);
  }
};

export const getSlots = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = listSlotsQuerySchema.safeParse(req.query);
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

    const { page, pageSize, doctorId, specialization, date, from, to } = parsed.data;

    const where: Record<string, unknown> = { isBooked: false };

    if (doctorId) where.doctorId = doctorId;

    if (specialization) {
      where.doctor = { specialization };
    }

    // `date` takes precedence over `from`/`to` (documented in README).
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      where.startTime = { gte: start, lt: end };
    } else if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.gte = new Date(from);
      if (to) range.lt = new Date(to);
      where.startTime = range;
    }

    const result = await paginate(prisma.timeSlot, {
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      page,
      pageSize,
      include: {
        doctor: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const updateSlot = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;
    // Body has been validated by `validate(updateSlotSchema)` — note the
    // schema does NOT include `isBooked`, so it is silently stripped. Slot
    // booked-state is invariant-managed by the appointment booking flow.
    const { date, startTime, endTime } = req.body as {
      date?: Date;
      startTime?: string;
      endTime?: string;
    };

    const currentSlot = await prisma.timeSlot.findUnique({ where: { id } });
    if (!currentSlot) {
      throw new NotFoundError("Slot not found");
    }

    // Ownership check — a doctor may only modify their own slots.
    const doctor = await resolveDoctorForRequest(req);
    if (currentSlot.doctorId !== doctor.id) {
      throw new ForbiddenError("You can only modify your own slots.");
    }

    // Mutating a booked slot would silently break the linked appointment.
    // Force the user to cancel the appointment first.
    if (currentSlot.isBooked) {
      throw new ConflictError(
        "Cannot modify a booked slot. Cancel the appointment first.",
      );
    }

    const newStart = startTime ? new Date(startTime) : currentSlot.startTime;
    const newEnd = endTime ? new Date(endTime) : currentSlot.endTime;
    const newDate = date ? new Date(date) : currentSlot.date;

    if (newStart >= newEnd) {
      throw new BadRequestError("Start time must be before end time.");
    }

    const overlapping = await prisma.timeSlot.findFirst({
      where: {
        doctorId: currentSlot.doctorId,
        date: newDate,
        id: { not: id },
        AND: [{ startTime: { lt: newEnd } }, { endTime: { gt: newStart } }],
      },
    });

    if (overlapping) {
      throw new ConflictError("Update fails: Overlaps with another slot.");
    }

    const updatedSlot = await prisma.timeSlot.update({
      where: { id },
      data: {
        ...(date && { date: newDate }),
        ...(startTime && { startTime: newStart }),
        ...(endTime && { endTime: newEnd }),
      },
    });

    res.status(200).json({
      message: `Time slot updated successfully.`,
      data: updatedSlot,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteSlot = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const id = req.params.id as string;

    const currentSlot = await prisma.timeSlot.findUnique({ where: { id } });
    if (!currentSlot) {
      throw new NotFoundError("Slot not found");
    }

    const doctor = await resolveDoctorForRequest(req);
    if (currentSlot.doctorId !== doctor.id) {
      throw new ForbiddenError("You can only delete your own slots.");
    }

    if (currentSlot.isBooked) {
      throw new ConflictError(
        "Cannot delete a booked slot. Cancel the appointment first.",
      );
    }

    await prisma.timeSlot.delete({ where: { id } });

    res.status(200).json({
      message: `Time slot deleted successfully.`,
    });
  } catch (err) {
    next(err);
  }
};
