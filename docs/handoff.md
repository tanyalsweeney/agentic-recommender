# Handoff — Agentic Architecture Recommender

## Current state (2026-04-29)

Implementation underway. Phases 0, 1, and Phase 2 (a, b, c) complete and on main.

**What's built:**
- Monorepo scaffolded: pnpm workspaces, TypeScript, Vitest workspace
- Database schema: 12 tables, migrations applied, config resolution tested
- Agent layer: 10 Zod output schemas, 10 callers with 3-layer prompt caching
- Prompt templates for all 10 agents — full prompt review pass complete (2026-04-29)
- Agent version registry (YYYY-MM-DD-{sha256_8chars} of prompt file)
- `implementationTripHazards` as first-class structured output on all 6 recommendation agents
- `domainKnowledgePayload` on `manifest_entries`: stores per-category knowledge for
  patterns and failure modes (renamed from `pattern_meta`)
- Six core failure modes seeded into `SEED_MANIFEST` as `category = 'failure_mode'`
- `ManifestCandidate` structured output on memory-state and tool-integration agents
- `vetted` boolean on `manifest_entries` (default true; unvetted candidates written false)
- Multi-provider abstraction layer: `PROVIDER_REGISTRY`, `ProviderConfig` schema,
  per-agent `DEFAULT_PROVIDER_CONFIGS`, Anthropic and OpenAI-compatible dispatch in
  `base.ts`. All 10 callers updated. CV ready to swap to Kimi (see providers.ts comment).
- Filtered manifest per agent: `filterManifest()` in `base.ts`, each caller receives
  only the sections its agent needs (20-80% token reduction per call)
- `manifest_entries` schema rethought: `platformCompat` and `modelCompat` removed (they
  invited CV to shortcut true tool-pair validation). Replaced with:
  - `deploymentModel` (text): how the tool is consumed -- fact, not conclusion
  - `minimumRuntimeRequirements` (jsonb): floor the CV reasons beyond, not a ceiling
  - `knownConstraints` (jsonb): documented hard limits; CV also surfaces its own findings
- CV prompt updated: manifest fields are floors, CV reasons beyond them from first principles
- 58 unit tests passing

**Local dev:** Docker running (Postgres :5432, Redis :6379). `.env.local` complete.

## What's immediately next

**Phase 3: BullMQ pipeline workers.** Wave orchestration, checkpoint logic. Workers must:
- Seed `DEFAULT_PROVIDER_CONFIGS` into config table on first startup
  (key format: `agent.provider.{agentName}` | owner: `'global'`)
- Append model to `agentVersion` when writing checkpoints:
  format `YYYY-MM-DD-{hash}/{model}` so model changes invalidate checkpoint reuse
- Implement `getApiKey(provider, tenantId)` as the single API key resolution point
- Apply migration 0004 to prod DB before deploy (`pnpm db:migrate`)

**Deployment requirement -- Redis AOF persistence:** Production Redis must have AOF
(Append-Only File) persistence enabled. This is what backs the BullMQ durability
guarantee -- jobs survive worker restarts because Redis preserves job state to disk.
Without it, an in-flight run is lost on restart. Configure in Railway Redis settings
before any production traffic. Application-level checkpoint reuse is tested; this is
the infrastructure requirement that makes it hold end-to-end.

**Manifest pipeline -- prerequisite for any working product.** Agreed scope: tools a
cloud engineer sees when logging into AWS or Azure. Cloud-native managed services plus
major third-party ecosystem tools at the same documentation and stability bar.
Maintenance: quarterly with event-driven updates for GA announcements and CVEs.
Seeding approach: a Manifest Seeder runs against cloud provider catalogs, produces
draft entries, flags each for Gatekeeper review before `vetted` is set true. CV's
capability set is the right foundation for the seeder.

**Multi-tenancy -- sleeping on it.** Structural work is solid (owner columns, config
resolution). Application is not yet multi-tenant. Three things close the gap: `tenants`
table, `tenant_id` on `users`, tenant context threaded from auth to every `getConfig`
and agent call. Decision deferred to next session.

## Product design decisions (2026-04-29)

**Communication context templates.** The Technical Writer's output is shaped by
audience x purpose, not audience alone. A Slalom consultant presenting to an exec to
win a contract needs a different document than a CSM helping a low-tech exec integrate
a product -- same audience, different purpose, different document. The unit is a named
communication context template (e.g., "Consulting / Client Deliverable", "Executive /
Architecture Approval"), curated by Agent12, selected by tenant. Tenants do not write
free-form prompts -- they select from the library or commission a custom template.

Pass 1 default: exec as primary, engineering as close second.
Pass 2 default: engineering as primary.

**Branding and white-labeling.** Three tiers:
- Standard: "powered by Agent12" attribution required
- Premium: optional attribution
- Enterprise: full white-label, liability transfer in contract

Before BYOK and white-label ship: `tenant_secrets` table with field-level encryption
(not the config table), key validation at intake, data residency flagging, audit trail.

**CV as core differentiator -- no pre-stored compatibility conclusions.** `platformCompat`
and `modelCompat` removed permanently. Manifest stores facts; CV derives conclusions.
This is non-negotiable design.

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

## Prompt review -- complete

All 10 agent prompts reviewed and merged. Key changes applied across all:
- Prime directive: cover what senior engineers anticipate (completeness), then surface
  what they would not find until deep into implementation (value). Both matter.
- First-principles trip hazard reasoning: manifest as floor, not ceiling
- Domain-specific failure modes named for each agent

Individual agent notes:
- Orchestration: hazard reasoning flipped to first-principles-first
- Security: enterprise signal detection, conservative posture, Pass 1 / Pass 2 structure
- Memory & State: over-persistence as named failure mode, PII/retention, agent state seams
- Tool & Integration: over-tooling as named failure mode, manifest candidates, MCP guidance
- F&O: failure modes as cross-reference floor, cooperative T&C cycle, eval strategy example
- Trust & Control: gates-that-don't-gate as named failure mode
- Skeptic: cross-agent tension standard, 4-cycle cap, counter-argument guidance
- Technical Writer: dual-audience prime directive (exec: approve? engineer: need Pass 2?)

## Open questions

- Multi-tenancy schema: sleeping on it. Revisit next session.
- Manifest seeder: design agreed, implementation not started.
- Communication context template library: design agreed, no templates built yet.

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
