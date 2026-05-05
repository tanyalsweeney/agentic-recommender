export interface GhsaAdvisory {
  ghsaId: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  summary: string;
  fixedVersions: string[];
  advisoryUrl: string; // canonical GitHub Advisory URL for human audit
}

/**
 * Query the GitHub Advisory Database for known advisories affecting a package.
 * Uses the GitHub REST API — no authentication required for public advisories,
 * but a token removes rate-limiting.
 *
 * @param ecosystem  e.g. "npm", "pip", "go", "maven", "rubygems", "nuget", "rust"
 * @param packageName  the package name as registered in the ecosystem
 * @param fetchFn  injectable fetch for testing; defaults to globalThis.fetch
 */
export async function queryGhsaAdvisories(
  ecosystem: string,
  packageName: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch
): Promise<GhsaAdvisory[]> {
  const url = `https://api.github.com/advisories?affects=${encodeURIComponent(ecosystem)}/${encodeURIComponent(packageName)}&per_page=100`;

  const response = await fetchFn(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`GHSA API error ${response.status} for ${ecosystem}/${packageName}`);
  }

  const data = (await response.json()) as Array<{
    ghsa_id: string;
    severity: string;
    summary: string;
    vulnerabilities?: Array<{ first_patched_version?: string }>;
  }>;

  return data.map((advisory) => ({
    ghsaId: advisory.ghsa_id,
    severity: normaliseSeverity(advisory.severity),
    summary: advisory.summary,
    fixedVersions: (advisory.vulnerabilities ?? [])
      .map((v) => v.first_patched_version)
      .filter((v): v is string => !!v),
    advisoryUrl: `https://github.com/advisories/${advisory.ghsa_id}`,
  }));
}

function normaliseSeverity(raw: string): GhsaAdvisory["severity"] {
  const upper = raw.toUpperCase();
  if (upper === "CRITICAL") return "CRITICAL";
  if (upper === "HIGH") return "HIGH";
  if (upper === "MODERATE" || upper === "MEDIUM") return "MODERATE";
  return "LOW";
}
