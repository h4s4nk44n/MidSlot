/** Shared formatting helpers for outbound email bodies. */

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Format a Date as a human date + time in the clinic's timezone
 * (CLINIC_TIMEZONE, falling back to the runtime tz). Keeps emails consistent
 * with the same-day rules used elsewhere in the app.
 */
export function formatInClinicTz(date: Date): { date: string; time: string } {
  const timeZone = process.env.CLINIC_TIMEZONE || undefined;
  const dateStr = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone,
  }).format(date);
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
  return { date: dateStr, time: timeStr };
}
