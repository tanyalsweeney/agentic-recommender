export interface PypiResult {
  currentVersion: string;
  license: string | null;
  releaseCount: number;
}

/**
 * Fetch current version and license info for a PyPI package.
 * Uses the PyPI JSON API — no authentication required.
 */
export async function queryPypi(
  packageName: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch
): Promise<PypiResult | null> {
  const url = `https://pypi.org/pypi/${encodeURIComponent(packageName)}/json`;

  const response = await fetchFn(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`PyPI API error ${response.status} for "${packageName}"`);
  }

  const data = (await response.json()) as {
    info: { version: string; license?: string | null };
    releases?: Record<string, unknown>;
  };

  return {
    currentVersion: data.info.version,
    license: data.info.license ?? null,
    releaseCount: Object.keys(data.releases ?? {}).length,
  };
}
