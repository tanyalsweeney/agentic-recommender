import type { Job } from "bullmq";
import {
  callOrchestrationAgent,
  callSecurityAgent,
  callMemoryStateAgent,
  callToolIntegrationAgent,
} from "@agent12/agents";
import { runAgent } from "../runner.js";
import type { Db } from "../db.js";

export interface Wave1Result {
  orchestration: unknown;
  security: unknown;
  memoryState: unknown;
  toolIntegration: unknown;
  checkpointVersions: Record<string, string>;
}

// Wave 1: four specialist agents run in parallel via BullMQ FlowProducer.
// Each is a separate job — this processor handles all four by job name.
export async function processWave1Job(job: Job, db: Db): Promise<{ output: unknown; checkpointVersion: string }> {
  const { runId, tenantId } = job.data as { runId: string; tenantId?: string };

  const agentMap: Record<string, (manifest: unknown, context: unknown, config: unknown) => Promise<unknown>> = {
    "wave1.orchestration":    (m, c, p) => callOrchestrationAgent(m, c, p as never),
    "wave1.security":         (m, c, p) => callSecurityAgent(m, c, p as never),
    "wave1.memory_state":     (m, c, p) => callMemoryStateAgent(m, c, p as never),
    "wave1.tool_integration": (m, c, p) => callToolIntegrationAgent(m, c, p as never),
  };

  const agentKeyMap: Record<string, string> = {
    "wave1.orchestration":    "orchestration",
    "wave1.security":         "security",
    "wave1.memory_state":     "memory_state",
    "wave1.tool_integration": "tool_integration",
  };

  const callFn = agentMap[job.name];
  const agentKey = agentKeyMap[job.name];

  if (!callFn || !agentKey) throw new Error(`Unknown Wave 1 job: ${job.name}`);

  const result = await runAgent({
    db,
    runId,
    tenantId,
    agentKey,
    wave: "1",
    upstreamHashes: {},
    callAgent: callFn as never,
  });

  return { output: result.output, checkpointVersion: result.checkpointVersion };
}
