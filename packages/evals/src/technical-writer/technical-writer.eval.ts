import { describe, it, expect } from "vitest";
import { callTechnicalWriterAgent } from "@agent12/agents";
import { DEFAULT_PROVIDER_CONFIGS, SEED_MANIFEST } from "../helpers.js";

const upstreamOutputs = {
  wave1: {
    orchestration: { recommendedPattern: "pipeline", rationale: "Sequential document processing", tradeoffs: { advantages: ["simple"], limitations: ["no parallelism"], alternativesConsidered: [{ pattern: "dag", rejectedBecause: "No parallel sub-tasks needed" }] }, agentStructure: { agentCount: "3", coordinationMechanism: "sequential hand-off", stateSharing: "shared context object" }, costSignals: { computeIntensity: "low" } },
    security: { agenticAttackSurface: { promptInjectionRisks: [{ threat: "Malicious PDF content", attackVector: "User-supplied document", likelihood: "medium", impact: "medium", mitigations: ["Content sanitization before agent input"] }], toolMisuseRisks: [], trustBoundaryViolations: [], dataExfiltrationViaReasoning: [], excessiveAutonomyRisks: [] }, trustBoundaries: [{ boundary: "document input", enforcement: "strip executable content before passing to agent" }], recommendedControls: ["input sanitization"], declaredConstraints: [], costSignals: {} },
    memoryState: { memoryPattern: { recommended: "in-context only", rationale: "Single-run batch job", reasoningExplained: "No state needed between runs." }, persistence: { strategy: "none", sharedAgentState: false, sessionVsCrossSession: "session_only" }, recommendedTools: [], tradeoffs: { advantages: ["simple"], limitations: ["no history"] }, costSignals: {} },
    toolIntegration: { toolAgentBoundary: { principle: "tools for deterministic ops", applicationToThisSystem: "PDF extraction is a tool" }, recommendedTools: [{ tool: "anthropic-sdk", purpose: "Classification and summarization", buildVsBuy: "buy", rationale: "Native Claude SDK" }], mcpUsage: { recommended: false, rationale: "No external context needed" }, integrationPoints: [], declaredConstraints: [], costSignals: {} },
  },
  wave2: {
    failureObservability: { failureModes: [], evalStrategy: { approach: "fixed test set", nonDeterministicHandling: "run 3x majority vote", suggestedEvalFramework: "vitest" }, tracingApproach: { reasoningChainTracing: "log per-agent I/O", interAgentHandoffTracing: "structured logs", intersectionsWithStandardTracing: [] }, costSignals: {} },
    trustControl: { hitlGates: [], autonomyEnforcement: { capturedLevel: "fully_autonomous", enforcementMechanism: "output schema validation", overrideConditions: [] }, approvalWorkflow: { recommended: false }, costSignals: {} },
  },
  cv: {
    perToolResults: [{ toolName: "anthropic-sdk", version: "0.39.0", isCurrentVersion: true, cves: { critical: [], high: [] }, license: "MIT", isCopyleft: false, sourceUrl: "https://docs.anthropic.com", fromCache: false, isUserSpecified: false }],
    crossToolCompatibility: [],
    crossAgentConflicts: [],
    costAggregation: { totalEstimatedMonthlyCost: "$20-50/month", breakdown: [{ component: "Claude API", estimate: "$20-50/month" }] },
  },
  skeptic: {
    concerns: [],
    debateSummary: { totalConcerns: 1, resolved: 1, remaining: 0, highestRemainingTier: null },
    assignedCaveats: [],
    cyclesUsed: 1,
    earlyExit: true,
  },
};

const BANNED_PHRASES = [
  "robust", "comprehensive", "seamless", "leverage", "utilize",
  "enhance", "streamline", "cutting-edge", "state-of-the-art",
  "best-in-class", "world-class", "empower", "revolutionize",
  "synergy", "holistic", "paradigm",
];

function isValidMermaidSyntax(source: string): boolean {
  if (!source?.trim()) return false;
  const t = source.trim();
  const validStarters = ["graph", "flowchart", "sequenceDiagram", "classDiagram"];
  if (!validStarters.some(s => t.startsWith(s))) return false;
  const opens = (t.match(/\[/g) || []).length;
  const closes = (t.match(/\]/g) || []).length;
  if (opens !== closes) return false;
  return /-->|---|==>/.test(t);
}

describe("Technical Writer eval 9: voice directive — no marketing language", () => {
  it("executive summary contains no banned marketing phrases", async () => {
    const output = await callTechnicalWriterAgent(SEED_MANIFEST, { description: "Document processing pipeline, AWS Lambda, Claude Sonnet" }, upstreamOutputs, DEFAULT_PROVIDER_CONFIGS.technical_writer);
    const summaryLower = output.executiveSummary.content.toLowerCase();
    const found = BANNED_PHRASES.filter(p => summaryLower.includes(p));
    expect(found).toHaveLength(0);
  });

  it("executive summary contains a debate summary sentence", async () => {
    const output = await callTechnicalWriterAgent(SEED_MANIFEST, { description: "Document processing pipeline, AWS Lambda, Claude Sonnet" }, upstreamOutputs, DEFAULT_PROVIDER_CONFIGS.technical_writer);
    expect(output.executiveSummary.debateSummary).toBeTruthy();
    expect(output.executiveSummary.debateSummary.length).toBeGreaterThan(10);
  });

  it("executive summary includes a scope statement", async () => {
    const output = await callTechnicalWriterAgent(SEED_MANIFEST, { description: "Document processing pipeline, AWS Lambda, Claude Sonnet" }, upstreamOutputs, DEFAULT_PROVIDER_CONFIGS.technical_writer);
    expect(output.executiveSummary.scopeStatement.toLowerCase()).toMatch(/agentic|architecture|scope|traditional/);
  });
});

describe("Technical Writer eval 10: Mermaid diagram syntax is valid", () => {
  it("architecture diagram source passes basic Mermaid syntax checks", async () => {
    const output = await callTechnicalWriterAgent(SEED_MANIFEST, { description: "Document processing pipeline, AWS Lambda, Claude Sonnet" }, upstreamOutputs, DEFAULT_PROVIDER_CONFIGS.technical_writer);
    expect(isValidMermaidSyntax(output.architectureDiagram.mermaidSource)).toBe(true);
  });

  it("diagram direction is a valid Mermaid direction", async () => {
    const output = await callTechnicalWriterAgent(SEED_MANIFEST, { description: "Document processing pipeline, AWS Lambda, Claude Sonnet" }, upstreamOutputs, DEFAULT_PROVIDER_CONFIGS.technical_writer);
    expect(["LR", "TD", "BT", "RL"]).toContain(output.architectureDiagram.direction);
  });
});
