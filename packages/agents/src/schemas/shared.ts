import { z } from "zod";

// Cost signals every Wave 1 and Wave 2 agent produces for CV at Wave 2.5
export const CostSignals = z.object({
  estimatedMonthlyApiCalls: z.number().nullish(),
  computeIntensity: z.enum(["low", "medium", "high"]).nullish(),
  humanReviewHoursPerRun: z.number().nullish(),
  notes: z.string().nullish(),
});
export type CostSignals = z.infer<typeof CostSignals>;

// Caveat tiers assigned by The Skeptic
export const CaveatTier = z.enum([
  "Advisory",         // Concern noted, doesn't block
  "BlockingCondition", // Specific condition must be met before building
  "DoNotBuildThis",   // Hard constraint violation or architectural dead end
]);
export type CaveatTier = z.infer<typeof CaveatTier>;

// Maturity labels derived from manifest state
export const MaturityLabel = z.enum([
  "Established",
  "Emerging",
  "Experimental",
  "UserSpecified",
]);
export type MaturityLabel = z.infer<typeof MaturityLabel>;

// Step inference state for intake
export const InferenceState = z.enum([
  "high_confidence",  // pre-selected
  "low_confidence",   // nothing pre-selected
  "not_applicable",   // confident the step isn't required
]);
export type InferenceState = z.infer<typeof InferenceState>;
