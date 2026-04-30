import { eq, and } from "drizzle-orm";
import { config } from "@agent12/shared";
import { DEFAULT_PROVIDER_CONFIGS } from "@agent12/agents";
import type { Db } from "./db.js";

// Seed default provider configs into the config table on first startup.
// Uses INSERT ... ON CONFLICT DO NOTHING — safe to run on every startup.
// Tenants override these per-agent via config table with owner = tenantId.
export async function seedProviderConfigs(db: Db): Promise<void> {
  const entries = Object.entries(DEFAULT_PROVIDER_CONFIGS).map(([agentName, providerConfig]) => ({
    key: `agent.provider.${agentName}`,
    value: JSON.stringify(providerConfig),
    owner: "global" as const,
  }));

  for (const entry of entries) {
    const existing = await db
      .select()
      .from(config)
      .where(and(eq(config.key, entry.key), eq(config.owner, entry.owner)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(config).values(entry);
    }
  }
}
