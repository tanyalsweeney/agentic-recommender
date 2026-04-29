import { z } from "zod";

// Per-agent provider configuration — what is stored in the config table and
// validated at write time by the dashboard. References a provider by name
// (must be a key in PROVIDER_REGISTRY in providers.ts). Infrastructure details
// (base URL, API key env var) live in the registry, not here.
export const ProviderConfig = z.object({
  provider: z.string(), // must be a key in PROVIDER_REGISTRY
  model: z.string(),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;

// Implementation trip hazard — named gotcha with mitigation, used across all recommendation agents.
// Surfaced in Pass 1 summary and expanded in Pass 2 ADRs.
export const TripHazard = z.object({
  hazard: z.string(),                              // what the gotcha is, specific to this architecture
  mitigation: z.string(),                          // how to avoid or reduce the impact
  severity: z.enum(["low", "medium", "high"]),     // how costly if you hit this without mitigation
});
export type TripHazard = z.infer<typeof TripHazard>;

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

// Tool recommended by an agent that is not in the manifest.
// Written to manifest_entries with vetted=false by the worker after the run.
export const ManifestCandidate = z.object({
  toolName: z.string(),
  category: z.string(),
  useCase: z.string(),     // why it was recommended for this specific architecture
  tradeoffs: z.string(),   // known tradeoffs the agent surfaced
});
export type ManifestCandidate = z.infer<typeof ManifestCandidate>;

// Step inference state for intake
export const InferenceState = z.enum([
  "high_confidence",  // pre-selected
  "low_confidence",   // nothing pre-selected
  "not_applicable",   // confident the step isn't required
]);
export type InferenceState = z.infer<typeof InferenceState>;
