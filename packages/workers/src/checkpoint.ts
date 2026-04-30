import { eq, and } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { runCheckpoints } from "@agent12/shared";

// Minimal DB type — any drizzle-postgres-js client with query support works.
type Db = PostgresJsDatabase<Record<string, unknown>>;

// The agent version string includes the model to ensure model changes
// invalidate checkpoint reuse: "YYYY-MM-DD-{hash}/{model}"
// e.g. "2026-04-29-abc12345/claude-sonnet-4-6"

export interface CheckpointKey {
  runId: string;
  agentName: string;
  contextHash: string;
  agentVersion: string;
  manifestVersion: string;
  upstreamHashes: Record<string, string>;
}

export interface WriteCheckpointOpts extends CheckpointKey {
  wave: string;
  output: unknown;
}

// Build a model-qualified agent version string.
export function qualifiedAgentVersion(baseVersion: string, model: string): string {
  return `${baseVersion}/${model}`;
}

// Read a checkpoint and validate all 4 reuse conditions:
// 1. contextHash matches
// 2. agentVersion matches (includes model — change invalidates)
// 3. manifestVersion matches
// 4. upstreamHashes all match
// Returns the cached output if valid, null if cache miss.
export async function readCheckpoint(
  db: Db,
  key: CheckpointKey
): Promise<unknown> {
  const rows = await db
    .select()
    .from(runCheckpoints)
    .where(
      and(
        eq(runCheckpoints.runId, key.runId),
        eq(runCheckpoints.agentName, key.agentName),
        eq(runCheckpoints.contextHash, key.contextHash),
        eq(runCheckpoints.agentVersion, key.agentVersion),
        eq(runCheckpoints.manifestVersion, key.manifestVersion),
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Condition 4: upstream hashes must all match
  const stored = (row.upstreamHashes ?? {}) as Record<string, string>;
  const incoming = key.upstreamHashes;
  const storedKeys = Object.keys(stored);
  const incomingKeys = Object.keys(incoming);

  if (storedKeys.length !== incomingKeys.length) return null;
  for (const k of incomingKeys) {
    if (stored[k] !== incoming[k]) return null;
  }

  return row.outputJsonb;
}

// Write a checkpoint, overwriting any existing entry for the same key.
export async function writeCheckpoint(
  db: Db,
  opts: WriteCheckpointOpts
): Promise<void> {
  const { runId, agentName, contextHash, agentVersion, manifestVersion, upstreamHashes, wave, output } = opts;

  await db.delete(runCheckpoints).where(
    and(
      eq(runCheckpoints.runId, runId),
      eq(runCheckpoints.agentName, agentName),
      eq(runCheckpoints.contextHash, contextHash),
      eq(runCheckpoints.agentVersion, agentVersion),
      eq(runCheckpoints.manifestVersion, manifestVersion),
    )
  );

  await db.insert(runCheckpoints).values({
    runId,
    agentName,
    wave,
    status: "completed",
    outputJsonb: output,
    upstreamHashes,
    agentVersion,
    manifestVersion,
    contextHash,
  });
}
