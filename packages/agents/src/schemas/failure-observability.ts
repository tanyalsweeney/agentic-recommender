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
    suggestedEvalFramework: z.string().nullish(),
  }),
  tracingApproach: z.object({
    reasoningChainTracing: z.string(),
    interAgentHandoffTracing: z.string(),
    intersectionsWithStandardTracing: z.array(z.string()),
  }),
  // F&O confirms gate coverage after seeing T&C placements.
  // Narrative assessment of what is and isn't covered.
  confirmationOfGateCoverage: z.string().nullish(),
  // Specific risks not addressed by T&C's gate placements.
  // Absent or empty = all risks covered = early exit. Non-empty = cycle 2 runs.
  uncoveredRisks: z.array(z.string()).optional(),
  implementationTripHazards: z.array(TripHazard),
  costSignals: CostSignals,
});

export type FailureObservabilityAgentOutput = z.infer<typeof FailureObservabilityAgentOutput>;
