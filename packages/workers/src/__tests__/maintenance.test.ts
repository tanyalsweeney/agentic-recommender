import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getTestDb } from "./test-db.js";
import { manifestTools, manifestProposals, config } from "@agent12/shared";
import type { ManifestGatekeeperOutput } from "@agent12/agents";
import {
  getStaleManifestTools,
  processManifestProposal,
} from "../maintenance/proposals.js";
import { uuidv7 } from "uuidv7";

// ── helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function uniqueToolName(prefix: string) {
  return `${prefix}-${uuidv7()}`;
}

function baseTool(toolName: string) {
  return {
    toolName,
    maturityTier: "Established" as const,
    confidenceScore: 8,
    adoptionSignals: {},
    maintenanceSignals: {},
    vetted: true,
    owner: "global",
  };
}

function baseProposal(toolName: string) {
  return {
    toolName,
    proposedEntry: { toolName, confidenceScore: 9 },
    proposingAgent: "manifest_refresh",
    status: "pending",
    cycleCount: 0,
  };
}

function makeGatekeeper(
  decision: ManifestGatekeeperOutput["decision"],
  overrides: Partial<ManifestGatekeeperOutput> = {}
): () => Promise<ManifestGatekeeperOutput> {
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

const THRESHOLD_CONFIG_KEY = "manifest.tier1.refresh_threshold_days";

async function seedThreshold(db: ReturnType<typeof getTestDb>, days: string) {
  await db
    .insert(config)
    .values({ key: THRESHOLD_CONFIG_KEY, value: days, owner: "global" })
    .onConflictDoUpdate({
      target: [config.key, config.owner],
      set: { value: days },
    });
}

// ── staleness check ───────────────────────────────────────────────────────────

// TODO: day values in these tests (e.g. daysAgo(21), daysAgo(7)) are hardcoded
// relative to the seeded 14-day threshold. Refactor to read the seeded threshold
// from the config table at test time and derive day values from it, so tests
// remain correct if the default threshold is changed in config.

describe("getStaleManifestTools", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdToolNames: string[] = [];

  beforeEach(async () => {
    db = getTestDb();
    createdToolNames.length = 0;
    await seedThreshold(db, "14");
  });

  afterEach(async () => {
    if (createdToolNames.length > 0) {
      await db.delete(manifestTools).where(inArray(manifestTools.toolName, createdToolNames));
    }
  });

  it("flags a tool last refreshed 21 days ago", async () => {
    const name = uniqueToolName("stale");
    createdToolNames.push(name);
    await db.insert(manifestTools).values({ ...baseTool(name), lastRefreshedAt: daysAgo(21) });
    const stale = await getStaleManifestTools(db as any);
    expect(stale.map(t => t.toolName)).toContain(name);
  });

  it("does not flag a tool last refreshed 7 days ago", async () => {
    const name = uniqueToolName("fresh");
    createdToolNames.push(name);
    await db.insert(manifestTools).values({ ...baseTool(name), lastRefreshedAt: daysAgo(7) });
    const stale = await getStaleManifestTools(db as any);
    expect(stale.map(t => t.toolName)).not.toContain(name);
  });

  it("flags a tool that has never been refreshed (null lastRefreshedAt)", async () => {
    const name = uniqueToolName("never-refreshed");
    createdToolNames.push(name);
    await db.insert(manifestTools).values({ ...baseTool(name), lastRefreshedAt: null });
    const stale = await getStaleManifestTools(db as any);
    expect(stale.map(t => t.toolName)).toContain(name);
  });

  it("respects a custom threshold from config", async () => {
    await seedThreshold(db, "30");
    const name = uniqueToolName("borderline");
    createdToolNames.push(name);
    await db.insert(manifestTools).values({ ...baseTool(name), lastRefreshedAt: daysAgo(21) });
    const stale = await getStaleManifestTools(db as any);
    // 21 days < 30-day threshold — should NOT be stale
    expect(stale.map(t => t.toolName)).not.toContain(name);
  });
});

// ── proposal processing ───────────────────────────────────────────────────────

