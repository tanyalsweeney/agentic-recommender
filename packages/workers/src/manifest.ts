import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { manifestEntries } from "@agent12/shared";
import type { Db } from "./db.js";

export interface ManifestEntry {
  name: string;
  category: string | null;
  maturityTier: string;
  deploymentModel: string | null;
  minimumRuntimeRequirements: unknown;
  knownConstraints: unknown;
  domainKnowledgePayload: unknown;
}

export interface Manifest {
  tools: ManifestEntry[];
  patterns: ManifestEntry[];
  failureModes: ManifestEntry[];
}

// Fetch all vetted manifest entries from the DB and assemble the manifest object.
// Returns the manifest and a stable version hash (changes when any entry changes).
export async function fetchManifest(db: Db): Promise<{ manifest: Manifest; manifestVersion: string }> {
  const rows = await db
    .select()
    .from(manifestEntries)
    .where(eq(manifestEntries.vetted, true));

  const toEntry = (row: typeof rows[0]): ManifestEntry => ({
    name: row.toolName,
    category: row.category,
    maturityTier: row.maturityTier,
    deploymentModel: row.deploymentModel,
    minimumRuntimeRequirements: row.minimumRuntimeRequirements,
    knownConstraints: row.knownConstraints,
    domainKnowledgePayload: row.domainKnowledgePayload,
  });

  const manifest: Manifest = {
    tools:        rows.filter((r) => r.category !== "pattern" && r.category !== "failure_mode").map(toEntry),
    patterns:     rows.filter((r) => r.category === "pattern").map(toEntry),
    failureModes: rows.filter((r) => r.category === "failure_mode").map(toEntry),
  };

  // Version: hash of sorted tool names + last refreshed timestamps.
  // Changes when tools are added, removed, or refreshed.
  const versionInput = rows
    .map((r) => `${r.toolName}:${r.lastRefreshedAt?.toISOString() ?? ""}`)
    .sort()
    .join("|");
  const manifestVersion = createHash("sha256").update(versionInput).digest("hex").slice(0, 12);

  return { manifest, manifestVersion };
}
