# Handoff — Agentic Architecture Recommender

## Current state (2026-05-05)

Phases 0, 1, 2, and 3a-3g complete. Phase 3g.1 (SDK mock tests) is required
before 3h. Phase 3h (CV API integration) is next after that.

**What's built:**
- Monorepo scaffolded: pnpm workspaces, TypeScript, Vitest workspace
- Database schema: 20 tables, 8 migrations applied
  - Original 12 tables from Phases 0-1
  - Migration 0006: `manifest_entries` retired; replaced by three typed tables
  - Migration 0007: `manifest_proposals` added; all uuid PKs switched to UUIDv7
    via `$defaultFn` (app-side); Drizzle meta snapshot collision repaired
  - Migration 0008: `tenants`, `tenant_id` on users, `tenant_secrets`,
    `themes`, `theme_assignments`, `user_theme_preferences`
- Agent layer: 12 Zod output schemas, 12 callers, 3-layer prompt caching,
  multi-provider dispatch. All agent keys camelCase (registry bug fixed).
- Manifest seeder: 15 tools, 6 patterns, 6 failure modes
- Theme seeder: 8 global presets, 2 global assignments, 7 `ui.string.*` defaults
- Wave 2 cooperative exchange: full 2-cycle F&O/T&C with early exit on empty
  `uncoveredRisks`; `checkpointName` field on `RunAgentOpts` for distinct
  checkpoints per cycle
- Maintenance workers (Phase 3e): `maintenance.staleness_check`,
  `maintenance.manifest_gatekeeper`, `maintenance.org_list_gatekeeper` on a
  separate `maintenance` BullMQ queue
- Multi-tenancy schema (Phase 3f): all 6 previously missing tables added;
  AES-256-GCM encryption for BYOK secrets; theme utilities
- Streaming in agent caller (Phase 3g): `callAnthropicAgent` uses
  `messages.stream()` + `inputJson` event accumulation; `callOpenAICompatibleAgent`
  uses `stream: true` + `stream_options`; both parse assembled chunks on completion.
  Resolves TCP timeout at ~6 min confirmed in security eval.
- Agent call logger: `AGENT_CALL_LOG` env var → CSV; DB write deferred to Phase 5
- **Eval baselines (2026-05-01):** Skeptic 6/6, Intake 8/8, Orchestration 3/3,
  Technical Writer 5/5, Security 6/6, Gatekeeper 26/26. Cooperative and CV
  placeholder suites still skipped — wiring needed before next prompt change.

**Test counts:** 61 agents + 30 shared + 38 workers = 129 passing. All test
files use unique identifiers (uuidv7) and scoped afterEach cleanup; safe to run
concurrently.

**Local dev:** Docker needed (Postgres :5432, Redis :6379). `.env.local` must
include `ENCRYPTION_KEY` (32-byte base64, generate with
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).

## What's immediately next

**Phase 3g.1: SDK mock tests for streaming callers.** Required before 3h.
The streaming SDK integration paths (event listeners, async iteration, usage
extraction, error paths) are covered by evals but not by unit tests, so CI has
no regression coverage for them. See PLAN.md Phase 3g.1 for the full test list.
New file: `packages/agents/src/__tests__/streaming-integration.test.ts`.

**Phase 3h: CV API integration and worker decomposition.** Replace the current
single-call CV with API-backed parallel per-tool lookups inside the wave2_5
BullMQ job. GHSA primary for CVEs, NVD fallback, PyPI/npm/GitHub Releases for
versions, LLM web search for pricing and trip hazards. See PLAN.md Phase 3h
and spec.md CV section.

**Phase 4 (frontend) is unblocked.** The `tenant_id` threading from auth is a
Phase 4a concern — dev auth stub must match the shape real auth will return.
All tables that API routes will touch have the correct schema.

## Deployment requirements

- Apply migrations to prod DB: `pnpm db:migrate`
- Run seeder after migrations: `pnpm --filter shared db:seed`
- **Redis AOF persistence must be enabled** in Railway before production traffic
- **`ENCRYPTION_KEY`** (32-byte base64): required before any tenant provides a
  BYOK key. Add to Railway environment before Phase 3h ships.
- **`GITHUB_TOKEN`** and **`NVD_API_KEY`** (both free): required before Phase
  3h production traffic for CV API integration.

## Architecture decisions made this session (2026-05-05)

**Streaming via SDK event accumulation:** `callAnthropicAgent` registers
`stream.on("inputJson")` to collect partial JSON chunks, then awaits
`stream.finalMessage()` for usage stats and completion. `callOpenAICompatibleAgent`
iterates the async iterable with `stream_options: { include_usage: true }` to
capture usage from the trailing chunk. Both paths use exported helpers
`assembleChunks` and `parseAssembledInput` for testable chunk-to-parse logic.

