import { prisma } from "../lib/prisma";
import logger from "../lib/logger";
import { getEmailProvider, type EmailMessage } from "../lib/email";
import { escapeHtml, formatInClinicTz } from "../lib/email-format";

const HOUR_MS = 60 * 60 * 1000;
// "~24 hours before": appointments whose slot starts between 23h and 25h from
// now. The 2h-wide window means a scheduler running at least every 2h catches
// every appointment exactly once (combined with the reminderSentAt guard).
const WINDOW_START_MS = 23 * HOUR_MS;
const WINDOW_END_MS = 25 * HOUR_MS;

export interface ReminderEmailParams {
  patientName: string;
  doctorName: string;
  specialization?: string | null;
  startTime: Date;
}

/** Pure builder for the 24h reminder email — no DB access, easy to unit-test. */
export function buildReminderEmail(to: string, params: ReminderEmailParams): EmailMessage {
  const { date, time } = formatInClinicTz(params.startTime);
  const spec = params.specialization ? ` (${params.specialization})` : "";
  const subject = `Reminder: your appointment with ${params.doctorName} is tomorrow`;

  const text =
    `Hi ${params.patientName},\n\n` +
    `This is a reminder that you have an appointment in about 24 hours.\n\n` +
    `Doctor: ${params.doctorName}${spec}\n` +
    `Date:   ${date}\n` +
    `Time:   ${time}\n\n` +
    `Need to reschedule? Cancel from your MediSlot dashboard.\n\n` +
    `— MediSlot`;

  const html =
    `<p>Hi ${escapeHtml(params.patientName)},</p>` +
    `<p>This is a reminder that you have an appointment in about <strong>24 hours</strong>.</p>` +
    `<ul>` +
    `<li><strong>Doctor:</strong> ${escapeHtml(params.doctorName + spec)}</li>` +
    `<li><strong>Date:</strong> ${escapeHtml(date)}</li>` +
    `<li><strong>Time:</strong> ${escapeHtml(time)}</li>` +
    `</ul>` +
    `<p>Need to reschedule? Cancel from your MediSlot dashboard.</p>` +
    `<p>— MediSlot</p>`;

  return { to, subject, html, text };
}

/**
 * Email a 24h reminder for every BOOKED appointment whose slot starts in the
 * 23–25h window and that has not been reminded yet. `reminderSentAt` is stamped
 * only after a successful send, so:
 *   - a later cycle never double-sends (dedup), and
 *   - a transient email failure is retried on the next cycle.
 *
 * Best-effort per appointment — one failure doesn't abort the rest. Called by
 * the MEDI-101 scheduler each maintenance cycle. Returns the number sent.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const windowStart = new Date(now.getTime() + WINDOW_START_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_END_MS);

  const due = await prisma.appointment.findMany({
    where: {
      status: "BOOKED",
      reminderSentAt: null,
      timeSlot: { startTime: { gte: windowStart, lt: windowEnd } },
    },
    select: {
      id: true,
      patient: { select: { email: true, name: true } },
      doctor: {
        select: { title: true, specialization: true, user: { select: { name: true } } },
      },
      timeSlot: { select: { startTime: true } },
    },
  });

  let sent = 0;
  for (const appt of due) {
    try {
      const doctorName = `${appt.doctor.title ? `${appt.doctor.title} ` : ""}${appt.doctor.user.name}`;
      const message = buildReminderEmail(appt.patient.email, {
        patientName: appt.patient.name,
        doctorName,
        specialization: appt.doctor.specialization,
        startTime: appt.timeSlot.startTime,
      });

      await getEmailProvider().send(message);
      // Stamp only after a successful send (failure → retried next cycle).
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: now },
      });
      sent++;
    } catch (err) {
      logger.warn({ err, appointmentId: appt.id }, "[reminder] failed to send 24h reminder");
    }
  }

  if (sent > 0) {
    logger.info({ sent, provider: getEmailProvider().name }, "[reminder] sent 24h reminders");
  }
  return sent;
}
