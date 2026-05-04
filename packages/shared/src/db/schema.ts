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
import { uuidv7 } from "uuidv7";

// ── tenants ───────────────────────────────────────────────────────────────────

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  // standard | premium | enterprise — controls attribution and white-label options
  plan: text("plan").notNull().default("standard"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── users ─────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  email: text("email").notNull().unique(),
  // Null for global (non-tenant) users
  tenantId: uuid("tenant_id").references(() => tenants.id),
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
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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

// ── manifest_proposals ────────────────────────────────────────────────────────
// Proposed manifest changes queued for Manifest Gatekeeper review.
// Proposing agent writes here; Gatekeeper worker reads and resolves each entry.

export const manifestProposals = pgTable("manifest_proposals", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  toolName: text("tool_name").notNull(),
  proposedEntry: jsonb("proposed_entry").notNull(),
  proposingAgent: text("proposing_agent").notNull(),
  // pending | approved | rejected | escalated
  status: text("status").notNull().default("pending"),
  gatekeeperFindings: jsonb("gatekeeper_findings"),
  cycleCount: integer("cycle_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── org_list ──────────────────────────────────────────────────────────────────

export const orgList = pgTable("org_list", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
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
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  type: text("type").notNull(),
  status: text("status").notNull().default("queued"),
  payload: jsonb("payload").notNull().default({}),
  runId: uuid("run_id").references(() => runs.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ── tenant_secrets ────────────────────────────────────────────────────────────
// BYOK API keys. Field-level encrypted — never stored plaintext.
// Encryption/decryption handled by packages/shared/src/crypto.ts.

export const tenantSecrets = pgTable("tenant_secrets", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  // anthropic | kimi | openai | etc.
  provider: text("provider").notNull(),
  // AES-256-GCM ciphertext: "{iv_hex}:{ciphertext_hex}:{auth_tag_hex}"
  encryptedKey: text("encrypted_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  rotatedAt: timestamp("rotated_at", { withTimezone: true }),
});

// ── themes ────────────────────────────────────────────────────────────────────
// System presets (owner = 'global') and tenant-specific themes.
// Version is YYYY-MM-DD-{sha256_8(token_map + custom_css)}, computed on write.

export const themes = pgTable("themes", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  name: text("name").notNull(),
  // 'global' for system presets; tenant_id for tenant-specific themes
  owner: text("owner").notNull().default("global"),
  // Flat token map: color.primary, typography.fontFamily.heading, radius.base, etc.
  tokenMap: jsonb("token_map").notNull().default({}),
  // Optional CSS for animations and keyframes — not encodeable as tokens
  customCss: text("custom_css"),
  // Auto-computed from token_map + custom_css. Changes when either changes.
  version: text("version").notNull(),
  // draft | published
  status: text("status").notNull().default("published"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── theme_assignments ─────────────────────────────────────────────────────────
// Maps an owner+mode to a theme. Mode (light/dark) is a relationship here,
// not encoded in the theme itself — allows independent designs per mode.

export const themeAssignments = pgTable("theme_assignments", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  // 'global' for the system default; tenant_id for tenant-specific assignments
  owner: text("owner").notNull().default("global"),
  // light | dark
  mode: text("mode").notNull(),
  themeId: uuid("theme_id")
    .notNull()
    .references(() => themes.id),
  // Per-assignment token overrides (e.g. tenant logo color tweak)
  tokenOverrides: jsonb("token_overrides").notNull().default({}),
  // Tenant logo URL (Vercel Blob). Null for global assignments.
  logoUrl: text("logo_url"),
  // draft | published
  status: text("status").notNull().default("published"),
  // Cache key for theme resolution: version-as-cache-key strategy
  version: text("version").notNull(),
  // Time-bounded seasonal themes. Null = always active.
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// ── user_theme_preferences ────────────────────────────────────────────────────
// Stub for future user-level opt-in (seasonal/novelty themes).
// Schema in place; resolution logic and UI deferred.

export const userThemePreferences = pgTable(
  "user_theme_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id),
    activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().default(sql`now()`),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.themeId] })]
);
