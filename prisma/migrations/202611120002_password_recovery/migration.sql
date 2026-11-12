BEGIN;
CREATE TABLE "PasswordRecovery" (
    "id" UUID NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'recovery',
    "tokenHash" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "athleteId" UUID,
    "accessRevision" INTEGER,
    "attemptHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "deliveryFailedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordRecovery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PasswordRecovery_tokenHash_key" ON "PasswordRecovery"("tokenHash");
CREATE INDEX "PasswordRecovery_athleteId_idx" ON "PasswordRecovery"("athleteId");
ALTER TABLE "PasswordRecovery" ADD CONSTRAINT "PasswordRecovery_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
