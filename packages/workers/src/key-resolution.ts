import { eq, and } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { config } from "@agent12/shared";
import { PROVIDER_REGISTRY, type ProviderName } from "@agent12/agents";

type Db = PostgresJsDatabase<Record<string, unknown>>;

// Resolve the API key for a provider, checking for a tenant-specific key first.
//
// Resolution order:
// 1. Tenant key: config table, key = "tenant.api_key.{provider}", owner = tenantId
//    NOTE: before BYOK ships to production, tenant keys must move to tenant_secrets
//    with field-level encryption. The config table is not a secrets store.
// 2. System key: process.env[PROVIDER_REGISTRY[provider].systemApiKeyEnvVar]
export async function getApiKey(
  db: Db,
  provider: string,
  tenantId: string | undefined
): Promise<string> {
  const entry = PROVIDER_REGISTRY[provider as ProviderName];
  if (!entry) {
    throw new Error(
      `Unknown provider "${provider}". Registered: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`
    );
  }

  if (tenantId) {
    const rows = await db
      .select()
      .from(config)
      .where(
        and(
          eq(config.key, `tenant.api_key.${provider}`),
          eq(config.owner, tenantId)
        )
      )
      .limit(1);

    if (rows[0]?.value) return rows[0].value;
  }

  const key = process.env[entry.systemApiKeyEnvVar];
  if (!key) throw new Error(`${entry.systemApiKeyEnvVar} is not set`);
  return key;
}
