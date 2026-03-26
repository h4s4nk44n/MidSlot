import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.routes";
import slotRouter from "./routes/slot.routes";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", healthRouter);
app.use("/api", slotRouter);

app.listen(PORT, () => {
  console.log(`[MidSlot] Server running on http://localhost:${PORT}`);
});

export default app;
