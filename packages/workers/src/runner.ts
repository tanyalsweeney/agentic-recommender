import { eq, and } from "drizzle-orm";
import { config, runs } from "@agent12/shared";
import {
  DEFAULT_PROVIDER_CONFIGS,
  ProviderConfig,
  agentVersions,
  filterManifest,
  type ManifestSections,
} from "@agent12/agents";
import { readCheckpoint, writeCheckpoint, qualifiedAgentVersion } from "./checkpoint.js";
import { getApiKey } from "./key-resolution.js";
import { fetchManifest } from "./manifest.js";
import type { Db } from "./db.js";

// Manifest sections each agent needs — keeps token cost low.
const AGENT_MANIFEST_SECTIONS: Record<string, ManifestSections> = {
  intake:                  { tools: true, patterns: true },
  orchestration:           { patterns: true },
  security:                { tools: true },
  memory_state:            { tools: true },
  tool_integration:        { tools: true },
  failure_observability:   { patterns: true, failureModes: true },
  trust_control:           { failureModes: true },
  compatibility_validator: { tools: true, patterns: true },
  skeptic:                 { tools: true, patterns: true, failureModes: true },
  technical_writer:        { tools: true, patterns: true, failureModes: true },
};

export interface RunAgentOpts {
  db: Db;
  runId: string;
  tenantId?: string;
  tenantContextVersion?: string;
  agentKey: string;
  wave: string;
  upstreamHashes: Record<string, string>;
  upstreamOutputs?: unknown;
  callAgent: (manifest: unknown, verifiedContext: unknown, providerConfig: ProviderConfig, upstreamOutputs?: unknown) => Promise<unknown>;
}

export interface AgentResult {
  output: unknown;
  checkpointVersion: string;
  fromCache: boolean;
}

// Core agent runner used by every wave worker.
// Handles: provider resolution, checkpoint reuse, agent call, checkpoint write.
export async function runAgent(opts: RunAgentOpts): Promise<AgentResult> {
  const { db, runId, tenantId, tenantContextVersion, agentKey, wave, upstreamHashes, upstreamOutputs, callAgent } = opts;

  // Tenant context version is an upstream dependency for checkpoint reuse.
  // If the tenant updates their context block, this version changes and
  // all checkpoints for affected runs are automatically invalidated.
  const effectiveUpstreamHashes = tenantContextVersion
    ? { tenant_context: tenantContextVersion, ...upstreamHashes }
    : upstreamHashes;

  // 1. Fetch run context
  const runRows = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!runRows[0]) throw new Error(`Run ${runId} not found`);
  const run = runRows[0];
  const verifiedContext = run.verifiedContext;
  const contextHash = run.verifiedContextHash;

  // 2. Resolve provider config (tenant override → global default)
  const configRows = await db
    .select()
    .from(config)
    .where(and(eq(config.key, `agent.provider.${agentKey}`), eq(config.owner, tenantId ?? "global")))
    .limit(1);

  const providerConfig = configRows[0]
    ? ProviderConfig.parse(JSON.parse(configRows[0].value))
    : DEFAULT_PROVIDER_CONFIGS[agentKey];

  if (!providerConfig) throw new Error(`No provider config for agent: ${agentKey}`);

  // 3. Compute model-qualified agent version
  const baseVersion = agentVersions[agentKey as keyof typeof agentVersions];
  if (!baseVersion) throw new Error(`Unknown agent: ${agentKey}`);
  const agentVersion = qualifiedAgentVersion(baseVersion, providerConfig.model);

  // 4. Fetch manifest and compute version
  const { manifest, manifestVersion } = await fetchManifest(db);

  // 5. Check checkpoint reuse (all 4 conditions)
  const checkpointKey = { runId, agentName: agentKey, contextHash, agentVersion, manifestVersion, upstreamHashes: effectiveUpstreamHashes };
  const cached = await readCheckpoint(db, checkpointKey);

  if (cached !== null) {
    return {
      output: cached,
      checkpointVersion: `${agentVersion}:${contextHash}`,
      fromCache: true,
    };
  }

  // 6. Call agent with filtered manifest
  const filteredManifest = filterManifest(manifest, AGENT_MANIFEST_SECTIONS[agentKey] ?? { tools: true, patterns: true, failureModes: true });

  // Resolve API key — tenant BYOK key first, system env var fallback
  await getApiKey(db as unknown as Parameters<typeof getApiKey>[0], providerConfig.provider, tenantId);

  const output = await callAgent(filteredManifest, verifiedContext, providerConfig, upstreamOutputs);

  // 7. Write checkpoint
  await writeCheckpoint(db, { ...checkpointKey, wave, output });

  return {
    output,
    checkpointVersion: `${agentVersion}:${contextHash}`,
    fromCache: false,
  };
}