**SDK mock tests deferred to 3g.1:** The helper functions (`assembleChunks`,
`parseAssembledInput`) are 100% unit-tested. The SDK streaming integration paths
require mocking `MessageStream` and `AsyncIterable<ChatCompletionChunk>` — feasible
but non-trivial. Deferred as a required gate before 3h rather than blocking the 3g
PR. Tracked in PLAN.md as Phase 3g.1.

**Parallel test isolation bugs fixed (found during 3g CI investigation):**
Three pre-existing failures surfaced when running the full suite in parallel:
- `schema.test.ts` had global `db.delete(users/runs/runCheckpoints)` in
  `beforeEach`, racing with the workers checkpoint tests. Fixed: uuidv7 +
  scoped `afterEach`.
- `tenancy.test.ts` had `db.delete(config)` globally in `ui.string.*`
  `beforeEach`, deleting config rows being used by `tenant-context.test.ts`
  concurrently. Fixed: unique key suffix per test + scoped `afterEach`.
  Also fixed hardcoded emails (`global@example.com`) that accumulated across
  runs and caused unique constraint violations.
- `technical-writer.eval.ts` used `DEFAULT_PROVIDER_CONFIGS.technical_writer`
  (snake_case), which resolved to `undefined`. Fixed: `technicalWriter`.

## Architecture decisions from previous sessions

**Wave 2 cooperative exchange (2026-05-01):** Full 2-cycle F&O/T&C exchange.
F&O populates `uncoveredRisks`; empty = early exit, non-empty = T&C gets
second pass. `checkpointName` field on `RunAgentOpts` for distinct per-cycle
checkpoints.

**CV data sourcing strategy (2026-05-01):** API-first (GHSA, PyPI, npm,
GitHub), LLM web search for unstructured data. Promise.all() within wave2_5
BullMQ job; cv_result_cache as per-tool checkpoint. See spec.md CV section.

**AgentKey registry bug fixed (2026-05-01):** snake_case/camelCase mismatch
would have thrown at runtime for all multi-word agents. Worker layer had never
been exercised end-to-end.

**Manifest table split (2026-04-30):** `manifest_entries` retired. Three typed
tables: `manifest_tools`, `manifest_patterns`, `manifest_failure_modes`.
Migration 0006.

**Multi-tenancy in scope for initial rollout (2026-04-30):** Schema complete as
of Phase 3f. Branding tiers: Standard (attribution required), Premium
(optional), Enterprise (full white-label). Phase 6 for tenant dashboard.

**UUIDv7 for all primary keys (2026-05-04):** All uuid PKs switched from
DB-side `gen_random_uuid()` to application-side `uuidv7()` via Drizzle
`$defaultFn`. Sequential IDs give better B-tree index performance.

**Field-level encryption for BYOK (2026-05-04):** AES-256-GCM via Node.js
built-in `crypto`. Storage format: `{iv_hex}:{ciphertext_hex}:{auth_tag_hex}`.
Key source: `ENCRYPTION_KEY` env var. `packages/shared/src/crypto.ts`.

**Org List Gatekeeper does not apply changes (2026-05-04):** Findings stored
on the proposal; all org list changes require human approval via admin dashboard
(Phase 5).

**Concurrent-safe test isolation (2026-05-04, enforced 2026-05-05):** All
integration tests use uuidv7 for unique identifiers and `afterEach` targeted
cleanup. Never delete all rows from shared tables in `beforeEach`. This pattern
is non-negotiable — violations cause parallel test failures that are hard to
diagnose.

## Collaboration notes

- No em dashes in any written output. Commas, colons, or parentheses instead.
  Prefer short sentences. Applies to responses AND prompt files.
- Show the diff before writing. User prefers to approve changes before they land.
- Always create a feature branch before writing any code or docs.
- Push back by default when something is off. User explicitly requested this.
- User is growing as an agentic engineer and architect. Honest pushback, not generous credit.
- User has strong UX instincts rooted in React engineering background. Reliable.
- User responds well to "show value early, minimize friction" as a design principle.
- First user: husband (Sr. Data Scientist, Microsoft). His team incorporated
  Pass 1 output into a real project.
- Target users: senior technical builders doing agentic work.
- No marketing language in written output.
- LinkedIn newsletter documenting this build. Drafts at ~/Desktop/blog entries/.
  Claude.ai handles newsletter; Claude Code handles implementation.
- Old codebase exists but is deliberately excluded.
- Tests first at every phase where possible.
- Integration tests must use unique identifiers (uuidv7) and scoped cleanup
  — never delete all rows from shared tables.
