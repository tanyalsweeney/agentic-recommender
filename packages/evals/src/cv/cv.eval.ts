/**
 * Compatibility Validator eval — 1 case.
 * Unskip and wire callCompatibilityValidator() in Phase 2c.
 */
import { describe, it, expect } from "vitest";
import { CompatibilityValidatorOutput } from "@agent12/agents";

async function callCompatibilityValidator(_toolsAndContext: object): Promise<CompatibilityValidatorOutput> {
  throw new Error("callCompatibilityValidator not implemented — Phase 2c");
}

// LangChain 0.0.1 is a very old version with known issues.
// CV should surface version staleness and flag it appropriately.
// This eval uses a real tool with a real historical record — no mocking.

const oldLangchainContext = {
  recommendedTools: [
    { toolName: "langchain", version: "0.0.1" },
  ],
  platform: "AWS",
  model: "claude-sonnet",
};

describe("CV eval 12: known old tool version → version and CVE status returned", () => {
  it.skip("returns a per-tool result for langchain", async () => {
    const output = await callCompatibilityValidator(oldLangchainContext);
    const langchainResult = output.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("langchain")
    );
    expect(langchainResult).toBeDefined();
  });

  it.skip("flags langchain 0.0.1 as not the current version", async () => {
    const output = await callCompatibilityValidator(oldLangchainContext);
    const langchainResult = output.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("langchain")
    );
    expect(langchainResult!.isCurrentVersion).toBe(false);
  });

  it.skip("includes a source URL for manual verification", async () => {
    const output = await callCompatibilityValidator(oldLangchainContext);
    const langchainResult = output.perToolResults.find(r =>
      r.toolName.toLowerCase().includes("langchain")
    );
    expect(langchainResult!.sourceUrl).toBeTruthy();
    expect(langchainResult!.sourceUrl).toMatch(/^https?:\/\//);
  });

  it.skip("includes fromCache field on every tool result", async () => {
    const output = await callCompatibilityValidator(oldLangchainContext);
    for (const result of output.perToolResults) {
      expect(typeof result.fromCache).toBe("boolean");
    }
  });
});
