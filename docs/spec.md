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

### Admin configuration dashboard

Owner/admin can view and update system configuration without a code deploy. All default values are defined in the spec but treated as runtime config, not hardcoded.

**Configurable settings exposed on the dashboard:**

| Setting | Default | Notes |
|---|---|---|
| Tier 1 tool refresh threshold | 2 weeks | Lazy trigger; refresh runs if last refresh exceeds this age |
| Architecture pattern refresh threshold | 4 weeks | Lazy trigger |
| Tier 2/3 tool refresh policy | On-demand (run-referenced only) | Toggle between on-demand and a fixed cadence if demand justifies it |
| Confidence score — Established threshold | ≥ 7 | Score at or above this graduates an entry to full inclusion |
| Confidence score — Experimental threshold | ≤ 3 | Score at or below this flags an entry as declining |
| Confidence score — Drop threshold | 0 | Entries at zero are removed on next refresh |
| Skeptic cycle cap | 4 | Maximum debate cycles before caveats are assigned and output ships |
| Gatekeeper cycle cap | 2 | Maximum cycles before a disputed manifest entry is rejected and dropped |
| User hold aggregate threshold | 3 users | Number of user-level holds on the same org that triggers an admin nudge to consider an admin-level review |

Per-tenant overrides of these defaults are supported in the multi-tenant configuration (see Multi-tenancy note under Settled decisions).

### Agent version panel

Read-only view of all core agents with rollback capability. No prompt editing — new versions come from the deploy pipeline only.

**Per-agent display:**
- Active version (semantic version tag + deploy date)
- One-line changelog entry for the current version
- Deploy history — last 3–5 versions, each with changelog entry and deploy timestamp
- Run count on the current version

**Rollback flow:**
1. Admin selects a previous version from the history list
2. Dashboard shows the changelog diff — what is being reverted from and to, in plain language
3. Explicit confirmation required before rollback executes
4. Rollback applies to new runs only — in-flight runs complete on the version they started with
5. Rollback is logged as a deployment event (timestamp, who triggered it, version replaced, version restored)

**When this is useful:** a newly deployed agent version produces degraded recommendations. Rollback recovers the system in minutes; the bad version is investigated in source control afterward.

> Multi-tenancy note: tenants will eventually be able to pin to a specific agent version rather than tracking latest — relevant for regulated environments where agent changes must be reviewed before adoption. The versioning infrastructure supports this; the pin capability is deferred.

### Org list approval workflow

The primary interface for org list governance. All proposed modifications from the Org List Gatekeeper surface here for review.

**Pending modifications queue:**
- Each proposed addition, removal, or tier change is listed with the Gatekeeper's written justification and links to source material reviewed
- Admin approves or overrides each modification individually
- On override: the Gatekeeper runs a deeper research pass; findings surface in the same queue for a second review
- Human decision after the second pass is final — no third pass; resolved items are removed from the queue

**Admin nominations:**
- Admin can nominate a candidate org by name directly from this panel
- Nomination triggers a Gatekeeper research pass; findings are routed back through the pending modifications queue for approval using the same flow as Gatekeeper-initiated proposals

**Current org list:**
- Browsable by tier
- Each entry shows: tier, active scoring signals, last reviewed date, recency qualifier status
- Any entry can be challenged on-demand; challenges triggered in the same session are batched into a single research job and surface when complete

### Active holds and user signals

**Admin-level urgent holds:**
- List of all active admin-level holds with org name, flag date, and current status
- Holds affecting in-flight runs are flagged; runs that completed while a hold was active are retroactively marked in run history
- Resolution options per hold: confirm (org stays flagged), escalate to removal (routes through the org list approval queue), or lift

**User hold aggregate signal:**
- Surfaces when user-level holds on the same org reach the configurable threshold (default: 3 users — adjustable in admin configuration settings)
- Shown as a pattern, not individually (user privacy preserved): e.g. "3 users have active holds on Org X — view details"
- "View details" shows hold count, date range, and any research findings already generated
- Admin can escalate directly to an admin-level hold or dismiss from here

