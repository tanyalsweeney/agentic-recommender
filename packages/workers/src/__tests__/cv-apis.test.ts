/**
 * Unit tests for CV API clients. All HTTP calls are intercepted via dependency
 * injection — no real network traffic, no API quota consumed.
 *
 * Each client accepts an optional `fetchFn` parameter that defaults to the
 * global fetch. Tests pass a vi.fn() instead.
 */

import { describe, it, expect, vi } from "vitest";
import { queryGhsaAdvisories } from "../cv-apis/ghsa.js";
import { queryNvdCves } from "../cv-apis/nvd.js";
import { queryPypi } from "../cv-apis/pypi.js";
import { queryNpm } from "../cv-apis/npm.js";
import { queryGithubReleases } from "../cv-apis/github-releases.js";
import { queryCves } from "../cv-apis/cve-lookup.js";

// ── fetch mock helpers ────────────────────────────────────────────────────────

function mockFetch(body: unknown, status = 200): typeof globalThis.fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function failingFetch(error = new Error("network error")): typeof globalThis.fetch {
  return vi.fn().mockRejectedValue(error);
}

// ── GHSA client ───────────────────────────────────────────────────────────────

const GHSA_ADVISORY = {
  ghsa_id: "GHSA-jf85-cpcp-j695",
  cve_id: "CVE-2021-23337",
  severity: "HIGH",
  summary: "Command injection in lodash",
  vulnerabilities: [
    {
      package: { ecosystem: "npm", name: "lodash" },
      vulnerable_version_range: "< 4.17.21",
      first_patched_version: "4.17.21",
    },
  ],
};

describe("queryGhsaAdvisories", () => {
  it("parses advisories for a package with known vulnerabilities", async () => {
    const fetch = mockFetch([GHSA_ADVISORY]);

    const result = await queryGhsaAdvisories("npm", "lodash", fetch);

    expect(result).toHaveLength(1);
    expect(result[0].ghsaId).toBe("GHSA-jf85-cpcp-j695");
    expect(result[0].severity).toBe("HIGH");
    expect(result[0].summary).toBe("Command injection in lodash");
    expect(result[0].fixedVersions).toContain("4.17.21");
  });

  it("returns an empty array when the package has no advisories", async () => {
    const fetch = mockFetch([]);
    const result = await queryGhsaAdvisories("npm", "zod", fetch);
    expect(result).toHaveLength(0);
  });

  it("throws when the network call fails", async () => {
    const fetch = failingFetch(new Error("ETIMEDOUT"));
    await expect(queryGhsaAdvisories("npm", "lodash", fetch)).rejects.toThrow("ETIMEDOUT");
  });
});

// ── NVD client ────────────────────────────────────────────────────────────────

const NVD_RESPONSE = {
  resultsPerPage: 1,
  totalResults: 1,
  vulnerabilities: [
    {
      cve: {
        id: "CVE-2021-3918",
        descriptions: [{ lang: "en", value: "json-schema is vulnerable to Prototype Pollution" }],
        metrics: {
          cvssMetricV31: [{ cvssData: { baseSeverity: "CRITICAL" } }],
        },
      },
    },
  ],
};

describe("queryNvdCves", () => {
  it("parses CVEs for a keyword search", async () => {
    const fetch = mockFetch(NVD_RESPONSE);

    const result = await queryNvdCves("json-schema", "fake-nvd-key", fetch);

    expect(result).toHaveLength(1);
    expect(result[0].cveId).toBe("CVE-2021-3918");
    expect(result[0].severity).toBe("CRITICAL");
    expect(result[0].description).toContain("Prototype Pollution");
  });

  it("returns an empty array when no CVEs match", async () => {
    const fetch = mockFetch({ resultsPerPage: 0, totalResults: 0, vulnerabilities: [] });
    const result = await queryNvdCves("some-niche-tool", "fake-nvd-key", fetch);
    expect(result).toHaveLength(0);
  });
});

