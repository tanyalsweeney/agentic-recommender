# Agentic Architecture Recommender

A guided system that takes a description of what you're building and produces a validated architecture recommendation for agentic AI systems: orchestration pattern, tool selection, memory strategy, security posture, and cost estimates.

The system walks users through a structured intake flow, infers architecture decisions from their description, and hands verified context to a panel of specialist agents. A multi-wave debate protocol challenges every recommendation before output is produced. Output comes in two passes: a decision-layer summary for stakeholders, and a full implementation layer for builders.

**Scope:** Agentic architecture only (the decisions unique to systems where AI agents reason, act, and coordinate). Traditional software concerns (hosting, deployment, databases, CI/CD) are out of scope. Where traditional practices need to be adapted for agents rather than applied as-is, the system flags those intersections explicitly.

## What's in this repo

- [spec.md](spec.md): full product and architecture specification, including all settled decisions
- [TODOS.md](TODOS.md): deferred work with context and priority
- [CLAUDE.md](CLAUDE.md): development guidelines and skill routing
- [docs/handoff.md](docs/handoff.md): running context document maintained across sessions
- [design diagrams/](design%20diagrams/): architecture diagrams

## Architecture

**Tech stack:** TypeScript monorepo: Next.js (frontend), BullMQ + Redis (pipeline job queue), PostgreSQL (all persistent data), Anthropic SDK.

**Pipeline:** Multi-wave agent system. Wave 1 runs four specialist agents in parallel (Orchestration, Security, Memory & State, Tool & Integration). Wave 2 is a cooperative exchange between Failure & Observability and Trust & Control. Wave 2.5 runs the Compatibility Validator: live web research per tool for version, CVE, pricing, and license data. Wave 3 is The Skeptic, which challenges the full recommendation set before output ships.

**Output:** Pass 1 is a decision-layer document for stakeholders (executive summary, architecture diagram, validated tool manifest, cost estimates). Pass 2 is a full implementation layer (ADRs, configuration, specs) generated on user request.

**Pricing:** Free (3 runs/day, blurred CV detail), Run Pack ($9 / 5 additional runs), Pass 1 ($49/run, full output), Pass 2 ($199/run).

## Status

Design complete. Both CEO and engineering plan reviews cleared. Implementation starts with `packages/shared/src/db/schema.ts`.

---

*Following the build? I'm documenting the design decisions as a LinkedIn series — link coming soon.*
