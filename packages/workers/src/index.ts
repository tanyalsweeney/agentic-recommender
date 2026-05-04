import { db } from "./db.js";
import { seedProviderConfigs } from "./startup.js";
import { createWorker } from "./queues.js";
import { createMaintenanceWorker } from "./maintenance/queue.js";

async function main() {
  console.log("Agent12 workers starting...");

  await seedProviderConfigs(db);
  console.log("Provider configs seeded.");

  const pipelineWorker = createWorker();
  const maintenanceWorker = createMaintenanceWorker();

  pipelineWorker.on("completed", (job) => {
    console.log(`[pipeline][${job.name}] completed (run: ${job.data.runId})`);
  });
  pipelineWorker.on("failed", (job, err) => {
    console.error(`[pipeline][${job?.name}] failed (run: ${job?.data?.runId}):`, err.message);
  });

  maintenanceWorker.on("completed", (job) => {
    console.log(`[maintenance][${job.name}] completed`);
  });
  maintenanceWorker.on("failed", (job, err) => {
    console.error(`[maintenance][${job?.name}] failed:`, err.message);
  });

  console.log("Workers running. Waiting for jobs...");
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
