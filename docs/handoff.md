# Handoff — Agentic Architecture Recommender

## What we accomplished this session

- Completed the token reduction pass on spec.md (was the top priority from last session)
- Added per-agent breakdown table to pipeline observability: duration (median + p95), token split (input/output/cached), web search calls, and cycle count per agent
- Updated Cost per run table: web search costs now attributed per agent (CV only) rather than "per run total"
- Created branch tsweeney/process-efficiency for ongoing process efficiency work
- Added .gitignore to exclude .DS_Store
- Added two system design SVGs to design diagrams/
- User reframed "What this system does" as "What Agent12 Does" directly in the spec

## Key decisions made this session

- **Per-agent observability is comprehensive.** The per-agent breakdown table captures everything needed to debug cost and latency: duration (median + p95), full token split, web search calls (CV only), and cycle count for agents that run debate loops. Collapsible in the UI if the volume is too much.
- **Web search costs attributed per agent, not per run.** CV is the only agent in the recommendation pipeline that runs web searches; attribution at the agent level makes this explicit and leaves the door open for future agents that might also search.

## Checklist status

All items from the previous session closed. Token reduction pass complete.

## What's immediately next

1. **Resolve manifest data structure and query pattern** — full load, filtered lookup, or embedding search; last remaining open spec question; blocks CLAUDE.md
2. **Write CLAUDE.md** — architectural guardrails for Claude
3. **Curate manifest seed list** — can proceed in parallel with CLAUDE.md
4. **Continue process efficiency work** — branch tsweeney/process-efficiency is open; not yet merged to main

## Open questions (remaining)

- What is the manifest's data structure and query pattern — full load, filtered lookup, or embedding search?
- Run Pack price (marked $TBD in spec)

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
- Simplification pass is still on the list — hold that lens as remaining spec work continues; the goal is the lightest system that produces high-quality results
- No em dashes in any written output (spec, README, handoff, conversation). Use commas, colons, or parentheses instead. Watch for em dashes when using user-provided text verbatim.
- User's husband (an award-winning data scientist at Microsoft) raised a brownfield/GitHub integration idea in a prior session — briefly explored, then deliberately abandoned. Out of scope for now; not worth spec space until the current build is shippable.
