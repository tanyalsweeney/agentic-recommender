# Agentic Architecture Recommender — Product Spec

## What Agent12 Does

The user describes the agentic system they want to build, optionally using a guided checklist. Agent12 infers key architectural decisions from that description, including agent structure, autonomy level, memory, failure handling, deployment platform, run volume, concurrency, model preference, budget, permissions, and security posture. Inferences are presented for review; the user confirms or adjusts each with a single click, then clicks Generate Architecture Spec.

Confirmed decisions are passed to a team of specialist agents, each working from their own area of expertise. High-quality, fully compatible tools are table stakes. Every agent's primary directive is suitability to the user's intent.

---

## Scope

The recommendation pipeline covers agentic architecture — the decisions unique to systems where AI agents reason, act, and coordinate. The following are assumed to be within the builder's existing capabilities and are not covered:
- Hosting, deployment, and infrastructure
- UI and frontend design
- API and database design
- CI/CD pipelines
- Standard observability infrastructure (logging, monitoring, alerting)

Some areas look familiar but behave differently when agents are involved. The pipeline explicitly flags these intersections rather than assuming standard practice applies:
- **Security** — agentic systems introduce attack surfaces (prompt injection, tool misuse, trust boundary violations) that don't appear on a standard security checklist
- **Observability** — reasoning chains and inter-agent handoffs require extensions beyond standard distributed tracing
- **Testing** — non-deterministic agent outputs can't be unit tested; eval strategy is covered explicitly
- **Failure handling** — cascading agent failures and reasoning loops follow different patterns than standard error recovery

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
- Email verification required on signup — deters throwaway accounts alongside MFA
- Per-IP rate limiting on account creation — slows bulk account creation without affecting legitimate users

### Admin configuration dashboard

Owner/admin can view and update system configuration without a code deploy. All default values are defined in the spec but treated as runtime config, not hardcoded.

**Configurable settings exposed on the dashboard:**

| Setting | Default | Notes |
|---|---|---|
| Tier 1 tool refresh threshold | 2 weeks | Lazy trigger (refresh runs if last refresh exceeds this age) |
| Architecture pattern refresh threshold | 4 weeks | Lazy trigger |
| Tier 2/3 tool refresh policy | On-demand (run-referenced only) | Toggle between on-demand and a fixed cadence if demand justifies it |
| Confidence score — Established threshold | ≥ 7 | Score at or above this graduates an entry to full inclusion |
| Confidence score — Emerging band | Between Experimental floor and Established threshold (4–6 by default) | Derived — not directly configurable; updates automatically when adjacent thresholds change; read-only display |
| Confidence score — Experimental threshold | > Drop threshold and ≤ 3 | Score above Drop and at or below this flags an entry as declining; Drop threshold takes precedence at the floor |
| Confidence score — Drop threshold | 0 | Entries at this score are removed on next refresh; takes precedence over Experimental threshold |
| Skeptic cycle cap | 4 | Maximum debate cycles before caveats are assigned and output ships |
| Gatekeeper cycle cap | 2 | Maximum cycles before a disputed manifest entry is rejected and dropped |
| User hold aggregate threshold | 3 users | Number of user-level holds on the same org that triggers an admin nudge to consider an admin-level review |
| CV result cache TTL | 24 hours (default) | How long a cached per-tool CV result is considered fresh before re-research is required |
| Manifest max staleness threshold | 2x the normal refresh threshold per entry type | If refresh fails and retries are exhausted, runs proceed on stale data up to this age; beyond it, runs are blocked until refresh recovers |

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

The org list is a tiered registry of AI-forward organizations whose adoption of a tool or pattern is treated as a credible confidence signal in the recommendation engine. A compromised entry has outsized downstream impact: unlike a single bad tool recommendation, a bad org entry corrupts the adoption signals that underpin confidence scoring across every tool that org has ever touched. All changes require human approval. The Org List Gatekeeper proposes modifications, but cannot act unilaterally; all proposed additions, removals, and tier changes surface here for admin review.

**Pending modifications queue:**
- Each proposed addition, removal, or tier change is listed with the Gatekeeper's written justification and links to source material reviewed
- Admin approves or overrides each modification individually
- On override: the Gatekeeper runs a deeper research pass; findings surface in the same queue as an updated entry showing the original justification alongside the second-pass findings
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
- Per-agent duration: median and p95 per agent — see per-agent breakdown below

**Per-agent breakdown:**

One row per agent. Supports the same time filtering as all other pipeline observability views. Cycle count shown only for agents that run debate loops.

| Agent | Wave | Duration median | Duration p95 | Input tokens | Output tokens | Cached tokens | Web search calls | Cycles |
|---|---|---|---|---|---|---|---|---|
| Domain agent(s) | 0 | | | | | | — | — |
| Orchestration | 1 | | | | | | — | — |
| Security | 1 | | | | | | — | — |
| Memory & State | 1 | | | | | | — | — |
| Tool & Integration | 1 | | | | | | — | — |
| Failure & Observability | 2 | | | | | | — | 1–2 |
| Trust & Control | 2 | | | | | | — | 1–2 |
| Compatibility Validator | 2.5 | | | | | | per tool researched | — |
| The Skeptic | 3 | | | | | | — | 1–4 |
| Technical Writer | Pass 1 | | | | | | — | — |

**Cost per run:**

| Line item | Granularity |
|---|---|
| Token costs | Per agent: input / output / cached tokens split — see per-agent breakdown above |
| Web search costs | Per agent (CV only in the recommendation pipeline); reported separately from token costs |
| Wave subtotals | Rolled up from agent lines for Wave 0–3 |
| Run total | All-in cost for the run |

> The input / output / cached token split is load-bearing: if prompt cache hit rate degrades, costs spike without an obvious cause at the wave level.

**Maintenance pipeline costs:**

Reported separately from recommendation pipeline costs — maintenance spend is not tied to user runs and would be invisible in per-run reporting.

| Line item | Granularity |
|---|---|
| Manifest refresh | Token costs (input / output / cached) + web search costs per refresh run |
| Manifest Gatekeeper | Token costs per review; cycle count per entry |
| Org list research jobs | Token costs + web search costs per job (periodic review, on-demand challenge, urgent flag) |
| Org List Gatekeeper | Token costs per review; cycle count per proposal |
| Period total | All-in maintenance cost for the selected time window |

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

*Intake correction rate:*
- Per step: how often users changed the pre-populated inference
- Surfaces which steps the intake agent gets wrong most frequently — a signal for prompt tuning

*Intake selection correlation:*
- Which intake selections (platform, orchestration pattern, model, etc.) correlate with Pass 2 conversion
- Surfaces whether certain architecture profiles attract higher-intent users

*Maturity label mix:*
- Distribution of Established / Emerging / Experimental labels in the recommendation set, correlated with re-run count and conversion rate
- Surfaces whether architectures heavy in Emerging or Experimental components drive iteration or kill conversion

*Return visit conversion:*
- Of users who did not convert in their first session, what % returned and converted later
- Median time between first Pass 1 and Pass 2 purchase for return converters

*Domain correlation:*
- Conversion rate and run volume segmented by whether Wave 0 was active and which domain agent ran
- Surfaces whether domain-specific runs convert differently from general runs

