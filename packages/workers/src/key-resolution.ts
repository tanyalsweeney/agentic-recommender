import { eq, and } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { tenantSecrets, decryptKey } from "@agent12/shared";
import { PROVIDER_REGISTRY, type ProviderName } from "@agent12/agents";

type Db = PostgresJsDatabase<Record<string, unknown>>;

// Resolve the API key for a provider, checking for a tenant BYOK key first.
//
// Resolution order:
// 1. Tenant key: tenant_secrets row matching (tenantId, provider). Decrypted via
//    AES-256-GCM using ENCRYPTION_KEY env var (see packages/shared/src/crypto.ts).
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
      .from(tenantSecrets)
      .where(
        and(
          eq(tenantSecrets.tenantId, tenantId),
          eq(tenantSecrets.provider, provider)
        )
      )
      .limit(1);

    if (rows[0]?.encryptedKey) return decryptKey(rows[0].encryptedKey);
  }

  const key = process.env[entry.systemApiKeyEnvVar];
  if (!key) throw new Error(`${entry.systemApiKeyEnvVar} is not set`);
  return key;
}
