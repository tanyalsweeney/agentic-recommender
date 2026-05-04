import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { callOrgListGatekeeperAgent, DEFAULT_PROVIDER_CONFIGS } from "@agent12/agents";
import { orgList, orgListProposals } from "@agent12/shared";
import type { Db } from "../db.js";

// The Org List Gatekeeper researches a proposed org change and stores its
// findings on the proposal. It does not apply changes to org_list — all
// org list modifications require explicit human approval via the admin dashboard.

export async function processOrgListGatekeeperJob(job: Job, db: Db): Promise<void> {
  const { proposalId } = job.data as { proposalId: string };

  const proposalRows = await db
    .select()
    .from(orgListProposals)
    .where(eq(orgListProposals.id, proposalId))
    .limit(1);

  if (!proposalRows[0]) throw new Error(`Org list proposal ${proposalId} not found`);
  const proposal = proposalRows[0];

  const currentOrgList = await db.select().from(orgList);

  const providerConfig = DEFAULT_PROVIDER_CONFIGS.orgListGatekeeper!;

  const result = await callOrgListGatekeeperAgent(
    currentOrgList,
    {
      action: proposal.action,
      orgId: proposal.orgId,
      justification: proposal.justification,
      sources: proposal.sources,
    },
    providerConfig,
  );

  // Store gatekeeper findings on the proposal — human approval still required.
  await db
    .update(orgListProposals)
    .set({
      justification: result.justification,
      sources: result.sourcesReviewed as unknown as typeof proposal.sources,
      secondPassFindings: result.isSecondPass
        ? ({ recommendation: result.recommendation, signalAnalysis: result.signalAnalysis, findings: result.secondPassFindings } as unknown as typeof proposal.secondPassFindings)
        : undefined,
    })
    .where(eq(orgListProposals.id, proposalId));
}
