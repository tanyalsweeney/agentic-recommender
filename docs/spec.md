# Agentic Architecture Recommender — Product Spec

## What this system does

A user describes a project. The system walks them through a guided intake flow, inferring their agentic architecture at each step and adapting remaining steps based on prior confirmations. Once intake is complete, verified context is handed to a team of specialist agents that produce a structured recommendation in two passes.

---

## Target users

**Primary:** Senior technical builders (data scientists, engineers) designing or evaluating an agentic system. They want accurate inferences and trustworthy compatibility analysis. They will notice wrong recommendations.

**Secondary (Pass 1 audience):** Executives and decision makers who need directional confidence without implementation detail.

---

## Application layer

*These are traditional web application concerns. They do not affect the agent pipeline.*

### Authentication
- User accounts with MFA
- Login required to access the system

### Run history
- Every completed run is stored per user account
- Stored per run: verified context (intake selections + hard constraints) and Pass 1 output
- Pass 2 output stored only if the user generates it
- Users can browse past runs and review previous recommendations
- Users can load a past run's verified context as a starting point for a new run, modify the description or selections, and re-run from scratch

> Note: Most users will not proceed past Pass 1. Re-runs are typically triggered by reviewing Pass 1 output and wanting to refine the description — not by dissatisfaction with intake inferences.

---

## Intake flow

**Design principle: show value early, minimize friction.** The user sees the system working immediately — inference results presented for confirmation — before being asked to provide anything additional. High-friction asks before value delivery are avoided.

A TurboTax-style guided step flow. The user provides a description and submits. Inference runs once on the description, producing a pre-populated selection for every step. From that point, the system presents one step at a time with:
- A progress / remaining steps indicator
- The inference made at the top of the step, pre-selected
- Available options for that step (all sourced from the maintenance manifest)
- Single-click ability to select a different option if the inference is incorrect

Each step includes a collapsible "more info" section explaining the domain. For steps where inference confidence is low, this section is auto-expanded. For Memory & State specifically, a "help me determine the best option" flow surfaces targeted clarifying questions and recommends based on the answers. The questions and explainer content for all steps live in the maintenance manifest and are updated on the same refresh cadence.

**The step list adapts** based on prior confirmed answers. Model preferences always surfaces. Platform selection (step 2) filters the available options but does not suppress the step. When inference can determine a model, it surfaces pre-populated. When inference confidence is too low, it surfaces with a "Choose for me" default. If the user changes the model selection, available options and pre-selections in the tools step update accordingly.

Reasoning for each step lives in the agent layer. The UI renders and captures; it does not reason.

Nothing that could evolve is hardcoded in the UI. All options at every step are sourced from the maintenance manifest.

Agents receive the full verified context: the original description, all confirmed selections, and any hard constraints. They do not re-infer what the intake flow already established.

### Intake steps

| # | Step | Notes |
|---|---|---|
| 1 | Orchestration pattern | Agent count, structure (orchestrator + subagents, pipeline, DAG, etc.) |
| 2 | Platform & deployment | Constrains model selection and available tooling downstream |
| 3 | External integrations | Systems the agent touches — APIs, databases, SaaS, etc. |
| 4 | Data & file handling | File types, data sensitivity, protection schemes (IRM, classification labels) |
| 5 | Memory & state | Session persistence, shared agent state, memory horizon. Auto-expand explainer; offer guided "help me determine" flow |
| 6 | Autonomy & HITL | Autonomy level, human-in-the-loop requirements |
| 7 | Scale | Run volume, concurrency expectations |
| 8 | Greenfield vs. brownfield | New build, extending existing system, or migration |
| 9 | Failure tolerance | Mission criticality, acceptable failure modes, audit trail requirements |
| 10 | Hard constraints | Non-negotiables that eliminate options entirely (not preferences). Collected last, passed directly to agents — does not affect intake inference |
| 11 | Model preferences | Always surfaces. Platform (step 2) filters available options. Pre-populated with inference if confident, or "Choose for me" if not. Changing selection updates tool options downstream. |


---

## Maintenance manifest

A shared knowledge store that agents read from at query time. Kept current by a scheduled refresh pipeline that runs separately from the recommendation pipeline.

All options surfaced in the intake UI are sourced from the manifest. The manifest is the single source of truth for available options across all steps.

**Refresh cadence:** Lazy and on-demand — refresh only runs when the tool is accessed. Staleness is checked on UI open; stale entries are refreshed in the background before the run proceeds.
- Vendor-specific cloud offerings and tooling: daily
- Architecture patterns: every 2 weeks

**Agents both consume and maintain the manifest.** To prevent drift, a Manifest Gatekeeper reviews all proposed updates before they go live.

