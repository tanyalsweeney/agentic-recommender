import { z } from "zod";

const FindingType = z.enum(["factual", "recency", "categorization", "quality", "schema"]);
const MaturityTier = z.enum(["Established", "Emerging", "Experimental"]);

const GatekeeperFinding = z.object({
  type: FindingType,
  description: z.string(),
  resolved: z.boolean(),
  verificationNeeded: z.string().nullish(), // populated when needs_more_cycles — what to look up
});

export const ManifestGatekeeperOutput = z.object({
  decision: z.enum(["accepted", "rejected", "escalated", "needs_more_cycles"]),
  cyclesUsed: z.number().min(1).max(2),
  justification: z.string(),
  findings: z.array(GatekeeperFinding),
  // Accepted entries only
  confidenceScoreRecommendation: z.number().min(0).max(10).nullish(),
  maturityTierRecommendation: MaturityTier.nullish(),
  proposedEntryUpdates: z.record(z.unknown()).nullish(), // corrections to the proposed entry
  // Escalated entries only
  escalationReason: z.string().nullish(),
});

export type ManifestGatekeeperOutput = z.infer<typeof ManifestGatekeeperOutput>;
