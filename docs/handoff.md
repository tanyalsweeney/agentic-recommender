# Handoff — Agentic Architecture Recommender

## Current state (2026-05-15)

Phases 0-3h **plus 3.4, 3.4.5, 3.4.6, 3.5a.1, 3.5a.1.b implementation
complete.** Code-aware backend (Phase 3.5b) **design complete for
3.5b.1 (Quality Evaluator), 3.5b.2 (Pattern & Cluster Analyzer),
3.5b.3 (MCP server: six-tool surface, full Tool I/O Zod contract with
validation policy and pre-Zod normalization, two-tier idempotency
dedup, sliding-TTL draft expiry with hard cap, authentication
mechanics, response-driven iteration), and 3.5b.4 (pre-digest intent
collection plus Manifest Gatekeeper extension).** New Phase 3.5c
(agent slot + variant abstraction) added as code-aware fork-readiness
infrastructure. 3.5b.5 through 3.5b.7 are placeholder bullets pending
their own design PRs. Remaining pre-UI work: the four backend wiring
sub-phases of 3.5a (CV upstream, per-tool data availability,
per-entry manifest versioning, correction exchange); 3.5b.5-7 design;
implementation of the 3.5b backend agents and MCP server;
implementation of 3.5c; plus a handful of P1 behavior items tracked
in TODOS.md.

**Recent merges (2026-05-07 to 2026-05-14):**
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
  per-category LLM calls in parallel, single-app short-circuit,
  dedicated `cluster_analysis` jsonb column on `codebase_digest_drafts`,
  affected-only re-evaluation on update. Includes prior handoff/README
  refresh.
- **PR #67**: Phase 3.5b.3 partial design — MCP
  server hosting (dedicated `packages/mcp/` package, Railway deployment,
  HTTP+SSE transport, why-not-Vercel), authentication mechanics
  (`agent12_pat_` token format, SHA-256 hashing, soft-delete revocation,
  60 RPM rate limit default, debounced `last_used_at`), response-driven
  iteration pattern (Pattern 1+3, split polling cadence: 90s after
  `submit_codebase_digest` / 20s after `update_codebase_digest`).
  3.5b.3 has remaining open design questions; subsequent design PRs
  cover them.
- **PR #68**: Terminology disambiguation — internal
  rename of digest "tool" → "app" across spec.md, PLAN.md, and
  handoff.md. Adds the user-facing word-selection rule: agents render
  via `displayName` / `productCategory.displayName`; when an umbrella is
  needed, agents pick the most semantically accurate word per entry from
  per-entry signals; "tool" reserved for manifest tools, T&I architectural
  tools, and MCP tools (never used for a digest entry). New settled-
  decision row captures the rule. Spec fix folded in: Pass 2 Consolidation
  Strategy section omits for single-app digests (was incorrectly "always
  included"). PLAN.md 3.5b.7 gains an open design question about subset
  re-run context preservation. CV's per-tool sub-task terminology
  unchanged in this PR; broader CV-terminology rename queued as a future
  follow-up.
- **PR #69**: Doc style rule in CLAUDE.md ("tight
  wins" — one paragraph per decision, why-clauses not why-paragraphs,
  Settled-decision Reason cells one sentence each, every PR may trim
  its section) plus initial terseness pass on ~19 of the heaviest-bloat
  rows in the spec.md Settled decisions table. Renames "Consolidation
  analysis Pass 1 surfacing" → "Consolidation analysis Pass 1 report"
  (row + body subsection). Updates stale "Internal tool" badge text
  to "Internal" in the Per-dependency freshness badges row. Adds one
  P3 TODO surfaced during the trim ("Code-aware cost transparency:
  drop static pricing page?" — pre-auth audience is effectively zero
  because code-aware is gated by signup + BYOK + MCP setup; defer to
  separate design PR). Remaining settled-decision rows + Code-aware
  intake body + handoff.md trim + README.md trim deferred — will
  land incrementally via the new CLAUDE.md rule.
