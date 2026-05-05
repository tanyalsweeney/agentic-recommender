import { eq, and, sql } from "drizzle-orm";
import { cvResultCache } from "@agent12/shared";
import type { CveSummary } from "../cv-apis/cve-lookup.js";
import type { Db } from "../db.js";

export interface PerToolLookupDeps {
  queryCves: (ecosystem: string, packageName: string, nvdApiKey: string) => Promise<CveSummary>;
  queryVersion: (toolName: string) => Promise<{ version: string; license: string | null } | null>;
  searchWeb?: (query: string) => Promise<string>;
}

export interface PerToolCvResult {
  toolName: string;
  version: string | null;
  isCurrentVersion: boolean | null;
  cves: { critical: string[]; high: string[] };
  license: string | null;
  isCopyleft: boolean;
  sourceUrl: string;
  fromCache: boolean;
  flagged: string[];
}

const PRICING_UNAVAILABLE_PATTERNS = [
  "not publicly available",
  "not found",
  "no pricing",
  "pricing information not",
  "contact sales",
  "custom pricing",
];

/**
 * Run a per-tool CV lookup with cache-first behaviour.
 *
 * Cache hit (fresh entry in cv_result_cache) → return immediately, no API calls.
 * Cache miss → call API clients, write result to cv_result_cache, return result.
 *
 * Fatal errors (CVE API failure) re-throw so the wave2_5 job fails and BullMQ
 * retries. Completed siblings' cache entries survive because they were written
 * before the failure.
 *
 * Flaggable failures (pricing unavailable) populate result.flagged and do not throw.
 */
export async function runPerToolLookup(
  db: Db,
  toolName: string,
  ecosystem: string,
  deps: PerToolLookupDeps
): Promise<PerToolCvResult> {
  // ── cache check ─────────────────────────────────────────────────────────────
  const cached = await db
    .select()
    .from(cvResultCache)
    .where(
      and(
        eq(cvResultCache.toolName, toolName),
        // Entry is fresh if cachedAt + ttlSeconds > now()
        sql`cached_at + (ttl_seconds * interval '1 second') > now()`
      )
    )
    .limit(1);

  if (cached.length > 0) {
    const entry = cached[0];
    const cveStatus = (entry.cveStatus ?? { critical: [], high: [] }) as {
      critical: string[];
      high: string[];
    };
    return {
      toolName,
      version: entry.toolVersion ?? null,
      isCurrentVersion: null, // not tracked in cache
      cves: cveStatus,
      license: entry.license ?? null,
      isCopyleft: isLicenseCopyleft(entry.license ?? null),
      sourceUrl: entry.sourceUrl ?? "",
      fromCache: true,
      flagged: [],
    };
  }

  // ── live lookup ──────────────────────────────────────────────────────────────

  // queryCves throws on API failure — intentionally not caught so the job fails
  const cveData = await deps.queryCves(ecosystem, toolName, process.env.NVD_API_KEY ?? "");

  const versionInfo = await deps.queryVersion(toolName);
  const version = versionInfo?.version ?? null;
  const license = versionInfo?.license ?? null;

  // Pricing via web search — flaggable, never fatal
  const flagged: string[] = [];
  let sourceUrl = `https://pypi.org/project/${toolName}/`;

  if (deps.searchWeb) {
    try {
      const pricingText = await deps.searchWeb(`${toolName} pricing cost tier`);
      if (PRICING_UNAVAILABLE_PATTERNS.some((p) => pricingText.toLowerCase().includes(p))) {
        flagged.push("pricing");
      }
    } catch {
      // Web search failure is also flaggable, not fatal
      flagged.push("pricing");
    }
  }

  const result: PerToolCvResult = {
    toolName,
    version,
    isCurrentVersion: null,
    cves: {
      critical: cveData.critical.map((a) => a.summary),
      high: cveData.high.map((a) => a.summary),
    },
    license,
    isCopyleft: isLicenseCopyleft(license),
    sourceUrl,
    fromCache: false,
    flagged,
  };

  // ── write to cache ───────────────────────────────────────────────────────────
  await db
    .insert(cvResultCache)
    .values({
      toolName,
      toolVersion: version ?? "unknown",
      cveStatus: result.cves,
      license,
      sourceUrl,
      ttlSeconds: 86400,
    })
    .onConflictDoUpdate({
      target: [cvResultCache.toolName, cvResultCache.toolVersion],
      set: {
        cveStatus: result.cves,
        license,
        sourceUrl,
        cachedAt: sql`now()`,
      },
    });

  return result;
}

const COPYLEFT_IDENTIFIERS = ["GPL", "LGPL", "AGPL", "EUPL", "MPL", "CC-BY-SA"];

function isLicenseCopyleft(license: string | null): boolean {
  if (!license) return false;
  const upper = license.toUpperCase();
  return COPYLEFT_IDENTIFIERS.some((id) => upper.includes(id));
}
