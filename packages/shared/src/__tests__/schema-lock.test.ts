/**
 * Schema-lock tests for the four spec'd tables landed in migration 0010
 * (Phase 3.4.5). No behavior wiring this phase — Phase 4 consumes them.
 *
 * Tests cover: round-trip insert/select, FK enforcement, defaults, unique
 * constraints, scoped isolation. Uses uuidv7 + scoped afterEach cleanup per
 * the test isolation rule.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import {
  tenants,
  users,
  codebaseDigestDrafts,
  tenantModificationRequests,
  tenantCommunicationContexts,
  manifestIntentGapQuestions,
} from "../db/schema.js";

// ── codebase_digest_drafts ────────────────────────────────────────────────────

describe("codebase_digest_drafts schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdUserIds: string[] = [];
  const createdTenantIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdUserIds.length = 0;
    createdTenantIds.length = 0;
  });

  afterEach(async () => {
    if (createdUserIds.length) {
      await db.delete(codebaseDigestDrafts).where(inArray(codebaseDigestDrafts.userId, createdUserIds));
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    if (createdTenantIds.length) {
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  function futureDate(daysFromNow: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d;
  }

  it("insert + select round-trips with default createdAt and null submittedAt", async () => {
    const [user] = await db.insert(users)
      .values({ email: `digest-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(user!.id);

    const [row] = await db.insert(codebaseDigestDrafts).values({
      userId: user!.id,
      digest: { tools: [{ name: "redis" }] },
      qualitySummary: { score: 4 },
      expiresAt: futureDate(7),
    }).returning();

    expect(row!.id).toBeTruthy();
    expect(row!.userId).toBe(user!.id);
    expect(row!.tenantId).toBeNull();
    expect(row!.digest).toEqual({ tools: [{ name: "redis" }] });
    expect(row!.qualitySummary).toEqual({ score: 4 });
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.expiresAt).toBeInstanceOf(Date);
    expect(row!.submittedAt).toBeNull();
  });

  it("supports tenantId when the user belongs to a tenant", async () => {
    const tid = uuidv7();
    await db.insert(tenants).values({
      id: tid, name: `t-${tid}`, slug: `t-${tid}`, plan: "standard",
    });
    createdTenantIds.push(tid);

    const [user] = await db.insert(users)
      .values({ email: `dt-${uuidv7()}@example.com`, tenantId: tid })
      .returning();
    createdUserIds.push(user!.id);

    const [row] = await db.insert(codebaseDigestDrafts).values({
      userId: user!.id,
      tenantId: tid,
      digest: {},
      qualitySummary: {},
      expiresAt: futureDate(1),
    }).returning();

    expect(row!.tenantId).toBe(tid);
  });

  it("user_id FK rejects orphan inserts", async () => {
    await expect(
      db.insert(codebaseDigestDrafts).values({
        userId: uuidv7(), // user does not exist
        digest: {},
        qualitySummary: {},
        expiresAt: futureDate(1),
      })
    ).rejects.toThrow();
  });

  it("tenant_id FK rejects orphan tenant references", async () => {
    const [user] = await db.insert(users)
      .values({ email: `dt-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(user!.id);

    await expect(
      db.insert(codebaseDigestDrafts).values({
        userId: user!.id,
        tenantId: uuidv7(), // tenant does not exist
        digest: {},
        qualitySummary: {},
        expiresAt: futureDate(1),
      })
    ).rejects.toThrow();
  });

  it("drafts are scoped to their user", async () => {
    const [userA] = await db.insert(users)
      .values({ email: `dta-${uuidv7()}@example.com` })
      .returning();
    const [userB] = await db.insert(users)
      .values({ email: `dtb-${uuidv7()}@example.com` })
      .returning();
    createdUserIds.push(userA!.id, userB!.id);

    await db.insert(codebaseDigestDrafts).values({
      userId: userA!.id,
      digest: { owner: "A" },
      qualitySummary: {},
      expiresAt: futureDate(1),
    });

    const bDrafts = await db.select().from(codebaseDigestDrafts).where(eq(codebaseDigestDrafts.userId, userB!.id));
    expect(bDrafts).toHaveLength(0);
  });
});

// ── tenant_modification_requests ──────────────────────────────────────────────

describe("tenant_modification_requests schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdTenantIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdTenantIds.length = 0;
  });

  afterEach(async () => {
    if (createdTenantIds.length) {
      await db.delete(tenantModificationRequests).where(inArray(tenantModificationRequests.tenantId, createdTenantIds));
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  async function makeTenant(): Promise<string> {
    const id = uuidv7();
    await db.insert(tenants).values({ id, name: `t-${id}`, slug: `t-${id}`, plan: "standard" });
    createdTenantIds.push(id);
    return id;
  }

  it("insert + select round-trips with default status 'submitted' and timestamps", async () => {
    const tid = await makeTenant();
    const [row] = await db.insert(tenantModificationRequests).values({
      tenantId: tid,
      requestType: "config_change",
      intentDescription: "Increase concurrency cap to 20",
    }).returning();

    expect(row!.tenantId).toBe(tid);
    expect(row!.requestType).toBe("config_change");
    expect(row!.status).toBe("submitted");
    expect(row!.quotedAmount).toBeNull();
    expect(row!.adminNotes).toBeNull();
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.updatedAt).toBeInstanceOf(Date);
  });

  it("accepts status flow transitions through every documented state", async () => {
    const tid = await makeTenant();
    const states = ["submitted", "quoted", "approved", "in_progress", "deployed", "declined"];
    for (const status of states) {
      const [row] = await db.insert(tenantModificationRequests).values({
        tenantId: tid,
        requestType: "config_change",
        intentDescription: `state ${status}`,
        status,
      }).returning();
      expect(row!.status).toBe(status);
    }
  });

  it("quoted_amount accepts free-form text (e.g. '$5,000', '5000 USD', 'TBD')", async () => {
    const tid = await makeTenant();
    const samples = ["$5,000", "5000 USD", "TBD", "0"];
    for (const amount of samples) {
      const [row] = await db.insert(tenantModificationRequests).values({
        tenantId: tid,
        requestType: "config_change",
        intentDescription: "x",
        quotedAmount: amount,
      }).returning();
      expect(row!.quotedAmount).toBe(amount);
    }
  });

  it("tenant_id FK rejects orphan inserts", async () => {
    await expect(
      db.insert(tenantModificationRequests).values({
        tenantId: uuidv7(), // tenant does not exist
        requestType: "config_change",
        intentDescription: "orphan",
      })
    ).rejects.toThrow();
  });

  it("requests are scoped to their tenant", async () => {
    const tidA = await makeTenant();
    const tidB = await makeTenant();
    await db.insert(tenantModificationRequests).values({
      tenantId: tidA,
      requestType: "config_change",
      intentDescription: "a",
    });
    const bRequests = await db.select().from(tenantModificationRequests).where(eq(tenantModificationRequests.tenantId, tidB));
    expect(bRequests).toHaveLength(0);
  });
});

// ── tenant_communication_contexts ─────────────────────────────────────────────

describe("tenant_communication_contexts schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdTenantIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdTenantIds.length = 0;
  });

  afterEach(async () => {
    if (createdTenantIds.length) {
      await db.delete(tenantCommunicationContexts).where(inArray(tenantCommunicationContexts.tenantId, createdTenantIds));
      await db.delete(tenants).where(inArray(tenants.id, createdTenantIds));
    }
  });

  async function makeTenant(): Promise<string> {
    const id = uuidv7();
    await db.insert(tenants).values({ id, name: `t-${id}`, slug: `t-${id}`, plan: "standard" });
    createdTenantIds.push(id);
    return id;
  }

  it("insert + select round-trips with default status 'draft'", async () => {
    const tid = await makeTenant();
    const [row] = await db.insert(tenantCommunicationContexts).values({
      tenantId: tid,
      name: "exec-summary-banking",
      promptFragment: "Audience: regulated banking executives. Tone: cautious.",
      version: "2026-05-07-deadbeef",
    }).returning();

    expect(row!.name).toBe("exec-summary-banking");
    expect(row!.promptFragment).toContain("regulated banking executives");
    expect(row!.version).toBe("2026-05-07-deadbeef");
    expect(row!.status).toBe("draft");
    expect(row!.createdAt).toBeInstanceOf(Date);
    expect(row!.updatedAt).toBeInstanceOf(Date);
  });

  it("supports both 'draft' and 'published' status values", async () => {
    const tid = await makeTenant();
    for (const status of ["draft", "published"]) {
      const [row] = await db.insert(tenantCommunicationContexts).values({
        tenantId: tid,
        name: `ctx-${status}-${uuidv7()}`,
        promptFragment: "x",
        version: "v",
        status,
      }).returning();
      expect(row!.status).toBe(status);
    }
  });

  it("multiple versions with the same name coexist (no unique constraint on name)", async () => {
    const tid = await makeTenant();
    const sharedName = "exec-summary-default";
    await db.insert(tenantCommunicationContexts).values({
      tenantId: tid, name: sharedName, promptFragment: "v1", version: "2026-05-01-aaaaaaaa",
    });
    await db.insert(tenantCommunicationContexts).values({
      tenantId: tid, name: sharedName, promptFragment: "v2", version: "2026-05-07-bbbbbbbb",
    });

    const rows = await db.select().from(tenantCommunicationContexts).where(eq(tenantCommunicationContexts.tenantId, tid));
    expect(rows.length).toBe(2);
  });

  it("tenant_id FK rejects orphan inserts", async () => {
    await expect(
      db.insert(tenantCommunicationContexts).values({
        tenantId: uuidv7(),
        name: "orphan",
        promptFragment: "x",
        version: "v",
      })
    ).rejects.toThrow();
  });

  it("contexts are scoped to their tenant", async () => {
    const tidA = await makeTenant();
    const tidB = await makeTenant();
    await db.insert(tenantCommunicationContexts).values({
      tenantId: tidA, name: "a-only", promptFragment: "x", version: "v",
    });
    const bRows = await db.select().from(tenantCommunicationContexts).where(eq(tenantCommunicationContexts.tenantId, tidB));
    expect(bRows).toHaveLength(0);
  });
});

// ── manifest_intent_gap_questions ─────────────────────────────────────────────

describe("manifest_intent_gap_questions schema", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdQuestionIds: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    createdQuestionIds.length = 0;
  });

  afterEach(async () => {
    if (createdQuestionIds.length) {
      await db.delete(manifestIntentGapQuestions).where(inArray(manifestIntentGapQuestions.questionId, createdQuestionIds));
    }
  });

  it("insert + select round-trips with defaults", async () => {
    const qid = `consolidation_strategy_${uuidv7()}`;
    createdQuestionIds.push(qid);

    const [row] = await db.insert(manifestIntentGapQuestions).values({
      questionId: qid,
      questionText: "How should consolidated tools be sequenced?",
      optionType: "single-select",
    }).returning();

    expect(row!.questionId).toBe(qid);
    expect(row!.optionType).toBe("single-select");
    expect(row!.options).toEqual([]);
    expect(row!.applicableWhen).toEqual({});
    expect(row!.confidenceScore).toBe(0);
    expect(row!.lastRefreshedAt).toBeNull();
    expect(row!.vetted).toBe(false);
    expect(row!.owner).toBe("global");
  });

  it("question_id unique constraint rejects duplicates", async () => {
    const qid = `intent_gap_${uuidv7()}`;
    createdQuestionIds.push(qid);
    await db.insert(manifestIntentGapQuestions).values({
      questionId: qid, questionText: "first", optionType: "free-text-only",
    });
    await expect(
      db.insert(manifestIntentGapQuestions).values({
        questionId: qid, questionText: "second", optionType: "free-text-only",
      })
    ).rejects.toThrow();
  });

  it("supports the three documented option_type values", async () => {
    for (const optionType of ["single-select", "multi-select", "free-text-only"]) {
      const qid = `q_${optionType}_${uuidv7()}`;
      createdQuestionIds.push(qid);
      const [row] = await db.insert(manifestIntentGapQuestions).values({
        questionId: qid, questionText: "x", optionType,
      }).returning();
      expect(row!.optionType).toBe(optionType);
    }
  });

  it("options jsonb accepts a curated array", async () => {
    const qid = `q_options_${uuidv7()}`;
    createdQuestionIds.push(qid);
    const options = [
      { value: "opt_a", label: "Option A" },
      { value: "opt_b", label: "Option B" },
    ];
    const [row] = await db.insert(manifestIntentGapQuestions).values({
      questionId: qid, questionText: "x", optionType: "single-select", options,
    }).returning();
    expect(row!.options).toEqual(options);
  });

  it("applicableWhen jsonb accepts a structured matcher", async () => {
    const qid = `q_when_${uuidv7()}`;
    createdQuestionIds.push(qid);
    const matcher = {
      productCategory: "auth_service",
      toolCount: { gte: 2 },
      consolidationOpportunity: ["substantial", "marginal"],
    };
    const [row] = await db.insert(manifestIntentGapQuestions).values({
      questionId: qid, questionText: "x", optionType: "single-select", applicableWhen: matcher,
    }).returning();
    expect(row!.applicableWhen).toEqual(matcher);
  });

  it("vetted flag toggles cleanly", async () => {
    const qid = `q_vetted_${uuidv7()}`;
    createdQuestionIds.push(qid);
    const [row] = await db.insert(manifestIntentGapQuestions).values({
      questionId: qid, questionText: "x", optionType: "single-select", vetted: true,
    }).returning();
    expect(row!.vetted).toBe(true);
  });

  it("owner accepts both 'global' and a tenant id string", async () => {
    const globalQid = `q_global_${uuidv7()}`;
    const tenantQid = `q_tenant_${uuidv7()}`;
    const tenantOwner = uuidv7();
    createdQuestionIds.push(globalQid, tenantQid);

    const [globalRow] = await db.insert(manifestIntentGapQuestions).values({
      questionId: globalQid, questionText: "x", optionType: "single-select",
    }).returning();
    const [tenantRow] = await db.insert(manifestIntentGapQuestions).values({
      questionId: tenantQid, questionText: "x", optionType: "single-select", owner: tenantOwner,
    }).returning();

    expect(globalRow!.owner).toBe("global");
    expect(tenantRow!.owner).toBe(tenantOwner);
  });
});
