import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  integer,
  date,
  primaryKey,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── users ─────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  tier: text("tier").notNull().default("free"), // free | pass1 | pass2
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  suspended: boolean("suspended").notNull().default(false),
  dailyRunCount: integer("daily_run_count").notNull().default(0),
  dailyRunResetAt: timestamp("daily_run_reset_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── runs ──────────────────────────────────────────────────────────────────────

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status").notNull().default("queued"), // queued | running | completed | failed
    tier: text("tier").notNull(), // free | pass1 | pass2
    verifiedContext: jsonb("verified_context").notNull().default({}),
    verifiedContextHash: text("verified_context_hash").notNull(),
    tenantContextTag: text("tenant_context_tag"),
    pass1Output: jsonb("pass1_output"),
    pass2Output: jsonb("pass2_output"),
    maturityLabelDistribution: jsonb("maturity_label_distribution"),
    charged: boolean("charged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("runs_user_id_created_at_idx").on(t.userId, t.createdAt)]
);

// ── run_checkpoints ───────────────────────────────────────────────────────────

export const runCheckpoints = pgTable(
  "run_checkpoints",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id),
    agentName: text("agent_name").notNull(),
    wave: text("wave").notNull(),
    status: text("status").notNull().default("pending"), // pending | completed | failed
    outputJsonb: jsonb("output_jsonb"),
    // Stores hashes of all upstream checkpoints this one depended on.
    // Reuse is only valid when all upstream hashes also match (4th validity condition).
    upstreamHashes: jsonb("upstream_hashes").notNull().default({}),
    agentVersion: text("agent_version").notNull(), // YYYY-MM-DD-{sha256_8chars}
    manifestVersion: text("manifest_version").notNull(),
    contextHash: text("context_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    index("run_checkpoints_reuse_idx").on(
      t.contextHash,
      t.agentName,
      t.agentVersion,
      t.manifestVersion
    ),
  ]
);

// ── cv_result_cache ───────────────────────────────────────────────────────────

export const cvResultCache = pgTable(
  "cv_result_cache",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    toolName: text("tool_name").notNull(),
    toolVersion: text("tool_version").notNull().default("unknown"),
    cveStatus: jsonb("cve_status"),
    compatStatus: jsonb("compat_status"),
    pricing: jsonb("pricing"),
    eolDate: date("eol_date"),
    license: text("license"),
    breakingChanges: jsonb("breaking_changes"),
    regionalAvailability: jsonb("regional_availability"),
    sourceUrl: text("source_url"),
    cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().default(sql`now()`),
    ttlSeconds: integer("ttl_seconds").notNull().default(86400),
  },
  (t) => [unique("cv_result_cache_tool_version_unique").on(t.toolName, t.toolVersion)]
);

// ── manifest_tools ────────────────────────────────────────────────────────────

