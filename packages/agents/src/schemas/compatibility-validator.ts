import { z } from "zod";

const PerToolResult = z.object({
  toolName: z.string(),
  version: z.string().optional(),
  isCurrentVersion: z.boolean().nullish(),
  eolDate: z.string().nullable().optional(),
  cves: z.object({
    critical: z.array(z.string()),
    high: z.array(z.string()),
  }).optional(),
  breakingChanges: z.array(z.string()).optional(),
  license: z.string().nullable().optional(), // SPDX identifier
  isCopyleft: z.boolean().nullish(),
  pricing: z.object({
    tier: z.string().optional(),
    cost: z.string().nullable().optional(),
  }).optional(),
  regionalAvailability: z.string().nullable().optional(),
  sourceUrl: z.string().optional(),
  fromCache: z.boolean(),
  flaggedUnavailable: z.array(z.string()).optional(), // fields that shipped as unavailable
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
    totalEstimatedMonthlyCost: z.string().optional(),
    breakdown: z.array(z.object({
      component: z.string(),
      estimate: z.string(),
    })),
  }),
});

export type CompatibilityValidatorOutput = z.infer<typeof CompatibilityValidatorOutput>;
export type PerToolResult = z.infer<typeof PerToolResult>;
