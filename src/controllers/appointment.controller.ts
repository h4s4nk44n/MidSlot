import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { NotFoundError, BadRequestError, InternalServerError } from "../utils/errors";

export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeSlotId, notes } = req.body;
    const patientId = (req as any).user.userId;

    const slot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotId },
    });

    if (!slot) {
      throw new NotFoundError("Time slot not found.");
    }

    if (slot.isBooked) {
      throw new BadRequestError("This slot is already booked.");
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
    throw new InternalServerError();
  }
};