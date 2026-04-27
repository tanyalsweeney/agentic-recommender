import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "./test-db.js";
import { config } from "../db/schema.js";
import { getConfig } from "../db/config-resolution.js";
import { eq, and } from "drizzle-orm";

describe("config resolution", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    // clean slate between tests
    await db.delete(config);
  });

  it("returns global default when no tenant override exists", async () => {
    await db.insert(config).values({ key: "skeptic_cycle_cap", value: "4", owner: "global" });

    const result = await getConfig(db, "skeptic_cycle_cap");
    expect(result).toBe("4");
  });

  it("returns tenant override when it exists", async () => {
    await db.insert(config).values([
      { key: "skeptic_cycle_cap", value: "4", owner: "global" },
      { key: "skeptic_cycle_cap", value: "2", owner: "tenant_abc" },
    ]);

    const result = await getConfig(db, "skeptic_cycle_cap", "tenant_abc");
    expect(result).toBe("2");
  });

  it("falls back to global when tenant has no override for that key", async () => {
    await db.insert(config).values([
      { key: "skeptic_cycle_cap", value: "4", owner: "global" },
      { key: "gatekeeper_cycle_cap", value: "1", owner: "tenant_abc" },
    ]);

    const result = await getConfig(db, "skeptic_cycle_cap", "tenant_abc");
    expect(result).toBe("4");
  });

  it("returns null when key does not exist", async () => {
    const result = await getConfig(db, "nonexistent_key");
    expect(result).toBeNull();
  });
});
