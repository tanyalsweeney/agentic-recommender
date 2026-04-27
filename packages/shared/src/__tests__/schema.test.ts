import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "./test-db.js";
import { users, runs, runCheckpoints, cvResultCache, config } from "../db/schema.js";
import { sql } from "drizzle-orm";

async function createTestUser(db: ReturnType<typeof getTestDb>) {
  const [user] = await db
    .insert(users)
    .values({ email: `test-${Date.now()}@example.com` })
    .returning();
  return user;
}

describe("runs table", () => {
  let db: ReturnType<typeof getTestDb>;
  let userId: string;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(runCheckpoints);
    await db.delete(runs);
    await db.delete(users);
    const user = await createTestUser(db);
    userId = user.id;
  });

  it("inserts and retrieves a run", async () => {
    const [run] = await db
      .insert(runs)
      .values({
        userId,
        status: "queued",
        tier: "free",
        verifiedContext: { description: "test system" },
        verifiedContextHash: "abc123",
      })
      .returning();

    expect(run.id).toBeDefined();
    expect(run.status).toBe("queued");
    expect(run.tier).toBe("free");
    expect(run.charged).toBe(false);
  });
});

describe("run_checkpoints table", () => {
  let db: ReturnType<typeof getTestDb>;
  let runId: string;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(runCheckpoints);
    await db.delete(runs);
    await db.delete(users);

    const user = await createTestUser(db);
    const [run] = await db
      .insert(runs)
      .values({
        userId: user.id,
        status: "running",
        tier: "pass1",
        verifiedContext: {},
        verifiedContextHash: "ctx_hash_001",
      })
      .returning();
    runId = run.id;
  });

  it("stores upstream_hashes for recursive checkpoint validity", async () => {
    const upstreamHashes = {
      orchestration: "prompt_hash_a1b2c3",
      security: "prompt_hash_d4e5f6",
    };

    const [checkpoint] = await db
      .insert(runCheckpoints)
      .values({
        runId,
        agentName: "skeptic",
        wave: "3",
        status: "completed",
        outputJsonb: { caveatTiers: [] },
        upstreamHashes,
        agentVersion: "2026-04-27-a1b2c3d4",
        manifestVersion: "manifest_hash_001",
        contextHash: "ctx_hash_001",
      })
      .returning();

    expect(checkpoint.upstreamHashes).toEqual(upstreamHashes);
  });

  it("checkpoint reuse: same context hash, agent version, manifest version, and upstream hashes", async () => {
    await db.insert(runCheckpoints).values({
      runId,
      agentName: "orchestration",
      wave: "1",
      status: "completed",
      outputJsonb: { pattern: "DAG" },
      upstreamHashes: {},
      agentVersion: "2026-04-27-a1b2c3d4",
      manifestVersion: "manifest_hash_001",
      contextHash: "ctx_hash_001",
    });

    const [reused] = await db
      .select()
      .from(runCheckpoints)
      .where(
        sql`agent_name = 'orchestration'
          AND agent_version = '2026-04-27-a1b2c3d4'
          AND manifest_version = 'manifest_hash_001'
          AND context_hash = 'ctx_hash_001'`
      );

    expect(reused).toBeDefined();
    expect(reused.outputJsonb).toEqual({ pattern: "DAG" });
  });
});

describe("cv_result_cache table", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(cvResultCache);
  });

  it("stores and retrieves per-tool CV results", async () => {
    const [cached] = await db
      .insert(cvResultCache)
      .values({
        toolName: "langchain",
        toolVersion: "0.3.0",
        cveStatus: { critical: [], high: [] },
        pricing: { tier: "open-source", cost: null },
        license: "MIT",
        sourceUrl: "https://python.langchain.com/docs/",
        ttlSeconds: 86400,
      })
      .returning();

    expect(cached.toolName).toBe("langchain");
    expect(cached.license).toBe("MIT");
    expect(cached.cveStatus).toEqual({ critical: [], high: [] });
  });

  it("enforces unique constraint on tool_name + tool_version", async () => {
    await db.insert(cvResultCache).values({
      toolName: "langchain",
      toolVersion: "0.3.0",
      ttlSeconds: 86400,
    });

    await expect(
      db.insert(cvResultCache).values({
        toolName: "langchain",
        toolVersion: "0.3.0",
        ttlSeconds: 86400,
      })
    ).rejects.toThrow();
  });
});

describe("required indexes", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(() => {
    db = getTestDb();
  });

  it("run_checkpoints has composite index on context_hash, agent_name, agent_version, manifest_version", async () => {
    const [row] = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'run_checkpoints'
        AND indexdef LIKE '%context_hash%'
        AND indexdef LIKE '%agent_name%'
        AND indexdef LIKE '%agent_version%'
        AND indexdef LIKE '%manifest_version%'
    `);
    expect(row).toBeDefined();
  });

  it("runs has index on user_id and created_at", async () => {
    const [row] = await db.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'runs'
        AND indexdef LIKE '%user_id%'
        AND indexdef LIKE '%created_at%'
    `);
    expect(row).toBeDefined();
  });
});
