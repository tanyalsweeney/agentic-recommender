export interface NpmResult {
  currentVersion: string;
  license: string | null;
}

/**
 * Fetch current version and license info for an npm package.
 * Queries the latest dist-tag via the npm Registry API — no authentication required.
 */
export async function queryNpm(
  packageName: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch
): Promise<NpmResult | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;

  const response = await fetchFn(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`npm Registry API error ${response.status} for "${packageName}"`);
  }

  const data = (await response.json()) as {
    version: string;
    license?: string | null;
  };

  return {
    currentVersion: data.version,
    license: data.license ?? null,
  };
}
