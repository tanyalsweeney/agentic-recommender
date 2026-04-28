import { z } from "zod";
import { CostSignals, TripHazard } from "./shared.js";

// Agentic-specific attack surfaces only — traditional security checklist is out of scope
const AgenticThreat = z.object({
  threat: z.string(),
  attackVector: z.string(),
  likelihood: z.enum(["low", "medium", "high"]),
  impact: z.enum(["low", "medium", "high"]),
  mitigations: z.array(z.string()),
});

export const SecurityAgentOutput = z.object({
  agenticAttackSurface: z.object({
    promptInjectionRisks: z.array(AgenticThreat),
    toolMisuseRisks: z.array(AgenticThreat),
    trustBoundaryViolations: z.array(AgenticThreat),
    dataExfiltrationViaReasoning: z.array(AgenticThreat),
    excessiveAutonomyRisks: z.array(AgenticThreat),
  }),
  trustBoundaries: z.array(z.object({
    boundary: z.string(),
    enforcement: z.string(),
  })),
  recommendedControls: z.array(z.string()),
  // Declared constraints that CV must check other agents' recommendations against
  declaredConstraints: z.array(z.string()),
  implementationTripHazards: z.array(TripHazard),
  costSignals: CostSignals,
});

export type SecurityAgentOutput = z.infer<typeof SecurityAgentOutput>;
