import type { Job } from "bullmq";
import { eq } from "drizzle-orm";
import { runs } from "@agent12/shared";
import { callCompatibilityValidator, searchToolData } from "@agent12/agents";
import { runAgent } from "../runner.js";
import { runPerToolLookup, type PerToolLookupDeps } from "./per-tool-lookup.js";
import { runCrossAgentConflictCheck } from "./cv-conflict-check.js";
import { buildCostContext } from "./cost-context.js";
import { queryCves } from "../cv-apis/cve-lookup.js";
import { queryNpm } from "../cv-apis/npm.js";
import { queryPypi } from "../cv-apis/pypi.js";
import type { Db } from "../db.js";

export async function processWave2_5Job(
  job: Job,
  db: Db,
  wave1Results: unknown,
  wave2Results: unknown,
  upstreamCheckpointVersions: Record<string, string>
): Promise<{ output: unknown; checkpointVersion: string }> {
  const { runId, tenantId } = job.data as { runId: string; tenantId?: string };

  const w1 = wave1Results as {
    toolIntegration?: {
      recommendedTools?: Array<{ tool: string }>;
      declaredConstraints?: string[];
    };
    orchestration?: { declaredConstraints?: string[] };
    security?: { declaredConstraints?: string[] };
  };

  // Preserve the tool-agent association from the source so it travels with
  // each PerToolCvResult throughout the pipeline — no reconstruction later.
  const agentTools = (w1.toolIntegration?.recommendedTools ?? []).map((t) => ({
    tool:            t.tool,
    agentKey:        "toolIntegration" as const,
    isUserSpecified: false as const,
  }));

  // ── per-tool lookups (parallel) ───────────────────────────────────────────
  const deps = buildDeps();

  const perToolResults = await Promise.all(
    agentTools.map(({ tool, agentKey, isUserSpecified }) =>
      runPerToolLookup(db, tool, inferEcosystem(tool), agentKey, isUserSpecified, deps)
    )
  );

  // ── cross-agent conflict checks (sequential) ──────────────────────────────
  const conflicts = await runCrossAgentConflictCheck(perToolResults, w1);

  // Read verifiedContext from the run — contains confirmed intake fields
  // (scale, modelPreferences, orchestrationPattern) used for cost aggregation.
  const runRow = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  const verifiedContext = runRow[0]?.verifiedContext ?? {};

  const costContext = buildCostContext(wave1Results, wave2Results, verifiedContext);

  // Enrich upstream outputs with API-sourced data before calling the CV agent
  const enrichedUpstream = {
    wave1: wave1Results,
    wave2: wave2Results,
    costContext,
    apiData: Object.fromEntries(
      perToolResults.map((r) => [
        r.toolName,
        {
          resolvedVersion: r.version,
          cves: r.cves,
          license: r.license,
          flagged: r.flagged,
          fromCache: r.fromCache,
        },
      ])
    ),
    crossAgentConflicts: conflicts,
  };

  // ── CV agent synthesis ────────────────────────────────────────────────────
  const result = await runAgent({
    db,
    runId,
    tenantId,
    agentKey: "compatibilityValidator",
    wave: "2_5",
    upstreamHashes: upstreamCheckpointVersions,
    upstreamOutputs: enrichedUpstream,
    callAgent: (m, c, p, u) =>
      callCompatibilityValidator(
        m,
        c,
        u as { wave1: unknown; wave2: unknown },
        p
      ),
  });

  return { output: result.output, checkpointVersion: result.checkpointVersion };
}

function buildDeps(): PerToolLookupDeps {
  const nvdApiKey = process.env.NVD_API_KEY ?? "";

  return {
    queryCves: (ecosystem, packageName) =>
      queryCves(ecosystem, packageName, nvdApiKey),

    queryVersion: async (toolName) => {
      // Try npm first (covers JS/TS tools), fall back to PyPI (Python tools)
      const npm = await queryNpm(toolName).catch(() => null);
      if (npm) return { version: npm.currentVersion, license: npm.license };
      const pypi = await queryPypi(toolName).catch(() => null);
      if (pypi) return { version: pypi.currentVersion, license: pypi.license };
      return null;
    },

    searchToolData: (toolName, version) => searchToolData(toolName, version),
  };
}

function inferEcosystem(toolName: string): string {
  const JS_TOOLS = new Set(["bullmq", "openai-sdk", "mcp-server-filesystem", "playwright"]);
  const PY_TOOLS = new Set(["langchain", "langgraph", "chromadb", "anthropic-sdk"]);

  if (JS_TOOLS.has(toolName)) return "npm";
  if (PY_TOOLS.has(toolName)) return "pip";
  // Default to npm; the per-tool lookup will fall back to pypi if npm returns null
  return "npm";
}
