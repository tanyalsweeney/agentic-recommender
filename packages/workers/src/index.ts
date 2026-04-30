import { db } from "./db.js";
import { seedProviderConfigs } from "./startup.js";
import { createWorker } from "./queues.js";

async function main() {
  console.log("Agent12 workers starting...");

  await seedProviderConfigs(db);
  console.log("Provider configs seeded.");

  const worker = createWorker();

  worker.on("completed", (job) => {
    console.log(`[${job.name}] completed (run: ${job.data.runId})`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${job?.name}] failed (run: ${job?.data?.runId}):`, err.message);
  });

  console.log("Workers running. Waiting for jobs...");
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