### Manifest health

Supports time filtering: presets (today / this week / this month) and a custom date range picker.

- Entry counts by maturity tier: Established / Emerging / Experimental
- Entries pending Gatekeeper review
- Entries dropped in the selected time window, with reason
- Last refresh timestamp per entry type (Tier 1 tools, architecture patterns, Tier 2/3 tools)
- Stale entry count — entries overdue for refresh based on current threshold settings

### Pipeline observability

All views support time filtering: presets (today / this week / this month) and a custom date range picker.

**Run volume and health:**
- Run volume over time (daily / weekly)
- Pipeline success and failure rates
- Per-agent failure rates — surfaces which agent is failing most frequently

**Run duration distribution:**
- Fastest and slowest run on record
- Percentile breakdown: p5 / p25 / p50 / p75 / p95

**Cost per run:**

| Line item | Granularity |
|---|---|
| Token costs | Per agent: input / output / cached tokens split |
| Web search costs | Per run total (CV-driven); reported separately from token costs |
| Wave subtotals | Rolled up from agent lines for Wave 0–3 |
| Run total | All-in cost for the run |

> The input / output / cached token split is load-bearing: if prompt cache hit rate degrades, costs spike without an obvious cause at the wave level.

**Conversion metrics:**

*Funnel:*
- Unique users with ≥1 completed Pass 1
- Unique users with ≥1 completed Pass 2
- Conversion rate between them

*Pass 1 run distribution:*
- Average Pass 1 runs per user
- Distribution by bucket: 1 run / 2–3 runs / 4+ runs

*Conversion rate by Pass 1 run bucket:*
- Of users who ran Pass 1 once, X% converted; 2–3 times, Y%; 4+, Z%
- Surfaces whether high-iteration users are engaged converters or stuck non-converters

*Time-to-conversion:*
- Of users who converted, what % did so in the same session vs. returning later
- Median and p75 time between first Pass 1 and first Pass 2

*Abandonment point:*
- Where non-converters leave: mid-intake / after Pass 1 / after hitting the paywall
- Each stage shown as a drop-off rate

*Caveat tier correlation:*
- Conversion rate segmented by the highest Skeptic caveat tier in the run's output: no caveat / Advisory / Blocking Condition / Do Not Build This
- Surfaces whether certain caveat tiers are killing conversion

> **Planned additions — high signal, requires more instrumentation:** intake correction rate (how many inferences the user changed), intake selection correlation with conversion, maturity label mix correlation with iteration and conversion. Add when instrumentation is in place.

> **Planned additions — useful at volume:** return visit conversion rate, domain correlation (Wave 0 domain-specific runs vs. general runs). Add when user base is large enough for statistical significance.

### User and billing management

**User management:**
- User list with account status and MFA enforcement state
- Ability to manage accounts: suspend, reset MFA, reassign tier

**Billing and margin visibility:**

| View | What it shows |
|---|---|
| Cost per pricing tier | Average all-in cost (tokens + search) for a free run, Pass 1 run, Pass 2 run — primary margin signal |
| API spend trend | Total token and search spend over time |
| Revenue by tier | Run counts and revenue for free / Pass 1 / Pass 2 |
| Margin per tier | Revenue minus average cost per tier — flags quickly if the free tier becomes unsustainable |

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
| 0 | Domain context | Conditional — only surfaces when domain agents are registered for the tenant. Asks whether the project operates in a regulated or specialized domain (e.g., healthcare, government contracting). Selecting a domain activates the corresponding Wave 0 agent(s). Suppressed entirely in the general-purpose product where no domain agents are registered. |
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

**Refresh cadence:** Lazy and on-demand — refresh only runs when there is demand for it. Staleness is checked on UI open; stale entries are refreshed in the background before the run proceeds.

