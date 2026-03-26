import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.routes";
import slotRouter from "./routes/slot.routes";
import authRouter from "./routes/auth.routes";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", healthRouter);
app.use("/api", slotRouter);
app.use("/api/auth", authRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.statusCode || 500;
  res.status(status).json({ message: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`[MidSlot] Server running on http://localhost:${PORT}`);
});

export default app;