import { Router } from "express";
import {
  getPatients,
  getAssignedDoctors,
  getDoctorAppointments,
  getDoctorSlots,
  postDoctorSlot,
  deleteDoctorSlot,
  postAppointmentOnBehalf,
  cancelAppointment,
  getAppointments,
} from "../controllers/receptionist.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import validate from "../middlewares/validate.middleware";
import {
  receptionistCreateSlotSchema,
  receptionistBookAppointmentSchema,
} from "../validations/receptionist.validation";

const router = Router();

router.use(authenticate, authorize("RECEPTIONIST"));

router.get("/patients", getPatients);
router.get("/doctors", getAssignedDoctors);
router.get("/doctors/:doctorId/appointments", getDoctorAppointments);
router.get("/doctors/:doctorId/slots", getDoctorSlots);

router.post("/doctors/:doctorId/slots", validate(receptionistCreateSlotSchema), postDoctorSlot);
router.delete("/slots/:slotId", deleteDoctorSlot);

router.get("/appointments", getAppointments);
router.post("/appointments", validate(receptionistBookAppointmentSchema), postAppointmentOnBehalf);
router.patch("/appointments/:id/cancel", cancelAppointment);

export default router;
