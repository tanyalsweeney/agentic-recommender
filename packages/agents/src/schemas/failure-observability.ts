import { z } from "zod";
import { CostSignals, TripHazard } from "./shared.js";

const FailureMode = z.object({
  name: z.string(),
  description: z.string(),
  likelihood: z.enum(["low", "medium", "high"]),
  mitigations: z.array(z.string()),
  // High-risk handoff points T&C uses to position HITL gates
  isHighRiskHandoff: z.boolean(),
});

export const FailureObservabilityAgentOutput = z.object({
  failureModes: z.array(FailureMode),
  evalStrategy: z.object({
    approach: z.string(),
    nonDeterministicHandling: z.string(),
    suggestedEvalFramework: z.string().optional(),
  }),
  tracingApproach: z.object({
    reasoningChainTracing: z.string(),
    interAgentHandoffTracing: z.string(),
    intersectionsWithStandardTracing: z.array(z.string()),
  }),
  // F&O confirms or adjusts after seeing T&C gate placements
  confirmationOfGateCoverage: z.string().optional(),
  implementationTripHazards: z.array(TripHazard),
  costSignals: CostSignals,
});

export type FailureObservabilityAgentOutput = z.infer<typeof FailureObservabilityAgentOutput>;
