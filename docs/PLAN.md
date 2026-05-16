# Build Plan — Agent12

Spec is complete and reviewed. This is the build sequence.

Tech stack: TypeScript monorepo (pnpm workspaces), Next.js, BullMQ + Redis,
PostgreSQL, Drizzle ORM, Anthropic SDK, Vitest, Playwright.

---

## Phase 0 — Monorepo scaffolding `[Done]`

- Initialize pnpm workspaces
- Create packages: `web/`, `workers/`, `agents/`, `shared/`, `evals/`
- Configure TypeScript across all packages (shared tsconfig base)
- Set up Vitest as the unit/integration test runner in `shared/` and `agents/`
- Connect a test PostgreSQL database for integration tests
- Confirm: `pnpm test` runs with zero tests and zero failures

No application code yet. Just the skeleton.

---

## Phase 1 — Database schema `[Done]`

**Write tests first, then schema.**

1. Write integration tests for each table: correct columns, indexes, foreign key
   constraints, config resolution (tenant override falls back to global default)
2. Write the Drizzle schema (`packages/shared/src/db/schema.ts`) to make them pass
3. Run the initial migration
4. Verify all 4 required indexes exist

Tables: `users`, `runs`, `run_checkpoints`, `cv_result_cache`, `manifest_entries`,
`org_list`, `org_list_proposals`, `vendor_relationship_cache`, `config`,
`user_holds`, `admin_holds`, `jobs`

The schema is the foundation. Everything downstream reads or writes to it.

---

## Phase 2 — Agent layer `[Done]`

**Write Zod schemas and eval cases first, then implement callers.**

### 2a. Zod output schemas `[Done]`
For each agent, write the Zod schema that defines what the agent must return.
This is the agent contract — define it before any SDK call exists.

Agents: intake, orchestration, security, memory-state, tool-integration,
failure-observability, trust-control, compatibility-validator, skeptic,
technical-writer

### 2b. Unit tests (before callers) `[Done]`
For each Zod schema:
- Valid output passes validation
- Malformed output (wrong field name, missing required field, extra nesting) throws
  with the right error message
- Schema validation falls back gracefully (low-confidence state for intake agent)

### 2c. Eval cases (before callers, runs in Phase 3d) `[Done]`
Write test cases in `packages/evals/` — known input descriptions paired with
expected output patterns — for the 12 eval targets from the eng review test plan.
Cases are defined now; execution waits until callers exist.

### 2d. Agent callers `[Done]`
Implement Anthropic SDK callers for each agent with 3-layer prompt caching:
- Layer 1: system prompt + specialist instructions (`cache_control: ephemeral`)
- Layer 2: full manifest as context (`cache_control: ephemeral`)
- Layer 3: verified context + upstream outputs (no cache)

Agent version format: `YYYY-MM-DD-{sha256_8chars}` of the prompt template file.
Computed at startup and stored in an in-memory registry.

### 2e. Maintenance agents `[Done]`
The manifest and org list stay current through agentic gatekeepers. Same
structure as existing agents: Zod schema, prompt template, caller, eval cases,
3-layer prompt caching.

**Manifest Gatekeeper:** Reviews proposed manifest entry changes (new tools,
updated descriptions, version bumps, deprecations). Approves, rejects, or
escalates. Rejection drops the entry; next refresh cycle is the retry.

**Org List Gatekeeper:** Reviews proposed org list additions and modifications.
Same approve/reject/escalate pattern. Human escalation on schema changes.

Eval cases for both: known proposed changes paired with expected
approve/reject/escalate outcomes.

### 2f. Manifest seeder `[Done]`
Seeds the three typed manifest tables (manifest_tools, manifest_patterns,
manifest_failure_modes) with a cloud engineer tool catalog. 15 tools,
6 patterns, 6 failure modes. All seeded entries marked vetted = true.

---

## Phase 3 — Pipeline workers

### 3a. Checkpoint logic tests `[Done]`
- Context hash matches: checkpoint is reusable
- Agent version changed: checkpoint invalid
- Manifest refreshed: checkpoint invalid
- Upstream hash changed: checkpoint invalid (the 4th validity condition)
- All conditions met: agent skipped, cached output returned

### 3b. BullMQ flow integration tests `[Done]`
- FlowProducer creates Wave 1 jobs as children of Wave 2 parent
- Wave 2 waits for all Wave 1 children to complete before starting
- Wave 2.5 waits for Wave 2; Wave 3 waits for Wave 2.5
- Server restart: in-flight job resumes from last checkpoint

### 3c. Implement pipeline `[Done]`
Wave structure wired via BullMQ FlowProducer. Checkpoint write/read implemented
with 4-condition reuse. Retry/failure escalation per spec.

Tenant context (formerly Wave 0): pre-registered structured data (regulatory
controls, prohibited tools, certifications) injected into verifiedContext before
Wave 1. Not a BullMQ job. Versioned using the `YYYY-MM-DD-{hash8}` pattern,
stored at write time, validated in checkpoint upstreamHashes.

### 3d. Run evals `[Done]`
Execute the 12 eval cases from Phase 2c against the live agent callers.
Establish baselines. Any prompt change that breaks a baseline must be caught
before merging.

Run: `pnpm --filter evals eval:skeptic` (P1 baseline required), then each
other eval suite. Pipeline output verified by reading the database — no UI needed.

**Baselines established (2026-05-01):** Skeptic 6/6, Intake 8/8,
Orchestration 3/3, Technical Writer 5/5, Security 6/6, Gatekeeper 26/26.
Cooperative and CV are placeholder suites with no tests yet.

Eval suites refactored to `beforeAll` per scenario — one API call per unique
input shared across all assertions. Security split into two sequential scenarios
(read-only web + write-access web) to avoid TCP timeout on complex responses.
Agent call logger added (`AGENT_CALL_LOG` env var) — appends timing, token
counts, cache breakdown, and estimated cost per call to a CSV file.

**AgentKey registry bug found and fixed (2026-05-01):** All multi-word agent
keys in the worker layer used snake_case (`memory_state`, `tool_integration`,
`failure_observability`, etc.) while the version registry and
`DEFAULT_PROVIDER_CONFIGS` used camelCase. Version lookup would have thrown at
runtime for every multi-word agent. The worker layer had never been exercised
end-to-end — this was caught during a completion audit. Fixed in the Wave 2
cooperative exchange PR; all worker keys are now camelCase.

### 3e. Maintenance workers `[Done]`
BullMQ workers for manifest refresh and Gatekeeper runs on a separate
`maintenance` queue (pipeline queue is not blocked by maintenance jobs).

**Schema additions (migration 0007):**
- `manifest_proposals` table added (was incorrectly listed as pre-existing in
  earlier handoff). `last_refreshed_at` was already present on typed manifest
  tables from migration 0006.
- All uuid primary keys switched from DB-side `gen_random_uuid()` to
  application-side `uuidv7()` via Drizzle `$defaultFn` (better B-tree index
  performance; no Railway infrastructure change needed). Drizzle meta snapshot
  collision between 0004/0005 repaired; missing 0006 snapshot added.

**Workers built:**
- `maintenance.staleness_check`: finds stale tools, deduplicates against
  existing pending proposals, creates `manifest_proposals` entries and queues
  a Gatekeeper run for each
- `maintenance.manifest_gatekeeper`: runs ManifestGatekeeperAgent against a
  proposal; handles accepted/rejected/escalated/needs_more_cycles with 2-cycle
  cap; passes prior findings back on cycle 2
- `maintenance.org_list_gatekeeper`: runs OrgListGatekeeperAgent; stores
  findings on the proposal without applying changes — org list changes require
  human approval via admin dashboard

**Tests:** 10 integration tests (staleness check: 4; proposal processing: 6).
All tests use unique identifiers (uuidv7) and scoped afterEach cleanup —
concurrent-safe, no global table wipes.

### 3f. Multi-tenancy schema `[Done]`
Schema gap closed. All 6 missing tables added in migration 0008.

**Schema additions:**
- `tenants` (id, name, slug, plan)
- `tenant_id` FK on `users` (nullable — global users have null)
- `tenant_secrets`: BYOK keys stored AES-256-GCM encrypted via Node.js crypto
  built-in; `ENCRYPTION_KEY` env var required (32 bytes, base64). Key in
  `.env.example` and `.env.local`.
- `themes`: token map + optional custom_css + computed version
  (YYYY-MM-DD-{sha256_8}). Version recomputed on every write.
- `theme_assignments`: owner+mode → theme, with time-bounded support
  (valid_from/valid_until nullable)
- `user_theme_preferences`: stub only, no resolution logic yet