- **PR #70**: Phase 3.5b.3 design continuation: 4-tool MCP surface
  split into 6 tools along a server-driven vs assistant-driven control
  pattern. Adds `revise_codebase_digest` (assistant-initiated changes:
  upsert and delete on apps, intent gaps, intake prefills) and
  `get_codebase_draft` (read state); `update_codebase_digest`
  repurposed as the clarification-response-only path. 7 behavioral
  decisions land as settled-decision rows: tool surface split,
  internal dependency referential integrity (loose with non-blocking
  advisory; revised mid-PR from initial strict design after pushback
  on real-world scenarios like deprecated lines of business),
  background eval concurrency (queue with coalescing), tool error
  reporting (MCP `isError` convention per modelcontextprotocol.io
  Tool Execution Errors section), empty update (strict; redirects to
  MCP `ping` method), raw artifact location (three-field `AppEntry`
  split: `dependencies` / `packageManifests` / `inferenceContext`;
  union by tool name; `dependencies` wins on version conflict),
  delete of nonexistent app id (silent success). PLAN.md 3.5b.3
  expanded to match: sectioned tests (auth/transport, tool surface
  and behavior, concurrency, integration), expanded implementation
  (six handlers, dangle-reporter, `AppEntry` parser, coalescing
  mechanism), expanded acceptance criteria. Held for follow-up PRs:
  freshness-badges removal, Tool I/O Zod schemas + validation policy
  (next major design PR), remaining 3.5b.3 design (tenant context
  propagation, idempotency, 30-day expiry job).
- **PR #72**: Doc cleanup. Drops the per-dependency freshness badges
  subsection (per-dep refresh UI was theater; recommendation quality
  is set at pipeline-time CV, not by in-review per-dep refresh) and
  fixes the `cluster_analysis` data model row drift (PR #66 added the
  column in body but never updated the data model row).
- **PR #73**: Phase 3.5b.3 design (MCP Tool input/output contract).
  Adds per-tool envelopes, shared shapes (`AppEntry`, `IntentGap`,
  `IntakePrefills`, `PartialFailure`, `PollGuidance`), validation
  policy (dot-path notation, `didYouMean` scope limited to field
  names and enum values, strict unknown keys at every nesting level,
  informational `partialFailures` contract), pre-Zod normalization
  rules (custom trim + bool/number coercion, not Zod `.coerce.*`
  because `.coerce.boolean()` truthifies `"false"` to `true`). Apps
  and intent gaps moved from upsert/delete to separate
  create/update/delete operations with partial-merge on update.
- **PR #74**: Phase 3.5b.3 design (remaining decisions). Two-tier
  idempotency (Tier 1 explicit `idempotencyKey`, 24h TTL, Stripe
  collision pattern; Tier 2 implicit `{user_id, request_hash}` with
  5-min default TTL per-tenant configurable, catches naive retries
  for free; explicit beats implicit). Sliding-TTL draft expiry (every
  access bumps `expires_at` to `now() + sliding_ttl_days`, capped at
  `created_at + max_lifetime_days`, both per-tenant configurable
  defaults 30/90). Daily BullMQ cleanup at 3am UTC with in-flight job
  cancellation. Deletes the stale "Tenant context propagation"
  subsection (described an upstream context-to-MCP flow that
  conflicts with digest-as-pure-inventory; tenant context flows via
  Wave 0 only). Two new admin config rows, one P3 TODO for
  pre-expiry warning email at hard cap.

**Spec PRs landed in earlier session blocks:**
- PR #52: Phase 3.5a backend wiring closure pass (specced)
- PR #53: Code-aware intake architecture; multi-provider BYOK at user scope;
  data model additions
- PR #54: Structured intent gaps + product-level consolidation analysis
- PR #55: Code-aware pricing (Pass 1 $49, Pass 2 $199 per spec+plan)

**Queued PRs (not yet started):**
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
- **CV per-tool terminology rename (follow-up)**: broader rename of CV's
  "per-tool sub-task" work-unit terminology to a generic name (e.g.,
  "per-target sub-task" or "per-entry sub-task") so it reads cleanly in
  code-aware contexts where the lookup unit can be a digest app entry.
  Out of scope for PR #68 because it touches the whole CV section and
  adjacent code/test names.

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
- 3.5b.3 design fully landed (PR #73 Tool I/O contract + PR #74 the
  remaining decisions). Implementation gating now removed.
- 3.5b.4 design landed this session block (pre-digest intent collection
  plus Manifest Gatekeeper extension; outcome-gated execution principle
  named and applied to Quality Evaluator + Pattern & Cluster Analyzer
  refinements). Implementation gating now removed.
- 3.5b.5 through 3.5b.7 design (placeholder bullets in PLAN; will land
  in their own focused PRs)
