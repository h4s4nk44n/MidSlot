import { Router } from "express";
import { createAppointment } from "../controllers/appointment.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post("/appointments", authenticate, createAppointment);

export default router;
