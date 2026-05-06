export interface GithubReleasesResult {
  latestVersion: string;
}

/**
 * Fetch the latest release version for a GitHub-hosted tool.
 * Uses the GitHub REST API. GITHUB_TOKEN removes rate-limiting.
 */
export async function queryGithubReleases(
  owner: string,
  repo: string,
  token: string,
  fetchFn: typeof globalThis.fetch = globalThis.fetch
): Promise<GithubReleasesResult | null> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;

  const response = await fetchFn(url, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`GitHub Releases API error ${response.status} for ${owner}/${repo}`);
  }

  const data = (await response.json()) as { tag_name: string };

  // Strip leading "v" prefix — tags like "v1.44.0" normalise to "1.44.0"
  const latestVersion = data.tag_name.replace(/^v/, "");

  return { latestVersion };
}
