/**
 * Security agent eval — 1 case.
 * Unskip and wire callSecurityAgent() in Phase 2c.
 */
import { describe, it, expect } from "vitest";
import { SecurityAgentOutput } from "@agent12/agents";

async function callSecurityAgent(_verifiedContext: object): Promise<SecurityAgentOutput> {
  throw new Error("callSecurityAgent not implemented — Phase 2c");
}

// An autonomous web-browsing agent is one of the highest-risk agentic patterns.
// Prompt injection via web content is the canonical attack vector.

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
  it.skip("flags prompt injection via web content as a high-likelihood, high-impact risk", async () => {
    const output = await callSecurityAgent(autonomousWebAgentContext);
    const promptInjectionRisks = output.agenticAttackSurface.promptInjectionRisks;
    expect(promptInjectionRisks.length).toBeGreaterThan(0);

    const webContentRisk = promptInjectionRisks.find(r =>
      r.attackVector.toLowerCase().includes("web") ||
      r.threat.toLowerCase().includes("web") ||
      r.threat.toLowerCase().includes("page") ||
      r.threat.toLowerCase().includes("content")
    );
    expect(webContentRisk).toBeDefined();
    expect(webContentRisk!.likelihood).toBe("high");
    expect(webContentRisk!.impact).toBe("high");
  });

  it.skip("flags excessive autonomy as a risk given fully_autonomous setting", async () => {
    const output = await callSecurityAgent(autonomousWebAgentContext);
    expect(output.agenticAttackSurface.excessiveAutonomyRisks.length).toBeGreaterThan(0);
  });

  it.skip("includes at least one mitigation for prompt injection", async () => {
    const output = await callSecurityAgent(autonomousWebAgentContext);
    const allMitigations = output.agenticAttackSurface.promptInjectionRisks.flatMap(r => r.mitigations);
    expect(allMitigations.length).toBeGreaterThan(0);
  });
});
