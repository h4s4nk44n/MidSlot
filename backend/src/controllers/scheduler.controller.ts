import { Request, Response, NextFunction } from "express";
import { runMaintenanceCycle } from "../scheduler";

/**
 * POST /api/admin/scheduler/run
 *
 * Run a maintenance cycle (auto-cancel sweep + 24h reminder loop) on demand.
 * Admin-only — mounted behind the admin router's authorize("ADMIN"). Handy for
 * demos so the sweep doesn't have to wait for the next cron tick.
 */
export const postRunScheduler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const result = await runMaintenanceCycle("manual");
    res.status(200).json({ message: "Maintenance cycle executed.", data: result });
  } catch (err) {
    next(err);
  }
};
