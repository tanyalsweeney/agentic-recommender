-- Split manifest_entries into three typed tables.
-- manifest_entries mixed tools, patterns, and failure modes with tool-specific
-- nullable columns on non-tool rows and an untyped domainKnowledgePayload jsonb.
-- Three separate tables enforce the right schema per entry type and remove
-- structural waste (deploymentModel etc. on pattern rows).

CREATE TABLE "manifest_tools" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tool_name" text NOT NULL UNIQUE,
  "category" text,
  "maturity_tier" text NOT NULL DEFAULT 'Emerging',
  "confidence_score" integer NOT NULL DEFAULT 5,
  "adoption_signals" jsonb NOT NULL DEFAULT '{}',
  "maintenance_signals" jsonb NOT NULL DEFAULT '{}',
  "deployment_model" text,
  "minimum_runtime_requirements" jsonb,
  "known_constraints" jsonb,
  "domain_knowledge_payload" jsonb,
  "last_refreshed_at" timestamptz,
  "vetted" boolean NOT NULL DEFAULT true,
  "owner" text NOT NULL DEFAULT 'global',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "manifest_tools_tier_deployment_idx"
  ON "manifest_tools" ("maturity_tier", "deployment_model");

CREATE TABLE "manifest_patterns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "pattern_name" text NOT NULL UNIQUE,
  "maturity_tier" text NOT NULL DEFAULT 'Emerging',
  "confidence_score" integer NOT NULL DEFAULT 5,
  "adoption_signals" jsonb NOT NULL DEFAULT '{}',
  "maintenance_signals" jsonb NOT NULL DEFAULT '{}',
  "domain_knowledge_payload" jsonb NOT NULL,
  "last_refreshed_at" timestamptz,
  "vetted" boolean NOT NULL DEFAULT true,
  "owner" text NOT NULL DEFAULT 'global',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "manifest_failure_modes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "failure_mode_name" text NOT NULL UNIQUE,
  "maturity_tier" text NOT NULL DEFAULT 'Established',
  "confidence_score" integer NOT NULL DEFAULT 9,
  "adoption_signals" jsonb NOT NULL DEFAULT '{}',
  "maintenance_signals" jsonb NOT NULL DEFAULT '{}',
  "domain_knowledge_payload" jsonb NOT NULL,
  "last_refreshed_at" timestamptz,
  "vetted" boolean NOT NULL DEFAULT true,
  "owner" text NOT NULL DEFAULT 'global',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

DROP TABLE "manifest_entries";
