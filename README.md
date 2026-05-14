# Agentic Architecture Recommender

A guided system that takes a description of what you're building and produces a validated architecture recommendation for agentic AI systems: orchestration pattern, tool selection, memory strategy, security posture, and cost estimates.

The system walks users through a structured intake flow, infers architecture decisions from their description, and hands verified context to a panel of specialist agents. A multi-wave debate protocol challenges every recommendation before output is produced. Output comes in two passes: a decision-layer summary for stakeholders, and a full implementation layer for builders.

**Scope:** Agentic architecture only (the decisions unique to systems where AI agents reason, act, and coordinate). Traditional software concerns (hosting, deployment, databases, CI/CD) are out of scope. Where traditional practices need to be adapted for agents rather than applied as-is, the system flags those intersections explicitly.

## What's in this repo

- [docs/spec.md](docs/spec.md): full product and architecture specification, including all settled decisions
- [docs/PLAN.md](docs/PLAN.md): phased build sequence with TDD approach
- [docs/TODOS.md](docs/TODOS.md): deferred work with context and priority
- [CLAUDE.md](CLAUDE.md): development guidelines and architectural guardrails
- [docs/handoff.md](docs/handoff.md): running context document maintained across sessions
- [docs/design-diagrams/](docs/design-diagrams/): architecture diagrams

## Architecture

**Tech stack:** TypeScript monorepo with Next.js (frontend), BullMQ + Redis (pipeline job queue), and PostgreSQL (all persistent data). A multi-provider LLM layer defaults to Anthropic, with OpenAI-compatible providers supported via a registry for per-agent routing.

**Pipeline:** A multi-wave agent system.

- **Wave 1** runs four specialist agents in parallel: Orchestration, Security, Memory & State, and Tool & Integration.
- **Wave 2** is a cooperative exchange between Failure & Observability and Trust & Control.
- **Wave 2.5** runs the Compatibility Validator, which performs per-tool research on version, CVE, pricing, and license data alongside first-principles compatibility analysis. The manifest provides facts and minimum requirements as a floor; the CV derives compatibility conclusions from the specific architecture.
- **Wave 3** is The Skeptic, which challenges the full recommendation set before output ships.

**Output:** Two passes.

- **Pass 1** is a decision-layer document for executives and engineers evaluating the recommendation.
- **Pass 2** is the implementation layer: a spec doc and plan doc per recommended target system, generated on user request.

**Code-aware intake** (an alternative to text intake): the user's AI assistant (Copilot, Claude Code, Cursor) reads their codebase via MCP and produces a structured digest. The user reviews and refines it on our screen, then the pipeline produces per-target spec+plan deliverables.

**Pricing (provisional, pending production cost data):**

- **Free:** 1 system-paid lifetime trial, then BYOK-required, capped at 3 runs/day, with blurred CV detail
- **Run Pack:** $9 for 5 additional runs
- **Pass 1:** $49/run, full output
- **Pass 2:** $199/run
- **Code-Aware Pass 1:** $49/run (BYOK required)
- **Code-Aware Pass 2:** $199 per spec+plan (BYOK required; customer-selectable subset of the consolidation analysis target set)

## Status

**Active development.** Phases 0-3h plus 3.4, 3.4.5, 3.4.6, 3.5a.1, 3.5a.1.b implementation complete (26 tables, 13 migrations). Code-aware backend (3.5b) design complete for Quality Evaluator (3.5b.1), Pattern & Cluster Analyzer (3.5b.2), and MCP server (3.5b.3, including six-tool surface, Zod tool I/O contract, two-tier idempotency, sliding-TTL draft expiry, authentication mechanics, response-driven iteration); 3.5b.4 through 3.5b.7 are placeholder pending their own design PRs. Remaining pre-UI work is the four backend wiring sub-phases of 3.5a (CV upstream, per-tool data availability, per-entry manifest versioning, correction exchange) plus 3.5b.4-7 design and 3.5b implementation. 258 non-eval tests passing.

| Phase | Description | Status |
|---|---|---|
| 0 | Monorepo scaffolding (pnpm workspaces, TypeScript, Vitest) | Done |
| 1 | Database schema — config resolution + 12 initial tables | Done |
| 2 | Agent layer — 12 agents, Zod schemas, multi-provider callers, prompt caching, eval baselines | Done |
| 3a-3d | Pipeline workers — BullMQ wave orchestration, checkpointing, evals | Done |
| 3e-3f | Maintenance workers, multi-tenancy schema | Done |
| 3g | Streaming in agent caller — resolves TCP timeout on complex responses | Done |
| 3h | CV API integration — GHSA, NVD, PyPI, npm; web search; cross-tool check; correction exchange | Done |
| 3.4 | Static analysis hardening — ESLint, tsconfig strict, GitHub Actions CI | Done |
| 3.4.5 | Schema lock for spec'd tables — code-aware drafts, tenant config, intent gaps | Done |
| 3.4.6 | Schema lock for multi-tenancy data isolation — auth providers, runs.tenant_id (Clerk + WorkOS validated) | Done |
| 3.5a.1 | BYOK runtime wiring — tenant + user scope; resolution chain user → tenant → env | Done |
| 3.5a.2-5 | Backend wiring closure — CV upstream, per-tool data availability, per-entry manifest versioning, correction exchange | Upcoming |
| 3.5b | Code-aware intake backend — Quality Evaluator, Pattern & Cluster Analyzer, MCP server, related pipeline behavior changes | Upcoming, design in progress |
| 4 | Web frontend — intake flow (text + code-aware via MCP), Pass 1 output rendering, auth | Upcoming |
| 5 | Admin dashboard — pipeline observability, agent performance, manifest health, themes, config curation, modification request inbox | Upcoming |
| 6 | Tenant dashboard — run history, BYOK self-service, modification request submission | Upcoming |

**Local dev:** requires Docker Desktop. Run `docker compose up -d` to start Postgres and Redis.

---

*Following the build? I'm documenting the design decisions as a LinkedIn series:
[Why I Scrapped Two Months of Work](https://www.linkedin.com/pulse/why-i-scrapped-two-months-work-tanya-sweeney-c90jc/) |
[Before the Agents Run](https://www.linkedin.com/pulse/before-agents-run-tanya-sweeney-y2ayc/)*
