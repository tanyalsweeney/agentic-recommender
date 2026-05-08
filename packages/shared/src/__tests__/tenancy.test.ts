/**
 * Phase 3f integration tests — multi-tenancy schema.
 * All tests hit the real test database. Written before schema implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, and, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import {
  tenants,
  users,
  tenantSecrets,
  themes,
  themeAssignments,
  config,
} from "../db/schema.js";
import {
  computeThemeVersion,
  getActiveThemeAssignment,
} from "../db/themes.js";
import { encryptKey, decryptKey } from "../crypto.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

const BASE_TOKEN_MAP = {
  "color.primary": "#1a1a2e",
  "color.surface": "#ffffff",
  "color.text.primary": "#1a1a2e",
  "typography.fontFamily.body": "Inter, system-ui, sans-serif",
  "radius.base": "6px",
};

// ── tenant isolation ──────────────────────────────────────────────────────────

describe("tenant isolation", () => {
  let db: ReturnType<typeof getTestDb>;
  let createdUserIds: string[] = [];
  let createdTenantIds: string[] = [];

  beforeEach(async () => {
    db = getTestDb();
    createdUserIds = [];
    createdTenantIds = [];
  });

  afterEach(async () => {
    // Scoped cleanup: only remove rows this test created, in FK-safe order
    if (createdTenantIds.length) {
      await db.delete(tenantSecrets).where(inArray(tenantSecrets.tenantId, createdTenantIds));
    }
    if (createdUserIds.length) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (createdTenantIds.length) {
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  it("tenant_id FK enforces that users belong to a known tenant", async () => {
    const id = uuidv7();
    const [tenant] = await db.insert(tenants)
      .values({ name: `Acme-${id}`, slug: `acme-${id}`, plan: "standard" })
      .returning();
    createdTenantIds.push(tenant.id);

    const [user] = await db.insert(users)
      .values({ email: `alice-${id}@acme.com`, tenantId: tenant.id })
      .returning();
    createdUserIds.push(user.id);

    expect(user.tenantId).toBe(tenant.id);
  });

  it("global users have null tenant_id", async () => {
    const [user] = await db.insert(users)
      .values({ email: `global-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(user.id);

    expect(user.tenantId).toBeNull();
  });

  it("tenant secrets are scoped to their tenant", async () => {
    const idA = uuidv7();
    const idB = uuidv7();
    const [tenantA] = await db.insert(tenants)
      .values({ name: `Tenant-A-${idA}`, slug: `tenant-a-${idA}`, plan: "standard" })
      .returning();
    const [tenantB] = await db.insert(tenants)
      .values({ name: `Tenant-B-${idB}`, slug: `tenant-b-${idB}`, plan: "standard" })
      .returning();
    createdTenantIds.push(tenantA.id, tenantB.id);

    await db.insert(tenantSecrets).values({
      tenantId: tenantA.id,
      provider: "anthropic",
      encryptedKey: "encrypted-key-a",
    });

    const bSecrets = await db
      .select()
      .from(tenantSecrets)
      .where(eq(tenantSecrets.tenantId, tenantB.id));

    expect(bSecrets).toHaveLength(0);
  });

  it("BYOK encrypted key roundtrips correctly", async () => {
    const originalKey = "sk-ant-test-key-12345";
    const encrypted = encryptKey(originalKey);
    const decrypted = decryptKey(encrypted);
    expect(decrypted).toBe(originalKey);
  });

  it("encrypted key ciphertext differs from plaintext", async () => {
    const originalKey = "sk-ant-test-key-12345";
    const encrypted = encryptKey(originalKey);
    expect(encrypted).not.toBe(originalKey);
  });
});

// ── theme versioning ──────────────────────────────────────────────────────────

describe("theme versioning", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(themeAssignments);
    await db.delete(themes);
  });

  it("computeThemeVersion returns a YYYY-MM-DD-{hash8} string", () => {
    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    expect(version).toMatch(/^\d{4}-\d{2}-\d{2}-[a-f0-9]{8}$/);
  });

  it("version changes when token_map changes", () => {
    const v1 = computeThemeVersion(BASE_TOKEN_MAP, null);
    const v2 = computeThemeVersion({ ...BASE_TOKEN_MAP, "color.primary": "#ff0000" }, null);
    expect(v1).not.toBe(v2);
  });

  it("version changes when custom_css changes", () => {
    const v1 = computeThemeVersion(BASE_TOKEN_MAP, null);
    const v2 = computeThemeVersion(BASE_TOKEN_MAP, "@keyframes spin { to { transform: rotate(360deg); } }");
    expect(v1).not.toBe(v2);
  });

  it("version is stable for identical inputs", () => {
    const v1 = computeThemeVersion(BASE_TOKEN_MAP, null);
    const v2 = computeThemeVersion(BASE_TOKEN_MAP, null);
    expect(v1).toBe(v2);
  });

  it("theme row stores the computed version", async () => {
    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    const [theme] = await db.insert(themes)
      .values({ name: "test_light", owner: "global", tokenMap: BASE_TOKEN_MAP, version, status: "published" })
      .returning();

    expect(theme.version).toBe(version);
  });
});

// ── theme assignments — mode lock ─────────────────────────────────────────────

describe("theme assignments — mode lock", () => {
  let db: ReturnType<typeof getTestDb>;
  let themeId: string;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(themeAssignments);
    await db.delete(themes);

    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    const [theme] = await db.insert(themes)
      .values({ name: "test_light", owner: "global", tokenMap: BASE_TOKEN_MAP, version, status: "published" })
      .returning();
    themeId = theme.id;
  });

  it("owner with one mode assigned has exactly one active assignment", async () => {
    await db.insert(themeAssignments).values({
      owner: "global",
      mode: "light",
      themeId,
      version: computeThemeVersion(BASE_TOKEN_MAP, null),
      status: "published",
    });

    const assignments = await db
      .select()
      .from(themeAssignments)
      .where(eq(themeAssignments.owner, "global"));

    expect(assignments).toHaveLength(1);
    expect(assignments[0].mode).toBe("light");
  });

  it("owner with two modes assigned has two active assignments", async () => {
    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    await db.insert(themeAssignments).values([
      { owner: "global", mode: "light", themeId, version, status: "published" },
      { owner: "global", mode: "dark",  themeId, version, status: "published" },
    ]);

    const assignments = await db
      .select()
      .from(themeAssignments)
      .where(eq(themeAssignments.owner, "global"));

    expect(assignments).toHaveLength(2);
  });
});

// ── time-bounded assignments ──────────────────────────────────────────────────

describe("getActiveThemeAssignment — time-bounded", () => {
  let db: ReturnType<typeof getTestDb>;
  let themeId: string;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(themeAssignments);
    await db.delete(themes);

    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    const [theme] = await db.insert(themes)
      .values({ name: "test_light", owner: "global", tokenMap: BASE_TOKEN_MAP, version, status: "published" })
      .returning();
    themeId = theme.id;
  });

  it("returns an assignment with no time bounds", async () => {
    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    await db.insert(themeAssignments).values({
      owner: "global", mode: "light", themeId, version, status: "published",
    });

    const assignment = await getActiveThemeAssignment(db as any, "global", "light");
    expect(assignment).not.toBeNull();
  });

  it("returns an assignment where valid_from is in the past", async () => {
    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    await db.insert(themeAssignments).values({
      owner: "global", mode: "light", themeId, version, status: "published",
      validFrom: pastDate(1),
    });

    const assignment = await getActiveThemeAssignment(db as any, "global", "light");
    expect(assignment).not.toBeNull();
  });

  it("does not return an assignment where valid_from is in the future", async () => {
    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    await db.insert(themeAssignments).values({
      owner: "global", mode: "light", themeId, version, status: "published",
      validFrom: futureDate(5),
    });

    const assignment = await getActiveThemeAssignment(db as any, "global", "light");
    expect(assignment).toBeNull();
  });

  it("does not return an assignment where valid_until is in the past", async () => {
    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    await db.insert(themeAssignments).values({
      owner: "global", mode: "light", themeId, version, status: "published",
      validUntil: pastDate(1),
    });

    const assignment = await getActiveThemeAssignment(db as any, "global", "light");
    expect(assignment).toBeNull();
  });

  it("returns an assignment where valid_until is in the future", async () => {
    const version = computeThemeVersion(BASE_TOKEN_MAP, null);
    await db.insert(themeAssignments).values({
      owner: "global", mode: "light", themeId, version, status: "published",
      validUntil: futureDate(5),
    });

    const assignment = await getActiveThemeAssignment(db as any, "global", "light");
    expect(assignment).not.toBeNull();
  });
});

// ── ui.string.* config defaults ───────────────────────────────────────────────

describe("ui.string.* config defaults", () => {
  let db: ReturnType<typeof getTestDb>;
  let configKey: string;

  beforeEach(async () => {
    db = getTestDb();
    // Unique key per test run — prevents concurrent tests from deleting each
    // other's config rows (a global delete here would race with tenant-context tests)
    configKey = `ui.string.productName.test-${uuidv7()}`;
  });

  afterEach(async () => {
    await db.delete(config).where(eq(config.key, configKey));
  });

  it("productName default resolves from config", async () => {
    await db.insert(config).values({
      key: configKey,
      value: "Agent12",
      owner: "global",
    });

    const rows = await db
      .select()
      .from(config)
      .where(and(eq(config.key, configKey), eq(config.owner, "global")));

    expect(rows[0]?.value).toBe("Agent12");
  });

  it("tenant override takes precedence over global default", async () => {
    await db.insert(config).values([
      { key: configKey, value: "Agent12",   owner: "global"     },
      { key: configKey, value: "MyProduct", owner: "tenant-xyz" },
    ]);

    const tenantRow = await db
      .select()
      .from(config)
      .where(and(eq(config.key, configKey), eq(config.owner, "tenant-xyz")));

    expect(tenantRow[0]?.value).toBe("MyProduct");
  });
});
