-- Add isActive flag to User. Defaults true so existing rows remain enabled.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "User_isActive_idx" ON "User"("isActive");