**Unusual usage patterns:**
- Accounts hitting the free tier daily limit on many consecutive days with zero conversions — surfaces high-intent non-converters (candidates for outreach) and potential systematic extraction; derived from run count and conversion data already collected
- Multiple accounts created from the same IP within a short window — derived from signup IP data already logged for per-IP rate limiting

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
- Stored per run: original inference per intake step, verified context (final confirmed selections + hard constraints), maturity label distribution of the recommendation set, Wave 0 domain agent tag (if active), and Pass 1 output
- Pass 2 output stored only if the user generates it
- Users can browse past runs and review previous recommendations
- Users can load a past run's verified context as a starting point for a new run, modify the description or selections, and re-run from scratch
- **Dropped tool handling on context load:** if a past context references a tool that has since been dropped from the manifest (confidence = 0), it is shown with a strikethrough and an info icon. On hover: "[Tool name] was removed from the recommendation set on [date] — confidence score reached 0." The step reverts to inference state for the new run. The user sees what they had and understands what changed.
- **Diff view:** users can compare any two of their past runs side by side. Diff is computed from structured output fields — orchestration pattern, tool selections, maturity label distribution, caveat tiers, cost estimate — not from rendered documents. Changes are surfaced as a readable delta: "Orchestration pattern changed: pipeline → DAG. Memory & State: session-only → shared persistent. 2 tools added to validated list." Helps the primary audience (who iterate multiple times before settling on a stable description) see what actually changed between runs without reading both documents.

> Note: Most users will not proceed past Pass 1. Multiple Pass 1 iterations before settling on a stable description is expected behavior for the primary audience — re-runs are driven by description refinement, not intake inference errors. This has direct implications for CV re-search costs — see CV result cache.

### Progressive CV disclosure

Once the user clicks Analyze and the pipeline begins, the UI streams Compatibility Validator results to the user as each per-tool sub-task completes. Per tool: name, version confirmed, CVE status, pricing status appear as each sub-task finishes. Cross-tool and cross-agent check results display as a group when all per-tool work finishes.

On free tier runs, the blur is applied to CV values as they stream in — the user sees the category name and that a result arrived, but the value is blurred in real time. This preserves the streaming effect (visible progress, trust-building) while maintaining the free-tier gate.

Makes the wait productive: users watch real validation work completing rather than a progress spinner, building confidence before they see the final output. Streaming requires server-sent events or WebSocket on the CV output path. Validate that per-tool sub-task P50 latency justifies the streaming infrastructure before committing (see TODOS.md).

### Session expiry and long-running pipelines

**Pipeline execution is fully server-side.** Once the user clicks Analyze, the pipeline runs to completion regardless of session state — the user can close the tab, lock their device, or let their session expire. Results are stored in run history and are accessible on re-authentication. No pipeline work is lost due to session expiry.

**Intake state is browser-local.** If a session expires before the user submits (during intake), intake progress is lost. This is standard web app behavior. The impact is low: prior run history lets users reload a previous verified context as a starting point, and the Spec Scaffold can be used again from the beginning.

**Run completion notification:** users can opt in to an email notification when a run completes. The notification includes a direct link to the completed run in run history. Useful for the primary audience who submit a run and return to it later — email infrastructure is already in place for account verification.

---

## Intake flow

**Design principle: show value early, minimize friction.** The user sees the system working immediately — inference results presented for confirmation — before being asked to provide anything additional. High-friction asks before value delivery are avoided.

A TurboTax-style guided step flow. The user provides a description and any constraints upfront, then submits. Constraints are collected with the description — before inference runs — and classified by the intake agent into two types:

- **Binary exclusions:** eliminate non-viable options entirely before inference runs (e.g., "no third-party cloud services," "must use open-source only"). The intake agent filters the available option set using these before producing pre-populated selections, so the user is never shown options they cannot use.
- **Optimization targets:** shape recommendations toward a preference without eliminating options (e.g., "minimize cost," "minimize operational overhead," "avoid vendor lock-in where possible"). These are passed as weighting signals to all downstream agents, who favor options that honor the target and flag where it cannot be fully honored.

Inference runs once on the description and constraints together, producing a pre-populated selection for every step.

**Spec Scaffold (free):** A fill-in-the-blanks wizard surfaced at the description step with the prompt: *"Most users miss a few things freeform. Spec Scaffold takes 2 minutes, costs nothing, and draws out the details that matter."* The wizard covers every structurally meaningful dimension of an agentic system: autonomy level, failure tolerance, memory requirements, scale, and other details that even experienced users tend to omit when writing freeform. Each field is prepopulated with the most common answer as placeholder text; users replace only what doesn't fit. Once completed, the form renders as editable prose in the description text box; the user refines and submits as normal. The scaffold remains available at the description step and can be used as many times as needed.

**Positioning:** Spec Scaffold should be positioned as a recommended first step for all users, not a fallback for uncertain ones. Experienced users describing in-flight projects frequently omit dimensions they consider obvious; the scaffold surfaces those gaps before they cost a run. The UI should make the connection explicit: fewer iterations means fewer CV re-search costs and a direct financial benefit to the user.

From that point, the system presents one step at a time. Each step has one of three states:

- **High confidence inference:** the inferred option is pre-selected. Available options are shown below.
- **Low confidence:** nothing is pre-selected. Available options are shown. No guess is surfaced — anchoring the user on a weak inference is worse than showing nothing.
- **Not applicable:** the system is confident this step isn't required for the described architecture. Nothing is pre-selected. A brief message explains: "This isn't obviously required for your use case." Available options are shown in case the user knows otherwise.

Each step includes an expandable "more info" section explaining the domain, collapsed by default in all states. For Memory & State specifically, a "help me determine the best option" flow surfaces targeted clarifying questions and recommends based on the answers — available regardless of inference state. The questions and explainer content for all steps live in the maintenance manifest and are updated on the same refresh cadence.

If the user proceeds with nothing selected, agents receive that step as empty and handle it from the full verified context.

**The step list adapts** based on prior confirmed answers. Model preferences always surfaces. Platform selection (step 2) filters the available options but does not suppress the step. When inference confidence is too low or the step is not applicable, nothing is pre-selected. If the user changes the model selection, available options and pre-selections in step 11 (Tools) update accordingly.

Step 11 (Tools) follows a variant of the standard step pattern: multiple tools may be inferred and pre-selected simultaneously. The pre-populated section is conditional on manifest coverage for the confirmed platform and model. If manifest tools match: inferred tools surface pre-selected at the top; remaining compatible manifest tools are listed below. If no manifest tools match: the inferred list is empty and the step opens with an invitation to add tools manually. In both cases the step always surfaces — suppressing it when coverage is thin would also eliminate the ability to add user-specified tools, which is most needed on unusual platforms. One-click to add or remove any tool; one-click to confirm all inferred selections.

**Binary exclusion exhaustion:** if a binary constraint eliminates all manifest options for a step, the step still surfaces — suppressing it hides the problem from the user. A specific warning is shown: "Your constraints exclude all available options for this step." The user can add options manually, adjust their constraints on the review screen, or proceed with no selection. If the user proceeds with no selection, agents receive that step as empty and attempt to reason about options that satisfy the constraints, recommending any viable option as unvetted if it is outside the manifest. If agents cannot find a viable option, The Skeptic handles it as a constraint violation and assigns the appropriate caveat tier — up to Do Not Build This (tier 3) if irreconcilable.

Reasoning for each step lives in the agent layer. The UI renders and captures; it does not reason.

Nothing that could evolve is hardcoded in the UI. Options at every step are sourced from the maintenance manifest — step 3 (External integrations) is the exception, where the user describes their own systems rather than selecting from a predefined list.

Agents receive the full verified context: the original description, all confirmed selections, and all constraints with their classified type. Binary exclusions are already reflected in the available options by the time agents run. Optimization targets are passed as weighting signals — agents apply them when making recommendations and flag explicitly where a target cannot be fully honored. Agents do not re-infer what the intake flow already established.

### Review screen

