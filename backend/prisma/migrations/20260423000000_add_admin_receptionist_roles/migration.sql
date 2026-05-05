-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';
ALTER TYPE "Role" ADD VALUE 'RECEPTIONIST';

-- CreateTable
CREATE TABLE "ReceptionistAssignment" (
    "id" TEXT NOT NULL,
    "receptionistId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceptionistAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceptionistAssignment_receptionistId_doctorId_key" ON "ReceptionistAssignment"("receptionistId", "doctorId");

-- CreateIndex
CREATE INDEX "ReceptionistAssignment_receptionistId_idx" ON "ReceptionistAssignment"("receptionistId");

-- CreateIndex
CREATE INDEX "ReceptionistAssignment_doctorId_idx" ON "ReceptionistAssignment"("doctorId");

-- CreateIndex
CREATE INDEX "ReceptionistAssignment_assignedByUserId_idx" ON "ReceptionistAssignment"("assignedByUserId");

-- AddForeignKey
ALTER TABLE "ReceptionistAssignment" ADD CONSTRAINT "ReceptionistAssignment_receptionistId_fkey" FOREIGN KEY ("receptionistId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionistAssignment" ADD CONSTRAINT "ReceptionistAssignment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceptionistAssignment" ADD CONSTRAINT "ReceptionistAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
