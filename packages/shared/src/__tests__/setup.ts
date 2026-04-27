import { afterAll, beforeAll } from "vitest";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getTestDb, closeTestDb } from "./test-db.js";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

beforeAll(async () => {
  const db = getTestDb();
  await migrate(db, {
    migrationsFolder: resolve(__dirname, "../../drizzle"),
  });
});

afterAll(async () => {
  await closeTestDb();
});
