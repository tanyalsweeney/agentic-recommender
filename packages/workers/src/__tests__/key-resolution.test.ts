import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getTestDb } from "./test-db.js";
import { config } from "@agent12/shared";
import { getApiKey } from "../key-resolution.js";

describe("getApiKey", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(config);
    // Ensure ANTHROPIC_API_KEY is available in test env
    process.env.TEST_PROVIDER_KEY = "test-key-abc123";
  });

  afterEach(async () => {
    delete process.env.TEST_PROVIDER_KEY;
  });

  it("returns key from env var when provider is in registry", async () => {
    const key = await getApiKey(db, "anthropic", undefined);
    // ANTHROPIC_API_KEY is set in .env.local for tests
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("throws when provider is not in registry", async () => {
    await expect(getApiKey(db, "unknown_provider", undefined))
      .rejects.toThrow("Unknown provider");
  });

  it("throws when system env var is not set", async () => {
    const savedKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await expect(getApiKey(db, "anthropic", undefined))
        .rejects.toThrow("ANTHROPIC_API_KEY is not set");
    } finally {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  });

  it("falls through to system key when tenant has no key configured", async () => {
    // Insert a config entry for a different key — not a provider key
    await db.insert(config).values({
      key: "some.other.config",
      value: "other_value",
      owner: "tenant_abc",
    });

    const key = await getApiKey(db, "anthropic", "tenant_abc");
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });
});
