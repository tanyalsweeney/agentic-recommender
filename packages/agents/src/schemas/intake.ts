import { z } from "zod";
import { InferenceState } from "./shared.js";

const StepResult = z.object({
  state: InferenceState,
  selected: z.string().nullish(),    // null or undefined when low_confidence or not_applicable
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
      selected: z.array(z.string()).nullish(),
      rationale: z.string(),
    }),
  }),
  constraintClassifications: z.array(z.object({
    constraint: z.string(),
    type: z.enum(["binary_exclusion", "optimization_target"]),
    rationale: z.string(),
  })),

  // Detected during intake analysis. UI renders each type at a different point in the flow.
  contradictions: z.array(z.object({
    description: z.string(),        // what conflicts and why it matters
    stepA: z.string().nullish(),     // first conflicting element (step name or constraint)
    stepB: z.string().nullish(),     // second conflicting element
    suggestedResolution: z.string(), // what the user should consider changing
  })),

  // Things the description logically implies that the user didn't explicitly state.
  // Surfaced on the review screen as "Before you run."
  impliedRequirements: z.array(z.object({
    implication: z.string(),  // what the description implies
    domain: z.string(),       // which specialist domain is most affected
    whyItMatters: z.string(), // the gotcha or failure mode this connects to
  })),

  // Null when description quality is sufficient. Populated when many steps are
  // low_confidence and a description refinement would reduce run count and cost.
  descriptionQualityNote: z.string().nullish(),
});

export type IntakeAgentOutput = z.infer<typeof IntakeAgentOutput>;
