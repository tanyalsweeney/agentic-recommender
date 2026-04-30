import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "./test-db.js";
import { runCheckpoints, runs, users } from "@agent12/shared";
import { readCheckpoint, writeCheckpoint } from "../checkpoint.js";

// ── helpers ───────────────────────────────────────────────────────────────────

async function seedRun(db: ReturnType<typeof getTestDb>) {
  const [user] = await db.insert(users)
    .values({ email: `test-${Date.now()}@example.com` })
    .returning();
  const [run] = await db.insert(runs)
    .values({
      userId: user.id,
      status: "running",
      tier: "pass1",
      verifiedContext: {},
      verifiedContextHash: "ctx_hash_001",
    })
    .returning();
  return run;
}

const BASE_KEY = {
  agentName:       "orchestration",
  contextHash:     "ctx_abc123",
  agentVersion:    "2026-04-29-deadbeef/claude-sonnet-4-6",
  manifestVersion: "manifest_v1",
  upstreamHashes:  {} as Record<string, string>,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe("checkpoint reuse — 4 validity conditions", () => {
  let db: ReturnType<typeof getTestDb>;
  let runId: string;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(runCheckpoints);
    await db.delete(runs);
    await db.delete(users);
    const run = await seedRun(db);
    runId = run.id;
  });

  it("returns null when no checkpoint exists", async () => {
    const result = await readCheckpoint(db, { runId, ...BASE_KEY });
    expect(result).toBeNull();
  });

  it("returns cached output when all 4 conditions match", async () => {
    const output = { recommendedPattern: "dag" };
    await writeCheckpoint(db, { runId, wave: "1", output, ...BASE_KEY });

    const result = await readCheckpoint(db, { runId, ...BASE_KEY });
    expect(result).toEqual(output);
  });

  it("condition 1: context hash mismatch → cache miss", async () => {
    await writeCheckpoint(db, { runId, wave: "1", output: { x: 1 }, ...BASE_KEY });

    const result = await readCheckpoint(db, {
      runId,
      ...BASE_KEY,
      contextHash: "different_hash",
    });
    expect(result).toBeNull();
  });

  it("condition 2: agent version changed → cache miss", async () => {
    await writeCheckpoint(db, { runId, wave: "1", output: { x: 1 }, ...BASE_KEY });

    const result = await readCheckpoint(db, {
      runId,
      ...BASE_KEY,
      agentVersion: "2026-04-29-deadbeef/claude-opus-4-7",
    });
    expect(result).toBeNull();
  });

  it("condition 3: manifest refreshed → cache miss", async () => {
    await writeCheckpoint(db, { runId, wave: "1", output: { x: 1 }, ...BASE_KEY });

    const result = await readCheckpoint(db, {
      runId,
      ...BASE_KEY,
      manifestVersion: "manifest_v2",
    });
    expect(result).toBeNull();
  });

  it("condition 4: upstream hash changed → cache miss", async () => {
    const keyWithUpstream = {
      ...BASE_KEY,
      upstreamHashes: { intake: "hash_a" },
    };
    await writeCheckpoint(db, { runId, wave: "1", output: { x: 1 }, ...keyWithUpstream });

    const result = await readCheckpoint(db, {
      runId,
      ...BASE_KEY,
      upstreamHashes: { intake: "hash_b" },
    });
    expect(result).toBeNull();
  });

  it("model change in agent version invalidates checkpoint", async () => {
    await writeCheckpoint(db, {
      runId, wave: "1", output: { x: 1 },
      ...BASE_KEY,
      agentVersion: "2026-04-29-deadbeef/claude-sonnet-4-6",
    });

    const result = await readCheckpoint(db, {
      runId,
      ...BASE_KEY,
      agentVersion: "2026-04-29-deadbeef/kimi-k2",
    });
    expect(result).toBeNull();
  });

  it("overwrites stale checkpoint when re-run produces new output", async () => {
    await writeCheckpoint(db, { runId, wave: "1", output: { v: 1 }, ...BASE_KEY });
    await writeCheckpoint(db, { runId, wave: "1", output: { v: 2 }, ...BASE_KEY });

    const result = await readCheckpoint(db, { runId, ...BASE_KEY });
    expect(result).toEqual({ v: 2 });
  });
});
