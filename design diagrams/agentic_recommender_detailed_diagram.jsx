import { useState } from "react";

const COLORS = {
  bg: "#ffffff",
  surface: "#f8f8f8",
  border: "#cccccc",
  borderBright: "#999999",
  text: "#111111",
  textMuted: "#444444",
  textDim: "#888888",
  wave0: "#222222",
  wave1: "#222222",
  wave2: "#222222",
  wave3: "#222222",
  pass2: "#222222",
  maintenance: "#555555",
  admin: "#555555",
  intake: "#222222",
  output: "#222222",
};

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${COLORS.bg};
    color: ${COLORS.text};
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
  }

  .diagram-root {
    background: ${COLORS.bg};
    min-height: 100vh;
    padding: 32px 24px 64px;
  }

  .header {
    text-align: center;
    margin-bottom: 48px;
  }

  .header h1 {
    font-family: 'Space Mono', monospace;
    font-size: 22px;
    font-weight: 700;
    color: ${COLORS.text};
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  .header p {
    font-size: 13px;
    color: ${COLORS.textMuted};
    letter-spacing: 0.02em;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    margin-bottom: 40px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: ${COLORS.textMuted};
    font-family: 'Space Mono', monospace;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }

  .layout {
    display: grid;
    grid-template-columns: 220px 1fr 220px;
    gap: 24px;
    max-width: 1400px;
    margin: 0 auto;
  }

  /* ── COLUMNS ─────────────────────────────── */
  .col-left, .col-right {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .col-center {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  /* ── PANELS ──────────────────────────────── */
  .panel {
    border-radius: 8px;
    border: 1px solid ${COLORS.border};
    background: ${COLORS.surface};
    overflow: hidden;
  }

  .panel-header {
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid ${COLORS.border};
  }

  .panel-header-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .panel-title {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .panel-body {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  /* ── AGENT BOXES ─────────────────────────── */
  .agent-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .agent-row {
    display: flex;
    gap: 6px;
  }

  .agent {
    flex: 1;
    border-radius: 6px;
    border: 1px solid;
    padding: 8px 10px;
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
  }

  .agent:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  }

  .agent-name {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }

  .agent-desc {
    font-size: 10px;
    line-height: 1.4;
    color: ${COLORS.textMuted};
  }

  .agent-tag {
    font-family: 'Space Mono', monospace;
    font-size: 9px;
    color: ${COLORS.textDim};
    margin-top: 4px;
  }

  /* ── WAVES ───────────────────────────────── */
  .wave-container {
    position: relative;
  }

  .wave-label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 0 8px 0;
    margin-top: 20px;
  }

  .wave-label:first-child {
    margin-top: 0;
  }

  .wave-badge {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 4px;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .wave-line {
    flex: 1;
    height: 1px;
    background: ${COLORS.border};
  }

  .wave-note {
    font-size: 10px;
    color: ${COLORS.textDim};
    font-style: italic;
    white-space: nowrap;
  }

  /* ── ARROWS ──────────────────────────────── */
  .arrow-row {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 28px;
    gap: 4px;
  }

  .arrow-line {
    width: 1px;
    height: 100%;
    background: ${COLORS.border};
  }

  .arrow-label {
    font-size: 9px;
    color: ${COLORS.textDim};
    font-family: 'Space Mono', monospace;
  }

  /* ── TOOLTIP ─────────────────────────────── */
  .tooltip-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(2px);
  }

  .tooltip-card {
    background: #ffffff;
    border: 1px solid #999999;
    border-radius: 10px;
    padding: 24px;
    max-width: 480px;
    width: 90vw;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }

  .tooltip-title {
    font-family: 'Space Mono', monospace;
    font-size: 14px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .tooltip-wave {
    font-size: 11px;
    color: ${COLORS.textMuted};
    margin-bottom: 12px;
    font-family: 'Space Mono', monospace;
  }

  .tooltip-body {
    font-size: 13px;
    line-height: 1.7;
    color: ${COLORS.textMuted};
  }

  .tooltip-close {
    margin-top: 16px;
    font-size: 11px;
    color: ${COLORS.textDim};
    cursor: pointer;
    text-align: right;
    font-family: 'Space Mono', monospace;
  }

  .tooltip-close:hover { color: ${COLORS.textMuted}; }

  /* ── FLOW TAG ────────────────────────────── */
  .flow-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 9px;
    font-family: 'Space Mono', monospace;
    padding: 2px 6px;
    border-radius: 3px;
    color: ${COLORS.textMuted};
    border: 1px solid ${COLORS.border};
  }

  .section-label {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: ${COLORS.textDim};
    padding: 6px 0 4px;
    border-top: 1px solid ${COLORS.border};
    margin-top: 6px;
  }

  .item {
    font-size: 11px;
    color: ${COLORS.textMuted};
    padding: 2px 0;
    line-height: 1.4;
  }

  .item::before {
    content: '– ';
    color: ${COLORS.textDim};
  }

  .pass2-agents {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
  }

  .pass2-agent {
    font-size: 10px;
    padding: 5px 7px;
    border-radius: 5px;
    border: 1px solid #bbbbbb;
    color: #222222;
    background: #f0f0f0;
    font-family: 'Space Mono', monospace;
    line-height: 1.3;
  }

  .cv-shared-label {
    font-size: 10px;
    color: ${COLORS.textMuted};
    text-align: center;
    font-style: italic;
    margin-top: 4px;
  }

  .pricing-row {
    display: flex;
    gap: 5px;
  }

  .pricing-tier {
    flex: 1;
    border-radius: 6px;
    border: 1px solid ${COLORS.border};
    padding: 8px 9px;
  }

  .pricing-tier-name {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 3px;
  }

  .pricing-tier-price {
    font-size: 11px;
    color: ${COLORS.textMuted};
    margin-bottom: 4px;
  }

  .pricing-tier-detail {
    font-size: 9px;
    color: ${COLORS.textDim};
    line-height: 1.4;
  }

  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .col-left, .col-right {
      flex-direction: row;
      flex-wrap: wrap;
    }
    .col-left > *, .col-right > * {
      flex: 1;
      min-width: 200px;
    }
  }
`;

const AGENT_DETAILS = {
  intake: {
    title: "Intake Agent",
    wave: "Intake Flow",
    body: "A single stateful agent that runs sequential inference across all 10 intake steps. Takes a user description + hard constraints, pre-populates all steps in one pass. Users confirm or override each step. Re-inference runs only on affected steps when an edit creates downstream dependencies. Sourced entirely from the maintenance manifest — nothing is hardcoded."
  },
  orchestration: {
    title: "Orchestration Agent",
    wave: "Wave 1 — Parallel",
    body: "Recommends the right coordination pattern for this system: pipeline, DAG, supervisor, event-driven, etc. Reasons about coordination topology — distinct from Tool & Integration which reasons about the tool-vs-agent boundary. Produces domain recommendations plus structured cost signals for Wave 2."
  },
  security: {
    title: "Security Agent",
    wave: "Wave 1 — Parallel",
    body: "Covers only the agentic-specific attack surface: prompt injection, tool misuse, excessive autonomy, trust boundary definition, and data exfiltration through reasoning. Traditional security checklists are explicitly out of scope. Output includes trust boundary definitions that Trust & Control depends on."
  },
  memory: {
    title: "Memory & State Agent",
    wave: "Wave 1 — Parallel",
    body: "Covers persistence strategy, shared state design, and memory pattern selection. Note: users frequently don't know if they need memory or state — this agent surfaces its reasoning explicitly rather than just its conclusion. The intake step for this domain has an enhanced 'help me determine' flow with targeted clarifying questions."
  },
  toolint: {
    title: "Tool & Integration Agent",
    wave: "Wave 1 — Parallel",
    body: "Reasons about where the tool-vs-agent boundary should be drawn. Core decision framework: tools for deterministic operations (same input, same output), agents for tasks requiring judgment. Also covers MCP usage and build vs. buy recommendations. Platform-specific tool filtering from the manifest happens within this agent but is not its core value."
  },
  trustcontrol: {
    title: "Trust & Control Agent",
    wave: "Wave 1 — Sequential (after Orchestration + Security)",
    body: "Handles HITL placement and approval gate design. Runs after Orchestration (to know the flow) and Security (to know the risk profile) before placing gates meaningfully. Autonomy level is captured during intake; this agent determines where and how that level is enforced within the specific architecture."
  },
  cv: {
    title: "Compatibility Validator",
    wave: "Wave 2",
    body: "Runs live web search per run — never relies on cached manifest data for compatibility checks. Verifies mutual compatibility across all tool pairs, collects current pricing, aggregates Wave 1 cost signals, and calculates cost estimates. Per-tool: EOL dates, HIGH/CRITICAL CVEs, breaking changes, license (copyleft flagged). Detects cross-agent constraint violations and integration gaps. Also maintains a vendor relationship cache for independence-checking in confidence scoring. CV results cached globally for 24h by default (configurable) — cross-tool compatibility checks are never cached."
  },
  failureobs: {
    title: "Failure & Observability Agent",
    wave: "Wave 2",
    body: "Covers the agentic slice only: cascading agent failures, reasoning loops, tool misuse, non-deterministic outputs, memory corruption across sessions. Eval strategy for non-deterministic reasoning. Tracing reasoning chains and inter-agent handoffs. Explicitly flags intersections where traditional observability approaches need adaptation rather than direct application. Standard observability infrastructure is out of scope."
  },
  skeptic: {
    title: "The Skeptic",
    wave: "Wave 3 — Final Review",
    body: "Core question: does this recommendation actually solve what the user described building? Technical correctness and compatibility are table stakes — fitness to the specific system is the challenge. Identifies weak points and sends them back to relevant Wave 1/2 agents with detailed reasoning. Receiving agents either adopt the suggestion or counter with a reasoned override. Hard cycle cap of 4; unresolved concerns above threshold at cap receive a caveat tier: Advisory / Blocking Condition / Do Not Build This. As a side effect, accepted overrides and their tradeoff reasoning feed directly into Pass 2 ADRs."
  },
  manifestagent: {
    title: "Maintenance Agents",
    wave: "Maintenance Pipeline (asynchronous)",
    body: "Perform scheduled web searches and propose manifest updates for tools, patterns, and intake UI content. Lazy trigger — runs only when demand exists (staleness check on UI open). Tier 1 tools default to 2-week refresh; architecture patterns to 4 weeks; Tier 2/3 tools refresh only when referenced by a run. Proposed updates route through the Manifest Gatekeeper before going live."
  },
  manifestgatekeeper: {
    title: "Manifest Gatekeeper",
    wave: "Maintenance Pipeline",
    body: "Skeptic-type agent that reviews all proposed manifest updates before they go live. Handles factual, recency, categorization, quality/relevance disputes with the proposing agent. Hard 2-cycle cap — disputes unresolved at cap result in rejection (no queue). Schema changes trigger automatic human escalation regardless. Also builds the vendor relationship cache as a side effect of CV runs. Can cross-challenge the Org List Gatekeeper; more conservative position wins."
  },
  orglistgatekeeper: {
    title: "Org List Gatekeeper",
    wave: "Maintenance Pipeline",
    body: "Dedicated gatekeeper governing the practitioner org list (separate from Manifest Gatekeeper because a bad org entry corrupts adoption signals across every tool that org has ever touched). All modifications require human/admin approval — the Gatekeeper proposes, cannot act unilaterally. On admin override, runs a deeper research pass; human decision after second pass is final. Can cross-challenge the Manifest Gatekeeper; more conservative position wins."
  },
  wave0: {
    title: "Wave 0 — Domain Agents",
    wave: "Wave 0 (Conditional, before Wave 1)",
    body: "Runs only when a domain agent is registered for the tenant (e.g. HIPAA, government). Produces a typed constraint brief: required regulatory controls, prohibited tools/patterns, mandatory certifications, scope of applicability. Multiple domain agents can run on a single run — briefs are merged before being passed downstream. All downstream agents receive the constraint brief as additional context without modification. The general-purpose product has no Wave 0."
  }
};

function AgentBox({ id, name, desc, tag, color, onSelect }) {
  return (
    <div
      className="agent"
      onClick={() => onSelect(id)}
      style={{
        borderColor: "#bbbbbb",
        background: "#f5f5f5",
      }}
    >
      <div className="agent-name" style={{ color: "#111111" }}>{name}</div>
      {desc && <div className="agent-desc">{desc}</div>}
      {tag && <div className="agent-tag">{tag}</div>}
    </div>
  );
}

function WaveSection({ label, badge, note, color, children }) {
  return (
    <div className="wave-container">
      <div className="wave-label">
        <div className="wave-badge" style={{ background: "#eeeeee", color: "#111111", border: "1px solid #aaaaaa" }}>{badge}</div>
        <div className="wave-line" style={{ background: "#cccccc" }} />
        {note && <div className="wave-note">{note}</div>}
      </div>
      {children}
    </div>
  );
}

function ArrowDown({ label }) {
  return (
    <div className="arrow-row">
      <svg width="16" height="28" viewBox="0 0 16 28" fill="none">
        <line x1="8" y1="0" x2="8" y2="22" stroke="#aaaaaa" strokeWidth="1.5" />
        <polygon points="8,28 4,20 12,20" fill="#aaaaaa" />
      </svg>
      {label && <span className="arrow-label">{label}</span>}
    </div>
  );
}

function Panel({ title, color, children, style = {} }) {
  return (
    <div className="panel" style={style}>
      <div className="panel-header">
        <div className="panel-header-dot" style={{ background: color }} />
        <div className="panel-title" style={{ color }}>{title}</div>
      </div>
      <div className="panel-body">{children}</div>
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState(null);

  return (
    <>
      <style>{styles}</style>
      <div className="diagram-root">
        {/* Header */}
        <div className="header">
          <h1>AGENTIC ARCHITECTURE RECOMMENDER — SYSTEM DIAGRAM</h1>
          <p>Click any agent to see its role and responsibilities · Full pipeline view</p>
        </div>

        {/* Legend */}
        <div className="legend">
          {[
            { label: "Intake", color: COLORS.intake },
            { label: "Wave 0 (Domain)", color: COLORS.wave0 },
            { label: "Wave 1 (Parallel)", color: COLORS.wave1 },
            { label: "Wave 2 (Sequential)", color: COLORS.wave2 },
            { label: "Wave 3 (Review)", color: COLORS.wave3 },
            { label: "Pass 2 Synthesis", color: COLORS.pass2 },
            { label: "Maintenance", color: COLORS.maintenance },
            { label: "Admin / App Layer", color: COLORS.admin },
          ].map(l => (
            <div className="legend-item" key={l.label}>
              <div className="legend-dot" style={{ background: l.color }} />
              {l.label}
            </div>
          ))}
        </div>

        <div className="layout">

          {/* ── LEFT COLUMN ── */}
          <div className="col-left">

            <Panel title="Application Layer" color={COLORS.admin}>
              <div className="item">User auth + MFA</div>
              <div className="item">Run history per user</div>
              <div className="section-label">Admin Dashboard</div>
              <div className="item">Runtime config thresholds</div>
              <div className="item">Agent version panel + rollback</div>
              <div className="item">Org list approval workflow</div>
              <div className="item">Active holds &amp; user signals</div>
              <div className="item">Manifest health</div>
              <div className="item">Pipeline observability</div>
              <div className="item">Billing &amp; margin visibility</div>
              <div className="item">Conversion metrics</div>
            </Panel>

            <Panel title="Practitioner Org List" color={COLORS.maintenance}>
              <div className="item">Tiered registry of AI-forward orgs</div>
              <div className="item">Adoption = confidence signal</div>
              <div className="section-label">Governance</div>
              <div
                className="agent"
                style={{ borderColor: "#aaaaaa", background: "#f0f0f0", cursor: "pointer" }}
                onClick={() => setSelected("orglistgatekeeper")}
              >
                <div className="agent-name" style={{ color: COLORS.text }}>Org List Gatekeeper</div>
                <div className="agent-desc">Proposes add/remove/tier changes; all changes require human approval</div>
              </div>
              <div className="section-label">Tiers</div>
              <div className="item">Tier 1 — 2+ signals or market influence</div>
              <div className="item">Tier 2 — strong in 1 signal</div>
              <div className="item">Tier 3 — early but credible</div>
              <div className="section-label">Signals</div>
              <div className="item">Engineering publications</div>
              <div className="item">Open-source tooling (active)</div>
              <div className="item">Platform offerings (established)</div>
              <div className="item">Market influence (admin approval)</div>
            </Panel>

            <Panel title="Maintenance Pipeline" color={COLORS.maintenance}>
              <div
                className="agent"
                style={{ borderColor: "#aaaaaa", background: "#f0f0f0", cursor: "pointer" }}
                onClick={() => setSelected("manifestagent")}
              >
                <div className="agent-name" style={{ color: COLORS.text }}>Maintenance Agents</div>
                <div className="agent-desc">Lazy refresh: Tier 1 tools (2wk), patterns (4wk), Tier 2/3 on-demand</div>
              </div>
              <div
                className="agent"
                style={{ borderColor: "#aaaaaa", background: "#f0f0f0", cursor: "pointer", marginTop: 4 }}
                onClick={() => setSelected("manifestgatekeeper")}
              >
                <div className="agent-name" style={{ color: COLORS.text }}>Manifest Gatekeeper</div>
                <div className="agent-desc">Reviews all proposed updates; 2-cycle cap; schema changes → human escalation</div>
              </div>
              <div className="section-label">Confidence Scoring</div>
              <div className="item">≥ 7 → Established (default)</div>
              <div className="item">4–6 → Emerging (probationary)</div>
              <div className="item">1–3 → Experimental (flagged)</div>
              <div className="item">0 → Dropped on next refresh</div>
            </Panel>

          </div>

          {/* ── CENTER COLUMN ── */}
          <div className="col-center">

            {/* USER */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <div style={{
                border: `1px solid ${COLORS.borderBright}`,
                borderRadius: 8,
                padding: "10px 28px",
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                color: COLORS.text,
                background: "#ffffff",
                letterSpacing: "0.06em"
              }}>
                USER
              </div>
            </div>

            <ArrowDown label="description + hard constraints" />

            {/* INTAKE */}
            <WaveSection badge="INTAKE" color={COLORS.intake} note="TurboTax-style guided flow">
              <AgentBox
                id="intake"
                name="Intake Agent"
                desc="Single stateful agent — sequential inference across 10 steps from manifest. Review screen with downstream dependency handling."
                tag="Steps 0–10: Domain context → Orchestration pattern → Platform → Integrations → Data → Memory → Autonomy/HITL → Scale → Greenfield/brownfield → Failure tolerance → Model"
                color={COLORS.intake}
                onSelect={setSelected}
              />
            </WaveSection>

            <ArrowDown label="verified context (confirmed selections + constraints)" />

            {/* WAVE 0 */}
            <WaveSection badge="WAVE 0" color={COLORS.wave0} note="Conditional — only if domain agent registered">
              <AgentBox
                id="wave0"
                name="Domain Agent(s)"
                desc="Produces typed constraint brief: required controls, prohibited tools/patterns, mandatory certs, scope. Merged briefs passed to all downstream agents."
                tag="Tenant-registered · API endpoint or Claude tool definition"
                color={COLORS.wave0}
                onSelect={setSelected}
              />
            </WaveSection>

            <ArrowDown label="verified context + constraint brief" />

            {/* WAVE 1 */}
            <WaveSection badge="WAVE 1" color={COLORS.wave1} note="Mostly parallel">
              <div className="agent-grid">
                <div className="agent-row">
                  <AgentBox id="orchestration" name="Orchestration" desc="Coordination pattern: pipeline, DAG, supervisor, event-driven" color={COLORS.wave1} onSelect={setSelected} />
                  <AgentBox id="security" name="Security" desc="Agentic attack surface: prompt injection, tool misuse, trust boundaries" color={COLORS.wave1} onSelect={setSelected} />
                </div>
                <div className="agent-row">
                  <AgentBox id="memory" name="Memory & State" desc="Persistence strategy, shared state, memory pattern selection" color={COLORS.wave1} onSelect={setSelected} />
                  <AgentBox id="toolint" name="Tool & Integration" desc="Tool-vs-agent boundary, MCP usage, build vs. buy" color={COLORS.wave1} onSelect={setSelected} />
                </div>
                <AgentBox
                  id="trustcontrol"
                  name="Trust & Control"
                  desc="HITL placement + approval gate design"
                  tag="Sequential — runs after Orchestration + Security complete"
                  color={COLORS.wave1}
                  onSelect={setSelected}
                />
              </div>
            </WaveSection>

            <ArrowDown label="Wave 1 outputs + cost signals" />

            {/* WAVE 2 */}
            <WaveSection badge="WAVE 2" color={COLORS.wave2} note="Sequential — depends on Wave 1">
              <div className="agent-grid">
                <AgentBox
                  id="cv"
                  name="Compatibility Validator"
                  desc="Live web search per run: tool compatibility, CVEs, EOL, pricing, cost estimates, cross-agent conflict checks, vendor relationship cache"
                  tag="24h result cache (configurable) · Cross-tool compatibility checks never cached"
                  color={COLORS.wave2}
                  onSelect={setSelected}
                />
                <AgentBox
                  id="failureobs"
                  name="Failure & Observability"
                  desc="Agentic failure modes, eval strategy for non-deterministic reasoning, reasoning chain tracing"
                  color={COLORS.wave2}
                  onSelect={setSelected}
                />
              </div>
            </WaveSection>

            <ArrowDown label="Wave 1 + 2 outputs" />

            {/* WAVE 3 */}
            <WaveSection badge="WAVE 3" color={COLORS.wave3} note="Final review">
              <AgentBox
                id="skeptic"
                name="The Skeptic"
                desc="Does this recommendation actually solve what the user described? Challenges weak points; agents counter or accept with tradeoff reasoning. Cycle cap: 4."
                tag="Caveat tiers: Advisory / Blocking Condition / Do Not Build This"
                color={COLORS.wave3}
                onSelect={setSelected}
              />
            </WaveSection>

            <ArrowDown label="validated recommendation + raw agent outputs" />

            {/* OUTPUT */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>

              {/* Pass 1 */}
              <div className="panel" style={{ borderColor: "#aaaaaa" }}>
                <div className="panel-header">
                  <div className="panel-header-dot" style={{ background: "#333333" }} />
                  <div className="panel-title" style={{ color: COLORS.text }}>Pass 1 — Decision Layer</div>
                </div>
                <div className="panel-body">
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6 }}>Audience: executives + decision makers</div>
                  <div className="item">Executive summary</div>
                  <div className="item">Architecture diagram</div>
                  <div className="item">Validated tool manifest (maturity labels)</div>
                  <div className="item">Cost estimates</div>
                  <div className="item">Security summary</div>
                  <div className="section-label">Pricing</div>
                  <div className="pricing-row">
                    <div className="pricing-tier">
                      <div className="pricing-tier-name" style={{ color: COLORS.textMuted }}>Free</div>
                      <div className="pricing-tier-price">$0</div>
                      <div className="pricing-tier-detail">Exec summary + tool list. CV category titles visible, values blurred. 3 runs/day.</div>
                    </div>
                    <div className="pricing-tier">
                      <div className="pricing-tier-name" style={{ color: COLORS.text }}>Pass 1</div>
                      <div className="pricing-tier-price">$49/run</div>
                      <div className="pricing-tier-detail">Full output: diagram, full CV detail, security summary.</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: 4, fontStyle: "italic" }}>Full pipeline always executes — gating is render-time only</div>
                </div>
              </div>

              {/* Pass 2 */}
              <div className="panel" style={{ borderColor: "#aaaaaa" }}>
                <div className="panel-header">
                  <div className="panel-header-dot" style={{ background: "#333333" }} />
                  <div className="panel-title" style={{ color: COLORS.text }}>Pass 2 — Implementation Layer</div>
                </div>
                <div className="panel-body">
                  <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6 }}>Audience: builder · User-initiated · $199/run</div>
                  <div className="item">Architecture Decision Records (ADRs)</div>
                  <div className="item">Configuration</div>
                  <div className="item">Specs</div>
                  <div className="section-label">Synthesis Agents (one per domain)</div>
                  <div className="pass2-agents">
                    {["Orchestration", "Security", "Memory & State", "Tool & Integration", "Trust & Control", "Failure & Obs"].map(a => (
                      <div className="pass2-agent" key={a}>{a}</div>
                    ))}
                  </div>
                  <div className="cv-shared-label">↑ CV output shared to all six agents</div>
                  <div style={{ fontSize: 9, color: COLORS.textDim, marginTop: 4, fontStyle: "italic" }}>Input: raw Wave 1–3 outputs + verified context (not rendered Pass 1)</div>
                </div>
              </div>

            </div>

          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="col-right">

            <Panel title="Maintenance Manifest" color={COLORS.maintenance}>
              <div style={{ fontSize: 10, color: COLORS.textMuted, marginBottom: 6 }}>Single source of truth for all intake options + UI content</div>
              <div className="section-label">Entry Types</div>
              <div className="item">Tier 1 tools (2wk refresh)</div>
              <div className="item">Architecture patterns (4wk)</div>
              <div className="item">Tier 2/3 tools (on-demand)</div>
              <div className="item">Intake UI: explainers + "help me determine" questions</div>
              <div className="section-label">Refresh Flow</div>
              <div className="item">Staleness check on UI open</div>
              <div className="item">Background refresh while user writes</div>
              <div className="item">Run blocks only if stale at submit</div>
              <div className="section-label">User-Scoped Tools</div>
              <div className="item">Never written to manifest</div>
              <div className="item">Live-researched by CV at eval time</div>
              <div className="item">Flagged as "User-specified" in output</div>
              <div className="section-label">Conflict Resolution</div>
              <div className="item">Factual / Recency → agent looks it up</div>
              <div className="item">Categorization → agent reasoning</div>
              <div className="item">Schema change → human escalation</div>
            </Panel>

            <Panel title="Intake Flow Details" color={COLORS.intake}>
              <div className="section-label">Step 0 (Conditional)</div>
              <div className="item">Domain context — activates Wave 0 agent(s)</div>
              <div className="section-label">Steps 1–9</div>
              <div className="item">1: Orchestration pattern</div>
              <div className="item">2: Platform & deployment</div>
              <div className="item">3: External integrations</div>
              <div className="item">4: Data & file handling</div>
              <div className="item">5: Memory & state (help-me-determine flow)</div>
              <div className="item">6: Autonomy & HITL</div>
              <div className="item">7: Scale</div>
              <div className="item">8: Greenfield vs. brownfield</div>
              <div className="item">9: Failure tolerance</div>
              <div className="section-label">Step 10 (Always)</div>
              <div className="item">Model preferences (platform-filtered)</div>
              <div className="section-label">Review Screen</div>
              <div className="item">All fields editable</div>
              <div className="item">Downstream dependency warnings on edit</div>
              <div className="item">Hard constraints surfaced as explicit prompt</div>
            </Panel>

            <Panel title="Scope Boundaries" color={COLORS.admin}>
              <div className="section-label">In Scope (Agentic-Specific)</div>
              <div className="item">Coordination patterns</div>
              <div className="item">Agentic attack surface</div>
              <div className="item">Memory & state design</div>
              <div className="item">Tool-vs-agent boundary</div>
              <div className="item">HITL placement & gates</div>
              <div className="item">Agentic failure modes + eval strategy</div>
              <div className="item">Reasoning chain tracing</div>
              <div className="item">Tool compatibility & version currency</div>
              <div className="section-label">Out of Scope</div>
              <div className="item">Hosting & deployment</div>
              <div className="item">UI & frontend design</div>
              <div className="item">API & database design</div>
              <div className="item">CI/CD pipelines</div>
              <div className="item">Standard observability infra</div>
              <div className="section-label">Flagged Intersections</div>
              <div className="item">Security — agentic surfaces not on standard checklist</div>
              <div className="item">Observability — reasoning chains + handoffs require extensions</div>
              <div className="item">Testing — non-deterministic outputs, eval strategy covered</div>
              <div className="item">Failure handling — cascading agent failures differ from standard patterns</div>
            </Panel>

          </div>

        </div>
      </div>

      {/* Tooltip overlay */}
      {selected && AGENT_DETAILS[selected] && (
        <div className="tooltip-overlay" onClick={() => setSelected(null)}>
          <div className="tooltip-card" onClick={e => e.stopPropagation()}>
            <div className="tooltip-title">{AGENT_DETAILS[selected].title}</div>
            <div className="tooltip-wave">{AGENT_DETAILS[selected].wave}</div>
            <div className="tooltip-body">{AGENT_DETAILS[selected].body}</div>
            <div className="tooltip-close" onClick={() => setSelected(null)}>[ close ]</div>
          </div>
        </div>
      )}
    </>
  );
}
