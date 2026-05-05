import { Router } from "express";
import { createAppointment, cancelAppointment, getMyAppointments, completeAppointment } from "../controllers/appointment.controller";
import { authenticate } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate.middleware";
import { createAppointmentSchema } from "../validations/appointment.validation";

const router = Router();

router.get("/appointments/me", authenticate, getMyAppointments);
router.post(
  "/appointments",
  authenticate,
  validate(createAppointmentSchema),
  createAppointment,
);
router.patch("/appointments/:id/cancel", authenticate, cancelAppointment);
router.patch("/appointments/:id/complete", authenticate, completeAppointment);

export default router;