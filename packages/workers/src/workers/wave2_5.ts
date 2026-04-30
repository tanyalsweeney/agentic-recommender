import type { Job } from "bullmq";
import { callCompatibilityValidatorAgent } from "@agent12/agents";
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
    callAgent: (m, c, p) => callCompatibilityValidatorAgent(m, c, p as never),
  });

  return { output: result.output, checkpointVersion: result.checkpointVersion };
}
