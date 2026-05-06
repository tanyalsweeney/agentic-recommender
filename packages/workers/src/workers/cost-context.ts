export interface AgentCostSignal {
  agent: string;
  computeIntensity: "low" | "medium" | "high";
}

export interface CostContext {
  agentCostSignals: AgentCostSignal[];
  scale: string | null;             // null when intake confidence is low
  modelSelection: string | null;    // null when model not confirmed
  orchestrationPattern: string | null;
}

type MaybeAgentOutput = {
  costSignals?: { computeIntensity?: string };
} | undefined;

type MaybeIntakeStep = {
  state?: string;
  selected?: string;
} | undefined;

/**
 * Extracts cost signals from Wave 1 and Wave 2 agent outputs and confirmed
 * intake context from verifiedContext, producing a structured object the CV
 * agent uses for cost aggregation.
 *
 * Intake fields are null when the intake agent could not infer them with high
 * confidence — the CV agent produces a range estimate in that case and the
 * values are filled in when intake context is confirmed (Phase 4b).
 */
export function buildCostContext(
  wave1Results: unknown,
  wave2Results: unknown,
  verifiedContext: unknown
): CostContext {
  const w1 = (wave1Results ?? {}) as Record<string, MaybeAgentOutput>;
  const w2 = (wave2Results ?? {}) as Record<string, MaybeAgentOutput>;
  const vc = (verifiedContext ?? {}) as Record<string, MaybeIntakeStep>;

  const agentCostSignals: AgentCostSignal[] = [];

  // Wave 1 agents
  const wave1Keys = ["orchestration", "security", "memoryState", "toolIntegration"] as const;
  for (const key of wave1Keys) {
    const intensity = w1[key]?.costSignals?.computeIntensity;
    if (intensity && isIntensity(intensity)) {
      agentCostSignals.push({ agent: key, computeIntensity: intensity });
    }
  }

  // Wave 2 agents
  const wave2Keys = ["failureObservability", "trustControl"] as const;
  for (const key of wave2Keys) {
    const intensity = w2[key]?.costSignals?.computeIntensity;
    if (intensity && isIntensity(intensity)) {
      agentCostSignals.push({ agent: key, computeIntensity: intensity });
    }
  }

  return {
    agentCostSignals,
    scale:                extractConfirmed(vc.scale),
    modelSelection:       extractConfirmed(vc.modelPreferences),
    orchestrationPattern: extractConfirmed(vc.orchestrationPattern),
  };
}

function extractConfirmed(step: MaybeIntakeStep): string | null {
  if (step?.state === "high_confidence" && step.selected) return step.selected;
  return null;
}

function isIntensity(v: string): v is "low" | "medium" | "high" {
  return v === "low" || v === "medium" || v === "high";
}
