# Handoff — Agentic Architecture Recommender

## Current state (2026-05-08)

Phases 0-3h **plus 3.4, 3.4.5, 3.4.6, 3.5a.1, 3.5a.1.b implementation
complete.** Schema lock for everything reachable pre-UI is now done. The
remaining pre-UI work is the four backend wiring sub-phases of 3.5a (CV
upstream, per-tool data availability, per-entry manifest versioning,
correction exchange) plus a handful of P1 behavior items tracked in
TODOS.md.

**Recent merges (2026-05-07 / 2026-05-08):**
- **PR #56**: Phase 3.4 — static analysis hardening (ESLint flat config,
  tsconfig `noUnusedLocals` / `noUnusedParameters`, GitHub Actions CI with
  Postgres + Redis services). Pre-PR redteam pass cadence documented in
  CLAUDE.md and saved verbatim at `docs/redteam-prompt.txt`.
- **PR #57**: Phase 3.5a.1 — BYOK runtime wiring (tenant scope). Closes the
  audit-class bug where `runner.ts:108` discarded the resolved key and
  `base.ts:74` read `process.env` directly. `getApiKey` now reads
  `tenant_secrets`; `apiKey` threaded through `callAgent` and 12 wrappers.
- **PR #58**: Eval token streamlining sidequest. Intake 9 → 3 calls,
  technical-writer 5 → 1 call (~40k tokens saved per full eval run).
- **PR #59**: Phase 3.5a.1.b — user-scope BYOK + `user_api_tokens`
  schema lock. Resolution chain now user → tenant → system env.
- **PR #60**: Phase 3.4.5 — schema lock for four spec'd tables
  (`codebase_digest_drafts`, `tenant_modification_requests`,
  `tenant_communication_contexts`, `manifest_intent_gap_questions`).
- **PR #61**: Phase 3.4.6 — multi-tenancy data isolation schema lock.
  `tenants.auth_provider` + `tenants.auth_provider_org_id`,
  `users.auth_provider` + `users.auth_provider_user_id`, `runs.tenant_id`,
  composite uniques scoped to `(provider, id)`. Validated against Clerk's
  and WorkOS's actual data models before locking.

**Spec PRs landed in this session block (2026-05-06 to 2026-05-07):**
- PR #52: Phase 3.5a backend wiring closure pass (specced)
- PR #53: Code-aware intake architecture; multi-provider BYOK at user scope;
  data model additions
- PR #54: Structured intent gaps + product-level consolidation analysis
- PR #55: Code-aware pricing (Pass 1 $49, Pass 2 $199 per spec+plan)

