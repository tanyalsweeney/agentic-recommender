import { eq, and, sql } from "drizzle-orm";
import { cvResultCache } from "@agent12/shared";
import type { WebSearchResult } from "@agent12/agents";
import type { CveSummary } from "../cv-apis/cve-lookup.js";
import type { Db } from "../db.js";

export interface PerToolLookupDeps {
  queryCves: (ecosystem: string, packageName: string, nvdApiKey: string) => Promise<CveSummary>;
  queryVersion: (toolName: string) => Promise<{ version: string; license: string | null } | null>;
  searchToolData?: (toolName: string, version: string | null) => Promise<WebSearchResult>;
}

export interface PerToolCvResult {
  toolName: string;
  version: string | null;
  isCurrentVersion: boolean | null;
  cves: { critical: string[]; high: string[] };
  license: string | null;
  isCopyleft: boolean;
  eolDate: string | null;
  breakingChanges: string[];
  pricing: string | null;
  tripHazards: string[];
  sourceUrls: Record<string, string>; // one URL per source consulted, for human audit
  fromCache: boolean;
  flagged: string[];                  // flaggable data points that could not be retrieved
}

// Stored in compatStatus jsonb as { tripHazards, sourceUrls } to avoid a migration.
// A dedicated sourceUrls column will be added in Phase 5 when the admin dashboard lands.
interface CachedCompatStatus {
  tripHazards?: string[];
  sourceUrls?: Record<string, string>;
}

/**
 * Run a per-tool CV lookup with cache-first behaviour.
 *
 * Cache hit  → return immediately, no API or LLM calls.
 * Cache miss → queryCves (fatal if throws) + queryVersion + searchToolData
 *              (flaggable if throws or pricingFlagged), write to cv_result_cache.
 *
 * cv_result_cache is the per-tool checkpoint: BullMQ retries the wave2_5 job
 * on any failure; completed tools read from cache and are skipped. Siblings'
 * cache entries are unaffected by a failing tool's lookup.
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
        sql`cached_at + (ttl_seconds * interval '1 second') > now()`
      )
    )
    .limit(1);

  if (cached.length > 0) {
    const entry = cached[0];
    const compatStatus = (entry.compatStatus ?? {}) as CachedCompatStatus;
    const cveStatus = (entry.cveStatus ?? { critical: [], high: [] }) as {
      critical: string[];
      high: string[];
    };
    return {
      toolName,
      version: entry.toolVersion ?? null,
      isCurrentVersion: null,
      cves: cveStatus,
      license: entry.license ?? null,
      isCopyleft: isLicenseCopyleft(entry.license ?? null),
      eolDate: entry.eolDate ?? null,
      breakingChanges: (entry.breakingChanges as string[]) ?? [],
      pricing: (entry.pricing as { text: string } | null)?.text ?? null,
      tripHazards: compatStatus.tripHazards ?? [],
      sourceUrls: compatStatus.sourceUrls ?? {},
      fromCache: true,
      flagged: [],
    };
  }

  // ── live lookup ──────────────────────────────────────────────────────────────

  // queryCves throws on API failure — intentionally not caught so the job fails
  // and BullMQ retries. Completed siblings remain cached.
  const cveData = await deps.queryCves(ecosystem, toolName, process.env.NVD_API_KEY ?? "");

  const versionInfo = await deps.queryVersion(toolName);
  const version = versionInfo?.version ?? null;
  const license = versionInfo?.license ?? null;

  // Build sourceUrls — start with any GHSA advisory URLs from CVE data
  const sourceUrls: Record<string, string> = {};
  const firstAdvisory = [...cveData.critical, ...cveData.high][0];
  if (firstAdvisory?.ghsaId?.startsWith("GHSA")) {
    sourceUrls.advisory = firstAdvisory.advisoryUrl;
  }

  // Web search covers pricing, EOL, breaking changes, trip hazards, and docs URLs.
  // pricingFlagged: true or a thrown error → flaggable, not fatal.
  const flagged: string[] = [];
  let webSearch: WebSearchResult | null = null;

  if (deps.searchToolData) {
    try {
      webSearch = await deps.searchToolData(toolName, version);
      if (webSearch.pricingFlagged) flagged.push("pricing");
      Object.assign(sourceUrls, webSearch.sourceUrls);
    } catch {
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
    eolDate: webSearch?.eolDate ?? null,
    breakingChanges: webSearch?.breakingChanges ?? [],
    pricing: webSearch?.pricing ?? null,
    tripHazards: webSearch?.tripHazards ?? [],
    sourceUrls,
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
      pricing: result.pricing ? { text: result.pricing } : null,
      eolDate: result.eolDate,
      breakingChanges: result.breakingChanges,
      // compatStatus stores tripHazards + sourceUrls until Phase 5 adds dedicated columns
      compatStatus: {
        tripHazards: result.tripHazards,
        sourceUrls: result.sourceUrls,
      },
      sourceUrl: sourceUrls.registry ?? sourceUrls.docs ?? null,
      ttlSeconds: 86400,
    })
    .onConflictDoUpdate({
      target: [cvResultCache.toolName, cvResultCache.toolVersion],
      set: {
        cveStatus: result.cves,
        license,
        pricing: result.pricing ? { text: result.pricing } : null,
        eolDate: result.eolDate,
        breakingChanges: result.breakingChanges,
        compatStatus: {
          tripHazards: result.tripHazards,
          sourceUrls: result.sourceUrls,
        },
        sourceUrl: sourceUrls.registry ?? sourceUrls.docs ?? null,
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
