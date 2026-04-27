/**
 * Technical Writer evals — 2 cases.
 * Unskip and wire callTechnicalWriterAgent() in Phase 2c.
 */
import { describe, it, expect } from "vitest";
import { TechnicalWriterOutput } from "@agent12/agents";

async function callTechnicalWriterAgent(_validatedOutput: object): Promise<TechnicalWriterOutput> {
  throw new Error("callTechnicalWriterAgent not implemented — Phase 2c");
}

// Reuse a minimal but valid input for both evals
const validatedPipelineOutput = {
  orchestration: { recommendedPattern: "pipeline", rationale: "Sequential processing", tradeoffs: { advantages: ["simple"], limitations: ["no parallelism"], alternativesConsidered: [] }, agentStructure: { agentCount: "3", coordinationMechanism: "sequential", stateSharing: "context dict" }, costSignals: {} },
  skepticOutput: {
    concerns: [],
    debateSummary: { totalConcerns: 0, resolved: 0, remaining: 0, highestRemainingTier: null },
    assignedCaveats: [],
    cyclesUsed: 1,
    earlyExit: true,
  },
  cvOutput: {
    perToolResults: [{ toolName: "LangChain", version: "0.3.0", isCurrentVersion: true, cves: { critical: [], high: [] }, license: "MIT", isCopyleft: false, sourceUrl: "https://python.langchain.com", fromCache: false, isUserSpecified: false }],
    crossToolCompatibility: [],
    crossAgentConflicts: [],
    costAggregation: { totalEstimatedMonthlyCost: "$20-50/month", breakdown: [] },
  },
};

// ── eval case 9: voice directive — no marketing language ─────────────────────
// The spec explicitly prohibits AI slop in the executive summary.
// Senior technical builders will notice immediately.

const BANNED_PHRASES = [
  "robust", "comprehensive", "seamless", "leverage", "utilize",
  "enhance", "streamline", "cutting-edge", "state-of-the-art",
  "best-in-class", "world-class", "empower", "revolutionize",
  "synergy", "holistic", "paradigm",
];

describe("Technical Writer eval 9: voice directive — no marketing language", () => {
  it.skip("executive summary contains no banned marketing phrases", async () => {
    const output = await callTechnicalWriterAgent(validatedPipelineOutput);
    const summaryLower = output.executiveSummary.content.toLowerCase();
    const found = BANNED_PHRASES.filter(phrase => summaryLower.includes(phrase));
    expect(found).toHaveLength(0);
  });

  it.skip("executive summary contains the debate summary sentence", async () => {
    const output = await callTechnicalWriterAgent(validatedPipelineOutput);
    expect(output.executiveSummary.debateSummary).toBeTruthy();
    expect(output.executiveSummary.debateSummary.length).toBeGreaterThan(10);
  });

  it.skip("executive summary includes a scope statement", async () => {
    const output = await callTechnicalWriterAgent(validatedPipelineOutput);
    const scopeLower = output.executiveSummary.scopeStatement.toLowerCase();
    expect(scopeLower).toMatch(/agentic|architecture|scope|traditional/);
  });
});

// ── eval case 10: Mermaid diagram syntax is valid ─────────────────────────────
// A broken diagram in Pass 1 is worse than no diagram — it signals system failure.
// The spec requires syntax validation before Pass 1 finalizes.

function isValidMermaidSyntax(source: string): boolean {
  if (!source || source.trim().length === 0) return false;
  const trimmed = source.trim();
  // Must start with a valid graph declaration
  const validStarters = ["graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram", "erDiagram"];
  const startsCorrectly = validStarters.some(s => trimmed.startsWith(s));
  if (!startsCorrectly) return false;
  // Must not have unclosed brackets
  const opens = (trimmed.match(/\[/g) || []).length;
  const closes = (trimmed.match(/\]/g) || []).length;
  if (opens !== closes) return false;
  // Must contain at least one arrow or node relationship
  return /-->|---|==>|\|/.test(trimmed);
}

describe("Technical Writer eval 10: Mermaid diagram syntax is valid", () => {
  it.skip("architecture diagram source passes basic Mermaid syntax checks", async () => {
    const output = await callTechnicalWriterAgent(validatedPipelineOutput);
    const { mermaidSource } = output.architectureDiagram;
    expect(isValidMermaidSyntax(mermaidSource)).toBe(true);
  });

  it.skip("diagram direction is one of the valid Mermaid directions", async () => {
    const output = await callTechnicalWriterAgent(validatedPipelineOutput);
    expect(["LR", "TD", "BT", "RL"]).toContain(output.architectureDiagram.direction);
  });

  it.skip("diagram abstraction level is decision_maker", async () => {
    const output = await callTechnicalWriterAgent(validatedPipelineOutput);
    expect(output.architectureDiagram.abstractionLevel).toBe("decision_maker");
  });
});
