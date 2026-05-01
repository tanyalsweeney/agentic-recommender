import type { Job } from "bullmq";
import {
  callFailureObservabilityAgent,
  callTrustControlAgent,
} from "@agent12/agents";
import type { FailureObservabilityAgentOutput } from "@agent12/agents";
import { runAgent } from "../runner.js";
import type { Db } from "../db.js";

// Wave 2: cooperative exchange between Failure & Observability and Trust & Control.
//
// Up to two full cycles. One cycle = F&O analysis + T&C gate placement + F&O coverage check.
// Early exit after cycle 1 if F&O confirms all risks are covered (uncoveredRisks is empty).
// If uncoveredRisks is non-empty after cycle 1, T&C gets a second pass to address them.
// Any risks still uncovered after cycle 2 are passed to The Skeptic as unresolvedTensions.

export async function processWave2Job(
  job: Job,
  db: Db,
  wave1Results: { orchestration: unknown; security: unknown; memoryState: unknown; toolIntegration: unknown },
  wave1CheckpointVersions: Record<string, string>
): Promise<{
  fAndO: unknown;
  trustControl: unknown;
  unresolvedTensions: string[];
  checkpointVersions: Record<string, string>;
}> {
  const { runId, tenantId } = job.data as { runId: string; tenantId?: string };
  const wave1Outputs = { wave1: wave1Results };

  // ── Cycle 1 ────────────────────────────────────────────────────────────────

  const failureObservabilityInitialAnalysis = await runAgent({
    db, runId, tenantId,
    agentKey: "failureObservability",
    checkpointName: "failureObservabilityInitialAnalysis",
    wave: "2",
    upstreamHashes: wave1CheckpointVersions,
    upstreamOutputs: wave1Outputs,
    callAgent: (m, c, p) => callFailureObservabilityAgent(m, c, p),
  });

  const trustControlInitialGatePlacement = await runAgent({
    db, runId, tenantId,
    agentKey: "trustControl",
    checkpointName: "trustControlInitialGatePlacement",
    wave: "2",
    upstreamHashes: {
      ...wave1CheckpointVersions,
      failureObservabilityInitialAnalysis: failureObservabilityInitialAnalysis.checkpointVersion,
    },
    upstreamOutputs: { wave1: wave1Results, failureObservability: failureObservabilityInitialAnalysis.output },
    callAgent: (m, c, p, u) => callTrustControlAgent(m, c, u as { failureObservability: unknown }, p),
  });

  const failureObservabilityGateCoverageCheck = await runAgent({
    db, runId, tenantId,
    agentKey: "failureObservability",
    checkpointName: "failureObservabilityGateCoverageCheck",
    wave: "2",
    upstreamHashes: {
      ...wave1CheckpointVersions,
      trustControlInitialGatePlacement: trustControlInitialGatePlacement.checkpointVersion,
    },
    upstreamOutputs: { wave1: wave1Results, trustControl: trustControlInitialGatePlacement.output },
    callAgent: (m, c, p) => callFailureObservabilityAgent(m, c, p),
  });

  const coverageCheck = failureObservabilityGateCoverageCheck.output as FailureObservabilityAgentOutput;

  // Early exit: T&C's initial gate placement addressed all identified risks.
  if (!coverageCheck.uncoveredRisks || coverageCheck.uncoveredRisks.length === 0) {
    return {
      fAndO: failureObservabilityGateCoverageCheck.output,
      trustControl: trustControlInitialGatePlacement.output,
      unresolvedTensions: [],
      checkpointVersions: {
        failureObservability: failureObservabilityGateCoverageCheck.checkpointVersion,
        trustControl: trustControlInitialGatePlacement.checkpointVersion,
      },
    };
  }

  // ── Cycle 2 ────────────────────────────────────────────────────────────────
  // F&O found uncovered risks. T&C gets a second pass to address them.

  const trustControlGateRefinement = await runAgent({
    db, runId, tenantId,
    agentKey: "trustControl",
    checkpointName: "trustControlGateRefinement",
    wave: "2",
    upstreamHashes: {
      ...wave1CheckpointVersions,
      failureObservabilityGateCoverageCheck: failureObservabilityGateCoverageCheck.checkpointVersion,
    },
    upstreamOutputs: {
      wave1: wave1Results,
      failureObservability: failureObservabilityGateCoverageCheck.output,
    },
    callAgent: (m, c, p, u) => callTrustControlAgent(m, c, u as { failureObservability: unknown }, p),
  });

  const failureObservabilityFinalConfirmation = await runAgent({
    db, runId, tenantId,
    agentKey: "failureObservability",
    checkpointName: "failureObservabilityFinalConfirmation",
    wave: "2",
    upstreamHashes: {
      ...wave1CheckpointVersions,
      trustControlGateRefinement: trustControlGateRefinement.checkpointVersion,
    },
    upstreamOutputs: { wave1: wave1Results, trustControl: trustControlGateRefinement.output },
    callAgent: (m, c, p) => callFailureObservabilityAgent(m, c, p),
  });

  const finalConfirmation = failureObservabilityFinalConfirmation.output as FailureObservabilityAgentOutput;

  return {
    fAndO: failureObservabilityFinalConfirmation.output,
    trustControl: trustControlGateRefinement.output,
    unresolvedTensions: finalConfirmation.uncoveredRisks ?? [],
    checkpointVersions: {
      failureObservability: failureObservabilityFinalConfirmation.checkpointVersion,
      trustControl: trustControlGateRefinement.checkpointVersion,
    },
  };
}
