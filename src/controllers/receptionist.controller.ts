import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth.middleware";
import { listAssignedDoctors, listDoctorAppointments } from "../services/receptionist.service";

export const getAssignedDoctors = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const doctors = await listAssignedDoctors(userId);
    res.status(200).json(doctors);
  } catch (error) {
    next(error);
  }
};

export const getDoctorAppointments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const doctorId = req.params.doctorId as string;
    const appointments = await listDoctorAppointments(userId, doctorId);
    res.status(200).json(appointments);
  } catch (error) {
    next(error);
  }
};
