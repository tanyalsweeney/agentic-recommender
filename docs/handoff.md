# Handoff — Agentic Architecture Recommender

## Next session: follow-up PR for #77 design corrections

After PR #77 (per-app schema + multi-part submission) merges, open a follow-up PR with these six course corrections from the 2026-05-16 pushback pass. New branch name suggestion: `tsweeney/spec-3.5b.4-pushback-corrections`.

1. **Drop fields 3-5 from `AppEntry`.** Keep `currentDecisionMaking` and `humanInTheLoop` only. Remove `stateAndMemory`, `dataSensitivity`, `failureModes`. They're partially derivable from existing fields (dependencies, observedPatterns, externalIntegrations, isPrivate) and the marginal value did not justify the per-app cognitive load and assistant variance.

2. **Default `final: true` on `submit_codebase_digest`.** Multi-part assistants set `final: false` on initial submit and intermediate revises; the final revise sets `final: true` (or omits, default true). Single-shot assistants pay zero friction. Tool description front-loads multi-part as the recommended path for digests over ~10 apps so multi-part stays discoverable.

3. **Add idempotency to `revise_codebase_digest`.** Tier 2 hash-based implicit dedup keyed on `{user_id, draftId, payload_hash}` with a short window (5 min default, per-tenant configurable). Explicit `idempotencyKey` (Tier 1) optional. Closes the network-retry duplicate-creation gap that multi-part makes much more common than single-shot.

4. **Re-eval scope on `final: true`.** Include apps whose `productCategory` peer set shifted since their last eval, not just changed entries. Prevents stale scoring on apps that were eval'd via mid-stream `triggerEvalNow` against a thin L2 group context and never re-evaluated as the inventory grew.

5. **Email-only URL provisioning.** Draft URL no longer surfaced to the user via the assistant chat. Submit response still includes URL (for assistant introspection); response guidance directs assistant to tell user "I've submitted; you'll get an email when ready." User's first sight of the URL is the completion email. Avoids the partial-state-review-screen problem.

6. **One-line example output per inferential field.** Add example outputs in spec for the two remaining new fields (`currentDecisionMaking`, `humanInTheLoop`) plus the existing inferential fields where it adds value (`primaryPurpose`, `distinguishingCharacteristics`). Reduces assistant variance.

Source: 2026-05-16 critical-review pass at the user's explicit request ("did you push back on these changes all you want to"). #1 is a backout of an overcommit I should have pushed harder on. #2-#3 are real correctness fixes. #4-#6 are UX/discipline tightening. All are in spec/PLAN/handoff territory; no code touched.

Approach: single focused commit per the doc-style "tight wins" rule. PR title and body should make clear this is a course correction on #77.

---

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

**Recent merges (2026-05-09 to 2026-05-14):**
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

## Architecture decisions (last 7 days)

Older decisions live in [spec.md Settled decisions](spec.md) (canonical), PR descriptions on GitHub, and git history. This section keeps only the past week plus rationale that wouldn't fit in a spec Reason cell.

**2026-05-09**

*Cheap-now-expensive-later principle.* Repeatedly applied: include structured `blockers` / `capabilityVariance` / `supportingEvidence` in Pattern & Cluster Analyzer output now; add `estimate_digest_cost` MCP tool now; dedicated `cluster_analysis` column rather than nesting in `quality_summary`. Wins when marginal cost of inclusion is genuinely small.

*Facts to agent, intent to user.* Assistant has code access; we don't. Code-derivable facts go to the agent; intent / judgment questions go to the user. Corrected multiple designs where I tried to ask the user something the agent could answer from code.

*MCP integration model / control boundary.* See spec. Worth re-stating: server responds when called, cannot push; quality of digest is bounded by quality of assistant.

*Async + email digest evaluation completion.* See spec. Synchronous MCP response would block IDE on large digests (50+ apps push evaluator wall-clock past 5 minutes).

*Quality Evaluator architecture.* See spec. Replaced an earlier heuristic + LLM-evaluator design with word-count and generic-vocabulary penalties (rejected as misleading specificity signal).

*Pattern & Cluster Analyzer architecture.* See spec. Sub-component-level considered and rejected; product-level matches how users think about migration.

*Cost transparency static rate table.* See spec. Static page + `estimate_digest_cost` MCP tool; no cost gate at submit.

