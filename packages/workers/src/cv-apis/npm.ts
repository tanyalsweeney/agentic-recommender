export interface NpmResult {
  currentVersion: string;
  license: string | null;
  // Declared dependencies merged from dependencies + peerDependencies,
  // normalised to requires_dist-style strings: "packagename@versionrange"
  dependencies: string[];
}

export async function queryNpm(
  packageName: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch
): Promise<NpmResult | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`;

  const response = await fetchFn(url, { headers: { Accept: "application/json" } });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`npm Registry API error ${response.status} for "${packageName}"`);
  }

  const data = (await response.json()) as {
    version: string;
    license?: string | null;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  const deps = {
    ...(data.dependencies ?? {}),
    ...(data.peerDependencies ?? {}),
  };

  return {
    currentVersion: data.version,
    license: data.license ?? null,
    dependencies: Object.entries(deps).map(([name, range]) => `${name}@${range}`),
  };
}
