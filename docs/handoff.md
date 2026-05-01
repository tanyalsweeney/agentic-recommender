# Handoff — Agentic Architecture Recommender

## Current state (2026-05-01)

Phases 0, 1, 2, and 3a-3d complete. Phase 3e (maintenance workers) is next.

**What's built:**
- Monorepo scaffolded: pnpm workspaces, TypeScript, Vitest workspace
- Database schema: 19 tables, 6 migrations applied
  - Phases 0-1 original 12 tables
  - Migration 0006: `manifest_entries` split into three typed tables:
    `manifest_tools`, `manifest_patterns`, `manifest_failure_modes`
  - `manifest_proposals` table (for Gatekeeper review queue)
- Agent layer: 12 Zod output schemas, 12 callers, 3-layer prompt caching, multi-provider dispatch
  - 10 pipeline agents (intake through technical-writer)
  - Manifest Gatekeeper and Org List Gatekeeper (Phase 2e)
  - Agent version registry (YYYY-MM-DD-{sha256_8chars} of prompt file)
- Manifest seeder (Phase 2f): 15 tools, 6 patterns, 6 failure modes seeded into
  three typed tables. Run: `pnpm --filter shared db:seed`
- `loadManifest()` in `packages/shared/src/db/manifest.ts` -- unified query helper
  returning `{ tools, patterns, failureModes }` for agents and workers
- All type errors fixed across workers: wave1 agent map typed, wave2/2_5 arg
  order corrected, base.ts OpenAI union type narrowed
- Agent call logger: set `AGENT_CALL_LOG=packages/evals/logs/agent-calls.csv`
  to capture timing, token counts (with cache breakdown), and estimated cost
  per call. Appends CSV rows; committed to git for trend tracking.
- **Phase 3d eval baselines established (2026-05-01):**
  - Skeptic: 6/6 (P1 gate cleared)
  - Intake: 8/8
  - Orchestration: 3/3
  - Technical Writer: 5/5
  - Security: 6/6 (split into two scenarios -- see below)
  - Gatekeeper: 26/26
  - Cooperative, CV: placeholder suites, no tests yet

**Local dev:** Docker needed for DB (Postgres :5432, Redis :6379). `.env.local` complete.

## What's immediately next

**Phase 3e: Maintenance workers.** BullMQ workers for manifest refresh and
Gatekeeper runs. Schema additions: `last_refreshed` on manifest tables,
`manifest_proposals` table already exists. See PLAN.md Phase 3e.

**Phase 3f: Multi-tenancy schema.** Tenants table, tenant_id on users,
themes, theme_assignments, BYOK secrets. See PLAN.md Phase 3f.

**Phase 3g: Streaming in agent caller.** Must complete before production
traffic. See below and PLAN.md Phase 3g.

## Deployment requirements

- Apply migrations to prod DB before any production traffic: `pnpm db:migrate`
- Run seeder after migrations: `pnpm --filter shared db:seed`
- **Redis AOF persistence must be enabled** in Railway Redis settings before
  production traffic. BullMQ job durability depends on it.

## Architecture decisions made this session (2026-05-01)

**Manifest table split:** `manifest_entries` retired. Three typed tables replace
it: `manifest_tools` (tool-specific columns present), `manifest_patterns`
(domainKnowledgePayload NOT NULL, pattern shape), `manifest_failure_modes`
(domainKnowledgePayload NOT NULL, failure mode shape). Migration 0006.

**Streaming required before production (Phase 3g):** The security eval surfaced
a TCP timeout at ~6 minutes on complex responses. The Anthropic API streams
responses; without streaming mode the connection can drop before the full
response arrives. `callAnthropicAgent` must switch from `messages.create()` to
`messages.stream()`, accumulating `input_json_delta` chunks and parsing on
`content_block_stop`. Same work unblocks CV progressive disclosure in Phase 4e.
Settled decision added to spec.md.

**Security eval split:** The original single scenario (fully autonomous web
agent with arbitrary URLs, form submission, purchases) generated a response
long enough to drop the TCP connection. Split into two sequential scenarios:
(A) read-only web research -- tests prompt injection via web content, trust
boundaries, exfiltration via reasoning; (B) write-access form submission --
tests tool misuse, excessive autonomy, financial impact. Both pass.

