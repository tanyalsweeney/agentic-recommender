-- Rename wave0_domain_tag to tenant_context_tag.
-- "Wave 0" as a concept is retired. Tenant-specific context injection is
-- handled in the run submission path, not as a pipeline wave. See spec.md
-- and the tenant-context module in packages/workers for the full picture.
ALTER TABLE "runs" RENAME COLUMN "wave0_domain_tag" TO "tenant_context_tag";
