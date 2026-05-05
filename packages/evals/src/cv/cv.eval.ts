/**
 * Compatibility Validator eval — 2 scenarios.
 *
 * Tests the CV agent's ability to synthesize realistic API-sourced version
 * and CVE data. Upstream context includes pre-resolved version and CVE data
 * (as if the per-tool API lookups have already run). This isolates agent
 * quality from the API client layer, which is covered in cv-apis.test.ts.
 *
 * Run manually before any prompt change to the CV agent:
 *   pnpm --filter evals exec vitest run src/cv/cv.eval.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { callCompatibilityValidator, DEFAULT_PROVIDER_CONFIGS } from "@agent12/agents";
import { SEED_MANIFEST } from "../helpers.js";
import type { CompatibilityValidatorOutput } from "@agent12/agents";

// ── scenario 1: stale version with known CVE ──────────────────────────────────
//
// langchain 0.0.1 is very old. Real PyPI data shows the current version is
// well beyond 0.0.1. Real GHSA data shows CVEs exist for older langchain
// versions. The CV agent should flag isCurrentVersion: false and surface
// CVE findings from the provided upstream data.

const staleVersionContext = {
  description:
    "Document processing pipeline on AWS Lambda using langchain 0.0.1 for orchestration",
  confirmedDecisions: {
    orchestrationPattern: "pipeline",
    platform: "AWS",
  },
};

const staleVersionUpstream = {
  wave1: {
    toolIntegration: {
      recommendedTools: [
        { tool: "langchain", purpose: "Orchestration framework", buildVsBuy: "buy", rationale: "Community standard" },
      ],
      declaredConstraints: [],
      costSignals: { computeIntensity: "medium" },
    },
  },
  wave2: {
    failureObservability: {
      failureModes: [],
      evalStrategy: { approach: "fixed test set", nonDeterministicHandling: "3x majority vote", suggestedEvalFramework: "vitest" },
      tracingApproach: { reasoningChainTracing: "structured logging", interAgentHandoffTracing: "structured logs", intersectionsWithStandardTracing: [] },
      costSignals: { computeIntensity: "low" },
    },
    trustControl: {
      hitlGates: [],
      autonomyEnforcement: { capturedLevel: "fully_autonomous", enforcementMechanism: "output schema validation", overrideConditions: [] },
      approvalWorkflow: { recommended: false },
      costSignals: { computeIntensity: "low" },
    },
  },
  // Simulates what the per-tool API lookup would return for langchain 0.0.1.
  // Version data from PyPI; CVE data from GHSA. Passed as enriched context
  // so the CV agent synthesizes real-sourced data rather than training knowledge.
  apiData: {
    langchain: {
      resolvedVersion: "0.0.1",
      currentVersion: "0.3.2",
      cves: {
        critical: [],
        high: ["GHSA-jf85-cpcp-j695: Remote code execution via template injection in langchain < 0.0.184"],
      },
      license: "MIT",
      sourceUrl: "https://pypi.org/project/langchain/",
    },
  },
};

let staleOutput: CompatibilityValidatorOutput;

// ── scenario 2: current version, clean CVE record ────────────────────────────
//
// anthropic-sdk at its current version should have no critical CVEs and
// isCurrentVersion: true. The CV agent should confirm the tool is safe to use.

const cleanVersionContext = {
  description: "Agentic pipeline using the Anthropic SDK for LLM calls",
  confirmedDecisions: {
    orchestrationPattern: "pipeline",
    platform: "AWS",
  },
};

const cleanVersionUpstream = {
  ...staleVersionUpstream,
  apiData: {
    "anthropic-sdk": {
      resolvedVersion: "0.39.0",
      currentVersion: "0.39.0",
      cves: { critical: [], high: [] },
      license: "MIT",
      sourceUrl: "https://pypi.org/project/anthropic/",
    },
  },
};

let cleanOutput: CompatibilityValidatorOutput;

// ── beforeAll: one API call per scenario ─────────────────────────────────────

beforeAll(async () => {
  [staleOutput, cleanOutput] = await Promise.all([
    callCompatibilityValidator(
      SEED_MANIFEST,
      staleVersionContext,
      staleVersionUpstream,
      DEFAULT_PROVIDER_CONFIGS.compatibilityValidator
    ),
    callCompatibilityValidator(
      SEED_MANIFEST,
      cleanVersionContext,
      cleanVersionUpstream,
      DEFAULT_PROVIDER_CONFIGS.compatibilityValidator
    ),
  ]);
}, 180_000);

// ── scenario 1 assertions ─────────────────────────────────────────────────────

describe("CV eval 12: stale langchain version with known CVE → flagged correctly", () => {
  it("returns a per-tool result for langchain", () => {
    const result = staleOutput.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("langchain")
    );
    expect(result).toBeDefined();
  });

  it("flags langchain 0.0.1 as not the current version", () => {
    const result = staleOutput.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("langchain")
    );
    expect(result!.isCurrentVersion).toBe(false);
  });

  it("includes a source URL for manual verification", () => {
    const result = staleOutput.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("langchain")
    );
    expect(result!.sourceUrl).toMatch(/^https?:\/\//);
  });

  it("includes fromCache field on every tool result", () => {
    for (const result of staleOutput.perToolResults) {
      expect(typeof result.fromCache).toBe("boolean");
    }
  });

  it("surfaces the HIGH CVE in the per-tool result", () => {
    const result = staleOutput.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("langchain")
    );
    // The agent should surface the HIGH CVE from the provided apiData context
    expect(result!.cves.high.length + result!.cves.critical.length).toBeGreaterThan(0);
  });
});

// ── scenario 2 assertions ─────────────────────────────────────────────────────

describe("CV eval 13: current anthropic-sdk version, clean CVE record → confirmed safe", () => {
  it("returns a per-tool result for the Anthropic SDK", () => {
    const result = cleanOutput.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("anthropic")
    );
    expect(result).toBeDefined();
  });

  it("confirms the current SDK version as current", () => {
    const result = cleanOutput.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("anthropic")
    );
    expect(result!.isCurrentVersion).toBe(true);
  });

  it("reports no critical or high CVEs for the current SDK version", () => {
    const result = cleanOutput.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("anthropic")
    );
    expect(result!.cves.critical).toHaveLength(0);
    expect(result!.cves.high).toHaveLength(0);
  });

  it("includes a source URL for manual verification", () => {
    const result = cleanOutput.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("anthropic")
    );
    expect(result!.sourceUrl).toMatch(/^https?:\/\//);
  });
});
