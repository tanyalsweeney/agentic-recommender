# Handoff — Agentic Architecture Recommender

## Current state (2026-04-27)

Implementation has started. Phases 0 and 1 are complete and on main.

**What's built:**
- Monorepo scaffolded: pnpm workspaces, TypeScript, Vitest workspace (packages: web, workers, agents, shared, evals)
- Database schema: all 12 tables, 4 required indexes, initial migration applied to dev and test databases
- Config resolution: tenant override before global default pattern, tested
- 11 integration tests passing against live Docker Postgres

**Local dev is configured:**
- Docker Desktop installed; `docker compose up -d` starts Postgres (5432) and Redis (6379)
- `.env.local` complete: DATABASE_URL, DATABASE_URL_TEST, ANTHROPIC_API_KEY, AUTH_SECRET all set
- `pnpm test` runs the Vitest workspace and passes

**Spec is complete and reviewed:**
- CEO review (SELECTIVE EXPANSION) and eng review (FULL REVIEW) both cleared
- All open questions resolved, including manifest data structure (full load for v1) and Run Pack pricing ($9/5 runs)
- CLAUDE.md written with architectural guardrails

## What's immediately next

**Phase 2 — Agent layer (TDD):**
1. Write Zod output schemas for each agent in `packages/agents/src/schemas/` — one file per agent, before any SDK callers
2. Write unit tests for each schema (valid output passes, malformed output throws with field name)
3. Write eval cases in `packages/evals/` — known inputs + expected output patterns — for the 12 eval targets
4. Implement Anthropic SDK callers in `packages/agents/src/callers/` with 3-layer prompt caching
5. Implement prompt templates in `packages/agents/src/prompts/` (versioned by file hash)

Agents to implement (in Wave order): intake, orchestration, security, memory-state, tool-integration, failure-observability, trust-control, compatibility-validator, skeptic, technical-writer.

## Key decisions settled this session

All are in spec.md Settled decisions. Summary of the major ones:

- **Tech stack:** TypeScript monorepo, Next.js, BullMQ + Redis, PostgreSQL, Drizzle ORM, Anthropic SDK
- **Manifest query:** full load for v1; filtered lookup at 500+ entries
- **Prompt caching:** 3-layer cache_control on every Anthropic SDK call — required from day 1
- **Agent versioning:** YYYY-MM-DD-{sha256_8chars} of prompt template file, computed at startup
- **Agent output schemas:** Zod, validated at call time
- **CV sub-task ordering:** cross-agent conflict checks run before cross-tool compatibility checks (cross-agent is structural, no web search; eliminates rejected tools before expensive cross-tool research fires)
- **Deployment:** Vercel (Next.js) + Railway (workers + Postgres + Redis)
- **Spec Scaffold messaging:** updated to invite brownfield/mid-build users alongside planning users; no UX change required

## Open questions

None. All spec questions resolved.

## Demand and distribution context

First user: user's husband, Senior Data Scientist (10 yr tenure) at Microsoft. He explicitly asked for the tool to be built. His team incorporated the Pass 1 output into a real project, resolving a tool compatibility problem (OAuth) his team had been fighting for weeks. A parallel team colleague is likely the second user when the product is ready to show.

The product's founding quote (from the first user, verbatim):
"Everybody builds these agents that do the thing they need. Most of the agents work fine. But nobody thinks about security. And resolving compatibility is a nightmare. We need a tool that suggests a detailed architecture and encourages folks to apply security equivalent to the attack area they introduce."

Design doc from /office-hours (approved) is at:
`~/.gstack/projects/tanyalsweeney-agentic-recommender/tanyaslweeney-main-design-20260427-030650.md`

YC application: user is considering applying.

## Collaboration notes

- Read spec.md at the start of a new session before doing anything else
- Commit and push only when the user explicitly asks
- Push back by default when something is off — user explicitly requested this
- User is growing as an agentic engineer and architect — give honest pushback, not generous credit
- User reasons well from first principles but sometimes doesn't trust her own reasoning — push her to articulate the framework behind her instincts, not just validate the conclusion
- User has strong UX instincts rooted in React engineering background — reliable and worth taking seriously
- User responds well to "show value early, minimize friction" as a design principle
- No em dashes in any written output. Use commas, colons, or parentheses instead.
- User is publishing a LinkedIn newsletter (~8 chapters) documenting this build. Drafts at ~/Desktop/blog entries/ — kept outside the repo. Claude.ai handles newsletter drafting; Claude Code handles spec and implementation work.
- User follows general-audience AI news, not deep technical press — frame deep-cut tooling references accordingly
- User's husband (award-winning Sr. Data Scientist at Microsoft) is the first user and primary validator. He found real value in the prototype. He works from home 2-3 days/week; user overhears his agentic project conversations.
- Old codebase exists but is deliberately excluded — do not anchor to it
- Target users: senior technical builders doing agentic work. These are people who know their craft but are outpaced by how fast the ecosystem moves. Conservatism in recommendations is a feature, not a limitation.
- Rescue use case (mid-build, already stuck) is the easier first sale over planning (upfront). Spec Scaffold handles both with a messaging change only.
