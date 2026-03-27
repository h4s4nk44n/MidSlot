import { Router } from "express";
import { register, login } from "../controllers/auth.controller";
import { authenticate, getMe, AuthRequest } from "../middlewares/auth.middleware";
import { Request, Response, NextFunction } from "express";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get(
  "/me",
  (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthRequest, res, next),
  (req: Request, res: Response, next: NextFunction) => getMe(req as AuthRequest, res, next),
);

export default router;
