# Agentic Architecture Recommender

A guided system that takes a description of what you're building and produces a validated architecture recommendation for agentic AI systems, including orchestration pattern, tool selection, memory strategy, security posture, and cost estimates.

The system walks users through a structured intake flow, infers architecture decisions from their description, and hands verified context to a panel of specialist agents. Output is produced in two passes: a decision-layer summary for stakeholders, and a full implementation layer for builders.

**Scope:** This covers agentic architecture only, the decisions unique to systems where AI agents reason, act, and coordinate. Traditional software concerns (hosting, deployment, databases, CI/CD) are out of scope. Where traditional practices need to be adapted for agents rather than applied as-is, the system flags those intersections explicitly.

**This project is in active design.** The spec is a living document. What's here reflects the thinking, not the finished build.

## What's in this repo

- `docs/spec.md` — product and architecture specification, updated as decisions are made
- `docs/handoff.md` — running context document maintained across development sessions
- `/design diagrams` — architecture diagrams, current and prior versions

## Status

Design phase. Core architecture decisions are being finalized before implementation begins.

---

*Following the build? I'm documenting the design decisions as a LinkedIn series — link coming soon.*
