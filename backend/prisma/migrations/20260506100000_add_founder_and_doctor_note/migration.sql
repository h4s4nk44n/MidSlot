-- Founder admin flag and doctor's clinical note column.
ALTER TABLE "User" ADD COLUMN "isFounder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Appointment" ADD COLUMN "doctorNote" TEXT;
