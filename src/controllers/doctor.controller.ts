import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

export const getDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { specialization } = req.query;

    const doctors = await prisma.doctor.findMany({
      where: specialization ? { specialization: String(specialization) } : {},
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(200).json(doctors);
  } catch (error) {
    console.error("[getDoctors] Error:", error);
    res.status(500).json({ message: "Internal server error while fetching doctors." });
  }
};

export const getDoctorProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!doctor) {
      res.status(404).json({ message: "Doctor not found" });
      return;
    }

    res.status(200).json(doctor);
  } catch (error) {
    console.error("[getDoctorProfile] Error:", error);
    res.status(500).json({ message: "Internal server error while fetching doctor profile." });
  }
};

export const getDoctorSlots = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { date } = req.query;
    const now = new Date();

    const whereClause: Record<string, unknown> = {
      doctorId: id,
      isBooked: false,
      startTime: { gt: now },
    };

    if (date) {
      whereClause.date = new Date(String(date));
    }

    const slots = await prisma.timeSlot.findMany({
      where: whereClause,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    res.status(200).json(slots);
  } catch (error) {
    console.error("[getDoctorSlots] Error:", error);
    res.status(500).json({ message: "Internal server error while fetching doctor slots." });
  }
};

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const doctor = await prisma.doctor.findUnique({ where: { userId } });

    if (!doctor) {
      res.status(404).json({ message: "Doctor profile not found." });
      return;
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        doctorId: doctor.id,
        status: "BOOKED",
        timeSlot: { startTime: { gt: now } },
      },
      take: 10,
      orderBy: { timeSlot: { startTime: "asc" } },
      include: {
        patient: { select: { name: true, email: true } },
        timeSlot: true,
      },
    });

    const todaySlots = await prisma.timeSlot.findMany({
      where: {
        doctorId: doctor.id,
        startTime: { gte: startOfToday, lt: endOfToday },
      },
      orderBy: { startTime: "asc" },
    });

    const totalAppointments = await prisma.appointment.count({ where: { doctorId: doctor.id } });
    const completedAppointments = await prisma.appointment.count({
      where: { doctorId: doctor.id, status: "COMPLETED" },
    });
    const cancelledAppointments = await prisma.appointment.count({
      where: { doctorId: doctor.id, status: "CANCELLED" },
    });
    const availableSlots = await prisma.timeSlot.count({
      where: { doctorId: doctor.id, isBooked: false, startTime: { gt: now } },
    });

    res.status(200).json({
      upcomingAppointments,
      todaySlots,
      stats: {
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        availableSlots,
      },
    });
  } catch (error) {
    console.error("[getDashboard] Error:", error);
    res.status(500).json({ message: "Internal server error while fetching dashboard." });
  }
};
