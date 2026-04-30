-- Remove pre-stored compatibility conclusions — these invited CV to shortcut
-- true tool-pair validation, one of Agent12's core differentiators.
-- Replace with objective facts the CV reasons from, not conclusions it looks up.
ALTER TABLE "manifest_entries" DROP COLUMN "platform_compat";
ALTER TABLE "manifest_entries" DROP COLUMN "model_compat";
ALTER TABLE "manifest_entries" ADD COLUMN "deployment_model" text;
ALTER TABLE "manifest_entries" ADD COLUMN "minimum_runtime_requirements" jsonb;
ALTER TABLE "manifest_entries" ADD COLUMN "known_constraints" jsonb;
DROP INDEX IF EXISTS "manifest_entries_tier_platform_idx";
CREATE INDEX "manifest_entries_tier_deployment_idx" ON "manifest_entries" ("maturity_tier","deployment_model");