| Entry type | Refresh trigger | Default threshold |
|---|---|---|
| Tier 1 tools in manifest | Lazy, if last refresh exceeds threshold | 2 weeks |
| Architecture patterns | Lazy, if last refresh exceeds threshold | 4 weeks |
| Tier 2/3 tools | Only when a run references them | — |
| User-specified tools | Never written to manifest; CV handles live | — |

All thresholds are configurable via the admin dashboard and take effect immediately — no deploy required. See Application layer — Admin configuration dashboard.

> Note: The Compatibility Validator performs live web search per run for version, CVE, and pricing data. Manifest staleness does not affect compatibility accuracy — only which tools surface in intake and confidence score freshness.

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
- Adoption by recognized practitioners and organizations (leading indicator, hard to fake). Independence of adopting orgs is evaluated using the vendor relationship cache maintained by the Compatibility Validator — see CV section. A vendor's adoption of their own tool scores zero. An affiliate org's adoption also scores zero. Adoption count is weighted by number of genuinely independent adopters.
- Time without contradicting evidence (stability signal)

**Secondary signals (contribute but with lower weight):**
- Additional citations from credible sources
- Contradiction by a newer pattern from a high-weight source (strong negative signal)

**Confidence tier bands:**

| Score | Label | State |
|---|---|---|
| ≥ 7 | Established | Full inclusion — surfaced as default recommendations |
| 4–6 | Emerging | Probationary — present in manifest, not surfaced as default |
| 1–3 | Experimental | Flagged / confidence declining |
| 0 | Dropped | Removed from manifest on next refresh |

**Staged inclusion:**
- New entries enter at Emerging (probationary) — present in manifest but not surfaced as default recommendations
- Graduate to Established when confidence score reaches ≥ 7
- Drop to Experimental if confidence declines; removed at 0 on next refresh

### Open questions
- What is the manifest's data structure and query pattern — full load, filtered lookup, or embedding search?

---

## Practitioner org list

A tiered list of AI-forward organizations whose adoption of a tool or pattern is treated as a credible confidence signal. Maintained separately from the maintenance manifest with its own governance.

### Why a separate gatekeeper

The org list is more load-bearing than the manifest. A bad manifest entry affects one tool's score. A bad org list entry corrupts adoption signals across every tool that org has ever touched. This warrants a higher bar and dedicated oversight.

### Org List Gatekeeper

A dedicated gatekeeper agent, distinct from the Manifest Gatekeeper, governs all changes to the org list. The two gatekeepers have the right to challenge each other — the Manifest Gatekeeper can flag if an org's adoption patterns appear compromised; the Org List Gatekeeper can flag if a manifest entry's confidence score appears inflated by suspect adoption signals. When the two gatekeepers disagree, the more conservative position wins.

### Human approval required for all org list changes

Unlike the Manifest Gatekeeper, the Org List Gatekeeper does not have authority to make changes autonomously. All proposed modifications require human (owner/admin) approval.

**Proposed modification flow:**
1. Org List Gatekeeper proposes additions, removals, or tier changes with written justification and links to source material reviewed
2. Owner/admin reviews each proposed modification and approves or overrides
3. If overridden, the Gatekeeper runs a deeper research pass — either surfacing a stronger argument for its position, or validating the human's reasoning with evidence
4. Human reviews the second pass via a full review screen and confirms or reverses their override
5. Human decision is final. No third pass.

Rejected modifications are dropped with no queue. If an org has legs, it will surface again on the next cycle with whatever additional evidence has accumulated.

### Org list scoring signals

An org's tier is determined by depth of commitment to agentic systems across four signals:

1. **Engineering publications** — volume and technical depth; marketing content does not count
2. **Open-source tooling** — active maintenance; abandoned repos do not count
3. **Platform offerings** — established offerings; beta announcements do not count
4. **Market influence** — platform or tooling decisions demonstrably shape industry adoption at scale; reserved for a short list; requires explicit owner/admin approval; independence check still applies

**Tier definitions:**

