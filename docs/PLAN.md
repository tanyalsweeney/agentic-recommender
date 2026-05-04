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

### 3g. Streaming in agent caller `[Upcoming]`
Without streaming, complex user systems trigger responses long enough to drop
the underlying TCP connection before the full response arrives (~6 min
confirmed via security eval). Must be resolved before any production traffic.

Switch `callAnthropicAgent` in `base.ts` from `client.messages.create()` to
`client.messages.stream()`. Accumulate `input_json_delta` chunks on
`content_block_start` events; parse assembled JSON on `content_block_stop`.
OpenAI-compatible path: same pattern via `stream: true`.

This also unblocks CV progressive disclosure in Phase 4e — the same streaming
infrastructure will emit per-tool results as sub-tasks complete.

Unit tests: partial chunk accumulation produces valid JSON; mid-stream error
surfaces as a thrown exception; complete stream matches non-streaming output.

### 3h. CV API integration layer and worker decomposition `[Upcoming]`

Two related pieces of work that ship together. The current CV implementation is a single agent call that relies on the model's training knowledge for version and CVE data. This phase replaces it with a decomposed, API-backed implementation.

**API integration layer** (`packages/workers/src/cv-apis/`):
- GHSA client: query GitHub Advisory Database by ecosystem and package name
- PyPI client: fetch current version, release history, license from PyPI JSON API
- npm client: fetch current version, release history, license from npm Registry API
- GitHub Releases client: fetch latest release and release history for GitHub-hosted tools
- NVD client: fetch CVEs by CPE or keyword; used as fallback when GHSA has no entry
- Credential requirements: `GITHUB_TOKEN` (free) and `NVD_API_KEY` (free) — both required before production traffic; add to `.env.example` and deployment docs

**CV worker decomposition** (`packages/workers/src/workers/wave2_5.ts`):

Replace the single `runAgent` call with the full decomposed structure:
- Run N per-tool lookups in parallel via Promise.all() within the wave2_5 job; each lookup: (1) checks cv_result_cache and exits early if a fresh result exists, (2) runs API calls + one LLM web search for all unstructured data points (pricing, regional availability, trip hazards, integration gotchas), (3) writes result to cv_result_cache; cv_result_cache is the per-tool checkpoint — failed mid-run retries read cached results for completed tools
- Cross-agent conflict checks: sequential, after all per-tool sub-tasks complete; when a version conflict or constraint violation is found, CV does additional API or web lookup to identify a mutually compatible version to recommend back to the relevant Wave 1 and Wave 2 agents as part of the rejection message — surfacing a resolution path, not just a flag
- Cross-tool compatibility checks: sequential, after conflict checks, scoped to surviving tool set; same resolution-seeking behavior for version conflicts between tool pairs
- Cost aggregation: runs after compatibility checks, consumes Wave 1 and Wave 2 cost signals

Failure escalation applied per sub-task: CVE and compatibility failures fail the run; pricing, EOL, and license failures ship flagged with the source reference.

Integration tests: GHSA returns known advisory for a real package; NVD fallback triggers when GHSA entry is absent; conflict check surfaces a compatible alternative version, not just a rejection; per-tool sub-task failure with flaggable data point ships flagged rather than failing the run; per-tool checkpoint survives failure of a sibling sub-task.

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
