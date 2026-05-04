import { createHash } from "crypto";
import { and, eq, isNull, lte, gte, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { themeAssignments } from "./schema.js";

// ── version computation ───────────────────────────────────────────────────────

// Computes YYYY-MM-DD-{sha256_8chars} from token_map + custom_css.
// Called on every theme write — never stored without recomputing.
export function computeThemeVersion(
  tokenMap: Record<string, string>,
  customCss: string | null
): string {
  const date = new Date().toISOString().slice(0, 10);
  const hash = createHash("sha256")
    .update(JSON.stringify(tokenMap) + (customCss ?? ""))
    .digest("hex")
    .slice(0, 8);
  return `${date}-${hash}`;
}

// ── active assignment query ───────────────────────────────────────────────────

type Db = PostgresJsDatabase<Record<string, unknown>>;

// Returns the active published theme assignment for an owner+mode, respecting
// time-bounded assignments (valid_from/valid_until). Returns null if none found.
export async function getActiveThemeAssignment(
  db: Db,
  owner: string,
  mode: string
) {
  const now = new Date();

  const rows = await db
    .select()
    .from(themeAssignments)
    .where(
      and(
        eq(themeAssignments.owner, owner),
        eq(themeAssignments.mode, mode),
        eq(themeAssignments.status, "published"),
        or(
          isNull(themeAssignments.validFrom),
          lte(themeAssignments.validFrom, now)
        ),
        or(
          isNull(themeAssignments.validUntil),
          gte(themeAssignments.validUntil, now)
        )
      )
    )
    .limit(1);

  return rows[0] ?? null;
}
