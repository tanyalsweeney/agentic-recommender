import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { users } from "../db/schema.js";

describe("users.auth_provider and users.auth_provider_id columns", () => {
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

  it("auth_provider defaults to 'clerk' and auth_provider_id is null", async () => {
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProvider).toBe("clerk");
    expect(row!.authProviderId).toBeNull();
  });

  it("accepts 'workos' for users in workos-routed tenants", async () => {
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
      authProvider: "workos",
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProvider).toBe("workos");
  });

  it("auth_provider_id stores provider-side identifiers (Clerk format)", async () => {
    const providerId = "user_2abc123XYZ";
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
      authProviderId: providerId,
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProviderId).toBe(providerId);
  });

  it("auth_provider_id stores provider-side identifiers (WorkOS format)", async () => {
    const providerId = "user_01HABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
      authProvider: "workos",
      authProviderId: providerId,
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProviderId).toBe(providerId);
  });

  it("auth_provider_id can be updated when provider-side signup completes", async () => {
    const [row] = await db.insert(users).values({
      email: `up-${uuidv7()}@example.com`,
    }).returning();
    createdUserIds.push(row!.id);

    expect(row!.authProviderId).toBeNull();

    await db.update(users).set({ authProviderId: "user_filled_in" }).where(eq(users.id, row!.id));
    const [updated] = await db.select().from(users).where(eq(users.id, row!.id));
    expect(updated!.authProviderId).toBe("user_filled_in");
  });
});
