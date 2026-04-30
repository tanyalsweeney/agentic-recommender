import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import { config, runs } from "@agent12/shared";
import type { Db } from "./db.js";

// Tenant context is pre-registered, structured domain context injected into
// verified context before Wave 1. It is not a pipeline wave.
//
// Storage: config table, key = "tenant.context.{tag}", owner = tenantId
// Value format: { version: "YYYY-MM-DD-{sha256_8chars}", content: TenantContextBlock }
//
// Versioning follows the same pattern as agent versions. Version is computed at
// block write time (admin dashboard, Phase 5). A version change in upstreamHashes
// invalidates checkpoints for affected runs automatically.

export interface TenantContextBlock {
  requiredRegulatoryControls: string[];
  prohibitedToolsOrPatterns: string[];
  mandatoryCertifications: string[];
  scopeOfApplicability: string;
  conflictFlags?: Array<{ constraint: string; conflictingBlocks: string[] }>;
}

// Compute a version string for a tenant context block. Called at write time.
export function computeTenantContextVersion(content: TenantContextBlock): string {
  const date = new Date().toISOString().slice(0, 10);
  const hash = createHash("sha256")
    .update(JSON.stringify(content))
    .digest("hex")
    .slice(0, 8);
  return `${date}-${hash}`;
}

export interface TenantContextResult {
  block: TenantContextBlock | null;
  version: string | null;
}

// Load the tenant context block for a run's tenantContextTag.
// Returns { block: null, version: null } when no context is registered.
export async function loadTenantContext(
  db: Db,
  tenantContextTag: string | null | undefined,
  tenantId?: string
): Promise<TenantContextResult> {
  if (!tenantContextTag || !tenantId) return { block: null, version: null };

  const rows = await db
    .select()
    .from(config)
    .where(and(
      eq(config.key, `tenant.context.${tenantContextTag}`),
      eq(config.owner, tenantId)
    ))
    .limit(1);

  if (!rows[0]) return { block: null, version: null };

  const stored = JSON.parse(rows[0].value) as { version: string; content: TenantContextBlock };
  return { block: stored.content, version: stored.version };
}

// Inject tenant context into the run's verifiedContext in the DB.
// Returns the tenant context version (for upstreamHashes), or null if inactive.
export async function injectTenantContext(
  db: Db,
  runId: string,
  tenantId?: string
): Promise<string | null> {
  const runRows = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  const run = runRows[0];
  if (!run) throw new Error(`Run ${runId} not found`);

  const { block, version } = await loadTenantContext(db, run.tenantContextTag, tenantId);
  if (!block || !version) return null;

  // Merge tenant context into verifiedContext so all downstream agents see it.
  const enriched = {
    ...(run.verifiedContext as object),
    tenantContext: block,
  };

  await db.update(runs)
    .set({ verifiedContext: enriched })
    .where(eq(runs.id, runId));

  return version;
}
