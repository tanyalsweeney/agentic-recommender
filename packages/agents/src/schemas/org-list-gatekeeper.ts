import { z } from "zod";

const OrgTier = z.enum(["tier1-market-influence", "tier1-committed", "tier2", "tier3"]);

const SignalAssessment = z.object({
  present: z.boolean(),
  notes: z.string(),
});

export const OrgListGatekeeperOutput = z.object({
  recommendation: z.enum(["add", "remove", "tier-change", "no-action"]),
  orgName: z.string(),
  recommendedTier: OrgTier.nullish(), // required for add or tier-change
  justification: z.string(),
  sourcesReviewed: z.array(z.string()),
  signalAnalysis: z.object({
    engineeringPublications: SignalAssessment,
    openSourceTooling: SignalAssessment,
    platformOfferings: SignalAssessment,
    marketInfluence: SignalAssessment.nullish(), // only evaluated for tier1-market-influence candidates
  }),
  independenceVerified: z.boolean(),
  independenceNotes: z.string().nullish(),
  recentActivityVerified: z.boolean(), // activity within the last 6 months
  recentActivityNotes: z.string().nullish(),
  isSecondPass: z.boolean(),
  secondPassFindings: z.string().nullish(), // populated only on second pass
});

export type OrgListGatekeeperOutput = z.infer<typeof OrgListGatekeeperOutput>;