| Tier | Criteria |
|---|---|
| Tier 1 | Active in at least two signal categories with sustained meaningful output — OR qualifies on market influence |
| Tier 2 | Strong presence in one signal category |
| Tier 3 | Early but genuine signals; not yet established enough for Tier 2 but credible enough to track |

**Recency qualifier:** Any org with no meaningful activity across their signals in the last 6 months is flagged for re-evaluation regardless of tier.

**Tier weighting in confidence scoring:** Tier 1 org adoption carries more weight than Tier 2; Tier 2 carries more weight than Tier 3. Exact weighting is agent-determined based on signal strength and independence — no fixed formula.

### Seed list

**Tier 1 — Market influence**
Anthropic, OpenAI, Google/DeepMind, Microsoft, Amazon/AWS, Meta, Nvidia

**Tier 1 — Deep commitment across multiple signals**
- LangChain — dominant framework ecosystem (LangGraph, LangSmith), extensive engineering publications
- Hugging Face — open source hub, smolagents, prolific technical publishing

**Tier 2 — Strong in one area**
- Cohere, Mistral, Together AI — serious model providers with genuine engineering depth
- Weights & Biases — observability tooling and publications
- Pinecone, Weaviate — vector DB providers with substantive engineering content
- Modal, E2B — agent infrastructure with real technical credibility
- Databricks — strong engineering depth, MLflow ownership, serious publications
- Cursor — AI-native company running agentic systems as core product

**Tier 3 — Emerging**
- CrewAI, LlamaIndex, Haystack — frameworks with growing but not yet established track records
- Composio — tooling layer, newer but gaining traction

### Periodic and on-demand review

The current org list is surfaced to the owner/admin on a periodic cadence for review. Any item on the list can be challenged — either on the periodic review screen or on-demand at any time.

**On-demand challenge batching:** Multiple challenges triggered in the same session are batched into a single research job. Research runs in the background and is non-blocking. The owner/admin reviews findings at next convenient moment.

### Urgent flag — admin level

Owner/admin can mark any org as urgent. Urgent flags bypass batching and trigger immediate research.

**While an urgent hold is active:**
- All new runs: any recommendation that would include a held org's tools is blocked or surfaced with a prominent warning
- In-flight runs that have already passed the affected tool: allowed to complete; output is flagged retroactively with a hold warning
- Hold persists until owner/admin explicitly resolves it — confirm hold, escalate to removal, or lift

### Urgent flag — user level

Authenticated users can flag an org as urgent for their own runs only. User-level flags do not affect the manifest, the org list, or any other user's runs.

**User-level hold behavior:**
- Affects only that user's recommendations — held org's tools are blocked or flagged in their runs
- Triggers background research scoped to that user's flag; findings are surfaced to the user
- User can lift their own hold at any time

**Aggregate signal to owner/admin:**
User-level holds are surfaced to the owner/admin in aggregate on next run — not individually (user privacy preserved), but as a pattern: e.g. "3 users have active holds on Org X — view details." Unusual hold activity on an org triggers a prompt for the owner/admin to consider an admin-level review. This is a nudge, not an automatic hold.

---

## Agent pipeline

### Guiding principle
Agents focus on agentic-specific concerns. Traditional software architecture concerns (APIs, databases, auth, deployment infrastructure) are out of scope for the agent layer.

### Wave 0 — Domain context (conditional)

Runs before Wave 1, only when a domain agent is active for the tenant. Produces a structured constraint brief that is appended to verified context before Wave 1 begins. All downstream agents (Wave 1, CV, The Skeptic, synthesis agents) receive it as additional context without modification.

**Constraint brief schema (typed, not free text):**
- Required regulatory controls
- Prohibited tools or patterns
- Mandatory certifications or compliance frameworks
- Scope of applicability (e.g., applies to data handling only, applies to all components)

**Domain agent interface (standardized):**
- Input: verified intake context
- Output: constraint brief conforming to the schema above
- Registration: tenant supplies an API endpoint or Claude API tool definition; the system calls it at Wave 0

