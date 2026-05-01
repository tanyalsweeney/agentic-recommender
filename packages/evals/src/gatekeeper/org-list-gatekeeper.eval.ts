import { describe, it, expect } from "vitest";
import { callOrgListGatekeeperAgent } from "@agent12/agents";
import { DEFAULT_PROVIDER_CONFIGS } from "../helpers.js";

// Minimal current org list for context — enough for independence checks.
const SEED_ORG_LIST = [
  { orgName: "Anthropic", tier: "tier1-market-influence", status: "active" },
  { orgName: "LangChain", tier: "tier1-committed", status: "active" },
  { orgName: "Hugging Face", tier: "tier1-committed", status: "active" },
];

// A clearly Tier 1 org with strong signals across multiple categories.
const strongOrgProposal = {
  action: "add",
  orgName: "Cohere",
  rationale: "Enterprise LLM platform, active open-source contributor, extensive engineering publications on production RAG and agent systems.",
};

// An org with minimal signals — too early for inclusion.
const weakOrgProposal = {
  action: "add",
  orgName: "TinyStartup AI",
  rationale: "Building an agent framework. One GitHub repo with 50 stars, no published engineering content.",
};

// A subsidiary of an existing org list member — independence check should fail.
const affiliateOrgProposal = {
  action: "add",
  orgName: "Anthropic Research Labs",
  rationale: "Publishes extensive agentic research. Strong engineering signal.",
  vendorRelationshipContext: "Anthropic Research Labs is a division of Anthropic, already on the org list.",
};

// A previously active org now showing no activity for 8 months.
const staleOrgProposal = {
  action: "tier-change",
  orgName: "InactiveAI Corp",
  currentTier: "tier2",
  proposedTier: "tier1-committed",
  rationale: "Strong historical signal. No recent activity data available.",
  lastKnownActivity: "2024-02-01",
};

describe("Org List Gatekeeper eval 1: strong multi-signal org → add recommendation", () => {
  it("recommends adding a well-evidenced org", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, strongOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.recommendation).toBe("add");
  });

  it("assigns a tier for an add recommendation", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, strongOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.recommendedTier).not.toBeNull();
  });

  it("lists sources reviewed", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, strongOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.sourcesReviewed.length).toBeGreaterThan(0);
  });
});

describe("Org List Gatekeeper eval 2: weak signals org → no-action", () => {
  it("recommends no-action for an org with minimal signals", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, weakOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.recommendation).toBe("no-action");
  });

  it("provides justification for no-action", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, weakOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.justification.length).toBeGreaterThan(0);
  });
});

describe("Org List Gatekeeper eval 3: affiliate of existing member → independence check fails", () => {
  it("flags independence failure for an affiliate org", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, affiliateOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.independenceVerified).toBe(false);
  });

  it("does not recommend adding a non-independent org", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, affiliateOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.recommendation).not.toBe("add");
  });
});

describe("Org List Gatekeeper eval 4: org with no recent activity → recency flag", () => {
  it("flags recency failure for an org with no recent activity", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, staleOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.recentActivityVerified).toBe(false);
  });

  it("does not recommend tier upgrade for a stale org", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, staleOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.recommendation).not.toBe("tier-change");
  });
});

describe("Org List Gatekeeper eval 5: second pass responds to human override", () => {
  it("populates secondPassFindings on second pass", async () => {
    const output = await callOrgListGatekeeperAgent(
      SEED_ORG_LIST,
      strongOrgProposal,
      DEFAULT_PROVIDER_CONFIGS.skeptic,
      { humanOverrideReasoning: "We have a direct relationship with this org and know their internal agentic engineering depth exceeds what is publicly visible." },
    );
    expect(output.isSecondPass).toBe(true);
    expect(output.secondPassFindings).toBeTruthy();
  });
});

describe("Org List Gatekeeper eval 6: output contract always satisfied", () => {
  it("signalAnalysis always covers all four signals", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, strongOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.signalAnalysis.engineeringPublications).toBeDefined();
    expect(output.signalAnalysis.openSourceTooling).toBeDefined();
    expect(output.signalAnalysis.platformOfferings).toBeDefined();
  });

  it("orgName matches the proposed org", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, strongOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.orgName).toBe("Cohere");
  });

  it("justification is always populated", async () => {
    const output = await callOrgListGatekeeperAgent(SEED_ORG_LIST, weakOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.justification.length).toBeGreaterThan(0);
  });
});