The final step before submission. Displays the complete verified context — project description, hard constraints, and all confirmed step selections — so the user sees the full picture together for the first time.

All fields are editable. The user can correct anything they spotted while reviewing without navigating back through individual steps.

**Downstream dependency handling:**
If an edit would invalidate a downstream selection, the system surfaces a confirmation before proceeding. The message specifies what will be re-inferred — not just what will be cleared — so the user understands the system will handle it:

> *"Changing your platform will update your available model options and tool recommendations. Your current selections for those steps will be replaced with new inferences. Continue?"*

Re-inference runs only on the affected steps. Unaffected selections are preserved.

**Constraints field:**
The constraints field is prominently surfaced on the review screen as an explicit prompt — users frequently discover constraints they hadn't articulated while walking through the domain steps. Any constraints added here are classified (binary exclusion or optimization target) and folded into verified context before the run proceeds.

### Intake steps

| # | Step | Notes |
|---|---|---|
| 0 | Domain context | Conditional — only surfaces when domain agents are registered for the tenant. Asks whether the project operates in a regulated or specialized domain (e.g., healthcare, government contracting). Selecting a domain activates the corresponding Wave 0 agent(s). Suppressed entirely in the general-purpose product where no domain agents are registered. |
| 1 | Orchestration pattern | Agent count, structure (orchestrator + subagents, pipeline, directed acyclic graph, etc.) |
| 2 | Platform & deployment | Constrains model selection and available tooling downstream |
| 3 | External integrations | Systems the agent touches — APIs, databases, cloud services, etc. |
| 4 | Data & file handling | File types, data sensitivity, protection schemes (information rights management, classification labels) |
| 5 | Memory & state | Session persistence, shared agent state, memory horizon. Auto-expand explainer; offer guided "help me determine" flow |
| 6 | Autonomy & Human-in-the-Loop | Autonomy level, human-in-the-loop requirements |
| 7 | Scale | Run volume, concurrency expectations |
| 8 | Greenfield vs. brownfield | New build, extending existing system, or migration |
| 9 | Failure tolerance | Mission criticality, acceptable failure modes, audit trail requirements |
| 10 | Model preferences | Always surfaces. Platform (step 2) filters available options. Pre-populated with inference if confident, or "Choose for me" if not. Changing selection updates tool options in step 11. |
| 11 | Tools | Always surfaces after model preferences are confirmed; multi-select variant (see intake flow above for conditional logic). User-specified tools not in the manifest can be added here — scoped to the run, researched live, and flagged as unvetted in the output. |


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
- Time without contradicting evidence (stability signal) — evaluated alongside active maintenance signals (see below). Absence of contradiction alone is insufficient: a three-year-old tool with no new releases and no CVEs still has positive stability score but may score zero on maintenance activity.
- **Active maintenance signals (required gating signal, not just additive weight):** commit activity (at least one meaningful commit in the past 6 months), release cadence (at least one release in the past year), or an explicit vendor support statement. A tool that fails all three maintenance signals is flagged for re-evaluation regardless of confidence score, and its stability signal is discounted to reflect the risk of abandonment.

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

### Settled: query pattern
At launch volume (50-100 entries), the full manifest is passed to each agent at query time (full load). No query API or filtering layer is needed. When the manifest grows past the point where full load becomes expensive in context tokens (~500+ entries), filtered lookup is the migration — adding a WHERE clause to a database query rather than redesigning the access pattern. Embedding search is deferred: it adds retrieval power for ambiguous queries but requires vector store infrastructure that is not justified at launch scale.

The exact JSON schema for manifest entries (field names, nested structures) is defined during the manifest build phase, informed by what data each agent actually reads. The spec establishes the semantic content (confidence score, maturity tier, adoption signals, platform compatibility, EOL date, CVE flags) — the schema maps these to fields.

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
4. Human reviews the second pass in the same pending modifications queue — the entry now shows the original justification alongside the second-pass findings; human confirms or reverses their override
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

Seed list entries are pre-approved by the owner at system initialization — they represent the founding judgment call that defines the starting state of the org list. The Gatekeeper approval flow applies to all subsequent additions, removals, and tier changes. Seed entries are subject to the same periodic review cadence as all other entries; the Gatekeeper will produce proper signal documentation on first review cycle.

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
Every agent's ultimate test is whether the recommendation solves what the user described building. Technical correctness and compatibility are table stakes. The scope constraint follows from this: agentic-specific concerns are what agents are uniquely equipped to get right — traditional software architecture concerns (APIs, databases, auth, deployment infrastructure) are out of scope because they are not where the system adds distinctive value.

### Wave 0 — Domain context (conditional)

Runs before Wave 1, only when a domain agent is active for the tenant. Produces a structured constraint brief that is appended to verified context before Wave 1 begins. All downstream agents (Waves 1, 2, and 2.5, The Skeptic, synthesis agents) receive it as additional context without modification.

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

**Brief merging rules:**
- Required regulatory controls, mandatory certifications: union of all requirements across all briefs
- Prohibited tools or patterns: union of all prohibitions — if any brief prohibits something, it is prohibited in the merged brief
- Scope of applicability: merged to the broadest applicable scope

**Conflict detection:** A conflict exists when a tool or pattern appears as required in one brief and prohibited in another. Detected conflicts are flagged in the merged brief with the names of the contributing domain agents and the specific constraint pair. All downstream agents receive the merged brief including any conflict flags.

Domain agents are tenant-registered and not part of the default pipeline. The general-purpose product has no Wave 0.

### Wave 1 — Parallel
All four agents run in parallel on the verified context. All produce domain recommendations **plus structured cost signals** for their area. Cost signals feed into the Compatibility Validator at Wave 2.5.

| Agent | Agentic focus |
|---|---|
| Orchestration | Recommends the right coordination pattern for this system — pipeline, DAG, supervisor, event-driven, etc. |
| Security | Agentic-specific attack surface: prompt injection, tool misuse, excessive autonomy, trust boundary definition, data exfiltration through reasoning. Traditional security checklist is out of scope. |
| Memory & State | Persistence strategy, shared state design, memory pattern selection. Note: users frequently don't know if they need memory or state — the intake step for this domain needs more explanatory scaffolding than others, and the agent should surface its reasoning explicitly rather than just its conclusion. |
| Tool & Integration | Reasons about where the tool-vs-agent boundary should be drawn for this user's specific system. Core decision framework: tools for deterministic operations (same input, same output), agents for tasks requiring judgment. Also covers MCP usage and build vs. buy recommendations. Platform-specific tool filtering from the manifest happens within this agent but is not its core value. |

### Wave 2 — Cooperative (depends on Wave 1)

Failure & Observability and Trust & Control run together in a structured exchange. Both receive the full Wave 1 output. Both produce structured cost signals for CV at Wave 2.5 — F&O's signals cover eval infrastructure and tracing overhead; T&C's cover HITL gate overhead and human review latency.

**Exchange protocol:**
1. F&O produces its failure mode analysis: cascading failure points, reasoning loop risks, high-risk handoff points in the architecture, eval strategy for non-deterministic reasoning, and tracing approach
2. T&C incorporates the failure analysis into gate placement: HITL gates are positioned to address identified risk points; T&C's response is structured output covering gate placements with rationale
3. F&O confirms whether the recovery story holds with the proposed gates in place, or adjusts if gate placements materially change the failure picture

**Termination:**
- Early exit: if F&O's step 3 confirmation requires no adjustment, the exchange is complete
- Cycle cap: 2 cycles; if unresolved after 2 cycles, each agent ships its current output and the unresolved tension is passed to The Skeptic, flagged for resolution

