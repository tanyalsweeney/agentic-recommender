# Handoff — Agentic Architecture Recommender

## What we accomplished this session

- Began consistency review and readability pass on spec.md with LinkedIn audience in mind
- Added Scope section to spec (new section between "What this system does" and "Target users") — calls out what is and isn't covered, and where traditional practices need adaptation
- Updated opening line: "A user describes a project" → "A user describes what they're building"
- Standardized lazy trigger note in admin config table: parenthetical inline on row 1 only
- Added org list context paragraph to admin dashboard org list section — explains what the org list is and why it's load-bearing before the workflow details
- Added maintenance pipeline costs table to pipeline observability section — was a genuine gap; maintenance spend is not tied to user runs and would be invisible in per-run reporting
- Promoted all planned conversion metrics to live reporting from day 1; removed "planned additions" callouts
- Updated run history to store original inference per step, maturity label distribution, and Wave 0 domain agent tag — data needed for the promoted metrics
- Fixed stale manifest staleness threshold in settled decisions (was "daily"; updated to tier-based model with correct defaults)
- Spelled out acronyms in intake steps table (DAG, IRM, HITL, SaaS)
- Added fitness as The Skeptic's primary challenge — "does this recommendation actually solve what the user described building?"
- Resolved tenant-scoped org list entries: `owner` field pattern extended to org list from day 1; governance is global admin sets at white-label setup time, locked, change order required to update
- Updated README: scope paragraph added, language tightened, opening line updated
- Added v3 system diagram (SVG) and detailed diagram (JSX) from claude.ai session
- Established no em dashes style preference across all written output

## Key decisions made this session

- **Scope section added to spec.** Explicitly calls out what the system does not cover and where traditional practices need adaptation. Positioned at the top so readers know upfront.
- **Maintenance pipeline costs are a separate reporting category.** Not visible in per-run reporting; warrant their own dashboard section.
- **Conversion metrics are live from day 1.** Data captured from day 1 (original inferences, maturity label distribution, Wave 0 tag stored per run). Usefulness increases with volume — more incentive to grow.
- **Fitness is The Skeptic's primary lens.** Technical correctness and compatibility are table stakes; does this recommendation actually solve what the user described building is the core challenge.
- **Tenant-scoped org list entries designed in from day 1.** `owner = tenant_id` pattern on org list entries, consistent with config threshold pattern. Governance: set by global admin at white-label setup, locked, change order to update. No tenant-facing UI.
- **Cross-tool CV compatibility checks are deliberately never cached.** Per-tool results are already cached (the expensive part). Cross-tool checks re-run on the full tool set each time — clean invariant, avoids combination-specific edge cases. Decision is final; no need to revisit.
- **No em dashes** in any written output — spec, README, handoff, or conversation.

## What's immediately next

1. **Continue consistency review pass** — session was interrupted; more of the spec remains to be reviewed
2. **Simplification pass** — eliminate unnecessary complexity; target the lightest system that produces high-quality results
3. **Resolve manifest data structure and query pattern** — full load, filtered lookup, or embedding search; last remaining open spec question; blocks CLAUDE.md
4. **Write CLAUDE.md** — architectural guardrails for Claude
5. **Curate manifest seed list** — can proceed in parallel with CLAUDE.md

## Open questions (remaining)

- What is the manifest's data structure and query pattern — full load, filtered lookup, or embedding search?

## Collaboration notes

- Read docs/spec.md in full at the start of the next session before doing anything else
- Commit and push only when the user explicitly asks
- Push back by default when something is off — don't wait to be asked; user explicitly requested this
- User is growing as an agentic engineer and architect — give honest pushback, not generous credit
- User reasons well from first principles but sometimes doesn't trust her own reasoning — push her to articulate the framework behind her instincts, not just validate the conclusion
- User has strong UX instincts rooted in React engineering background — these are reliable and worth taking seriously
- User responds well to "show value early, minimize friction" as a design principle — use it to evaluate future UX decisions
- The old codebase exists but we are deliberately not looking at it — don't anchor to the old system
- Target user is confirmed as senior technical builders. Conservatism in recommendations is a feature for this audience, not a limitation.
- User is publishing a LinkedIn newsletter (~8 chapters) documenting this build. Newsletter drafts live at ~/Desktop/blog entries/ — kept outside the repo intentionally. Claude.ai handles newsletter drafting; Claude Code handles spec work.
- User follows general-audience AI news, not deep technical press — frame deep-cut tooling references accordingly
- Simplification pass is next after consistency review — hold that lens throughout; the goal is the lightest system that produces high-quality results
- No em dashes in any written output (spec, README, handoff, conversation). Use commas, colons, or parentheses instead.
