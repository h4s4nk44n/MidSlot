import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

export const createSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized: User ID missing from token." });
      return;
    }

    const { date, startTime, endTime } = req.body;
    const start = new Date(startTime);
    const end = new Date(endTime);
    const requestedDate = new Date(date);
    const now = new Date();

    if (start >= end) {
      res.status(400).json({ message: "Start time must be before end time." });
      return;
    }

    if (start < now) {
      res.status(400).json({ message: "Cannot create slots in the past." });
      return;
    }

    const durationMs = end.getTime() - start.getTime();
    if (durationMs < 15 * 60 * 1000 || durationMs > 4 * 60 * 60 * 1000) {
      res.status(400).json({ message: "Slot duration must be between 15 minutes and 4 hours." });
      return;
    }

    const doctor = await prisma.doctor.findUnique({
      where: { userId: userId },
    });

    if (!doctor) {
      res.status(404).json({ message: "Doctor profile not found for this user." });
      return;
    }

    const overlapping = await prisma.timeSlot.findFirst({
      where: {
        doctorId: doctor.id,
        date: requestedDate,
        AND: [{ startTime: { lt: end } }, { endTime: { gt: start } }],
      },
    });

    if (overlapping) {
      res.status(409).json({ message: "Time slot overlaps with existing slot" });
      return;
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
  } catch (error) {
    console.error("[createSlot] Error:", error);
    res.status(500).json({ message: "Internal server error while creating time slot." });
  }
};

export const getSlots = async (_req: Request, res: Response): Promise<void> => {
  try {
    const slots = await prisma.timeSlot.findMany({
      where: { isBooked: false },
      include: {
        doctor: {
          include: { user: { select: { name: true, email: true } } },
        },
      },
      orderBy: { date: "asc" },
    });

    res.status(200).json({
      message: "Available time slots retrieved successfully.",
      slots,
    });
  } catch (error) {
    console.error("[getSlots] Error:", error);
    res.status(500).json({ message: "Internal server error while fetching slots." });
  }
};

export const updateSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { date, startTime, endTime, isBooked } = req.body;

    const currentSlot = await prisma.timeSlot.findUnique({ where: { id } });
    if (!currentSlot) {
      res.status(404).json({ message: "Slot not found" });
      return;
    }

    const newStart = startTime ? new Date(startTime) : currentSlot.startTime;
    const newEnd = endTime ? new Date(endTime) : currentSlot.endTime;
    const newDate = date ? new Date(date) : currentSlot.date;

    if (newStart >= newEnd) {
      res.status(400).json({ message: "Start time must be before end time." });
      return;
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
      res.status(409).json({ message: "Update fails: Overlaps with another slot" });
      return;
    }

    const updatedSlot = await prisma.timeSlot.update({
      where: { id: id },
      data: {
        ...(date && { date: newDate }),
        ...(startTime && { startTime: newStart }),
        ...(endTime && { endTime: newEnd }),
        ...(isBooked !== undefined && { isBooked }),
      },
    });

    res.status(200).json({
      message: `Time slot updated successfully.`,
      data: updatedSlot,
    });
  } catch (error) {
    console.error("[updateSlot] Error:", error);
    res.status(500).json({ message: "Internal server error while updating slot." });
  }
};

export const deleteSlot = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;

    await prisma.timeSlot.delete({
      where: { id: id },
    });

    res.status(200).json({
      message: `Time slot deleted successfully.`,
    });
  } catch (error) {
    console.error("[deleteSlot] Error:", error);
    res.status(500).json({ message: "Internal server error while deleting slot." });
  }
};
