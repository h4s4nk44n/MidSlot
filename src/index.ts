import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import healthRouter from "./routes/health.routes";
import errorHandler from "./middlewares/error.middlewares";
import slotRouter from "./routes/slot.routes";
import authRouter from "./routes/auth.routes";
import appointmentRouter from "./routes/appointment.routes";
import doctorRouter from "./routes/doctor.routes";
import adminRouter from "./routes/admin.routes";
import receptionistRouter from "./routes/receptionist.routes";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* <Routes> */
app.use("/api/auth", authRouter);
app.use("/api", slotRouter);
app.use("/api", appointmentRouter);
app.use("/api/doctors", doctorRouter);
app.use("/api/admin", adminRouter);
app.use("/api/receptionist", receptionistRouter);
app.use("/api", healthRouter);
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
