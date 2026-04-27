import { z } from "zod";
import { CaveatTier } from "./shared.js";

const SkepticConcern = z.object({
  concernId: z.string(),
  description: z.string(),
  targetAgent: z.string(),           // which agent's output is being challenged
  resolved: z.boolean(),
  resolution: z.string().optional(), // how it was resolved, or why it couldn't be
  acceptedOverride: z.object({       // when the challenged agent counter-argued successfully
    counterArgument: z.string(),
    tradeoffReasoning: z.string(),   // feeds directly into Pass 2 ADRs
  }).optional(),
  caveatTier: CaveatTier.optional(), // assigned at cycle cap if unresolved
});

export const SkepticOutput = z.object({
  concerns: z.array(SkepticConcern),
  // For Pass 1 executive summary — "N concerns raised, M resolved, K remain as [tier]"
  debateSummary: z.object({
    totalConcerns: z.number(),
    resolved: z.number(),
    remaining: z.number(),
    highestRemainingTier: CaveatTier.nullable(),
  }),
  assignedCaveats: z.array(z.object({
    caveatTier: CaveatTier,
    description: z.string(),         // plain language per spec
    targetComponent: z.string(),
  })),
  cyclesUsed: z.number().min(1).max(4),
  earlyExit: z.boolean(),            // true if exited before cycle cap
});

export type SkepticOutput = z.infer<typeof SkepticOutput>;
