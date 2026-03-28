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

export const updateAppointmentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { status } = req.body;
    const userRole = (req as any).user.role;
    const userId = (req as any).user.userId;

    if (status !== "CANCELLED" && status !== "COMPLETED") {
      res.status(400).json({ message: "Invalid status transition" });
      return;
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { timeSlot: true, doctor: true },
    }) as any;

    if (!appointment) {
      res.status(404).json({ message: "Appointment not found" });
      return;
    }

    if (appointment.status !== "BOOKED") {
      res.status(400).json({ message: "Invalid status transition" });
      return;
    }

    const now = new Date();

    if (status === "CANCELLED") {
      if (userRole === "PATIENT") {
        if (appointment.patientId !== userId) {
          res.status(403).json({ message: "Not authorized" });
          return;
        }
        if (appointment.timeSlot.startTime <= now) {
          res.status(400).json({ message: "Cannot cancel an appointment that has already started" });
          return;
        }
      } else if (userRole === "DOCTOR") {
        if (appointment.doctor.userId !== userId) {
          res.status(403).json({ message: "Not authorized" });
          return;
        }
      } else {
        res.status(403).json({ message: "Not authorized" });
        return;
      }
    } else if (status === "COMPLETED") {
      if (userRole !== "DOCTOR" || appointment.doctor.userId !== userId) {
        res.status(403).json({ message: "Not authorized" });
        return;
      }
      if (appointment.timeSlot.startTime > now) {
        res.status(400).json({ message: "Cannot complete an appointment before it starts" });
        return;
      }
    }

    const updatedAppointment = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: { status },
        include: { timeSlot: true, doctor: true },
      }) as any;

      if (status === "CANCELLED") {
        await tx.timeSlot.update({
          where: { id: appointment.timeSlotId },
          data: { isBooked: false },
        });
        
        updated.timeSlot.isBooked = false;
      }

      return updated;
    });

    res.status(200).json(updatedAppointment);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};
