import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.routes";
<<<<<<< Updated upstream
=======
import slotRouter from "./routes/slot.routes";
import authRouter from "./routes/auth.routes";
import appointmentRouter from "./routes/appointment.routes";
import doctorRouter from "./routes/doctor.routes";

>>>>>>> Stashed changes

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", healthRouter);
app.use("/api/doctors", doctorRouter);


app.listen(PORT, () => {
  console.log(`[MidSlot] Server running on http://localhost:${PORT}`);
});

export default app;
