export interface NvdCve {
  cveId: string;
  severity: string;
  description: string;
}

/**
 * Query the NVD (National Vulnerability Database) by keyword.
 * Used as fallback when GHSA has no entry for a tool.
 * Free API key available at https://nvd.nist.gov/developers/request-an-api-key
 */
export async function queryNvdCves(
  keyword: string,
  apiKey: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch
): Promise<NvdCve[]> {
  const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(keyword)}&apiKey=${apiKey}`;

  const response = await fetchFn(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`NVD API error ${response.status} for keyword "${keyword}"`);
  }

  const data = (await response.json()) as {
    vulnerabilities?: Array<{
      cve: {
        id: string;
        descriptions: Array<{ lang: string; value: string }>;
        metrics?: {
          cvssMetricV31?: Array<{ cvssData: { baseSeverity: string } }>;
          cvssMetricV30?: Array<{ cvssData: { baseSeverity: string } }>;
          cvssMetricV2?: Array<{ baseSeverity: string }>;
        };
      };
    }>;
  };

  return (data.vulnerabilities ?? []).map(({ cve }) => {
    const enDesc = cve.descriptions.find((d) => d.lang === "en");
    const severity =
      cve.metrics?.cvssMetricV31?.[0]?.cvssData.baseSeverity ??
      cve.metrics?.cvssMetricV30?.[0]?.cvssData.baseSeverity ??
      cve.metrics?.cvssMetricV2?.[0]?.baseSeverity ??
      "UNKNOWN";

    return {
      cveId: cve.id,
      severity,
      description: enDesc?.value ?? "",
    };
  });
}
