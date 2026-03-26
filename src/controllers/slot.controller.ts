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

        const doctor = await prisma.doctor.findUnique({
            where: { userId: userId },
        });

        if (!doctor) {
            res.status(404).json({ message: "Doctor profile not found for this user." });
            return;
        }

        const newSlot = await prisma.timeSlot.create({
            data: {
                doctorId: doctor.id,
                date: new Date(date),
                startTime: new Date(startTime),
                endTime: new Date(endTime),
            },
        });

        res.status(201).json({ 
            message: "Time slot created successfully.",
            data: newSlot 
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
                    include: { user: { select: { name: true, email: true } } }
                }
            },
            orderBy: { date: 'asc' } 
        });
        
        res.status(200).json({
            message: "Available time slots retrieved successfully.",
            slots
        });
    } catch (error) {
        console.error("[getSlots] Error:", error);
        res.status(500).json({ message: "Internal server error while fetching slots." });
    }
};

export const updateSlot = async (req: Request, res: Response): Promise<void> => {
    try {
        // TypeScript'i susturduğumuz kısım: as string
        const id = req.params.id as string;
        const { date, startTime, endTime, isBooked } = req.body;

        const updatedSlot = await prisma.timeSlot.update({
            where: { id: id },
            data: {
                ...(date && { date: new Date(date) }),
                ...(startTime && { startTime: new Date(startTime) }),
                ...(endTime && { endTime: new Date(endTime) }),
                ...(isBooked !== undefined && { isBooked }),
            },
        });

        res.status(200).json({
            message: `Time slot updated successfully.`,
            data: updatedSlot
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
            message: `Time slot deleted successfully.`
        });
    } catch (error) {
        console.error("[deleteSlot] Error:", error);
        res.status(500).json({ message: "Internal server error while deleting slot." });
    }
};