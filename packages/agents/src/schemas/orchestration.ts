import { z } from "zod";
import { CostSignals } from "./shared.js";

export const OrchestrationPattern = z.enum([
  "pipeline",
  "dag",
  "supervisor",
  "event_driven",
  "peer_to_peer",
  "hierarchical",
]);

export const OrchestrationAgentOutput = z.object({
  recommendedPattern: OrchestrationPattern,
  rationale: z.string(),
  tradeoffs: z.object({
    advantages: z.array(z.string()),
    limitations: z.array(z.string()),
    alternativesConsidered: z.array(z.object({
      pattern: OrchestrationPattern,
      rejectedBecause: z.string(),
    })),
  }),
  agentStructure: z.object({
    agentCount: z.string(),          // "2-3", "5+", etc. — intentionally loose
    coordinationMechanism: z.string(),
    stateSharing: z.string(),
  }),
  costSignals: CostSignals,
});

export type OrchestrationAgentOutput = z.infer<typeof OrchestrationAgentOutput>;
