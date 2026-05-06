import rateLimit, { Options } from "express-rate-limit";
import { Request } from "express";
import jwt from "jsonwebtoken";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RETRY_AFTER_SECONDS = 15 * 60; // 900 s

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

// Strict limiter for /auth/login and /auth/register — 5 req / 15 min per IP
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  skip: () => isRateLimitDisabled(),
  handler: make429Handler("Too many login/register attempts, please try again after 15 minutes."),
});

// Global limiter for /api/* — 100 req / 15 min per IP; /api/health is exempt
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Mounted at /api so req.path is relative (e.g. /health, not /api/health)
  skip: (req: Request) =>
    req.path === "/health" || isRateLimitDisabled() || isAuthenticatedStaff(req),
  handler: make429Handler("Too many requests from this IP, please try again later."),
});

// Moderate limiter for general endpoints — 30 req / 15 min per IP
export const moderateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isRateLimitDisabled(),
  handler: make429Handler("Too many requests from this IP, please try again later."),
});
