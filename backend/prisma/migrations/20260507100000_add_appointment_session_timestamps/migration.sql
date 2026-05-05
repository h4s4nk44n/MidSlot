-- Track when the doctor opens (startedAt) and ends (endedAt) the in-person
-- session. Used by the auto-cancel rule (no start within 1h of slot end) and
-- to gate doctor-note edits.
ALTER TABLE "Appointment" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "endedAt" TIMESTAMP(3);
