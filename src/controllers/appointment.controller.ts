import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";
import {
  NotFoundError,
  BadRequestError,
  InternalServerError,
  ForbiddenError,
} from "../utils/errors";

export const createAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeSlotId, notes } = req.body;
    const patientId = (req as AuthRequest).user!.userId;

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
  } catch (_error) {
    throw new InternalServerError();
  }
};

export const updateAppointmentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const userId = (req as AuthRequest).user!.userId;
    const userRole = (req as AuthRequest).user!.role;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { timeSlot: true },
    });

    if (!appointment) {
      throw new NotFoundError("Appointment not found.");
    }

    const allowedTransitions: Record<string, string[]> = {
      BOOKED: ["CANCELLED", "COMPLETED"],
      CANCELLED: [],
      COMPLETED: [],
    };

    if (!allowedTransitions[appointment.status].includes(status)) {
      throw new BadRequestError(`Cannot transition from ${appointment.status} to ${status}.`);
    }

    if (status === "COMPLETED") {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      if (userRole !== "DOCTOR" || !doctor || appointment.doctorId !== doctor.id) {
        throw new ForbiddenError("Only the assigned doctor can complete an appointment.");
      }
      if (new Date() < new Date(appointment.timeSlot.startTime)) {
        throw new BadRequestError("Cannot complete an appointment before it has started.");
      }
    }

    if (status === "CANCELLED") {
      const doctor = await prisma.doctor.findUnique({ where: { userId } });
      const isPatient = userRole === "PATIENT" && appointment.patientId === userId;
      const isDoctor = userRole === "DOCTOR" && !!doctor && appointment.doctorId === doctor.id;
      if (!isPatient && !isDoctor) {
        throw new ForbiddenError("You are not authorized to cancel this appointment.");
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id },
        data: { status },
        include: {
          timeSlot: true,
          doctor: true,
        },
      });

      if (status === "CANCELLED") {
        await tx.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: { isBooked: false },
        });
      }

      return updatedAppointment;
    });

    res.status(200).json(updated);
  } catch (error) {
    if (
      error instanceof NotFoundError ||
      error instanceof BadRequestError ||
      error instanceof ForbiddenError
    ) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    throw new InternalServerError();
  }
};
