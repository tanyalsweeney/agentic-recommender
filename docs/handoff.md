# Handoff — Agentic Architecture Recommender

## What we accomplished this session

- Completed a thorough spec review pass; identified and resolved numerous gaps, stale references, and ambiguities
- Resolved manifest refresh cadence: tier-based model with dashboard-configurable thresholds; hardcoded values removed throughout
- Resolved pricing and access tiers; clarified that Pass 1 pipeline runs only after user confirms intake and clicks Analyze — nothing expensive executes during intake or on the review screen; Pass 2 never runs automatically
- Resolved free tier render-time gating: full pipeline always runs regardless of tier; gating is a presentation decision, not a computation decision
- Removed future paid tier (generated implementation code) — working premise is multi-tenancy/white-label consultancy as the next revenue layer
- Resolved CV result cache: global cache keyed by tool + version + timestamp, configurable TTL (default 24h), built from day 1; cross-tool compatibility checks always re-run
- Added CV cache TTL to admin configuration dashboard settings
- Added Spec Scaffold optional description wizard at the intake description step
- Resolved Wave 1 agent distinctness: all four agents kept separate; Orchestration and T&I use different reasoning frameworks despite surface overlap
- Resolved Failure & Observability scope: agentic slice only, consistent with Security; explicitly flags where traditional approaches need adaptation
- Added plain-language scope statement to Pass 1 executive summary: agentic architecture only; traditional concerns assumed; surprises flagged explicitly
- Moved hard constraints to description step (collected before inference runs); removed as standalone intake step
- Added fully editable review screen as final step before submission with downstream dependency confirmation and re-inference messaging
- Added multi-tenancy config data model and resolution pattern to settled decisions
- Resolved per-tenant manifest config: owner-identifier pattern and tenant-override-first resolution built from day 1
- Added Wave 0 domain agent extension point with typed constraint brief interface
- Added admin configuration dashboard with all tunable parameters exposed at runtime
- Added agent version panel with rollback capability
- Added org list approval workflow, active holds management, manifest health, pipeline observability, conversion metrics, and billing/margin visibility to admin dashboard
- Closed both Wave 1 agent pipeline open questions (distinctness and F&O scope)
- Tightened render-time gating rationale and pipeline execution sequence throughout

## Key decisions made this session

- **Pass 1 pipeline runs only after Analyze is clicked.** Nothing expensive executes during intake or on the review screen. The expensive iteration pattern (20+ re-runs) happens between full Analyze submissions, not within the intake flow.
- **Full pipeline always runs; tier determines what is rendered.** Free tier users get the same quality of underlying analysis as paying users. Gating is a presentation decision only — this keeps the architecture simple and the free tier output trustworthy.
- **Pass 2 never runs automatically.** It is always user-initiated and paid separately.
- **Future paid tier removed.** Generated implementation code is out of scope. Multi-tenancy / white-label consultancy is the next revenue layer.
- **CV result cache is global and built from day 1.** Keyed by tool + version + timestamp; configurable TTL (default 24h). First run within the TTL window pays the search cost; all subsequent runs retrieve cached data. Cross-tool compatibility checks always re-run.
- **All configurable thresholds reference the admin dashboard.** No hardcoded values remain in the spec body.
- **Hard constraints collected at description step, before inference.** Intake agent excludes non-viable options from the start rather than surfacing them for the user to reject.
- **Review screen is fully editable.** Changes that invalidate downstream selections trigger explicit re-inference confirmation specifying what will be re-inferred.
- **Wave 1 agents: all four kept separate.** Merging Orchestration and T&I would produce shallower output for an audience that notices wrong recommendations.
- **Failure & Observability scoped to agentic slice only.** Explicitly flags intersections where traditional approaches need adaptation. Consistent with Security scoping.
- **Scope statement in Pass 1 output.** Product is honest about what it covers and explicitly flags where traditional engineering knowledge may lead the builder astray.
- **Spec Scaffold** added as optional description wizard at intake; fill-in-the-blanks output populates description field as editable prose.

## What's immediately next

1. **User completes consistency review pass** — reviewing spec for internal consistency after today's changes
2. **Simplification pass** — eliminate unnecessary complexity; target the lightest system that produces high-quality results
3. **Resolve manifest data structure and query pattern** — full load, filtered lookup, or embedding search; last remaining open spec question; blocks CLAUDE.md
4. **Write CLAUDE.md** — architectural guardrails for Claude
5. **Curate manifest seed list** — can proceed in parallel with CLAUDE.md

## Open questions (remaining)

- What is the manifest's data structure and query pattern — full load, filtered lookup, or embedding search?

## Collaboration notes

- Read docs/spec.md in full at the start of the next session before doing anything else
- Commit and push only when the user explicitly asks
- User is growing as an agentic engineer and architect — give honest pushback, not generous credit
- User reasons well from first principles but sometimes doesn't trust her own reasoning — push her to articulate the framework behind her instincts, not just validate the conclusion
- User has strong UX instincts rooted in React engineering background — these are reliable and worth taking seriously
- User responds well to "show value early, minimize friction" as a design principle — use it to evaluate future UX decisions
- The old codebase exists but we are deliberately not looking at it — don't anchor to the old system
- Target user is confirmed as senior technical builders. Conservatism in recommendations is a feature for this audience, not a limitation.
- User is publishing a LinkedIn newsletter (~8 chapters) documenting this build. Newsletter drafts live at ~/Desktop/blog entries/ — kept outside the repo intentionally. Claude.ai handles newsletter drafting; Claude Code handles spec work.
- User follows general-audience AI news, not deep technical press — frame deep-cut tooling references accordingly
- Simplification pass is next after consistency review — hold that lens throughout; the goal is the lightest system that produces high-quality results