**Utilities:**
- `computeThemeVersion()` in `packages/shared/src/db/themes.ts`
- `getActiveThemeAssignment()` — respects published status and time bounds
- `encryptKey()` / `decryptKey()` in `packages/shared/src/crypto.ts`

**Seeded:** 8 global theme presets, 2 global assignments (light/dark →
default_light/default_dark), 7 `ui.string.*` config defaults.

**Deferred items:**
- Vercel Blob for tenant logo uploads: deferred to Phase 4 (no frontend yet)
- `tenant_id` threading from auth: deferred to Phase 4a (auth doesn't exist);
  worker layer already threads correctly

**Tests:** 19 tenancy tests + 9 tenant context injection tests. All
concurrent-safe via unique identifiers and scoped cleanup.

### 3g. Streaming in agent caller `[Done]`
Without streaming, complex user systems trigger responses long enough to drop
the underlying TCP connection before the full response arrives (~6 min
confirmed via security eval). Must be resolved before any production traffic.

`callAnthropicAgent` switched from `client.messages.create()` to
`client.messages.stream()`. Accumulates `input_json_delta` chunks via the
SDK's `inputJson` event; parses assembled JSON after `stream.finalMessage()`
resolves. `callOpenAICompatibleAgent` switched to `stream: true` with
`stream_options: { include_usage: true }`; iterates the async iterable to
accumulate tool call argument chunks. Usage stats sourced from `finalMessage`
(Anthropic) and the trailing usage chunk (OpenAI-compatible).

Two helpers exported from `base.ts` for testability: `assembleChunks` (joins
partial JSON strings) and `parseAssembledInput` (JSON.parse with agent-named
error). 14 unit tests cover partial chunk accumulation, single-byte
fragmentation, output parity with direct JSON.parse, and mid-stream error
propagation.

**Also fixed in this phase:** three parallel-run test isolation bugs found
during CI investigation:
- `schema.test.ts`: global `beforeEach` deletes on users/runs/runCheckpoints
  replaced with uuidv7 identifiers and scoped `afterEach` cleanup
- `tenancy.test.ts`: global `db.delete(config)` in `ui.string.*` `beforeEach`
  was racing with tenant-context tests; replaced with unique key suffix and
  scoped cleanup; hardcoded emails replaced with uuidv7-based values
- `technical-writer.eval.ts`: `DEFAULT_PROVIDER_CONFIGS.technical_writer`
  (snake_case) resolved to `undefined`; corrected to `technicalWriter`

### 3g.1. SDK mock tests for streaming callers `[Done]`

The streaming callers in `base.ts` are validated by evals (real API calls) but have
no unit tests covering the SDK integration paths. This means CI has no coverage for:
- `stream.on("inputJson", ...)` event accumulation (Anthropic)
- `for await (const chunk of stream)` loop and tool call detection (OpenAI-compatible)
- Usage stat extraction from `stream.finalMessage()` and trailing usage chunk
- Empty-stream error paths (`!assembled`, `!toolCallSeen`)

**8 tests in `packages/agents/src/__tests__/streaming-integration.test.ts`.**

Two fake implementations (no real SDK classes imported): `FakeAnthropicStream`
emits `inputJson` events synchronously inside `finalMessage()` so chunk accumulation
is fully testable without a live connection; `makeOpenAIStream()` is an async
generator yielding typed chunk objects.

Anthropic path (4 tests): multi-chunk accumulation and Zod parse, usage stat
extraction from `finalMessage`, empty-stream error, `finalMessage` error propagation.

OpenAI-compatible path (4 tests): multi-chunk accumulation and Zod parse, trailing
usage chunk capture, usage colocated with content chunk, empty-stream error.

### 3h. CV API integration layer and worker decomposition `[Done]`

Replaced the single CV agent call (training-knowledge-only) with a fully
decomposed, API-backed implementation covering every data point in the spec.

**API clients** (`packages/workers/src/cv-apis/`):
- `ghsa.ts` + `nvd.ts` + `cve-lookup.ts`: GHSA primary, NVD fallback; each
  advisory carries an `advisoryUrl` for human verification
- `pypi.ts` + `npm.ts` + `github-releases.ts`: version and license from package
  registries; `dependencies` field populated from `requires_dist` (PyPI) and
  merged `dependencies` + `peerDependencies` (npm)
- `web-search.ts`: re-export from `@agent12/agents`

**Web search** (`packages/agents/src/web-search.ts`):
- `searchToolData`: one Anthropic beta `web_search_20250305` call per tool
  covering pricing (dollar amounts), EOL date, breaking changes vs current
  stable, trip hazards; `sourceUrls` keyed by source type for human audit

**CV worker decomposition** (`packages/workers/src/workers/`):
- `per-tool-lookup.ts`: cache-first; carries `agentKey` (recommending wave 1/2
  agent) and `isUserSpecified` natively on `PerToolCvResult`; full field set
  (CVEs, version, license, EOL, breaking changes, pricing, trip hazards, sourceUrls)
- `cv-conflict-check.ts`: clean rewrite — imports `PerToolCvResult` directly,
  no separate input type, `agentKey` on `ConflictResult` from source
- `cv-conflict-check.ts`: `compatibleVersion` (formerly `compatibleAlternativeVersion`)
- `cost-context.ts`: `buildCostContext` extracts agent cost signals + confirmed
  intake fields; null when confidence is low
- `wave2_5.ts`: tool-agent association preserved from source through the full
  pipeline; parallel per-tool lookups, sequential conflict checks, cost context,
  CV agent synthesis with full `enrichedUpstream`

**Spec fixes this session (see spec.md):**
- Conflict resolution: no silent tool elimination; correction exchange added
  (1-cycle feedback to affected agents, three possible responses)
- Compatible version found: only the out-of-line agent receives the message
- Cross-tool compatibility: group-based (not pairwise), algorithmic flags are
  candidates reviewed by LLM reasoning layer before correction exchange
- `PerToolCvResult.agentKey` + `isUserSpecified` design settled

**Cross-tool check** (`cross-tool-check.ts`): group-based algorithmic conflict
detection using version range intersection across the full dependency group (not
pairwise). `hasIntersection` handles `>=/>/<=/< ` combinations; when no intersection
exists the group is flagged as a candidate conflict. LLM reasoning scaffold returns
`[]` pending full implementation — confirms or dismisses algorithmic flags in
architectural context. `runCrossToolLlmCheck` interface and output shape defined.

**Conflict correction exchange** (`conflict-resolution.ts`): 1-cycle feedback loop
from CV to affected wave 1/2 agents. Requests batched per agent (one call per agent
covering all its conflicts). Compatible version found: only the out-of-line agent
contacted. No compatible version: all involved agents contacted. Three agent
responses: `accepted_compatible_version` / `proposed_alternative` /
`flagged_unresolvable`. Proposed alternatives verified via lightweight dependency-
only lookup (no CVE/pricing/web search) checked against the full tool group using
`toolDependencies` from the request. `ConflictResolutionResponse` carries
`alternativeVerificationScope: "dependency-only"` so the Skeptic knows what was
checked and can use one of its 4 cycles to request full verification if needed.

**Deferred (not blocking Phase 4):**
- LLM reasoning layer for cross-tool check (confirms/dismisses algorithmic flags)
- `sourceUrls` dedicated DB column (currently stored in `compatStatus` jsonb)
- Pairwise cross-tool compatibility → already superseded by group-based approach

**Tests:** 19 cv-apis unit tests + 7 web-search unit tests (agents package) +
6 cost-context unit tests + 5 wave2_5 integration tests + 24 cv-cross-tool tests
(algorithmic, LLM scaffold, correction exchange with dependency verification) +
CV eval wired (3 scenarios); web-search eval added. 87/87 passing.

---

## Phase 3.4 — Static analysis hardening `[Done]`

Lands ahead of 3.5a so the new checks gate that phase's acceptance.

### 3.4a. ESLint scaffolding `[Done]`
- `eslint.config.mjs` flat config (typescript-eslint parser, type-aware)
- Rules: `no-floating-promises`, `no-misused-promises`, `no-unused-vars`, `no-unused-expressions`
- `pnpm lint` at root; fix existing violations to land green

### 3.4b. TypeScript strictness `[Done]`
- `noUnusedLocals: true`, `noUnusedParameters: true` in shared tsconfig base
- Catches the assigned-but-never-used class (e.g., `runner.ts:108` from the 3h audit)

### 3.4c. CI workflow `[Done]`
- `.github/workflows/ci.yml` on every PR with Postgres + Redis service containers
- Steps: install, typecheck, lint, test. Hard-fail.
- Required status checks on `main` enforced via repo settings

### 3.4 Acceptance gate
- `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass clean
- CI green on a no-op PR
- Pre-PR redteam cadence documented in CLAUDE.md (one paragraph)

Knip (dead code detection) deferred to a post-Phase-4 follow-up; tracked in
TODOS.md. Reason: most current "unused export" findings are entry-point
scaffolding for the unbuilt frontend, and the audit-class bug knip was
supposed to catch (`conflict-resolution.ts` tested-but-unwired) is actually
not flagged by knip because the test files count as consumers.

---

## Phase 3.4.5 — Schema lock for spec'd tables `[Done]`

Lock the column shape for tables specced in PRs #53 and #54 but not yet in
code. Schema-only this phase: no behavior wiring (Phase 4 consumes them).
Doing it now so the frontend doesn't drive schema decisions later under time
pressure.

**Migration 0010:**
- `codebase_digest_drafts` — drafts produced by code-aware intake MCP, awaiting
  user review (digest, quality_summary, expires_at, submitted_at)
- `tenant_modification_requests` — tenant-submitted config change requests
  (request_type, intent_description, status flow, quoted_amount, admin_notes)
- `tenant_communication_contexts` — admin-curated comm context per tenant
  (name, prompt_fragment, version, draft/published status)
- `manifest_intent_gap_questions` — curated intent gap question catalog,
  evolved by Manifest Gatekeeper (question_id unique, option_type, options,
  applicable_when, confidence_score, vetted, owner)

**Tests:** full schema coverage matching `user-scope.test.ts` depth: insert +
select round-trip, FK enforcement, defaults, unique constraints,
status-flow-friendly column types, scoped isolation.

Out of scope (separate surfaces): `cv_result_cache` column additions
(3.5a.3), per-entry manifest version columns (3.5a.4).

---

## Phase 3.4.6 — Schema lock for multi-tenancy data isolation `[Done]`

Lock the column shape for multi-tenancy data isolation work spec'd in handoff
queue. Schema-only this phase: no behavior wiring (Phase 4 wires login flow,
tenant-scoped reads, and offboarding policy).

Validated against Clerk and WorkOS data models (2026-05 docs) so the
abstraction reflects what each provider actually returns. Both providers use
`user_xxx` and `org_xxx` prefixed string IDs and treat their API as source of
truth for profile / membership / role data — we mirror only the join keys.

**Migrations 0011 + 0012:**
- `tenants.auth_provider` (text, default `'clerk'`) — provider routing per
  tenant. `clerk` for default tenants; `workos` for enterprise SSO.
- `tenants.auth_provider_org_id` (text, nullable) — Clerk's `org_xxx` or
  WorkOS's `org_xxx`. Null until the tenant signs up via the provider.
- `users.auth_provider` (text, default `'clerk'`) — inherited from tenant at
  signup; stored on user so global (no-tenant) users also have a value.
- `users.auth_provider_user_id` (text, nullable) — Clerk's `user_xxx` or
  WorkOS's `user_01H...` ULID. Null until provider-side signup completes.
- `runs.tenant_id` (uuid, nullable, FK tenants) — denormalized from
  `users.tenant_id` at run creation. Tenant-scoped reads filter on this
  column without joining through `users`.
- Composite unique `(auth_provider, auth_provider_org_id)` on tenants and
  `(auth_provider, auth_provider_user_id)` on users. PostgreSQL NULL
  semantics let pre-signup rows coexist; the constraint binds only when both
  values are set.

**What this enables (full abstraction wiring, Phase 4):**
- At signup: webhook fills `auth_provider_user_id` (Clerk `user.created` or
  WorkOS equivalent).
- At session validation: look up our user by `(auth_provider,
  auth_provider_user_id)` from the JWT's `sub` claim.
- At tenant switch: translate provider's active org id to our tenant via
  `(auth_provider, auth_provider_org_id)`.
- Per-tenant routing: read `tenants.auth_provider` to dispatch the right SDK.

**Explicitly NOT mirrored locally** (provider's API is source of truth):
- User profile (firstName, lastName, profilePicture, lastSignInAt)
- Organization metadata (domains, stripe_customer_id, name)
- Session tokens / JWTs (verified at request time via provider SDK)
- Multi-org membership (our model is 1:1 user→tenant via `users.tenant_id`)
- Roles and permissions (provider-managed)

**Tests:** per-modified-table schema files, full coverage matching the 3.4.5
pattern: defaults, value acceptance for both Clerk and WorkOS id formats,
update flow (provider-id-fills-in-later), composite unique enforcement,
PostgreSQL NULL collision semantics, cross-provider id collision (allowed),
FK enforcement on `runs.tenant_id`, scoped isolation queries.

**Behavior pieces this PR does NOT cover** (their tracking status):
- Auth provider routing dispatcher → tracked in TODOS.md P1 (Phase 4f
  addendum needed; without it the schema we just locked has no consumer).
- Cross-account access prohibition (read-time enforcement) → tracked in
  TODOS.md P1 (security blocker).
- Account-to-tenant binding immutability → tracked in TODOS.md P1.
- User offboarding policy → tracked in TODOS.md P3 (depends on Phase 4f).
- IP allowlisting per tenant → tracked in TODOS.md P3.
- Shareable links respecting tenant boundaries → tracked in TODOS.md P3
  (depends on whether shareable links ship pre-launch).
- Auth webhook idempotency table → tracked in TODOS.md P3 (optional at MVP
  if we lazily look up on demand instead of consuming webhooks).

---

## Phase 3.5a — Backend wiring closure pass `[Upcoming]`

Backend completeness pass before UI work begins. Closes wiring gaps identified
in the post-3h completion audit (BYOK never reaches the SDK; Wave 1 outputs
never reach CV/Skeptic/Pass 1; correction exchange exists but is unwired) and
locks schema additions that would be painful to retrofit after frontend ships.

Spec changes for this phase already applied: updated Wave 2.5 (per-tool data
availability, source URLs, correction request payload, resolution outcomes
storage), Wave 3 Skeptic (engagement pattern, qualified recommendation
framing), and Pipeline failure handling (per-entry manifest version reuse).

### 3.5a.1. BYOK runtime wiring (tenant scope) `[Done]`

Tenant BYOK keys are stored in `tenant_secrets` with AES-256-GCM encryption
(Phase 3f), but `runner.ts:108` discards the resolved key and `base.ts:74`
reads `process.env` directly. Tenant keys never reach the Anthropic SDK.

Shipped as PR #57. `getApiKey` now reads `tenant_secrets` (not `config`),
threads through `callAgent`, every caller wrapper takes `apiKey`, and the SDK
constructors use it instead of `process.env`. Verified end-to-end via
orchestration eval (1 real API call).

### 3.5a.1.b. BYOK runtime wiring (user scope) `[Done]`

Schema-lock for user-scoped credentials and extension of the resolution chain
to user → tenant → system env. `user_api_tokens` added schema-only; Phase 4
wires the MCP authentication flow.

**Migration 0009:**
- `user_secrets`: id, user_id, provider, encrypted_key, created_at, rotated_at.
  Same encryption format as `tenant_secrets`.
- `user_api_tokens`: id, user_id, token_hash (unique), name, created_at,
  last_used_at, revoked_at. No callers wired this phase.

**Tests:**
- `user-scope.test.ts`: insert + select round-trips; FK enforcement; unique
  constraint on `token_hash`; user-scoped isolation.
- `key-resolution.test.ts`: user-only key returns user value; user wins over
  tenant when both present; falls back to tenant when user has no key for the
  provider; falls back to env when neither.
- `runner.test.ts`: `run.userId` resolves user_secrets; user wins over tenant.

**Implementation:**
- Extend `getApiKey` signature to `(db, provider, userId, tenantId)`.
- Resolution: user → tenant → system env.
- `runner.ts` passes `run.userId` (already on the run row, no `RunAgentOpts`
  change needed).
- Maintenance workers pass `undefined` for both ids (system-scoped jobs).

### 3.5a.2. CV upstream wiring `[Upcoming]`

`queues.ts:46/49/56` pass `{}` as `wave1Results` to wave2_5/wave3/pass1. CV
runs with zero tools to validate; Skeptic and Technical Writer never see Wave
1's recommended stack. Spec 622-728 requires CV to consume Wave 1 outputs.

**Tests first:**
- `queues.test.ts` (new): worker dispatcher extracts wave1 outputs from
  `childrenValues` correctly for wave2_5, wave3, and pass1 (mirror the
  existing wave2.cooperative extraction at `queues.ts:32-39`).
- `wave2_5.test.ts`: with non-empty
  `wave1Results.toolIntegration.recommendedTools`, per-tool lookups fire for
  each tool (assert deps.queryX called).
- `wave2_5.test.ts`: user-specified tools from verifiedContext appear in
  `agentTools` with `isUserSpecified: true` (per spec 723-727).

**Implementation:**
- In `queues.ts`, extract wave1 outputs from `childrenValues` for each
  downstream stage. Pass into wave2_5, wave3, pass1.
- In `wave2_5.ts`, add user-specified tool extraction from `verifiedContext`,
  merge into `agentTools` with `isUserSpecified: true`.
- Tighten `wave1Results: unknown` typing in `processWave2_5Job` and parallel
  workers so this class of bug surfaces at compile time.

### 3.5a.3. Per-tool data availability and source URLs `[Upcoming]`

CV currently catches npm/pypi failures and returns null silently. Spec 853-854
requires non-critical-data failures to ship flagged with a vendor doc link.
Source URLs nested in `compat_status` jsonb; promoting to a dedicated column
matches the updated spec and unlocks admin queries.

**Tests first:**
- Migration test: new columns exist with default values; existing rows backfill
  cleanly.
- `cv-apis.test.ts`: npm/pypi/web-search failures populate the `unavailable`
  list for the affected category; do not return null silently.
- `per-tool-lookup.test.ts`: `dataAvailability.unavailable` lists missing
  categories; `sourceUrls` keyed by category from successful fetches.
- Zod schema test: `PerToolCvResult` carries `dataAvailability` (enum-typed
  available/unavailable lists) and `sourceUrls` (Record<DataPoint, string>).

**Implementation:**
- Migration `0009`: add `source_urls jsonb not null default '{}'` and
  `data_availability jsonb not null default '{"available":[],"unavailable":[]}'`
  to `cv_result_cache`. Backfill `source_urls` from
  `compat_status->'sourceUrls'` where present.
- Define `DataPoint` enum in shared:
  `cve | compatibility | version | license | eol | pricing |
   regional_availability | breaking_changes | trip_hazards`.
- Update `PerToolCvResult` Zod schema with the two new fields.
- Update `queryNpm`, `queryPypi`, `searchToolData` to record category failures
  into `dataAvailability.unavailable` instead of catch-and-null.
- Update `per-tool-lookup.ts` write path to populate the new columns.

### 3.5a.4. Per-entry manifest versioning (Tier 2) `[Upcoming]`

Current `manifestVersion` is a global hash; any manifest change invalidates
every agent's checkpoint. Per-entry tracking via agent-declared dependencies
recovers cross-run cache hits and removes the within-run race that
mid-pipeline manifest refreshes can cause.

**Tests first:**
- Migration test: `version` column exists on all three manifest tables.
- `manifest.test.ts`: `version` is recomputed on every write
  (content + last_refreshed_at).
- `checkpoint.test.ts`: agent's checkpoint is reusable when its declared
  referenced entries are unchanged, even if other entries have changed.
- `checkpoint.test.ts`: agent's checkpoint is invalidated when at least one
  declared referenced entry has changed.
- `runner.test.ts`: agents without `referencedManifestEntries` in their output
  fail loudly (don't silently fall through to "no dependencies").

**Implementation:**
- Migration `0010`: add `version text not null` to `manifest_tools`,
  `manifest_patterns`, `manifest_failure_modes`. App-side recompute on
  insert/update (Drizzle `$default` or pre-write hook).
- Add `referencedManifestEntries: { tools: string[], patterns: string[],
  failureModes: string[] }` to every agent's Zod output schema.
- Update agent prompts to instruct each agent to populate this field with
  entries it actually consulted.
- Update `runner.ts` to compute per-entry hashes for declared entries at
  checkpoint write time; store in `upstream_hashes` jsonb under a
  `manifest_entries:` namespace.
- Update `checkpoint.ts` reuse logic to compare per-entry hashes for declared
  entries only. The global `manifest_version` column on `run_checkpoints` is
  retained for audit but no longer used for reuse.
- Update existing eval suites — outputs now carry the new field. Re-baseline
  if any eval shifts.

### 3.5a.5. Correction exchange wiring `[Upcoming]`

`runConflictResolutionExchange` is exported from `conflict-resolution.ts` and
unit-tested but never called from production. Wiring requires: a richer
correction request payload (per updated spec 708), six per-agent
correction-response callers, a sibling field on the wave2_5 result for
resolution outcomes, and Skeptic's CV re-verification capability (per updated
spec 775).

**Tests first:**
- `conflict-resolution.test.ts`: exchange runs after both conflict-check
  phases and only when conflicts exist.
- `wave2_5.test.ts`: when CV detects a conflict, the wave2_5 result includes
  a `correctionExchangeOutcomes` sibling field carrying agent responses.
- `wave2_5.test.ts`: when no conflicts exist, no correction exchange runs.
- Per-agent caller tests (e.g., `tool-integration.test.ts`):
  correction-response caller produces output matching the three-outcome Zod
  schema; uses the agent's own system prompt with the correction-protocol
  addendum.
- `wave3.test.ts`: Skeptic input includes `correctionExchangeOutcomes`.
- `wave3.test.ts`: Skeptic can request CV re-verification of a proposed
  alternative; CV runs full per-tool checks and returns an updated finding.

**Implementation:**

*Protocol layer:*
- New `CorrectionRequest` and `CorrectionResponse` Zod schemas in
  `packages/agents/src/schemas/correction-exchange.ts`. Outcomes:
  `accepted_compatible_version | proposed_alternative | flagged_unresolvable`.
- Enriched payload per spec 708: conflict description + category, compatible
  version with verification depth, other agents' rationale, CV per-tool
  findings for tools in conflict, agent's own original output,
  flag-unresolvable reinforcement.
- New shared `callCorrectionResponse` core in `base.ts`: takes the agent's
  system prompt + correction-protocol addendum + agent-specific Zod schema.

*Per-agent wrappers (six thin callers, ~30 lines each):*
- `callOrchestrationCorrectionResponse`
- `callSecurityCorrectionResponse`
- `callMemoryStateCorrectionResponse`
- `callToolIntegrationCorrectionResponse`
- `callFailureObservabilityCorrectionResponse`
- `callTrustControlCorrectionResponse`

*Wiring in wave2_5.ts:*
- After cross-agent and cross-tool LLM checks complete, if any confirmed
  conflicts exist, invoke `runConflictResolutionExchange` with the per-agent
  callers.
- Add `correctionExchangeOutcomes` as a sibling field on the wave2_5 job
  result, separate from the CV agent output.

*Skeptic CV re-verification:*
- Add a CV re-verification entry point: takes a tool and version, runs the
  full per-tool sub-task suite, returns a `PerToolCvResult`.
- Update Skeptic's prompt and Zod schema to support "request CV
  re-verification" as a cycle action targeting a specific proposed
  alternative.
- Wire wave3 to dispatch CV re-verification calls and feed results back to
  Skeptic on its next cycle.

*Eval coverage:*
- 2 correction-exchange eval scenarios:
  1. CV detects a version conflict, agents accept the compatible version, no
     unresolvable flags
  2. CV detects an irreconcilable conflict, an agent flags unresolvable,
     Skeptic correctly attaches the resulting caveat tier

### 3.5a Acceptance gate

Phase 3.5a is done when:
- E2E worker test exists that submits a run with a mocked Anthropic SDK and
  asserts: tenant API key reaches the SDK constructor; CV's per-tool lookups
  fire for Wave 1's recommended tools; user-specified tools appear flagged in
  CV's output; correction exchange fires when CV detects a conflict;
  resolution outcomes appear on the wave2_5 result; Skeptic input includes
  resolution outcomes.
- All existing tests still pass.
- All eval baselines still pass (or are re-baselined with notes if any
  prompt-touching change shifts a result).
- New schema migrations apply cleanly to the test database.
- Phase 3.4 checks all pass: `pnpm lint`, `pnpm typecheck`.
- Pre-PR redteam pass completed per CLAUDE.md cadence.

---

## Phase 3.5b — Code-aware intake backend `[Upcoming]`

Backend implementation for the code-aware intake path. The user's AI
assistant runs in their IDE; we control MCP tool definitions and response
payloads, not assistant behavior (see spec.md "MCP integration model" for
the full control boundary). Bullets land incrementally; detailed design
is settled per-bullet during the writing of each PR. Quality Evaluator
leads since it is the most architecturally load-bearing piece and informs
design decisions for the remaining bullets. Phase 4 frontend work for
code-aware (review screen, MCP token UI, Pass 2 target selection) gates
on this phase.

### 3.5b.1. Quality Evaluator agent `[Upcoming]`

The Quality Evaluator scores each per-app digest entry and synthesizes
inferential fields when the user's AI assistant did not provide them.
Lives in `packages/agents/src/quality-evaluator/`. Runs as a background
BullMQ worker job triggered after `submit_codebase_digest` and after each
`update_codebase_digest`. See spec.md "Quality evaluation and clarification
loop" for the full architecture.

**Tests first:**
- Zod schema tests for evaluator output (`qualityScore`, `qualityFlags`,
  `clarifyingQuestions`, synthesized inferential fields)
- Server-side inference tests: missing `primaryPurpose` inferred from
  deps + README + file tree; missing `displayName` from manifest name
  field; missing `productCategory` derived from inferred `primaryPurpose`;
  rule-based `observedPatterns` from dependency patterns
- 3-layer cache structure tests: L1 stable across calls; L2 cached across
  per-app calls within a digest; L3 changes per-call; `cache_control`
  headers present
- L3 enrichment chain tests: manifest hit → `cv_result_cache` hit →
  internal cross-ref → uncatalogued marker; `isPrivate=true` skips manifest
  and `cv_result_cache`
- Self-iteration tests: low-scored entry triggers another pass; iteration
  caps at 3 passes (default, configurable); plateau exit when score does
  not improve
- Group-context synthesis tests: `distinguishingCharacteristics` synthesized
  from L2 inventory when agent input is missing or too generic given peers
- Re-evaluation on `update_codebase_digest`: only changed entries re-scored
- Eval cases under `packages/evals/src/quality-evaluator/` including
  false-fail protection (good descriptions that look thin to naive heuristics)

**Implementation:**
- Agent caller in `packages/agents/src/quality-evaluator/` matching the
  3-layer prompt cache pattern (CLAUDE.md non-negotiable)
- Server-side inference helpers (deps + README + file tree) for missing
  inferential essentials
- Rule-based inference for `observedPatterns` and partial
  `externalIntegrations` from parsed dependency set
- Raw package manifest parsing server-side (npm, pypi, etc.) into
  normalized `{name, version}` records; raw content discarded after parsing
  for privacy
- BullMQ worker in `packages/workers/src/workers/quality-evaluator.ts`
  with `Promise.all()` concurrency cap (configurable via admin dashboard)
- Self-iteration loop: max 3 passes per entry, plateau exit
- Email-on-completion via existing notification infrastructure
- BYOK resolution via existing `getApiKey`: user → tenant → env

**Acceptance:**
- Self-iteration converges within 3 passes on real eval digests
- Synthesized fields surface indistinguishably from agent-provided fields
  on the review screen (no provenance flagging)
- Eval suite passes including false-fail protection
- Full-flow integration test: submit → background eval → email →
  `quality_summary` state matches expectations
- Phase 3.4 checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- Pre-PR redteam pass per CLAUDE.md cadence

### 3.5b.2. Pattern & Cluster Analyzer agent `[Upcoming]`

Dedicated agent for code-aware digests that runs after the Quality
Evaluator to identify consolidation opportunities at the `productCategory`
level. Lives in `packages/agents/src/pattern-cluster-analyzer/`. Runs as
a background BullMQ worker job triggered after Quality Evaluator job
completion. See spec.md "Pattern & Cluster Analyzer" subsection for the
full architecture.

**Tests first:**
- Zod schema tests for evaluator output (`productCategory`,
  `consolidationOpportunity`, `reasoning`, `clusters`, `capabilityVariance`,
  `blockers` typed array, `supportingEvidence`, `clarificationQuestions`,
  `consolidationStrategyQuestion`)
- Single-app category short-circuit tests: server emits
  `consolidationOpportunity: 'none'` deterministically with no LLM call;
  no `clarificationQuestions` or `consolidationStrategyQuestion` produced
- Per-category call dispatch tests: multi-app categories trigger one LLM
  call each; `Promise.all()` concurrency cap respected
- 3-layer cache structure tests: L1 stable across calls; L2 cached across
  per-category calls within a digest; L3 changes per-call; `cache_control`
  headers present
- Sequencing test: analyzer waits for Quality Evaluator job completion
  before starting; sees synthesized fields (e.g., `distinguishingCharacteristics`
  synthesized from group context)
- Re-evaluation tests: on `update_codebase_digest`, only affected categories
  re-analyzed; categories with unchanged membership reuse prior analysis;
  entry's `productCategory` change correctly updates both source and
  destination categories
- Cluster identification tests: known multi-app categories with similar /
  divergent capabilities produce expected clusters and variance descriptions
- Migration test: `cluster_analysis` jsonb column on `codebase_digest_drafts`
  accepts the expected output shape
- Eval cases under `packages/evals/src/pattern-cluster-analyzer/`:
  representative digests with known consolidation patterns; `substantial` /
  `marginal` / `none` assessments; canonical scenarios (5 Launch Risk
  Evaluators, 4 Contract Volume Predictors)

**Implementation:**
- Agent caller in `packages/agents/src/pattern-cluster-analyzer/` matching
  the 3-layer prompt cache pattern (CLAUDE.md non-negotiable)
- BullMQ worker in `packages/workers/src/workers/pattern-cluster-analyzer.ts`,
  triggered after Quality Evaluator completes; iterates over multi-app
  categories with `Promise.all()` concurrency cap (configurable via admin
  dashboard)
- Single-app category short-circuit: server-side emit of deterministic
  output, no LLM call
- Affected-category diff logic: compare current categorization against
  prior state; categories with membership changes re-analyze; categories
  that became single-app emit deterministic output; categories that
  became multi-app trigger LLM
- Migration adds `cluster_analysis` jsonb column to `codebase_digest_drafts`
- Email-on-completion folds into the existing digest-evaluation notification
  (single email when Quality Evaluator and Pattern & Cluster Analyzer both
  complete; not separate emails)
- BYOK resolution via existing `getApiKey`: user → tenant → env

**Acceptance:**
- Single-app categories never trigger an LLM call
- Multi-app categories produce structured output matching the Zod schema;
  canonical eval cases pass
- Re-analysis on update touches only affected categories on real eval
  updates
- Migration applies cleanly; `cluster_analysis` column accepts the expected
  output structure
- Phase 3.4 checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- Pre-PR redteam pass per CLAUDE.md cadence

### 3.5b.3. MCP server + tool surface `[Upcoming]`

Dedicated MCP service at `packages/mcp/`, deployed to Railway, exposing
six tools: `submit_codebase_digest` (entry), `get_pending_clarifications`
+ `update_codebase_digest` (server-driven clarification loop),
`revise_codebase_digest` (assistant-driven changes),
`get_codebase_draft` (read state), `estimate_digest_cost` (read-only cost
estimate). HTTP+SSE transport. See spec.md "MCP tool surface", "MCP
server hosting", and "Authentication and BYOK" subsections for the full
architecture.

**Settled architecture:**
- Hosting: dedicated package, Railway deployment (not Vercel due to
  HTTP+SSE incompatibility with serverless function model). Shared
  dependencies on `packages/shared/` and `packages/agents/`; same Redis
  as `packages/workers/` for BullMQ enqueue.
- Authentication: Bearer token in `Authorization` header with format
  `agent12_pat_<32 bytes base64url>`. SHA-256 hash storage in
  `user_api_tokens.token_hash`. Soft-delete revocation via `revoked_at`.
  Debounced `last_used_at` (once per ~60s per token). Per-token rate
  limiting (60 RPM default, configurable via admin dashboard,
  Redis-backed).
- Response-driven iteration: tool responses include forward-looking
  guidance for the assistant. Recommended polling cadences: 90s after
  `submit_codebase_digest` (long initial wait); 20s after
  `update_codebase_digest` or `revise_codebase_digest` (short re-eval
  wait). Both configurable.
- Tool surface split (server-driven vs assistant-driven), referential
  integrity (strict), background eval concurrency (queue with
  coalescing), tool error reporting (MCP `isError` convention), empty
  update behavior (strict), raw artifact location and dependency
  reconciliation, delete of nonexistent app id (silent success). See
  spec.md "Code-aware intake" settled decisions for the full rationale
  on each.

**Tests first:**

*Auth and transport:*
- Token format generation and `agent12_pat_` prefix validation
- SHA-256 hashing of generated tokens; storage in
  `user_api_tokens.token_hash`
- Token validation flow: `Authorization` header parse, hash, lookup,
  `user_id` association; missing/invalid token returns 401 with generic
  error message
- Revoked token rejected (soft-delete `revoked_at` filter applied)
- Debounced `last_used_at` update (only updated if last update > 60s ago)
- Per-token rate limit enforcement via Redis (60 RPM default,
  configurable)

*Tool surface and behavior:*
- Each of the six tools accepts valid input and returns Zod-validated
  responses
- `get_pending_clarifications` returns per-app templates carrying
  `currentEntry`, `requestedUpdates`, and free-form `clarifyingQuestions`;
  optional `appId` filter narrows
- `update_codebase_digest` (clarification response) rejects fields
  outside the prior `requestedUpdates` template in `partialFailures`
- `revise_codebase_digest` (assistant-driven) handles
  `apps.{create, update, delete}`, `intentGaps.{create, update, delete}`,
  `intakePrefills` (partial-merge); returns `assignedAppIds`,
  `assignedIntentGapIds`, `affectedEntries`, `affectedCategories`
- `apps.update` partial-merge: absent fields preserved, present-value
  fields updated, explicit null clears nullable fields, required fields
  cannot be unset
- `apps.update` with unknown id returns `id_not_found` in
  `partialFailures` with no `didYouMean`; same for `intentGaps.update`
  and `appIds` filter on read tools
- `apps.create` and `intentGaps.create` omit id from input; server
  assigns uuidv7 returned in `assignedAppIds` / `assignedIntentGapIds`
  in input order
- `apps.delete` of an id still referenced in another entry's
  `dependencies.internal` succeeds in one call; response includes a
  non-blocking advisory listing dangling refs (id + displayName +
  referencePath) and prompting re-add via `apps.create` if
  unintentional
- Same-call cleanup (delete + create or update removing the reference)
  produces no advisory; post-update graph is clean
- Delete of nonexistent app id returns silent success; `affectedEntries`
  unchanged
- Dependency reconciliation: union by tool name when `dependencies` and
  `packageManifests` both present; `dependencies` wins on version conflict
- Empty update returns HTTP 200 with `isError: true` and content text
  directing to MCP `ping` method
- Tool error reporting: HTTP 200 for all valid JSON-RPC tool calls;
  `isError` true when zero entries landed, false otherwise;
  `partialFailures` populated in both cases
- Strict unknown keys at every nesting level: extra keys produce
  `unknown_field` in `partialFailures` with `didYouMean` when a close
  match exists; valid keys still land normally
- Pre-Zod normalization: leading and trailing whitespace stripped from
  string fields; `"true"` / `"false"` (case-insensitive) coerced to
  booleans; numeric strings (`Number.isFinite(parseFloat(v))`) coerced
  to numbers; `"5px"`, `"NaN"`, `""` produce `type_mismatch`
- `PartialFailure` path notation: dot-path with bracket indexes (e.g.
  `apps.update[2].dependencies.external[5].version`)
- Polling cadence guidance: 90s after `submit_codebase_digest`, 20s
  after `update_codebase_digest` or `revise_codebase_digest`

*Idempotency Tier 1 (explicit, assistant supplies `idempotencyKey`):*
- Same key + identical payload returns the cached response with
  `dedupedFromRecentSubmit: true` and `dedupePath: "explicit"`; no new
  draft, no new eval, no additional BYOK billing
- Same key + different payload returns `partialFailures` entry with
  `code: idempotency_collision` and `isError: true`; no draft created
- Fresh key (no prior entry) processes as a new submit and creates a
  new draft; Tier 2 implicit cache is NOT consulted on keyed submits
- Redis-backed key store with 24-hour TTL; keys scoped to
  `{user_id, idempotencyKey}`

*Idempotency Tier 2 (implicit, no `idempotencyKey` supplied):*
- No key + payload hash matching a recent same-user submit within the
  implicit dedup window returns the cached response with
  `dedupedFromRecentSubmit: true` and `dedupePath: "implicit"`; no new
  draft, no new eval, no additional BYOK billing
- No key + non-matching payload creates a new draft and stores a new
  implicit cache entry
- No key + matching payload after the implicit window has expired
  processes as a new submit (window TTL drives the freshness boundary)
- Implicit cache is `{user_id, request_hash} → response` in Redis with
  TTL `codebase_digest_drafts.implicit_dedup_window_minutes` (default
  5, per-tenant configurable)
- Per-tenant override of `implicit_dedup_window_minutes` is honored at
  both cache read and cache write times

*Precedence and override:*
- Fresh `idempotencyKey` + payload matching a recent un-keyed submit:
  Tier 1 wins, server processes as a new submit, implicit cache is
  bypassed (explicit always beats implicit)
- Keyed submit writes to Tier 1 cache only (not Tier 2); un-keyed
  submit writes to Tier 2 cache only (not Tier 1)

*Draft expiry:*
- Every read or write access (any MCP tool + web-UI review screen load)
  bumps `expires_at` to `now() + sliding_ttl_days` (per-tenant config,
  default 30)
- `expires_at` capped at `created_at + max_lifetime_days` (per-tenant
  config, default 90)
- Daily cleanup job at 3am UTC selects drafts with `expires_at < now()`
  and hard-deletes them (both submitted and unsubmitted)
- Cleanup cancels any in-flight Quality Evaluator and Pattern & Cluster
  Analyzer BullMQ jobs for the draft before deletion
- Concurrent MCP call landing on a just-deleted draft returns
  `id_not_found` partialFailure
- Per-tenant config override (`owner = tenant_id` on the config rows)
  is honored at both initial submit and every touch operation

*Concurrency:*
- In-flight Quality Evaluator and Pattern & Cluster Analyzer jobs
  complete normally; not canceled on new MCP calls
- New MCP calls during an in-flight eval register pending follow-up
  scope; multiple calls UNION into one follow-up
- Coalesced follow-up enqueues after in-flight eval completes; single
  email when all pending evals done

*Integration:*
- End-to-end submit → poll → clarification-response → re-eval flow with
  mocked Quality Evaluator output
- Multi-call coalescing scenario: submit + 3 rapid revises produce 1
  follow-up eval, not 3

**Implementation:**
- New `packages/mcp/` package: HTTP framework (Hono or Fastify), MCP
  SDK if available (or hand-rolled JSON-RPC + SSE)
- `packages/mcp/src/schemas/`: per-tool Zod schemas plus shared shapes
  (`AppEntry`, `AppEntryCreate`, `AppEntryUpdate`, `IntentGap`,
  `IntentGapCreate`, `IntentGapUpdate`, `IntakePrefills`,
  `PartialFailure`, `PollGuidance`) matching the Tool I/O contract in
  spec.md
- `packages/mcp/src/coerce.ts`: pre-Zod normalization helper (trim
  strings; case-insensitive `"true"` / `"false"` to boolean; numeric
  strings to number via `Number.isFinite(parseFloat(v))`; nulls and
  missing keys untouched). Not Zod's `.coerce.*`.
- `packages/mcp/src/partial-failure.ts`: `PartialFailure` builder plus
  `didYouMean` helper (Levenshtein distance up to 2 against the valid
  set for field names and enum values; never against ids)
- `packages/mcp/src/idempotency.ts`: two-tier Redis-backed dedup.
  Tier 1 explicit: `{user_id, idempotencyKey} → {request_hash,
  response}` with 24h TTL, collision detection on hash mismatch emits
  `idempotency_collision` partialFailure. Tier 2 implicit: `{user_id,
  request_hash} → response` with TTL from
  `codebase_digest_drafts.implicit_dedup_window_minutes` (default 5,
  per-tenant configurable). Mode selection: keyed submits use Tier 1
  only (read and write); un-keyed submits use Tier 2 only. Helper
  emits `dedupedFromRecentSubmit` and `dedupePath` fields on the
  response.
- `packages/mcp/src/draft-expiry.ts`: helper computing new
  `expires_at` on every draft access (`min(now() + sliding_ttl_days,
  created_at + max_lifetime_days)`); reads per-tenant config via
  existing `getConfig(key, tenantId)` helper
- `packages/workers/src/workers/cleanup-codebase-digest-drafts.ts`:
  daily BullMQ scheduled job at 3am UTC (cadence configurable);
  selects expired drafts, cancels in-flight Quality Evaluator and
  Pattern & Cluster Analyzer jobs (`job.remove()` for queued,
  abort-signal pattern for in-progress), hard-deletes draft rows
- `packages/mcp/src/auth.ts`: token validation middleware
- `packages/mcp/src/tools/`: handler per MCP tool (six handlers:
  submit, get_pending_clarifications, update, revise, get_draft,
  estimate)
- `packages/mcp/src/dangle-reporter.ts`: post-update reference graph
  scan; non-blocking; populates response advisory (id + displayName +
  referencePath) and persists on the draft for review screen
  rendering
- `AppEntry` parser: handles the three-field split (`dependencies`,
  `packageManifests`, `inferenceContext`); union-by-name on
  dependency reconciliation; `dependencies` wins on version conflict;
  raw `packageManifests` and `inferenceContext` content discarded
  after parsing
- Coalescing mechanism: pending follow-up eval scope stored per draft
  (column on `codebase_digest_drafts` or Redis key); new MCP calls
  during an in-flight eval merge into the pending scope; pickup logic
  enqueues coalesced follow-up when in-flight eval completes
- Tool result shaping: `isError` flag set per MCP convention;
  `partialFailures` shape with per-entry errors; dangling-reference
  advisories on `apps.delete` results when applicable; empty calls
  return `isError: true` with ping-redirect content
- Token issuance API in `packages/web/` (Phase 4 frontend has the UI;
  this PR ships the API surface for token create/list/revoke)
- Redis-backed rate limiting (reuses existing Redis instance)
- Response payload guidance text (configurable via admin dashboard);
  per-tool polling cadence guidance (90s after submit; 20s after
  update or revise)
- Deployment: Railway service (matches existing workers + Postgres +
  Redis); CI/CD pipeline extension for the new service
- Local dev: `pnpm --filter mcp dev` added to existing dev story
  alongside Postgres + Redis + Next.js + Workers

**Acceptance:**
- All six MCP tools accept valid input and return Zod-validated
  responses matching the Tool I/O contract in spec.md
- Pre-Zod normalization (`coerce.ts`) and validation policy
  (`didYouMean` scope, strict unknown keys, `partialFailures` path
  notation) match spec.md exactly
- Bearer token auth works end-to-end: generate token → use in MCP
  client config → tool call associates with correct `user_id`
- Rate limiting kicks in at configured threshold; response includes
  appropriate retry guidance
- Dangling references: delete-with-dangling-ref succeeds in one MCP
  call; response advisory lists dangling refs and prompts re-add via
  `apps.create` if unintentional; review screen renders dangles with
  neutral framing
- Coalescing: in-flight Quality Evaluator runs to completion; new MCP
  calls during the run produce a single coalesced follow-up after the
  in-flight job completes (not N follow-ups for N calls)
- Tool error reporting: HTTP 200 for valid JSON-RPC calls; `isError`
  flag matches "zero entries landed" semantics; `partialFailures` shape
  consistent across all per-entry validation failures
- Integration test for full submit → poll → clarification-response flow
  passes with mocked Quality Evaluator
- Idempotency Tier 1: same-key + same-payload returns cached response
  with `dedupedFromRecentSubmit: true` and `dedupePath: "explicit"`;
  same-key + different-payload returns `idempotency_collision`; fresh
  key creates a new draft and bypasses Tier 2
- Idempotency Tier 2: no key + payload hash matching recent same-user
  submit within the implicit dedup window returns cached response with
  `dedupePath: "implicit"`; no key + non-matching payload creates a
  new draft; window expiry causes implicit cache miss; per-tenant
  override of `implicit_dedup_window_minutes` honored
- Explicit beats implicit: fresh `idempotencyKey` + payload matching a
  recent un-keyed submit creates a new draft (Tier 1 wins, Tier 2 not
  consulted)
- Draft expiry: every access bumps `expires_at` within the per-tenant
  sliding TTL; hard cap honored; daily cleanup deletes expired drafts
  and cancels in-flight evaluator and analyzer jobs; concurrent MCP
  calls landing on a deleted draft return `id_not_found`
- Per-tenant config: tenant overrides of
  `codebase_digest_drafts.sliding_ttl_days` and
  `codebase_digest_drafts.max_lifetime_days` are honored at submit
  and every subsequent touch
- Phase 3.4 checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- Pre-PR redteam pass per CLAUDE.md cadence

### 3.5b.4. Pre-digest intent collection + Manifest Gatekeeper extension `[Upcoming]`

Seed the pre-digest intent question catalog (2 entries at MVP). Build
the bimodal collection paths (web UI form, MCP-payload fields).
Extend Manifest Gatekeeper to promote frequently-occurring free-text
answer patterns to curated options over time. See spec.md
"Pre-digest intent collection" subsection for the design.

**Settled design:**
- Pre-digest intent: 2 structured questions (target topology + timeline
  pressure) plus optional free-text constraints. Catalog lives in
  `manifest_intent_gap_questions` (existing table from Phase 3.4.5).
- Target topology options: augmentation, 1:1 replacement, consolidation
  to single target if possible, consolidation to multiple smaller
  targets, recommend the best fit. Free text for "mixed" / "other."
- Timeline options: no fixed deadline, soft target, hard deadline within
  6 months, hard deadline within 6 weeks. Free text for specifics.
- Constraints field: free text classified at submit as binary exclusions
  or optimization targets, identical to text-intake constraints handling.
- Bimodal collection: web UI path (sign in, answer, get assistant snippet
  referencing the session) and MCP payload path (assistant collects in
  chat, ships as optional fields on `submit_codebase_digest`). Both paths
  unify into the same draft state. Server attaches pre-digest intent to
  the draft alongside the digest payload.
- Gatekeeper extension: free-text answers to pre-digest questions
  accumulate; an Intent Gap Pattern Detector specialist (LLM clustering
  over recent free-text) proposes new options; existing Manifest
  Gatekeeper reviews via `manifest_proposals` table with new
  `proposal_type` discriminator. Auto-promote on Gatekeeper accept for
  additions and option-list extensions; human gate on destructive
  changes (remove or rename a question / option).
- Promotion cadence: scheduled weekly BullMQ job (cadence
  admin-configurable), mirroring existing staleness check pattern.
- Promotion threshold: distinct-user count >= 10 over a 90-day rolling
  window (both admin-configurable).

**Outcome-gated execution refinements (rolled in):**
- Quality Evaluator gains a sufficiency-threshold early-exit (default
  3 / 5, admin-configurable) and per-pass filtering of clarifying
  questions to those whose resolution would shift `qualityScore`.
- Pattern & Cluster Analyzer's `clarificationQuestions` scoping
  tightened to divergences whose resolution would shift the
  consolidation recommendation.
- Pattern & Cluster Analyzer output gains a one-sentence `summary`
  field for the row-summary review-screen UX (Phase 4g).

**Tests first:**
- `manifest_intent_gap_questions` seed insertion + select round-trip;
  the two seeded questions land with expected curated options
- Web-UI POST: intent payload validated, draft session created with
  pre-digest intent stored, session id returned
- MCP-payload path: optional `intent` fields on `submit_codebase_digest`
  parsed via Zod, attached to draft state alongside digest
- Idempotency rules apply identically across both paths (Tier 1 and
  Tier 2 hashing covers the intent payload)
- Manifest Gatekeeper extension: free-text clustering proposal includes
  `proposal_type` discriminator; Gatekeeper review accepts / rejects /
  escalates per existing flow; destructive change proposal surfaces in
  admin queue
- Quality Evaluator: sufficiency-threshold early-exit fires when
  `qualityScore >= 3` on default config; filter on iteration removes
  questions whose resolution wouldn't move the score
- Pattern & Cluster Analyzer: `summary` field populated alongside
  `reasoning` for each multi-app category

**Implementation:**
- Migration (no new table; `manifest_intent_gap_questions` is locked
  schema from migration 0010): seed 2 entries with `owner = 'global'`,
  curated options per the spec
- Web UI: simple two-question form + constraints textarea + submit;
  POST creates a draft session and returns id + assistant snippet
- MCP `submit_codebase_digest` Zod schema: add optional `intent` (object:
  `targetTopology`, `timelinePressure`, optional `constraints` array)
  and optional `intentSessionId` (string). Update tool description and
  the I/O contract in spec.md (deferred from PR scope; tracked in
  TODOS.md)
- Intent Gap Pattern Detector specialist in
  `packages/agents/src/intent-gap-pattern-detector/` (3-layer prompt
  cache; LLM-clustering over recent free-text answers; emits
  `manifest_proposals` rows with `proposal_type = 'intent_gap_option'`)
- Manifest Gatekeeper extension: handle `proposal_type = 'intent_gap_option'`
  per existing accept / reject / escalate flow; destructive change
  flag routes to admin queue rather than auto-applying
- BullMQ scheduled job in `packages/workers/src/workers/intent-gap-promotion.ts`:
  weekly trigger, queries recent free-text answers per question
  (`distinct user_id` within rolling window per admin config), invokes
  the specialist, queues Gatekeeper review
- Quality Evaluator refinements (`packages/agents/src/quality-evaluator/`):
  sufficiency-threshold early-exit + filtered iteration in the iteration
  loop logic. Eval cases extended to cover the new exit conditions.
- Pattern & Cluster Analyzer output schema gains `summary`: one-sentence
  rationale generated alongside the existing `reasoning`. Eval cases
  extended.

**Acceptance:**
- Two seeded intent questions render correctly on both web UI and MCP
  payload paths; round-trip submission stores them on the draft
- Idempotency applies identically across both paths (per-tenant config
  honored)
- Pattern Detector + Gatekeeper extension propose option additions
  end-to-end on a synthetic dataset of free-text answers
- Quality Evaluator sufficiency-threshold and filtered iteration pass
  evals; existing eval baselines remain passing or are re-baselined
  with notes
- Pattern & Cluster Analyzer `summary` field populated for multi-app
  categories on canonical eval scenarios
- Phase 3.4 checks pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- Pre-PR redteam pass per CLAUDE.md cadence

**Deferred to follow-up:**
- MCP `submit_codebase_digest` and `revise_codebase_digest` I/O contract
  updates to remove intent-gap operations and add the new pre-digest
  intent fields (current spec section flags this; tracked in TODOS.md)
- Tenant-scoped intent questions (forward-compatible via `owner` column;
  MVP is global-only)
- Review-screen rendering of pre-answered intent (Phase 4g design)

### 3.5b.5. Migration-mapping prompt fragment + Pass 2 per-target invocation `[Upcoming]`

Spec Synthesizer migration-mapping specialist prompt fragment. Pass 1
consolidation surfacing logic (full prose / brief callout / omitted by
assessment magnitude and user intent). Pass 2 runs once per selected
target system. Migration orchestration overview when multiple targets
identified. Detailed design TBD.

### 3.5b.6. CV isPrivate cache bypass + Skeptic consolidation reconciliation + code-aware BYOK gate + tenant communication context resolver `[Upcoming]`

Pipeline behavior changes for code-aware runs: `isPrivate=true` entries
bypass `cv_result_cache`; per-tool failures on internal apps surface
digest source URLs as the manual verification path; Skeptic gets
consolidation-intent reconciliation responsibility; BYOK lock at run
submission for code-aware (separate from free-tier BYOK gate);
Anthropic-key-for-web-search resolution rule when user's primary BYOK is
OpenAI; tenant communication context resolver and admin curation flow.
Detailed design TBD.

### 3.5b.7. Subset re-runs from Pass 1 output `[Upcoming]`

Backend endpoint to spawn a fresh code-aware run from a subset of an
existing parent run's per-app inventory. Two callers: per-grouping button
(system-identified consolidation grouping) and user-chosen multi-select
(MVP scope, easier to remove than add later). Full Pass 1 service fee +
BYOK per fresh run, no discount. Detailed design TBD.

**Open question for design:** A subset of N apps from a parent of M (N < M)
is a different analytical context from a standalone N-app digest. Parent
context shapes cross-target shared-service identification, cluster
analysis, and Skeptic caveats — recommendations may shift meaningfully if
the user actually rescopes to just the subset vs. continuing to plan for
the full M. Decide: (a) do subset re-runs preserve parent context, run
fresh with subset-only context, or offer a toggle; (b) does the system
surface a confidence/risk signal to the user when cross-target
dependencies in the parent were load-bearing for those apps and a
standalone analysis would likely diverge.

---

## Phase 4 — Web frontend `[Upcoming]`

**E2E tests written alongside implementation (Playwright).**

### 4a. Dev auth stub `[Upcoming]`
Middleware that injects a hardcoded session (`user_id = 'dev-user'`,
`tenant_id = 'dev-tenant'`) in local and dev environments. Session object
shape must match exactly what real auth (4f) will return — same fields, same
types — so removing the stub is a clean swap with no downstream changes.

Hard guard: if `NODE_ENV === 'production'` and stub is active, throw on startup.

### 4b. Intake flow `[Upcoming]`
Spec Scaffold (both planning and mid-build prompts), 11-step TurboTax flow,
binary exclusion exhaustion warning, review screen with downstream re-inference.

Intake UI is theme-aware from day one. At layout level, the server resolves the
active theme for the owner and mode, merges token overrides, and injects CSS
custom properties (plus any custom_css) as a server-rendered style block. Cache
key: `theme:resolved:{owner_id}:{mode}:{assignment_version}` — no explicit flush
needed. If the owner has one mode assigned, the UI locks to it with no toggle.

E2E: full intake → submit → pipeline queued.

### 4c. Pass 1 output rendering `[Upcoming]`
Mermaid.js diagram, free tier blurring (CV values blurred, category titles
visible), maturity label click-to-expand, Skeptic debate summary in exec summary.
E2E: free tier run shows blurred CV values; Pass 1 purchase reveals them.

### 4d. Run history `[Upcoming]`
Diff view between runs, dropped-tool strikethrough + info icon, load past
context into new run.

### 4e. Wire frontend to pipeline `[Upcoming]`
BullMQ job submission from Next.js API routes. Server-sent events for progressive
CV disclosure (stream per-tool results as sub-tasks complete; blur applied on
free tier runs in real time). Email notifications on run completion.

### 4f. Real auth `[Upcoming]`
MFA, email verification, per-IP rate limiting on signup. Replaces the dev auth
stub from 4a. Tenant-aware: every session carries tenant_id; every API route
and getConfig call passes it through.

**Run submission gates** on the free-tier policy from spec.md "Free tier rate
limit": 1 system-paid lifetime trial, then all free-tier runs require BYOK,
3-per-day cap, then per-run purchase. Tracked in TODOS.md P1.

E2E: full signup flow, MFA enforcement, email verification gate.

### 4g. Code-aware review screen `[Upcoming]`

Review screen for code-aware digests. Renders the assembled per-app
inventory with quality scores, inline option to delegate
`clarifyingQuestions` to the user's assistant, and edit affordances for
any field. Static read of completed `quality_summary` from the draft
record (no live progress UI; review-screen polling deferred to a future
iteration). Detailed design TBD.

---

## Phase 5 — Admin dashboard `[Upcoming]`

Nine panels. Build pipeline observability first — it's the foundation for
understanding every run, including demo runs.

Before Phase 5 ships, update `packages/agents/src/logger.ts` to write call
data to the `agent_call_log` DB table in addition to CSV. This accumulates
history that the agent performance panel queries. The CSV fallback stays for
sessions without a DB connection.

**Pipeline observability:** per-agent latency breakdown, wave timing, checkpoint
hit/miss rates, token usage and cost per run.

**Manifest health:** entry freshness, missing domainKnowledgePayload, vetted
status, tools flagged for refresh.

**Themes:** manage system presets and the base app default theme. Create, edit,
and publish global theme presets. Supports time-bounded seasonal themes via
valid_from/valid_until. Changes take effect on next page load via the
version-based cache key — no deploy required.

**Config interface:** view and edit system-level config table values (including
ui.string.* global defaults), provider registry (add/edit provider entries,
assign models per agent), and manifest seeding. Tenant config overrides are
visible per-tenant but edited from the tenant dashboard.

**Org list approval workflow:** review org_list_proposals, approve/reject, view
active list.

**Tenant management:** view all tenants, plan tier, usage, billing status, active
holds. Read-only tenant impersonation for support.

**User and billing management:** user search, hold management, refund/credit
tooling.

**Run history:** full cross-tenant run log with filter by tenant, agent, wave,
status.

**Agent performance:** dev-time monitoring for prompt tuning. Queries
`agent_call_log` table. Shows: eval run history (timestamped, pass/fail per
suite, total cost per session); per-agent timing and cost trends over time;
before/after comparison keyed on agent version (`YYYY-MM-DD-{hash8}`) so
prompt changes have a visible cost and latency impact; cache hit rate per
agent. Covers both eval runs and production runs, distinguished by source.

---

## Phase 6 — Tenant dashboard and config interface `[Upcoming]`

Tenant-facing interface for run management and configuration. Admin dashboard
(Phase 5) must be complete before this phase begins.

**Tenant dashboard:**
- Run history scoped to tenant
- Per-run cost and token breakdown
- Active holds and status

**Tenant config interface:**
- Tenant context management: register/update regulatory controls, prohibited
  tools, certifications injected into verifiedContext before Wave 1
- BYOK key management: add/rotate/revoke provider API keys (stored in
  tenant_secrets with field-level encryption); key validated against provider
  API before storage; data residency flag shown for non-US providers
- Communication context template selection: choose the audience/purpose template
  that shapes Technical Writer output
- Branding: preset picker (select from global presets for each mode); token
  overrides for color, font, and radius tokens; logo upload via Vercel Blob;
  string overrides for product name, tagline, button labels, and section headers
  (stored in config table under ui.string.*); draft/publish workflow so changes
  can be previewed before going live
- White-label tier settings: Standard (Agent12 attribution required), Premium
  (attribution optional), Enterprise (custom domain, full attribution removal,
  liability transfer in contract)

---

## TODOS.md P1 items (required before launch)

See [TODOS.md](TODOS.md) for full context.

- Progressive CV disclosure: measure P50 latency before committing to SSE/WebSocket
- Skeptic eval set: build and baseline before any Skeptic prompt change ships
- Run Pack pricing: validate actual per-run cost against $1.80/run target
