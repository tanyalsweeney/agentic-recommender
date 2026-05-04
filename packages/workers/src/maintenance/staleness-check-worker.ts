import type { Job } from "bullmq";
import { eq, and } from "drizzle-orm";
import { manifestProposals } from "@agent12/shared";
import { getStaleManifestTools } from "./proposals.js";
import { submitManifestGatekeeperRun } from "./queue.js";
import type { Db } from "../db.js";

// Finds all stale manifest tools and queues a Gatekeeper run for each.
// Skips tools that already have a pending proposal to avoid duplicate reviews.
// The proposed entry is the tool's current manifest data — the Gatekeeper
// re-validates it against live sources and proposes any needed updates.

export async function processStalenessCheckJob(_job: Job, db: Db): Promise<void> {
  const staleTools = await getStaleManifestTools(db);
  if (staleTools.length === 0) return;

  // Find tools that already have a pending proposal to avoid duplicates
  const pendingProposals = await db
    .select({ toolName: manifestProposals.toolName })
    .from(manifestProposals)
    .where(eq(manifestProposals.status, "pending"));

  const pendingToolNames = new Set(pendingProposals.map(p => p.toolName));

  for (const tool of staleTools) {
    if (pendingToolNames.has(tool.toolName)) continue;

    const [proposal] = await db
      .insert(manifestProposals)
      .values({
        toolName: tool.toolName,
        proposedEntry: tool as unknown as Record<string, unknown>,
        proposingAgent: "staleness_check",
        status: "pending",
        cycleCount: 0,
      })
      .returning();

    await submitManifestGatekeeperRun(proposal.id);
  }
}
