import type { Job } from "bullmq";
import {
  callFailureObservabilityAgent,
  callTrustControlAgent,
} from "@agent12/agents";
import { runAgent } from "../runner.js";
import type { Db } from "../db.js";

// Wave 2: cooperative exchange between F&O and Trust & Control.
// Cycle 1: F&O runs → T&C runs with F&O output.
// Cycle 2: F&O runs again with T&C gate placements (confirmationOfGateCoverage).
// Cap: 2 cycles. Unresolved tensions passed to Skeptic via job return value.
export async function processWave2Job(
  job: Job,
  db: Db,
  wave1Results: { orchestration: unknown; security: unknown; memoryState: unknown; toolIntegration: unknown },
  wave1CheckpointVersions: Record<string, string>
): Promise<{ fAndO: unknown; trustControl: unknown; unresolvedTensions: string[]; checkpointVersions: Record<string, string> }> {
  const { runId, tenantId } = job.data as { runId: string; tenantId?: string };

  const upstreamHashes = wave1CheckpointVersions;
  const wave1Outputs = { wave1: wave1Results };

  // Cycle 1: F&O
  const foResult = await runAgent({
    db, runId, tenantId,
    agentKey: "failure_observability",
    wave: "2",
    upstreamHashes,
    upstreamOutputs: wave1Outputs,
    callAgent: (m, c, p) => callFailureObservabilityAgent(m, c, p as never),
  });

  // Cycle 1: T&C (receives F&O output)
  const tcResult = await runAgent({
    db, runId, tenantId,
    agentKey: "trust_control",
    wave: "2",
    upstreamHashes: { ...upstreamHashes, failure_observability: foResult.checkpointVersion },
    upstreamOutputs: { wave1: wave1Results, failureObservability: foResult.output },
    callAgent: (m, c, p) => callTrustControlAgent(m, c, p as never),
  });

  const tc = tcResult.output as { unresolvedTensions?: string[] };

  // Cycle 2: F&O confirms gate coverage if T&C produced gate placements
  const foCycle2Result = await runAgent({
    db, runId, tenantId,
    agentKey: "failure_observability_cycle2",
    wave: "2",
    upstreamHashes: {
      ...upstreamHashes,
      trust_control: tcResult.checkpointVersion,
    },
    upstreamOutputs: { wave1: wave1Results, trustControl: tcResult.output },
    callAgent: (m, c, p) => callFailureObservabilityAgent(m, c, p as never),
  });

  return {
    fAndO: foCycle2Result.output,
    trustControl: tcResult.output,
    unresolvedTensions: tc.unresolvedTensions ?? [],
    checkpointVersions: {
      failure_observability: foCycle2Result.checkpointVersion,
      trust_control: tcResult.checkpointVersion,
    },
  };
}
