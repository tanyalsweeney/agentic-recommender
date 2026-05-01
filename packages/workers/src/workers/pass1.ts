import type { Job } from "bullmq";
import { callTechnicalWriterAgent } from "@agent12/agents";
import { runAgent } from "../runner.js";
import type { Db } from "../db.js";

export async function processPass1Job(
  job: Job,
  db: Db,
  allUpstreamOutputs: { wave1: unknown; wave2: unknown; cv: unknown; skeptic: unknown },
  upstreamCheckpointVersions: Record<string, string>
): Promise<{ output: unknown; checkpointVersion: string }> {
  const { runId, tenantId } = job.data as { runId: string; tenantId?: string };

  const result = await runAgent({
    db, runId, tenantId,
    agentKey: "technical_writer",
    wave: "pass1",
    upstreamHashes: upstreamCheckpointVersions,
    upstreamOutputs: allUpstreamOutputs,
    callAgent: (m, c, p) => callTechnicalWriterAgent(m, c, allUpstreamOutputs as { wave1: unknown; wave2: unknown; cv: unknown; skeptic: unknown }, p),
  });

  return { output: result.output, checkpointVersion: result.checkpointVersion };
}
