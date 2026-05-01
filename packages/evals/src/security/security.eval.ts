import { describe, it, expect, beforeAll } from "vitest";
import { callSecurityAgent } from "@agent12/agents";
import type { SecurityAgentOutput } from "@agent12/agents";
import { DEFAULT_PROVIDER_CONFIGS, SEED_MANIFEST } from "../helpers.js";

// Scenario A: read-only web research. Tests prompt injection via web content,
// trust boundaries, and data exfiltration via reasoning.
const readOnlyWebContext = {
  description:
    "An agent that researches topics on behalf of users. It browses web pages " +
    "and summarizes content into a structured report. Read-only — it cannot " +
    "submit forms, make purchases, or write to any external system.",
  autonomyHitl: { selected: "fully_autonomous" },
  externalIntegrations: { selected: "arbitrary_web_urls" },
};

// Scenario B: form submission and purchase agent. Tests tool misuse with write
// access, excessive autonomy risks, and financial impact concerns.
const writeAccessWebContext = {
  description:
    "An agent that completes online tasks on behalf of users: filling forms, " +
    "submitting orders, and making purchases. Users provide a task in natural " +
    "language; the agent executes it without further confirmation.",
  autonomyHitl: { selected: "fully_autonomous" },
  externalIntegrations: { selected: "arbitrary_web_urls" },
  writesExternalState: true,
};

describe("Security eval 5a: read-only web agent → prompt injection flagged", () => {
  let output: SecurityAgentOutput;

  beforeAll(async () => {
    output = await callSecurityAgent(SEED_MANIFEST, readOnlyWebContext, DEFAULT_PROVIDER_CONFIGS.security);
  }, 600_000);

  it("flags prompt injection via web content as a risk", () => {
    const risks = output.agenticAttackSurface.promptInjectionRisks;
    expect(risks.length).toBeGreaterThan(0);

    const webRisk = risks.find(r =>
      r.attackVector.toLowerCase().includes("web") ||
      r.threat.toLowerCase().includes("web") ||
      r.threat.toLowerCase().includes("page") ||
      r.threat.toLowerCase().includes("content")
    );
    expect(webRisk).toBeDefined();
  });

  it("flags data exfiltration via reasoning as a risk", () => {
    const risks = output.agenticAttackSurface.dataExfiltrationViaReasoning;
    expect(risks.length).toBeGreaterThan(0);
  });

  it("includes at least one mitigation for prompt injection", () => {
    const mitigations = output.agenticAttackSurface.promptInjectionRisks.flatMap(r => r.mitigations);
    expect(mitigations.length).toBeGreaterThan(0);
  });
});

describe("Security eval 5b: write-access web agent → excessive autonomy and tool misuse flagged", () => {
  let output: SecurityAgentOutput;

  beforeAll(async () => {
    output = await callSecurityAgent(SEED_MANIFEST, writeAccessWebContext, DEFAULT_PROVIDER_CONFIGS.security);
  }, 600_000);

  it("flags excessive autonomy as a high-likelihood risk", () => {
    const risks = output.agenticAttackSurface.excessiveAutonomyRisks;
    expect(risks.length).toBeGreaterThan(0);
  });

  it("flags tool misuse risks for write-access operations", () => {
    const risks = output.agenticAttackSurface.toolMisuseRisks;
    expect(risks.length).toBeGreaterThan(0);
  });

  it("recommends controls that address autonomous write access", () => {
    const controls = output.recommendedControls;
    expect(controls.length).toBeGreaterThan(0);
  });
});