Multiple domain agents can be active on a single run (e.g., a system that is both HIPAA-scoped and deployed on a government platform). Each produces a constraint brief; briefs are merged before being passed downstream.

Domain agents are tenant-registered and not part of the default pipeline. The general-purpose product has no Wave 0.

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

*Vendor relationship cache (side effect of CV runs):*

CV captures ownership and affiliate information opportunistically during its vendor documentation visits. When CV encounters ownership details (parent company, acquiring org, subsidiary relationships) while researching a tool, it writes that to a shared vendor relationship cache.

- CV writes to the cache; it does not read from it or use it for compatibility checks
- All cache entries route through the Manifest Gatekeeper before affecting confidence scoring
- Cache entries carry a staleness threshold tied to the tool's refresh cadence — stale entries are re-validated on next CV visit to that vendor
- Coverage is run-driven: only tools that appear in recommendations accumulate relationship data. Low-traffic tools may have no cache entry and fall back to direct-vendor-only zero-scoring.

See Maintenance Manifest — Confidence scoring for how this cache is used to evaluate independence of adoption signals.

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

**Staleness threshold:** Tier-based — see Refresh cadence table above. Tier 1 tools refresh if last run > 2 weeks; architecture patterns if > 4 weeks; Tier 2/3 tools only when referenced by a run.

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

> Note: When the future paid tier generates domain-specific implementation code, the Wave 0 domain agent constraint brief becomes load-bearing for correctness — generated code must conform to the same regulatory constraints as the architecture. No additional intake step is needed; domain context is already captured at step 0.

---

## Pricing and access tiers

Output is gated by tier. All runs execute the full pipeline; gating is applied at render time.

| Tier | What the user receives | Price |
|---|---|---|
| Free | Exec summary + validated tool list with maturity labels (Established / Emerging / Experimental / User-specified); CV category titles visible, values blurred; up to 3 runs/day | $0 |
| Pass 1 | Full Pass 1 output: architectural diagram, full CV detail (version, CVE, license, EOL, cost estimates), security summary | $49 / run |
| Pass 2 | Full Pass 2 output: ADRs, configuration, specs | $199 / run (requires Pass 1) |
| Future paid tier | Step-by-step implementation instructions + generated agent code | TBD |

**Free tier rate limit:**
- Users may run up to 3 free runs per day
- The limit is disclosed before the user clicks "Analyze" for the first time — no surprises at the paywall
- After 3 runs, additional runs require a Pass 1 purchase

**CV output on the free tier:**
- Every category the Compatibility Validator found data for is shown by title (e.g. Cost estimates, End-of-life date, CVEs, Breaking changes, License) — the user can see what was found
- The values within each category are blurred — visible after the first run, not before; the blur itself communicates what data exists and motivates conversion
- The validated tool list with maturity labels remains fully visible

**Rationale:**
- Free tier shows enough signal (maturity labels, CV category titles) to demonstrate that the system did real work — but withholds the detail the user needs to act
- Blurred CV values are a stronger conversion lever than a generic paywall: the user can see exactly what they're missing
- The architectural diagram is the strongest conversion lever for the executive/decision-maker audience: it's the artifact that goes into a deck
- $49 is impulse-purchase territory for the primary audience (senior technical builders who expense tools)
- Pass 2 is episodic use, not a daily driver — per-run pricing is honest and aligns cost with value delivered
- Full pipeline runs on every request; gating is render-time only — no partial pipeline execution

---

## Settled decisions

### System architecture

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Pipeline runs | Two separate runs | Single pass optimizes for two audiences simultaneously and does neither well | 2026-04-14 |
| Reasoning layer | Agent layer only | UI displays and captures; reasoning must not split into the frontend | 2026-04-14 |
| System configuration | Admin dashboard with runtime-configurable thresholds | Refresh cadences, confidence thresholds, and cycle caps change as demand and the tooling landscape evolve — hardcoding them requires a deploy to tune | 2026-04-20 |
| Multi-tenancy | Deferred — design only | White-label consultancy version is a future feature; initial build is single-tenant | 2026-04-20 |

