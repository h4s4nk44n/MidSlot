import { Router } from "express";
import { 
    createSlot, 
    getSlots, 
    updateSlot, 
    deleteSlot 
} from "../controllers/slot.controller";

const router = Router();

// Map incoming HTTP requests to the corresponding controller functions
router.post("/slots", createSlot);
router.get("/slots", getSlots);
router.put("/slots/:id", updateSlot);
router.delete("/slots/:id", deleteSlot);

export default router;