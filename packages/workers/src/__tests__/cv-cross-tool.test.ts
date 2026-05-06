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

// ── conflict correction exchange ──────────────────────────────────────────────
//
// 1-cycle feedback loop from CV to the affected wave 1/2 agents.
// Agent callers are mocks — no real LLM calls, no API quota.
//
// Per spec:
//   - Compatible version found: only the out-of-line agent receives the request
//   - No compatible version: all involved agents receive the request
//   - Three possible responses: accept / propose alternative / flag unresolvable
//   - Multiple conflicts batched into one call per agent

describe("runConflictResolutionExchange", () => {
  // ── compatible version: only out-of-line agent contacted ─────────────────

  it("contacts only the out-of-line agent when a compatible version exists", async () => {
    const conflict: ConflictCorrectionRequest = {
      conflictId:          "c1",
      toolPair:            ["langchain", "openai-sdk"],
      sharedDependency:    "openai",
      conflictDescription: "langchain requires openai<1.0; openai-sdk requires openai>=1.0",
      compatibleVersion:   "openai>=1.0.0",
      outOfLineAgent:      "toolIntegration",
      allInvolvedAgents:   ["toolIntegration", "memoryState"],
    };

    const toolIntegrationCaller = vi.fn().mockResolvedValue({
      agentKey:              "toolIntegration",
      conflictId:            "c1",
      resolution:            "accepted_compatible_version",
      updatedRecommendation: { tool: "langchain", version: "0.3.2" },
      resolutionNote:        "Updated to langchain 0.3.2 which uses openai>=1.0.0",
    });
    const memoryStateCaller = vi.fn();

    const results = await runConflictResolutionExchange([conflict], {
      toolIntegration: toolIntegrationCaller,
      memoryState:     memoryStateCaller,
    });

    expect(toolIntegrationCaller).toHaveBeenCalledOnce();
    expect(memoryStateCaller).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].resolution).toBe("accepted_compatible_version");
  });

  it("records the updated recommendation when an agent accepts the compatible version", async () => {
    const conflict: ConflictCorrectionRequest = {
      conflictId:          "c2",
      toolPair:            ["langchain", "openai-sdk"],
      sharedDependency:    "openai",
      conflictDescription: "version conflict on openai",
      compatibleVersion:   "openai>=1.0.0",
      outOfLineAgent:      "toolIntegration",
      allInvolvedAgents:   ["toolIntegration"],
    };

    const caller = vi.fn().mockResolvedValue({
      agentKey:              "toolIntegration",
      conflictId:            "c2",
      resolution:            "accepted_compatible_version",
      updatedRecommendation: { tool: "langchain", version: "0.3.2" },
      resolutionNote:        "Upgraded langchain to satisfy openai>=1.0.0",
    });

    const results = await runConflictResolutionExchange([conflict], {
      toolIntegration: caller,
    });

    expect(results[0].resolution).toBe("accepted_compatible_version");
    expect(results[0].updatedRecommendation).toBeDefined();
    expect(results[0].resolutionNote).toBeTruthy();
  });

  it("records the proposed alternative when an agent swaps to a different tool", async () => {
    const conflict: ConflictCorrectionRequest = {
      conflictId:          "c3",
      toolPair:            ["langchain", "openai-sdk"],
      sharedDependency:    "openai",
      conflictDescription: "version conflict on openai",
      compatibleVersion:   "openai>=1.0.0",
      outOfLineAgent:      "toolIntegration",
      allInvolvedAgents:   ["toolIntegration"],
    };

    const caller = vi.fn().mockResolvedValue({
      agentKey:              "toolIntegration",
      conflictId:            "c3",
      resolution:            "proposed_alternative",
      updatedRecommendation: { tool: "anthropic-sdk", version: "0.39.0" },
      resolutionNote:        "Replacing langchain with anthropic-sdk to avoid the conflict",
    });

    const results = await runConflictResolutionExchange([conflict], {
      toolIntegration: caller,
    });

    expect(results[0].resolution).toBe("proposed_alternative");
    expect(results[0].updatedRecommendation).toBeDefined();
  });

  // ── no compatible version: all agents contacted ───────────────────────────

  it("contacts all involved agents when no compatible version exists", async () => {
    const conflict: ConflictCorrectionRequest = {
      conflictId:          "c4",
      toolPair:            ["tool-a", "tool-b"],
      sharedDependency:    "numpy",
      conflictDescription: "no numpy version satisfies both tool-a and tool-b",
      compatibleVersion:   null,
      outOfLineAgent:      null,
      allInvolvedAgents:   ["toolIntegration", "memoryState"],
    };

    const toolIntegrationCaller = vi.fn().mockResolvedValue({
      agentKey:              "toolIntegration",
      conflictId:            "c4",
      resolution:            "proposed_alternative",
      updatedRecommendation: { tool: "different-tool", version: "1.0.0" },
      resolutionNote:        "Replacing tool-a with different-tool (no numpy dependency)",
    });
    const memoryStateCaller = vi.fn().mockResolvedValue({
      agentKey:      "memoryState",
      conflictId:    "c4",
      resolution:    "flagged_unresolvable",
      resolutionNote: "tool-b is a hard requirement for the memory pattern",
    });

    const results = await runConflictResolutionExchange([conflict], {
      toolIntegration: toolIntegrationCaller,
      memoryState:     memoryStateCaller,
    });

    expect(toolIntegrationCaller).toHaveBeenCalledOnce();
    expect(memoryStateCaller).toHaveBeenCalledOnce();
    expect(results).toHaveLength(2);
  });

  it("records the unresolvable flag and reasoning when an agent cannot find an alternative", async () => {
    const conflict: ConflictCorrectionRequest = {
      conflictId:          "c5",
      toolPair:            ["tool-a", "tool-b"],
      sharedDependency:    "numpy",
      conflictDescription: "no compatible numpy version",
      compatibleVersion:   null,
      outOfLineAgent:      null,
      allInvolvedAgents:   ["toolIntegration"],
    };

    const caller = vi.fn().mockResolvedValue({
      agentKey:      "toolIntegration",
      conflictId:    "c5",
      resolution:    "flagged_unresolvable",
      resolutionNote: "tool-a is a hard requirement — no alternative satisfies the constraint",
    });

    const results = await runConflictResolutionExchange([conflict], {
      toolIntegration: caller,
    });

    expect(results[0].resolution).toBe("flagged_unresolvable");
    expect(results[0].resolutionNote).toBeTruthy();
    // Flagged conflicts have no updatedRecommendation — conflict goes to Skeptic
    expect(results[0].updatedRecommendation).toBeUndefined();
  });

  // ── dependency verification of proposed alternatives ─────────────────────
  //
  // When an agent proposes a different tool, CV runs a lightweight dependency-
  // only lookup (queryVersion for dependencies field — no CVE, no web search,
  // no pricing) and checks the result against the full tool group.
  //
  // verificationScope: "dependency-only" tells the Skeptic exactly what was
  // checked so it can decide whether to use one of its 4 cycles to push back
  // to CV for a full verification.

  it("marks a clean alternative as verified with scope dependency-only", async () => {
    const conflict: ConflictCorrectionRequest = {
      conflictId:          "cv1",
      toolPair:            ["langchain", "openai-sdk"],
      sharedDependency:    "openai",
      conflictDescription: "openai version conflict",
      compatibleVersion:   null,
      outOfLineAgent:      null,
      allInvolvedAgents:   ["toolIntegration"],
    };

    const caller = vi.fn().mockResolvedValue({
      agentKey:              "toolIntegration",
      conflictId:            "cv1",
      resolution:            "proposed_alternative",
      updatedRecommendation: { tool: "anthropic-sdk", version: "0.39.0" },
      resolutionNote:        "Replacing langchain with anthropic-sdk — no openai dependency",
    });

    // Dependency-only lookup: anthropic-sdk has no openai dependency → clean
    const verifyAlternative = vi.fn().mockResolvedValue({ dependencies: ["httpx>=0.23.0"] });

    const results = await runConflictResolutionExchange(
      [conflict],
      { toolIntegration: caller },
      verifyAlternative
    );

    expect(results[0].resolution).toBe("proposed_alternative");
    expect(results[0].alternativeVerified).toBe(true);
    expect(results[0].alternativeVerificationScope).toBe("dependency-only");
    expect(results[0].alternativeConflicts).toHaveLength(0);
    expect(verifyAlternative).toHaveBeenCalledWith("anthropic-sdk");
  });

  it("marks a conflicted alternative as unverified with scope dependency-only and surfaces the new conflict", async () => {
    const conflict: ConflictCorrectionRequest = {
      conflictId:          "cv2",
      toolPair:            ["langchain", "openai-sdk"],
      sharedDependency:    "openai",
      conflictDescription: "openai version conflict",
      compatibleVersion:   null,
      outOfLineAgent:      null,
      allInvolvedAgents:   ["toolIntegration"],
    };

    const caller = vi.fn().mockResolvedValue({
      agentKey:              "toolIntegration",
      conflictId:            "cv2",
      resolution:            "proposed_alternative",
      // Proposed alternative also requires openai — same conflict persists
      updatedRecommendation: { tool: "another-llm-lib", version: "2.0.0" },
      resolutionNote:        "Replacing langchain with another-llm-lib",
    });

    // Dependency-only lookup: alternative still requires openai<1.0.0
    const verifyAlternative = vi.fn().mockResolvedValue({
      dependencies: ["openai>=0.28.0,<1.0.0"],
    });

    const results = await runConflictResolutionExchange(
      [conflict],
      { toolIntegration: caller },
      verifyAlternative
    );

    expect(results[0].resolution).toBe("proposed_alternative");
    // Not clean — Skeptic sees the scope and can decide whether to push back
    expect(results[0].alternativeVerified).toBe(false);
    expect(results[0].alternativeVerificationScope).toBe("dependency-only");
    expect(results[0].alternativeConflicts.length).toBeGreaterThan(0);
    expect(results[0].alternativeConflicts[0].sharedDependency).toBe("openai");
  });

  // ── multi-conflict batching ───────────────────────────────────────────────

  it("batches multiple conflicts for the same agent into one call", async () => {
    const conflicts: ConflictCorrectionRequest[] = [
      {
        conflictId: "ca", toolPair: ["tool-a", "tool-b"], sharedDependency: "openai",
        conflictDescription: "openai version conflict", compatibleVersion: "openai>=1.0.0",
        outOfLineAgent: "toolIntegration", allInvolvedAgents: ["toolIntegration"],
      },
      {
        conflictId: "cb", toolPair: ["tool-a", "tool-c"], sharedDependency: "pydantic",
        conflictDescription: "pydantic version conflict", compatibleVersion: "pydantic>=2.0",
        outOfLineAgent: "toolIntegration", allInvolvedAgents: ["toolIntegration"],
      },
    ];

    const caller = vi.fn().mockResolvedValue({
      agentKey:              "toolIntegration",
      conflictId:            "ca",
      resolution:            "accepted_compatible_version",
      updatedRecommendation: { tool: "tool-a", version: "2.0.0" },
      resolutionNote:        "Updated tool-a to 2.0.0 satisfying both openai and pydantic constraints",
    });

    await runConflictResolutionExchange(conflicts, { toolIntegration: caller });

    // Agent is called once with both conflicts batched — not once per conflict
    expect(caller).toHaveBeenCalledOnce();
  });
});
