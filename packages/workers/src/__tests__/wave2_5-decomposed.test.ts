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

function makeDeps(overrides: Partial<PerToolLookupDeps> = {}): PerToolLookupDeps {
  return {
    queryCves: vi.fn().mockResolvedValue({ critical: [], high: [], source: "none" }),
    queryVersion: vi.fn().mockResolvedValue({ version: "1.0.0", license: "MIT" }),
    searchWeb: vi.fn().mockResolvedValue("No pricing information found."),
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
    const result = await runPerToolLookup(db, toolName, "npm", deps);

    expect(result.fromCache).toBe(true);
    expect(result.toolName).toBe(toolName);
    expect(deps.queryCves).not.toHaveBeenCalled();
    expect(deps.queryVersion).not.toHaveBeenCalled();
  });

  // ── cache miss: APIs called, result written to cv_result_cache ────────────

  it("calls API clients on a cache miss and writes the result to cv_result_cache", async () => {
    const toolName = `test-tool-${uuidv7()}`;
    toolNames.push(toolName);

    const deps = makeDeps({
      queryVersion: vi.fn().mockResolvedValue({ version: "3.1.0", license: "Apache-2.0" }),
      queryCves: vi.fn().mockResolvedValue({ critical: [], high: [], source: "GHSA" }),
    });

    const result = await runPerToolLookup(db, toolName, "npm", deps);

    expect(result.fromCache).toBe(false);
    expect(result.version).toBe("3.1.0");
    expect(result.license).toBe("Apache-2.0");
    expect(deps.queryVersion).toHaveBeenCalledOnce();
    expect(deps.queryCves).toHaveBeenCalledOnce();

    // Verify the result was written to cv_result_cache for future retries
    const cached = await db.select().from(cvResultCache)
      .where(eq(cvResultCache.toolName, toolName));
    expect(cached).toHaveLength(1);
    expect(cached[0].toolVersion).toBe("3.1.0");
  });

  // ── integration test 4: flaggable failure ships flagged, run continues ────
  //
  // Pricing data being unavailable is a flaggable failure — the tool result
  // is included in the CV output with a flag, but the wave2_5 job does not
  // throw. This is different from a CVE API failure (which would throw).

  it("includes the tool result with a pricing flag when pricing data is unavailable", async () => {
    const toolName = `test-tool-${uuidv7()}`;
    toolNames.push(toolName);

    const deps = makeDeps({
      // searchWeb returns no pricing signal — this is the "unavailable" case
      searchWeb: vi.fn().mockResolvedValue("Pricing information not publicly available."),
    });

    const result = await runPerToolLookup(db, toolName, "npm", deps);

    // Should not throw — flaggable failures are surfaced via the flagged field
    expect(result.flagged).toContain("pricing");
    // The result is still complete enough to include in CV output
    expect(result.toolName).toBe(toolName);
    expect(result.version).toBeDefined();
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

    const toolResults = [
      {
        toolName: "langchain",
        version: "0.1.0",
        cves: { critical: [], high: [] },
        license: "MIT",
        isCopyleft: false,
      },
      {
        toolName: "openai-sdk",
        version: "4.0.0",
        cves: { critical: [], high: [] },
        license: "MIT",
        isCopyleft: false,
      },
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
    expect(conflict.compatibleAlternativeVersion).toBeTruthy();
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
    await runPerToolLookup(db, toolA, "npm", depsA);

    // Verify tool A is now in cache
    const cachedA = await db.select().from(cvResultCache)
      .where(eq(cvResultCache.toolName, toolA));
    expect(cachedA).toHaveLength(1);

    // Tool B: CVE API throws (fatal failure for this tool)
    const depsB = makeDeps({
      queryCves: vi.fn().mockRejectedValue(new Error("GHSA API timeout")),
    });

    await expect(runPerToolLookup(db, toolB, "npm", depsB)).rejects.toThrow("GHSA API timeout");

    // Tool A's cache entry must still be present for retry
    const cachedAAfter = await db.select().from(cvResultCache)
      .where(eq(cvResultCache.toolName, toolA));
    expect(cachedAAfter).toHaveLength(1);
    expect(cachedAAfter[0].toolName).toBe(toolA);
  });
});
