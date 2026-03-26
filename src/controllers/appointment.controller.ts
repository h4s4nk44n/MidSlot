import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeSlotId, notes } = req.body;
    const patientId = (req as any).user.userId;

    const slot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotId },
    });

    if (!slot) {
      res.status(404).json({ message: "Time slot not found." });
      return;
    }

    if (slot.isBooked) {
      res.status(400).json({ message: "This slot is already booked." });
      return;
    }

    const appointment = await prisma.$transaction(async (tx) => {
      const newAppointment = await tx.appointment.create({
        data: {
          patientId,
          doctorId: slot.doctorId,
          timeSlotId: slot.id,
          notes,
        },
      });

      await tx.timeSlot.update({
        where: { id: slot.id },
        data: { isBooked: true },
      });

      return newAppointment;
    });

    res.status(201).json({
      message: "Appointment booked successfully.",
      data: appointment,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};