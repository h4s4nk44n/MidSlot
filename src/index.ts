import express, { Request, Response } from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.routes";
import errorHandler from "./middlewares/error.middlewares";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* <Routes> */

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
