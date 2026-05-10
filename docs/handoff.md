# Handoff — Agentic Architecture Recommender

## Current state (2026-05-10)

Phases 0-3h **plus 3.4, 3.4.5, 3.4.6, 3.5a.1, 3.5a.1.b implementation
complete.** Code-aware backend (Phase 3.5b) **design landed for 3.5b.1
(Quality Evaluator) and 3.5b.2 (Pattern & Cluster Analyzer); partial
design landed for 3.5b.3 (MCP server hosting, authentication mechanics,
response-driven iteration pattern)**. 3.5b.4 through 3.5b.7 are
placeholder bullets pending their own design PRs; 3.5b.3 itself has
remaining open design questions (tenant context propagation shape,
idempotency for `submit_codebase_digest`, 30-day expiry job mechanics,
tool input/output Zod schemas, error response patterns). Remaining
pre-UI work is the four backend wiring sub-phases of 3.5a (CV upstream,
per-tool data availability, per-entry manifest versioning, correction
exchange), plus completion of 3.5b design and implementation of the
3.5b backend agents and MCP server, plus a handful of P1 behavior items
tracked in TODOS.md.

**Recent merges (2026-05-07 to 2026-05-10):**
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
- **PR #62**: Docs refresh post schema-lock work block (handoff, PLAN, README).
- **PR #63**: Free-tier BYOK gate spec (1 system-paid lifetime trial then
  BYOK-required, 3-per-day cap, then per-run purchase) plus
  OpenAI-compatible provider registry expansion.
- **PR #64**: Phase 3.5b.1 — Quality Evaluator architecture in spec; new
  Phase 3.5b in plan with full 3.5b.1 detail and placeholder bullets
  3.5b.2 through 3.5b.7. Two-stage architecture: server-side
  normalization (mechanical extraction, rule-based inference, LLM
  fallback for inferential essentials) + background LLM evaluator with
  3-layer prompt cache and self-iteration capped at 3 passes.
- **PR #65**: Code-aware intake spec/plan follow-ups: MCP integration
  model subsection, MCP tool surface update with `estimate_digest_cost`,
  Cost transparency subsection, Per-dependency freshness badges
  subsection, five settled-decision row changes (one update + four new),
  PLAN parallel updates including 4g code-aware review screen
  placeholder.
- **PR #66**: Phase 3.5b.2 — Pattern & Cluster Analyzer architecture in
  spec + full 3.5b.2 detail in plan. Sequential after Quality Evaluator,
  per-category LLM calls in parallel, single-tool short-circuit,
  dedicated `cluster_analysis` jsonb column on `codebase_digest_drafts`,
  affected-only re-evaluation on update. Includes prior handoff/README
  refresh.
- **PR #67 (in flight, this PR)**: Phase 3.5b.3 partial design — MCP
  server hosting (dedicated `packages/mcp/` package, Railway deployment,
  HTTP+SSE transport, why-not-Vercel), authentication mechanics
  (`agent12_pat_` token format, SHA-256 hashing, soft-delete revocation,
  60 RPM rate limit default, debounced `last_used_at`), response-driven
  iteration pattern (Pattern 1+3, split polling cadence: 90s after
  `submit_codebase_digest` / 20s after `update_codebase_digest`).
  3.5b.3 has remaining open design questions; subsequent design PRs
  cover them. Includes this handoff refresh.

**Spec PRs landed in earlier session blocks:**
- PR #52: Phase 3.5a backend wiring closure pass (specced)
- PR #53: Code-aware intake architecture; multi-provider BYOK at user scope;
  data model additions
- PR #54: Structured intent gaps + product-level consolidation analysis
- PR #55: Code-aware pricing (Pass 1 $49, Pass 2 $199 per spec+plan)

**Queued PRs (not yet started):**
- **3.5b.3 remaining design PR(s)**: tenant context propagation shape;
  idempotency for `submit_codebase_digest`; 30-day expiry job mechanics
  (BullMQ scheduled job in workers package); tool input/output Zod
  schemas; error response patterns.
- **3.5b.4 onward design PRs**: 3.5b.4 (manifest_intent_gap_questions
  seeder + Manifest Gatekeeper extension), 3.5b.5 (migration-mapping
  prompt fragment + Pass 2 per-target invocation), 3.5b.6 (CV
  isPrivate cache bypass + Skeptic consolidation reconciliation +
  code-aware BYOK gate + tenant communication context resolver),
  3.5b.7 (subset re-runs from Pass 1 output) — all currently
  placeholder bullets in PLAN.md.
