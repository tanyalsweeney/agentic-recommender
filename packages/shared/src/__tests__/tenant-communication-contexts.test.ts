import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { tenants, tenantCommunicationContexts } from "../db/schema.js";

describe("tenant_communication_contexts schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdTenantIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdTenantIds.length = 0;
  });

  afterEach(async () => {
    if (createdTenantIds.length) {
      await db.delete(tenantCommunicationContexts).where(inArray(tenantCommunicationContexts.tenantId, createdTenantIds));
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  async function makeTenant(): Promise<string> {
    const id = uuidv7();
    await db.insert(tenants).values({ id, name: `t-${id}`, slug: `t-${id}`, plan: "standard" });
    createdTenantIds.push(id);
    return id;
  }

  it("insert + select round-trips with default status 'draft'", async () => {
    const tid = await makeTenant();
    const [row] = await db.insert(tenantCommunicationContexts).values({
      tenantId: tid,
      name: "exec-summary-banking",
      promptFragment: "Audience: regulated banking executives. Tone: cautious.",
      version: "2026-05-07-deadbeef",
    }).returning();

    expect(row!.name).toBe("exec-summary-banking");
    expect(row!.promptFragment).toContain("regulated banking executives");
    expect(row!.version).toBe("2026-05-07-deadbeef");
    expect(row!.status).toBe("draft");
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.updatedAt).toBeInstanceOf(Date);
  });

  it("supports both 'draft' and 'published' status values", async () => {
    const tid = await makeTenant();
    for (const status of ["draft", "published"]) {
      const [row] = await db.insert(tenantCommunicationContexts).values({
        tenantId: tid,
        name: `ctx-${status}-${uuidv7()}`,
        promptFragment: "x",
        version: "v",
        status,
      }).returning();
      expect(row!.status).toBe(status);
    }
  });

  it("multiple versions with the same name coexist (no unique constraint on name)", async () => {
    const tid = await makeTenant();
    const sharedName = "exec-summary-default";
    await db.insert(tenantCommunicationContexts).values({
      tenantId: tid, name: sharedName, promptFragment: "v1", version: "2026-05-01-aaaaaaaa",
    });
    await db.insert(tenantCommunicationContexts).values({
      tenantId: tid, name: sharedName, promptFragment: "v2", version: "2026-05-07-bbbbbbbb",
    });

    const rows = await db.select().from(tenantCommunicationContexts).where(eq(tenantCommunicationContexts.tenantId, tid));
    expect(rows.length).toBe(2);
  });

  it("tenant_id FK rejects orphan inserts", async () => {
    await expect(
      db.insert(tenantCommunicationContexts).values({
        tenantId: uuidv7(),
        name: "orphan",
        promptFragment: "x",
        version: "v",
      })
    ).rejects.toThrow();
  });

  it("contexts are scoped to their tenant", async () => {
    const tidA = await makeTenant();
    const tidB = await makeTenant();
    await db.insert(tenantCommunicationContexts).values({
      tenantId: tidA, name: "a-only", promptFragment: "x", version: "v",
    });
    const bRows = await db.select().from(tenantCommunicationContexts).where(eq(tenantCommunicationContexts.tenantId, tidB));
    expect(bRows).toHaveLength(0);
  });
});
