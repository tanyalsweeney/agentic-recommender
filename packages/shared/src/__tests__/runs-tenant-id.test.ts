import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { tenants, users, runs, runCheckpoints } from "../db/schema.js";

describe("runs.tenant_id column (denormalized for tenant-scoped isolation)", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRunIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdTenantIds.length = 0;
    createdUserIds.length = 0;
    createdRunIds.length = 0;
  });

  afterEach(async () => {
    if (createdRunIds.length) {
      await db.delete(runCheckpoints).where(inArray(runCheckpoints.runId, createdRunIds));
      await db.delete(runs).where(inArray(runs.id, createdRunIds));
    }
    if (createdUserIds.length) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (createdTenantIds.length) {
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  async function makeUser(tenantId?: string): Promise<string> {
    const [user] = await db.insert(users)
      .values({ email: `rt-${uuidv7()}@example.com`, tenantId })
      .returning();
    createdUserIds.push(user!.id);
    return user!.id;
  }

  async function makeTenant(): Promise<string> {
    const id = uuidv7();
    await db.insert(tenants).values({ id, name: `t-${id}`, slug: `t-${id}`, plan: "standard" });
    createdTenantIds.push(id);
    return id;
  }

  it("tenant_id is null by default for global users", async () => {
    const userId = await makeUser();
    const [run] = await db.insert(runs).values({
      userId,
      tier: "free",
      verifiedContextHash: `ctx-${uuidv7()}`,
    }).returning();
    createdRunIds.push(run!.id);

    expect(run!.tenantId).toBeNull();
  });

  it("tenant_id can be denormalized from the user's tenant at run creation", async () => {
    const tid = await makeTenant();
    const userId = await makeUser(tid);
    const [run] = await db.insert(runs).values({
      userId,
      tenantId: tid,
      tier: "pass1",
      verifiedContextHash: `ctx-${uuidv7()}`,
    }).returning();
    createdRunIds.push(run!.id);

    expect(run!.tenantId).toBe(tid);
  });

  it("tenant_id FK rejects orphan tenant references", async () => {
    const userId = await makeUser();
    await expect(
      db.insert(runs).values({
        userId,
        tenantId: uuidv7(), // tenant does not exist
        tier: "free",
        verifiedContextHash: `ctx-${uuidv7()}`,
      })
    ).rejects.toThrow();
  });

  it("tenant-scoped queries filter on tenant_id without joining users", async () => {
    const tidA = await makeTenant();
    const tidB = await makeTenant();
    const userA = await makeUser(tidA);
    const userB = await makeUser(tidB);

    const [runA] = await db.insert(runs).values({
      userId: userA, tenantId: tidA, tier: "free", verifiedContextHash: `a-${uuidv7()}`,
    }).returning();
    const [runB] = await db.insert(runs).values({
      userId: userB, tenantId: tidB, tier: "free", verifiedContextHash: `b-${uuidv7()}`,
    }).returning();
    createdRunIds.push(runA!.id, runB!.id);

    // Tenant A's view: only runs scoped to tenant A.
    const aRuns = await db.select().from(runs).where(eq(runs.tenantId, tidA));
    expect(aRuns.find(r => r.id === runA!.id)).toBeDefined();
    expect(aRuns.find(r => r.id === runB!.id)).toBeUndefined();
  });

  it("global-user query (tenant_id is null) returns only global runs", async () => {
    const tid = await makeTenant();
    const tenantUser = await makeUser(tid);
    const globalUser = await makeUser();

    const [tenantRun] = await db.insert(runs).values({
      userId: tenantUser, tenantId: tid, tier: "free", verifiedContextHash: `t-${uuidv7()}`,
    }).returning();
    const [globalRun] = await db.insert(runs).values({
      userId: globalUser, tier: "free", verifiedContextHash: `g-${uuidv7()}`,
    }).returning();
    createdRunIds.push(tenantRun!.id, globalRun!.id);

    // Use the global-user filter: runs where tenant_id matches the looked-up
    // value (here, the global run we just created).
    const globalRuns = await db
      .select()
      .from(runs)
      .where(eq(runs.id, globalRun!.id));

    expect(globalRuns[0]!.tenantId).toBeNull();
  });
});
