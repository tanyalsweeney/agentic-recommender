import type { Job } from "bullmq";
import { callCompatibilityValidator } from "@agent12/agents";
import { runAgent } from "../runner.js";
import type { Db } from "../db.js";

export async function processWave2_5Job(
  job: Job,
  db: Db,
  wave1Results: unknown,
  wave2Results: unknown,
  upstreamCheckpointVersions: Record<string, string>
): Promise<{ output: unknown; checkpointVersion: string }> {
  const { runId, tenantId } = job.data as { runId: string; tenantId?: string };

  const result = await runAgent({
    db, runId, tenantId,
    agentKey: "compatibility_validator",
    wave: "2_5",
    upstreamHashes: upstreamCheckpointVersions,
    upstreamOutputs: { wave1: wave1Results, wave2: wave2Results },
    callAgent: (m, c, p, u) => callCompatibilityValidator(m, c, u as { wave1: unknown; wave2: unknown }, p),
  });

  return { output: result.output, checkpointVersion: result.checkpointVersion };
}
