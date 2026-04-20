# Handoff — Agentic Architecture Recommender

## What we accomplished this session

- Reviewed LinkedIn newsletter teaser and chapter 1 draft; identified factual inconsistencies in chapter 1 (timeline, "scrap" vs "distillation" framing); user will revise in Claude.ai
- Resolved confidence scoring tier bands: Established (≥7), Emerging (4–6), Experimental (1–3); drop at 0 on next refresh
- Resolved staged inclusion justification: exists to power maturity labels (Established / Emerging / Experimental), which are a credibility signal for the target audience — not just a tracking mechanism
- Resolved vendor relationship cache: CV captures ownership and affiliate data opportunistically during vendor documentation visits; routes through Manifest Gatekeeper before affecting scoring; staleness tied to tool refresh cadence; coverage is run-driven
- Resolved independence scoring: vendor self-adoption scores zero; affiliate adoption scores zero; only genuinely independent adopters count toward confidence score
- Resolved practitioner org list in full: tiered governance, seed list, scoring signals, Org List Gatekeeper with human approval required for all changes, mutual challenge rights between gatekeepers, periodic and on-demand review, urgent flags at admin and user level, aggregate user hold signal to owner/admin
- Resolved confidence scoring simplification: no fixed numeric formula; agent-determined weighting based on signal strength and independence; Gatekeeper uses judgment, not arithmetic
- Resolved manifest initial population: flagged as open question dependent on org list (now resolved); human-curated seed list required before system can run
- Clarified UI hosting: Claude.ai is not a product distribution mechanism; real product requires web app + Claude API backend; token costs accrue to API account owner

## Key decisions made this session

- **Staged inclusion is justified by maturity labels.** The mechanism exists to power Established / Emerging / Experimental labels in Pass 1 output, which are a credibility signal for senior technical builders. Without staged inclusion, only Established and User-specified labels are possible.
- **Confidence scoring uses no fixed formula.** Tier weighting is agent-determined based on signal strength and independence. Locking in point values before seeing real data would create false precision.
- **Vendor self-adoption scores zero.** A vendor using their own tool conveys no information about quality. Affiliate adoption also scores zero. The vendor relationship cache (CV side effect) is the mechanism for evaluating independence.
- **Org list has its own gatekeeper with human approval required for all changes.** More load-bearing than the manifest — a bad org list entry corrupts adoption signals system-wide. All changes require owner/admin approval, with a second research pass if the human overrides the Gatekeeper's recommendation.
- **Urgent flags exist at two levels.** Admin-level holds affect all runs system-wide. User-level holds affect only that user's runs. User holds are surfaced to admin in aggregate as an early warning signal.
- **Cognition/Devin excluded from org list.** Hype without genuine practitioner adoption signals. Product went quiet. Failed the recency qualifier and the independence-of-evidence test.
- **UI hosting via Claude.ai is not viable.** Token costs always accrue to the API account owner, not end users. Real product needs web app + API backend.

## Practitioner org list seed list

**Tier 1 — Market influence**
Anthropic, OpenAI, Google/DeepMind, Microsoft, Amazon/AWS, Meta, Nvidia

**Tier 1 — Deep commitment across multiple signals**
- LangChain — LangGraph, LangSmith, extensive engineering publications
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

## What's immediately next

1. **Define manifest data structure and query pattern** — full load, filtered lookup, or embedding search; last open spec question
2. **Write CLAUDE.md** — architectural guardrails for Claude; spec is nearly solid
3. **Curate manifest seed list** — org list is now resolved; initial population can proceed

## Open questions (remaining)

- What is the manifest's data structure and query pattern?
- Manifest initial population: human-curated seed list needed before system can run; org list dependency now resolved

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
