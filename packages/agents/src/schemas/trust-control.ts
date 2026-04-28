import { z } from "zod";
import { CostSignals, TripHazard } from "./shared.js";

const HitlGate = z.object({
  placement: z.string(),             // where in the flow
  triggerCondition: z.string(),      // what causes it to activate
  rationale: z.string(),             // why here — references F&O failure mode if applicable
  approvalLatencyEstimate: z.string().optional(),
  linkedFailureMode: z.string().optional(), // F&O failure mode this gate addresses
});

export const TrustControlAgentOutput = z.object({
  hitlGates: z.array(HitlGate),
  autonomyEnforcement: z.object({
    capturedLevel: z.string(),       // from intake — what user confirmed
    enforcementMechanism: z.string(),
    overrideConditions: z.array(z.string()),
  }),
  approvalWorkflow: z.object({
    recommended: z.boolean(),
    description: z.string().optional(),
  }),
  // Unresolved tensions passed to Skeptic if F&O and T&C hit cycle cap
  unresolvedTensions: z.array(z.string()).optional(),
  implementationTripHazards: z.array(TripHazard),
  costSignals: CostSignals,
});

export type TrustControlAgentOutput = z.infer<typeof TrustControlAgentOutput>;