**Failure & Observability scope:**
- Agentic-specific failure mode analysis — cascading agent failures, reasoning loops, tool misuse, non-deterministic outputs, memory corruption across sessions
- Eval strategy for non-deterministic reasoning — how to evaluate multi-agent pipelines where unit testing reasoning is not possible
- Tracing reasoning chains and inter-agent handoffs — the agentic-specific slice of distributed tracing
- Explicitly flags intersections where traditional observability approaches need to be adapted rather than applied as-is; does not cover standard observability infrastructure

**Trust & Control scope:**
- HITL placement and approval gate design
- Depends on Orchestration (to know the flow) and Security (to know the risk profile); receives both from Wave 1
- In the cooperative exchange, also incorporates F&O's failure mode analysis to position gates at high-risk points in the architecture
- Autonomy level is captured during intake; this agent determines where and how that level is enforced within the specific architecture

### Wave 2.5 — Compatibility Validator

Runs a fresh web search per tool and integration point; does not rely on cached manifest data — versions, compatibility issues, and patches change on short cycles.

CV's work is decomposed into independently checkpointable sub-tasks (see Pipeline failure handling). Each sub-task persists its output as it completes; a failure in one sub-task retries only that sub-task without losing any other CV work.

*Per-tool sub-tasks (parallel, one per tool):*
- Verifies the recommended version is current and compatible with its integration points
- END-of-life date for the recommended version
- HIGH and CRITICAL CVEs affecting the recommended version that have not been patched in that version
- Meaningful breaking changes between the recommended version and current stable
- License (SPDX identifier; copyleft licenses flagged for legal review)
- Pricing and tier data
- For managed cloud services: availability in the target cloud provider and region — whether specified by the user or recommended by the system
- Direct link to the vendor documentation page visited — included in CV's report as the source reference and as a manual verification path if any data is flagged as unavailable

*Cross-tool compatibility checks (run after all per-tool sub-tasks complete):*
- Verifies that recommended tools and versions are mutually compatible across all meaningful tool pairs and integration points
- Checks LLM SDK version against orchestration framework, memory/vector store against embedding model API, agent framework against tool execution runtime, and model constraints against platform deployment target

*Cross-agent conflict checks (run after cross-tool checks complete):*
- Constraint violations: checks whether any tool or decision recommended by one agent violates a constraint declared by another (e.g., Security declares no third-party data exfiltration; Tool & Integration recommends a SaaS tool with no on-premises option)
- Integration gaps: verifies that every tool dependency an agent assumes is actually accounted for by some agent in the set
- Version conflicts: where two agents both depend on the same tool, checks that their version requirements are compatible

*Cost aggregation:*
- Aggregates cost signals from Wave 1 and Wave 2 agents and calculates cost estimates using verified intake context (run volume, concurrency, model selection, usage patterns)

*User-scoped tools:*
- Tools specified by the user that are not in the manifest are evaluated by CV via live lookup — the same per-tool sub-tasks run (version, CVE, EOL, license, pricing, documentation link) with no manifest data as a starting point
- User-scoped tools are eligible for the CV result cache on the same terms as manifest tools — if the same tool and version has been researched within the TTL window, the cached result is reused
- CV flags user-scoped tools as user-specified and unvetted in its output; this label carries through to Pass 1

The CV's full report feeds Pass 1 output directly and is shared input to all six Pass 2 synthesis agents.

*Vendor relationship cache (side effect of CV runs):*

CV captures ownership and affiliate information opportunistically during its vendor documentation visits. When CV encounters ownership details (parent company, acquiring org, subsidiary relationships) while researching a tool, it writes that to a shared vendor relationship cache.

- CV writes to the cache; it does not read from it or use it for compatibility checks
- All cache entries route through the Manifest Gatekeeper before affecting confidence scoring
- Cache entries carry a staleness threshold tied to the tool's refresh cadence — stale entries are re-validated on next CV visit to that vendor
- Coverage is run-driven: only tools that appear in recommendations accumulate relationship data. Low-traffic tools may have no cache entry and fall back to direct-vendor-only zero-scoring.

See Maintenance Manifest — Confidence scoring for how this cache is used to evaluate independence of adoption signals.

*CV result cache:*

A global cache shared across all users and tenants, keyed by tool + version + timestamp. Built from day 1 — iteration volume before settling on a stable description is expected behavior for the primary audience, and retrofitting caching later means refactoring an existing flow.

- First run to research a given tool pays the search cost; all subsequent runs within the TTL window retrieve the cached result
- Cache entry TTL is configurable via the admin dashboard (default: 24 hours); exposed alongside existing refresh thresholds
- Cross-tool compatibility checks are never cached — they depend on the full tool set for a given run and must always re-run
- CV is researching public vendor documentation; one user's research benefiting another is a feature, not a concern
- A CVE or deprecation notice that drops before cache expiry will not be reflected until the next run after TTL — acceptable given the existing daily staleness tolerance elsewhere in the system, and mitigated by setting a shorter TTL if needed

### Domain Conflict Resolution (conditional)

Runs after CV, before Wave 3. Only active when the merged domain brief contains conflict flags.

**Participating agents:** the Wave 1 and Wave 2 agents whose recommendations are directly affected by the flagged constraint conflicts.

**Input:** the flagged conflict pairs from the merged domain brief, plus any constraint violations CV surfaced during its standard cross-agent conflict checks.

**Exchange protocol:**
1. Participating agents share their current recommendations and the specific constraints each is trying to satisfy
2. Agents cooperatively propose a resolution — a jointly acceptable architectural choice that satisfies all conflicting constraints
3. On agreement: each agent updates its output to reflect the resolution; conflict flags are resolved before Wave 3

**Termination:**
- **Resolved:** all participating agents agree; conflict flags are resolved; output proceeds to Wave 3 cleanly
- **Unresolved (no agreement after one cycle):** the conflict passes to The Skeptic flagged for resolution; The Skeptic applies the standard caveat framework

### Wave 3 — Final review

**The Skeptic**
- The primary question The Skeptic hammers on: does this recommendation actually solve what the user described building? Technical correctness and compatibility are table stakes — fitness to the user's specific system is the core challenge.
- Identifies weak points in Waves 1, 2, and 2.5 output and sends them back to the relevant agent(s) with detailed reasoning
- Receiving agent(s) either adopt the suggestion or counter with a reasoned override (e.g. cost impact, latency impact, new attack surface introduced, implementation burden)
- The Skeptic evaluates counter-arguments and accepts or rejects them; accepted overrides are surfaced in the output with their tradeoff reasoning
- No human escalation — ships with a caveat tier if unresolved at cycle cap

**Termination conditions:**
- **Early exit:** if all remaining unresolved concerns would not rise to Advisory (tier 1) when evaluated against the verified intake context, The Skeptic accepts and ships
- **Cycle cap:** hard limit of 4 cycles; on cycle 4, any concerns still above threshold are assigned a caveat tier and output ships

**Skeptic caveat tiers (assigned at cycle cap):**
| Tier | Label | Meaning |
|---|---|---|
| 1 | Advisory | Concern noted, doesn't block. User should be aware. |
| 2 | Blocking Condition | Specific condition must be met before building. Solvable, but not yet solved. |
| 3 | Do Not Build This | Fundamental problem — hard constraint violation, irreconcilable incompatibility, architectural dead end. Prompts user to refine description and re-run. |

> Note: The Skeptic debate protocol generates tradeoff documentation as a side effect — accepted overrides and their reasoning feed directly into Pass 2 ADRs.

### Pass 1 Synthesis — Technical Writer

