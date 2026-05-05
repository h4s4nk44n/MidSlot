import { Router } from "express";
import { createSlot, getSlots, updateSlot, deleteSlot } from "../controllers/slot.controller";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth.middleware";
import { Request, Response, NextFunction } from "express";
import validate from "../middlewares/validate.middleware";
import { createSlotSchema, updateSlotSchema } from "../validations/slot.validation";

const router = Router();

router.get("/slots", getSlots);

router.use((req: Request, res: Response, next: NextFunction) =>
  authenticate(req as AuthRequest, res, next),
);

router.post("/slots", authorize("DOCTOR"), validate(createSlotSchema), createSlot);

router.put("/slots/:id", authorize("DOCTOR"), validate(updateSlotSchema), updateSlot);
router.delete("/slots/:id", authorize("DOCTOR"), deleteSlot);

export default router;
