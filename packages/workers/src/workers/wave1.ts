import type { Job } from "bullmq";
import {
  callOrchestrationAgent,
  callSecurityAgent,
  callMemoryStateAgent,
  callToolIntegrationAgent,
  type ProviderConfig,
} from "@agent12/agents";
import { runAgent, type RunAgentOpts } from "../runner.js";
import type { Db } from "../db.js";

export interface Wave1Result {
  orchestration: unknown;
  security: unknown;
  memoryState: unknown;
  toolIntegration: unknown;
  checkpointVersions: Record<string, string>;
}

type AgentCallFn = RunAgentOpts["callAgent"];

// Wave 1: four specialist agents run in parallel via BullMQ FlowProducer.
// Each is a separate job — this processor handles all four by job name.
export async function processWave1Job(job: Job, db: Db): Promise<{ output: unknown; checkpointVersion: string }> {
  const { runId, tenantId } = job.data as { runId: string; tenantId?: string };

  const agentMap: Record<string, AgentCallFn> = {
    "wave1.orchestration":    (m, c, p: ProviderConfig) => callOrchestrationAgent(m, c, p),
    "wave1.security":         (m, c, p: ProviderConfig) => callSecurityAgent(m, c, p),
    "wave1.memory_state":     (m, c, p: ProviderConfig) => callMemoryStateAgent(m, c, p),
    "wave1.tool_integration": (m, c, p: ProviderConfig) => callToolIntegrationAgent(m, c, p),
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
    callAgent: callFn,
  });

  return { output: result.output, checkpointVersion: result.checkpointVersion };
}
