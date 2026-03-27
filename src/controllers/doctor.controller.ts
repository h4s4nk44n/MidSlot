import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middlewares/auth.middleware";

// GET /api/doctors - Tüm doktorları listele
export const getAllDoctors = async (req: Request, res: Response): Promise<void> => {
    try {
        const specialization = req.query.specialization as string | undefined;
        const doctors = await prisma.doctor.findMany({
            where: specialization ? { specialization: specialization } : {},
            include: {
                user: {
                    select: { name: true, email: true }
                }
            }
        });
        res.status(200).json(doctors);
    } catch (error) {
        res.status(500).json({ message: "Doktorlar listelenirken hata oluştu." });
    }
};

// GET /api/doctors/:id - Doktor profili getir
export const getDoctorById = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const doctor = await prisma.doctor.findUnique({
            where: { id },
            include: { user: { select: { name: true, email: true } } }
        });
        if (!doctor) {
            res.status(404).json({ message: "Doktor bulunamadı." });
            return;
        }
        res.status(200).json(doctor);
    } catch (error) {
        res.status(500).json({ message: "Profil getirilirken hata oluştu." });
    }
};

// GET /api/doctors/:id/slots - Doktorun müsait slotlarını getir
export const getDoctorSlots = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id as string;
        const dateParam = req.query.date as string | undefined;
        const now = new Date();

        const slots = await prisma.timeSlot.findMany({
            where: {
                doctorId: id,
                isBooked: false,
                startTime: { gt: now },
                ...(dateParam && { date: new Date(dateParam) })
            },
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
        });
        res.status(200).json(slots);
    } catch (error) {
        res.status(500).json({ message: "Slotlar getirilirken hata oluştu." });
    }
};

// GET /api/doctors/me/dashboard - Doktor Dashboard Verileri
export const getDoctorDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const userId = authReq.user?.userId;

        const doctor = await prisma.doctor.findUnique({ where: { userId } });
        if (!doctor) {
            res.status(404).json({ message: "Doktor profili bulunamadı." });
            return;
        }

        const now = new Date();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const upcomingAppointments = await prisma.appointment.findMany({
            where: {
                doctorId: doctor.id,
                status: "BOOKED",
                timeSlot: { startTime: { gt: now } }
            },
            take: 10,
            include: {
                patient: { select: { name: true } },
                timeSlot: { select: { startTime: true, endTime: true } }
            },
            orderBy: { timeSlot: { startTime: 'asc' } }
        });

        const todaySlots = await prisma.timeSlot.findMany({
            where: {
                doctorId: doctor.id,
                date: { gte: todayStart, lte: todayEnd }
            }
        });

        const statsCount = await prisma.appointment.groupBy({
            by: ['status'],
            where: { doctorId: doctor.id },
            _count: true
        });

        const availableSlotsCount = await prisma.timeSlot.count({
            where: { doctorId: doctor.id, isBooked: false, startTime: { gt: now } }
        });

        const stats = {
            totalAppointments: statsCount.reduce((acc: number, curr: any) => acc + curr._count, 0),
            completedAppointments: statsCount.find(s => s.status === "COMPLETED")?._count || 0,
            cancelledAppointments: statsCount.find(s => s.status === "CANCELLED")?._count || 0,
            availableSlots: availableSlotsCount
        };

        res.status(200).json({ upcomingAppointments, todaySlots, stats });
    } catch (error) {
        res.status(500).json({ message: "Dashboard verileri alınırken hata oluştu." });
    }
};