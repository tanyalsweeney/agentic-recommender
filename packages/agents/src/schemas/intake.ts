import { z } from "zod";
import { InferenceState } from "./shared.js";

const StepResult = z.object({
  state: InferenceState,
  selected: z.string().optional(),   // null/undefined when low_confidence or not_applicable
  rationale: z.string(),
});

export const IntakeAgentOutput = z.object({
  steps: z.object({
    domainContext:        StepResult.optional(), // conditional — only when domain agents active
    orchestrationPattern: StepResult,
    platformDeployment:   StepResult,
    externalIntegrations: StepResult,
    dataFileHandling:     StepResult,
    memoryState:          StepResult,
    autonomyHitl:         StepResult,
    scale:                StepResult,
    greenfieldBrownfield: StepResult,
    failureTolerance:     StepResult,
    modelPreferences:     StepResult,
    tools:                z.object({
      state: InferenceState,
      selected: z.array(z.string()).optional(),
      rationale: z.string(),
    }),
  }),
  constraintClassifications: z.array(z.object({
    constraint: z.string(),
    type: z.enum(["binary_exclusion", "optimization_target"]),
    rationale: z.string(),
  })),
});

export type IntakeAgentOutput = z.infer<typeof IntakeAgentOutput>;