// ── GHSA→NVD fallback (queryCves) ────────────────────────────────────────────

describe("queryCves — GHSA primary with NVD fallback", () => {
  it("returns GHSA results and does not call NVD when GHSA has advisories", async () => {
    const ghsaFetch = mockFetch([GHSA_ADVISORY]);
    const nvdFetch = mockFetch(NVD_RESPONSE);

    const result = await queryCves("npm", "lodash", "fake-nvd-key", ghsaFetch, nvdFetch);

    expect(result.source).toBe("GHSA");
    expect(result.high.length + result.critical.length).toBeGreaterThan(0);
    expect(nvdFetch).not.toHaveBeenCalled();
  });

  it("falls back to NVD when GHSA returns no advisories", async () => {
    const ghsaFetch = mockFetch([]);
    const nvdFetch = mockFetch(NVD_RESPONSE);

    const result = await queryCves("go", "some-go-pkg", "fake-nvd-key", ghsaFetch, nvdFetch);

    expect(result.source).toBe("NVD");
    expect(nvdFetch).toHaveBeenCalledOnce();
  });

  it("returns source: none when both GHSA and NVD have no entries", async () => {
    const ghsaFetch = mockFetch([]);
    const nvdFetch = mockFetch({ resultsPerPage: 0, totalResults: 0, vulnerabilities: [] });

    const result = await queryCves("npm", "obscure-pkg", "fake-nvd-key", ghsaFetch, nvdFetch);

    expect(result.source).toBe("none");
    expect(result.critical).toHaveLength(0);
    expect(result.high).toHaveLength(0);
  });
});

// ── PyPI client ───────────────────────────────────────────────────────────────

const PYPI_RESPONSE = {
  info: { version: "0.3.2", license: "MIT" },
  releases: { "0.1.0": [], "0.2.0": [], "0.3.0": [], "0.3.2": [] },
};

describe("queryPypi", () => {
  it("parses current version and license", async () => {
    const fetch = mockFetch(PYPI_RESPONSE);

    const result = await queryPypi("langchain", fetch);

    expect(result).not.toBeNull();
    expect(result!.currentVersion).toBe("0.3.2");
    expect(result!.license).toBe("MIT");
    expect(result!.releaseCount).toBe(4);
  });

  it("returns null when the package is not found", async () => {
    const fetch = mockFetch({ message: "Not Found" }, 404);
    const result = await queryPypi("nonexistent-pkg", fetch);
    expect(result).toBeNull();
  });
});

// ── npm client ────────────────────────────────────────────────────────────────

const NPM_RESPONSE = {
  version: "5.7.2",
  license: "MIT",
};

describe("queryNpm", () => {
  it("parses current version and license", async () => {
    const fetch = mockFetch(NPM_RESPONSE);

    const result = await queryNpm("bullmq", fetch);

    expect(result).not.toBeNull();
    expect(result!.currentVersion).toBe("5.7.2");
    expect(result!.license).toBe("MIT");
  });

  it("returns null when the package is not found", async () => {
    const fetch = mockFetch({ error: "Not found" }, 404);
    const result = await queryNpm("nonexistent-pkg", fetch);
    expect(result).toBeNull();
  });
});

// ── GitHub Releases client ────────────────────────────────────────────────────

const GITHUB_RELEASES_RESPONSE = {
  tag_name: "v1.44.0",
  name: "Version 1.44.0",
};

describe("queryGithubReleases", () => {
  it("parses the latest release tag", async () => {
    const fetch = mockFetch(GITHUB_RELEASES_RESPONSE);

    const result = await queryGithubReleases("microsoft", "playwright", "fake-gh-token", fetch);

    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe("1.44.0");
  });

  it("returns null when the repo has no releases", async () => {
    const fetch = mockFetch({ message: "Not Found" }, 404);
    const result = await queryGithubReleases("some", "repo", "fake-gh-token", fetch);
    expect(result).toBeNull();
  });
});
