import rateLimit, { Options } from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RETRY_AFTER_SECONDS = 15 * 60; // 900 s

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
  handler: make429Handler("Too many login/register attempts, please try again after 15 minutes."),
});

// Global limiter for /api/* — 100 req / 15 min per IP; /api/health is exempt
export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  // Mounted at /api so req.path is relative (e.g. /health, not /api/health)
  skip: (req) => req.path === "/health",
  handler: make429Handler("Too many requests from this IP, please try again later."),
});

// Moderate limiter for general endpoints — 30 req / 15 min per IP
export const moderateLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: make429Handler("Too many requests from this IP, please try again later."),
});