- **Implementation PRs for 3.5a.2-5**: backend wiring closure; tracked
  in PLAN.md.
- **Implementation PRs for 3.5b.1, 3.5b.2, and 3.5b.3 (after 3.5b.3
  design completes)**: Quality Evaluator and Pattern & Cluster Analyzer
  agent code; MCP server in `packages/mcp/` with Railway deployment;
  3.5b.1 and 3.5b.2 design ready (PRs #64 and #66).
- **Multi-tenancy data isolation behavior PR**: schema is locked (#61);
  the behavior pieces are tracked in TODOS.md as P1 (cross-account
  access prohibition, account-to-tenant binding immutability, auth
  provider routing dispatcher) and P3 (offboarding, IP allowlisting,
  shareable link tenant boundaries, webhook idempotency).
- **Terminology cleanup PR**: rename digest "tool" to "app" pending
  nomenclature decision; user thinking through it.

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

**Code-aware backend (Phase 3.5b) — design path:**
- **3.5b.3 remaining decisions** (5 open after PR #67):
  - Tenant context propagation shape (full prompt fragment, structured
    constraints, references)
  - Idempotency for `submit_codebase_digest` (key shape, retry semantics)
  - 30-day expiry job mechanics (BullMQ scheduled job in workers
    package; cadence, cleanup logic, edge cases for submitted vs
    unsubmitted drafts)
  - Tool input/output Zod schemas (exact shape per tool)
  - Error response patterns (how errors surface to assistant)
- 3.5b.4 through 3.5b.7 design (placeholder bullets in PLAN; will land
  in their own focused PRs after 3.5b.3 design completes)

**Code-aware backend (Phase 3.5b) — implementation path** (gated on
design completion):
- 3.5b.1 implementation (Quality Evaluator agent in
  `packages/agents/src/quality-evaluator/`, BullMQ worker, 3-layer cache,
  self-iteration loop, server-side inference helpers, raw manifest
  parsing)
- 3.5b.2 implementation (Pattern & Cluster Analyzer agent + worker,
  per-category dispatch, single-tool short-circuit, `cluster_analysis`
  column migration, affected-only re-evaluation diff logic)
- 3.5b.3 implementation (MCP server in `packages/mcp/`, Railway
  deployment, HTTP+SSE transport, Bearer token auth)

**Phase 3.5a behavior pieces** (in PLAN.md priority order):
- **3.5a.2 — CV upstream wiring**: `queues.ts:46/49/56` passes `{}`
  instead of `wave1Results` to wave2_5/wave3/pass1. Audit-class bug. No
  schema change.
- **3.5a.3 — Per-tool data availability + source URLs**: migration adds
  `cv_result_cache.source_urls` and `cv_result_cache.data_availability`
  columns; behavior fix in npm/pypi catch handlers.
- **3.5a.4 — Per-entry manifest versioning Tier 2**: migration adds
  `version` column to manifest tables; agent schema adds
  `referencedManifestEntries`; checkpoint reuse logic switches from
  global manifest hash to per-entry hashes; eval re-baseline.
- **3.5a.5 — Correction exchange wiring**: six per-agent
  correction-response callers; Skeptic CV re-verification capability;
  two new eval scenarios.

**P1 behavior items in TODOS.md** (referenced from 3.4.6):
- Cross-account access prohibition (read-time enforcement on `runs.tenant_id`)
- Account-to-tenant binding immutability
- Auth provider routing dispatcher (Phase 4f addendum)

**Phase 4 (frontend) gated** on 3.5a behavior closure and 3.5b
implementation. Frontend scope now includes: code-aware intake review
screen (4g placeholder added in plan), MCP server endpoint, Pass 2
target-system selection UI, modification request submission UI,
multi-provider BYOK key management UI, etc.

## Spec doc state (2026-05-10)

`docs/spec.md` is at ~1,520 lines / ~26k words. This session block added
significant new content for code-aware intake: MCP integration model
subsection, expanded Quality evaluation and clarification loop, Pattern
& Cluster Analyzer architecture details with structured output table,
Cost transparency subsection, Per-dependency freshness badges
subsection, plus five settled-decision row updates/additions covering
the new architecture. Worth a re-read pass before any major spec change
to catch references to retired patterns (e.g., the heuristic
word-count layer that no longer exists; sub-component-level examples
where product-level was standardized in PR #54).

## Deployment requirements

- Apply migrations: `pnpm db:migrate` (now goes through 0012)
- Run seeder: `pnpm --filter shared db:seed`
- **Redis AOF persistence** must be enabled in Railway before production
- **`ENCRYPTION_KEY`** (32-byte base64): required before any tenant
  provides a BYOK key
- **`GITHUB_TOKEN`** and **`NVD_API_KEY`** (both free): required before
  3h production traffic for CV API integration

## Architecture decisions made this session block (2026-05-07 to 2026-05-10)

**MCP server hosting (2026-05-10):** Dedicated service in
`packages/mcp/` deployed to Railway, NOT Vercel. Recommendation
flipped from "start in Next.js, extract later" to "dedicated from day
one" once the user clarified that the first user will use MCP. With no
pre-launch window where extraction is customer-free, the deferral cost
calculation reverses: 5-10 days of extraction work plus customer URL
migration outweighs 2-3 days of upfront infrastructure setup. Vercel
ruled out because serverless function model fits poorly with HTTP+SSE
patterns and longer-lived response shapes.

**MCP authentication mechanics (2026-05-10):** Bearer token in HTTP
header (`Authorization: Bearer agent12_pat_<32 bytes base64url>`).
SHA-256 hash storage in `user_api_tokens.token_hash`; raw tokens never
persisted. Soft-delete revocation via `revoked_at`. Per-token rate
limit defaults to 60 RPM (configurable, Redis-backed). Debounced
`last_used_at` updates (once per ~60s per token). On miss: 401 with
generic error. Token format follows GitHub PAT pattern; SHA-256
sufficient for high-entropy tokens (slow-hash overkill applies to
low-entropy passwords).

**MCP response-driven iteration pattern (2026-05-10):** Tool responses
include forward-looking guidance directing the assistant's next steps
(Pattern 1). MCP server cannot push to clients (standard MCP
semantics), so iteration relies on capable agentic assistants reading
response payloads and continuing autonomously. Polling cadence
configurable via admin dashboard, split by context: 90s default after
`submit_codebase_digest` (long initial wait of 10-40 min); 20s default
after `update_codebase_digest` (short re-eval wait of 30s-2min).
Long-polling pattern explicitly rejected (40-min waits exceed Vercel
function timeouts and HTTP connection lifetimes; would require chained
calls anyway). Pattern 3 (user wrap-up authorization in initial prompt)
complements Pattern 1 as a docs/education concern.

**MCP-as-only-channel for code-aware (2026-05-10):** Considered five
alternatives (IDE assistant, our CLI, self-hosted analyzer, repo
connector, customer uploads). Settled on IDE-assistant model for MVP
(lowest build cost; meets enterprise security bar where assistant runs
in customer environment). Self-hosted analyzer (Docker/Helm) flagged
as Enterprise-tier follow-on for customers who need full data
sovereignty and CI/CD integration. Repo connector (we pull source) and
customer uploads (we receive source) explicitly rejected on enterprise
security grounds; they don't move the needle for buyers who reject
IDE-assistant on security.

**Cheap-now-expensive-later, applied to step-function costs (2026-05-10):**
The principle assumes monotonic cost growth over time. For decisions
where cost is step-functioned (cheap before customer X, expensive
after), the principle's relevance depends on the timeline to customer
X. If pre-launch window is wide, deferral wins. If first user arrives
with launch (as MCP customers will here), preemptive design wins.
Caught when re-analyzing the MCP server hosting decision; useful
calibration for similar future calls.



**Cheap-now-expensive-later principle (2026-05-09):** Repeatedly applied
this session. Examples: include structured `blockers` /
`capabilityVariance` / `supportingEvidence` in Pattern & Cluster
Analyzer output now (small cost, harder to retrofit later when
downstream agents need them); ship user-chosen multi-select for subset
re-runs in MVP (cost is mostly UX work, removable later); add
`estimate_digest_cost` MCP tool now even though MVP UI uses static rate
table (assistants get the option); dedicated `cluster_analysis` column
on `codebase_digest_drafts` rather than nesting in `quality_summary`
(cheap migration now, schema rework later). Tends to win when the
marginal cost of inclusion is genuinely small.

**Facts → agent, intent → user principle (2026-05-09):** The user's AI
assistant has full code access; we do not. So code-derivable facts go
to the agent (via the rework loop or server-side inference);
intent/judgment questions go to the user (via existing intent gap
mechanism). Caused multiple corrections this session: my initial design
asked the user about things the agent should have answered (max-retries
escalation to user; structured field gates); each was corrected back to
agent-handled. The principle generalizes: any time we are tempted to
ask the user something, check whether the assistant could have answered
it from code first.

**MCP integration model / control boundary (2026-05-09):** The user's
AI assistant is their existing IDE tool (Copilot, Claude Code, Cursor,
Continue.dev, etc.). We control MCP tool definitions and response
payloads, not assistant behavior or model. Standard MCP semantics:
server responds when called, cannot push to clients. Architecting
around this boundary keeps the design honest. Quality of digest is
bounded by quality of assistant. Captured as a settled-decision row in
spec.md and explained in the Code-aware intake subsection.

**Async + email digest evaluation completion (2026-05-09):** MCP
`submit_codebase_digest` returns within 1-2 seconds with draft URL plus
status. Quality Evaluator and Pattern & Cluster Analyzer run as
background BullMQ worker jobs sequentially. Single email when both
complete (not separate emails). Real per-call latency on existing
pipeline agents averages 30-160s; large digests put evaluation above 5
minutes wall clock. Synchronous MCP response would block the user's
IDE for too long.

**Quality Evaluator architecture (2026-05-09):** Two-stage. Server-side
normalization runs synchronously: mechanical extraction from raw
package manifests (dependencies, language, framework), rule-based
inference for pattern fields (`observedPatterns`, partial
`externalIntegrations`), LLM-inference fallback for inferential
essentials (`displayName`, `primaryPurpose`, `productCategory`) when
the agent did not provide them. Background LLM evaluator with 3-layer
prompt cache (system + rubric, full per-app inventory + tenant context,
per-app entry with dependency enrichment chain). Self-iterates up to
3 passes (configurable) on low-scored entries by re-prompting itself
with clarifying questions over existing data. Replaces an earlier
heuristic + LLM-evaluator design with word-count and generic-vocabulary
penalties (rejected as misleading specificity signal).

**Pattern & Cluster Analyzer architecture (2026-05-09):** Sequential
after Quality Evaluator (so it sees synthesized fields). Per-category
LLM calls in parallel with configurable concurrency cap. Single-tool
categories skip the LLM call; server emits
`consolidationOpportunity: 'none'` deterministically. Output includes
structured `clusters`, `blockers` (typed array with type, description,
affectedToolIds), `capabilityVariance`, `supportingEvidence`, plus
`clarificationQuestions` and the `consolidationStrategyQuestion` per
multi-tool category. Stored in dedicated `cluster_analysis` jsonb
column on `codebase_digest_drafts` (migration lands with 3.5b.2
implementation PR). Re-evaluation on update only touches affected
categories.

**Cost transparency static rate table approach (2026-05-09):** Public
pre-auth reference page with typical per-app token usage ranges and
per-provider rates (effective-as-of date stamp, admin-curated). Plus
`estimate_digest_cost` MCP tool for assistants that want richer
pre-submit estimates. No cost confirmation gate at submit. MVP UI uses
the static reference; the endpoint is built but UI dynamic estimates
deferred.

**Per-dependency freshness badges, neutral framing (2026-05-09):** Each
dependency on the review screen carries a date-only badge: "Evaluated
[date] ↻", "Manifest entry, version data at pipeline run", "Not yet
evaluated, research at pipeline run", "Internal tool". No
value-judgment language about staleness. Click to refresh fires CV API
+ web-search calls for that single dep, charges BYOK, updates
timestamp. Refresh does not re-trigger Quality Evaluator (description
quality is independent of CV data freshness).

**Terminology friction noted (2026-05-09):** "tool" is overloaded:
digest tool (user's app in code-aware intake) vs manifest tool
(third-party service we recommend) vs Wave 1 T&I "tool" (architectural
concept and recommended manifest entry) vs MCP "tool" (SDK function
sense). Causing real cognitive friction during design discussions.
User leaning toward renaming digest "tool" → "app" with a future PR;
not landed yet pending nomenclature decision. Tracked as queued PR.

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
