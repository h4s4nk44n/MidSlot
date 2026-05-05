import { Router } from "express";
import { getDepartments } from "../controllers/department.controller";

const router = Router();

// Public: read-only list of departments for pickers / filters.
router.get("/", getDepartments);

export default router;
