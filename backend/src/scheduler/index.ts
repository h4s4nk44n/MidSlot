import { schedule, validate, type ScheduledTask } from "node-cron";
import logger from "../lib/logger";
import { autoCancelStaleAppointments } from "../services/doctor-patient.service";
import { sendDueReminders } from "../services/reminder.service";

export type MaintenanceTrigger = "cron" | "manual";

export interface MaintenanceResult {
  autoCancelled: number;
  remindersSent: number;
}

// Every 15 minutes by default. Frequent enough to keep auto-cancel status
// fresh and to catch every appointment inside the 23–25h reminder window
// (which is 2h wide) at least once. Override with SCHEDULER_CRON.
const DEFAULT_CRON = "*/15 * * * *";

/**
 * Run one maintenance cycle: the auto-cancel sweep + the 24h reminder loop.
 * Each step is isolated so a failure in one does not abort the other. Safe to
 * call from the cron tick or from the admin on-demand endpoint.
 */
export async function runMaintenanceCycle(trigger: MaintenanceTrigger): Promise<MaintenanceResult> {
  const startedAt = Date.now();
  logger.info({ trigger }, "[scheduler] maintenance cycle started");

  let autoCancelled = 0;
  try {
    autoCancelled = await autoCancelStaleAppointments();
  } catch (err) {
    logger.error({ err }, "[scheduler] auto-cancel sweep failed");
  }

  let remindersSent = 0;
  try {
    remindersSent = await sendDueReminders();
  } catch (err) {
    logger.error({ err }, "[scheduler] reminder sweep failed");
  }

  logger.info(
    { trigger, autoCancelled, remindersSent, durationMs: Date.now() - startedAt },
    "[scheduler] maintenance cycle finished",
  );
  return { autoCancelled, remindersSent };
}

let task: ScheduledTask | null = null;

/**
 * Register the recurring maintenance job. Runs independently of HTTP traffic,
 * replacing the old debounced in-process sweep. No-op under test, when already
 * started, or when SCHEDULER_ENABLED=false.
 */
export function startScheduler(): void {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.SCHEDULER_ENABLED === "false") {
    logger.info("[scheduler] disabled (SCHEDULER_ENABLED=false)");
    return;
  }
  if (task) return;

  const expression = process.env.SCHEDULER_CRON?.trim() || DEFAULT_CRON;
  if (!validate(expression)) {
    logger.error({ expression }, "[scheduler] invalid SCHEDULER_CRON; scheduler not started");
    return;
  }

  task = schedule(expression, () => {
    void runMaintenanceCycle("cron");
  });
  logger.info({ expression }, "[scheduler] started");
}

/** Stop the recurring job (used in graceful shutdown / tests). */
export function stopScheduler(): void {
  if (task) {
    task.stop();
    task = null;
  }
}
