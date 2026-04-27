# agentic-recommender

Agent12 — a multi-wave agentic pipeline that takes a description of an agentic system
and produces a validated architecture recommendation. See spec.md for the full product
spec and PLAN.md for the build sequence.

## Skills

gstack is installed globally at `~/.claude/skills/gstack`. Run `/gstack-upgrade` to update.

Key skills: `/review`, `/qa`, `/ship`, `/design`, `/investigate`, `/learn`, `/health`, `/plan-tune`, `/retro`, `/canary`, `/guard`, `/codex`, `/autoplan`, `/pair-agent`.

---

## Tech stack

TypeScript throughout. pnpm workspaces monorepo.

| Package | Purpose |
|---|---|
| `packages/web/` | Next.js App Router — frontend + quick API routes (auth, intake, run history) |
| `packages/workers/` | BullMQ workers — long-running pipeline execution, no timeout limits |
| `packages/agents/` | Prompt templates, Zod output schemas, Anthropic SDK callers |
| `packages/shared/` | Drizzle ORM schema, DB client, config resolution, shared TypeScript types |
| `packages/evals/` | LLM quality evals — Vitest + real API, manual trigger only, never in CI |

Infrastructure: PostgreSQL (all persistent data), Redis (BullMQ job queue).

---

## Local development

**Prerequisites:** Docker Desktop (docker.com/products/docker-desktop — free, Mac app).

**Start services:**
```bash
docker compose up -d        # starts Postgres on :5432 and Redis on :6379
```

**Stop services:**
```bash
docker compose down         # stops containers (data is preserved in postgres_data volume)
docker compose down -v      # stops and deletes all data (full reset)
```

**Environment variables:**
```bash
cp .env.example .env.local  # do this once, then fill in ANTHROPIC_API_KEY and AUTH_SECRET
```

Connection strings for local dev are pre-filled in `.env.example` and match
`docker-compose.yml` exactly. Do not change the ports unless you have a conflict.

**Deployment:** Vercel (Next.js web app) + Railway (BullMQ workers + Postgres + Redis).
Local dev uses Docker; production uses Railway-managed Postgres and Redis. The
`DATABASE_URL` and `REDIS_URL` environment variables are the only thing that changes
between environments.

---

## Non-negotiable rules

### Prompt caching — required on every Anthropic SDK call

Every agent caller must use a 3-layer cache structure. No exceptions.

```
Layer 1: system prompt + specialist instructions  →  cache_control: { type: "ephemeral" }
Layer 2: full manifest passed as context          →  cache_control: { type: "ephemeral" }
Layer 3: verified context + upstream outputs      →  no cache_control (changes per run)
```

Cache reads cost 10% of normal input token price. Skipping this on any agent makes the
free tier unprofitable. Implement from the first agent caller, not as a retrofit.

### Zod schemas — required on every agent output

Every agent in `packages/agents/src/schemas/` has a Zod schema for its output.
Every Anthropic SDK call runs the response through the schema before returning.
A mismatch throws immediately with the field name — do not swallow or log-and-continue.

Intake agent malformed output: fall back to low-confidence state (nothing pre-selected)
for the affected step rather than crashing the intake flow.

### Agent versioning

Agent version = `YYYY-MM-DD-{sha256_8chars}` of the prompt template file.
Computed at worker startup and stored in an in-memory registry.
Never hardcode a version string. Never manually bump a version.
If the prompt file changes, the hash changes automatically.

### No reasoning in the UI layer

Next.js renders and captures. All reasoning lives in `packages/agents/` and
`packages/workers/`. API routes submit jobs and return results — they do not call
the Anthropic SDK directly.

### Config resolution — always check tenant override first

```typescript
// Always this pattern — never skip the tenant lookup:
async function getConfig(key: string, tenantId?: string): Promise<string> {
  if (tenantId) {
    const override = await db.query.config.findFirst({
      where: and(eq(config.key, key), eq(config.owner, tenantId))
    });
    if (override) return override.value;
  }
  const global = await db.query.config.findFirst({
    where: and(eq(config.key, key), eq(config.owner, 'global'))
  });
  return global!.value;
}
```

---

## Agent pipeline (summary)

```
Wave 0   Domain agents (conditional, tenant-registered)
Wave 1   Orchestration | Security | Memory & State | Tool & Integration  (parallel)
Wave 2   Failure & Observability + Trust & Control  (cooperative, 2-cycle cap)
Wave 2.5 Compatibility Validator:
           per-tool sub-tasks (parallel)
           → cross-agent conflict checks (structural, no web search)
           → cross-tool compatibility checks (scoped to surviving tool set)
Wave 3   The Skeptic (4-cycle cap)
Pass 1   Technical Writer
Pass 2   Six synthesis agents (user-initiated)
```

BullMQ FlowProducer maps to the wave structure. Wave 1 agents are children of a
Wave 2 parent job; Wave 2 is a child of Wave 2.5; Wave 2.5 is a child of Wave 3.

### Checkpoint reuse (4 conditions — all must hold)

A persistent checkpoint is reusable when:
1. Verified context hash is identical
2. Agent version is unchanged
3. Manifest has not been refreshed
4. All upstream checkpoint hashes match (stored in `upstream_hashes` jsonb field)

If any condition fails, the agent re-runs and overwrites the checkpoint.

---

## Testing rules

- Write tests before code at every phase where possible
- Unit and integration tests: Vitest in `packages/shared/` and `packages/agents/`
- Integration tests hit a real test PostgreSQL database — no mocks for DB queries
- LLM evals: `packages/evals/` with Vitest + real Anthropic API, run manually before
  any prompt change, never in CI
- E2E tests: Playwright, written alongside Phase 4 frontend implementation

### Eval discipline

The Skeptic eval set is a P1 launch requirement. Every Skeptic prompt change must
be validated against the baseline before merging. Run: `pnpm --filter evals eval:skeptic`

---

## Database rules

- Drizzle ORM only — no raw SQL unless there is no Drizzle equivalent
- All 12 tables are defined in `packages/shared/src/db/schema.ts`
- All 4 required indexes are in the initial migration — do not add indexes in later
  migrations if they can go in the first one
- `owner` column on `manifest_entries`, `org_list`, and `config` defaults to `'global'`
  — this is the multi-tenancy forward design; do not remove it

---

## Key decisions (see spec.md Settled decisions for full context)

- Manifest query: full load for v1 (all agents receive the full manifest)
- Agent output schemas: Zod, validated at call time
- Prompt caching: 3-layer, explicit cache_control, required from day 1
- Pipeline durability: BullMQ + Redis, jobs survive server restarts
- Free tier: 3 runs/day, CV values blurred (category titles visible)
- Pass 1: $49/run | Pass 2: $199/run | Run Pack: $9/5 runs
