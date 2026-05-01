import { createHash } from "crypto";
import { loadManifest } from "@agent12/shared";
import type { Db } from "./db.js";

export type { Manifest, ManifestTool, ManifestPattern, ManifestFailureMode } from "@agent12/shared";

export async function fetchManifest(db: Db): Promise<{ manifest: Awaited<ReturnType<typeof loadManifest>>; manifestVersion: string }> {
  const manifest = await loadManifest(db);

  // Version covers all three tables. Changes when any entry is added, removed, or refreshed.
  const versionInput = [
    ...manifest.tools.map((t) => `tool:${t.name}:${t.lastRefreshedAt?.toISOString() ?? ""}`),
    ...manifest.patterns.map((p) => `pattern:${p.name}:${p.lastRefreshedAt?.toISOString() ?? ""}`),
    ...manifest.failureModes.map((f) => `failureMode:${f.name}:${f.lastRefreshedAt?.toISOString() ?? ""}`),
  ].sort().join("|");

  const manifestVersion = createHash("sha256").update(versionInput).digest("hex").slice(0, 12);

  return { manifest, manifestVersion };
}
