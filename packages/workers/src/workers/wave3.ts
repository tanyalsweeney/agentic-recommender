import type { Job } from "bullmq";
import { callSkepticAgent } from "@agent12/agents";
import { runAgent } from "../runner.js";
import type { Db } from "../db.js";

const MAX_CYCLES = 4;

// Wave 3: The Skeptic challenges all upstream outputs.
// Runs up to 4 cycles. Exits early if no concerns rise to Advisory tier or above.
export async function processWave3Job(
  job: Job,
  db: Db,
  allUpstreamOutputs: { wave1: unknown; wave2: unknown; cv: unknown },
  upstreamCheckpointVersions: Record<string, string>
): Promise<{ output: unknown; checkpointVersion: string; cyclesUsed: number }> {
  const { runId, tenantId } = job.data as { runId: string; tenantId?: string };

  let lastResult: { output: unknown; checkpointVersion: string } | null = null;
  let cyclesUsed = 0;

  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    const result = await runAgent({
      db, runId, tenantId,
      agentKey: "skeptic",
      checkpointName: `skeptic_cycle${cycle}`,
      wave: "3",
      upstreamHashes: {
        ...upstreamCheckpointVersions,
        ...(lastResult ? { skeptic_prev: lastResult.checkpointVersion } : {}),
      },
      upstreamOutputs: {
        ...allUpstreamOutputs,
        skepticPreviousCycle: lastResult?.output ?? null,
      },
      callAgent: (m, c, p) => callSkepticAgent(m, c, allUpstreamOutputs as { wave1: unknown; wave2: unknown; cv: unknown }, p),
    });

    lastResult = result;
    cyclesUsed = cycle;

    const output = result.output as { earlyExit?: boolean };
    if (output.earlyExit) break;
  }

  return {
    output: lastResult!.output,
    checkpointVersion: lastResult!.checkpointVersion,
    cyclesUsed,
  };
}