**Queued PRs (not yet started):**
- **Multi-tenancy data isolation behavior PR**: schema is locked (#61); the
  behavior pieces are tracked in TODOS.md as P1 (cross-account access
  prohibition, account-to-tenant binding immutability, auth provider
  routing dispatcher) and P3 (offboarding, IP allowlisting, shareable
  link tenant boundaries, webhook idempotency).
- **Free-tier-requires-BYOK-after-first-run policy**: spec PR
  user-flagged 2026-05-08, not yet drafted.

**What's built (cumulative):**
- Monorepo scaffolded: pnpm workspaces, TypeScript, Vitest workspace
- Database schema: 26 tables, 13 migrations applied (0000-0012)
  - Original 12 tables (Phases 0-1)
  - Migration 0006: typed manifest tables (`manifest_tools`,
    `manifest_patterns`, `manifest_failure_modes`)
  - Migration 0007: `manifest_proposals`; UUIDv7 PKs across all tables
  - Migration 0008: `tenants`, `users.tenant_id`, `tenant_secrets`,
    `themes`, `theme_assignments`, `user_theme_preferences`
  - Migration 0009: `user_secrets`, `user_api_tokens` (Phase 3.5a.1.b)
  - Migration 0010: `codebase_digest_drafts`,
    `tenant_modification_requests`, `tenant_communication_contexts`,
    `manifest_intent_gap_questions` (Phase 3.4.5)
  - Migration 0011: `tenants.auth_provider`,
    `tenants.auth_provider_org_id`, `users.auth_provider`,
    `users.auth_provider_user_id` (initial), `runs.tenant_id` (Phase
    3.4.6 first pass)
  - Migration 0012: rename `users.auth_provider_id` →
    `users.auth_provider_user_id`; composite unique
    `(auth_provider, auth_provider_user_id)` on users; composite unique
    `(auth_provider, auth_provider_org_id)` on tenants (Phase 3.4.6
    refinement based on Clerk + WorkOS research)
- Agent layer: 12 Zod output schemas, 12 callers, 3-layer prompt caching,
  multi-provider dispatch, `apiKey` threaded through every caller (3.5a.1)
- Manifest seeder: 15 tools, 6 patterns, 6 failure modes
- Theme seeder: 8 global presets, 2 global assignments
- Wave 2 cooperative exchange: full 2-cycle F&O/T&C
- Maintenance workers (Phase 3e): staleness check, manifest gatekeeper,
  org list gatekeeper. Both gatekeeper workers now resolve `getApiKey`
  with `(undefined, undefined)` for system-scoped jobs (3.5a.1).
- Multi-tenancy schema (Phase 3f, expanded by 3.5a.1.b + 3.4.5 + 3.4.6)
- Streaming in agent caller (Phase 3g + 3g.1)
- CV API integration (Phase 3h): GHSA, NVD, PyPI, npm; web search;
  cross-tool check; correction exchange (exported but unwired — wiring
  is Phase 3.5a.5)
- Static analysis hardening (Phase 3.4): ESLint, tsconfig strict, CI
- BYOK runtime wiring (Phase 3.5a.1 + 3.5a.1.b): user → tenant → env

**Eval baselines:**
- 2026-05-01: Skeptic 6/6, Intake 8/8, Orchestration 3/3, Technical
  Writer 5/5, Security 6/6, Gatekeeper 26/26
- 2026-05-07 (re-baselined post-consolidation): Intake 8/8 in 58s with
  3 API calls (was 9), Technical Writer 5/5 in 31s with 1 API call
  (was 3). Cooperative + CV placeholder suites still skipped.

**Test counts:** 80 shared + 78 agents + 100 workers = **258 non-eval
tests passing**. All test files use uuidv7 + scoped `afterEach` cleanup.

**Local dev:** Docker required (Postgres :5432, Redis :6379). `.env.local`
must include `ENCRYPTION_KEY` (32-byte base64) and `ANTHROPIC_API_KEY`.

## What's immediately next

**Phase 3.5a behavior pieces** (in PLAN.md priority order):
- **3.5a.2 — CV upstream wiring**: `queues.ts:46/49/56` passes `{}` instead
  of `wave1Results` to wave2_5/wave3/pass1. CV runs with zero tools to
  validate. Audit-class bug. No schema change. Tighten `unknown` typing
  to surface this class at compile time.
- **3.5a.3 — Per-tool data availability + source URLs**: migration adds
  `cv_result_cache.source_urls` and `cv_result_cache.data_availability`
  columns; behavior fix in npm/pypi catch handlers.
- **3.5a.4 — Per-entry manifest versioning Tier 2**: migration adds
  `version` column to manifest tables; agent schema adds
  `referencedManifestEntries`; checkpoint reuse logic switches from
  global manifest hash to per-entry hashes; eval re-baseline.
- **3.5a.5 — Correction exchange wiring**: six per-agent correction-
  response callers; Skeptic CV re-verification capability; two new eval
  scenarios.

**P1 behavior items in TODOS.md** (referenced from 3.4.6):
- Cross-account access prohibition (read-time enforcement on `runs.tenant_id`)
- Account-to-tenant binding immutability
- Auth provider routing dispatcher (Phase 4f addendum)

**Phase 4 (frontend) gated** on 3.5a behavior closure. Per the substantial
spec growth, frontend scope now includes: code-aware intake review screen,
MCP server endpoint, Pass 2 target-system selection UI, modification
request submission UI, multi-provider BYOK key management UI, etc.

## Spec doc state (2026-05-08)

`docs/spec.md` is at ~1,400 lines / ~24k words. No drift checks done in
this session block. Worth a re-read pass before any major spec change to
catch references to retired patterns (e.g., sub-component-level examples
where product-level was standardized in PR #54).

## Deployment requirements

- Apply migrations: `pnpm db:migrate` (now goes through 0012)
- Run seeder: `pnpm --filter shared db:seed`
- **Redis AOF persistence** must be enabled in Railway before production
- **`ENCRYPTION_KEY`** (32-byte base64): required before any tenant
  provides a BYOK key
- **`GITHUB_TOKEN`** and **`NVD_API_KEY`** (both free): required before
  3h production traffic for CV API integration

## Architecture decisions made this session block (2026-05-07 / 2026-05-08)

**Static analysis scope (2026-05-07):** Adopted ESLint flat config with
`typescript-eslint`, four explicit rules (`no-floating-promises`,
`no-misused-promises`, `no-unused-vars`, `no-unused-expressions`). Knip
was specced and dropped: 26 of 29 findings were Phase 4 entry-point
scaffolding (false positives), and the audit-class bug it was sold to
catch (`conflict-resolution.ts` tested-but-unwired) actually slips past
knip because tests count as consumers. Tracked as a TODOS P3 item for
post-Phase-4 revisit.

**Pre-PR redteam pass scope (2026-05-07):** Anti-doc framing — read only
production code, find production call sites, target consumer-exists-but-
broken (not consumer-doesn't-exist-yet). Generic "tested-but-unwired"
framing was rejected because Phase 4 scaffolding would generate
false-positive noise. The prompt is saved verbatim at
`docs/redteam-prompt.txt`.

**BYOK signature shape (2026-05-07):** `getApiKey(db, provider, userId,
tenantId)` returns the resolved key; runner captures `run.userId`
(already on the run row, no `RunAgentOpts` change). Maintenance workers
pass `undefined, undefined` (system-scoped). Resolution: user → tenant
→ env.

**Eval consolidation pattern (2026-05-07):** Each scenario gets ONE
`beforeAll` call shared across all `it` blocks. Multiple `it` blocks
making their own API calls is the inefficient anti-pattern. ~40k tokens
saved per full eval run from intake + technical-writer alone.

**Auth abstraction validated against providers (2026-05-08):** Both Clerk
and WorkOS treat their API as source of truth for profile / membership /
role data. We mirror only join keys: `(auth_provider, auth_provider_user_id)`
on users, `(auth_provider, auth_provider_org_id)` on tenants. Composite
unique with PostgreSQL NULL semantics so pre-signup rows coexist. We
explicitly do NOT mirror firstName/lastName/profilePicture/lastSignInAt,
organization metadata, session tokens, multi-org membership, or roles.

**Honest "out of scope" rule (2026-05-08):** When listing items as
out-of-scope on a PR description or PLAN entry, every item must have a
tracking destination (existing PLAN phase, TODOS row, or explicit
"unaccounted, will draft spec PR"). Ad hoc "out of scope" lists without
homes are exactly the deferral that bites later. Caught when reviewing
the 3.4.6 PR — multiple items had no home, fixed by adding three P1 and
four P3 entries to TODOS.md.

**Per-table test naming pattern (2026-05-07):** Schema test files map
1:1 to schema export names so future readers find them by direct match
(`manifest-intent-gap-questions.test.ts` for `manifestIntentGapQuestions`,
etc.). Process-temporal names like `schema-lock.test.ts` were rejected.

## Architecture decisions from previous sessions

(Earlier decisions retained; see git history of this file for the full
list. Key ones: streaming via SDK event accumulation; UUIDv7 PKs;
field-level encryption for BYOK; concurrent-safe test isolation
non-negotiable; org list gatekeeper does not auto-apply changes.)

## Collaboration notes

- No em dashes in any written output. Commas, colons, or parentheses.
- Show the diff before writing. User approves changes before they land.
- Always create a feature branch before writing code or docs.
- Push back by default when something is off. User explicitly asked for this.
- Honest pushback over generous credit. User is growing as an architect.
- **Ask before running evals.** Token cost is real; default is filter
  with `--filter '!@agent12/evals'`.
- **Flag tests-first deviations explicitly.** When schema must land
  before tests can compile, name the chicken-and-egg up front instead of
  silently jumping to schema-first.
- Tests first at every phase where possible.
- Integration tests use uuidv7 + scoped cleanup. Never global table deletes.
- Senior technical builders are the target audience. No marketing language.
- LinkedIn newsletter documenting the build. Drafts at
  `~/Desktop/blog entries/`. Claude.ai handles the newsletter; Claude
  Code handles implementation.
