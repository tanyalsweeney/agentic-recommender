import { describe, it, expect, beforeAll } from "vitest";
import { callOrgListGatekeeperAgent } from "@agent12/agents";
import type { OrgListGatekeeperOutput } from "@agent12/agents";
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

// One call per unique input — shared across all assertions for that input.
let strongOutput: OrgListGatekeeperOutput;
let weakOutput: OrgListGatekeeperOutput;
let affiliateOutput: OrgListGatekeeperOutput;
let staleOutput: OrgListGatekeeperOutput;
let secondPassOutput: OrgListGatekeeperOutput;

beforeAll(async () => {
  strongOutput    = await callOrgListGatekeeperAgent(SEED_ORG_LIST, strongOrgProposal,    DEFAULT_PROVIDER_CONFIGS.skeptic);
  weakOutput      = await callOrgListGatekeeperAgent(SEED_ORG_LIST, weakOrgProposal,      DEFAULT_PROVIDER_CONFIGS.skeptic);
  affiliateOutput = await callOrgListGatekeeperAgent(SEED_ORG_LIST, affiliateOrgProposal, DEFAULT_PROVIDER_CONFIGS.skeptic);
  staleOutput     = await callOrgListGatekeeperAgent(SEED_ORG_LIST, staleOrgProposal,     DEFAULT_PROVIDER_CONFIGS.skeptic);
  secondPassOutput = await callOrgListGatekeeperAgent(
    SEED_ORG_LIST,
    strongOrgProposal,
    DEFAULT_PROVIDER_CONFIGS.skeptic,
    { humanOverrideReasoning: "We have a direct relationship with this org and know their internal agentic engineering depth exceeds what is publicly visible." },
  );
}, 1200_000);

describe("Org List Gatekeeper eval 1: strong multi-signal org → add recommendation", () => {
  it("recommends adding a well-evidenced org", () => {
    expect(strongOutput.recommendation).toBe("add");
  });

  it("assigns a tier for an add recommendation", () => {
    expect(strongOutput.recommendedTier).not.toBeNull();
  });

  it("lists sources reviewed", () => {
    expect(strongOutput.sourcesReviewed.length).toBeGreaterThan(0);
  });
});

describe("Org List Gatekeeper eval 2: weak signals org → no-action", () => {
  it("recommends no-action for an org with minimal signals", () => {
    expect(weakOutput.recommendation).toBe("no-action");
  });

  it("provides justification for no-action", () => {
    expect(weakOutput.justification.length).toBeGreaterThan(0);
  });
});

describe("Org List Gatekeeper eval 3: affiliate of existing member → independence check fails", () => {
  it("flags independence failure for an affiliate org", () => {
    expect(affiliateOutput.independenceVerified).toBe(false);
  });

  it("does not recommend adding a non-independent org", () => {
    expect(affiliateOutput.recommendation).not.toBe("add");
  });
});

describe("Org List Gatekeeper eval 4: org with no recent activity → recency flag", () => {
  it("flags recency failure for an org with no recent activity", () => {
    expect(staleOutput.recentActivityVerified).toBe(false);
  });

  it("does not recommend tier upgrade for a stale org", () => {
    expect(staleOutput.recommendation).not.toBe("tier-change");
  });
});

describe("Org List Gatekeeper eval 5: second pass responds to human override", () => {
  it("populates secondPassFindings on second pass", () => {
    expect(secondPassOutput.isSecondPass).toBe(true);
    expect(secondPassOutput.secondPassFindings).toBeTruthy();
  });
});

describe("Org List Gatekeeper eval 6: output contract always satisfied", () => {
  it("signalAnalysis always covers all four signals", () => {
    expect(strongOutput.signalAnalysis.engineeringPublications).toBeDefined();
    expect(strongOutput.signalAnalysis.openSourceTooling).toBeDefined();
    expect(strongOutput.signalAnalysis.platformOfferings).toBeDefined();
  });

  it("orgName matches the proposed org", () => {
    expect(strongOutput.orgName).toBe("Cohere");
  });

  it("justification is always populated", () => {
    expect(weakOutput.justification.length).toBeGreaterThan(0);
  });
});
