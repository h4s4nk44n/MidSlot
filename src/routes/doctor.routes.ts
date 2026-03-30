import { Router } from "express";
import { getDoctors, getDoctorProfile, getDoctorSlots, getDashboard } from "../controllers/doctor.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.get("/dashboard", authenticate, authorize("DOCTOR"), getDashboard);

router.get("/", authenticate, getDoctors);
router.get("/:id", authenticate, getDoctorProfile);
router.get("/:id/slots", authenticate, getDoctorSlots);

export default router;