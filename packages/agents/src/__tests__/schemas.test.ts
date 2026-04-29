import { describe, it, expect } from "vitest";
import { filterManifest } from "../callers/base.js";
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
  ManifestCandidate,
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
    contradictions: [],
    impliedRequirements: [],
    descriptionQualityNote: null,
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
    implementationTripHazards: [],
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
    implementationTripHazards: [],
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

// ── manifest candidate ────────────────────────────────────────────────────────

describe("ManifestCandidate schema", () => {
  const valid = {
    toolName: "mem0",
    category: "memory-framework",
    useCase: "Cross-session memory with automatic summarization for a long-running research assistant",
    tradeoffs: "Managed service with data leaving the VPC; self-hosted option exists but requires more ops",
  };

  it("accepts valid candidate", () => {
    expectValid(ManifestCandidate, valid);
  });

  it("rejects missing toolName", () => {
    const { toolName: _, ...missing } = valid;
    expectInvalid(ManifestCandidate, missing);
  });

  it("rejects missing useCase", () => {
    const { useCase: _, ...missing } = valid;
    expectInvalid(ManifestCandidate, missing);
  });

  it("rejects missing tradeoffs", () => {
    const { tradeoffs: _, ...missing } = valid;
    expectInvalid(ManifestCandidate, missing);
  });
});

// ── memory state ──────────────────────────────────────────────────────────────

describe("MemoryStateAgentOutput schema", () => {
  const valid = {
    memoryPattern: {
      recommended: "cross_session_with_in_run_shared_state",
      rationale: "Research assistant builds on prior sessions; multiple agents share a scratchpad during a run",
      reasoningExplained: "Cross-session is required because the user described a system that improves its answers based on prior research. In-run shared state is needed because the planner and executor agents must exchange intermediate findings within a single run.",
    },
    persistence: {
      strategy: "PostgreSQL for cross-session summaries, Redis for in-run shared state",
      sharedAgentState: true,
      sessionVsCrossSession: "both",
      memoryHorizon: "30 days",
    },
    recommendedTools: [
      { tool: "redis", purpose: "In-run shared agent state with TTL-based expiry per run" },
      { tool: "pinecone", purpose: "Semantic retrieval of prior research sessions" },
    ],
    tradeoffs: {
      advantages: ["Prior context improves answer quality over time", "In-run state reduces repeated LLM calls"],
      limitations: ["Cross-session storage requires data retention policy", "PII risk if user content is stored verbatim"],
    },
    implementationTripHazards: [],
    costSignals: { computeIntensity: "medium" },
  };

  it("accepts valid output without manifestCandidates", () => {
    expectValid(MemoryStateAgentOutput, valid);
  });

  it("accepts valid output with manifestCandidates", () => {
    const withCandidates = {
      ...valid,
      manifestCandidates: [{
        toolName: "mem0",
        category: "memory-framework",
        useCase: "Automatic cross-session summarization with built-in retrieval",
        tradeoffs: "Managed service; data leaves VPC unless self-hosted",
      }],
    };
    expectValid(MemoryStateAgentOutput, withCandidates);
  });

  it("rejects a manifest candidate missing toolName", () => {
    const badCandidate = { category: "memory-framework", useCase: "...", tradeoffs: "..." };
    expectInvalid(MemoryStateAgentOutput, { ...valid, manifestCandidates: [badCandidate] });
  });

  it("rejects missing memoryPattern", () => {
    const { memoryPattern: _, ...missing } = valid;
    expectInvalid(MemoryStateAgentOutput, missing);
  });

  it("rejects invalid sessionVsCrossSession value", () => {
    expectInvalid(MemoryStateAgentOutput, {
      ...valid,
      persistence: { ...valid.persistence, sessionVsCrossSession: "sometimes" },
    });
  });
});

// ── tool integration ──────────────────────────────────────────────────────────

describe("ToolIntegrationAgentOutput schema", () => {
  const valid = {
    toolAgentBoundary: {
      principle: "Tools are deterministic and reversible; agents exercise judgment",
      applicationToThisSystem: "Web scraper is a tool; research synthesis agent is an agent",
    },
    recommendedTools: [{
      tool: "playwright",
      purpose: "Headless browser scraping of research sources",
      buildVsBuy: "buy",
      rationale: "Established library with strong agentic community support and MCP integration",
    }],
    mcpUsage: {
      recommended: true,
      rationale: "MCP standardizes tool calling and simplifies adding new tools without agent code changes",
      suggestedServers: ["mcp-server-filesystem"],
    },
    integrationPoints: [{
      system: "Google Scholar",
      integrationApproach: "HTTP scraping via Playwright",
      notes: "Rate limiting and robots.txt compliance required",
    }],
    declaredConstraints: ["No tool may write to external systems without HITL approval"],
    implementationTripHazards: [],
    costSignals: { computeIntensity: "medium" },
  };

  it("accepts valid output without manifestCandidates", () => {
    expectValid(ToolIntegrationAgentOutput, valid);
  });

  it("accepts valid output with manifestCandidates", () => {
    const withCandidates = {
      ...valid,
      manifestCandidates: [{
        toolName: "firecrawl",
        category: "web-scraping",
        useCase: "Managed web scraping with built-in JS rendering and rate limit handling",
        tradeoffs: "Paid managed service; removes ops burden but adds vendor dependency",
      }],
    };
    expectValid(ToolIntegrationAgentOutput, withCandidates);
  });

  it("rejects a manifest candidate missing tradeoffs", () => {
    const badCandidate = { toolName: "firecrawl", category: "web-scraping", useCase: "..." };
    expectInvalid(ToolIntegrationAgentOutput, { ...valid, manifestCandidates: [badCandidate] });
  });

  it("rejects invalid buildVsBuy value", () => {
    const badTool = { ...valid.recommendedTools[0], buildVsBuy: "outsource" };
    expectInvalid(ToolIntegrationAgentOutput, { ...valid, recommendedTools: [badTool] });
  });

  it("rejects missing toolAgentBoundary", () => {
    const { toolAgentBoundary: _, ...missing } = valid;
    expectInvalid(ToolIntegrationAgentOutput, missing);
  });
});