**Agent call logger:** Opt-in via `AGENT_CALL_LOG` env var. Appends one CSV
row per agent call: timestamp, agent name, provider, model, duration, input
tokens, output tokens, cache read tokens, cache write tokens, estimated cost.
Pricing constants for Sonnet 4.6, Opus 4.7, Haiku 4.5. Good for tracking cost
and latency trends as prompts are edited.

**Pipeline latency reality:** A full Pass 1 takes 6-10 minutes. Individual
agent calls take 25-60 seconds each. Wave 1 runs 4 agents in parallel (~60s);
Wave 3 runs up to 4 Skeptic cycles (~2.5 min). The async BullMQ + email
notification design is the right answer -- users submit and come back.
Prompt caching reduces cost but not wall-clock time (output generation dominates).

**Eval `beforeAll` refactor:** Eval suites previously called the agent once
per `it` block. Refactored to use `beforeAll` per scenario: one API call per
unique input, shared across all assertions. Reduced total eval calls from ~38
to ~23 for the full suite.

## Cost observations (2026-05-01)

Spent ~$20 running evals today. Inflated by: redundant calls before `beforeAll`
refactor, multiple timeout retry runs, no cache benefit between spread-out calls.

Estimated real Pass 1 cost with warm caches: $2-5 (to be measured with first
real pipeline run). Eval suite after refactor: ~$2-4 per full run.

Free tier (3 runs/day) economics need validation against real cost data before
launch. Already tracked in TODOS.md as P1.

## Architecture decisions from 2026-04-30 session

**Tenant context (formerly Wave 0):** Wave 0 retired. Tenant-specific domain
context injected into verifiedContext before Wave 1. Not a BullMQ job.
Versioned with `YYYY-MM-DD-{hash8}` pattern. Migration 0005.

**Manifest facts vs conclusions:** `platformCompat` and `modelCompat` removed.
CV derives compatibility from first principles; manifest stores facts as floors.

**Multi-tenancy:** In scope for initial rollout. Schema gap closed in Phase 3f.
Multi-tenant branding system designed: themes table, theme_assignments (mode as
relationship, not token encoding), token vocabulary (color, typography, radius),
presets seeded in DB, version-as-cache-key strategy. See spec.md settled decisions.

**Branding / white-label:** Standard (attribution required), Premium (optional),
Enterprise (full white-label). Design complete, implementation in Phase 6.

**Communication context templates:** Design agreed, not built. Phase 6.

**Plan restructure (2026-04-30):**
- Maintenance pipeline moved from Phase 7 into Phases 2 and 3 (it is the
  differentiating feature)
- Admin dashboard (Phase 5) before tenant dashboard (Phase 6) -- operator
  controls before tenant-facing tools
- Real auth deferred to Phase 4f; dev auth stub is Phase 4a
- Phase 3e/3f ordering: maintenance before multi-tenancy (core before distribution)

## Prompt review -- complete (2026-04-29)

All 10 pipeline agents reviewed. Key changes:
- Prime directive: cover what senior engineers anticipate (completeness), then
  surface what they would not find until deep into implementation (value).
- First-principles trip hazard reasoning: manifest as floor, not ceiling
- Domain-specific failure mode named for each agent
- No em dashes in prompt files

## Collaboration notes

- No em dashes in any written output. Commas, colons, or parentheses instead.
  Prefer short sentences. Applies to responses AND prompt files.
- Show the diff before writing. User prefers to approve changes before they land.
- Push back by default when something is off. User explicitly requested this.
- User is growing as an agentic engineer and architect. Honest pushback, not generous credit.
- User has strong UX instincts rooted in React engineering background. Reliable.
- User responds well to "show value early, minimize friction" as a design principle.
- User's standard for agent rigor: cover what senior engineers anticipate, then
  surface what they would not find until deep into implementation. Both matter.
- User wakes up with insight -- sleep on hard decisions before finalizing.
- First user: husband (Sr. Data Scientist, Microsoft, award-winning). His team
  incorporated Pass 1 output into a real project.
- Target users: senior technical builders doing agentic work, outpaced by the ecosystem.
- No marketing language in written output.
- User follows general-audience AI news, not deep technical press.
- LinkedIn newsletter documenting this build. Drafts at ~/Desktop/blog entries/.
  Claude.ai handles newsletter; Claude Code handles implementation.
- Old codebase exists but is deliberately excluded.