**2026-05-10**

*MCP server hosting.* See spec. Recommendation flipped from "start in Next.js, extract later" to "dedicated from day one" once the user clarified the first user will use MCP; extraction would be customer-visible.

*MCP authentication mechanics.* See spec. SHA-256 sufficient for high-entropy tokens; slow hashes overkill.

*MCP response-driven iteration pattern.* See spec. Long-polling explicitly rejected (waits exceed function timeouts and HTTP connection lifetimes).

*MCP-as-only-channel for code-aware.* Considered five alternatives (IDE assistant, our CLI, self-hosted analyzer, repo connector, customer uploads). IDE-assistant meets enterprise security bar (assistant runs in customer environment). Self-hosted analyzer flagged as Enterprise-tier follow-on.

*Cheap-now-expensive-later applied to step-function costs.* The principle assumes monotonic cost growth. For step-functioned costs (cheap before customer X, expensive after), timeline-to-customer-X matters. Caught when re-analyzing MCP server hosting.

*Terminology disambiguation — app vs tool.* See spec. PR #68 resolved by renaming digest entries to `app` internally; user-facing word selection picks per-entry.

**2026-05-13**

*MCP Tool I/O contract format.* See spec. Initial draft used TypeScript code blocks; rejected because the rest of the spec uses prose and tables exclusively for structured shapes.

*Strict unknown keys at every nesting level.* See spec. Initial wording "top-level keys" was narrower than the actual rule; corrected.

*didYouMean excludes id matching.* See spec. Asymmetric payoff: small upside (recovering one typo'd internal dep) versus real downside (autoloop assistant grabs the suggestion, dependency graph silently corrupts).

*Pre-Zod normalization, custom helper.* See spec. Zod's `.coerce.boolean()` truthifies any non-empty string and would silently accept `"false"` as `true`; custom helper avoids that footgun.

*No orchestrator agent (clarification).* Spec is explicit at [spec.md:874](spec.md#L874): no LLM acts as an orchestrator; agent calls are leaf nodes. Worth surfacing because "Orchestration" names a Wave 1 agent that recommends orchestration patterns; it doesn't orchestrate our pipeline.

*Outcome-lens framing (recurring).* Multiple decisions resolved by asking "which produces a better / faster / lower-token-cost recommendation?" instead of "which matches design principle X?" Captured as a feedback memory.

**2026-05-14**

*Two-tier idempotency.* See spec. Initially specced as Tier 1 only; reversed mid-PR after re-examining cost vs benefit with the outcome lens.

*Sliding-TTL draft expiry with hard cap.* See spec. Hard cap prevents indefinite retention; sliding TTL accommodates corporate workflow timelines.

*Tenant context propagation cleanup.* Deleted the "Tenant context propagation" subsection that described an upstream context-to-MCP flow. Wrong because digest production is pure inventory; tenant constraints apply at recommendation layer (Wave 1+). Worth noting because someone may grep for the deleted subsection name.

**2026-05-15**

*Outcome-gated execution.* See spec. Companion principle to outcome-lens: outcome-lens evaluates designs against outcome; outcome-gated execution skips work whose outcome wouldn't shift. New instances added this session: Quality Evaluator sufficiency threshold + filtered iteration; intent-gap catalog discipline; Pattern & Cluster Analyzer clarification-question scoping tightened.

*Pre-digest intent collection.* See spec. Replaces an earlier "intent gaps as post-digest checklist" framing. Two structured questions (target topology, timeline) plus optional constraints; bimodal collection (web UI or MCP payload).

*Digest schema simplification.* Removed intake step pre-fills from the digest. Wave 1+ agents derive project-level signals from per-app inventory directly. Aligns with "code-aware user does not walk through the 11-step intake" and "agents do the heavy lifting from an 85%-correct digest."

*Agent slot + variant abstraction.* See spec. Gut on long-term call: 3-5 of 8-10 Wave 1+ agents will likely benefit from code-aware-specific reasoning. Building the hook now (~3-4 days) avoids ~2-3x refactor cost later.

*User-correctable accuracy lens.* Captured as a feedback memory. Calibrate accuracy targets to 85-90% (not 100%) for inference steps with downstream user-review surface. Asymmetric-payoff arguments apply only to flows the user never sees. Recalibrated several pushbacks this session.

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