Runs after Wave 3 completes. Receives the full validated output from Waves 1, 2, and 2.5 plus The Skeptic's final resolved state (accepted overrides with tradeoff reasoning, assigned caveat tiers). Does not receive intermediate debate transcripts — only the resolved output. Produces the Pass 1 document.

This is Pass 1 only. The Technical Writer does not produce Pass 2 content. Pass 2 has dedicated domain synthesis agents.

**Input:**
- Validated recommendations from Waves 1, 2, and 2.5
- The Skeptic's final resolved state: accepted overrides with tradeoff reasoning, any assigned caveat tiers
- Verified intake context (for scope statement and cost estimate grounding)

**Architecture diagram:**
The Technical Writer produces the architecture diagram as part of Pass 1 synthesis. Format is Mermaid flowchart — text that renders as a visual diagram in the frontend via Mermaid.js, exportable as SVG or PNG. The source text is stored alongside the rendered output so users can copy it.

- Direction: chosen by the Technical Writer based on the shape of the architecture. Pipeline flows typically read better left-to-right; hub-and-spoke or DAG patterns may read better top-down.
- Abstraction level: decision-maker, not implementation detail. Major components and flows; related components grouped into subgraphs; implementation detail omitted. The Technical Writer decides what to include and at what level of abstraction for the Pass 1 audience — the same judgment it applies to the executive summary. Full component detail is reserved for Pass 2.
- Caveated components are visually distinguished (e.g., border style or label) so the diagram and the caveat tier callouts in the executive summary are legible together

**Skeptic debate summary (included in Pass 1 executive summary):**
The Technical Writer receives the Skeptic's cycle count, concern count, resolution count, and caveat tier assignments as structured input. It produces a one-sentence debate summary for the executive summary: e.g. "The system raised 4 concerns during analysis — 3 were resolved by the domain agents with documented tradeoffs, 1 remains as an Advisory." This makes the rigor visible without exposing internal debate transcripts.

**Tone and framing:**
- Plain English, jargon-light, intellectually respectful throughout
- Caveat tiers from The Skeptic are framed in plain language; tier determines prominence: Advisory surfaces as a footnote; Blocking Condition surfaces as a named callout; Do Not Build This leads the document and prompts the user to refine their description and re-run
- Scope statement included in the executive summary (agentic architecture only; what is out of scope and why)
- Non-established components called out briefly in the executive summary with a reference to the validated tool manifest for detail

**Voice directive:**
Direct and specific. Name components. Describe what they do and why they were chosen for this architecture. State tradeoffs plainly. No marketing language, no generic optimism, no reassurance. A senior engineer reading this should feel the system understood their specific problem — not that it generated a document about agentic architecture in general. If two components were considered and one was rejected, say so and say why. If a tradeoff has a real cost, name the cost.

**Faithfulness constraint:**
The Technical Writer does not editorialize. Its judgment calls are structural — what to show, at what abstraction level, how to frame for the audience — not substantive. Concern strength, tradeoff weight, and caveat severity are determined by earlier agents and The Skeptic; the Technical Writer represents them faithfully in plain language.

### Pipeline failure handling

**Two types of checkpoints:**

- **Transient checkpoints:** exist within a single run attempt. Used by the retry mechanism -- if an agent fails, its transient checkpoint allows retry without re-running any prior agent. Discarded when the run completes (success or terminal failure).
- **Persistent checkpoints:** each agent's structured output is written to a persistent store as it completes. Reusable across runs when validity conditions are met (see below). This is the same pattern as the CV result cache -- expensive work cached so subsequent runs with the same context don't pay for it again.

CV's work is further decomposed into independently checkpointable sub-tasks (per-tool, cross-tool, cross-agent, cost aggregation) -- each sub-task produces its own persistent checkpoint.

**Cross-run checkpoint reuse:**

A persistent checkpoint is valid for reuse on a subsequent run when all four conditions hold:
1. Verified context hash is identical -- same description, confirmed selections, and hard constraints
2. Agent version is unchanged since the checkpoint was created
3. The manifest has not been refreshed since the checkpoint was created (applies to agents that read from the manifest)
4. All upstream checkpoint hashes match -- if any upstream agent re-ran and produced different output, this checkpoint is stale even if conditions 1-3 hold. Each checkpoint stores the hashes of all checkpoints it depended on (stored in the upstream_hashes field). Reuse is only valid when all upstream hashes are identical.

When a run starts, the system checks for a valid persistent checkpoint for each agent. Agents with valid checkpoints are skipped; only agents without valid checkpoints execute. This directly reduces cost and latency for users iterating toward a stable description -- the expected behavior for the primary audience.

Persistent checkpoints carry a TTL configurable via the admin dashboard. The default TTL is tied to the manifest refresh cadence for manifest-reading agents; for CV per-tool sub-tasks, the existing CV result cache TTL applies.

**Retry policy:** Each agent and each CV sub-task retries with exponential backoff on transient failure. If retries are exhausted, failure escalation applies.

**Failure escalation:**

| Component | On retry exhaustion |
|---|---|
| Wave 0, Wave 1, Wave 2 agents | Run fails entirely — no partial output, no charge |
| Domain Conflict Resolution agents | Run fails entirely |
| CV — cross-tool and cross-agent checks | Run fails entirely — safety-critical |
| CV — per-tool sub-tasks: CVE, compatibility | Run fails entirely — safety-critical |
| CV — per-tool sub-tasks: pricing, EOL, license | Ships flagged as unavailable with a direct link to vendor documentation for manual verification |
| The Skeptic | Run fails entirely |
| Technical Writer | Run fails entirely |

**User notification:** plain-language message that the run encountered a problem; no technical detail exposed. No charge applied.

**Run history:** failed runs do not produce a run history entry. Persistent checkpoints from agents that completed before the failure are retained and remain eligible for reuse on the next run.

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

**Staleness threshold:** Tier-based and configurable via the admin dashboard — see Refresh cadence table above for defaults. Tier 2/3 tools refresh only when referenced by a run.

**Refresh failure handling:**
- Refresh retries with exponential backoff on failure
- If retry succeeds: normal flow
- If retries are exhausted: manifest age is checked against the configurable max staleness threshold (default: 2x the normal refresh threshold per entry type)
  - **Within max staleness threshold:** run proceeds. Admin is notified via a flag in Manifest health. No user-visible change — manifest staleness within tolerance does not affect output quality or user cost.
  - **Beyond max staleness threshold:** run is blocked. User sees a plain-language "temporarily unavailable, please try again later" message. Admin is notified that manual investigation is required.

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
**Produced by:** The Technical Writer (Pass 1 Synthesis) — see agent pipeline section.

Contains:
- Executive summary — includes a brief callout if any non-established components are in the recommendation set (e.g. "two components in this architecture are emerging patterns — see the tool manifest for detail"); includes a plain-language scope statement making clear that this recommendation covers the agentic architecture only. Traditional software concerns — hosting, deployment, UI, standard observability infrastructure — are outside scope and assumed to be within the builder's existing capabilities. Where those concerns intersect with agentic-specific behavior in ways that may surprise an experienced engineer, they are explicitly flagged in the relevant section.
- Architecture diagram — Mermaid flowchart rendered in the frontend, exportable as SVG or PNG. Decision-maker abstraction level: major components and flows, implementation detail omitted. See Technical Writer spec for diagram constraints.
- Validated tool manifest — each tool and pattern carries a maturity label derived from its manifest state: **Established** (full inclusion), **Emerging** (probationary), **Experimental** (flagged/confidence declining), or **User-specified** (not in manifest, live-researched). Labels are manifest-derived, not agent-generated. Each label includes a click-to-expand explanation sourced from the manifest entry's confidence scoring data: adoption signal count, source tier breakdown, time-without-contradicting-evidence, and what would be needed to reach the next tier. This makes the confidence scoring system a visible trust signal, not a hidden mechanism.
- Cost estimates (ongoing operational cost, surfaced here because almost every stakeholder needs to speak to it)
- Security summary (trust boundaries defined, controls in place — reassuring without reading like a pentest report)
- Failure modes summary (key agentic failure risks identified for this architecture, eval approach for non-deterministic outputs, where reasoning chain tracing applies — what can go wrong and how the architecture addresses it, at decision-maker abstraction level)
- Trust and control summary (HITL gate placements and rationale, autonomy level enforcement points — where humans are in the loop and why, framed for a decision maker communicating oversight design to stakeholders)

