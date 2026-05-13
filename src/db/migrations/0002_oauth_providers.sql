ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_provider_id_idx" ON "users" ("provider","provider_id") WHERE "provider" IS NOT NULL;
