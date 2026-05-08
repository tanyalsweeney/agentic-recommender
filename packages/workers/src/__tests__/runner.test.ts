import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import {
  tenants,
  tenantSecrets,
  users,
  userSecrets,
  runs,
  runCheckpoints,
  encryptKey,
} from "@agent12/shared";
import { runAgent, type RunAgentOpts } from "../runner.js";

describe("runAgent BYOK key threading", () => {
  let db: ReturnType<typeof getTestDb>;
  const cleanupTenants: string[] = [];
  const cleanupUsers: string[] = [];
  const cleanupRuns: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    cleanupTenants.length = 0;
    cleanupUsers.length = 0;
    cleanupRuns.length = 0;
  });

  afterEach(async () => {
    if (cleanupRuns.length > 0) {
      await db.delete(runCheckpoints).where(inArray(runCheckpoints.runId, cleanupRuns));
      await db.delete(runs).where(inArray(runs.id, cleanupRuns));
    }
    if (cleanupUsers.length > 0) {
      await db.delete(userSecrets).where(inArray(userSecrets.userId, cleanupUsers));
      await db.delete(users).where(inArray(users.id, cleanupUsers));
    }
    if (cleanupTenants.length > 0) {
      await db.delete(tenantSecrets).where(inArray(tenantSecrets.tenantId, cleanupTenants));
      await db.delete(tenants).where(inArray(tenants.id, cleanupTenants));
    }
  });

  async function setupRun(args: {
    tenantSecretFor?: string;
    tenantSecretValue?: string;
    userSecretFor?: string;
    userSecretValue?: string;
  }): Promise<{
    tenantId: string;
    userId: string;
    runId: string;
  }> {
    const tenantId = uuidv7();
    await db.insert(tenants).values({
      id: tenantId,
      name: `tenant-${tenantId}`,
      slug: `t-${tenantId}`,
      plan: "standard",
    });
    cleanupTenants.push(tenantId);

    if (args.tenantSecretFor && args.tenantSecretValue) {
      await db.insert(tenantSecrets).values({
        tenantId,
        provider: args.tenantSecretFor,
        encryptedKey: encryptKey(args.tenantSecretValue),
      });
    }

    const [user] = await db
      .insert(users)
      .values({ email: `byok-${uuidv7()}@example.com`, tenantId })
      .returning();
    cleanupUsers.push(user!.id);

    if (args.userSecretFor && args.userSecretValue) {
      await db.insert(userSecrets).values({
        userId: user!.id,
        provider: args.userSecretFor,
        encryptedKey: encryptKey(args.userSecretValue),
      });
    }

    const [run] = await db
      .insert(runs)
      .values({
        userId: user!.id,
        status: "running",
        tier: "pass1",
        verifiedContext: { description: "test architecture" },
        verifiedContextHash: `ctx-${uuidv7()}`,
      })
      .returning();
    cleanupRuns.push(run!.id);

    return { tenantId, userId: user!.id, runId: run!.id };
  }

  type CallAgentFn = RunAgentOpts["callAgent"];

  function captureApiKeySpy(): { spy: CallAgentFn; received: { apiKey?: string } } {
    const received: { apiKey?: string } = {};
    const spy = vi.fn(async (_m: unknown, _c: unknown, _p: unknown, apiKey: string) => {
      received.apiKey = apiKey;
      return { ok: true };
    });
    return { spy: spy as unknown as CallAgentFn, received };
  }

  it("threads the decrypted tenant_secrets key into callAgent", async () => {
    const tenantKey = `tenant-key-${uuidv7()}`;
    const { tenantId, runId } = await setupRun({
      tenantSecretFor: "anthropic",
      tenantSecretValue: tenantKey,
    });

    const { spy, received } = captureApiKeySpy();

    await runAgent({
      db,
      runId,
      tenantId,
      agentKey: "intake",
      wave: "1",
      upstreamHashes: {},
      callAgent: spy,
    });

    expect(received.apiKey).toBe(tenantKey);
  });

  it("falls back to system env when tenant has no secret for the provider", async () => {
    const { tenantId, runId } = await setupRun({});

    const { spy, received } = captureApiKeySpy();

    await runAgent({
      db,
      runId,
      tenantId,
      agentKey: "intake",
      wave: "1",
      upstreamHashes: {},
      callAgent: spy,
    });

    expect(received.apiKey).toBe(process.env.ANTHROPIC_API_KEY);
  });

  it("falls back to system env when tenant has a secret for a different provider", async () => {
    const { tenantId, runId } = await setupRun({
      tenantSecretFor: "kimi",
      tenantSecretValue: "kimi-only-key",
    });

    const { spy, received } = captureApiKeySpy();

    await runAgent({
      db,
      runId,
      tenantId,
      agentKey: "intake",
      wave: "1",
      upstreamHashes: {},
      callAgent: spy,
    });

    expect(received.apiKey).not.toBe("kimi-only-key");
    expect(received.apiKey).toBe(process.env.ANTHROPIC_API_KEY);
  });

  // ── user_secrets resolution (3.5a.1.b) ──────────────────────────────────────

  it("threads the decrypted user_secrets key into callAgent (run.userId)", async () => {
    const userKey = `user-key-${uuidv7()}`;
    const { tenantId, runId } = await setupRun({
      userSecretFor: "anthropic",
      userSecretValue: userKey,
    });

    const { spy, received } = captureApiKeySpy();

    await runAgent({
      db,
      runId,
      tenantId,
      agentKey: "intake",
      wave: "1",
      upstreamHashes: {},
      callAgent: spy,
    });

    expect(received.apiKey).toBe(userKey);
  });

  it("user_secrets wins over tenant_secrets when both exist for the provider", async () => {
    const userKey = `user-key-${uuidv7()}`;
    const tenantKey = `tenant-key-${uuidv7()}`;
    const { tenantId, runId } = await setupRun({
      tenantSecretFor: "anthropic",
      tenantSecretValue: tenantKey,
      userSecretFor: "anthropic",
      userSecretValue: userKey,
    });

    const { spy, received } = captureApiKeySpy();

    await runAgent({
      db,
      runId,
      tenantId,
      agentKey: "intake",
      wave: "1",
      upstreamHashes: {},
      callAgent: spy,
    });

    expect(received.apiKey).toBe(userKey);
    expect(received.apiKey).not.toBe(tenantKey);
  });

  it("falls back to tenant_secrets when user has no secret for the provider", async () => {
    const tenantKey = `tenant-key-${uuidv7()}`;
    const { tenantId, runId } = await setupRun({
      tenantSecretFor: "anthropic",
      tenantSecretValue: tenantKey,
      userSecretFor: "kimi", // user only has a kimi key
      userSecretValue: "user-kimi-key",
    });

    const { spy, received } = captureApiKeySpy();

    await runAgent({
      db,
      runId,
      tenantId,
      agentKey: "intake",
      wave: "1",
      upstreamHashes: {},
      callAgent: spy,
    });

    expect(received.apiKey).toBe(tenantKey);
  });
});
