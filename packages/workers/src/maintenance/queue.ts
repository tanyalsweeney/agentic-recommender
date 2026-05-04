import { Worker, Queue } from "bullmq";
import type { Job } from "bullmq";
import { db } from "../db.js";
import { processManifestGatekeeperJob } from "./manifest-gatekeeper-worker.js";
import { processOrgListGatekeeperJob } from "./org-list-gatekeeper-worker.js";
import { processStalenessCheckJob } from "./staleness-check-worker.js";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
};

// Separate queue from pipeline — maintenance jobs should not delay user-facing runs.
const QUEUE_NAME = "maintenance";

async function processMaintenanceJob(job: Job): Promise<void> {
  if (job.name === "maintenance.manifest_gatekeeper") {
    return processManifestGatekeeperJob(job, db);
  }
  if (job.name === "maintenance.org_list_gatekeeper") {
    return processOrgListGatekeeperJob(job, db);
  }
  if (job.name === "maintenance.staleness_check") {
    return processStalenessCheckJob(job, db);
  }
  throw new Error(`Unknown maintenance job: ${job.name}`);
}

export function createMaintenanceWorker() {
  return new Worker(QUEUE_NAME, processMaintenanceJob, { connection });
}

export async function submitManifestGatekeeperRun(proposalId: string): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.add("maintenance.manifest_gatekeeper", { proposalId });
  await queue.close();
}

export async function submitOrgListGatekeeperRun(proposalId: string): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.add("maintenance.org_list_gatekeeper", { proposalId });
  await queue.close();
}

export async function submitStalenessCheck(): Promise<void> {
  const queue = new Queue(QUEUE_NAME, { connection });
  await queue.add("maintenance.staleness_check", {});
  await queue.close();
}
