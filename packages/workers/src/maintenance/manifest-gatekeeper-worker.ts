import type { Job } from "bullmq";
import { callManifestGatekeeperAgent, DEFAULT_PROVIDER_CONFIGS } from "@agent12/agents";
import { fetchManifest } from "../manifest.js";
import { getApiKey } from "../key-resolution.js";
import { processManifestProposal } from "./proposals.js";
import type { Db } from "../db.js";

export async function processManifestGatekeeperJob(job: Job, db: Db): Promise<void> {
  const { proposalId } = job.data as { proposalId: string };

  const { manifest } = await fetchManifest(db);
  const providerConfig = DEFAULT_PROVIDER_CONFIGS.manifestGatekeeper!;
  // Maintenance jobs are not user- or tenant-scoped — system env var is the only key source.
  const apiKey = await getApiKey(db as unknown as Parameters<typeof getApiKey>[0], providerConfig.provider, undefined, undefined);

  let priorFindings: unknown = undefined;

  await processManifestProposal(db, proposalId, async (proposedEntry) => {
    const result = await callManifestGatekeeperAgent(
      manifest,
      proposedEntry,
      providerConfig,
      apiKey,
      priorFindings,
    );
    priorFindings = result.findings;
    return result;
  });
}
