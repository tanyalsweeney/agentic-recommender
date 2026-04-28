import { z } from "zod";
import { CostSignals, TripHazard } from "./shared.js";

const ToolRecommendation = z.object({
  tool: z.string(),
  purpose: z.string(),
  buildVsBuy: z.enum(["build", "buy", "either"]),
  rationale: z.string(),
  // Tool dependencies this agent is assuming — CV checks these are covered
  dependsOn: z.array(z.string()).optional(),
});

export const ToolIntegrationAgentOutput = z.object({
  toolAgentBoundary: z.object({
    principle: z.string(), // tools = deterministic, agents = judgment
    applicationToThisSystem: z.string(),
  }),
  recommendedTools: z.array(ToolRecommendation),
  mcpUsage: z.object({
    recommended: z.boolean(),
    rationale: z.string(),
    suggestedServers: z.array(z.string()).optional(),
  }),
  integrationPoints: z.array(z.object({
    system: z.string(),
    integrationApproach: z.string(),
    notes: z.string().optional(),
  })),
  declaredConstraints: z.array(z.string()), // for CV cross-agent conflict checks
  implementationTripHazards: z.array(TripHazard),
  costSignals: CostSignals,
});

export type ToolIntegrationAgentOutput = z.infer<typeof ToolIntegrationAgentOutput>;
