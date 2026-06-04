import rateLimit, { Options } from "express-rate-limit";
import { Request } from "express";
import jwt from "jsonwebtoken";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RETRY_AFTER_SECONDS = 15 * 60; // 900 s

// Per-IP request caps per window. Defaults are generous so local/dev demos
// don't trip the limiter constantly; override any of them via env (tighten for
// production, or pin low in tests). Each falls back to its default if unset.
const AUTH_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || "50", 10); // /auth/login + /auth/register
const API_MAX = parseInt(process.env.API_RATE_LIMIT_MAX || "1000", 10); // global /api/*
const MODERATE_MAX = parseInt(process.env.MODERATE_RATE_LIMIT_MAX || "300", 10); // general endpoints

// Disable rate limiting per-test when needed (e.g. account lockout tests
// that intentionally hammer /auth/login more than 5x).
const isRateLimitDisabled = () => process.env.DISABLE_RATE_LIMIT === "true";

// Bypass the global limiter for authenticated staff (ADMIN, RECEPTIONIST).
// Their tooling issues bursts of requests as they click around and shouldn't
// trip the IP limiter. Invalid tokens / patient + doctor roles still fall
// through to normal limiting, so this isn't a brute-force escape hatch.
const STAFF_ROLES = new Set(["ADMIN", "RECEPTIONIST", "DOCTOR"]);

const isAuthenticatedStaff = (req: Request): boolean => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length);
  const secret = process.env.JWT_SECRET;
  if (!secret) return false;
  try {
    const decoded = jwt.verify(token, secret) as { role?: string };
    return decoded.role !== undefined && STAFF_ROLES.has(decoded.role);
  } catch {
    return false;
  }
};

function make429Handler(message: string): Options["handler"] {
  return (_req, res) => {
    res.setHeader("Retry-After", String(RETRY_AFTER_SECONDS));
    res.status(429).json({
      error: "Too Many Requests",
      message,
      retryAfter: RETRY_AFTER_SECONDS,
    });
  };
}

// Strict limiter for /auth/login and /auth/register — AUTH_RATE_LIMIT_MAX / 15 min per IP (default 50)
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  skip: () => isRateLimitDisabled(),
  handler: make429Handler("Too many login/register attempts, please try again after 15 minutes."),
});

// Global limiter for /api/* — API_RATE_LIMIT_MAX / 15 min per IP (default 1000); /api/health is exempt
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // Mounted at /api so req.path is relative (e.g. /health, not /api/health)
  skip: (req: Request) =>
    req.path === "/health" || isRateLimitDisabled() || isAuthenticatedStaff(req),
  handler: make429Handler("Too many requests from this IP, please try again later."),
});

// Moderate limiter for general endpoints — MODERATE_RATE_LIMIT_MAX / 15 min per IP (default 300)
export const moderateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: MODERATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isRateLimitDisabled(),
  handler: make429Handler("Too many requests from this IP, please try again later."),
});
