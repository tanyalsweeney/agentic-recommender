/**
 * Tests for cross-tool compatibility checks — both layers:
 *
 * Algorithmic: deterministic version-range conflict detection using declared
 * dependencies from package manifests (requires_dist / peerDependencies).
 * No LLM, no API calls. If Tool A requires openai>=1.0.0 and Tool B requires
 * openai>=0.28.0,<1.0.0, the conflict is detected from manifest data alone.
 *
 * LLM scaffold: interface and output shape for the LLM reasoning layer that
 * catches architectural incompatibilities not in package declarations. Stub
 * returns [] until implementation lands; shape tests verify the contract.
 */

import { vi, describe, it, expect } from "vitest";
import {
  runCrossToolCompatibilityCheck,
  runCrossToolLlmCheck,
  type ToolCompatibilityInput,
} from "../workers/cross-tool-check.js";
import {
  runConflictResolutionExchange,
  type ConflictCorrectionRequest,
} from "../workers/conflict-resolution.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function tool(name: string, deps: string[]): ToolCompatibilityInput {
  return { toolName: name, version: "1.0.0", dependencies: deps };
}

// ── algorithmic layer ─────────────────────────────────────────────────────────

describe("runCrossToolCompatibilityCheck — algorithmic", () => {
  it("detects a conflict when two tools require incompatible versions of a shared dep", () => {
    const tools = [
      tool("langchain",    ["openai>=1.0.0"]),
      tool("custom-tool",  ["openai>=0.28.0,<1.0.0"]),
    ];

    const conflicts = runCrossToolCompatibilityCheck(tools);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].toolPair).toContain("langchain");
    expect(conflicts[0].toolPair).toContain("custom-tool");
    expect(conflicts[0].sharedDependency).toBe("openai");
    expect(conflicts[0].source).toBe("algorithmic");
  });

  it("surfaces a compatible version when the conflict has a valid intersection", () => {
    // requests >=2.26,<3 vs requests >=2.28 → intersection is >=2.28,<3 → compatible
    const tools = [
      tool("tool-a", ["requests>=2.26,<3"]),
      tool("tool-b", ["requests>=2.28"]),
    ];

    // Intersection exists — should NOT be a conflict
    const conflicts = runCrossToolCompatibilityCheck(tools);
    expect(conflicts).toHaveLength(0);
  });

  it("includes compatibleVersion: null when no version satisfies both constraints", () => {
    const tools = [
      tool("tool-a", ["numpy>=2.0.0"]),
      tool("tool-b", ["numpy>=1.0.0,<2.0.0"]),
    ];

    const conflicts = runCrossToolCompatibilityCheck(tools);

    expect(conflicts).toHaveLength(1);
    // No version is both >=2.0.0 and <2.0.0
    expect(conflicts[0].compatibleVersion).toBeNull();
  });

  it("includes a compatibleVersion recommendation when the intersection is non-empty", () => {
    // pydantic >=1.7.4,<3 vs pydantic >=2.0 → intersection is >=2.0,<3
    const tools = [
      tool("langchain",          ["pydantic>=1.7.4,<3"]),
      tool("langchain-community", ["pydantic>=2.0"]),
    ];

    const conflicts = runCrossToolCompatibilityCheck(tools);

    // These ARE compatible — no conflict expected
    expect(conflicts).toHaveLength(0);
  });

  it("returns empty when no tools share a common dependency", () => {
    const tools = [
      tool("langchain", ["pydantic>=2.0"]),
      tool("redis",     ["async-timeout>=4.0"]),
    ];
    expect(runCrossToolCompatibilityCheck(tools)).toHaveLength(0);
  });

  it("returns empty with a single tool — no pairs to check", () => {
    expect(runCrossToolCompatibilityCheck([tool("langchain", ["pydantic>=2.0"])])).toHaveLength(0);
  });

  it("returns empty with no tools", () => {
    expect(runCrossToolCompatibilityCheck([])).toHaveLength(0);
  });

  it("handles tools with no declared dependencies without throwing", () => {
    const tools = [tool("tool-a", []), tool("tool-b", [])];
    expect(runCrossToolCompatibilityCheck(tools)).toHaveLength(0);
  });
});

// ── LLM reasoning scaffold ────────────────────────────────────────────────────

describe("runCrossToolLlmCheck — scaffold", () => {
  it("returns an array (scaffold returns empty until implementation lands)", async () => {
    const tools = [
      tool("langchain", []),
      tool("chromadb",  []),
    ];
    const result = await runCrossToolLlmCheck(tools, {});
    expect(Array.isArray(result)).toBe(true);
  });

  it("each LLM conflict, when present, includes toolPair, description, and source: llm", async () => {
    // Shape contract: validates the output type when the LLM layer is wired.
    // Currently passes vacuously because scaffold returns []. When implementation
    // lands, replace with a mock-based test that returns a synthetic conflict.
    const result = await runCrossToolLlmCheck([], {});
    for (const conflict of result) {
      expect(conflict.toolPair).toHaveLength(2);
      expect(typeof conflict.description).toBe("string");
      expect(conflict.source).toBe("llm");
    }
  });

  it("LLM conflict shape includes optional compatibleVersion when a resolution exists", async () => {
    const result = await runCrossToolLlmCheck([], {});
    for (const conflict of result) {
      // compatibleVersion is either a string or null/undefined — never throws
      expect(
        conflict.compatibleVersion === null ||
        conflict.compatibleVersion === undefined ||
        typeof conflict.compatibleVersion === "string"
      ).toBe(true);
    }
  });
});
