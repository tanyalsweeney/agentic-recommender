import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "./test-db.js";
import { manifestTools, manifestProposals, config } from "@agent12/shared";
import { eq, and } from "drizzle-orm";
import type { ManifestGatekeeperOutput } from "@agent12/agents";
import {
  getStaleManifestTools,
  processManifestProposal,
} from "../maintenance/proposals.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const BASE_TOOL = {
  toolName: "test-tool",
  maturityTier: "Established" as const,
  confidenceScore: 8,
  adoptionSignals: {},
  maintenanceSignals: {},
  vetted: true,
  owner: "global",
};

const BASE_PROPOSAL = {
  toolName: "test-tool",
  proposedEntry: { toolName: "test-tool", confidenceScore: 9 },
  proposingAgent: "manifest_refresh",
  status: "pending",
  cycleCount: 0,
};

function makeGatekeeper(decision: ManifestGatekeeperOutput["decision"], overrides: Partial<ManifestGatekeeperOutput> = {}): () => Promise<ManifestGatekeeperOutput> {
  return async () => ({
    decision,
    cyclesUsed: 1,
    justification: `Mock decision: ${decision}`,
    findings: [],
    confidenceScoreRecommendation: decision === "accepted" ? 9 : null,
    maturityTierRecommendation: decision === "accepted" ? "Established" : null,
    proposedEntryUpdates: null,
    escalationReason: decision === "escalated" ? "Schema change detected" : null,
    ...overrides,
  });
}

// ── staleness check ───────────────────────────────────────────────────────────

describe("getStaleManifestTools", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(manifestTools);
    await db.delete(config);
    // Seed default 14-day staleness threshold
    await db.insert(config).values({ key: "manifest.tier1.refresh_threshold_days", value: "14", owner: "global" });
  });

  it("flags a tool last refreshed 21 days ago", async () => {
    await db.insert(manifestTools).values({ ...BASE_TOOL, toolName: "stale-tool", lastRefreshedAt: daysAgo(21) });
    const stale = await getStaleManifestTools(db as any);
    expect(stale.map(t => t.toolName)).toContain("stale-tool");
  });

  it("does not flag a tool last refreshed 7 days ago", async () => {
    await db.insert(manifestTools).values({ ...BASE_TOOL, toolName: "fresh-tool", lastRefreshedAt: daysAgo(7) });
    const stale = await getStaleManifestTools(db as any);
    expect(stale.map(t => t.toolName)).not.toContain("fresh-tool");
  });

  it("flags a tool that has never been refreshed (null lastRefreshedAt)", async () => {
    await db.insert(manifestTools).values({ ...BASE_TOOL, toolName: "never-refreshed", lastRefreshedAt: null });
    const stale = await getStaleManifestTools(db as any);
    expect(stale.map(t => t.toolName)).toContain("never-refreshed");
  });

  it("respects a custom threshold from config", async () => {
    await db.delete(config);
    await db.insert(config).values({ key: "manifest.tier1.refresh_threshold_days", value: "30", owner: "global" });
    await db.insert(manifestTools).values({ ...BASE_TOOL, toolName: "borderline-tool", lastRefreshedAt: daysAgo(21) });
    const stale = await getStaleManifestTools(db as any);
    // 21 days < 30-day threshold — should NOT be stale
    expect(stale.map(t => t.toolName)).not.toContain("borderline-tool");
  });
});

// ── proposal processing ───────────────────────────────────────────────────────

