import { Router } from "express";
import { getAssignedDoctors, getDoctorAppointments } from "../controllers/receptionist.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorize("RECEPTIONIST"));

router.get("/doctors", getAssignedDoctors);
router.get("/doctors/:doctorId/appointments", getDoctorAppointments);

export default router;
