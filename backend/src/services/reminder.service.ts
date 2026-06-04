/**
 * Send "your appointment is in ~24 hours" reminder emails.
 *
 * MEDI-99 implements the body: find BOOKED appointments whose slot starts in
 * the 23–25h window and have not been reminded yet, email each patient via the
 * email adapter, and stamp the appointment so later cycles don't double-send.
 *
 * The MEDI-101 scheduler already calls this every maintenance cycle, so
 * reminders begin flowing the moment MEDI-99 lands — no scheduler change needed.
 *
 * @returns the number of reminder emails sent this cycle.
 */
export async function sendDueReminders(): Promise<number> {
  return 0;
}
