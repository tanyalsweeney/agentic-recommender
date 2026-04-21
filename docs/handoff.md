# Handoff — Agentic Architecture Recommender

## What we accomplished this session

- Reviewed spec and handoff from session 3; identified stale open questions and missing decisions; updated spec throughout session
- Resolved confidence tier bands (were in handoff but missing from spec): Established (≥7), Emerging (4–6), Experimental (1–3); drop at 0 on next refresh — now written into spec
- Resolved manifest refresh cadence: replaced flat daily cadence with tier-based model (Tier 1 tools: 2-week lazy trigger; architecture patterns: 4-week lazy trigger; Tier 2/3: on-demand when referenced by a run)
- Resolved pricing and access tiers: free (exec summary + tool list with maturity labels + blurred CV values, 3 runs/day limit disclosed before first run) / Pass 1 $49 / Pass 2 $199
- Resolved CV output on free tier: category titles visible, values blurred — user sees what was found, must pay to read it; blur appears after first run, not before
- Resolved Wave 0 domain agent extension point: runs before Wave 1 when domain agents are registered; produces typed constraint brief (required controls, prohibited patterns, mandatory certifications); tenant-registered via standardized interface; multiple domain agents can be active on one run
- Resolved domain context intake step (step 0): conditional, only surfaces when domain agents are registered for the tenant; suppressed in the general-purpose product
- Resolved admin configuration dashboard: all refresh thresholds, confidence tier thresholds, and cycle caps are runtime-configurable without a deploy; includes agent version panel with rollback capability
- Resolved org list approval workflow UI: pending modifications queue, admin nominations (admin nominates by name; Gatekeeper runs research and routes through normal queue), current org list browsable with on-demand challenge
- Resolved active holds dashboard: admin-level holds with resolution workflow; user hold aggregate signal with configurable threshold (default: 3 users)
- Resolved manifest health panel: entry counts by tier, pending Gatekeeper reviews, dropped entries, staleness status; supports date filtering
- Resolved pipeline observability: time-filtered views; run volume, health, per-agent failure rates; duration distribution (p5/p25/p50/p75/p95); per-run cost breakdown with per-agent input/output/cached token split and web search costs as a separate line item
- Resolved conversion metrics: unique-user funnel, Pass 1 run distribution, conversion rate by run bucket, time-to-conversion, abandonment point, caveat tier correlation; future metrics (intake correction rate, intake selection correlation, return visit rate, domain correlation) noted with rationale for deferral
- Resolved billing and margin visibility: cost per pricing tier, API spend trend, revenue by tier, margin per tier
- Resolved multi-tenancy: deferred to future feature; design note in spec confirms existing governance model maps directly to multi-tenant without rearchitecting; `tenant_id` field from day one
- Cleaned up stale open questions in spec (org list governance, seed list dependency — both resolved in session 3)

## Key decisions made this session

- **Manifest refresh cadence is tier-based, not flat.** CV does live search per run for version/CVE/pricing — manifest staleness only affects intake options and confidence score freshness, not compatibility accuracy. This justifies a longer cadence.
- **Pricing is per-run, not subscription.** Use is episodic. Free tier is rate-limited at 3 runs/day, disclosed before first run. $49 for Pass 1, $199 for Pass 2.
- **Blurred CV values are the conversion mechanism.** Category titles visible on the free tier so the user sees what was found; values blurred. Stronger pull than a generic paywall because the user knows exactly what they're missing.
- **Wave 0 is the extension point for domain-specific expertise.** Domain agents produce constraints, not recommendations. Wave 0 narrows the solution space before Wave 1 reasons into it. Downstream agents receive the constraint brief as additional context — no modification to existing agents required.
- **Admin dashboard exposes all tunable parameters at runtime.** Refresh thresholds, confidence bands, cycle caps, user hold threshold — all configurable without a deploy. Agent prompts are NOT editable in the dashboard; changes go through version control + deploy. Dashboard shows active version and supports rollback.
- **Conversion rate is measured by unique users, not runs.** Users iterate through multiple Pass 1 runs before converting; run-based conversion would undercount. Three views: funnel, Pass 1 run distribution, and conversion rate by run bucket (the key signal: are high-iteration users engaged converters or stuck non-converters?).
- **Web search costs are a separate line item in observability.** CV's live searches don't appear in token counts; burying them in CV agent cost obscures the cost driver.
- **Cached token split is load-bearing in cost observability.** If prompt cache hit rate degrades, costs spike with no obvious signal at the wave level. Input/output/cached split per agent surfaces this directly.

## What's immediately next

1. **Resolve manifest data structure and query pattern** — full load, filtered lookup, or embedding search; last remaining open spec question; blocks CLAUDE.md
2. **Write CLAUDE.md** — architectural guardrails for Claude; spec is solid once manifest query pattern is resolved
3. **Curate manifest seed list** — org list resolved; initial population can proceed in parallel with CLAUDE.md

## Open questions (remaining)

- What is the manifest's data structure and query pattern — full load, filtered lookup, or embedding search?

## Collaboration notes

- Read docs/spec.md in full at the start of the next session before doing anything else
- User is growing as an agentic engineer and architect — give honest pushback, not generous credit
- User reasons well from first principles but sometimes doesn't trust her own reasoning — push her to articulate the framework behind her instincts, not just validate the conclusion
- User has strong UX instincts rooted in React engineering background — these are reliable and worth taking seriously
- User responds well to "show value early, minimize friction" as a design principle — use it to evaluate future UX decisions
- The old codebase exists but we are deliberately not looking at it — don't anchor to the old system
- Target user is confirmed as senior technical builders. Conservatism in recommendations is a feature for this audience, not a limitation.
- User is publishing a LinkedIn newsletter (~8 chapters) documenting this build. Newsletter drafts live at ~/Desktop/blog entries/ — kept outside the repo intentionally. Claude.ai handles newsletter drafting; Claude Code handles spec work.
- User follows general-audience AI news, not deep technical press — frame deep-cut tooling references accordingly
