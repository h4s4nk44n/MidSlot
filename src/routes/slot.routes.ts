import { Router } from "express";
import { 
    createSlot, 
    getSlots, 
    updateSlot, 
    deleteSlot 
} from "../controllers/slot.controller";
import { authenticate, authorize, AuthRequest } from "../middlewares/auth.middleware";
import { Request, Response, NextFunction } from "express";

const router = Router();

router.get("/slots", getSlots);

router.use((req: Request, res: Response, next: NextFunction) => 
    authenticate(req as AuthRequest, res, next)
);

router.post(
    "/slots", 
    authorize("DOCTOR"), 
    createSlot
);

router.put(
    "/slots/:id", 
    authorize("DOCTOR"), 
    updateSlot
);
router.delete(
    "/slots/:id", 
    authorize("DOCTOR"), 
    deleteSlot
);

export default router;