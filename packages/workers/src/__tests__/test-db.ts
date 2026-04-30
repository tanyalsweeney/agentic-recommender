import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  runs, runCheckpoints, manifestEntries, config,
  users, jobs, orgList,
} from "@agent12/shared";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");

const schema = { runs, runCheckpoints, manifestEntries, config, users, jobs, orgList };

let client: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getTestDb() {
  if (!db) {
    client = postgres(url!);
    db = drizzle(client, { schema });
  }
  return db;
}

export type TestDb = ReturnType<typeof getTestDb>;

export async function closeTestDb() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}
