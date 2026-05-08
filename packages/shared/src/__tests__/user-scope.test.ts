/**
 * Schema tests for user_secrets and user_api_tokens (Phase 3.5a.1.b).
 * user_api_tokens is schema-only this phase — Phase 4 wires the MCP auth flow.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { users, userSecrets, userApiTokens } from "../db/schema.js";
import { encryptKey } from "../crypto.js";

describe("user_secrets schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdUserIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdUserIds.length = 0;
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(userSecrets).where(inArray(userSecrets.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("insert + select round-trips with default createdAt", async () => {
    const [user] = await db.insert(users)
      .values({ email: `us-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(user!.id);

    const [row] = await db.insert(userSecrets).values({
      userId: user!.id,
      provider: "anthropic",
      encryptedKey: encryptKey("sk-ant-test"),
    }).returning();

    expect(row!.id).toBeTruthy();
    expect(row!.userId).toBe(user!.id);
    expect(row!.provider).toBe("anthropic");
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.rotatedAt).toBeNull();
  });

  it("user_id FK enforces that the user exists", async () => {
    await expect(
      db.insert(userSecrets).values({
        userId: uuidv7(), // user does not exist
        provider: "anthropic",
        encryptedKey: encryptKey("sk-ant-test"),
      })
    ).rejects.toThrow();
  });

  it("user secrets are scoped to their user", async () => {
    const [userA] = await db.insert(users)
      .values({ email: `usa-${uuidv7()}@example.com` })
      .returning();
    const [userB] = await db.insert(users)
      .values({ email: `usb-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(userA!.id, userB!.id);

    await db.insert(userSecrets).values({
      userId: userA!.id,
      provider: "anthropic",
      encryptedKey: encryptKey("user-a-key"),
    });

    const bSecrets = await db
      .select()
      .from(userSecrets)
      .where(eq(userSecrets.userId, userB!.id));

    expect(bSecrets).toHaveLength(0);
  });
});

describe("user_api_tokens schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdUserIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdUserIds.length = 0;
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(userApiTokens).where(inArray(userApiTokens.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  });

  it("insert + select round-trips with defaults and nullable fields", async () => {
    const [user] = await db.insert(users)
      .values({ email: `at-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(user!.id);

    const [row] = await db.insert(userApiTokens).values({
      userId: user!.id,
      tokenHash: `hash-${uuidv7()}`,
      name: "my-laptop",
    }).returning();

    expect(row!.id).toBeTruthy();
    expect(row!.userId).toBe(user!.id);
    expect(row!.name).toBe("my-laptop");
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.lastUsedAt).toBeNull();
    expect(row!.revokedAt).toBeNull();
  });

  it("token_hash unique constraint rejects duplicate hashes", async () => {
    const [user] = await db.insert(users)
      .values({ email: `at-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(user!.id);

    const sharedHash = `hash-${uuidv7()}`;
    await db.insert(userApiTokens).values({
      userId: user!.id,
      tokenHash: sharedHash,
      name: "first",
    });

    await expect(
      db.insert(userApiTokens).values({
        userId: user!.id,
        tokenHash: sharedHash,
        name: "second-with-same-hash",
      })
    ).rejects.toThrow();
  });

  it("user_id FK enforces that the user exists", async () => {
    await expect(
      db.insert(userApiTokens).values({
        userId: uuidv7(), // user does not exist
        tokenHash: `hash-${uuidv7()}`,
        name: "orphan",
      })
    ).rejects.toThrow();
  });
});