### Conflict resolution between proposing agent and Manifest Gatekeeper
- Agents attempt to resolve conflicts between themselves
- Human escalation is rare and reserved for specific cases (see below)

### Types of disagreement and handling
| Type | Description | Resolution |
|---|---|---|
| Factual | Is this true? Is this compatible? | Agent goes and looks it up. Low escalation risk. |
| Recency | Is this current? Has this been deprecated? | Agent goes to the source. Low escalation risk. |
| Categorization | Does this belong here? Does a new category belong? | Agents reason about taxonomy. Escalate if schema change required. |
| Quality / relevance | Is this mature enough to include? | Confidence scoring + staged inclusion (see below). Higher escalation risk. |
| Schema | Does this update require changing the manifest structure? | **Automatic human escalation. Agents do not resolve autonomously.** |

### Confidence scoring and staged inclusion
New entries are scored using source weighting and move through staged inclusion based on score.

**Primary confidence signals (carry the most weight):**
- Adoption by recognized practitioners and organizations (leading indicator, hard to fake)
- Time without contradicting evidence (stability signal)

**Secondary signals (contribute but with lower weight):**
- Additional citations from credible sources
- Contradiction by a newer pattern from a high-weight source (strong negative signal)

**Staged inclusion:**
- New entries enter probationary state — present in manifest but not surfaced as default recommendations
- Graduate to full inclusion when confidence crosses threshold
- Drop to flagged/experimental if confidence declines

### Open questions
- What is the manifest's data structure and query pattern — full load, filtered lookup, or embedding search?
- Who are the recognized practitioners and organizations? This is itself a list that needs governance.
- What are the specific confidence thresholds for graduation and demotion?

---

## Agent pipeline

### Guiding principle
Agents focus on agentic-specific concerns. Traditional software architecture concerns (APIs, databases, auth, deployment infrastructure) are out of scope for the agent layer.

### Wave 1 — Mostly parallel
Orchestration, Security, Memory & State, and Tool & Integration run in parallel on the verified context. Trust & Control runs after Orchestration and Security complete — it cannot place gates without knowing the flow and risk profile. All Wave 1 agents produce domain recommendations **plus structured cost signals** for their area. Cost signals feed into the Compatibility Validator in Wave 2.

| Agent | Agentic focus |
|---|---|
| Orchestration | Recommends the right coordination pattern for this system — pipeline, DAG, supervisor, event-driven, etc. |
| Security | Agentic-specific attack surface: prompt injection, tool misuse, excessive autonomy, trust boundary definition, data exfiltration through reasoning. Traditional security checklist is out of scope. |
| Memory & State | Persistence strategy, shared state design, memory pattern selection. Note: users frequently don't know if they need memory or state — the intake step for this domain needs more explanatory scaffolding than others, and the agent should surface its reasoning explicitly rather than just its conclusion. |
| Tool & Integration | Reasons about where the tool-vs-agent boundary should be drawn for this user's specific system. Core decision framework: tools for deterministic operations (same input, same output), agents for tasks requiring judgment. Also covers MCP usage and build vs. buy recommendations. Platform-specific tool filtering from the manifest happens within this agent but is not its core value. |

**Trust & Control** *(sequential — runs after Orchestration and Security complete)*
- HITL placement and approval gate design
- Depends on Orchestration (to know the flow) and Security (to know the risk profile) before it can place gates meaningfully
- Autonomy level is captured during intake; this agent determines where and how that level is enforced within the specific architecture

### Wave 2 — Sequential (depends on Wave 1)

**Compatibility Validator**

Runs a fresh web search for every tool and integration point it evaluates. Does not rely on cached manifest data for compatibility checks — versions change, integration issues surface, and patches ship on short cycles.

*Compatibility checks:*
- Verifies that recommended tools and versions are mutually compatible across all meaningful tool pairs and integration points
- Checks LLM SDK version against orchestration framework, memory/vector store against embedding model API, agent framework against tool execution runtime, and model constraints against platform deployment target
- Collects current pricing and tier data from vendor pages (already visiting them for version and compatibility research)
- Aggregates cost signals from Wave 1 agents and calculates cost estimates using verified intake context (run volume, concurrency, model selection, usage patterns)

*Per-tool intelligence (captured while already on vendor documentation):*
- End-of-life date for the recommended version
- HIGH and CRITICAL CVEs affecting the recommended version that have not been patched in that version
- Meaningful breaking changes between the recommended version and current stable
- License (SPDX identifier; copyleft licenses flagged for legal review)
- For managed cloud services: availability in the target cloud provider and region — whether specified by the user or recommended by the system

