import { eq } from "drizzle-orm";
import { manifestTools, manifestPatterns, manifestFailureModes } from "./schema.js";

export interface ManifestTool {
  name: string;
  category: string | null;
  maturityTier: string;
  deploymentModel: string | null;
  minimumRuntimeRequirements: unknown;
  knownConstraints: unknown;
  domainKnowledgePayload: unknown;
  lastRefreshedAt: Date | null;
}

export interface ManifestPattern {
  name: string;
  maturityTier: string;
  domainKnowledgePayload: unknown;
  lastRefreshedAt: Date | null;
}

export interface ManifestFailureMode {
  name: string;
  maturityTier: string;
  domainKnowledgePayload: unknown;
  lastRefreshedAt: Date | null;
}

export interface Manifest {
  tools: ManifestTool[];
  patterns: ManifestPattern[];
  failureModes: ManifestFailureMode[];
}

type AnyDb = { select: () => any };

export async function loadManifest(db: AnyDb): Promise<Manifest> {
  const d = db as any;
  const [toolRows, patternRows, failureModeRows] = await Promise.all([
    d.select().from(manifestTools).where(eq(manifestTools.vetted, true)),
    d.select().from(manifestPatterns).where(eq(manifestPatterns.vetted, true)),
    d.select().from(manifestFailureModes).where(eq(manifestFailureModes.vetted, true)),
  ]);

  return {
    tools: toolRows.map((r: any): ManifestTool => ({
      name: r.toolName,
      category: r.category,
      maturityTier: r.maturityTier,
      deploymentModel: r.deploymentModel,
      minimumRuntimeRequirements: r.minimumRuntimeRequirements,
      knownConstraints: r.knownConstraints,
      domainKnowledgePayload: r.domainKnowledgePayload,
      lastRefreshedAt: r.lastRefreshedAt,
    })),
    patterns: patternRows.map((r: any): ManifestPattern => ({
      name: r.patternName,
      maturityTier: r.maturityTier,
      domainKnowledgePayload: r.domainKnowledgePayload,
      lastRefreshedAt: r.lastRefreshedAt,
    })),
    failureModes: failureModeRows.map((r: any): ManifestFailureMode => ({
      name: r.failureModeName,
      maturityTier: r.maturityTier,
      domainKnowledgePayload: r.domainKnowledgePayload,
      lastRefreshedAt: r.lastRefreshedAt,
    })),
  };
}
