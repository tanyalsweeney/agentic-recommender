import { Worker, FlowProducer } from "bullmq";
import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { runs } from "@agent12/shared";
import { db } from "./db.js";
import { processWave1Job } from "./workers/wave1.js";
import { processWave2Job } from "./workers/wave2.js";
import { processWave2_5Job } from "./workers/wave2_5.js";
import { processWave3Job } from "./workers/wave3.js";
import { processPass1Job } from "./workers/pass1.js";
import { buildPipelineFlowSpec } from "./flows/pipeline.js";
import { injectTenantContext } from "./tenant-context.js";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
};

// Dispatcher: one worker processes all pipeline jobs, routing by job name.
async function processJob(job: Job): Promise<unknown> {
  // Wave 1 jobs: no upstream dependencies, run independently
  if (job.name.startsWith("wave1.")) {
    return processWave1Job(job, db);
  }

  // All jobs below this point receive child results from BullMQ
  const childrenValues = await job.getChildrenValues();

  if (job.name === "wave2.cooperative") {
    const wave1Keys = ["wave1.orchestration", "wave1.security", "wave1.memory_state", "wave1.tool_integration"];
    const wave1Results = Object.fromEntries(
      wave1Keys.map((k) => {
        const key = k.replace("wave1.", "");
        const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        return [camel, (childrenValues[k] as { output: unknown })?.output];
      })
    );
    const wave1Versions = Object.fromEntries(
      wave1Keys.map((k) => [k.replace("wave1.", ""), (childrenValues[k] as { checkpointVersion: string })?.checkpointVersion])
    );
    return processWave2Job(job, db, wave1Results as never, wave1Versions);
  }

  if (job.name === "wave2_5.compatibility_validator") {
    const wave2 = childrenValues["wave2.cooperative"] as { fAndO: unknown; trustControl: unknown; checkpointVersions: Record<string, string> };
    return processWave2_5Job(job, db, {}, { fAndO: wave2.fAndO, trustControl: wave2.trustControl }, wave2.checkpointVersions);
  }

  if (job.name === "wave3.skeptic") {
    const cv = childrenValues["wave2_5.compatibility_validator"] as { output: unknown; checkpointVersion: string };
    const wave2 = childrenValues["wave2.cooperative"] as { fAndO: unknown; trustControl: unknown };
    return processWave3Job(job, db, { wave1: {}, wave2: { fAndO: wave2.fAndO, trustControl: wave2.trustControl }, cv: cv.output }, { cv: cv.checkpointVersion });
  }

  if (job.name === "pass1.technical_writer") {
    const skeptic = childrenValues["wave3.skeptic"] as { output: unknown; checkpointVersion: string };
    const cv = childrenValues["wave2_5.compatibility_validator"] as { output: unknown };
    const wave2 = childrenValues["wave2.cooperative"] as { fAndO: unknown; trustControl: unknown };
    const output = await processPass1Job(
      job, db,
      { wave1: {}, wave2: { fAndO: wave2.fAndO, trustControl: wave2.trustControl }, cv: cv.output, skeptic: skeptic.output },
      { skeptic: skeptic.checkpointVersion }
    );

    // Write Pass 1 output back to the runs table
    await db.update(runs)
      .set({ pass1Output: output.output as never, status: "completed", completedAt: new Date() })
      .where(eq(runs.id, job.data.runId));

    return output;
  }

  throw new Error(`Unknown job name: ${job.name}`);
}

export function createWorker() {
  return new Worker("pipeline", processJob, { connection });
}

export async function submitRun(runId: string, tenantId?: string): Promise<void> {
  // Inject tenant context before submitting — merges into verifiedContext in DB
  // and returns the version for checkpoint upstream hash tracking.
  const tenantContextVersion = await injectTenantContext(db, runId, tenantId);

  const flowProducer = new FlowProducer({ connection });
  const spec = buildPipelineFlowSpec(runId, tenantId, tenantContextVersion ?? undefined);
  await flowProducer.add(spec as never);
}
