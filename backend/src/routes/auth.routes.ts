import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  verify,
  forgotPassword,
  resetPasswordHandler,
} from "../controllers/auth.controller";
import { authenticate, getMe, AuthRequest } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/rateLimiter.middleware";
import { Request, Response, NextFunction } from "express";

const router = Router();

// Apply strict rate limiting to authentication endpoints
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
// MEDI-100: forgot/reset password (rate-limited like the other auth endpoints).
router.post("/forgot-password", authLimiter, forgotPassword);
router.post("/reset-password", authLimiter, resetPasswordHandler);
router.post("/refresh", refresh);
router.post("/verify", verify);
router.post("/logout", logout);
router.get(
  "/me",
  (req: Request, res: Response, next: NextFunction) => authenticate(req as AuthRequest, res, next),
  (req: Request, res: Response, next: NextFunction) => getMe(req as AuthRequest, res, next),
);

export default router;
