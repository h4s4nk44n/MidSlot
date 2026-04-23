import { Router } from "express";
import { createAppointment, cancelAppointment, getMyAppointments, completeAppointment } from "../controllers/appointment.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/appointments/me", authenticate, getMyAppointments);
router.post("/appointments", authenticate, createAppointment);
router.patch("/appointments/:id/cancel", authenticate, cancelAppointment);
router.patch("/appointments/:id/complete", authenticate, completeAppointment);

export default router;