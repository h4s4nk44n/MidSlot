import { Router } from "express";
import { authenticate } from "../middlewares/auth.middleware";
import { getMyProfile, patchMyProfile } from "../controllers/profile.controller";

const router = Router();

router.use(authenticate);

router.get("/", getMyProfile);
router.patch("/", patchMyProfile);

export default router;