// ── failure observability ─────────────────────────────────────────────────────

describe("FailureObservabilityAgentOutput schema", () => {
  const valid = {
    failureModes: [{
      name: "Reasoning loop",
      description: "Research agent enters a loop requesting the same sources repeatedly",
      likelihood: "medium",
      mitigations: ["Iteration cap at 10", "Deduplicate source URLs before fetching"],
      isHighRiskHandoff: false,
    }],
    evalStrategy: {
      approach: "LLM-as-judge scoring research output quality on relevance and coverage",
      nonDeterministicHandling: "Run each eval case 3 times, flag if variance exceeds 20%",
      suggestedEvalFramework: "Vitest with Anthropic SDK",
    },
    tracingApproach: {
      reasoningChainTracing: "Structured logging at each agent step with run ID and step index",
      interAgentHandoffTracing: "Handoff payloads logged with producing and consuming agent IDs",
      intersectionsWithStandardTracing: ["OpenTelemetry spans for external API calls"],
    },
    implementationTripHazards: [],
    costSignals: { computeIntensity: "low" },
  };

  it("accepts valid output", () => {
    expectValid(FailureObservabilityAgentOutput, valid);
  });

  it("rejects invalid likelihood on a failure mode", () => {
    const badMode = { ...valid.failureModes[0], likelihood: "certain" };
    expectInvalid(FailureObservabilityAgentOutput, { ...valid, failureModes: [badMode] });
  });

  it("rejects missing isHighRiskHandoff on a failure mode", () => {
    const { isHighRiskHandoff: _, ...noFlag } = valid.failureModes[0];
    expectInvalid(FailureObservabilityAgentOutput, { ...valid, failureModes: [noFlag] });
  });

  it("rejects missing evalStrategy", () => {
    const { evalStrategy: _, ...missing } = valid;
    expectInvalid(FailureObservabilityAgentOutput, missing);
  });
});

// ── trust control ─────────────────────────────────────────────────────────────

describe("TrustControlAgentOutput schema", () => {
  const valid = {
    hitlGates: [{
      placement: "Before any external API write operation",
      triggerCondition: "Agent attempts to POST to an external endpoint",
      rationale: "External writes are irreversible; human approval required per security agent constraint",
      approvalLatencyEstimate: "2-5 minutes",
      linkedFailureMode: "Unauthorized external data write",
    }],
    autonomyEnforcement: {
      capturedLevel: "semi_autonomous",
      enforcementMechanism: "All external writes gated by HITL approval queue",
      overrideConditions: ["Admin override with audit log entry"],
    },
    approvalWorkflow: {
      recommended: true,
      description: "Slack notification to approver with approve/reject buttons; 15-minute timeout defaults to reject",
    },
    implementationTripHazards: [],
    costSignals: { computeIntensity: "low" },
  };

  it("accepts valid output", () => {
    expectValid(TrustControlAgentOutput, valid);
  });

  it("rejects missing placement on a HITL gate", () => {
    const { placement: _, ...noPlacement } = valid.hitlGates[0];
    expectInvalid(TrustControlAgentOutput, { ...valid, hitlGates: [noPlacement] });
  });

  it("rejects missing autonomyEnforcement", () => {
    const { autonomyEnforcement: _, ...missing } = valid;
    expectInvalid(TrustControlAgentOutput, missing);
  });

  it("accepts output with unresolvedTensions present", () => {
    const withTensions = { ...valid, unresolvedTensions: ["F&O and T&C disagree on gate placement for summarization step"] };
    expectValid(TrustControlAgentOutput, withTensions);
  });
});

// ── filterManifest ────────────────────────────────────────────────────────────

describe("filterManifest", () => {
  const full = {
    tools: [{ name: "langchain" }, { name: "redis" }],
    patterns: [{ name: "pipeline" }],
    failureModes: [{ name: "reasoning_loops" }],
  };

  it("returns only requested sections", () => {
    const result = filterManifest(full, { tools: true }) as typeof full;
    expect(result.tools).toHaveLength(2);
    expect(result).not.toHaveProperty("patterns");
    expect(result).not.toHaveProperty("failureModes");
  });

  it("returns multiple sections when requested", () => {
    const result = filterManifest(full, { patterns: true, failureModes: true }) as typeof full;
    expect(result).not.toHaveProperty("tools");
    expect(result.patterns).toHaveLength(1);
    expect(result.failureModes).toHaveLength(1);
  });

  it("returns all sections when all requested", () => {
    const result = filterManifest(full, { tools: true, patterns: true, failureModes: true }) as typeof full;
    expect(result.tools).toHaveLength(2);
    expect(result.patterns).toHaveLength(1);
    expect(result.failureModes).toHaveLength(1);
  });

  it("returns empty object when no sections requested", () => {
    const result = filterManifest(full, {}) as Record<string, unknown>;
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("passes through non-object manifest unchanged", () => {
    expect(filterManifest(null, { tools: true })).toBeNull();
    expect(filterManifest("raw", { tools: true })).toBe("raw");
  });

  it("omits sections missing from manifest without error", () => {
    const partial = { tools: [{ name: "redis" }] };
    const result = filterManifest(partial, { tools: true, failureModes: true }) as Record<string, unknown>;
    expect(result.tools).toBeDefined();
    expect(result).not.toHaveProperty("failureModes");
  });
});