- 3.5c (agent slot + variant abstraction) design landed this session
  block as fork-readiness infrastructure for future code-aware Wave 1+
  agent variants.

**Code-aware backend (Phase 3.5b + 3.5c) — implementation path** (gated
on design completion):
- 3.5b.1 implementation (Quality Evaluator agent in
  `packages/agents/src/quality-evaluator/`, BullMQ worker, 3-layer cache,
  self-iteration loop with four early-exit conditions including
  sufficiency threshold and filtered iteration, server-side inference
  helpers, raw manifest parsing)
- 3.5b.2 implementation (Pattern & Cluster Analyzer agent + worker,
  per-category dispatch, single-app short-circuit, `cluster_analysis`
  column migration including the new `summary` field, affected-only
  re-evaluation diff logic)
- 3.5b.3 implementation (MCP server in `packages/mcp/`, Railway
  deployment, HTTP+SSE transport, Bearer token auth)
- 3.5b.4 implementation (seed 2 intent questions, web-UI form, MCP
  payload fields, Intent Gap Pattern Detector specialist, Manifest
  Gatekeeper extension, BullMQ promotion job)
- 3.5c implementation (agent registry refactor to slot + variant,
  resolver function with per-tenant config dispatch, checkpoint
  storage updated)

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

## Spec doc state (2026-05-15)

`docs/spec.md` is at ~1,570 lines. Recent restructure: digest schema
went from three components (intake step pre-fills + per-app inventory +
intent gaps) to one (per-app inventory) as project-level signals now
derive from the inventory directly and intent moved to a pre-digest
collection step. New "Pre-digest intent collection" subsection
documents the two structured questions (target topology + timeline)
plus optional constraints, plus the bimodal collection paths (web UI
or MCP payload). Three new settled-decision rows added this session
(outcome-gated execution; pre-digest intent collection; agent slot +
variant abstraction); existing "Intent gap question evolution" row
updated to drop the obsolete "Copilot matches" wording. MCP
`submit_codebase_digest` tool description carries a forward-pointing
note that its I/O contract subsection predates the pre-digest design
and is updated in a follow-up PR.

## Deployment requirements

- Apply migrations: `pnpm db:migrate` (now goes through 0012)
- Run seeder: `pnpm --filter shared db:seed`
- **Redis AOF persistence** must be enabled in Railway before production
- **`ENCRYPTION_KEY`** (32-byte base64): required before any tenant
  provides a BYOK key
- **`GITHUB_TOKEN`** and **`NVD_API_KEY`** (both free): required before
  3h production traffic for CV API integration

## Architecture decisions made this session block (2026-05-12 to 2026-05-15)

**MCP Tool I/O contract format (2026-05-13):** Per-tool envelopes
described in prose-and-tables; shared shapes (`AppEntry`, `IntentGap`,
`IntakePrefills`, `PartialFailure`, `PollGuidance`) as markdown
tables. Initial draft used TypeScript code blocks; rejected because
the rest of the spec uses prose and tables exclusively for structured
shapes. Runtime Zod validation still lives in
`packages/mcp/src/schemas/`; the spec describes the contract in
human-readable form like the rest.

**Strict unknown keys at every nesting level (2026-05-13):** The
outcome-lens reasoning that justified strict-with-didYouMean
validation (scenario B: assistant typos a useful field name, strict
recovers it via suggestion, loose silently degrades the digest)
applies equally to nested keys. Initial wording "top-level keys" was
narrower than the actual rule. Corrected to apply at every nesting
level; the dot-path notation in `partialFailures.path` was already
designed assuming nested keys can be flagged.

**didYouMean excludes id matching (2026-05-13):** Field-name and
enum-value typos get close-match suggestions via Levenshtein up to 2.
App ids do NOT get suggestions even on `id_not_found`. Asymmetric
payoff: small upside (recovering one typo'd internal dep on one
entry out of dozens) versus real downside (autoloop assistant grabs
the suggestion without verifying, dependency graph silently corrupts,
digest looks structurally correct while quietly being wrong).

**Pre-Zod normalization, custom helper (2026-05-13):** Whitespace
trim on strings, case-insensitive `"true"`/`"false"` to boolean,
numeric strings to number via `Number.isFinite(parseFloat(v))`, nulls
and missing keys untouched. NOT Zod's built-in `.coerce.*`:
`.coerce.boolean()` truthifies any non-empty string and would
silently accept `"false"` as `true`. Custom helper handles the
unambiguous cases without that footgun.

