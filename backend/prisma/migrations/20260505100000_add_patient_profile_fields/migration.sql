-- CreateEnum
CREATE TYPE "BloodType" AS ENUM (
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN'
);

-- AlterTable: add patient profile fields to User
ALTER TABLE "User"
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "dateOfBirth" TIMESTAMP(3),
  ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED',
  ADD COLUMN "address" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT,
  ADD COLUMN "emergencyContactRelation" TEXT,
  ADD COLUMN "bloodType" "BloodType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "allergies" TEXT,
  ADD COLUMN "chronicConditions" TEXT,
  ADD COLUMN "currentMedications" TEXT,
  ADD COLUMN "nationalId" TEXT,
  ADD COLUMN "insuranceProvider" TEXT,
  ADD COLUMN "insurancePolicyNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_nationalId_key" ON "User"("nationalId");
