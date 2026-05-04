import { eq, isNull, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { manifestTools, manifestProposals, config } from "@agent12/shared";
import type { ManifestGatekeeperOutput } from "@agent12/agents";

type Db = PostgresJsDatabase<Record<string, unknown>>;

const DEFAULT_TIER1_REFRESH_THRESHOLD_DAYS = 14;
const GATEKEEPER_CYCLE_CAP = 2;

// ── staleness check ───────────────────────────────────────────────────────────

async function getRefreshThresholdDays(db: Db): Promise<number> {
  const rows = await db
    .select()
    .from(config)
    .where(eq(config.key, "manifest.tier1.refresh_threshold_days"))
    .limit(1);
  return rows[0] ? parseInt(rows[0].value, 10) : DEFAULT_TIER1_REFRESH_THRESHOLD_DAYS;
}

export async function getStaleManifestTools(db: Db) {
  const thresholdDays = await getRefreshThresholdDays(db);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);

  return db
    .select()
    .from(manifestTools)
    .where(
      sql`${manifestTools.lastRefreshedAt} is null or ${manifestTools.lastRefreshedAt} < ${cutoff.toISOString()}`
    );
}

// ── proposal processing ───────────────────────────────────────────────────────

export type GatekeeperCallFn = (proposedEntry: unknown) => Promise<ManifestGatekeeperOutput>;

export async function processManifestProposal(
  db: Db,
  proposalId: string,
  callGatekeeper: GatekeeperCallFn
): Promise<{ status: "approved" | "rejected" | "escalated" }> {
  const rows = await db
    .select()
    .from(manifestProposals)
    .where(eq(manifestProposals.id, proposalId))
    .limit(1);

  if (!rows[0]) throw new Error(`Proposal ${proposalId} not found`);
  let proposal = rows[0];

  let cycleCount = proposal.cycleCount;

  while (cycleCount < GATEKEEPER_CYCLE_CAP) {
    const result = await callGatekeeper(proposal.proposedEntry);
    cycleCount++;

    if (result.decision === "accepted") {
      // Update the manifest tool with Gatekeeper recommendations
      if (result.confidenceScoreRecommendation != null) {
        await db
          .update(manifestTools)
          .set({
            confidenceScore: result.confidenceScoreRecommendation,
            ...(result.maturityTierRecommendation ? { maturityTier: result.maturityTierRecommendation } : {}),
            lastRefreshedAt: new Date(),
          })
          .where(eq(manifestTools.toolName, proposal.toolName));
      }

      await db
        .update(manifestProposals)
        .set({
          status: "approved",
          cycleCount,
          gatekeeperFindings: { decision: result.decision, justification: result.justification, findings: result.findings },
          updatedAt: new Date(),
        })
        .where(eq(manifestProposals.id, proposalId));

      return { status: "approved" };
    }

    if (result.decision === "rejected") {
      await db
        .update(manifestProposals)
        .set({
          status: "rejected",
          cycleCount,
          gatekeeperFindings: { decision: result.decision, justification: result.justification, findings: result.findings },
          updatedAt: new Date(),
        })
        .where(eq(manifestProposals.id, proposalId));

      return { status: "rejected" };
    }

    if (result.decision === "escalated") {
      await db
        .update(manifestProposals)
        .set({
          status: "escalated",
          cycleCount,
          gatekeeperFindings: {
            decision: result.decision,
            justification: result.justification,
            findings: result.findings,
            escalationReason: result.escalationReason,
          },
          updatedAt: new Date(),
        })
        .where(eq(manifestProposals.id, proposalId));

      return { status: "escalated" };
    }

    // needs_more_cycles: update cycle count and loop
    await db
      .update(manifestProposals)
      .set({ cycleCount, updatedAt: new Date() })
      .where(eq(manifestProposals.id, proposalId));
  }

  // Cycle cap reached without resolution — reject
  await db
    .update(manifestProposals)
    .set({
      status: "rejected",
      cycleCount,
      gatekeeperFindings: { decision: "rejected", justification: "Cycle cap reached without resolution" },
      updatedAt: new Date(),
    })
    .where(eq(manifestProposals.id, proposalId));

  return { status: "rejected" };
}
