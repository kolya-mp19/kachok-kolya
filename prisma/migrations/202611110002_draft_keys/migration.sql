BEGIN;
CREATE TABLE "DraftKey" (
  "athleteId" TEXT PRIMARY KEY,
  "keyId" UUID NOT NULL UNIQUE,
  "key" BYTEA NOT NULL CHECK (octet_length("key") = 32)
);
COMMIT;
