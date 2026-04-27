# Build Plan — Agent12

Spec is complete and reviewed. This is the build sequence.

Tech stack: TypeScript monorepo (pnpm workspaces), Next.js, BullMQ + Redis,
PostgreSQL, Drizzle ORM, Anthropic SDK, Vitest, Playwright.

---

## Phase 0 — Monorepo scaffolding

- Initialize pnpm workspaces
- Create packages: `web/`, `workers/`, `agents/`, `shared/`, `evals/`
- Configure TypeScript across all packages (shared tsconfig base)
- Set up Vitest as the unit/integration test runner in `shared/` and `agents/`
- Connect a test PostgreSQL database for integration tests
- Confirm: `pnpm test` runs with zero tests and zero failures

No application code yet. Just the skeleton.

---

## Phase 1 — Database schema

**Write tests first, then schema.**

1. Write integration tests for each table: correct columns, indexes, foreign key
   constraints, config resolution (tenant override falls back to global default)
2. Write the Drizzle schema (`packages/shared/src/db/schema.ts`) to make them pass
3. Run the initial migration
4. Verify all 4 required indexes exist

Tables: `users`, `runs`, `run_checkpoints`, `cv_result_cache`, `manifest_entries`,
`org_list`, `org_list_proposals`, `vendor_relationship_cache`, `config`,
`user_holds`, `admin_holds`, `jobs`

The schema is the foundation. Everything downstream reads or writes to it.

---

## Phase 2 — Agent layer

**Write Zod schemas and eval cases first, then implement callers.**

### 2a. Zod output schemas
For each agent, write the Zod schema that defines what the agent must return.
This is the agent contract — define it before any SDK call exists.

Agents: intake, orchestration, security, memory-state, tool-integration,
failure-observability, trust-control, compatibility-validator, skeptic,
technical-writer

### 2b. Unit tests (before callers)
For each Zod schema:
- Valid output passes validation
- Malformed output (wrong field name, missing required field, extra nesting) throws
  with the right error message
- Schema validation falls back gracefully (low-confidence state for intake agent)

### 2c. Eval cases (before callers, runs in Phase 3)
Write test cases in `packages/evals/` — known input descriptions paired with
expected output patterns — for the 12 eval targets from the eng review test plan.
Cases are defined now; execution waits until callers exist.

### 2d. Agent callers
Implement Anthropic SDK callers for each agent with 3-layer prompt caching:
- Layer 1: system prompt + specialist instructions (`cache_control: ephemeral`)
- Layer 2: full manifest as context (`cache_control: ephemeral`)
- Layer 3: verified context + upstream outputs (no cache)

Agent version format: `YYYY-MM-DD-{sha256_8chars}` of the prompt template file.
Computed at startup and stored in an in-memory registry.

---

## Phase 3 — Pipeline workers

**Write unit and integration tests first, then implement.**

### 3a. Checkpoint logic tests (before implementation)
- Context hash matches: checkpoint is reusable
- Agent version changed: checkpoint invalid
- Manifest refreshed: checkpoint invalid
- Upstream hash changed: checkpoint invalid (the 4th validity condition)
- All conditions met: agent skipped, cached output returned

### 3b. BullMQ flow integration tests (before wiring)
- FlowProducer creates Wave 1 jobs as children of Wave 2 parent
- Wave 2 waits for all Wave 1 children to complete before starting
- Wave 2.5 waits for Wave 2; Wave 3 waits for Wave 2.5
- Server restart: in-flight job resumes from last checkpoint

### 3c. Implement pipeline
Wire the BullMQ FlowProducer to the wave structure. Implement checkpoint
write/read. Implement retry/failure escalation per spec.

### 3d. Run evals
Execute the 12 eval cases from Phase 2c against the live agent callers.
Establish baselines. Any prompt change that breaks a baseline must be caught
before merging.

Pipeline can be verified by reading the database — no UI needed yet.

---

## Phase 4 — Web frontend

**E2E tests written alongside implementation (Playwright).**

### 4a. Auth
MFA, email verification, per-IP rate limiting on signup.
E2E: full signup flow, MFA enforcement, email verification gate.

### 4b. Intake flow
Spec Scaffold (both planning and mid-build prompts), 11-step TurboTax flow,
binary exclusion exhaustion warning, review screen with downstream re-inference.
E2E: full intake → submit → pipeline queued.

### 4c. Pass 1 output rendering
Mermaid.js diagram, free tier blurring (CV values blurred, category titles
visible), maturity label click-to-expand, Skeptic debate summary in exec summary.
E2E: free tier run shows blurred CV values; Pass 1 purchase reveals them.

### 4d. Run history
Diff view between runs, dropped-tool strikethrough + info icon, load past
context into new run.

### 4e. Wire frontend to pipeline
BullMQ job submission from Next.js API routes. Server-sent events for progressive
CV disclosure (stream per-tool results as sub-tasks complete; blur applied on
free tier runs in real time). Email notifications on run completion.

---

## Phase 5 — Admin dashboard

Six panels: pipeline observability (per-agent breakdown), manifest health,
org list approval workflow, active holds, user and billing management, run history.

Lower priority — can defer until the core pipeline is working and the first
users exist. Build the panels that matter first: pipeline observability and
margin per tier.

---

## Phase 6 — Maintenance pipeline

Manifest refresh (lazy trigger), Manifest Gatekeeper, Org List Gatekeeper.

Run on a hardcoded seed manifest through Phase 5. Build the maintenance
pipeline when there is enough usage data to know which tools need refreshing.

---

## TODOS.md P1 items (required before launch)

- Progressive CV disclosure: measure P50 latency before committing to SSE/WebSocket
- Skeptic eval set: build and baseline before any Skeptic prompt change ships
- Run Pack pricing: validate actual per-run cost against $1.80/run target

---

## First file to write

`packages/shared/src/db/schema.ts`
