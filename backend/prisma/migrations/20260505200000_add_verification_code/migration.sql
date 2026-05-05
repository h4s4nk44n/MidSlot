-- CreateTable
CREATE TABLE "VerificationCode" (
  "id"           TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "requesterId"  TEXT NOT NULL,
  "purpose"      TEXT NOT NULL,
  "codeHash"     TEXT NOT NULL,
  "payload"      JSONB NOT NULL,
  "attempts"     INTEGER NOT NULL DEFAULT 0,
  "maxAttempts"  INTEGER NOT NULL DEFAULT 5,
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "consumedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationCode_targetUserId_idx" ON "VerificationCode"("targetUserId");
CREATE INDEX "VerificationCode_requesterId_idx" ON "VerificationCode"("requesterId");
CREATE INDEX "VerificationCode_expiresAt_idx" ON "VerificationCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationCode" ADD CONSTRAINT "VerificationCode_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