*Cross-agent conflict checks:*
- Constraint violations: checks whether any tool or decision recommended by one Wave 1 agent violates a constraint declared by another (e.g., Security declares no third-party data exfiltration; Tool & Integration recommends a SaaS tool with no on-premises option)
- Integration gaps: verifies that every tool dependency an agent assumes is actually accounted for by some agent in the set
- Version conflicts: where two agents both depend on the same tool, checks that their version requirements are compatible

The CV's full report feeds Pass 1 output directly and is shared input to all six Pass 2 synthesis agents.

**Failure & Observability**
- Eval strategy
- Tracing approach
- Agentic-specific failure mode analysis

### Wave 3 — Final review

**The Skeptic**
- Identifies weak points in Wave 1 + 2 output and sends them back to the relevant agent(s) with detailed reasoning
- Receiving agent(s) either adopt the suggestion or counter with a reasoned override (e.g. cost impact, latency impact, new attack surface introduced, implementation burden)
- The Skeptic evaluates counter-arguments and accepts or rejects them; accepted overrides are surfaced in the output with their tradeoff reasoning
- No human escalation — ships with a caveat tier if unresolved at cycle cap

**Termination conditions:**
- **Early exit:** if all remaining unresolved concerns fall below threshold across every dimension (process time, process cost, implementation effort, security implications, architectural complexity, maintenance burden), The Skeptic accepts and ships — thresholds evaluated relative to verified intake context (scale, run volume, concurrency)
- **Cycle cap:** hard limit of 4 cycles; on cycle 4, any concerns still above threshold are assigned a caveat tier and output ships

**Skeptic caveat tiers (assigned at cycle cap):**
| Tier | Label | Meaning |
|---|---|---|
| 1 | Advisory | Concern noted, doesn't block. User should be aware. |
| 2 | Blocking Condition | Specific condition must be met before building. Solvable, but not yet solved. |
| 3 | Do Not Build This | Fundamental problem — hard constraint violation, irreconcilable incompatibility, architectural dead end. Prompts user to refine description and re-run. |

> Note: The Skeptic debate protocol generates tradeoff documentation as a side effect — accepted overrides and their reasoning feed directly into Pass 2 ADRs.

### Open questions
- Do all four Wave 1 agents bring sufficiently distinct reasoning? Still need to work through: Orchestration, Memory & State, Tool & Integration, Security.
- Failure & Observability: is the whole agent justified or just the agentic slice of it?

---

## Maintenance pipeline (separate from recommendation pipeline)

**Maintenance agents:** Perform scheduled web searches and propose manifest updates.

**Manifest Gatekeeper:** Skeptic-type agent that reviews all proposed updates critically before they go live. Distinct from The Skeptic in Wave 3 — same archetype, different domain and termination conditions. Scope includes tool/pattern entries, explainer copy, and "help me determine" question sets for all intake steps.

**Gatekeeper termination conditions:**
- **Accepted:** entry goes live, enters staged inclusion at appropriate confidence level
- **Rejected:** entry is dropped entirely — no queue. If the pattern has legs, it will surface again on the next refresh and be re-evaluated with whatever additional evidence exists at that time
- **Schema change detected:** automatic human escalation, no agent resolution attempted
- **Cycle cap:** 2 cycles. If the Gatekeeper and proposing agent cannot resolve a factual or categorization dispute, the entry is rejected and dropped

### Refresh pipeline

On-demand, lazily triggered — no scheduled cron. Refresh only runs when there is demand for it.

**Trigger and flow:**
- Staleness check runs the moment the UI opens
- If stale entries are detected, refresh kicks off immediately in the background
- User writes their description while refresh runs — they typically won't wait
- If the user submits before refresh completes, a brief message explains the wait
- Run proceeds only on fresh manifest data

**Staleness threshold:** Daily for AI-specific tooling (models, SDKs, frameworks, pricing). The AI tooling landscape changes rapidly; weekly cadence is too slow for this domain.

### User-scoped tools

Users may specify a tool that is not in the manifest. These tools are:
- Scoped to that run only — never written to the manifest
- Researched live by agents at evaluation time (no manifest data to pull from)
- Flagged in Pass 1 output as user-specified and unvetted

The Compatibility Validator handles user-scoped tools via live lookup, the same path it uses for pricing data.

---

## Output

### Pass 1 — Decision layer (always produced)
**Audience:** Executive or decision maker reading for directional confidence.
**Tone:** Plain English, jargon-light, intellectually respectful.

Contains:
- Executive summary — includes a brief callout if any non-established components are in the recommendation set (e.g. "two components in this architecture are emerging patterns — see the tool manifest for detail")
- Architecture diagram
- Validated tool manifest — each tool and pattern carries a maturity label derived from its manifest state: **Established** (full inclusion), **Emerging** (probationary), **Experimental** (flagged/confidence declining), or **User-specified** (not in manifest, live-researched). Labels are manifest-derived, not agent-generated.
- Cost estimates (ongoing operational cost, surfaced here because almost every stakeholder needs to speak to it)
- Security summary (trust boundaries defined, controls in place — reassuring without reading like a pentest report)

