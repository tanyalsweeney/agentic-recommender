import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { tenants, tenantSecrets, encryptKey } from "@agent12/shared";
import { getApiKey } from "../key-resolution.js";

describe("getApiKey", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdTenantIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdTenantIds.length = 0;
  });

  afterEach(async () => {
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

  it("returns the decrypted tenant_secrets value when tenant has a key for the provider", async () => {
    const tenantId = await makeTenant();
    const plaintextKey = `tenant-key-${uuidv7()}`;
    await db.insert(tenantSecrets).values({
      tenantId,
      provider: "anthropic",
      encryptedKey: encryptKey(plaintextKey),
    });

    const resolved = await getApiKey(db, "anthropic", tenantId);
    expect(resolved).toBe(plaintextKey);
  });

  it("falls through to system env when tenant has no secret for the provider", async () => {
    const tenantId = await makeTenant();
    // Tenant exists but no tenant_secrets row.
    const resolved = await getApiKey(db, "anthropic", tenantId);
    // ANTHROPIC_API_KEY is set in test env (.env.local).
    expect(typeof resolved).toBe("string");
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved).not.toBe("");
  });

  it("falls through to system env when tenant has a secret for a different provider", async () => {
    const tenantId = await makeTenant();
    await db.insert(tenantSecrets).values({
      tenantId,
      provider: "kimi",
      encryptedKey: encryptKey("kimi-only-key"),
    });

    process.env.KIMI_API_KEY = "kimi-only-key";
    try {
      const resolved = await getApiKey(db, "anthropic", tenantId);
      // Should NOT pick up the kimi secret; should fall through to system env.
      expect(resolved).not.toBe("kimi-only-key");
      expect(typeof resolved).toBe("string");
      expect(resolved.length).toBeGreaterThan(0);
    } finally {
      delete process.env.KIMI_API_KEY;
    }
  });

  it("returns system env when tenantId is undefined", async () => {
    const resolved = await getApiKey(db, "anthropic", undefined);
    expect(typeof resolved).toBe("string");
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("throws when provider is not in registry", async () => {
    await expect(getApiKey(db, "unknown_provider", undefined)).rejects.toThrow("Unknown provider");
  });

  it("throws when neither tenant secret nor system env is available", async () => {
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(getApiKey(db, "anthropic", undefined)).rejects.toThrow("ANTHROPIC_API_KEY is not set");
    } finally {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  });
});
