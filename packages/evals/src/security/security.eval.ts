import { describe, it, expect } from "vitest";
import { callSecurityAgent } from "@agent12/agents";
import { anthropic, SEED_MANIFEST } from "../helpers.js";

const autonomousWebAgentContext = {
  description:
    "An autonomous agent that browses the web on behalf of users. " +
    "It can navigate to any URL, fill out forms, submit purchases, and " +
    "interact with third-party websites. Users give it a task in natural " +
    "language and it executes without further confirmation.",
  autonomyHitl: { selected: "fully_autonomous" },
  externalIntegrations: { selected: "arbitrary_web_urls" },
};

describe("Security eval 5: autonomous web agent → prompt injection flagged as high", () => {
  it("flags prompt injection via web content as a high-likelihood, high-impact risk", async () => {
    const output = await callSecurityAgent(SEED_MANIFEST, autonomousWebAgentContext, anthropic);
    const risks = output.agenticAttackSurface.promptInjectionRisks;
    expect(risks.length).toBeGreaterThan(0);

    const webRisk = risks.find(r =>
      r.attackVector.toLowerCase().includes("web") ||
      r.threat.toLowerCase().includes("web") ||
      r.threat.toLowerCase().includes("page") ||
      r.threat.toLowerCase().includes("content")
    );
    expect(webRisk).toBeDefined();
    expect(webRisk!.likelihood).toBe("high");
    expect(webRisk!.impact).toBe("high");
  });

  it("flags excessive autonomy as a risk", async () => {
    const output = await callSecurityAgent(SEED_MANIFEST, autonomousWebAgentContext, anthropic);
    expect(output.agenticAttackSurface.excessiveAutonomyRisks.length).toBeGreaterThan(0);
  });

  it("includes at least one mitigation for prompt injection", async () => {
    const output = await callSecurityAgent(SEED_MANIFEST, autonomousWebAgentContext, anthropic);
    const mitigations = output.agenticAttackSurface.promptInjectionRisks.flatMap(r => r.mitigations);
    expect(mitigations.length).toBeGreaterThan(0);
  });
});
