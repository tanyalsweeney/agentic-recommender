import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { tenants, users, codebaseDigestDrafts } from "../db/schema.js";

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

describe("codebase_digest_drafts schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdUserIds.length = 0;
    createdTenantIds.length = 0;
  });

  afterEach(async () => {
    if (createdUserIds.length) {
      await db.delete(codebaseDigestDrafts).where(inArray(codebaseDigestDrafts.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (createdTenantIds.length) {
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  it("insert + select round-trips with default createdAt and null submittedAt", async () => {
    const [user] = await db.insert(users)
      .values({ email: `digest-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(user!.id);

    // Round-trip placeholder values — this test asserts the jsonb columns accept
    // and return arbitrary input. Application-level shape validation for the
    // digest and qualitySummary payloads lives in the agent packages that own
    // those schemas (Quality Evaluator and MCP tool I/O), not here.
    const digestPayload = { roundTripCheck: "arbitrary-jsonb-value" };
    const qualitySummaryPayload = { roundTripCheck: 42 };

    const [row] = await db.insert(codebaseDigestDrafts).values({
      userId: user!.id,
      digest: digestPayload,
      qualitySummary: qualitySummaryPayload,
      expiresAt: futureDate(7),
    }).returning();

    expect(row!.id).toBeTruthy();
    expect(row!.userId).toBe(user!.id);
    expect(row!.tenantId).toBeNull();
    expect(row!.digest).toEqual(digestPayload);
    expect(row!.qualitySummary).toEqual(qualitySummaryPayload);
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.expiresAt).toBeInstanceOf(Date);
    expect(row!.submittedAt).toBeNull();
  });

  it("supports tenantId when the user belongs to a tenant", async () => {
    const tid = uuidv7();
    await db.insert(tenants).values({
      id: tid, name: `t-${tid}`, slug: `t-${tid}`, plan: "standard",
    });
    createdTenantIds.push(tid);

    const [user] = await db.insert(users)
      .values({ email: `dt-${uuidv7()}@example.com`, tenantId: tid })
      .returning();
    createdUserIds.push(user!.id);

    const [row] = await db.insert(codebaseDigestDrafts).values({
      userId: user!.id,
      tenantId: tid,
      digest: {},
      qualitySummary: {},
      expiresAt: futureDate(1),
    }).returning();

    expect(row!.tenantId).toBe(tid);
  });

  it("user_id FK rejects orphan inserts", async () => {
    await expect(
      db.insert(codebaseDigestDrafts).values({
        userId: uuidv7(), // user does not exist
        digest: {},
        qualitySummary: {},
        expiresAt: futureDate(1),
      })
    ).rejects.toThrow();
  });

  it("tenant_id FK rejects orphan tenant references", async () => {
    const [user] = await db.insert(users)
      .values({ email: `dt-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(user!.id);

    await expect(
      db.insert(codebaseDigestDrafts).values({
        userId: user!.id,
        tenantId: uuidv7(), // tenant does not exist
        digest: {},
        qualitySummary: {},
        expiresAt: futureDate(1),
      })
    ).rejects.toThrow();
  });

  it("drafts are scoped to their user", async () => {
    const [userA] = await db.insert(users)
      .values({ email: `dta-${uuidv7()}@example.com` })
      .returning();
    const [userB] = await db.insert(users)
      .values({ email: `dtb-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(userA!.id, userB!.id);

    await db.insert(codebaseDigestDrafts).values({
      userId: userA!.id,
      digest: { owner: "A" },
      qualitySummary: {},
      expiresAt: futureDate(1),
    });

    const bDrafts = await db.select().from(codebaseDigestDrafts).where(eq(codebaseDigestDrafts.userId, userB!.id));
    expect(bDrafts).toHaveLength(0);
  });
});
