import { Request, Response } from "express"; // deneme

export const getHealthStatus = (_req: Request, res: Response): void => {
  res.status(200).json({ status: "ok" });
};