export const manifestTools = pgTable(
  "manifest_tools",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    toolName: text("tool_name").notNull().unique(),
    category: text("category"), // orchestration-framework | vector-db | llm-sdk | job-queue | etc.
    maturityTier: text("maturity_tier").notNull().default("Emerging"),
    confidenceScore: integer("confidence_score").notNull().default(5),
    adoptionSignals: jsonb("adoption_signals").notNull().default({}),
    maintenanceSignals: jsonb("maintenance_signals").notNull().default({}),
    // How this tool is consumed. Values: managed_cloud | self_hosted | sdk | framework | saas | cli
    // CV reasons about deployment compatibility from this fact — does not pre-store conclusions.
    deploymentModel: text("deployment_model"),
    // Floor requirements to run this tool at baseline. Use case adds on top.
    minimumRuntimeRequirements: jsonb("minimum_runtime_requirements"),
    // Documented hard constraints that affect architectural decisions regardless of use case.
    knownConstraints: jsonb("known_constraints"),
    // Optional tool-specific domain knowledge. Maintained by the Manifest Gatekeeper.
    domainKnowledgePayload: jsonb("domain_knowledge_payload"),
    lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
    vetted: boolean("vetted").notNull().default(true),
    owner: text("owner").notNull().default("global"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [index("manifest_tools_tier_deployment_idx").on(t.maturityTier, t.deploymentModel)]
);

// ── manifest_patterns ─────────────────────────────────────────────────────────

export const manifestPatterns = pgTable("manifest_patterns", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  patternName: text("pattern_name").notNull().unique(),
  maturityTier: text("maturity_tier").notNull().default("Emerging"),
  confidenceScore: integer("confidence_score").notNull().default(5),
  adoptionSignals: jsonb("adoption_signals").notNull().default({}),
  maintenanceSignals: jsonb("maintenance_signals").notNull().default({}),
  // Required. Shape: { knownGotchas, failurePosture, scaleConsiderations, stateHandoffPoints, mixingNotes }
  // Maintained by the Manifest Gatekeeper without code changes.
  domainKnowledgePayload: jsonb("domain_knowledge_payload").notNull(),
  lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
  vetted: boolean("vetted").notNull().default(true),
  owner: text("owner").notNull().default("global"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── manifest_failure_modes ────────────────────────────────────────────────────

export const manifestFailureModes = pgTable("manifest_failure_modes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  failureModeName: text("failure_mode_name").notNull().unique(),
  maturityTier: text("maturity_tier").notNull().default("Established"),
  confidenceScore: integer("confidence_score").notNull().default(9),
  adoptionSignals: jsonb("adoption_signals").notNull().default({}),
  maintenanceSignals: jsonb("maintenance_signals").notNull().default({}),
  // Required. Shape: { description, likelihoodSignals, detectionApproach, mitigationApproaches, domainApplicability }
  // Maintained by the Manifest Gatekeeper without code changes.
  domainKnowledgePayload: jsonb("domain_knowledge_payload").notNull(),
  lastRefreshedAt: timestamp("last_refreshed_at", { withTimezone: true }),
  vetted: boolean("vetted").notNull().default(true),
  owner: text("owner").notNull().default("global"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── org_list ──────────────────────────────────────────────────────────────────

export const orgList = pgTable("org_list", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgName: text("org_name").notNull(),
  tier: integer("tier").notNull(), // 1 | 2 | 3
  signals: jsonb("signals").notNull().default({}),
  maintenanceActive: boolean("maintenance_active").notNull().default(true),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  owner: text("owner").notNull().default("global"),
  status: text("status").notNull().default("active"), // active | flagged | removed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── org_list_proposals ────────────────────────────────────────────────────────

export const orgListProposals = pgTable("org_list_proposals", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id").references(() => orgList.id),
  action: text("action").notNull(), // add | remove | tier-change
  justification: text("justification"),
  sources: jsonb("sources").notNull().default([]),
  status: text("status").notNull().default("pending"), // pending | approved | overridden | rejected
  secondPassFindings: jsonb("second_pass_findings"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── vendor_relationship_cache ─────────────────────────────────────────────────

export const vendorRelationshipCache = pgTable("vendor_relationship_cache", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  vendorName: text("vendor_name").notNull(),
  parentOrg: text("parent_org"),
  affiliates: jsonb("affiliates").notNull().default([]),
  cachedAt: timestamp("cached_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── config ────────────────────────────────────────────────────────────────────

export const config = pgTable(
  "config",
  {
    key: text("key").notNull(),
    value: text("value").notNull(),
    // All system defaults use owner = 'global'.
    // Per-tenant overrides use owner = tenant_id.
    // Always resolve tenant override first, fall back to global.
    owner: text("owner").notNull().default("global"),
  },
  (t) => [primaryKey({ columns: [t.key, t.owner] })]
);

// ── user_holds ────────────────────────────────────────────────────────────────

export const userHolds = pgTable("user_holds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgList.id),
  liftedAt: timestamp("lifted_at", { withTimezone: true }),
  researchFindings: jsonb("research_findings"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── admin_holds ───────────────────────────────────────────────────────────────

export const adminHolds = pgTable("admin_holds", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: uuid("org_id")
    .notNull()
    .references(() => orgList.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolution: text("resolution"),
  flaggedBy: text("flagged_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── jobs ──────────────────────────────────────────────────────────────────────
// Admin observability mirror of BullMQ job state.
// Primary job state lives in Redis/BullMQ — this table is read-only for dashboards.

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(),
  status: text("status").notNull().default("queued"),
  payload: jsonb("payload").notNull().default({}),
  runId: uuid("run_id").references(() => runs.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
