import { Router } from "express";
import { createAppointment, updateAppointmentStatus } from "../controllers/appointment.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post("/appointments", authenticate, createAppointment);
router.patch("/appointments/:id/status", authenticate, updateAppointmentStatus);

export default router;
