import { Router } from "express";
import {
  getUsers,
  removeUser,
  postAssignment,
  removeAssignment,
  getAssignments,
} from "../controllers/admin.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate, authorize("ADMIN"));

router.get("/users", getUsers);
router.delete("/users/:id", removeUser);

router.get("/assignments", getAssignments);
router.post("/assignments", postAssignment);
router.delete("/assignments/:id", removeAssignment);

export default router;
