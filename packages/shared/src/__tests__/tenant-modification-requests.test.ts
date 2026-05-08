import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { tenants, tenantModificationRequests } from "../db/schema.js";

describe("tenant_modification_requests schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdTenantIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdTenantIds.length = 0;
  });

  afterEach(async () => {
    if (createdTenantIds.length) {
      await db.delete(tenantModificationRequests).where(inArray(tenantModificationRequests.tenantId, createdTenantIds));
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  async function makeTenant(): Promise<string> {
    const id = uuidv7();
    await db.insert(tenants).values({ id, name: `t-${id}`, slug: `t-${id}`, plan: "standard" });
    createdTenantIds.push(id);
    return id;
  }

  it("insert + select round-trips with default status 'submitted' and timestamps", async () => {
    const tid = await makeTenant();
    const [row] = await db.insert(tenantModificationRequests).values({
      tenantId: tid,
      requestType: "config_change",
      intentDescription: "Increase concurrency cap to 20",
    }).returning();

    expect(row!.tenantId).toBe(tid);
    expect(row!.requestType).toBe("config_change");
    expect(row!.status).toBe("submitted");
    expect(row!.quotedAmount).toBeNull();
    expect(row!.adminNotes).toBeNull();
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.updatedAt).toBeInstanceOf(Date);
  });

  it("accepts status flow transitions through every documented state", async () => {
    const tid = await makeTenant();
    const states = ["submitted", "quoted", "approved", "in_progress", "deployed", "declined"];
    for (const status of states) {
      const [row] = await db.insert(tenantModificationRequests).values({
        tenantId: tid,
        requestType: "config_change",
        intentDescription: `state ${status}`,
        status,
      }).returning();
      expect(row!.status).toBe(status);
    }
  });

  it("quoted_amount accepts free-form text (e.g. '$5,000', '5000 USD', 'TBD')", async () => {
    const tid = await makeTenant();
    const samples = ["$5,000", "5000 USD", "TBD", "0"];
    for (const amount of samples) {
      const [row] = await db.insert(tenantModificationRequests).values({
        tenantId: tid,
        requestType: "config_change",
        intentDescription: "x",
        quotedAmount: amount,
      }).returning();
      expect(row!.quotedAmount).toBe(amount);
    }
  });

  it("tenant_id FK rejects orphan inserts", async () => {
    await expect(
      db.insert(tenantModificationRequests).values({
        tenantId: uuidv7(), // tenant does not exist
        requestType: "config_change",
        intentDescription: "orphan",
      })
    ).rejects.toThrow();
  });

  it("requests are scoped to their tenant", async () => {
    const tidA = await makeTenant();
    const tidB = await makeTenant();
    await db.insert(tenantModificationRequests).values({
      tenantId: tidA,
      requestType: "config_change",
      intentDescription: "a",
    });
    const bRequests = await db.select().from(tenantModificationRequests).where(eq(tenantModificationRequests.tenantId, tidB));
    expect(bRequests).toHaveLength(0);
  });
});
