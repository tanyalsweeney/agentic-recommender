# Handoff — Agentic Architecture Recommender

## What we accomplished this session

- Closed all 20 original checklist items from the previous handoff
- Added fitness-to-purpose framing as the system's opening paragraph and guiding principle
- Added F&O and T&C contributions explicitly to the Pass 1 output Contains list
- Specified domain brief merging rules and conflict detection in Wave 0
- Added Domain Conflict Resolution as a conditional cooperative step (CV detects, agents resolve, 1-cycle cap)
- Decomposed CV into independently checkpointable sub-tasks; added user-scoped tools section and documentation links per tool
- Specified two-tier checkpointing: transient (within-run retry) and persistent (cross-run reuse)
- Added pipeline failure handling with a failure escalation table and cross-run checkpoint reuse validity conditions
- Defined Skeptic early exit threshold (no concerns at or above Advisory tier 1)
- Added constraint classification to intake: binary exclusion vs. optimization target; exhaustion handling for all-binary-exclusion scenarios
- Added three-state step model to intake: high confidence, low confidence, not applicable
- Fixed org list second-pass inconsistency: queue view and full review screen coexist
- Added free tier abuse prevention: email verification on signup and per-IP rate limiting on account creation
- Added unusual usage pattern signals to pipeline observability section
- Added manifest refresh failure handling with retry logic, max staleness threshold, and silent-proceed-within-tolerance behavior
- Fixed admin config table: Emerging band added (derived, read-only), Experimental/Drop overlap resolved, max staleness threshold added
- Added export and sharing sections for Pass 1 and Pass 2 output
- Added org list seed list bootstrapping note
- Added session expiry handling section
- Removed "Resolved: agent scope" from pipeline section; converted to two Settled Decisions rows
- Rewrote agent pipeline guiding principle around fitness-to-purpose north star
- Terminology fix: "collapsible" updated to "expandable" throughout

## Key decisions made this session

- **Fitness-to-purpose as north star.** Technical correctness and compatibility are necessary but not sufficient. A recommendation that doesn't fit the user's specific system is a failure. This now opens the spec and drives the pipeline guiding principle.
- **Domain Conflict Resolution is agent-led.** CV detects constraint violations as part of its existing cross-agent conflict checks. CV does not research or attempt resolution. The relevant agents cooperatively resolve; 1-cycle cap; unresolvable mutual exclusions (e.g., strict GDPR data residency + cloud-native tool that violates it) pass to The Skeptic flagged for resolution.
- **Two-tier checkpointing.** Transient checkpoints live in-memory for the current run (retry without re-running completed agents). Persistent checkpoints store per-agent structured output to durable storage, keyed by intake hash. Cross-run reuse is valid when intake hasn't changed in ways that would invalidate a prior agent's conclusions. Failed runs are not stored at the run level but per-agent outputs can be reused if valid.
- **CV decomposed into sub-tasks.** Per-tool compatibility, cross-tool compatibility, cross-agent constraint aggregation, and cost aggregation are independently checkpointable. Allows partial CV reuse on re-runs.
- **Binary exclusion vs. optimization target.** Two distinct constraint types. Binary exclusions eliminate options entirely (e.g., "must be open source"). Optimization targets rank options (e.g., "prefer lower cost"). If all options are eliminated by binary exclusions before a category is resolved, the system surfaces the conflict and asks the user to relax a constraint.
- **Three-state intake step model.** Steps can be high confidence (pre-populated, user confirms), low confidence (options shown with expandable more info, no auto-selection), or not applicable (step skipped with a note explaining why).
- **Shareability.** Pass 1: view-only link, no account required, always shows the owner's tier output. Pass 2: account required to view, owner controls sharing.
- **Stale manifest within tolerance: silent proceed.** No user notification when the manifest is stale but within the max staleness threshold. Staleness within tolerance doesn't affect output quality or user cost. Admin is notified; user is not.
- **Session expiry during long pipeline runs.** Pipeline execution is server-side and continues regardless of session state. User receives an email notification with a link back to results when the run completes.

## Checklist status

All 20 original checklist items closed. All additional items identified this session closed.

## What's immediately next

1. **Token reduction pass on spec.md** — full pass looking for opportunities to reduce token use without losing fidelity. Started this session but interrupted; not yet complete.
2. **Resolve manifest data structure and query pattern** — full load, filtered lookup, or embedding search; last remaining open spec question; blocks CLAUDE.md.
3. **Write CLAUDE.md** — architectural guardrails for Claude.
4. **Curate manifest seed list** — can proceed in parallel with CLAUDE.md.

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
- User's husband (an award-winning data scientist at Microsoft) raised a brownfield/GitHub integration idea this session — briefly explored, then deliberately abandoned. Out of scope for now; not worth spec space until the current build is shippable.
