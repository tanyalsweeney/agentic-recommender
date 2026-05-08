import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { users } from "../db/schema.js";

describe("users.auth_provider and users.auth_provider_user_id columns", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdUserIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdUserIds.length = 0;
  });

  afterEach(async () => {
    if (createdUserIds.length) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("auth_provider defaults to 'clerk' and auth_provider_user_id is null", async () => {
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProvider).toBe("clerk");
    expect(row!.authProviderUserId).toBeNull();
  });

  it("accepts 'workos' for users in workos-routed tenants", async () => {
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
      authProvider: "workos",
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProvider).toBe("workos");
  });

  it("auth_provider_user_id stores provider-side identifiers (Clerk format)", async () => {
    const providerId = "user_2abc123XYZ";
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
      authProviderUserId: providerId,
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProviderUserId).toBe(providerId);
  });

  it("auth_provider_user_id stores provider-side identifiers (WorkOS format)", async () => {
    const providerId = "user_01HABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
      authProvider: "workos",
      authProviderUserId: providerId,
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProviderUserId).toBe(providerId);
  });

  it("auth_provider_user_id can be updated when provider-side signup completes", async () => {
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProviderUserId).toBeNull();

    await db.update(users).set({ authProviderUserId: "user_filled_in" }).where(eq(users.id, row!.id));
    const [updated] = await db.select().from(users).where(eq(users.id, row!.id));
    expect(updated!.authProviderUserId).toBe("user_filled_in");
  });

  it("composite unique on (auth_provider, auth_provider_user_id) rejects duplicates", async () => {
    const sharedProviderId = `user_dup_${uuidv7()}`;
    const [first] = await db.insert(users).values({
      email: `dup1-${uuidv7()}@example.com`,
      authProvider: "clerk",
      authProviderUserId: sharedProviderId,
    }).returning();
    createdUserIds.push(first!.id);

    await expect(
      db.insert(users).values({
        email: `dup2-${uuidv7()}@example.com`,
        authProvider: "clerk",
        authProviderUserId: sharedProviderId,
      })
    ).rejects.toThrow();
  });

  it("same auth_provider_user_id is allowed across different providers", async () => {
    // PostgreSQL collisions are about the (provider, user_id) pair. The same
    // raw string under different providers should not collide because the
    // provider name discriminates.
    const sharedRawId = `user_${uuidv7()}`;
    const [clerkUser] = await db.insert(users).values({
      email: `cross1-${uuidv7()}@example.com`,
      authProvider: "clerk",
      authProviderUserId: sharedRawId,
    }).returning();
    const [workosUser] = await db.insert(users).values({
      email: `cross2-${uuidv7()}@example.com`,
      authProvider: "workos",
      authProviderUserId: sharedRawId,
    }).returning();
    createdUserIds.push(clerkUser!.id, workosUser!.id);

    expect(clerkUser!.authProviderUserId).toBe(sharedRawId);
    expect(workosUser!.authProviderUserId).toBe(sharedRawId);
  });

  it("multiple users with NULL auth_provider_user_id do not collide (PostgreSQL NULL semantics)", async () => {
    const [a] = await db.insert(users).values({
      email: `null1-${uuidv7()}@example.com`,
      authProvider: "clerk",
      // authProviderUserId omitted -> null
    }).returning();
    const [b] = await db.insert(users).values({
      email: `null2-${uuidv7()}@example.com`,
      authProvider: "clerk",
    }).returning();
    createdUserIds.push(a!.id, b!.id);

    expect(a!.authProviderUserId).toBeNull();
    expect(b!.authProviderUserId).toBeNull();
  });
});
