import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { manifestIntentGapQuestions } from "../db/schema.js";

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
