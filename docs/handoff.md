# Handoff — Agentic Architecture Recommender

## Current state (2026-04-28)

Implementation underway. Phases 0, 1, and Phase 2 (a, b, c) complete and on main.

**What's built:**
- Monorepo scaffolded: pnpm workspaces, TypeScript, Vitest workspace
- Database schema: 12 tables, 4 indexes, migrations applied, config resolution tested
- Agent layer: 10 Zod output schemas, 12 eval cases, 10 Anthropic SDK callers with 3-layer prompt caching
- Prompt templates for all 10 agents
- Agent version registry (YYYY-MM-DD-{sha256_8chars} of prompt file)
- `implementationTripHazards` added as first-class structured output to all 6 recommendation agents
- Orchestration pattern gotchas moved to manifest data (`pattern_meta` jsonb on `manifest_entries`)
- Intake schema: `contradictions`, `impliedRequirements`, `descriptionQualityNote` added
- 30 unit tests passing

**Local dev:** Docker running (Postgres :5432, Redis :6379). `.env.local` complete.

## What's immediately next

**Prompt review pass — in progress.** Intake and orchestration prompts improved. Security, Memory & State, Tool & Integration, Failure & Observability, Trust & Control, Skeptic, and Technical Writer prompts still need review.

**Critical context for next session:** The user's standard for agent rigor is that each agent should reason like the world's best engineer in their domain, surfacing issues the user and their cohort would miss. This means: derive hazards from the specific architecture by first principles; use the manifest as a sanity-check floor, not a ceiling. The trip hazard directives added this session gesture at this but were judged too weak. The next session should address this directly before continuing the prompt review.

**Security prompt is next.** Key directives to add:
- Enterprise signal detection: calibrate toward established, certified tools when enterprise context is present (platform, data sensitivity, audit trail requirements, brownfield, semi-autonomous or lower autonomy)
- Conservative posture: when uncertain, rate risk higher; prefer coverage over novelty
- High-friction tool documentation: document trip hazards extensively; flag that a simpler secondary approach will be in Pass 2 ADRs
- Secondary approach: primary (correct, enterprise-grade) in Pass 1; secondary (good enough, lower friction, explicit tradeoffs) in Pass 2 ADRs — uses the existing Pass 1/Pass 2 structure, no new gate needed

**Remaining prompt reviews:** Memory & State, Tool & Integration, Failure & Observability, Trust & Control, Skeptic, Technical Writer.

**After prompt review:** Phase 3 (BullMQ pipeline workers, wave orchestration, checkpoint logic).

## gstack observations

Three gstack review artifacts moved to `gstack-observations/` in the repo:
- `2026-04-26-agent12-spec.md` — CEO plan (scope decisions, vision)
- `tanyaslweeney-main-design-20260427-030650.md` — Office hours design doc
- `tanyaslweeney-tsweeney-process-efficiency-eng-review-test-plan-20260427-002758.md` — Eng review test plan

Consider adding `gstack-observations/` to `.gitignore`.

## Open questions

None on the spec. Prompt review is the current work.

## Collaboration notes

- No em dashes in any written output. Use commas, colons, or parentheses instead.
- Push back by default when something is off. User explicitly requested this.
- User is growing as an agentic engineer and architect. Give honest pushback, not generous credit.
- User has strong UX instincts rooted in React engineering background. Reliable.
- User responds well to "show value early, minimize friction" as a design principle.
- User's standard for agent rigor: each agent should be as good as or better than the best engineer the user could consult in person, surfacing issues the user and their cohort would miss.
- First user: husband (Sr. Data Scientist, Microsoft, award-winning). He explicitly asked for the tool. His team incorporated Pass 1 output into a real project.
- Target users: senior technical builders doing agentic work, outpaced by how fast the ecosystem moves.
- No marketing language in written output.
- User follows general-audience AI news, not deep technical press.
- User is publishing a LinkedIn newsletter documenting this build. Drafts at ~/Desktop/blog entries/. Claude.ai handles newsletter; Claude Code handles implementation.
- Old codebase exists but is deliberately excluded.
