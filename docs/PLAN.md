# Build Plan — Agent12

Spec is complete and reviewed. This is the build sequence.

Tech stack: TypeScript monorepo (pnpm workspaces), Next.js, BullMQ + Redis,
PostgreSQL, Drizzle ORM, Anthropic SDK, Vitest, Playwright.

---

## Phase 0 — Monorepo scaffolding `[Done]`

- Initialize pnpm workspaces
- Create packages: `web/`, `workers/`, `agents/`, `shared/`, `evals/`
- Configure TypeScript across all packages (shared tsconfig base)
- Set up Vitest as the unit/integration test runner in `shared/` and `agents/`
- Connect a test PostgreSQL database for integration tests
- Confirm: `pnpm test` runs with zero tests and zero failures

No application code yet. Just the skeleton.

---

## Phase 1 — Database schema `[Done]`

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

## Phase 2 — Agent layer `[Done]`

**Write Zod schemas and eval cases first, then implement callers.**

### 2a. Zod output schemas `[Done]`
For each agent, write the Zod schema that defines what the agent must return.
This is the agent contract — define it before any SDK call exists.

Agents: intake, orchestration, security, memory-state, tool-integration,
failure-observability, trust-control, compatibility-validator, skeptic,
technical-writer

### 2b. Unit tests (before callers) `[Done]`
For each Zod schema:
- Valid output passes validation
- Malformed output (wrong field name, missing required field, extra nesting) throws
  with the right error message
- Schema validation falls back gracefully (low-confidence state for intake agent)

### 2c. Eval cases (before callers, runs in Phase 3d) `[Done]`
Write test cases in `packages/evals/` — known input descriptions paired with
expected output patterns — for the 12 eval targets from the eng review test plan.
Cases are defined now; execution waits until callers exist.

### 2d. Agent callers `[Done]`
Implement Anthropic SDK callers for each agent with 3-layer prompt caching:
- Layer 1: system prompt + specialist instructions (`cache_control: ephemeral`)
- Layer 2: full manifest as context (`cache_control: ephemeral`)
- Layer 3: verified context + upstream outputs (no cache)

Agent version format: `YYYY-MM-DD-{sha256_8chars}` of the prompt template file.
Computed at startup and stored in an in-memory registry.

---

## Phase 3 — Pipeline workers

### 3a. Checkpoint logic tests `[Done]`
- Context hash matches: checkpoint is reusable
- Agent version changed: checkpoint invalid
- Manifest refreshed: checkpoint invalid
- Upstream hash changed: checkpoint invalid (the 4th validity condition)
- All conditions met: agent skipped, cached output returned

### 3b. BullMQ flow integration tests `[Done]`
- FlowProducer creates Wave 1 jobs as children of Wave 2 parent
- Wave 2 waits for all Wave 1 children to complete before starting
- Wave 2.5 waits for Wave 2; Wave 3 waits for Wave 2.5
- Server restart: in-flight job resumes from last checkpoint

### 3c. Implement pipeline `[Done]`
Wave structure wired via BullMQ FlowProducer. Checkpoint write/read implemented
with 4-condition reuse. Retry/failure escalation per spec.

Tenant context (formerly Wave 0): pre-registered structured data (regulatory
controls, prohibited tools, certifications) injected into verifiedContext before
Wave 1. Not a BullMQ job. Versioned using the `YYYY-MM-DD-{hash8}` pattern,
stored at write time, validated in checkpoint upstreamHashes.

### 3d. Run evals `[Next]`
Execute the 12 eval cases from Phase 2c against the live agent callers.
Establish baselines. Any prompt change that breaks a baseline must be caught
before merging.

Run: `pnpm --filter evals eval:skeptic` (P1 baseline required), then each
other eval suite. Pipeline output verified by reading the database — no UI needed.

### 3e. Multi-tenancy schema `[Upcoming]`
Multi-tenancy is in scope for initial rollout. Close the schema gap before
any Phase 4 frontend work begins.

1. Add `tenants` table (id, name, slug, plan, created_at)
2. Add `tenant_id` to `users` table
3. Add `tenant_secrets` table for BYOK keys (field-level encryption, never in
   config table)
4. Add `themes` table (id, name, owner, token_map flat jsonb, custom_css nullable
   text, version, status). Seed eight global rows: default_light, default_dark,
   professional_light, professional_dark, minimal_light, minimal_dark, bold_light,
   bold_dark
5. Add `theme_assignments` table (id, owner, mode, theme_id, token_overrides flat
   jsonb, logo_url, status, version, valid_from nullable, valid_until nullable).
   Seed two global assignments: light → default_light, dark → default_dark
6. Add `user_theme_preferences` stub table (user_id, theme_id, activated_at,
   expires_at nullable) — schema only, no resolution logic yet
7. Seed `ui.string.*` global defaults in config table (productName, tagline,
   ctaLabel, section headers)
