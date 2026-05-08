# TODOS

## P1 — Required before launch

| Item | Why | Context | Effort | Depends on |
|---|---|---|---|---|
| Progressive CV disclosure latency validation | The streaming infrastructure (server-sent events / WebSocket) only pays off if per-tool sub-task P50 latency exceeds ~1.5s. Measure before committing to the streaming path. Also confirm CV architecture can emit results per-tool (not batched). | Added in CEO review 2026-04-26 | S | CV pipeline built |
| Skeptic eval set — build and baseline | A fixed set of architecture descriptions with known failure modes and expected caveat tiers. Runs on every Skeptic prompt change. Without this, quality regression after prompt changes is invisible until users report it. | Added in CEO review 2026-04-26 | M | Skeptic agent built |
| Run Pack pricing validation | Run Pack is set at $9 / 5 runs ($1.80/run). Validate that actual per-run cost (LLM tokens + search) is below $1.80 with typical cache hit rates. Adjust price at launch if cost data says otherwise. | Added in CEO review 2026-04-26 | S | Production runs measured |

## P3 — Post-traction

| Item | Why | Context | Effort | Depends on |
|---|---|---|---|---|
| API access tier | Enterprise teams want to embed recommendations into CI/CD, internal onboarding tools, and standards enforcement. Design the API input/output contract after seeing what paying users actually want to extract — not before. | Added in CEO review 2026-04-26 | L | Web product has traction; structured output schema stable |
| Seasonal and novelty theme UI | Enable admin to activate time-bounded themed experiences (pride mode, Christmas, rave mode) and expose a user-level opt-in alongside the light/dark toggle. Database schema is fully in place: custom_css on themes, valid_from/valid_until on theme_assignments, user_theme_preferences stub table. UI and resolution logic deferred. | Added 2026-04-30 | M | Admin themes panel built (Phase 5) |
| Marketing video strategy | Two-video structure: (1) Treehouse-style animated explainer showing the system analyzing a codebase, producing exec-summary consolidation plan, then magic-cutting to detailed spec+plan with zoom-ins on actual artifact content (a phase from a real plan, settled-decision callout, dependency graph), closing with animations of engineering teams executing on the spec and plan (positions the system as a multiplier, not a replacement). (2) Live-action voice-over comparison of agent12 cost and timeline vs typical consultancy migration ($100k-500k, 6-18 months, PowerPoint deliverables). The contrast makes the price point feel trivial. Engineer-persona watches first video, sends second video to their manager along with a Pass 1 output. Show actual artifact content in zoom-ins; abstract animations don't convert. | Added 2026-05-07 | M | First production runs available to record |
| LLM-based PR redteam automation | GitHub Action runs Claude on each PR diff with anti-doc framing. Catches subtle field-level integration drift that types and knip miss. ~$1/PR with caching. | Added 2026-05-07 | M | Phase 4 complete; meaningful E2E surface |
| Knip dead code detection | Configure knip (unused files / exports / deps) and add to CI. Deferred from Phase 3.4 because most current findings are Phase 4 entry-point scaffolding (false positives), and the audit-class bug it was sold to catch (tested-but-unwired) actually slips past knip. Revisit when Phase 4 lands and the scaffolding starts being consumed. | Added 2026-05-07 | S | Phase 4 frontend complete |