describe("processManifestProposal", () => {
  let db: ReturnType<typeof getTestDb>;
  const createdToolNames: string[] = [];
  const createdProposalIds: string[] = [];

  beforeEach(async () => {
    db = getTestDb();
    createdToolNames.length = 0;
    createdProposalIds.length = 0;
  });

  afterEach(async () => {
    if (createdProposalIds.length > 0) {
      await db.delete(manifestProposals).where(inArray(manifestProposals.id, createdProposalIds));
    }
    if (createdToolNames.length > 0) {
      await db.delete(manifestTools).where(inArray(manifestTools.toolName, createdToolNames));
    }
  });

  it("accepted decision: updates proposal status to approved", async () => {
    const name = uniqueToolName("tool");
    createdToolNames.push(name);
    await db.insert(manifestTools).values(baseTool(name));
    const [proposal] = await db.insert(manifestProposals).values(baseProposal(name)).returning();
    createdProposalIds.push(proposal.id);

    await processManifestProposal(db as any, proposal.id, makeGatekeeper("accepted"));

    const updated = await db.select().from(manifestProposals).where(eq(manifestProposals.id, proposal.id)).limit(1);
    expect(updated[0].status).toBe("approved");
    expect(updated[0].gatekeeperFindings).toBeTruthy();
  });

  it("accepted decision: updates manifest tool confidence score", async () => {
    const name = uniqueToolName("tool");
    createdToolNames.push(name);
    await db.insert(manifestTools).values({ ...baseTool(name), confidenceScore: 7 });
    const [proposal] = await db.insert(manifestProposals).values(baseProposal(name)).returning();
    createdProposalIds.push(proposal.id);

    await processManifestProposal(db as any, proposal.id, makeGatekeeper("accepted", {
      confidenceScoreRecommendation: 9,
    }));

    const tool = await db.select().from(manifestTools).where(eq(manifestTools.toolName, name)).limit(1);
    expect(tool[0].confidenceScore).toBe(9);
  });

  it("rejected decision: marks proposal rejected without affecting other manifest entries", async () => {
    const nameA = uniqueToolName("tool-a");
    const nameB = uniqueToolName("tool-b");
    createdToolNames.push(nameA, nameB);
    await db.insert(manifestTools).values([baseTool(nameA), { ...baseTool(nameB), confidenceScore: 7 }]);
    const [proposalA] = await db.insert(manifestProposals).values(baseProposal(nameA)).returning();
    const [proposalB] = await db.insert(manifestProposals).values({ ...baseProposal(nameB), status: "approved" }).returning();
    createdProposalIds.push(proposalA.id, proposalB.id);

    await processManifestProposal(db as any, proposalA.id, makeGatekeeper("rejected"));

    const rejectedProposal = await db.select().from(manifestProposals).where(eq(manifestProposals.id, proposalA.id)).limit(1);
    expect(rejectedProposal[0].status).toBe("rejected");

    const toolB = await db.select().from(manifestTools).where(eq(manifestTools.toolName, nameB)).limit(1);
    expect(toolB[0].confidenceScore).toBe(7);
  });

  it("escalated decision: sets status to escalated and stores findings", async () => {
    const name = uniqueToolName("tool");
    createdToolNames.push(name);
    await db.insert(manifestTools).values(baseTool(name));
    const [proposal] = await db.insert(manifestProposals).values(baseProposal(name)).returning();
    createdProposalIds.push(proposal.id);

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
    const name = uniqueToolName("tool");
    createdToolNames.push(name);
    await db.insert(manifestTools).values(baseTool(name));
    const [proposal] = await db.insert(manifestProposals).values({ ...baseProposal(name), cycleCount: 0 }).returning();
    createdProposalIds.push(proposal.id);

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
    const name = uniqueToolName("tool");
    createdToolNames.push(name);
    await db.insert(manifestTools).values(baseTool(name));
    const [proposal] = await db.insert(manifestProposals).values({ ...baseProposal(name), cycleCount: 0 }).returning();
    createdProposalIds.push(proposal.id);

    await processManifestProposal(db as any, proposal.id, makeGatekeeper("needs_more_cycles"));

    const updated = await db.select().from(manifestProposals).where(eq(manifestProposals.id, proposal.id)).limit(1);
    expect(updated[0].status).toBe("rejected");
    expect(updated[0].cycleCount).toBe(2);
  });
});
