import { afterAll, beforeAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { getTestDb, closeTestDb } from "./test-db.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

beforeAll(async () => {
  const db = getTestDb();
  await migrate(db, {
    migrationsFolder: resolve(__dirname, "../../../shared/drizzle"),
  });
});

afterAll(async () => {
  await closeTestDb();
});
