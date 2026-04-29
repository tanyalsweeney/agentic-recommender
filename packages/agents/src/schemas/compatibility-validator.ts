import { z } from "zod";

const PerToolResult = z.object({
  toolName: z.string(),
  version: z.string().nullish(),
  isCurrentVersion: z.boolean().nullish(),
  eolDate: z.string().nullish(),
  cves: z.object({
    critical: z.array(z.string()),
    high: z.array(z.string()),
  }).nullish(),
  breakingChanges: z.array(z.string()).nullish(),
  license: z.string().nullish(), // SPDX identifier
  isCopyleft: z.boolean().nullish(),
  pricing: z.object({
    tier: z.string().nullish(),
    cost: z.string().nullish(),
  }).nullish(),
  regionalAvailability: z.string().nullish(),
  sourceUrl: z.string().nullish(),
  fromCache: z.boolean(),
  flaggedUnavailable: z.array(z.string()).nullish(), // fields that shipped as unavailable
  isUserSpecified: z.boolean(),
});

const CrossToolResult = z.object({
  pair: z.tuple([z.string(), z.string()]),
  compatible: z.boolean(),
  notes: z.string(),
});

const CrossAgentConflict = z.object({
  type: z.enum(["constraint_violation", "integration_gap", "version_conflict"]),
  agentsInvolved: z.array(z.string()),
  description: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
});

export const CompatibilityValidatorOutput = z.object({
  perToolResults: z.array(PerToolResult),
  crossToolCompatibility: z.array(CrossToolResult),
  crossAgentConflicts: z.array(CrossAgentConflict),
  costAggregation: z.object({
    totalEstimatedMonthlyCost: z.string().nullish(),
    breakdown: z.array(z.object({
      component: z.string(),
      estimate: z.string(),
    })),
  }),
});

export type CompatibilityValidatorOutput = z.infer<typeof CompatibilityValidatorOutput>;
export type PerToolResult = z.infer<typeof PerToolResult>;
