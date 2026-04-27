import { describe, it, expect } from "vitest";
import {
  IntakeAgentOutput,
  OrchestrationAgentOutput,
  SecurityAgentOutput,
  MemoryStateAgentOutput,
  ToolIntegrationAgentOutput,
  FailureObservabilityAgentOutput,
  TrustControlAgentOutput,
  CompatibilityValidatorOutput,
  SkepticOutput,
  TechnicalWriterOutput,
} from "../schemas/index.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function expectInvalid(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) {
  const result = schema.safeParse(value);
  expect(result.success).toBe(false);
}

function expectValid<T>(schema: { parse: (v: unknown) => T }, value: unknown): T {
  return schema.parse(value); // throws with field name on failure — that's the point
}

// ── intake ────────────────────────────────────────────────────────────────────

describe("IntakeAgentOutput schema", () => {
  const valid = {
    steps: {
      orchestrationPattern: { state: "high_confidence", selected: "pipeline", rationale: "Sequential ETL-style flow" },
      platformDeployment: { state: "high_confidence", selected: "AWS", rationale: "Inferred from integrations" },
      externalIntegrations: { state: "low_confidence", rationale: "Not enough detail" },
      dataFileHandling: { state: "not_applicable", rationale: "No file handling described" },
      memoryState: { state: "low_confidence", rationale: "Ambiguous" },
      autonomyHitl: { state: "high_confidence", selected: "semi_autonomous", rationale: "User mentioned approvals" },
      scale: { state: "high_confidence", selected: "low_volume", rationale: "Single-user" },
      greenfieldBrownfield: { state: "high_confidence", selected: "greenfield", rationale: "Described as new project" },
      failureTolerance: { state: "low_confidence", rationale: "No mention" },
      modelPreferences: { state: "low_confidence", rationale: "No preference stated" },
      tools: { state: "high_confidence", selected: ["langchain", "pinecone"], rationale: "Mentioned explicitly" },
    },
    constraintClassifications: [],
  };

  it("accepts valid output", () => {
    expectValid(IntakeAgentOutput, valid);
  });

  it("rejects when a required step is missing", () => {
    const { orchestrationPattern: _, ...missingStep } = valid.steps;
    expectInvalid(IntakeAgentOutput, { ...valid, steps: missingStep });
  });

  it("rejects invalid inference state", () => {
    expectInvalid(IntakeAgentOutput, {
      ...valid,
      steps: { ...valid.steps, orchestrationPattern: { state: "maybe", rationale: "unsure" } },
    });
  });
});

// ── orchestration ─────────────────────────────────────────────────────────────

describe("OrchestrationAgentOutput schema", () => {
  const valid = {
    recommendedPattern: "dag",
    rationale: "Parallel sub-tasks with dependencies",
    tradeoffs: {
      advantages: ["parallelism", "explicit dependencies"],
      limitations: ["more complex to debug"],
      alternativesConsidered: [{ pattern: "pipeline", rejectedBecause: "No parallelism needed" }],
    },
    agentStructure: {
      agentCount: "3-5",
      coordinationMechanism: "orchestrator dispatches sub-agents",
      stateSharing: "shared context object",
    },
    costSignals: { computeIntensity: "medium" },
  };

  it("accepts valid output", () => {
    expectValid(OrchestrationAgentOutput, valid);
  });

  it("rejects unknown orchestration pattern", () => {
    expectInvalid(OrchestrationAgentOutput, { ...valid, recommendedPattern: "chaos_monkey" });
  });

  it("rejects when costSignals is missing", () => {
    const { costSignals: _, ...noCostSignals } = valid;
    expectInvalid(OrchestrationAgentOutput, noCostSignals);
  });
});

// ── security ──────────────────────────────────────────────────────────────────

describe("SecurityAgentOutput schema", () => {
  const valid = {
    agenticAttackSurface: {
      promptInjectionRisks: [{
        threat: "User-supplied prompt injection via task description",
        attackVector: "Malicious task input",
        likelihood: "high",
        impact: "high",
        mitigations: ["Trust boundary in intake prompt", "Output schema validation"],
      }],
      toolMisuseRisks: [],
      trustBoundaryViolations: [],
      dataExfiltrationViaReasoning: [],
      excessiveAutonomyRisks: [],
    },
    trustBoundaries: [{ boundary: "User input / agent reasoning", enforcement: "XML delimiter in system prompt" }],
    recommendedControls: ["Prompt injection trust boundary", "Tool call validation"],
    declaredConstraints: ["No third-party data exfiltration"],
    costSignals: { computeIntensity: "low" },
  };

  it("accepts valid output", () => {
    expectValid(SecurityAgentOutput, valid);
  });

  it("rejects invalid likelihood value", () => {
    const badThreat = { ...valid.agenticAttackSurface.promptInjectionRisks[0], likelihood: "critical" };
    expectInvalid(SecurityAgentOutput, {
      ...valid,
      agenticAttackSurface: { ...valid.agenticAttackSurface, promptInjectionRisks: [badThreat] },
    });
  });
});

