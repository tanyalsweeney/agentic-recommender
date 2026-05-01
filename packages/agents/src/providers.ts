import { ProviderConfig } from "./schemas/index.js";

// Registered providers. Adding a new provider is one entry here plus the API
// key in the environment. Base URLs and system env var names live here, not in
// per-agent or per-tenant config.
//
// Runtime key resolution (implemented in Phase 3 worker):
//   getApiKey(provider, tenantId):
//     1. Check config table for tenant key: tenant.api_key.{provider} | owner: tenantId
//     2. Fall back to process.env[PROVIDER_REGISTRY[provider].systemApiKeyEnvVar]
//   BYOK keys must be stored in tenant_secrets (not config table) with field-level
//   encryption before shipping to production. See BYOK design note in handoff.md.
export const PROVIDER_REGISTRY = {
  anthropic: {
    type: "anthropic" as const,
    systemApiKeyEnvVar: "ANTHROPIC_API_KEY",
  },
  kimi: {
    type: "openai-compatible" as const,
    baseUrl: "https://api.moonshot.cn/v1",
    systemApiKeyEnvVar: "KIMI_API_KEY",
    // Kimi swarm: single API call, internal parallelism. No special invocation
    // parameter needed — swarm is the default behavior for compatible models.
    // Confirm current model ID at platform.moonshot.cn before wiring in.
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_REGISTRY;

// Default provider configuration for each agent.
// All agents use Anthropic Sonnet until per-agent tuning is informed by data.
// To switch an agent to a different provider, update its entry here (global
// default) or insert a config table override (per-tenant, no code change needed).
// Config key format: agent.provider.{agentName} | owner: "global" or tenantId.
//
// To switch compatibility_validator to Kimi once the API key is available:
//   compatibility_validator: { provider: "kimi", model: "moonshot-v1-8k" },
export const DEFAULT_PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  intake:                  { provider: "anthropic", model: "claude-sonnet-4-6" },
  orchestration:           { provider: "anthropic", model: "claude-sonnet-4-6" },
  security:                { provider: "anthropic", model: "claude-sonnet-4-6" },
  memoryState:             { provider: "anthropic", model: "claude-sonnet-4-6" },
  toolIntegration:         { provider: "anthropic", model: "claude-sonnet-4-6" },
  failureObservability:    { provider: "anthropic", model: "claude-sonnet-4-6" },
  trustControl:            { provider: "anthropic", model: "claude-sonnet-4-6" },
  compatibilityValidator:  { provider: "anthropic", model: "claude-sonnet-4-6" },
  skeptic:                 { provider: "anthropic", model: "claude-sonnet-4-6" },
  technicalWriter:         { provider: "anthropic", model: "claude-sonnet-4-6" },
};