**Two-tier idempotency (2026-05-14):** Tier 1 explicit
`idempotencyKey` (Stripe pattern, 24h TTL, hash-comparison collision
detection). Tier 2 implicit `{user_id, request_hash}` with 5-min
default TTL (per-tenant configurable) catches naive retries from
assistants that don't supply a key. Hash compute and Redis storage
are both rounding error; BYOK duplicate charges have no refund path
unlike Stripe's card refunds, so cheap implicit protection of naive
users is worth the small implementation cost. Override via fresh
`idempotencyKey` (explicit beats implicit). Initially specced as
Tier 1 only; reversed mid-PR after re-examining cost vs benefit with
the outcome lens.

**Sliding-TTL draft expiry with hard cap (2026-05-14):** Every
access (read or write, MCP or web UI) bumps `expires_at` to `now() +
sliding_ttl_days` (default 30, per-tenant configurable). Capped at
`created_at + max_lifetime_days` (default 90, per-tenant
configurable). Hard cap prevents indefinite retention for privacy
and storage; sliding TTL accommodates real corporate workflow
timelines (multi-week internal review, change management). Daily
BullMQ cleanup at 3am UTC with in-flight Quality Evaluator and
Pattern & Cluster Analyzer cancellation. Pre-expiry warning email
queued as P3.

**Tenant context propagation cleanup (2026-05-14):** Deleted the
"Tenant context propagation" subsection that described an upstream
context-to-MCP flow. Two reasons it was wrong: (1) digest production
is a pure inventory of what exists, not what the user should build
on; tenant constraints apply at the recommendation layer (Wave 1+),
not at intake. (2) The subsection name said "tenant communication
context" but described the structured tenant context fields; the
two concepts are distinct (Wave 0 vs Pass 2 render layer). No
replacement subsection needed; existing Wave 0 mechanism handles
tenant context injection uniformly for text-intake and code-aware.

