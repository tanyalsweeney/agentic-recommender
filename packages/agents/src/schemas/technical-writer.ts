import { z } from "zod";
import { MaturityLabel, CaveatTier } from "./shared.js";

const ToolManifestEntry = z.object({
  toolName: z.string(),
  maturityLabel: MaturityLabel,
  purpose: z.string(),
  // Click-to-expand confidence detail (accepted cherry-pick)
  confidenceDetail: z.object({
    adoptionSignalCount: z.number().optional(),
    sourceTierBreakdown: z.string().optional(),
    timeWithoutContradiction: z.string().optional(),
    nextTierRequirement: z.string().optional(),
  }).optional(),
  version: z.string().optional(),
  isUserSpecified: z.boolean().default(false),
  caveats: z.array(z.string()).optional(),
});

export const TechnicalWriterOutput = z.object({
  executiveSummary: z.object({
    content: z.string(),             // plain English, voice directive enforced in prompt
    // Skeptic debate summary in exec summary (accepted cherry-pick)
    debateSummary: z.string(),       // "N concerns raised, M resolved, K remain as [tier]"
    scopeStatement: z.string(),
    nonEstablishedCallout: z.string().optional(),
  }),
  // Mermaid flowchart as text — validated before Pass 1 finalizes
  architectureDiagram: z.object({
    mermaidSource: z.string(),
    direction: z.enum(["LR", "TD", "BT", "RL"]),
    abstractionLevel: z.literal("decision_maker"),
  }),
  validatedToolManifest: z.array(ToolManifestEntry),
  costEstimates: z.object({
    ongoingMonthlyEstimate: z.string(),
    breakdown: z.array(z.object({
      component: z.string(),
      estimate: z.string(),
    })),
  }),
  securitySummary: z.string(),
  failureModeSummary: z.string(),
  trustControlSummary: z.string(),
  assignedCaveats: z.array(z.object({
    tier: CaveatTier,
    plainLanguageDescription: z.string(),
    prominence: z.enum(["footnote", "callout", "leads_document"]),
  })),
});

export type TechnicalWriterOutput = z.infer<typeof TechnicalWriterOutput>;
