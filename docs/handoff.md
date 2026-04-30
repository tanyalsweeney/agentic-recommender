# Handoff — Agentic Architecture Recommender

## Current state (2026-04-30)

Implementation underway. Phases 0, 1, 2, and 3 (a, b, c) complete and in PR #31 (pending merge).

**What's built:**
- Monorepo scaffolded: pnpm workspaces, TypeScript, Vitest workspace
- Database schema: 12 tables, 5 migrations applied, config resolution tested
- Agent layer: 10 Zod output schemas, 10 callers, 3-layer prompt caching, multi-provider dispatch
- Prompt templates for all 10 agents -- full prompt review pass complete (2026-04-29)
- Agent version registry (YYYY-MM-DD-{sha256_8chars} of prompt file)
- `domainKnowledgePayload` on `manifest_entries`: patterns and failure modes
- Six core failure modes seeded into `SEED_MANIFEST`
- `ManifestCandidate` structured output on memory-state and tool-integration agents
- `vetted` boolean on `manifest_entries`
- Multi-provider abstraction layer: `PROVIDER_REGISTRY`, `ProviderConfig`, `DEFAULT_PROVIDER_CONFIGS`,
  Anthropic and OpenAI-compatible dispatch. CV ready to swap to Kimi.
- Filtered manifest per agent: `filterManifest()`, 20-80% token reduction per call
- `manifest_entries`: `deploymentModel`, `minimumRuntimeRequirements`, `knownConstraints`
  replaced `platformCompat` / `modelCompat` (those invited CV to shortcut tool-pair validation)
- CV prompt: manifest fields are floors, CV reasons beyond them from first principles
- Phase 3 workers (PR #31):
  - `checkpoint.ts`: readCheckpoint/writeCheckpoint, 4-condition reuse, model in agentVersion
  - `key-resolution.ts`: getApiKey, tenant key first, system env fallback
  - `flows/pipeline.ts`: buildPipelineFlowSpec, correct BullMQ FlowProducer hierarchy
  - `runner.ts`: shared runAgent() -- provider resolution, checkpoint check, agent call, write
  - `workers/wave1–4, pass1`: all wave processors
  - `queues.ts`: dispatcher + submitRun()
  - `tenant-context.ts`: loadTenantContext(), injectTenantContext(), computeTenantContextVersion()
  - `startup.ts`: seedProviderConfigs() on worker startup
- Tenant context injection replaces Wave 0 concept entirely (migration 0005, spec.md updated)
- 77 unit tests passing (shared: 11, agents: 47, workers: 19)

**Local dev:** Docker running (Postgres :5432, Redis :6379). `.env.local` complete.

## What's immediately next

**Phase 3d: Run evals against live callers, establish baselines.**
This must happen before Phase 4 (frontend). Reasons:
- Evals establish baselines. Frontend development will trigger prompt changes.
  Without baselines, prompt changes are blind -- no regression detection.
- Pipeline output shape must be validated before frontend is built on it.
- CLAUDE.md requirement: every Skeptic prompt change validated against baseline before merging.

To run: `pnpm --filter evals eval:skeptic` (P1 baseline), then each other eval suite.
Eval cases are in `packages/evals/src/`. Each suite has a `vitest.config.ts` entry.

**After 3d baseline established:** Phase 4 (web frontend).

## Deployment requirements

- Apply migration 0005 to prod DB before any production traffic: `pnpm db:migrate`
- **Redis AOF persistence must be enabled** in Railway Redis settings before production traffic.
  BullMQ job durability depends on it. Without it, in-flight runs are lost on worker restart.

## Architecture decisions made this session (2026-04-30)

**Tenant context (formerly Wave 0):** Wave 0 as a pipeline concept is retired. Tenant-specific
domain context is pre-registered structured data (regulatory controls, prohibited tools,
certifications) injected into verifiedContext before Wave 1. Not a BullMQ job. Versioned using
the same `YYYY-MM-DD-{hash8}` pattern as agent versions, stored at write time, validated in
checkpoint `upstreamHashes`. Block update automatically invalidates affected checkpoints.

**Manifest facts vs conclusions:** `platformCompat` and `modelCompat` removed permanently.
CV derives compatibility conclusions from first principles; manifest stores facts
(`deploymentModel`, `minimumRuntimeRequirements`, `knownConstraints`) as floors, not answers.

**Multi-provider:** All agents default to Anthropic Sonnet. CV entry in `providers.ts` is
copy/paste ready to swap to Kimi swarm when API key is available.

## BYOK design (bring your own key)

- Per-agent provider config (DB): `{ provider: "kimi", model: "moonshot-v1-8k" }`
- Provider registry (code): maps provider name to base URL and system env var
- Runtime key resolution: `getApiKey(provider, tenantId)` checks tenant key first,
  falls back to `process.env[systemApiKeyEnvVar]`

**Non-negotiable before BYOK ships:**
1. Tenant keys in `tenant_secrets` with field-level encryption, NOT the config table
2. Key validation against provider API before storage
3. Data residency flagging (Kimi = Moonshot AI, China)
4. Audit trail: log platform key vs. tenant key per run (never log the key itself)

## Product design decisions (sleeping on / not yet implemented)

**Multi-tenancy schema:** Structural work solid (owner columns, config resolution).
Application not yet multi-tenant. Three things close the gap: `tenants` table,
`tenant_id` on `users`, tenant context threaded from auth to every `getConfig` and agent call.
Decision deferred -- user wanted to sleep on this.

**Communication context templates:** The Technical Writer's output is shaped by
audience x purpose, not audience alone. Named communication context templates
(e.g., "Consulting / Client Deliverable") curated by Agent12, selected by tenant.
Design agreed. No templates built yet.

**Branding / white-label:** Three tiers: Standard (attribution required), Premium
(optional), Enterprise (full white-label, liability transfer in contract).
Design agreed. Not implemented.

## Prompt review -- complete (2026-04-29)

All 10 agents reviewed. Key changes:
- Prime directive: cover what senior engineers anticipate (completeness), then surface
  what they would not find until deep into implementation (value). Both matter.
- First-principles trip hazard reasoning: manifest as floor, not ceiling
- Domain-specific failure mode named for each agent

## Open questions

- Multi-tenancy schema: sleeping on it.
- Communication context template library: design agreed, not built.
- Manifest seeder: design agreed (cloud engineer tool catalog scope), not started.
  Prerequisite for production quality output. Build after Phase 3d baselines.

## Collaboration notes

- No em dashes in any written output. Use commas, colons, or parentheses instead.
  Prefer short sentences. Applies to responses AND prompt files.
- Push back by default when something is off. User explicitly requested this.
- User is growing as an agentic engineer and architect. Honest pushback, not generous credit.
- User has strong UX instincts rooted in React engineering background. Reliable.
- User responds well to "show value early, minimize friction" as a design principle.
- User's standard for agent rigor: cover what senior engineers anticipate, then surface
  what they would not find until deep into implementation. Both matter.
- User wakes up with insight -- sleep on hard decisions before finalizing.
- First user: husband (Sr. Data Scientist, Microsoft, award-winning). His team
  incorporated Pass 1 output into a real project.
- Target users: senior technical builders doing agentic work, outpaced by the ecosystem.
- No marketing language in written output.
- User follows general-audience AI news, not deep technical press.
- LinkedIn newsletter documenting this build. Drafts at ~/Desktop/blog entries/.
  Claude.ai handles newsletter; Claude Code handles implementation.
- Old codebase exists but is deliberately excluded.
