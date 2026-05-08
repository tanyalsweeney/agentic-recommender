import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { tenants } from "../db/schema.js";

describe("tenants.auth_provider and tenants.auth_provider_org_id columns", () => {
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

  it("auth_provider_org_id is null until provider-side organization is created", async () => {
    const id = uuidv7();
    const [row] = await db.insert(tenants).values({
      id, name: `t-${id}`, slug: `t-${id}`,
    }).returning();
    createdTenantIds.push(row!.id);

    expect(row!.authProviderOrgId).toBeNull();
  });

  it("auth_provider_org_id stores Clerk org_xxx and WorkOS org_xxx identifiers", async () => {
    const clerkOrgId = `org_clerk_${uuidv7()}`;
    const workosOrgId = `org_01H${uuidv7()}`;

    const clerkTenantId = uuidv7();
    const workosTenantId = uuidv7();
    const [clerk] = await db.insert(tenants).values({
      id: clerkTenantId, name: `t-${clerkTenantId}`, slug: `t-${clerkTenantId}`,
      authProvider: "clerk", authProviderOrgId: clerkOrgId,
    }).returning();
    const [workos] = await db.insert(tenants).values({
      id: workosTenantId, name: `t-${workosTenantId}`, slug: `t-${workosTenantId}`,
      authProvider: "workos", authProviderOrgId: workosOrgId,
    }).returning();
    createdTenantIds.push(clerk!.id, workos!.id);

    expect(clerk!.authProviderOrgId).toBe(clerkOrgId);
    expect(workos!.authProviderOrgId).toBe(workosOrgId);
  });

  it("auth_provider_org_id can be updated when provider-side org is created later", async () => {
    const id = uuidv7();
    await db.insert(tenants).values({
      id, name: `t-${id}`, slug: `t-${id}`,
    });
    createdTenantIds.push(id);

    const orgId = `org_filled_${uuidv7()}`;
    await db.update(tenants).set({ authProviderOrgId: orgId }).where(eq(tenants.id, id));
    const [row] = await db.select().from(tenants).where(eq(tenants.id, id));
    expect(row!.authProviderOrgId).toBe(orgId);
  });

  it("composite unique on (auth_provider, auth_provider_org_id) rejects duplicates", async () => {
    const sharedOrgId = `org_dup_${uuidv7()}`;
    const idA = uuidv7();
    await db.insert(tenants).values({
      id: idA, name: `t-${idA}`, slug: `t-${idA}`,
      authProvider: "clerk", authProviderOrgId: sharedOrgId,
    });
    createdTenantIds.push(idA);

    await expect(
      db.insert(tenants).values({
        id: uuidv7(), name: "dup", slug: `dup-${uuidv7()}`,
        authProvider: "clerk", authProviderOrgId: sharedOrgId,
      })
    ).rejects.toThrow();
  });

  it("same auth_provider_org_id is allowed across different providers", async () => {
    const sharedRawId = `org_${uuidv7()}`;
    const idA = uuidv7();
    const idB = uuidv7();
    const [clerkTenant] = await db.insert(tenants).values({
      id: idA, name: `t-${idA}`, slug: `t-${idA}`,
      authProvider: "clerk", authProviderOrgId: sharedRawId,
    }).returning();
    const [workosTenant] = await db.insert(tenants).values({
      id: idB, name: `t-${idB}`, slug: `t-${idB}`,
      authProvider: "workos", authProviderOrgId: sharedRawId,
    }).returning();
    createdTenantIds.push(clerkTenant!.id, workosTenant!.id);

    expect(clerkTenant!.authProviderOrgId).toBe(sharedRawId);
    expect(workosTenant!.authProviderOrgId).toBe(sharedRawId);
  });

  it("multiple tenants with NULL auth_provider_org_id do not collide", async () => {
    const idA = uuidv7();
    const idB = uuidv7();
    const [a] = await db.insert(tenants).values({
      id: idA, name: `t-${idA}`, slug: `t-${idA}`, authProvider: "clerk",
    }).returning();
    const [b] = await db.insert(tenants).values({
      id: idB, name: `t-${idB}`, slug: `t-${idB}`, authProvider: "clerk",
    }).returning();
    createdTenantIds.push(a!.id, b!.id);

    expect(a!.authProviderOrgId).toBeNull();
    expect(b!.authProviderOrgId).toBeNull();
  });
});