// ── skeptic ───────────────────────────────────────────────────────────────────

describe("SkepticOutput schema", () => {
  const valid = {
    concerns: [{
      concernId: "c1",
      description: "Memory pattern doesn't account for cross-session state",
      targetAgent: "memory-state",
      resolved: true,
      acceptedOverride: {
        counterArgument: "User confirmed session-only is sufficient",
        tradeoffReasoning: "Adds complexity without benefit given single-user use case",
      },
    }],
    debateSummary: {
      totalConcerns: 1,
      resolved: 1,
      remaining: 0,
      highestRemainingTier: null,
    },
    assignedCaveats: [],
    cyclesUsed: 1,
    earlyExit: true,
  };

  it("accepts valid output", () => {
    expectValid(SkepticOutput, valid);
  });

  it("rejects cycles above 4", () => {
    expectInvalid(SkepticOutput, { ...valid, cyclesUsed: 5 });
  });

  it("rejects invalid caveat tier", () => {
    expectInvalid(SkepticOutput, {
      ...valid,
      assignedCaveats: [{ tier: "FYI", description: "something", targetComponent: "tools" }],
    });
  });

  it("requires debateSummary with totalConcerns, resolved, remaining", () => {
    const { debateSummary: _, ...noSummary } = valid;
    expectInvalid(SkepticOutput, noSummary);
  });
});

// ── technical writer ──────────────────────────────────────────────────────────

describe("TechnicalWriterOutput schema", () => {
  const valid = {
    executiveSummary: {
      content: "This architecture uses a DAG pattern with LangChain...",
      debateSummary: "2 concerns raised during analysis — both resolved with documented tradeoffs.",
      scopeStatement: "Covers agentic architecture only.",
    },
    architectureDiagram: {
      mermaidSource: "graph LR\n  A[User] --> B[Orchestrator]",
      direction: "LR",
      abstractionLevel: "decision_maker",
    },
    validatedToolManifest: [{
      toolName: "LangChain",
      maturityLabel: "Established",
      purpose: "Orchestration framework",
      isUserSpecified: false,
    }],
    costEstimates: {
      ongoingMonthlyEstimate: "$45-120/month",
      breakdown: [{ component: "LLM API calls", estimate: "$30-80/month" }],
    },
    securitySummary: "Trust boundaries established at user input and tool execution layers.",
    failureModeSummary: "Primary risk is reasoning loops; circuit breaker at 10 iterations recommended.",
    trustControlSummary: "Human approval required before any external API write operation.",
    assignedCaveats: [],
  };

  it("accepts valid output", () => {
    expectValid(TechnicalWriterOutput, valid);
  });

  it("rejects missing debateSummary in executiveSummary", () => {
    const { debateSummary: _, ...noDebate } = valid.executiveSummary;
    expectInvalid(TechnicalWriterOutput, { ...valid, executiveSummary: noDebate });
  });

  it("rejects invalid maturity label", () => {
    const badEntry = { ...valid.validatedToolManifest[0], maturityLabel: "Beta" };
    expectInvalid(TechnicalWriterOutput, { ...valid, validatedToolManifest: [badEntry] });
  });

  it("requires abstractionLevel to be decision_maker", () => {
    const badDiagram = { ...valid.architectureDiagram, abstractionLevel: "implementation_detail" };
    expectInvalid(TechnicalWriterOutput, { ...valid, architectureDiagram: badDiagram });
  });
});

// ── compatibility validator ───────────────────────────────────────────────────

describe("CompatibilityValidatorOutput schema", () => {
  const valid = {
    perToolResults: [{
      toolName: "langchain",
      version: "0.3.0",
      isCurrentVersion: true,
      cves: { critical: [], high: [] },
      license: "MIT",
      isCopyleft: false,
      sourceUrl: "https://python.langchain.com",
      fromCache: false,
      isUserSpecified: false,
    }],
    crossToolCompatibility: [{
      pair: ["langchain", "pinecone"],
      compatible: true,
      notes: "Verified via LangChain Pinecone integration docs",
    }],
    crossAgentConflicts: [],
    costAggregation: {
      totalEstimatedMonthlyCost: "$45-120",
      breakdown: [],
    },
  };

  it("accepts valid output", () => {
    expectValid(CompatibilityValidatorOutput, valid);
  });

  it("requires fromCache field on every tool result", () => {
    const { fromCache: _, ...noCache } = valid.perToolResults[0];
    expectInvalid(CompatibilityValidatorOutput, { ...valid, perToolResults: [noCache] });
  });

  it("rejects invalid conflict type", () => {
    const badConflict = { type: "vibes_mismatch", agentsInvolved: ["security"], description: "...", severity: "low" };
    expectInvalid(CompatibilityValidatorOutput, { ...valid, crossAgentConflicts: [badConflict] });
  });
});