**Export and sharing:**
- **PDF export** — full Pass 1 document at the owner's tier level, suitable for attaching to email, Slack, or a presentation
- **Architecture diagram** — SVG or PNG export; Mermaid source stored alongside for copying (Pass 1 tier only — diagram is not included in free tier output)
- **Shareable view-only link** — no account required to view. Recipients see exactly what the owner's tier unlocks: full Pass 1 for a Pass 1 purchaser, limited output for a free tier user. No paid content is exposed beyond what the owner has access to.

### Pass 2 — Implementation layer (user-initiated)
**Audience:** The builder who will implement the architecture.
**Trigger:** User clicks through after reviewing Pass 1 and feeling confident in the direction.
**Input:** Raw outputs from all recommendation pipeline agents (Waves 1, 2, and 2.5, and The Skeptic) plus verified intake context. The rendered Pass 1 document is a human artifact and is not re-fed into the pipeline.

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

**Export and sharing:**
- **Markdown export** — per section (ADRs, configuration, specs individually); builders can drop sections directly into a repo or wiki
- **Copy to clipboard** — available per section
- **Shareable link** — requires an account to view; Pass 2 content is implementation detail intended for the builder's team, not for broad distribution

---

## Pricing and access tiers

Output is gated by tier. The Pass 1 pipeline (Waves 0, 1, 2, 2.5, and 3) runs only after the user has confirmed all intake inferences and clicked Analyze — nothing expensive executes during intake or on the review screen. All Pass 1 runs execute the full pipeline; gating is applied at render time only. Pass 2 is a separate user-initiated run and never executes automatically.

**What counts as a run:** A run is one complete pipeline execution that produces Pass 1 output. Each click of "Analyze" that completes successfully is one run. Loading a past run's verified context and re-submitting is a new run. Reviewing past output in run history is not a run. Re-inference triggered by edits on the review screen is part of intake, not a run. A pipeline execution that fails before producing output is not a run: no charge and no count against the daily limit. Pass 2 generation is a separate run and never counts toward the free tier daily limit.

| Tier | What the user receives | Price |
|---|---|---|
| Free | Exec summary + validated tool list with maturity labels (Established / Emerging / Experimental / User-specified); CV category titles visible, values blurred; up to 3 runs/day | $0 |
| Run Pack | 5 additional free-tier runs (same limited output as the free tier); purchasable when the daily limit is reached; for the description iteration phase | $9 / pack |
| Pass 1 | Full Pass 1 output: architectural diagram, full CV detail (version, CVEs, license, EOL, breaking changes, pricing and tier data, regional availability, vendor documentation links), cost estimates, security summary | $49 / run |
| Pass 2 | Full Pass 2 output: ADRs, configuration, specs | $199 / run (requires Pass 1) |

**Free tier rate limit:**
- Users may run up to 3 free runs per day
- The limit is disclosed before the user clicks "Analyze" for the first time — no surprises at the paywall
- After 3 free runs, additional free-tier runs require a Run Pack purchase; full Pass 1 output requires a Pass 1 purchase

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
- Every Pass 1 run executes the full pipeline regardless of tier. Tier determines which parts of the output are shown, blurred, or hidden, not the quality of the underlying analysis. This keeps the architecture simple and ensures free tier output is genuinely trustworthy.
- The Run Pack (5 runs for $9) exists because even expert users need a large number of iterations to land a stable description — observed behavior from the primary audience (senior technical builders) before the Spec Scaffold was introduced is 15-20+ attempts on mid-flight projects. The Spec Scaffold reduces this, but the Run Pack serves the gap between "still iterating" and "ready to pay $49 for the full recommendation." It is not a conversion driver — it is a retention mechanism for high-intent users who aren't ready to commit to Pass 1 yet. The 3 free runs/day limit is a cost control mechanism; the Run Pack removes friction for users who hit it. Run Pack pricing targets cost coverage at launch; adjust based on measured per-run cost from initial production runs.

---

## Settled decisions

### Data model

Core tables. All use PostgreSQL. Drizzle ORM for migrations and type-safe queries. Every table carries `created_at timestamp default now()`. Multi-tenancy forward: `owner text default 'global'` on tables that will support per-tenant overrides.

| Table | Primary purpose | Key columns |
|---|---|---|
| `users` | Auth + billing | id, email, tier (free/pass1/pass2), mfa_enabled, suspended, daily_run_count, daily_run_reset_at |
| `runs` | Run storage and state | id, user_id, status, tier, verified_context (jsonb), verified_context_hash, wave0_domain_tag, pass1_output (jsonb), pass2_output (jsonb nullable), maturity_label_distribution (jsonb), charged |
| `run_checkpoints` | Cross-run reuse | id, run_id, agent_name, wave, status, output_jsonb, upstream_hashes (jsonb), agent_version, manifest_version, context_hash, expires_at |
| `cv_result_cache` | Cross-user tool cache | id, tool_name, tool_version (UNIQUE pair), cve_status, compat_status, pricing, eol_date, license, breaking_changes, regional_availability, source_url, cached_at, ttl_seconds |
| `manifest_entries` | Tool/pattern knowledge base | id, tool_name (UNIQUE), category, maturity_tier, confidence_score, adoption_signals (jsonb), maintenance_signals (jsonb), platform_compat (jsonb), model_compat (jsonb), last_refreshed_at, owner |
| `org_list` | Practitioner org registry | id, org_name, tier, signals (jsonb), maintenance_active, last_reviewed_at, owner, status |
| `org_list_proposals` | Pending org changes | id, org_id, action (add/remove/tier-change), justification, sources (jsonb), status, second_pass_findings (jsonb nullable) |
| `vendor_relationship_cache` | Affiliate/parent relationships | id, vendor_name, parent_org, affiliates (jsonb), cached_at |
| `config` | All runtime-configurable thresholds | key, value, owner — PRIMARY KEY (key, owner) |
| `user_holds` | Per-user org holds | id, user_id, org_id, lifted_at nullable, research_findings (jsonb nullable) |
| `admin_holds` | Admin-level org holds | id, org_id, resolved_at nullable, resolution, flagged_by |
| `jobs` | BullMQ job metadata mirror | id, type, status, payload (jsonb), run_id nullable — primary job state lives in Redis/BullMQ; this table is for admin observability only |

**Required indexes in initial migration** (see settled decisions — Database indexes).

