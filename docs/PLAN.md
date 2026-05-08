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

## Phase 3.4 — Static analysis hardening `[Upcoming]`

Lands ahead of 3.5a so the new checks gate that phase's acceptance.

### 3.4a. ESLint scaffolding `[Upcoming]`
- `eslint.config.mjs` flat config (typescript-eslint parser, type-aware)
- Rules: `no-floating-promises`, `no-misused-promises`, `no-unused-vars`, `no-unused-expressions`
- `pnpm lint` at root; fix existing violations to land green

### 3.4b. TypeScript strictness `[Upcoming]`
- `noUnusedLocals: true`, `noUnusedParameters: true` in shared tsconfig base
- Catches the assigned-but-never-used class (e.g., `runner.ts:108` from the 3h audit)

### 3.4c. CI workflow `[Upcoming]`
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

## Phase 3.5a — Backend wiring closure pass `[Upcoming]`

Backend completeness pass before UI work begins. Closes wiring gaps identified
in the post-3h completion audit (BYOK never reaches the SDK; Wave 1 outputs
never reach CV/Skeptic/Pass 1; correction exchange exists but is unwired) and
locks schema additions that would be painful to retrofit after frontend ships.

Spec changes for this phase already applied: updated Wave 2.5 (per-tool data
availability, source URLs, correction request payload, resolution outcomes
storage), Wave 3 Skeptic (engagement pattern, qualified recommendation
framing), and Pipeline failure handling (per-entry manifest version reuse).

### 3.5a.1. BYOK runtime wiring `[Upcoming]`

Tenant BYOK keys are stored in `tenant_secrets` with AES-256-GCM encryption
(Phase 3f), but `runner.ts:108` discards the resolved key and `base.ts:74`
reads `process.env` directly. Tenant keys never reach the Anthropic SDK.

**Tests first:**
- `runner.test.ts`: with a tenantId and a tenant_secrets row for that provider,
  the value passed to `callAgent` matches the decrypted secret (mock SDK
  constructor, assert `apiKey` arg).
- `runner.test.ts`: without a tenant_secrets row, system env var is used.
- `runner.test.ts`: tenant_secrets row for a different provider does not
  satisfy the lookup; falls back to system env.
- `key-resolution.test.ts`: reads from `tenant_secrets` (not `config`).
- `base.test.ts`: when given an explicit apiKey, uses it instead of process.env.

**Implementation:**
- Update `getApiKey` to query `tenant_secrets` and decrypt via existing
  `crypto.ts` helpers. Remove the unsafe `config` table fallback for tenant
  keys (per the inline NOTE in `key-resolution.ts:12`).
- Add `apiKey: string` parameter to `callAgent`, `callAnthropicAgent`,
  `callOpenAICompatibleAgent`. Use it instead of `process.env`.
- In `runner.ts`, capture `getApiKey()` return value and thread through
  `callAgent`. Update `RunAgentOpts.callAgent` signature.
- Update every caller in `packages/agents/src/callers/` to thread the apiKey.

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
E2E: full signup flow, MFA enforcement, email verification gate.

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
