/**
 * Integration tests for the decomposed wave2_5 per-tool lookup.
 * Real DB (cv_result_cache), mocked API clients — zero tokens, zero API quota.
 *
 * These are the 5 integration tests stated in PLAN.md Phase 3h:
 *   1. GHSA returns known advisory for a real package (covered in cv-apis.test.ts)
 *   2. NVD fallback triggers when GHSA entry is absent (covered in cv-apis.test.ts)
 *   3. Conflict check surfaces a compatible alternative version
 *   4. Per-tool sub-task failure with flaggable data point ships flagged
 *   5. Per-tool checkpoint survives failure of a sibling sub-task
 *
 * Tests 1 and 2 live in cv-apis.test.ts (pure client logic, no DB needed).
 * Tests 3, 4, and 5 live here (require DB and orchestration logic).
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { getTestDb } from "./test-db.js";
import { cvResultCache } from "@agent12/shared";
import { runPerToolLookup, type PerToolLookupDeps } from "../workers/per-tool-lookup.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const DEFAULT_SEARCH_RESULT = {
  pricing: null,
  pricingFlagged: true,
  eolDate: null,
  breakingChanges: [],
  tripHazards: [],
  sourceUrls: { registry: "https://pypi.org/project/test-tool/" },
};

function makeDeps(overrides: Partial<PerToolLookupDeps> = {}): PerToolLookupDeps {
  return {
    queryCves: vi.fn().mockResolvedValue({ critical: [], high: [], source: "none" }),
    queryVersion: vi.fn().mockResolvedValue({ version: "1.0.0", license: "MIT" }),
    searchToolData: vi.fn().mockResolvedValue(DEFAULT_SEARCH_RESULT),
    ...overrides,
  };
}

// ── test suite ────────────────────────────────────────────────────────────────

describe("runPerToolLookup", () => {
  let db: ReturnType<typeof getTestDb>;
  // Track tool names so afterEach only deletes rows this test created
  let toolNames: string[] = [];

  beforeEach(() => {
    db = getTestDb();
    toolNames = [];
  });

  afterEach(async () => {
    if (toolNames.length) {
      for (const name of toolNames) {
        await db.delete(cvResultCache).where(eq(cvResultCache.toolName, name));
      }
    }
  });

  // ── integration test 5 (first): cache hit means API is never called ───────
  //
  // If cv_result_cache has a fresh entry for a tool, the lookup returns it
  // immediately without calling any API. This is the per-tool checkpoint
  // mechanism: retrying a failed wave2_5 job reads cached results for tools
  // that already completed.

  it("returns a cached result without calling any API when a fresh entry exists", async () => {
    const toolName = `test-tool-${uuidv7()}`;
    toolNames.push(toolName);

    await db.insert(cvResultCache).values({
      toolName,
      toolVersion: "2.0.0",
      cveStatus: { critical: [], high: [] },
      license: "MIT",
      sourceUrl: "https://example.com",
      ttlSeconds: 86400,
    });

    const deps = makeDeps();
    const result = await runPerToolLookup(db, toolName, "npm", "toolIntegration", false, deps);

    expect(result.fromCache).toBe(true);
    expect(result.toolName).toBe(toolName);
    expect(deps.queryCves).not.toHaveBeenCalled();
    expect(deps.queryVersion).not.toHaveBeenCalled();
  });

  // ── cache miss: APIs called, result written to cv_result_cache ────────────

  it("calls API clients on a cache miss, populates all fields, and writes to cv_result_cache", async () => {
    const toolName = `test-tool-${uuidv7()}`;
    toolNames.push(toolName);

    const deps = makeDeps({
      queryVersion: vi.fn().mockResolvedValue({ version: "3.1.0", license: "Apache-2.0" }),
      queryCves: vi.fn().mockResolvedValue({ critical: [], high: [], source: "GHSA" }),
      searchToolData: vi.fn().mockResolvedValue({
        pricing: "Free",
        pricingFlagged: false,
        eolDate: null,
        breakingChanges: [],
        tripHazards: ["Requires Redis 6+ as backing store"],
        sourceUrls: {
          registry: "https://www.npmjs.com/package/test-tool/v/3.1.0",
          docs: "https://test-tool.dev/docs/",
        },
      }),
    });

    const result = await runPerToolLookup(db, toolName, "npm", "toolIntegration", false, deps);

    expect(result.fromCache).toBe(false);
    expect(result.version).toBe("3.1.0");
    expect(result.license).toBe("Apache-2.0");
    expect(result.pricing).toBe("Free");
    expect(result.tripHazards).toHaveLength(1);
    expect(result.sourceUrls.registry).toContain("npmjs.com");
    expect(result.sourceUrls.docs).toContain("test-tool.dev");
    expect(deps.queryVersion).toHaveBeenCalledOnce();
    expect(deps.queryCves).toHaveBeenCalledOnce();
    expect(deps.searchToolData).toHaveBeenCalledOnce();

    // Written to cv_result_cache so retries skip completed tools
    const cached = await db.select().from(cvResultCache)
      .where(eq(cvResultCache.toolName, toolName));
    expect(cached).toHaveLength(1);
    expect(cached[0].toolVersion).toBe("3.1.0");
  });

  // ── integration test 4: flaggable failure ships flagged, run continues ────
  //
  // Pricing unavailable (pricingFlagged: true) is a flaggable failure — the
  // tool result ships with flagged: ["pricing"] but the job does not throw.

  it("includes the tool result with a pricing flag when pricing is unavailable", async () => {
    const toolName = `test-tool-${uuidv7()}`;
    toolNames.push(toolName);

    const deps = makeDeps({
      searchToolData: vi.fn().mockResolvedValue({
        pricing: null,
        pricingFlagged: true,
        eolDate: null,
        breakingChanges: [],
        tripHazards: [],
        sourceUrls: { registry: "https://pypi.org/project/test-tool/" },
      }),
    });

    const result = await runPerToolLookup(db, toolName, "npm", "toolIntegration", false, deps);

    expect(result.flagged).toContain("pricing");
    expect(result.toolName).toBe(toolName);
    expect(result.version).toBeDefined();
    // Source URL still present — human can verify other fields even when pricing is unknown
    expect(result.sourceUrls.registry).toBeDefined();
  });

  // ── integration test 3: conflict check with resolution path ──────────────
  //
  // When a version conflict is found between two tools, the conflict check
  // surfaces a compatible alternative version rather than just rejecting.
  // This test verifies the shape of the conflict result — the resolution
  // path (a compatible version recommendation) must be present.

  it("conflict check result includes a compatible alternative version when a conflict is detected", async () => {
    // runCrossAgentConflictCheck is a separate function from runPerToolLookup.
    // Import it directly to test the conflict resolution behavior.
    const { runCrossAgentConflictCheck } = await import("../workers/cv-conflict-check.js");

    const base = {
      isUserSpecified: false, isCurrentVersion: null, eolDate: null,
      breakingChanges: [], pricing: null, tripHazards: [], sourceUrls: {},
      fromCache: false, flagged: [],
    };
    const toolResults = [
      { ...base, toolName: "langchain",  agentKey: "toolIntegration", version: "0.1.0", cves: { critical: [], high: [] }, license: "MIT",  isCopyleft: false },
      { ...base, toolName: "openai-sdk", agentKey: "toolIntegration", version: "4.0.0", cves: { critical: [], high: [] }, license: "MIT",  isCopyleft: false },
    ];

    // Wave 1 output declares a version constraint that conflicts with tool results
    const wave1Results = {
      toolIntegration: {
        declaredConstraints: ["langchain >= 0.2.0 required for openai-sdk 4.x compatibility"],
      },
    };

    const conflicts = await runCrossAgentConflictCheck(toolResults, wave1Results);

    expect(conflicts.length).toBeGreaterThan(0);
    // The conflict must include a resolution path, not just a rejection flag
    const conflict = conflicts[0];
    expect(conflict.description).toBeTruthy();
    expect(conflict.compatibleVersion).toBeTruthy();
  });

  // ── integration test 5: sibling checkpoint survives sibling failure ───────
  //
  // When tool A succeeds and caches its result, and tool B subsequently fails,
  // tool A's cache entry must remain intact. On wave2_5 job retry, tool A
  // reads from cache (fromCache: true) while tool B retries its lookup.

  it("a sibling tool's cache entry survives when another tool's lookup fails", async () => {
    const toolA = `test-tool-a-${uuidv7()}`;
    const toolB = `test-tool-b-${uuidv7()}`;
    toolNames.push(toolA, toolB);

    // Tool A: succeeds and writes to cache
    const depsA = makeDeps();
    await runPerToolLookup(db, toolA, "npm", "toolIntegration", false, depsA);

    // Verify tool A is now in cache
    const cachedA = await db.select().from(cvResultCache)
      .where(eq(cvResultCache.toolName, toolA));
    expect(cachedA).toHaveLength(1);

    // Tool B: CVE API throws (fatal failure for this tool)
    const depsB = makeDeps({
      queryCves: vi.fn().mockRejectedValue(new Error("GHSA API timeout")),
    });

    await expect(runPerToolLookup(db, toolB, "npm", "toolIntegration", false, depsB)).rejects.toThrow("GHSA API timeout");

    // Tool A's cache entry must still be present for retry
    const cachedAAfter = await db.select().from(cvResultCache)
      .where(eq(cvResultCache.toolName, toolA));
    expect(cachedAAfter).toHaveLength(1);
    expect(cachedAAfter[0].toolName).toBe(toolA);
  });
});

// ── cost context extraction ───────────────────────────────────────────────────
//
// buildCostContext is a pure function — no DB, no mocking needed.
// It extracts cost signals from wave1/wave2 outputs and intake fields from
// verifiedContext, packaging everything the CV agent needs for cost aggregation.
// Tests here define the contract; implementation follows in cost-context.ts.

import { buildCostContext } from "../workers/cost-context.js";

const WAVE1_WITH_SIGNALS = {
  orchestration:        { costSignals: { computeIntensity: "medium" } },
  security:             { costSignals: { computeIntensity: "low"    } },
  memoryState:          { costSignals: { computeIntensity: "high"   } },
  toolIntegration:      { costSignals: { computeIntensity: "medium" } },
};

const WAVE2_WITH_SIGNALS = {
  failureObservability: { costSignals: { computeIntensity: "low"    } },
  trustControl:         { costSignals: { computeIntensity: "low"    } },
};

const HIGH_CONFIDENCE_CONTEXT = {
  scale:            { state: "high_confidence", selected: "medium_volume"    },
  modelPreferences: { state: "high_confidence", selected: "claude-sonnet-4-6" },
  orchestrationPattern: { state: "high_confidence", selected: "pipeline"     },
};

describe("buildCostContext", () => {
  it("extracts costSignals from all wave1 and wave2 agents", () => {
    const ctx = buildCostContext(WAVE1_WITH_SIGNALS, WAVE2_WITH_SIGNALS, HIGH_CONFIDENCE_CONTEXT);
    // 4 wave1 agents + 2 wave2 agents
    expect(ctx.agentCostSignals).toHaveLength(6);
    expect(ctx.agentCostSignals.some(s => s.agent === "orchestration")).toBe(true);
    expect(ctx.agentCostSignals.some(s => s.agent === "memoryState")).toBe(true);
    expect(ctx.agentCostSignals.some(s => s.agent === "trustControl")).toBe(true);
  });

  it("includes computeIntensity for each agent signal", () => {
    const ctx = buildCostContext(WAVE1_WITH_SIGNALS, WAVE2_WITH_SIGNALS, HIGH_CONFIDENCE_CONTEXT);
    for (const signal of ctx.agentCostSignals) {
      expect(["low", "medium", "high"]).toContain(signal.computeIntensity);
    }
  });

  it("populates scale and modelSelection from high-confidence intake context", () => {
    const ctx = buildCostContext(WAVE1_WITH_SIGNALS, WAVE2_WITH_SIGNALS, HIGH_CONFIDENCE_CONTEXT);
    expect(ctx.scale).toBe("medium_volume");
    expect(ctx.modelSelection).toBe("claude-sonnet-4-6");
    expect(ctx.orchestrationPattern).toBe("pipeline");
  });

  it("sets scale to null when intake confidence is low", () => {
    const lowConfidenceContext = {
      scale:            { state: "low_confidence" },
      modelPreferences: { state: "low_confidence" },
      orchestrationPattern: { state: "high_confidence", selected: "pipeline" },
    };
    const ctx = buildCostContext(WAVE1_WITH_SIGNALS, WAVE2_WITH_SIGNALS, lowConfidenceContext);
    expect(ctx.scale).toBeNull();
    expect(ctx.modelSelection).toBeNull();
    expect(ctx.orchestrationPattern).toBe("pipeline");
  });

  it("handles missing agents gracefully — partial wave1 produces correct count", () => {
    const partialWave1 = {
      orchestration: { costSignals: { computeIntensity: "medium" } },
      // security and others omitted — some agents may not run in all configurations
    };
    const ctx = buildCostContext(partialWave1, WAVE2_WITH_SIGNALS, HIGH_CONFIDENCE_CONTEXT);
    expect(ctx.agentCostSignals.length).toBeGreaterThanOrEqual(1);
  });

  it("returns zero agent signals without throwing when both wave outputs are empty", () => {
    const ctx = buildCostContext({}, {}, HIGH_CONFIDENCE_CONTEXT);
    expect(ctx.agentCostSignals).toHaveLength(0);
    expect(ctx.scale).toBe("medium_volume");
  });
});
