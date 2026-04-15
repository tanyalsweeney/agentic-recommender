# Handoff — Agentic Architecture Recommender

## What we accomplished this session

- Resolved practitioner governance: agents maintain a tiered list of AI-forward companies scored by AI-depth signals (engineering publications, open-source tooling, platform offerings), refreshed on cadence
- Resolved step-level inference architecture: single stateful agent, sequential reasoning across all 11 steps
- Resolved Skeptic termination conditions: threshold-based early exit across 6 dimensions, 4-cycle hard cap, caveat tier taxonomy (Advisory / Blocking Condition / Do Not Build This), no human escalation
- Resolved Skeptic interaction model: Skeptic sends detailed reasoning back to relevant agents; agents either adopt or counter with reasoned override (cost, latency, attack surface, etc.); Skeptic evaluates counter-arguments; accepted overrides feed ADRs
- Resolved Pass 2 architecture: dedicated synthesis agents (one per recommendation domain), not a re-run of the wave model
- Resolved Pass 2 information flow: synthesis agents receive raw outputs from all waves + verified intake context; rendered Pass 1 document is a human artifact, not a pipeline input; Compatibility Validator output is shared input to all synthesis agents
- Resolved Manifest Gatekeeper termination conditions: accept / reject / schema-escalate; 2-cycle cap; rejected entries dropped with no queue
- Resolved refresh pipeline: on-demand lazy trigger, daily staleness threshold for AI tooling, background refresh on UI open, blocks only if user submits before refresh completes
- Resolved user-scoped tools: run-scoped, live-researched by agents, flagged as unvetted in Pass 1 output
- Resolved pattern maturity surfacing: per-tool maturity labels in validated tool manifest (Established / Emerging / Experimental / User-specified); executive summary flags if any non-established components are present

## Key decisions made this session

- **Practitioner governance is company-list-based.** Agents maintain a tiered list of AI-forward organizations scored by AI-depth signals. The goal is patterns accepted by the industry — well-documented, well-supported, not likely to deprecate soon. Conservatism is a feature for the target user.
- **Intake inference is a single stateful agent.** Sequential reasoning across steps handles inter-step dependencies naturally. 85% accuracy bar does not justify per-step specialist agents. Users correct any wrong inference with a single click.
- **The Skeptic does not escalate to humans.** Ships with a caveat tier at cycle cap. Caveat tiers: Advisory, Blocking Condition, Do Not Build This. "Do Not Build This" means the recommended architecture, not the user's goal — prompts description refinement and re-run.
- **The Skeptic debate generates ADR content.** Accepted override reasoning feeds directly into Pass 2 ADRs. Not a side effect — a design constraint on how the Skeptic is prompted.
- **Pass 2 uses dedicated synthesis agents, 1:1 with recommendation domains.** Orchestration, Security, Memory & State, Tool & Integration, Trust & Control, Failure & Observability. Compatibility Validator output is shared input to all six, not a synthesis domain.
- **Manifest refresh is lazy and on-demand.** No scheduled cron. Staleness check on UI open, background refresh if needed, blocks only if user submits before refresh completes. Daily threshold for AI tooling.
- **Pattern maturity labels are manifest-derived.** Agents do not editorialize on maturity — they pass through what the manifest says. Keeps labeling consistent with governance.

## Pass 2 synthesis agent structure

| Synthesis Agent | Expands |
|---|---|
| Orchestration synthesis | Orchestration agent output |
| Security synthesis | Security agent output |
| Memory & State synthesis | Memory & State agent output |
| Tool & Integration synthesis | Tool & Integration agent output |
| Trust & Control synthesis | Trust & Control agent output |
| Failure & Observability synthesis | Failure & Observability agent output |

Compatibility Validator output feeds all six as shared input.

## Skeptic caveat tiers

| Tier | Label | Meaning |
|---|---|---|
| 1 | Advisory | Concern noted, doesn't block |
| 2 | Blocking Condition | Specific condition must be met before building |
| 3 | Do Not Build This | Fundamental problem — prompts user to refine and re-run |

## What's immediately next

1. **Define manifest data structure and query pattern** — full load, filtered lookup, or embedding search
2. **Define confidence thresholds** — specific values for graduation and demotion in staged inclusion
3. **Update spec with practitioner governance resolution** — tiered org list, AI-depth signals, agent-maintained on cadence
4. **Write CLAUDE.md** — architectural guardrails for Claude, spec feels close to solid

## Open questions (remaining)

- What is the manifest's data structure and query pattern?
- Who are the recognized practitioners and organizations (needs its own governance — tiered org list approach agreed in principle, details TBD)?
- What are the specific confidence thresholds for graduation and demotion?

## Collaboration notes

- Read docs/spec.md in full at the start of the next session before doing anything else
- User is growing as an agentic engineer and architect — give honest pushback, not generous credit
- User reasons well from first principles but sometimes doesn't trust her own reasoning — push her to articulate the framework behind her instincts, not just validate the conclusion
- User has strong UX instincts rooted in React engineering background — these are reliable and worth taking seriously
- User responds well to "show value early, minimize friction" as a design principle — use it to evaluate future UX decisions
- The old codebase exists but we are deliberately not looking at it — don't anchor to the old system
- Target user is confirmed as senior technical builders. Conservatism in recommendations is a feature for this audience, not a limitation.
