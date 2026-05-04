import { describe, it, expect, beforeEach } from "vitest";
import { eq, like } from "drizzle-orm";
import { getTestDb } from "./test-db.js";
import { runs, users, config } from "@agent12/shared";
import {
  injectTenantContext,
  computeTenantContextVersion,
  type TenantContextBlock,
} from "../tenant-context.js";
import { uuidv7 } from "uuidv7";

// ── helpers ───────────────────────────────────────────────────────────────────

async function seedRun(
  db: ReturnType<typeof getTestDb>,
  opts: { tenantContextTag?: string } = {}
) {
  const [user] = await db
    .insert(users)
    // uuidv7 guarantees uniqueness even when tests run in the same millisecond
    .values({ email: `tc-test-${uuidv7()}@example.com` })
    .returning();

  const [run] = await db
    .insert(runs)
    .values({
      userId: user.id,
      status: "queued",
      tier: "free",
      verifiedContext: { description: "a pipeline that processes documents" },
      verifiedContextHash: "hash-001",
      tenantContextTag: opts.tenantContextTag ?? null,
    })
    .returning();

  return { run, user };
}

function makeContextBlock(overrides: Partial<TenantContextBlock> = {}): TenantContextBlock {
  return {
    requiredRegulatoryControls: ["HIPAA"],
    prohibitedToolsOrPatterns: ["third-party-llm-api"],
    mandatoryCertifications: ["SOC2-Type2"],
    scopeOfApplicability: "all components",
    ...overrides,
  };
}

async function registerTenantContext(
  db: ReturnType<typeof getTestDb>,
  tenantId: string,
  tag: string,
  block: TenantContextBlock
) {
  const version = computeTenantContextVersion(block);
  await db
    .insert(config)
    .values({
      key: `tenant.context.${tag}`,
      value: JSON.stringify({ version, content: block }),
      owner: tenantId,
    })
    .onConflictDoUpdate({
      target: [config.key, config.owner],
      set: { value: JSON.stringify({ version, content: block }) },
    });
  return version;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("injectTenantContext", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    // Only clean up config keys this suite owns. Users and runs use unique
    // uuidv7 emails so they never collide with other test files running concurrently.
    await db.delete(config).where(like(config.key, "tenant.context.%"));
  });

  it("injects tenant context into verifiedContext when block is registered", async () => {
    const tenantId = uuidv7();
    const block = makeContextBlock();
    await registerTenantContext(db, tenantId, "hipaa", block);
    const { run } = await seedRun(db, { tenantContextTag: "hipaa" });

    await injectTenantContext(db as any, run.id, tenantId);

    const updated = await db.select().from(runs).where(eq(runs.id, run.id)).limit(1);
    const ctx = updated[0].verifiedContext as Record<string, unknown>;
    expect(ctx.tenantContext).toBeDefined();
    expect((ctx.tenantContext as TenantContextBlock).requiredRegulatoryControls).toContain("HIPAA");
  });

  it("preserves existing verifiedContext fields after injection", async () => {
    const tenantId = uuidv7();
    const block = makeContextBlock();
    await registerTenantContext(db, tenantId, "hipaa", block);
    const { run } = await seedRun(db, { tenantContextTag: "hipaa" });

    await injectTenantContext(db as any, run.id, tenantId);

    const updated = await db.select().from(runs).where(eq(runs.id, run.id)).limit(1);
    const ctx = updated[0].verifiedContext as Record<string, unknown>;
    expect(ctx.description).toBe("a pipeline that processes documents");
  });

  it("returns the stored version string on successful injection", async () => {
    const tenantId = uuidv7();
    const block = makeContextBlock();
    const storedVersion = await registerTenantContext(db, tenantId, "hipaa", block);
    const { run } = await seedRun(db, { tenantContextTag: "hipaa" });

    const version = await injectTenantContext(db as any, run.id, tenantId);

    expect(version).toBe(storedVersion);
  });

  it("returns null and leaves verifiedContext unchanged when no block is registered for the tag", async () => {
    const { run } = await seedRun(db, { tenantContextTag: "hipaa" });

    const version = await injectTenantContext(db as any, run.id, uuidv7());

    expect(version).toBeNull();
    const updated = await db.select().from(runs).where(eq(runs.id, run.id)).limit(1);
    const ctx = updated[0].verifiedContext as Record<string, unknown>;
    expect(ctx.tenantContext).toBeUndefined();
  });

  it("returns null when the run has no tenantContextTag", async () => {
    const tenantId = uuidv7();
    const block = makeContextBlock();
    await registerTenantContext(db, tenantId, "hipaa", block);
    const { run } = await seedRun(db); // no tenantContextTag

    const version = await injectTenantContext(db as any, run.id, tenantId);

    expect(version).toBeNull();
  });

  it("returns null when tenantId is not provided", async () => {
    const { run } = await seedRun(db, { tenantContextTag: "hipaa" });

    const version = await injectTenantContext(db as any, run.id, undefined);

    expect(version).toBeNull();
  });

  it("prohibited tools from tenant context are present in injected block", async () => {
    const tenantId = uuidv7();
    const block = makeContextBlock({
      prohibitedToolsOrPatterns: ["openai-api", "anthropic-api"],
      scopeOfApplicability: "data handling components only",
    });
    await registerTenantContext(db, tenantId, "gov-platform", block);
    const { run } = await seedRun(db, { tenantContextTag: "gov-platform" });

    await injectTenantContext(db as any, run.id, tenantId);

    const updated = await db.select().from(runs).where(eq(runs.id, run.id)).limit(1);
    const ctx = updated[0].verifiedContext as Record<string, unknown>;
    const injected = ctx.tenantContext as TenantContextBlock;
    expect(injected.prohibitedToolsOrPatterns).toContain("openai-api");
    expect(injected.prohibitedToolsOrPatterns).toContain("anthropic-api");
    expect(injected.scopeOfApplicability).toBe("data handling components only");
  });

  it("version string follows YYYY-MM-DD-{hash8} format", () => {
    const block = makeContextBlock();
    const version = computeTenantContextVersion(block);
    expect(version).toMatch(/^\d{4}-\d{2}-\d{2}-[a-f0-9]{8}$/);
  });

  it("version changes when block content changes", () => {
    const v1 = computeTenantContextVersion(makeContextBlock());
    const v2 = computeTenantContextVersion(makeContextBlock({
      requiredRegulatoryControls: ["GDPR"],
    }));
    expect(v1).not.toBe(v2);
  });
});
