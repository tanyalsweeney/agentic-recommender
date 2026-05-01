import { describe, it, expect, beforeAll } from "vitest";
import { callSkepticAgent } from "@agent12/agents";
import type { SkepticOutput } from "@agent12/agents";
import { DEFAULT_PROVIDER_CONFIGS, SEED_MANIFEST } from "../helpers.js";

const strongArchitectureOutput = {
  wave1: {
    orchestration: {
      recommendedPattern: "pipeline",
      rationale: "Sequential document processing with clear hand-offs",
      tradeoffs: { advantages: ["simple to debug", "easy to monitor"], limitations: ["no parallelism"], alternativesConsidered: [] },
      agentStructure: { agentCount: "3", coordinationMechanism: "sequential hand-off", stateSharing: "shared context dict" },
      costSignals: { computeIntensity: "low" },
    },
    security: {
      agenticAttackSurface: { promptInjectionRisks: [], toolMisuseRisks: [], trustBoundaryViolations: [], dataExfiltrationViaReasoning: [], excessiveAutonomyRisks: [] },
      trustBoundaries: [{ boundary: "user input", enforcement: "XML delimiters in system prompt" }],
      recommendedControls: ["input validation", "output schema enforcement"],
      declaredConstraints: [],
      costSignals: { computeIntensity: "low" },
    },
    memoryState: {
      memoryPattern: { recommended: "in-context only", rationale: "Single-session batch job", reasoningExplained: "Documents are processed and discarded; no cross-session state needed." },
      persistence: { strategy: "none", sharedAgentState: false, sessionVsCrossSession: "session_only" },
      recommendedTools: [],
      tradeoffs: { advantages: ["simple", "no storage cost"], limitations: ["no history"] },
      costSignals: {},
    },
    toolIntegration: {
      toolAgentBoundary: { principle: "tools for deterministic ops", applicationToThisSystem: "PDF extraction is a tool; classification requires judgment so it is an agent" },
      recommendedTools: [{ tool: "anthropic-sdk", purpose: "LLM calls", buildVsBuy: "buy", rationale: "Native SDK for Claude" }],
      mcpUsage: { recommended: false, rationale: "No external context sources needed" },
      integrationPoints: [],
      declaredConstraints: [],
      costSignals: {},
    },
  },
  wave2: {
    failureObservability: {
      failureModes: [{ name: "LLM output mismatch", description: "Classification agent returns unexpected format", likelihood: "low", mitigations: ["Zod schema validation on output"], isHighRiskHandoff: false }],
      evalStrategy: { approach: "fixed test set with known inputs and expected classifications", nonDeterministicHandling: "run 3x and check majority", suggestedEvalFramework: "vitest with real API calls" },
      tracingApproach: { reasoningChainTracing: "log input/output per agent", interAgentHandoffTracing: "structured logs with run ID", intersectionsWithStandardTracing: ["add run_id to all log lines"] },
      costSignals: {},
    },
    trustControl: {
      hitlGates: [],
      autonomyEnforcement: { capturedLevel: "fully_autonomous", enforcementMechanism: "output schema validation gates progression", overrideConditions: [] },
      approvalWorkflow: { recommended: false },
      costSignals: {},
    },
  },
};

const dangerousArchitectureOutput = {
  wave1: {
    orchestration: { recommendedPattern: "supervisor", rationale: "Central orchestrator", tradeoffs: { advantages: [], limitations: [], alternativesConsidered: [] }, agentStructure: { agentCount: "5+", coordinationMechanism: "orchestrator", stateSharing: "shared production DB" }, costSignals: {} },
    security: { agenticAttackSurface: { promptInjectionRisks: [], toolMisuseRisks: [], trustBoundaryViolations: [], dataExfiltrationViaReasoning: [], excessiveAutonomyRisks: [] }, trustBoundaries: [], recommendedControls: [], declaredConstraints: [], costSignals: {} },
    memoryState: { memoryPattern: { recommended: "shared DB", rationale: "All agents write to production", reasoningExplained: "Shared production database for all state" }, persistence: { strategy: "shared production database", sharedAgentState: true, sessionVsCrossSession: "cross_session" }, recommendedTools: [], tradeoffs: { advantages: [], limitations: [] }, costSignals: {} },
    toolIntegration: { toolAgentBoundary: { principle: "agents do everything", applicationToThisSystem: "agents write directly to production DB" }, recommendedTools: [{ tool: "direct_db_write", purpose: "write results to production", buildVsBuy: "build", rationale: "fastest" }], mcpUsage: { recommended: false, rationale: "not needed" }, integrationPoints: [{ system: "production PostgreSQL", integrationApproach: "direct write, no validation" }], declaredConstraints: [], costSignals: {} },
  },
  wave2: {
    failureObservability: { failureModes: [{ name: "data corruption", description: "Agents write bad data to production", likelihood: "high", mitigations: [], isHighRiskHandoff: true }], evalStrategy: { approach: "none specified", nonDeterministicHandling: "ignore", suggestedEvalFramework: undefined }, tracingApproach: { reasoningChainTracing: "none", interAgentHandoffTracing: "none", intersectionsWithStandardTracing: [] }, costSignals: {} },
    trustControl: { hitlGates: [], autonomyEnforcement: { capturedLevel: "fully_autonomous", enforcementMechanism: "none", overrideConditions: [] }, approvalWorkflow: { recommended: false }, costSignals: {} },
  },
};

// One call per scenario — shared across all assertions for that scenario.
let strongOutput: SkepticOutput;
let dangerousOutput: SkepticOutput;

beforeAll(async () => {
  strongOutput = await callSkepticAgent(SEED_MANIFEST, { description: "Document processing pipeline" }, strongArchitectureOutput, DEFAULT_PROVIDER_CONFIGS.skeptic);
  dangerousOutput = await callSkepticAgent(SEED_MANIFEST, { description: "Autonomous agent with direct production DB access" }, dangerousArchitectureOutput, DEFAULT_PROVIDER_CONFIGS.skeptic);
}, 480_000);

describe("Skeptic eval 6: strong architecture → no blocking concerns", () => {
  it("does not condemn a sound architecture as DoNotBuildThis", () => {
    const condemned = strongOutput.assignedCaveats.some(c => c.caveatTier === "DoNotBuildThis");
    expect(condemned).toBe(false);
  });

  it("uses 1-2 cycles at most for a strong architecture", () => {
    expect(strongOutput.cyclesUsed).toBeLessThanOrEqual(2);
  });
});

describe("Skeptic eval 7: dangerous architecture → Blocking Condition or DNBT", () => {
  it("assigns at least a Blocking Condition for direct production writes with no HITL", () => {
    const severe = dangerousOutput.assignedCaveats.some(c =>
      c.caveatTier === "BlockingCondition" || c.caveatTier === "DoNotBuildThis"
    );
    expect(severe).toBe(true);
  });

  it("does not exit early when dangerous patterns are present", () => {
    expect(dangerousOutput.earlyExit).toBe(false);
  });
});

describe("Skeptic eval 8: debate summary is always present and populated", () => {
  it("debateSummary.totalConcerns is a non-negative integer", () => {
    expect(typeof strongOutput.debateSummary.totalConcerns).toBe("number");
    expect(strongOutput.debateSummary.totalConcerns).toBeGreaterThanOrEqual(0);
  });

  it("resolved + remaining === totalConcerns", () => {
    const { totalConcerns, resolved, remaining } = strongOutput.debateSummary;
    expect(resolved + remaining).toBe(totalConcerns);
  });
});
