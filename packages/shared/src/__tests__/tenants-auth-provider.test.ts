import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { tenants } from "../db/schema.js";

describe("tenants.auth_provider column", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdTenantIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdTenantIds.length = 0;
  });

  afterEach(async () => {
    if (createdTenantIds.length) {
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  it("defaults to 'clerk' when not specified", async () => {
    const id = uuidv7();
    const [row] = await db.insert(tenants).values({
      id, name: `t-${id}`, slug: `t-${id}`,
    }).returning();
    createdTenantIds.push(row!.id);

    expect(row!.authProvider).toBe("clerk");
  });

  it("accepts 'workos' for enterprise tenants", async () => {
    const id = uuidv7();
    const [row] = await db.insert(tenants).values({
      id, name: `t-${id}`, slug: `t-${id}`, authProvider: "workos",
    }).returning();
    createdTenantIds.push(row!.id);

    expect(row!.authProvider).toBe("workos");
  });

  it("auth_provider can be updated after tenant creation (provider migration)", async () => {
    const id = uuidv7();
    await db.insert(tenants).values({
      id, name: `t-${id}`, slug: `t-${id}`,
    });
    createdTenantIds.push(id);

    await db.update(tenants).set({ authProvider: "workos" }).where(eq(tenants.id, id));
    const [row] = await db.select().from(tenants).where(eq(tenants.id, id));
    expect(row!.authProvider).toBe("workos");
  });
});
