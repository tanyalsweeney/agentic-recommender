import { describe, it, expect } from "vitest";
import { callManifestGatekeeperAgent } from "@agent12/agents";
import { DEFAULT_PROVIDER_CONFIGS, SEED_MANIFEST } from "../helpers.js";

// A well-evidenced, actively maintained tool with genuine independent adoption.
const solidEntry = {
  toolName: "temporal",
  category: "workflow-orchestration",
  description: "Durable workflow orchestration platform with native support for long-running, fault-tolerant agent workflows.",
  deploymentModel: "managed_cloud",
  minimumRuntimeRequirements: { sdk: "go, java, typescript, python", minVersion: null },
  knownConstraints: ["Requires a Temporal server (managed or self-hosted) — not a zero-infra solution", "Local activity timeouts must be tuned per workload — defaults are conservative"],
  adoptionSignals: {
    organizations: ["Stripe", "Snap", "Netflix", "Coinbase"],
    recentPublications: ["Stripe engineering blog: Temporal at scale (2024)", "Netflix tech blog: async workflow orchestration (2023)"],
  },
  maintenanceSignals: {
    lastCommit: "2024-11-01",
    lastRelease: "2024-10-15",
    vendorSupportStatement: "Temporal Cloud SLA and support tiers published at temporal.io/pricing",
  },
  domainKnowledgePayload: null,
};

// A tool with fabricated signals — vendor self-adoption and no real independent usage.
const inflatedEntry = {
  toolName: "acme-agent-framework",
  category: "orchestration-framework",
  description: "Enterprise agentic orchestration framework by Acme Corp.",
  deploymentModel: "self_hosted",
  minimumRuntimeRequirements: { language: "java", minVersion: "17" },
  knownConstraints: null,
  adoptionSignals: {
    organizations: ["Acme Corp", "Acme Labs", "Acme Ventures"],
    recentPublications: ["Acme Corp blog: introducing acme-agent-framework (2024)"],
  },
  maintenanceSignals: {
    lastCommit: "2024-09-01",
    lastRelease: "2024-09-01",
    vendorSupportStatement: null,
  },
  domainKnowledgePayload: null,
};

// A tool that requires a schema change to represent correctly.
const schemaChangeEntry = {
  toolName: "some-tool",
  category: "orchestration-framework",
  description: "A tool that needs a new top-level field: 'multiRegionSupport' boolean.",
  proposedSchemaChange: "Add multiRegionSupport: boolean to manifest_tools",
  deploymentModel: "managed_cloud",
  minimumRuntimeRequirements: null,
  knownConstraints: null,
  adoptionSignals: { organizations: ["Google", "Microsoft"], recentPublications: [] },
  maintenanceSignals: { lastCommit: "2024-10-01", lastRelease: "2024-09-01", vendorSupportStatement: "Enterprise support available" },
  domainKnowledgePayload: null,
};

// An abandoned tool — last commit over a year ago, no recent release.
const abandonedEntry = {
  toolName: "legacy-agent-kit",
  category: "orchestration-framework",
  description: "Agent orchestration toolkit, no longer actively maintained.",
  deploymentModel: "self_hosted",
  minimumRuntimeRequirements: { language: "python", minVersion: "3.8" },
  knownConstraints: null,
  adoptionSignals: {
    organizations: ["Some Startup (acquired 2022)"],
    recentPublications: [],
  },
  maintenanceSignals: {
    lastCommit: "2023-01-15",
    lastRelease: "2022-11-01",
    vendorSupportStatement: null,
  },
  domainKnowledgePayload: null,
};

describe("Manifest Gatekeeper eval 1: solid entry with genuine independent adoption → accepted", () => {
  it("accepts a well-evidenced entry", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, solidEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.decision).toBe("accepted");
  });

  it("recommends a confidence score for an accepted entry", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, solidEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.confidenceScoreRecommendation).not.toBeNull();
    expect(output.confidenceScoreRecommendation).toBeGreaterThanOrEqual(6);
  });

  it("recommends a maturity tier for an accepted entry", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, solidEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(["Established", "Emerging"]).toContain(output.maturityTierRecommendation);
  });
});

describe("Manifest Gatekeeper eval 2: vendor self-adoption only → rejected", () => {
  it("rejects an entry with no independent adoption signals", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, inflatedEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.decision).toBe("rejected");
  });

  it("surfaces a quality finding citing adoption signal failure", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, inflatedEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    const hasQualityFinding = output.findings.some(f => f.type === "quality");
    expect(hasQualityFinding).toBe(true);
  });
});

describe("Manifest Gatekeeper eval 3: proposed schema change → escalated", () => {
  it("escalates when a schema change is required", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, schemaChangeEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.decision).toBe("escalated");
  });

  it("populates escalationReason for an escalated entry", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, schemaChangeEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.escalationReason).toBeTruthy();
  });

  it("surfaces a schema finding", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, schemaChangeEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    const hasSchemaFinding = output.findings.some(f => f.type === "schema");
    expect(hasSchemaFinding).toBe(true);
  });
});

describe("Manifest Gatekeeper eval 4: abandoned tool failing maintenance signals → rejected", () => {
  it("rejects a tool with no meaningful maintenance activity", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, abandonedEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.decision).toBe("rejected");
  });

  it("does not recommend a high confidence score for an abandoned tool", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, abandonedEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    if (output.confidenceScoreRecommendation !== null && output.confidenceScoreRecommendation !== undefined) {
      expect(output.confidenceScoreRecommendation).toBeLessThanOrEqual(3);
    }
  });
});

describe("Manifest Gatekeeper eval 5: output contract always satisfied", () => {
  it("cyclesUsed is always 1 or 2", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, solidEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.cyclesUsed).toBeGreaterThanOrEqual(1);
    expect(output.cyclesUsed).toBeLessThanOrEqual(2);
  });

  it("justification is always populated", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, inflatedEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(output.justification.length).toBeGreaterThan(0);
  });

  it("findings array is always present", async () => {
    const output = await callManifestGatekeeperAgent(SEED_MANIFEST, solidEntry, DEFAULT_PROVIDER_CONFIGS.skeptic);
    expect(Array.isArray(output.findings)).toBe(true);
  });
});
