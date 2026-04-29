# Handoff — Agentic Architecture Recommender

## Current state (2026-04-29)

Implementation underway. Phases 0, 1, and Phase 2 (a, b, c) complete and on main.

**What's built:**
- Monorepo scaffolded: pnpm workspaces, TypeScript, Vitest workspace
- Database schema: 12 tables, 4 indexes, migrations applied, config resolution tested
- Agent layer: 10 Zod output schemas, 12 eval cases, 10 Anthropic SDK callers with 3-layer prompt caching
- Prompt templates for all 10 agents — full prompt review pass complete (2026-04-29)
- Agent version registry (YYYY-MM-DD-{sha256_8chars} of prompt file)
- `implementationTripHazards` as first-class structured output on all 6 recommendation agents
- `domainKnowledgePayload` column on `manifest_entries` (renamed from `pattern_meta`): stores per-category structured knowledge for patterns and failure modes
- Six core failure modes seeded into `SEED_MANIFEST` as `category = 'failure_mode'` entries
- `ManifestCandidate` structured output on memory-state and tool-integration agents
- `vetted` boolean on `manifest_entries` (default true; unvetted candidates written false by worker)
- `ProviderConfig` Zod schema: provider abstraction layer in progress (see below)
- 52 unit tests passing

**Local dev:** Docker running (Postgres :5432, Redis :6379). `.env.local` complete.

## What's immediately next

**Provider abstraction layer — in progress.** `ProviderConfig` Zod schema added to agents
`shared.ts`. Implementation continues: `providers.ts`, `base.ts` rewrite, caller updates,
eval updates. See open PRs for context.

**After provider abstraction:** Phase 3 (BullMQ pipeline workers, wave orchestration,
checkpoint logic). Workers must:
- Seed `DEFAULT_PROVIDER_CONFIGS` into config table on first startup
- Append model identifier to `agentVersion` when writing checkpoints
  (format: `YYYY-MM-DD-{hash}/{model}`, e.g. `2026-04-29-abc12345/claude-sonnet-4-6`)
  so model changes invalidate checkpoint reuse
- Implement `getApiKey(provider, tenantId)` as the single resolution point for API keys
  (see BYOK design note below)

**Fast follow after Phase 3:** Filtered manifest per agent. Currently all agents receive
the full manifest (~8,000-10,000 tokens). Agents should receive only the manifest
sections relevant to their domain. This reduces token cost for all agents, especially
for OpenAI-compatible providers that don't benefit from prompt caching.

## BYOK design (bring your own key)

Tenants may provide their own API keys for direct provider spend. Agreed design:

- Per-agent provider config (DB): `{ provider: "kimi", model: "moonshot-v1-8k" }`
- Provider registry (code): maps provider name to base URL and system env var
- Runtime key resolution: `getApiKey(provider, tenantId)` checks for tenant key first,
  falls back to system env var. This interface must be satisfied before BYOK ships.

**Non-negotiable requirements before BYOK ships to production:**
1. Tenant API keys must NOT be stored in the general config table. Use a dedicated
   `tenant_secrets` table with field-level encryption, or an external secrets manager
   (AWS Secrets Manager, GCP Secret Manager). The config table is not a secrets store.
2. Key validation before storage: test the key against the provider API before accepting.
   A silently stored bad key means every run fails with a confusing error.
3. Data residency flag: some providers (Kimi = Moonshot AI, China) have data residency
   implications. Surface this clearly during key intake and support per-tenant provider
   allowlists.
4. Audit trail: log whether a run used a platform key or a tenant key (not the key itself).

## Prompt review — complete

All 10 agent prompts reviewed and merged. Key changes applied across all:
- Prime directive standard: cover what senior engineers anticipate (completeness), then
  surface what they would not find until deep into implementation (value)
- First-principles trip hazard reasoning: manifest as floor, not ceiling
- Domain-specific failure modes named for each agent
- Pass 1 / Pass 2 structure on security agent

Individual agent notes:
- Orchestration: hazard reasoning flipped to first-principles-first, manifest as cross-check
- Security: enterprise signal detection, conservative posture, BYOK-aware constraint declaration
- Memory & State: over-persistence as named failure mode, PII/retention section, agent state seams
- Tool & Integration: over-tooling as named failure mode, manifest candidates, MCP guidance
- Failure & Observability: failure modes from manifest (cross-reference, not checklist),
  cooperative cycle with T&C documented, eval strategy example added
- Trust & Control: gates-that-don't-gate as named failure mode
- Skeptic: cross-agent tension standard, cycle cap, counter-argument guidance
- Technical Writer: dual-audience prime directive (exec: approve? engineer: need Pass 2?)

## Open questions

None on the spec.

## Collaboration notes

- No em dashes in any written output. Use commas, colons, or parentheses instead.
- Prefer short sentences over em dashes -- applies to prompt files too.
- Push back by default when something is off. User explicitly requested this.
- User is growing as an agentic engineer and architect. Give honest pushback, not generous credit.
- User has strong UX instincts rooted in React engineering background. Reliable.
- User responds well to "show value early, minimize friction" as a design principle.
- User's standard for agent rigor: cover what senior engineers anticipate, then surface
  what they would not find until deep into implementation. Both matter.
- First user: husband (Sr. Data Scientist, Microsoft, award-winning). He explicitly asked
  for the tool. His team incorporated Pass 1 output into a real project.
- Target users: senior technical builders doing agentic work, outpaced by how fast the
  ecosystem moves.
- No marketing language in written output.
- User follows general-audience AI news, not deep technical press.
- User is publishing a LinkedIn newsletter documenting this build. Drafts at
  ~/Desktop/blog entries/. Claude.ai handles newsletter; Claude Code handles implementation.
- Old codebase exists but is deliberately excluded.
