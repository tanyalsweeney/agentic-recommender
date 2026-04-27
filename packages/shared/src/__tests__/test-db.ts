import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../db/schema.js";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");

let client: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export function getTestDb() {
  if (!db) {
    client = postgres(url!);
    db = drizzle(client, { schema });
  }
  return db;
}

export async function closeTestDb() {
  if (client) {
    await client.end();
    client = null;
    db = null;
  }
}