**No orchestrator agent (clarified 2026-05-13):** The spec is
explicit at [line 874](docs/spec.md#L874): "No LLM acts as an
orchestrator at any level; agent calls are leaf nodes." This is
worth surfacing because it trips people up when "Orchestration" is
the name of a Wave 1 agent (that agent recommends orchestration
patterns; it doesn't orchestrate our pipeline). Context flows via
deterministic code-routing at prompt assembly time: structured
tenant context goes to every Wave 1+ agent uniformly; tenant
communication context goes only to render-layer agents (Pass 1 TW +
Pass 2 SS + PS). The pattern is enforced in source, not by an
agent.

**Outcome-lens framing (recurring this session block):** Multiple
design decisions resolved by asking "which produces a better /
faster / lower-token-cost recommendation?" instead of "which matches
design principle X?" Examples: strict-vs-loose validation
(scenario-by-scenario outcome math beat Postel's law); reversing the
Stripe-only-idempotency concession (cost analysis showed implicit
dedup was free, BYOK duplicate cost is real and unrecoverable);
didYouMean id-matching rejection (asymmetric payoff favored skipping
the suggestions). Captured as a feedback memory.

**Outcome-gated execution (2026-05-15):** Pipeline work runs only when
its outcome would shift the recommendation. Named as a cross-cutting
principle and recorded as a settled-decision row. Applies at two
grains: whole-work (catalog inclusion, surfaced gaps, iteration loops,
retries, deep validation) and within-work (specific clarifying
questions to attempt, specific cycles to run). Existing instances
already in spec: Skeptic Advisory-floor early-exit, CV result cache,
Pattern & Cluster Analyzer single-app short-circuit, Quality Evaluator
score plateau. New refinements added this session: Quality Evaluator
sufficiency threshold and filtered iteration; intent-gap catalog
discipline; Pattern & Cluster Analyzer clarification-question scoping
tightened. Companion principle to the outcome-lens (which is about
evaluating designs; this one is about gating execution).

**Pre-digest intent collection (2026-05-15):** Earlier "intent gaps as
post-digest checklist" framing replaced by pre-digest collection of two
structured questions (target topology, timeline pressure) plus optional
free-text constraints, before the assistant produces the digest. Code
cannot answer these; intent doesn't shape the digest itself; collecting
earlier keeps the review screen focused on validating digest accuracy
and lets Quality Evaluator and Pattern & Cluster Analyzer reason with
intent during background passes. Bimodal collection: web UI session or
inline MCP payload fields. Catalog lives in
`manifest_intent_gap_questions` (already in migration 0010); MVP
seeds 2 entries with `owner = 'global'`. Manifest Gatekeeper extension
evolves option lists from free-text patterns over time. Implementation
in PLAN.md 3.5b.4.

**Digest schema simplification (2026-05-15):** Removed intake step
pre-fills from the digest. Wave 1+ agents derive project-level signals
(deployed platform, dominant language, observed scale signals,
external integrations) from the per-app inventory directly rather than
consuming pre-baked intake-step values. Aligns with the "code-aware
user does not walk through the 11-step intake" clarification and the
"agents do the heavy lifting from an 85%-correct digest" lens. Per-app
inventory is now the digest's one primary component; intent comes
separately pre-digest.

**Agent slot + variant abstraction (2026-05-15):** Registry refactor
from flat agent keys to slot + variant structure. Each slot supports
N variants (flat string keys, dots/underscores as naming convention);
Runner resolves variant per run via a resolver function consuming
`runContext` (intake mode, user id, tenant id, tier). Variant
selection is config-driven per tenant via the standard `config` table.
MVP ships only `textIntake` variants populated; code-aware runs use
`textIntake` until specific agents are forked. Built now as
fork-readiness infrastructure: gut on the long-term call is that 3-5
of the 8-10 Wave 1+ agents will likely benefit from code-aware-
specific reasoning over time. Without the abstraction, forking later
costs ~2-3x because flat keys are baked into Runner, FlowProducer,
checkpoint reuse, and observability. Resolver-function shape supports
future dimensions (A/B testing, tier-based, tenant-scoped) without
restructure. Implementation in PLAN.md 3.5c.

**User-correctable accuracy lens (2026-05-15):** Calibrate accuracy
targets to 85-90% (not 100%) for inference steps that have a user
review/correction surface downstream. Asymmetric-payoff arguments
(used to justify strict validation in load-bearing flows like
didYouMean-for-ids) apply only to flows the user never sees; they
don't apply to inference values the user reviews before they reach
load-bearing input. Captured as a feedback memory. Recalibrated
several design pushbacks this session including server-side
opportunistic intent-gap matching (initially retracted as
asymmetric-payoff-bad, restored after the lens revealed questionId
is metadata not load-bearing input).

## Architecture decisions made in earlier session block (2026-05-07 to 2026-05-10)

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
LLM calls in parallel with configurable concurrency cap. Single-app
categories skip the LLM call; server emits
`consolidationOpportunity: 'none'` deterministically. Output includes
structured `clusters`, `blockers` (typed array with type, description,
affectedAppIds), `capabilityVariance`, `supportingEvidence`, plus
`clarificationQuestions` and the `consolidationStrategyQuestion` per
multi-app category. Stored in dedicated `cluster_analysis` jsonb
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
evaluated, research at pipeline run", "Internal". No
value-judgment language about staleness. Click to refresh fires CV API
+ web-search calls for that single dep, charges BYOK, updates
timestamp. Refresh does not re-trigger Quality Evaluator (description
quality is independent of CV data freshness).

**Terminology disambiguation — internal app vs user-facing word
selection (resolved 2026-05-10):** "Tool" was overloaded across four
senses: digest tool (user's app in code-aware intake) vs manifest tool
(third-party service we recommend) vs Wave 1 T&I "tool" (architectural
concept and recommended manifest entry) vs MCP "tool" (SDK function
sense). PR #68 resolves by renaming sense #1 to `app` internally
(code, schemas, prompts, design docs) and adding a user-facing
word-selection rule: agents render via `displayName` /
`productCategory.displayName`; when an umbrella is needed, agents pick
the most semantically accurate word per entry from per-entry signals
(`observedPatterns`, `inputs`/`outputs`, `isPrivate`) — "service" /
"worker" / "library" / "utility" / "app" per case. The word "tool" is
reserved for senses 2/3/4 and never used for a digest entry. The
narrower-than-bucket cost of a single umbrella was the original blocker
on this rename; per-entry word selection removes it because agents have
the signal needed to pick the right word per surface. CV's "per-tool
sub-task" work-unit terminology unchanged in PR #68; broader CV-
terminology rename queued as a separate follow-up.

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