describe("processManifestProposal", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeEach(async () => {
    db = getTestDb();
    await db.delete(manifestProposals);
    await db.delete(manifestTools);
  });

  it("accepted decision: updates proposal status to approved", async () => {
    await db.insert(manifestTools).values({ ...BASE_TOOL });
    const [proposal] = await db.insert(manifestProposals).values({ ...BASE_PROPOSAL }).returning();

    await processManifestProposal(db as any, proposal.id, makeGatekeeper("accepted"));

    const updated = await db.select().from(manifestProposals).where(eq(manifestProposals.id, proposal.id)).limit(1);
    expect(updated[0].status).toBe("approved");
    expect(updated[0].gatekeeperFindings).toBeTruthy();
  });

  it("accepted decision: updates manifest tool confidence score", async () => {
    await db.insert(manifestTools).values({ ...BASE_TOOL, confidenceScore: 7 });
    const [proposal] = await db.insert(manifestProposals).values({ ...BASE_PROPOSAL }).returning();

    await processManifestProposal(db as any, proposal.id, makeGatekeeper("accepted", {
      confidenceScoreRecommendation: 9,
    }));

    const tool = await db.select().from(manifestTools).where(eq(manifestTools.toolName, "test-tool")).limit(1);
    expect(tool[0].confidenceScore).toBe(9);
  });

  it("rejected decision: marks proposal rejected without affecting other manifest entries", async () => {
    await db.insert(manifestTools).values([
      { ...BASE_TOOL, toolName: "tool-a" },
      { ...BASE_TOOL, toolName: "tool-b", confidenceScore: 7 },
    ]);
    const [proposalA] = await db.insert(manifestProposals).values({ ...BASE_PROPOSAL, toolName: "tool-a" }).returning();
    await db.insert(manifestProposals).values({ ...BASE_PROPOSAL, toolName: "tool-b", status: "approved" });

    await processManifestProposal(db as any, proposalA.id, makeGatekeeper("rejected"));

    const rejectedProposal = await db.select().from(manifestProposals).where(eq(manifestProposals.id, proposalA.id)).limit(1);
    expect(rejectedProposal[0].status).toBe("rejected");

    // tool-b is unaffected
    const toolB = await db.select().from(manifestTools).where(eq(manifestTools.toolName, "tool-b")).limit(1);
    expect(toolB[0].confidenceScore).toBe(7);
  });

  it("escalated decision: sets status to escalated and stores findings", async () => {
    await db.insert(manifestTools).values({ ...BASE_TOOL });
    const [proposal] = await db.insert(manifestProposals).values({ ...BASE_PROPOSAL }).returning();

    await processManifestProposal(db as any, proposal.id, makeGatekeeper("escalated", {
      escalationReason: "Schema change detected: new field 'runtimeTarget' requires migration",
    }));

    const updated = await db.select().from(manifestProposals).where(eq(manifestProposals.id, proposal.id)).limit(1);
    expect(updated[0].status).toBe("escalated");
    expect(updated[0].gatekeeperFindings).toMatchObject({
      escalationReason: expect.stringContaining("Schema change"),
    });
  });

  it("needs_more_cycles: increments cycle count and re-calls gatekeeper", async () => {
    await db.insert(manifestTools).values({ ...BASE_TOOL });
    const [proposal] = await db.insert(manifestProposals).values({ ...BASE_PROPOSAL, cycleCount: 0 }).returning();

    let callCount = 0;
    const gatekeeper = async (): Promise<ManifestGatekeeperOutput> => {
      callCount++;
      return callCount === 1
        ? { decision: "needs_more_cycles", cyclesUsed: 1, justification: "needs more evidence", findings: [], confidenceScoreRecommendation: null, maturityTierRecommendation: null, proposedEntryUpdates: null, escalationReason: null }
        : { decision: "accepted", cyclesUsed: 2, justification: "accepted on cycle 2", findings: [], confidenceScoreRecommendation: 8, maturityTierRecommendation: "Established", proposedEntryUpdates: null, escalationReason: null };
    };

    await processManifestProposal(db as any, proposal.id, gatekeeper);

    expect(callCount).toBe(2);
    const updated = await db.select().from(manifestProposals).where(eq(manifestProposals.id, proposal.id)).limit(1);
    expect(updated[0].status).toBe("approved");
    expect(updated[0].cycleCount).toBe(2);
  });

  it("cycle cap: rejects after 2 needs_more_cycles without resolution", async () => {
    await db.insert(manifestTools).values({ ...BASE_TOOL });
    const [proposal] = await db.insert(manifestProposals).values({ ...BASE_PROPOSAL, cycleCount: 0 }).returning();

    const gatekeeper = makeGatekeeper("needs_more_cycles");

    await processManifestProposal(db as any, proposal.id, gatekeeper);

    const updated = await db.select().from(manifestProposals).where(eq(manifestProposals.id, proposal.id)).limit(1);
    expect(updated[0].status).toBe("rejected");
    expect(updated[0].cycleCount).toBe(2);
  });
});
