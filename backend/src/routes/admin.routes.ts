import { Router } from "express";
import {
  getUsers,
  getUserDetail,
  removeUser,
  patchUser,
  postAssignment,
  removeAssignment,
  getAssignments,
  getAuditLogs,
  postGrantAdmin,
  postRevokeAdmin,
  postTransferAdmin,
} from "../controllers/admin.controller";
import {
  postDepartment,
  removeDepartment,
} from "../controllers/department.controller";
import { patchProfileByAdmin } from "../controllers/profile.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/users", getUsers);
router.get("/users/:id", getUserDetail);
router.patch("/users/:id", patchUser);
router.patch("/users/:id/profile", patchProfileByAdmin);
router.delete("/users/:id", removeUser);

// Admin role lifecycle. Kept as dedicated endpoints (not generic patch) so the
// audit trail is unambiguous and founder/self protections live in one place.
router.post("/users/:id/admin/grant", postGrantAdmin);
router.post("/users/:id/admin/revoke", postRevokeAdmin);
router.post("/users/:id/admin/transfer", postTransferAdmin);

router.get("/assignments", getAssignments);
router.post("/assignments", postAssignment);
router.delete("/assignments/:id", removeAssignment);

router.post("/departments", postDepartment);
router.delete("/departments/:id", removeDepartment);

router.get("/audit", getAuditLogs);

export default router;
