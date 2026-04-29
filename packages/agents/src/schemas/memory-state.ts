import { z } from "zod";
import { CostSignals, ManifestCandidate, TripHazard } from "./shared.js";

export const MemoryStateAgentOutput = z.object({
  memoryPattern: z.object({
    recommended: z.string(),
    rationale: z.string(),
    // Surfaced explicitly per spec: users often don't know if they need memory
    reasoningExplained: z.string(),
  }),
  persistence: z.object({
    strategy: z.string(),
    sharedAgentState: z.boolean(),
    sessionVsCrossSession: z.enum(["session_only", "cross_session", "both", "none"]),
    memoryHorizon: z.string().nullish(),
  }),
  recommendedTools: z.array(z.object({
    tool: z.string(),
    purpose: z.string(),
    notes: z.string().nullish(),
  })),
  tradeoffs: z.object({
    advantages: z.array(z.string()),
    limitations: z.array(z.string()),
  }),
  implementationTripHazards: z.array(TripHazard),
  costSignals: CostSignals,
  manifestCandidates: z.array(ManifestCandidate).nullish(),
});

export type MemoryStateAgentOutput = z.infer<typeof MemoryStateAgentOutput>;