8. Set up Vercel Blob for tenant logo uploads
9. Thread `tenant_id` from auth through every `getConfig` call and agent invocation
10. Integration tests: tenant isolation; theme version updates when token_map or
    custom_css changes; mode lock when one assignment present; time-bounded
    assignment inactive outside valid_from/valid_until window

---

## Phase 4 — Web frontend `[Upcoming]`

**E2E tests written alongside implementation (Playwright).**

### 4a. Auth `[Upcoming]`
MFA, email verification, per-IP rate limiting on signup. Tenant-aware from day one:
every session carries tenant_id; every API route and getConfig call passes it through.
E2E: full signup flow, MFA enforcement, email verification gate.

### 4b. Intake flow `[Upcoming]`
Spec Scaffold (both planning and mid-build prompts), 11-step TurboTax flow,
binary exclusion exhaustion warning, review screen with downstream re-inference.

Intake UI is theme-aware from day one. At layout level, the server resolves the
active theme for the owner and mode, merges token overrides, and injects CSS
custom properties (plus any custom_css) as a server-rendered style block. Cache
key: `theme:resolved:{owner_id}:{mode}:{assignment_version}` — no explicit flush
needed. If the owner has one mode assigned, the UI locks to it with no toggle.

E2E: full intake → submit → pipeline queued.

### 4c. Pass 1 output rendering `[Upcoming]`
Mermaid.js diagram, free tier blurring (CV values blurred, category titles
visible), maturity label click-to-expand, Skeptic debate summary in exec summary.
E2E: free tier run shows blurred CV values; Pass 1 purchase reveals them.

### 4d. Run history `[Upcoming]`
Diff view between runs, dropped-tool strikethrough + info icon, load past
context into new run.

### 4e. Wire frontend to pipeline `[Upcoming]`
BullMQ job submission from Next.js API routes. Server-sent events for progressive
CV disclosure (stream per-tool results as sub-tasks complete; blur applied on
free tier runs in real time). Email notifications on run completion.

---

## Phase 5 — Admin dashboard `[Upcoming]`

Eight panels. Build pipeline observability first — it's the foundation for
understanding every run, including demo runs.

**Pipeline observability:** per-agent latency breakdown, wave timing, checkpoint
hit/miss rates, token usage and cost per run.

**Manifest health:** entry freshness, missing domainKnowledgePayload, vetted
status, tools flagged for refresh.

**Themes:** manage system presets and the base app default theme. Create, edit,
and publish global theme presets. Supports time-bounded seasonal themes via
valid_from/valid_until. Changes take effect on next page load via the
version-based cache key — no deploy required.

**Config interface:** view and edit system-level config table values (including
ui.string.* global defaults), provider registry (add/edit provider entries,
assign models per agent), and manifest seeding. Tenant config overrides are
visible per-tenant but edited from the tenant dashboard.

**Org list approval workflow:** review org_list_proposals, approve/reject, view
active list.

**Tenant management:** view all tenants, plan tier, usage, billing status, active
holds. Read-only tenant impersonation for support.

**User and billing management:** user search, hold management, refund/credit
tooling.

**Run history:** full cross-tenant run log with filter by tenant, agent, wave,
status.

---

## Phase 6 — Tenant dashboard and config interface `[Upcoming]`

Tenant-facing interface for run management and configuration. Admin dashboard
(Phase 5) must be complete before this phase begins.

**Tenant dashboard:**
- Run history scoped to tenant
- Per-run cost and token breakdown
- Active holds and status

**Tenant config interface:**
- Tenant context management: register/update regulatory controls, prohibited
  tools, certifications injected into verifiedContext before Wave 1
- BYOK key management: add/rotate/revoke provider API keys (stored in
  tenant_secrets with field-level encryption); key validated against provider
  API before storage; data residency flag shown for non-US providers
- Communication context template selection: choose the audience/purpose template
  that shapes Technical Writer output
- Branding: preset picker (select from global presets for each mode); token
  overrides for color, font, and radius tokens; logo upload via Vercel Blob;
  string overrides for product name, tagline, button labels, and section headers
  (stored in config table under ui.string.*); draft/publish workflow so changes
  can be previewed before going live
- White-label tier settings: Standard (Agent12 attribution required), Premium
  (attribution optional), Enterprise (custom domain, full attribution removal,
  liability transfer in contract)

---

## Phase 7 — Maintenance pipeline `[Upcoming]`

Manifest refresh (lazy trigger), Manifest Gatekeeper, Org List Gatekeeper.

Run on a hardcoded seed manifest through Phase 6. Build the maintenance
pipeline when there is enough usage data to know which tools need refreshing.

---

## TODOS.md P1 items (required before launch)

See [TODOS.md](TODOS.md) for full context.

- Progressive CV disclosure: measure P50 latency before committing to SSE/WebSocket
- Skeptic eval set: build and baseline before any Skeptic prompt change ships
- Run Pack pricing: validate actual per-run cost against $1.80/run target