> Multi-tenancy design note: The existing governance model (owner/admin role, user-level holds, scoped run history) maps directly to a multi-tenant model without rearchitecting. When implemented: shared base manifest with tenant-level additive/suppressive overrides gated by the Manifest Gatekeeper; no tenant-level modification of base confidence scores; per-tenant domain agent registration; per-tenant dashboard config overrides. Data model should carry a `tenant_id` from day one.

### Maintenance manifest

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Manifest knowledge freshness | On-demand refresh | Keeps available options and patterns current for intake UI and agent recommendations | 2026-04-15 |
| Manifest governance | Confidence scoring + source weighting + staged inclusion | Handles quality/relevance disputes without over-relying on human escalation | 2026-04-14 |
| Schema changes | Automatic human escalation | Too broad an impact to leave to agent consensus | 2026-04-14 |
| Manifest refresh | On-demand, lazy trigger | No wasted cycles during quiet periods; naturally scales with usage | 2026-04-14 |
| Manifest staleness threshold | Daily for AI-specific tooling | AI tooling landscape changes too rapidly for weekly cadence | 2026-04-14 |
| Manifest refresh UX | Background on UI open; blocks only if user submits before refresh completes | User writing their description usually covers the refresh window | 2026-04-14 |
| Gatekeeper rejected entries | Dropped, no queue | Next refresh cycle is the retry mechanism | 2026-04-14 |
| User-scoped tools | Run-scoped, live-researched, flagged as unvetted in output | Keeps manifest integrity intact while still evaluating user-specified tools | 2026-04-14 |

### Intake

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Intake inference | Single stateful agent, sequential reasoning across steps | Inter-step dependencies handled naturally; 85% accuracy bar does not justify per-step specialist agents; users can correct any wrong inference | 2026-04-14 |
| Agent input | Verified structured context only | Prevents downstream agents from reasoning from bad intake inference | 2026-04-14 |
| Options source | Maintenance manifest only | Nothing that could evolve is hardcoded in the UI | 2026-04-14 |

### Agent pipeline

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Domain-specific expertise | Wave 0 plugin — produces typed constraint brief before Wave 1 | Domain agents produce constraints, not recommendations; Wave 0 narrows the solution space before other agents reason into it; downstream agents receive brief as context with no modification | 2026-04-20 |
| Domain agent interface | Standardized schema (typed constraint brief); tenant supplies endpoint or Claude API tool definition | Structured output lets downstream agents reason reliably; free text would require each agent to re-parse domain requirements | 2026-04-20 |
| Security scope | Agentic-specific attack surface only | Traditional security checklist is out of scope for the agent layer | 2026-04-14 |
| Trust & Control placement | Wave 1 (sequential after Orchestration and Security) | HITL feasibility is architecturally load-bearing for Pass 1 — the Skeptic lacks the domain expertise to substitute for a dedicated T&C assessment | 2026-04-15 |

### Compatibility Validator

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Compatibility Validator freshness | Live web search per run | Ensures version, compatibility, and pricing data is current at evaluation time — the manifest does not serve as a source for CV checks | 2026-04-15 |
| Compatibility Validator in Pass 2 | Shared input to all synthesis agents, no synthesis counterpart | Cross-cutting data; not a domain with its own ADRs or specs | 2026-04-14 |

### Output

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Cost visibility | Surfaced in Pass 1 | Every stakeholder needs to speak to ongoing cost | 2026-04-14 |
| Pass 2 trigger | User-initiated | Only pays for deep run when user explicitly wants it | 2026-04-14 |
| Pass 2 architecture | Dedicated synthesis agents, one per recommendation domain | Expanding validated output is a different job than producing recommendations; re-running the wave model would re-derive what is already settled | 2026-04-14 |
| Pass 2 input | Raw agent outputs from all waves + verified intake context | Rendered Pass 1 is for humans; synthesis agents need the underlying detail | 2026-04-14 |