### Pass 2 — Implementation layer (user-initiated)
**Audience:** The builder who will implement the architecture.
**Trigger:** User clicks through after reviewing Pass 1 and feeling confident in the direction.
**Input:** Raw outputs from all recommendation pipeline agents (Wave 1, Wave 2, and The Skeptic) plus verified intake context. The rendered Pass 1 document is a human artifact and is not re-fed into the pipeline.

Contains:
- Architecture Decision Records (ADRs) — the *why* behind each decision, tradeoffs considered
- Configuration
- Specs

> Note: ADRs require Wave 1 agents to reason about tradeoffs during their pass, not just make selections. This is a constraint on how agents are prompted. The Skeptic's debate output — accepted overrides and their tradeoff reasoning — feeds directly into ADR content.

**Pass 2 agent structure — dedicated synthesis agents, one per recommendation domain:**

| Synthesis Agent | Expands |
|---|---|
| Orchestration synthesis | Orchestration agent output |
| Security synthesis | Security agent output |
| Memory & State synthesis | Memory & State agent output |
| Tool & Integration synthesis | Tool & Integration agent output |
| Trust & Control synthesis | Trust & Control agent output |
| Failure & Observability synthesis | Failure & Observability agent output |

**Compatibility Validator output** feeds all six synthesis agents as shared input — it is not a synthesis domain in its own right but provides the version, pricing, and constraint data that makes configuration accurate.

### Future paid tier
- Step-by-step implementation instructions
- Generated agent code ready to drop into user's architecture

> Note: If the paid tier generates domain-specific agent code, a domain context intake step will be needed (e.g. "accounting," "medical compliance"). Domain context is not needed for architecture recommendations but becomes load-bearing when generating implementation.

---

## Settled decisions

| Decision | Choice | Reason |
|---|---|---|
| Pipeline runs | Two separate runs | Single pass optimizes for two audiences simultaneously and does neither well |
| Agent input | Verified structured context only | Prevents downstream agents from reasoning from bad intake inference |
| Intake inference | Single stateful agent, sequential reasoning across steps | Inter-step dependencies handled naturally; 85% accuracy bar does not justify per-step specialist agents; users can correct any wrong inference |
| Reasoning layer | Agent layer only | UI displays and captures; reasoning must not split into the frontend |
| Options source | Maintenance manifest only | Nothing that could evolve is hardcoded in the UI |
| Pass 2 trigger | User-initiated | Only pays for deep run when user explicitly wants it |
| Manifest knowledge freshness | On-demand refresh | Keeps available options and patterns current for intake UI and agent recommendations |
| Compatibility Validator freshness | Live web search per run | Ensures version, compatibility, and pricing data is current at evaluation time — the manifest does not serve as a source for CV checks |
| Cost visibility | Surfaced in Pass 1 | Every stakeholder needs to speak to ongoing cost |
| Security scope | Agentic-specific attack surface only | Traditional security checklist is out of scope for the agent layer |
| Pass 2 architecture | Dedicated synthesis agents, one per recommendation domain | Expanding validated output is a different job than producing recommendations; re-running the wave model would re-derive what is already settled |
| Pass 2 input | Raw agent outputs from all waves + verified intake context | Rendered Pass 1 is for humans; synthesis agents need the underlying detail |
| Compatibility Validator in Pass 2 | Shared input to all synthesis agents, no synthesis counterpart | Cross-cutting data; not a domain with its own ADRs or specs |
| Manifest governance | Confidence scoring + source weighting + staged inclusion | Handles quality/relevance disputes without over-relying on human escalation |
| Schema changes | Automatic human escalation | Too broad an impact to leave to agent consensus |
| Manifest refresh | On-demand, lazy trigger | No wasted cycles during quiet periods; naturally scales with usage
| Manifest staleness threshold | Daily for AI-specific tooling | AI tooling landscape changes too rapidly for weekly cadence |
| Manifest refresh UX | Background on UI open; blocks only if user submits before refresh completes | User writing their description usually covers the refresh window |
| Gatekeeper rejected entries | Dropped, no queue | Next refresh cycle is the retry mechanism |
| User-scoped tools | Run-scoped, live-researched, flagged as unvetted in output | Keeps manifest integrity intact while still evaluating user-specified tools |
| Trust & Control placement | Wave 1 (sequential after Orchestration and Security) | HITL feasibility is architecturally load-bearing for Pass 1 — the Skeptic lacks the domain expertise to substitute for a dedicated T&C assessment |
