-- MEDI-99: track when the 24h reminder email was sent for an appointment so
-- the scheduler never sends a duplicate reminder for the same appointment.
ALTER TABLE "Appointment" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
