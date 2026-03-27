import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import * as doctorController from "../controllers/doctor.controller";

const router = Router();

router.get("/", authenticate, doctorController.getAllDoctors);
router.get("/:id", authenticate, doctorController.getDoctorById);
router.get("/:id/slots", authenticate, doctorController.getDoctorSlots);
router.get("/me/dashboard", authenticate, authorize("DOCTOR"), doctorController.getDoctorDashboard);

export default router;