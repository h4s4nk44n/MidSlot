import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import requestLogger from "./middlewares/requestLogger.middleware";
import logger from "./lib/logger";
import healthRouter from "./routes/health.routes";
import errorHandler from "./middlewares/error.middlewares";
import { apiLimiter } from "./middlewares/rateLimiter.middleware";
import slotRouter from "./routes/slot.routes";
import authRouter from "./routes/auth.routes";
import appointmentRouter from "./routes/appointment.routes";
import doctorRouter from "./routes/doctor.routes";
import adminRouter from "./routes/admin.routes";
import receptionistRouter from "./routes/receptionist.routes";
import departmentRouter from "./routes/department.routes";
import profileRouter from "./routes/profile.routes";
import doctorPatientRouter from "./routes/doctor-patient.routes";
import { assertRequiredEnv } from "./lib/env";

dotenv.config();
assertRequiredEnv();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// HIGH-012: behind a TLS-terminating proxy (Docker / nginx / CDN), express
// must trust the X-Forwarded-* headers so req.ip, rate-limit keys, and audit
// IPs reflect the real client. Restrict to a single hop by default; override
// with TRUST_PROXY for more elaborate setups.
const trustProxy = process.env.TRUST_PROXY ?? "1";
app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);

// Request logger — mount before routes so every request is logged
app.use(requestLogger);

// HIGH-012: helmet defaults + explicit HSTS (1y, includeSubDomains, preload)
// for production. CSP intentionally enabled with helmet's safe defaults; the
// frontend lives on a separate origin so 'self' here only protects API
// responses themselves (mostly JSON, no inline scripts).
app.use(
  helmet({
    hsts:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
  }),
);

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

// CRIT-006 / HIGH-011: only allow no-Origin requests for safe, idempotent
// methods (browser preflight uses OPTIONS; health checks use GET). Refuse
// state-changing verbs without an Origin so curl/server-to-server clients
// can't ride the cookie jar with credentials. On disallowed origins, pass
// `false` (no echo) instead of an Error so the disallowed origin is not
// reflected back in the error message.
const SAFE_NO_ORIGIN_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  cors({
    origin: (incomingOrigin, callback) => {
      if (!incomingOrigin) {
        if (SAFE_NO_ORIGIN_METHODS.has(req.method)) {
          return callback(null, true);
        }
        return callback(null, false);
      }
      if (allowedOrigins.includes(incomingOrigin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })(req, res, () => {
    void origin;
    next();
  });
});

// Body parsers with size limits — prevent payload-based DoS
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));

// Cookie parser — needed to read refresh token from httpOnly cookie
app.use(cookieParser());

/* <Routes> */
app.use("/api", apiLimiter);
app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", slotRouter);
app.use("/api", appointmentRouter);
app.use("/api/doctors", doctorRouter);
app.use("/api/departments", departmentRouter);
app.use("/api/admin", adminRouter);
app.use("/api/receptionist", receptionistRouter);
app.use("/api/doctor", doctorPatientRouter);
app.use("/api/profile", profileRouter);

app.get("/", (_req: Request, res: Response) => {
  res.json({
    message: "MidSlot API is running",
    routes: [
      "/api/health",
      "/api/auth/register",
      "/api/auth/login",
      "/api/auth/me",
      "/api/slots",
      "/api/appointments",
      "/api/doctors",
    ],
  });
});

/* </Routes> */

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: "Route not found",
    statusCode: 404,
  });
});
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`MidSlot API running on http://localhost:${PORT}`);
});

export default app;
