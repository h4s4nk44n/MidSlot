import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import healthRouter from "./routes/health.routes";
import errorHandler from "./middlewares/error.middlewares";
import { apiLimiter } from "./middlewares/rateLimiter.middleware";
import slotRouter from "./routes/slot.routes";
import authRouter from "./routes/auth.routes";
import appointmentRouter from "./routes/appointment.routes";
import doctorRouter from "./routes/doctor.routes";
import adminRouter from "./routes/admin.routes";
import receptionistRouter from "./routes/receptionist.routes";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Security headers — mount as early as possible
app.use(helmet());

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, mobile apps, same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Body parsers with size limits — prevent payload-based DoS
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ limit: "10kb", extended: true }));

/* <Routes> */
app.use("/api", apiLimiter);
app.use("/api/auth", authRouter);
app.use("/api", slotRouter);
app.use("/api", appointmentRouter);
app.use("/api/doctors", doctorRouter);
app.use("/api/admin", adminRouter);
app.use("/api/receptionist", receptionistRouter);
app.use("/api", healthRouter);

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
  console.log(`[MidSlot] Server running on http://localhost:${PORT}`);
});

export default app;