### System architecture

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Language and runtime | TypeScript throughout (Node.js) | Frontend is React/TypeScript; TypeScript backend keeps shared types across frontend, workers, and agent layer; Anthropic TS SDK is feature-identical to Python SDK for this use case; single language for code review | 2026-04-27 |
| Web framework | Next.js (App Router) | Full-stack TypeScript; React frontend; API routes for quick endpoints (auth, intake submission, run history); long-running pipeline execution handled by separate BullMQ workers, not API routes | 2026-04-27 |
| Job queue | BullMQ v5 + Redis | TypeScript-first; FlowProducer API maps directly to the wave structure (Wave 1 children run in parallel, Wave 2 depends on Wave 1 outputs, etc.); OpenTelemetry support; durable across server restarts | 2026-04-27 |
| Database | PostgreSQL | Industry standard for this relational workload; handles run history, manifest entries, org list, checkpoint state, CV result cache, and job state | 2026-04-27 |
| Prompt caching | Three-layer cache breakpoints per agent, explicit cache_control in every SDK call | Layer 1: system prompt + specialist instructions (cache_control: ephemeral, 5-min TTL); Layer 2: full manifest as context (cache_control: ephemeral); Layer 3: verified context + upstream outputs (no cache, changes per run). Cache reads at 10% of input token cost — reduces per-run LLM cost 60-90% within TTL. Must be implemented from day 1 on every agent caller — retrofitting later touches every file. The admin dashboard's cached token split is the primary cache health signal. | 2026-04-27 |
| Monorepo structure | packages/ with web/, workers/, agents/, shared/, evals/ | web/ = Next.js App Router; workers/ = BullMQ workers (pipeline execution, no timeout limits); agents/ = prompt template files (versioned by file hash) + Zod output schemas + Anthropic SDK callers; shared/ = TypeScript types, DB client (Drizzle ORM), config resolution; evals/ = LLM quality evals (Vitest + real API calls, manual trigger only, never in CI) | 2026-04-27 |
| Agent versioning | Date prefix + file hash: YYYY-MM-DD-{sha256_8chars} of the prompt template file | Automatic — no manual version bumping; readable in logs and dashboards; hash changes when prompt changes, guaranteeing checkpoint invalidity on prompt update | 2026-04-27 |
| Agent output schemas | Zod schema per agent, validated on every SDK call before output is returned | Catches structural drift (wrong field names, missing required fields, extra nesting) immediately at the inter-agent boundary rather than propagating corrupt data into downstream waves | 2026-04-27 |
| BullMQ wave mapping | BullMQ FlowProducer for the wave structure | Wave 1 agents are FlowProducer children; Wave 2 is the parent job that waits for all Wave 1 children; Wave 2.5 waits for Wave 2; Wave 3 waits for Wave 2.5. No custom parallel orchestration needed — FlowProducer handles it natively. | 2026-04-27 |
| Database indexes | Four composite indexes in the initial migration | run_checkpoints(context_hash, agent_name, agent_version, manifest_version) for checkpoint reuse lookups; cv_result_cache(tool_name, tool_version) unique constraint covers cache lookups; runs(user_id, created_at DESC) for run history; manifest_entries(maturity_tier, platform_compat) for intake options. Must be in the initial migration — retrofitting after data accumulates requires a blocking table rewrite. | 2026-04-27 |
| Pipeline runs | Two separate runs | Single pass optimizes for two audiences simultaneously and does neither well | 2026-04-14 |
| Reasoning layer | Agent layer only | UI displays and captures; reasoning must not split into the frontend | 2026-04-14 |
| Pipeline execution durability | Durable job queue (e.g., BullMQ + Redis or Celery + Redis) | Pipeline is fully server-side and must survive server restarts; checkpoints are the recovery mechanism but require a job queue to detect and retry uncompleted jobs from their last checkpoint | 2026-04-26 |
| System configuration | Admin dashboard with runtime-configurable thresholds | Refresh cadences, confidence thresholds, and cycle caps change as demand and the tooling landscape evolve — hardcoding them requires a deploy to tune | 2026-04-20 |
| Config data model | All thresholds stored with an owner identifier; global default is `owner = global` | Per-tenant config overrides are additional rows with `owner = tenant_id` — no schema change needed when multi-tenancy is added | 2026-04-20 |
| Config resolution pattern | Always check for tenant-specific override first, fall back to global default | Builds the lookup pattern now so adding per-tenant config later is a data change, not a code change | 2026-04-20 |
| Multi-tenancy | Deferred — design only | White-label consultancy version is a future feature; initial build is single-tenant | 2026-04-20 |
| Free tier abuse prevention | Email verification + per-IP account creation rate limiting; admin visibility for consecutive daily-limit accounts and multi-account IP patterns | MFA already raises the bar; email verification and IP rate limiting close the multi-account gap; usage pattern signals are free given data already collected for rate limiting and conversion tracking | 2026-04-25 |

