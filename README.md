# Agentic Architecture Recommender

A guided system that takes a description of what you're building and produces a validated architecture recommendation for agentic AI systems: orchestration pattern, tool selection, memory strategy, security posture, and cost estimates.

The system walks users through a structured intake flow, infers architecture decisions from their description, and hands verified context to a panel of specialist agents. A multi-wave debate protocol challenges every recommendation before output is produced. Output comes in two passes: a decision-layer summary for stakeholders, and a full implementation layer for builders.

**Scope:** Agentic architecture only (the decisions unique to systems where AI agents reason, act, and coordinate). Traditional software concerns (hosting, deployment, databases, CI/CD) are out of scope. Where traditional practices need to be adapted for agents rather than applied as-is, the system flags those intersections explicitly.

## What's in this repo

- [spec.md](spec.md): full product and architecture specification, including all settled decisions
- [PLAN.md](PLAN.md): phased build sequence with TDD approach
- [TODOS.md](TODOS.md): deferred work with context and priority
- [CLAUDE.md](CLAUDE.md): development guidelines and architectural guardrails
- [docs/handoff.md](docs/handoff.md): running context document maintained across sessions
- [design diagrams/](design%20diagrams/): architecture diagrams

## Architecture

**Tech stack:** TypeScript monorepo: Next.js (frontend), BullMQ + Redis (pipeline job queue), PostgreSQL (all persistent data), multi-provider LLM layer (Anthropic by default; OpenAI-compatible providers supported via registry for per-agent routing).

**Pipeline:** Multi-wave agent system. Wave 1 runs four specialist agents in parallel (Orchestration, Security, Memory & State, Tool & Integration). Wave 2 is a cooperative exchange between Failure & Observability and Trust & Control. Wave 2.5 runs the Compatibility Validator: per-tool research for version, CVE, pricing, and license data, plus first-principles compatibility analysis — the manifest provides facts and minimum requirements as a floor, the CV derives compatibility conclusions from the specific architecture. Wave 3 is The Skeptic, which challenges the full recommendation set before output ships.

**Output:** Pass 1 is a decision-layer document written for two simultaneous audiences: executives deciding whether to approve funding and headcount, and engineers evaluating whether Pass 2 ADRs would add value for their specific situation. Pass 2 is a full implementation layer (ADRs, configuration, specs) generated on user request.

**Pricing:** Free (3 runs/day, blurred CV detail), Run Pack ($9 / 5 additional runs), Pass 1 ($49/run, full output), Pass 2 ($199/run).

## Status

**Active development.** Design complete, agent layer complete, pipeline workers next.

| Phase | Description | Status |
|---|---|---|
| 0 | Monorepo scaffolding (pnpm workspaces, TypeScript, Vitest) | Done |
| 1 | Database schema — 12 tables, config resolution | Done |
| 2 | Agent layer — Zod schemas, multi-provider callers, prompt caching, full prompt review | Done |
| 3 | Pipeline workers — BullMQ wave orchestration, checkpointing | Next |
| 4 | Web frontend — Next.js intake flow, Pass 1 output rendering | Upcoming |
| 5 | Admin dashboard, progressive CV disclosure, email notifications | Upcoming |
| 6 | Maintenance pipeline — manifest refresh, Org List Gatekeeper | Upcoming |

**Local dev:** requires Docker Desktop. Run `docker compose up -d` to start Postgres and Redis.

---

*Following the build? I'm documenting the design decisions as a LinkedIn series:
[Why I Scrapped Two Months of Work](https://www.linkedin.com/pulse/why-i-scrapped-two-months-work-tanya-sweeney-c90jc/) |
[Before the Agents Run](https://www.linkedin.com/pulse/before-agents-run-tanya-sweeney-y2ayc/)*
