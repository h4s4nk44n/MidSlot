import { Router } from "express";
import { register, login } from "../controllers/auth.controller";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Placeholder — MEDI-7 auth middleware tamamlandıktan sonra doldurulacak
/*router.get("/me", (req, res) => {
  res.status(501).json({ message: "Not implemented yet" });
}); */

export default router;