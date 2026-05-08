import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import {
  tenants,
  tenantSecrets,
  users,
  userSecrets,
  encryptKey,
} from "@agent12/shared";
import { getApiKey } from "../key-resolution.js";

describe("getApiKey", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdTenantIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdTenantIds.length = 0;
    createdUserIds.length = 0;
  });

  afterEach(async () => {
    if (createdUserIds.length > 0) {
      await db.delete(userSecrets).where(inArray(userSecrets.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (createdTenantIds.length > 0) {
      await db.delete(tenantSecrets).where(inArray(tenantSecrets.tenantId, createdTenantIds));
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  async function makeTenant(): Promise<string> {
    const id = uuidv7();
    await db.insert(tenants).values({ id, name: `tenant-${id}`, slug: `t-${id}`, plan: "standard" });
    createdTenantIds.push(id);
    return id;
  }

  async function makeUser(tenantId?: string): Promise<string> {
    const id = uuidv7();
    await db.insert(users).values({ id, email: `byok-${id}@example.com`, tenantId });
    createdUserIds.push(id);
    return id;
  }

  // ── tenant scope (existing behavior) ────────────────────────────────────────

  it("returns the decrypted tenant_secrets value when only tenant has a key", async () => {
    const tenantId = await makeTenant();
    const plaintextKey = `tenant-key-${uuidv7()}`;
    await db.insert(tenantSecrets).values({
      tenantId,
      provider: "anthropic",
      encryptedKey: encryptKey(plaintextKey),
    });

    const resolved = await getApiKey(db, "anthropic", undefined, tenantId);
    expect(resolved).toBe(plaintextKey);
  });

  it("falls through to system env when tenant has no secret for the provider", async () => {
    const tenantId = await makeTenant();
    const resolved = await getApiKey(db, "anthropic", undefined, tenantId);
    // ANTHROPIC_API_KEY is set in test env (.env.local).
    expect(typeof resolved).toBe("string");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("falls through to system env when tenant has a secret for a different provider", async () => {
    const tenantId = await makeTenant();
    await db.insert(tenantSecrets).values({
      tenantId,
      provider: "kimi",
      encryptedKey: encryptKey("kimi-only-key"),
    });

    const resolved = await getApiKey(db, "anthropic", undefined, tenantId);
    expect(resolved).not.toBe("kimi-only-key");
    expect(typeof resolved).toBe("string");
    expect(resolved.length).toBeGreaterThan(0);
  });

  // ── user scope (new in 3.5a.1.b) ────────────────────────────────────────────

  it("returns the decrypted user_secrets value when only user has a key", async () => {
    const userId = await makeUser();
    const plaintextKey = `user-key-${uuidv7()}`;
    await db.insert(userSecrets).values({
      userId,
      provider: "anthropic",
      encryptedKey: encryptKey(plaintextKey),
    });

    const resolved = await getApiKey(db, "anthropic", userId, undefined);
    expect(resolved).toBe(plaintextKey);
  });

  it("user_secrets wins over tenant_secrets when both exist for the provider", async () => {
    const tenantId = await makeTenant();
    const userId = await makeUser(tenantId);
    const userKey = `user-key-${uuidv7()}`;
    const tenantKey = `tenant-key-${uuidv7()}`;
    await db.insert(userSecrets).values({
      userId,
      provider: "anthropic",
      encryptedKey: encryptKey(userKey),
    });
    await db.insert(tenantSecrets).values({
      tenantId,
      provider: "anthropic",
      encryptedKey: encryptKey(tenantKey),
    });

    const resolved = await getApiKey(db, "anthropic", userId, tenantId);
    expect(resolved).toBe(userKey);
    expect(resolved).not.toBe(tenantKey);
  });

  it("falls back to tenant_secrets when user has no secret for the provider", async () => {
    const tenantId = await makeTenant();
    const userId = await makeUser(tenantId);
    const tenantKey = `tenant-key-${uuidv7()}`;
    // User has a key for kimi only; tenant has anthropic.
    await db.insert(userSecrets).values({
      userId,
      provider: "kimi",
      encryptedKey: encryptKey("user-kimi-key"),
    });
    await db.insert(tenantSecrets).values({
      tenantId,
      provider: "anthropic",
      encryptedKey: encryptKey(tenantKey),
    });

    const resolved = await getApiKey(db, "anthropic", userId, tenantId);
    expect(resolved).toBe(tenantKey);
  });

  it("falls back to system env when neither user nor tenant has a key", async () => {
    const tenantId = await makeTenant();
    const userId = await makeUser(tenantId);
    const resolved = await getApiKey(db, "anthropic", userId, tenantId);
    expect(typeof resolved).toBe("string");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("user_secrets for a different provider does not satisfy the lookup", async () => {
    const userId = await makeUser();
    await db.insert(userSecrets).values({
      userId,
      provider: "kimi",
      encryptedKey: encryptKey("user-kimi-key"),
    });

    const resolved = await getApiKey(db, "anthropic", userId, undefined);
    expect(resolved).not.toBe("user-kimi-key");
    expect(typeof resolved).toBe("string");
    expect(resolved.length).toBeGreaterThan(0);
  });

  // ── undefined IDs ───────────────────────────────────────────────────────────

  it("returns system env when both userId and tenantId are undefined", async () => {
    const resolved = await getApiKey(db, "anthropic", undefined, undefined);
    expect(typeof resolved).toBe("string");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("throws when provider is not in registry", async () => {
    await expect(getApiKey(db, "unknown_provider", undefined, undefined)).rejects.toThrow("Unknown provider");
  });

  it("throws when no key is available anywhere", async () => {
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(getApiKey(db, "anthropic", undefined, undefined)).rejects.toThrow("ANTHROPIC_API_KEY is not set");
    } finally {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  });
});