> **Multi-tenancy and configuration design notes**
>
> Multi-tenancy is deferred, but several design decisions made now ensure it can be added without rearchitecting.
>
> *Governance model:* The existing owner/admin role, user-level holds, and scoped run history map directly to a multi-tenant model. When implemented, this extends to: shared base manifest with tenant-level additive/suppressive overrides gated by the Manifest Gatekeeper; no tenant-level modification of base confidence scores; per-tenant domain agent registration. Data model should carry a `tenant_id` from day one.
>
> *Config model:* All configurable thresholds (refresh cadences, confidence bands, cycle caps, hold thresholds) are stored as records with an owner identifier — `owner = global` for the system defaults. Per-tenant overrides are additional rows with `owner = tenant_id`. No schema change is needed when multi-tenancy is added.
>
> *Config resolution:* When the system looks up any threshold, it checks for a tenant-specific override first, then falls back to the global default. This lookup pattern is built into the initial single-tenant product — all lookups currently return the global default, but the pattern is already in place. Adding per-tenant manifest refresh schedules or threshold overrides later is a data addition, not a code change.
>
> *Org list data model:* The `owner` field pattern applies to org list entries as well as config thresholds. All current entries are `owner = global`. The data model supports `owner = tenant_id` entries from day one — a tenant with a legitimate need to elevate a specific org for their own runs (e.g. a white-label tenant whose customers are integrating that org's products) can do so without a schema change. The confidence scoring pipeline is built to filter org list entries by owner at query time. Governance: tenant-scoped org list entries are established by the global admin at white-label setup time and locked — no tenant-facing UI or self-service capability. Changes require a change order back to the global admin and follow the same approval flow as any other org list modification.

### Maintenance manifest

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Manifest knowledge freshness | On-demand refresh | Keeps available options and patterns current for intake UI and agent recommendations | 2026-04-15 |
| Manifest governance | Confidence scoring + source weighting + staged inclusion | Handles quality/relevance disputes without over-relying on human escalation | 2026-04-14 |
| Schema changes | Automatic human escalation | Too broad an impact to leave to agent consensus | 2026-04-14 |
| Manifest refresh | On-demand, lazy trigger | No wasted cycles during quiet periods; naturally scales with usage | 2026-04-14 |
| Manifest staleness threshold | Tier-based; configurable via admin dashboard | Tier 1 tools default to 2 weeks; architecture patterns to 4 weeks; Tier 2/3 tools refresh only when referenced by a run | 2026-04-21 |
| Manifest refresh UX | Background on UI open; blocks only if user submits before refresh completes | User writing their description usually covers the refresh window | 2026-04-14 |
| Manifest refresh failure | Retry with backoff; within max staleness threshold proceed silently (admin notified); beyond threshold block with generic unavailable message | Stale manifest within tolerance produces identical user-visible output — no reason to notify the user; admin needs to know regardless | 2026-04-25 |
| Gatekeeper rejected entries | Dropped, no queue | Next refresh cycle is the retry mechanism | 2026-04-14 |
| User-scoped tools | Run-scoped, live-researched, flagged as unvetted in output | Keeps manifest integrity intact while still evaluating user-specified tools | 2026-04-14 |

### Intake

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Intake inference | Single stateful agent, sequential reasoning across steps | Inter-step dependencies handled naturally; 85% accuracy bar does not justify per-step specialist agents; users can correct any wrong inference | 2026-04-14 |
| Intake inference malformed output | Schema-validated before UI presentation; malformed output falls back to low-confidence state (nothing pre-selected) for affected step(s) | User experience is identical to a legitimate low-confidence inference; avoids silent crashes on the highest-visibility surface in the system | 2026-04-26 |
| Step inference states | Three states: high confidence (pre-selected), low confidence (nothing selected), not applicable (nothing selected, brief message); more info accordion collapsed by default in all states | Anchoring users on weak inferences is worse than showing nothing; auto-expanding the accordion is condescending for senior technical builders | 2026-04-25 |
| Constraint collection and classification | Collected with project description, before inference runs; classified as binary exclusion or optimization target | Binary exclusions filter the option set before inference; optimization targets are weighting signals passed to agents — near-zero run cost addition, closes the gap where cost/overhead preferences would otherwise be ignored or incorrectly treated as exclusions | 2026-04-25 |
| Binary exclusion exhaustion | Step still surfaces with a warning; user can add manually, adjust constraints, or proceed; agents attempt to find viable options outside the manifest; The Skeptic assigns caveat tier if irreconcilable | Suppressing an exhausted step hides the problem; agents are better positioned than intake to reason about options outside the manifest | 2026-04-25 |
| Review screen | Fully editable; final step before submission | User sees full verified context together for the first time; edits trigger re-inference on affected steps only with explicit downstream impact confirmation | 2026-04-20 |
| Agent input | Verified structured context only | Prevents downstream agents from reasoning from bad intake inference | 2026-04-14 |
| Options source | Maintenance manifest only, except step 3 (External integrations) which is free-text user input | Step 3 asks users to describe their own systems — APIs, databases, cloud services — not to select from a predefined list | 2026-04-23 |
| Tools step | Step 11, always surfaces after model confirmation; multi-select with conditional pre-population | Tool options depend on both platform and model; step always surfaces so user-specified tools can be added even when manifest coverage is thin | 2026-04-23 |

### Agent pipeline

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Intake trust boundary | User description is wrapped in an explicit trust boundary in the intake agent prompt (XML tags or clear delimiter with a system-level instruction that content between delimiters is user-provided text, not instructions) | Prevents prompt injection via project description; the intake agent must treat user text as data to reason about, not as instructions to follow | 2026-04-26 |
| Skeptic eval harness | A fixed eval set of architecture descriptions with known failure modes and expected caveat tiers; runs on every Skeptic prompt change; managed separately from the recommendation pipeline | The Skeptic is the primary quality gatekeeper; non-deterministic output requires a structured eval set to detect regression — manual QA cannot catch prompt-change degradation reliably | 2026-04-26 |
| Domain-specific expertise | Wave 0 plugin — produces typed constraint brief before Wave 1 | Domain agents produce constraints, not recommendations; Wave 0 narrows the solution space before other agents reason into it; downstream agents receive brief as context with no modification | 2026-04-20 |
| Domain agent interface | Standardized schema (typed constraint brief); tenant supplies endpoint or Claude API tool definition | Structured output lets downstream agents reason reliably; free text would require each agent to re-parse domain requirements | 2026-04-20 |
| Security scope | Agentic-specific attack surface only | Traditional security checklist is out of scope for the agent layer | 2026-04-14 |
| Trust & Control placement | Wave 2 (cooperative with Failure & Observability) | T&C and F&O have a bidirectional dependency; cooperative exchange resolves it without forcing a sequential ordering that benefits one at the expense of the other | 2026-04-23 |
| Wave 2 cooperative model | F&O leads the exchange; 2-cycle cap; unresolved tensions pass to The Skeptic | F&O → T&C is the stronger dependency direction; gate placement should incorporate failure mode context; cycle cap keeps cost bounded | 2026-04-23 |
| CV placement | Wave 2.5 — standalone, after Wave 2 completes | CV validates the full recommendation set from Waves 1 and 2 before The Skeptic reviews; aggregates cost signals from both waves | 2026-04-23 |
| Domain conflict resolution | Conditional cooperative step between CV and Wave 3; owned by the relevant domain agents | CV detects constraint violations; resolution requires architectural reasoning that belongs with the domain experts, not CV; 1-cycle cap keeps cost bounded | 2026-04-25 |
| Skeptic early exit threshold | No concerns at or above Advisory (tier 1) across any dimension, evaluated against verified intake context | Ties the early exit condition to the existing caveat tier system — gives The Skeptic a concrete, consistent question to answer rather than an undefined threshold | 2026-04-25 |
| Pipeline failure handling | Transient checkpoints for within-run retry; persistent checkpoints for cross-run reuse; safety-critical failures fail the run; non-critical CV sub-tasks ship flagged with documentation link | Agent-level checkpointing preserves all completed work; cross-run reuse reduces cost for iterating users -- consistent with CV result cache pattern already in the spec | 2026-04-25 |
| Wave 1 agent distinctness | All four Wave 1 agents kept separate | Orchestration and Tool & Integration share a surface-level concern but use different reasoning frameworks — merging them produces shallower output on at least one domain for an audience that will notice wrong recommendations | 2026-04-23 |

### Compatibility Validator

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Compatibility Validator freshness | Live web search per run | Ensures version, compatibility, and pricing data is current at evaluation time — the manifest does not serve as a source for CV checks | 2026-04-15 |
| Compatibility Validator in Pass 2 | Shared input to all synthesis agents, no synthesis counterpart | Cross-cutting data; not a domain with its own ADRs or specs | 2026-04-14 |

### Output

| Decision | Choice | Reason | Decided |
|---|---|---|---|
| Cost visibility | Surfaced in Pass 1 | Every stakeholder needs to speak to ongoing cost | 2026-04-14 |
| Pass 1 synthesis | Technical Writer agent, runs after Wave 3 | Synthesis-to-critique and synthesis-to-document are different tasks; The Skeptic produces validated debate output, not a readable document; keeping them separate prevents the critique lens from coloring the Pass 1 framing | 2026-04-23 |
| Architecture diagram format | Mermaid flowchart, produced by Technical Writer | Agent-producible text that renders without image generation; familiar to the target audience; exportable as SVG or PNG; abstraction level is a judgment call made by the Technical Writer for the decision-maker audience | 2026-04-23 |
| Architecture diagram render failure | Technical Writer validates Mermaid syntax before Pass 1 finalizes; if validation fails, retries once with the error as feedback; if retry fails, Pass 1 renders a placeholder: "Architecture diagram unavailable — view the component list below" | Broken diagrams in the primary conversion surface are worse than missing diagrams — they signal system failure to the target audience | 2026-04-26 |
| Pass 2 trigger | User-initiated | Only pays for deep run when user explicitly wants it | 2026-04-14 |
| Pass 2 architecture | Dedicated synthesis agents, one per recommendation domain | Expanding validated output is a different job than producing recommendations; re-running the wave model would re-derive what is already settled | 2026-04-14 |
| Pass 2 input | Raw agent outputs from all waves + verified intake context | Rendered Pass 1 is for humans; synthesis agents need the underlying detail | 2026-04-14 |
| Pass 1 sharing | View-only link (no account required); recipient sees owner's tier output | Decision-makers receiving shared links are the target Pass 1 audience; friction-free access serves the user and markets the product; no paid content exposed beyond owner's tier | 2026-04-25 |
| Pass 2 sharing | Shareable link requires account; Markdown export per section | Pass 2 is implementation detail for the builder's team; Markdown drops directly into repos and wikis | 2026-04-25 |
