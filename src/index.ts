import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.routes";
import authRouter from "./routes/auth.routes";
import slotRouter from "./routes/slot.routes";
import appointmentRouter from "./routes/appointment.routes";
import doctorRouter from "./routes/doctor.routes";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotalar
app.use("/api/auth", authRouter);
app.use("/api/doctors", doctorRouter);
app.use("/api", slotRouter);
app.use("/api", appointmentRouter);
app.use("/api", healthRouter);

app.listen(PORT, () => {
  console.log(`[MidSlot] Server running on http://localhost:${PORT}`);
});

export default app;
