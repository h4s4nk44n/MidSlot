import { Router } from "express";
import {
  getActivePatients,
  getPatientProfile,
  putAppointmentNote,
  getSession,
  postStartSession,
  postEndSession,
  patchSessionPatient,
} from "../controllers/doctor-patient.controller";
import {
  requestDoctorProfileChange,
  verifyDoctorProfileChange,
  patchDoctorMedicalFields,
} from "../controllers/profile-change.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorize("DOCTOR"));

router.get("/patients", getActivePatients);
router.get("/patients/:id/profile", getPatientProfile);
router.patch("/patients/:id/profile/medical", patchDoctorMedicalFields);
router.post("/patients/:id/profile-changes/request", requestDoctorProfileChange);
router.post("/profile-changes/:requestId/verify", verifyDoctorProfileChange);

// Doctor's clinical note on an appointment. Window-gated server-side.
router.put("/appointments/:id/note", putAppointmentNote);

// In-person session: open / read / close + patch patient profile while open.
router.get("/appointments/:id/session", getSession);
router.post("/appointments/:id/start", postStartSession);
router.post("/appointments/:id/end", postEndSession);
router.patch("/appointments/:id/session/patient", patchSessionPatient);

export default router;
