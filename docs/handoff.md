# Handoff — Agentic Architecture Recommender

## What we accomplished this session

- Full consistency review of spec.md — produced 20 findings organized by severity (inconsistencies, logic gaps, missing aspects)
- Built a prioritized checklist with time and difficulty estimates, ordered mission critical to nice to have
- Closed all 6 mission critical checklist items (details below)
- Added step 11 (Tools) to the intake flow — always surfaces after model confirmation; conditional pre-population based on manifest coverage; one-click add/remove; user-specified tools added here
- Fixed "all options sourced from manifest" overstatement — step 3 (External integrations) is free-text user input, not manifest-driven
- Restructured the agent pipeline waves: Wave 1 fully parallel, Wave 2 cooperative (F&O + T&C), Wave 2.5 CV standalone, Wave 3 The Skeptic
- Added Technical Writer agent as Pass 1 synthesis step — runs after Wave 3; produces the Pass 1 document including the Mermaid architecture diagram; faithfulness constraint prevents editorializing
- Specified architecture diagram format: Mermaid flowchart, direction chosen by Technical Writer based on architecture shape, decision-maker abstraction level, exportable as SVG or PNG
- Added run definition to pricing section — what counts and doesn't count as a run, edge cases covered
- Added Run Pack as a first-class pricing tier — additional free-tier runs for the description iteration phase
- Updated Spec Scaffold: renamed to free, replaced prompt copy with conversion-oriented messaging, added Positioning note, scaffold now remains available throughout the description step (not one-use)

## Key decisions made this session

- **Step 11 (Tools) added to intake.** Always surfaces after model confirmation. Manifest tools filtered by confirmed platform and model. Pre-populated section is conditional on coverage — empty inferred list when manifest is thin, but step always surfaces to preserve user-specified tool capability.
- **Wave restructure.** Wave 1 is now fully parallel (4 agents). F&O and T&C move to Wave 2 as a cooperative exchange: F&O leads with failure mode analysis, T&C incorporates it into gate placement, F&O confirms. 2-cycle cap; unresolved tensions pass to The Skeptic, flagged for resolution. CV is standalone at Wave 2.5, aggregating cost signals from Waves 1 and 2.
- **Wave 2 cooperative rationale.** F&O and T&C have a genuine bidirectional dependency. Cooperative exchange resolves it without forcing a sequential ordering that benefits one agent at the expense of the other. F&O leads because gate placement is a decision that should incorporate failure mode context.
- **Technical Writer added.** Synthesis-to-critique and synthesis-to-document are different tasks. The Skeptic produces validated debate output; the Technical Writer produces the readable document. Keeping them separate prevents the critique lens from coloring the Pass 1 framing. Faithfulness constraint: judgment calls are structural, not substantive.
- **Mermaid flowchart for architecture diagram.** Agent-producible text, renders without image generation, familiar to the target audience, exportable. Direction is the Technical Writer's call based on the architecture shape.
- **Run definition.** A run is one complete pipeline execution that produces Pass 1 output. Pass 2 never counts toward the free tier limit. Failed executions are not runs. Loading a past run's context and re-submitting is a new run.
- **Run Pack added.** Even expert users describing in-flight projects need many iterations to land a quality description (user's husband, an award-winning data scientist at Microsoft, needed ~20 attempts on an in-flight project). The 3/day limit is a cost control mechanism, not a conversion driver. The Run Pack monetizes the iteration phase without requiring premature commitment to Pass 1. Price TBD.
- **Spec Scaffold repositioned.** Recommended first step for all users, not a fallback. The UI should explicitly connect scaffold use to run cost savings. Scaffold remains available throughout the description step.

## Checklist status

Closed this session: #1, #2, #4, #6, #14, #15

Remaining (from original 20-item list — prioritized order):
- **#13** — Pass 1 output spec doesn't explicitly list what F&O and T&C contribute. The Technical Writer has access to all wave outputs and the faithfulness constraint covers it implicitly, but the Pass 1 output section should be updated to name F&O and T&C sections explicitly. Partially addressed; needs a follow-up edit.
- **#8** — Domain agent brief merging on conflict (two domain briefs with contradictory constraints)
- **#7** — Skeptic early exit threshold undefined
- **#17** — Pipeline failure handling (what happens when the product's own agents fail)
- **#9** — Hard constraint exhaustion scenario
- **#3** — Org list second-pass review: queue vs. full review screen inconsistency
- **#11** — Free tier abuse prevention
- **#10** — Low-confidence step handling beyond model preferences
- **#12** — Refresh failure handling
- **#5** — Confidence config table: Emerging band missing, Experimental/Drop overlap
- **#19** — User-scoped tools absent from CV section
- **#16** — Output format and shareability
- **#18** — Org list seed list and Gatekeeper approval flow
- **#20** — Session expiry during long pipeline run
- Structural: move "Resolved: agent scope" section to Settled Decisions

## What's immediately next

1. **Close #13** — update Pass 1 output section to name F&O and T&C contributions explicitly
2. **Work through remaining checklist** — continue in priority order
3. **Resolve manifest data structure and query pattern** — full load, filtered lookup, or embedding search; last remaining open spec question; blocks CLAUDE.md
4. **Write CLAUDE.md** — architectural guardrails for Claude
5. **Curate manifest seed list** — can proceed in parallel with CLAUDE.md

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
