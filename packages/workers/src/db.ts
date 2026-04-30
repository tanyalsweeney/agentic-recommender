import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  runs, runCheckpoints, manifestEntries, config,
  users, jobs, orgList,
} from "@agent12/shared";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const schema = { runs, runCheckpoints, manifestEntries, config, users, jobs, orgList };
const client = postgres(url);

export const db = drizzle(client, { schema });
export type Db = typeof db;
