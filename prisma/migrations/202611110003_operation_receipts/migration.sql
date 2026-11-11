BEGIN;
CREATE TABLE "OperationReceipt" (
  "athleteId" TEXT NOT NULL,
  "operationId" UUID NOT NULL,
  "recoveryGeneration" TEXT NOT NULL,
  "commandHash" TEXT NOT NULL,
  "revision" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  PRIMARY KEY ("athleteId", "operationId")
);
COMMIT;
