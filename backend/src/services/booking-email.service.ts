import { prisma } from "../lib/prisma";
import logger from "../lib/logger";
import { getEmailProvider, type EmailMessage } from "../lib/email";
import { escapeHtml, formatInClinicTz } from "../lib/email-format";

export interface BookingEmailParams {
  patientName: string;
  doctorName: string;
  specialization?: string | null;
  startTime: Date;
}

/**
 * Pure builder for the confirmation email — no DB access, so it is trivially
 * unit-testable. Contains the appointment details (doctor, date, time).
 */
export function buildBookingConfirmationEmail(
  to: string,
  params: BookingEmailParams,
): EmailMessage {
  const { date, time } = formatInClinicTz(params.startTime);
  const spec = params.specialization ? ` (${params.specialization})` : "";
  const subject = `Appointment confirmed — ${params.doctorName} on ${date}`;

  const text =
    `Hi ${params.patientName},\n\n` +
    `Your appointment is confirmed.\n\n` +
    `Doctor: ${params.doctorName}${spec}\n` +
    `Date:   ${date}\n` +
    `Time:   ${time}\n\n` +
    `If you can't make it, please cancel from your MediSlot dashboard.\n\n` +
    `— MediSlot`;

  const html =
    `<p>Hi ${escapeHtml(params.patientName)},</p>` +
    `<p>Your appointment is <strong>confirmed</strong>.</p>` +
    `<ul>` +
    `<li><strong>Doctor:</strong> ${escapeHtml(params.doctorName + spec)}</li>` +
    `<li><strong>Date:</strong> ${escapeHtml(date)}</li>` +
    `<li><strong>Time:</strong> ${escapeHtml(time)}</li>` +
    `</ul>` +
    `<p>If you can't make it, please cancel from your MediSlot dashboard.</p>` +
    `<p>— MediSlot</p>`;

  return { to, subject, html, text };
}

/**
 * Send the booking confirmation for an appointment. Best-effort: a missing
 * appointment or a transport failure is logged but never thrown, so a flaky
 * email provider can never break a successful booking. Callers `await` it so
 * the send completes before the request returns (and so tests are
 * deterministic).
 */
export async function sendBookingConfirmation(appointmentId: string): Promise<void> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        patient: { select: { email: true, name: true } },
        doctor: {
          select: { title: true, specialization: true, user: { select: { name: true } } },
        },
        timeSlot: { select: { startTime: true } },
      },
    });
    if (!appt) {
      logger.warn(
        { appointmentId },
        "[email] booking confirmation skipped — appointment not found",
      );
      return;
    }

    const doctorName = `${appt.doctor.title ? `${appt.doctor.title} ` : ""}${appt.doctor.user.name}`;
    const message = buildBookingConfirmationEmail(appt.patient.email, {
      patientName: appt.patient.name,
      doctorName,
      specialization: appt.doctor.specialization,
      startTime: appt.timeSlot.startTime,
    });

    await getEmailProvider().send(message);
    logger.info(
      { appointmentId, to: appt.patient.email, provider: getEmailProvider().name },
      "[email] booking confirmation sent",
    );
  } catch (err) {
    logger.warn({ err, appointmentId }, "[email] booking confirmation failed");
  }
}
