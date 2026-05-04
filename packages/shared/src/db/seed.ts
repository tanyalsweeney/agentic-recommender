/**
 * Manifest and org list seeder.
 * Idempotent — safe to re-run. Existing entries are skipped via onConflictDoNothing.
 * Run with: pnpm --filter shared db:seed
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { manifestTools, manifestPatterns, manifestFailureModes, orgList, themes, themeAssignments, config } from "./schema.js";
import { computeThemeVersion } from "./themes.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const client = postgres(url);
const db = drizzle(client);

// ── Tools ─────────────────────────────────────────────────────────────────────

const TOOLS: Array<typeof manifestTools.$inferInsert> = [
  // ── Orchestration frameworks ────────────────────────────────────────────────
  {
    toolName: "langchain",
    category: "orchestration-framework",
    maturityTier: "Established",
    confidenceScore: 9,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.9" },
    knownConstraints: null,
    adoptionSignals: { organizations: ["Anthropic", "Google", "Microsoft", "Cohere", "Hugging Face"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "LangChain Inc. commercial support available" },
  },
  {
    toolName: "langgraph",
    category: "orchestration-framework",
    maturityTier: "Established",
    confidenceScore: 8,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.9" },
    knownConstraints: [
      "Graph state must be explicitly defined — implicit state sharing between nodes is not supported",
      "Cycles require explicit termination conditions; unbounded loops will exhaust token budget silently",
    ],
    adoptionSignals: { organizations: ["LangChain", "Replit", "LinkedIn"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "LangChain Inc. commercial support available" },
  },
  {
    toolName: "crewai",
    category: "orchestration-framework",
    maturityTier: "Emerging",
    confidenceScore: 6,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.10" },
    knownConstraints: [
      "Role definitions are prompt-level only — no runtime enforcement of agent scope",
      "Memory between crew runs requires explicit configuration; default is stateless",
    ],
    adoptionSignals: { organizations: ["CrewAI", "Various startups"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: null },
  },
  {
    toolName: "autogen",
    category: "orchestration-framework",
    maturityTier: "Emerging",
    confidenceScore: 6,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.8" },
    knownConstraints: [
      "Conversation termination conditions must be explicitly defined — default behavior allows indefinite exchange",
      "Human-in-the-loop mode requires synchronous interaction; async HITL is not natively supported",
    ],
    adoptionSignals: { organizations: ["Microsoft", "Various research teams"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Microsoft open-source project with active maintainers" },
  },
  {
    toolName: "haystack",
    category: "orchestration-framework",
    maturityTier: "Established",
    confidenceScore: 7,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.8" },
    knownConstraints: [
      "Pipeline serialization format (YAML) becomes unwieldy for complex branching logic",
      "Component interface contract must be respected exactly — duck typing is not supported",
    ],
    adoptionSignals: { organizations: ["Deepset", "Various RAG-heavy deployments"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "deepset commercial support available" },
  },
  {
    toolName: "semantic-kernel",
    category: "orchestration-framework",
    maturityTier: "Emerging",
    confidenceScore: 6,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { language: "python or dotnet or java", minVersion: null },
    knownConstraints: [
      "Plugin interface is Microsoft-opinionated — integrations outside the plugin model require wrappers",
      "Memory connectors are first-class but tightly coupled to Microsoft Azure storage offerings",
    ],
    adoptionSignals: { organizations: ["Microsoft", "Various enterprise teams"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Microsoft open-source project with first-party support" },
  },
  // ── Vector and memory stores ────────────────────────────────────────────────
  {
    toolName: "pinecone",
    category: "vector-db",
    maturityTier: "Established",
    confidenceScore: 8,
    deploymentModel: "managed_cloud",
    minimumRuntimeRequirements: null,
    knownConstraints: [
      "Namespace isolation is logical, not physical — not appropriate for strict data residency requirements without dedicated infrastructure",
      "Index updates are eventually consistent — queries immediately after upsert may return stale results",
    ],
    adoptionSignals: { organizations: ["Pinecone", "Cohere", "Shopify", "Gong"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Pinecone SLA and commercial support available" },
  },
  {
    toolName: "chromadb",
    category: "vector-db",
    maturityTier: "Emerging",
    confidenceScore: 6,
    deploymentModel: "self_hosted",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.8", memory: "512MB" },
    knownConstraints: [
      "No built-in replication or horizontal scaling — single-node only in the open-source version",
      "Persistent mode requires explicit path configuration; default in-memory mode loses data on restart",
    ],
    adoptionSignals: { organizations: ["Chroma", "Various prototyping and small-scale deployments"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: null },
  },
  {
    toolName: "weaviate",
    category: "vector-db",
    maturityTier: "Established",
    confidenceScore: 7,
    deploymentModel: "self_hosted",
    minimumRuntimeRequirements: { runtime: "docker", memory: "1GB" },
    knownConstraints: [
      "Schema is defined upfront and is mutable but not schema-free — changes to class definitions require careful migration planning",
      "Hybrid search (vector + BM25) requires both vector and inverted index configurations",
    ],
    adoptionSignals: { organizations: ["Weaviate", "Weights & Biases", "Various enterprise RAG deployments"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Weaviate Cloud commercial support available" },
  },
  {
    toolName: "qdrant",
    category: "vector-db",
    maturityTier: "Emerging",
    confidenceScore: 7,
    deploymentModel: "self_hosted",
    minimumRuntimeRequirements: { runtime: "docker or binary", memory: "512MB" },
    knownConstraints: [
      "Payload filtering at query time adds latency proportional to filter complexity on large collections",
      "Snapshots for backup are manual — no built-in automated backup schedule",
    ],
    adoptionSignals: { organizations: ["Qdrant", "Various European AI startups"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Qdrant Cloud commercial support available" },
  },
  {
    toolName: "redis",
    category: "memory-cache",
    maturityTier: "Established",
    confidenceScore: 9,
    deploymentModel: "self_hosted",
    minimumRuntimeRequirements: { memory: "64MB" },
    knownConstraints: [
      "AOF or RDB persistence must be explicitly configured — default is volatile in-memory only",
      "Memory is the primary resource constraint — plan capacity around peak working set size, not dataset size",
    ],
    adoptionSignals: { organizations: ["Widespread — industry standard"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Redis Ltd. commercial support via Redis Cloud" },
  },
  {
    toolName: "pgvector",
    category: "vector-db",
    maturityTier: "Emerging",
    confidenceScore: 7,
    deploymentModel: "self_hosted",
    minimumRuntimeRequirements: { database: "PostgreSQL", minVersion: "13" },
    knownConstraints: [
      "HNSW index build time grows super-linearly with dataset size — plan index builds offline for large collections",
      "Approximate nearest neighbor (HNSW) index requires tuning ef_construction and m parameters; defaults are conservative",
      "Exact KNN scan without an index is O(n) — always build an index for production workloads",
    ],
    adoptionSignals: { organizations: ["Supabase", "Neon", "Various teams already on PostgreSQL"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: null },
  },
  // ── LLM SDKs ────────────────────────────────────────────────────────────────
  {
    toolName: "anthropic-sdk",
    category: "llm-sdk",
    maturityTier: "Established",
    confidenceScore: 9,
    deploymentModel: "sdk",
    minimumRuntimeRequirements: { language: "python or typescript", minVersion: null },
    knownConstraints: null,
    adoptionSignals: { organizations: ["Anthropic", "Broad adoption across agentic tooling"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Anthropic first-party SDK with SLA via API" },
  },
  {
    toolName: "openai-sdk",
    category: "llm-sdk",
    maturityTier: "Established",
    confidenceScore: 9,
    deploymentModel: "sdk",
    minimumRuntimeRequirements: { language: "python or typescript", minVersion: null },
    knownConstraints: null,
    adoptionSignals: { organizations: ["OpenAI", "Microsoft", "Broad adoption"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "OpenAI first-party SDK" },
  },
  {
    toolName: "google-generativeai-sdk",
    category: "llm-sdk",
    maturityTier: "Established",
    confidenceScore: 7,
    deploymentModel: "sdk",
    minimumRuntimeRequirements: { language: "python or typescript", minVersion: null },
    knownConstraints: [
      "Gemini API rate limits are lower than Anthropic and OpenAI at equivalent tiers — plan request budgets accordingly",
    ],
    adoptionSignals: { organizations: ["Google", "Various Google ecosystem projects"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Google first-party SDK" },
  },
  // ── Job queues and workflow orchestration ───────────────────────────────────
  {
    toolName: "bullmq",
    category: "job-queue",
    maturityTier: "Established",
    confidenceScore: 8,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { runtime: "nodejs", minVersion: "18" },
    knownConstraints: [
      "Requires Redis 6+ as backing store",
      "Job durability across restarts requires Redis AOF or RDB persistence — volatile Redis loses in-flight jobs on restart",
      "Worker concurrency defaults are conservative — tune per workload based on actual Redis and compute capacity",
    ],
    adoptionSignals: { organizations: ["Broad Node.js ecosystem adoption"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: null },
  },
  {
    toolName: "temporal",
    category: "workflow-orchestration",
    maturityTier: "Established",
    confidenceScore: 8,
    deploymentModel: "managed_cloud",
    minimumRuntimeRequirements: { sdk: "go, java, typescript, python", minVersion: null },
    knownConstraints: [
      "Requires a Temporal server (managed or self-hosted) — not a zero-infra solution",
      "Local activity timeouts must be tuned per workload — defaults are conservative",
      "Workflow code must be deterministic — non-deterministic operations must be wrapped in activities",
    ],
    adoptionSignals: { organizations: ["Stripe", "Snap", "Netflix", "Coinbase", "Descript"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Temporal Cloud SLA and support tiers published" },
  },
  {
    toolName: "celery",
    category: "job-queue",
    maturityTier: "Established",
    confidenceScore: 7,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.8" },
    knownConstraints: [
      "Requires a message broker (Redis or RabbitMQ) and optionally a result backend",
      "Task serialization defaults to pickle in older versions — use JSON serializer for security",
      "Long-running tasks block worker processes — use separate queues and concurrency settings per task type",
    ],
    adoptionSignals: { organizations: ["Widespread Python ecosystem adoption"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: null },
  },
  // ── Observability ────────────────────────────────────────────────────────────
  {
    toolName: "langfuse",
    category: "llm-observability",
    maturityTier: "Emerging",
    confidenceScore: 7,
    deploymentModel: "managed_cloud",
    minimumRuntimeRequirements: null,
    knownConstraints: [
      "Self-hosted option available but requires Docker and PostgreSQL — operational overhead is non-trivial",
      "Trace sampling must be configured explicitly for high-volume workloads; default is 100% capture",
    ],
    adoptionSignals: { organizations: ["Langfuse", "Various LLM-heavy startups"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Langfuse Cloud commercial support available" },
  },
  {
    toolName: "arize-phoenix",
    category: "llm-observability",
    maturityTier: "Emerging",
    confidenceScore: 6,
    deploymentModel: "self_hosted",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.8" },
    knownConstraints: [
      "Persistent storage requires explicit configuration — default is in-memory only",
      "OpenInference tracing format is required for full feature compatibility",
    ],
    adoptionSignals: { organizations: ["Arize AI", "Various ML teams"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Arize commercial support available" },
  },
  {
    toolName: "weave",
    category: "llm-observability",
    maturityTier: "Emerging",
    confidenceScore: 6,
    deploymentModel: "managed_cloud",
    minimumRuntimeRequirements: { language: "python", minVersion: "3.9" },
    knownConstraints: [
      "Requires a Weights & Biases account — no on-premises option",
      "Automatic trace capture relies on SDK instrumentation — frameworks not in the supported list require manual wrapping",
    ],
    adoptionSignals: { organizations: ["Weights & Biases", "Various ML research teams"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "W&B commercial support available" },
  },
  // ── Browser automation ───────────────────────────────────────────────────────
  {
    toolName: "playwright",
    category: "browser-automation",
    maturityTier: "Established",
    confidenceScore: 8,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { runtime: "nodejs", minVersion: "18" },
    knownConstraints: [
      "Requires headless browser binaries (~300MB) — Lambda zip deployment is not viable; use container images",
      "Minimum 1GB memory for headless Chrome; allocate more for parallel page contexts",
      "Browser contexts are not thread-safe — each concurrent task needs its own context",
    ],
    adoptionSignals: { organizations: ["Microsoft", "Broad adoption for testing and scraping"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Microsoft open-source project with active maintainers" },
  },
  {
    toolName: "puppeteer",
    category: "browser-automation",
    maturityTier: "Established",
    confidenceScore: 7,
    deploymentModel: "framework",
    minimumRuntimeRequirements: { runtime: "nodejs", minVersion: "18" },
    knownConstraints: [
      "Chrome/Chromium only — no Firefox or WebKit support",
      "Same binary size and memory constraints as Playwright — Lambda zip deployment not viable",
    ],
    adoptionSignals: { organizations: ["Google", "Broad adoption"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Google open-source project" },
  },
  // ── MCP servers ──────────────────────────────────────────────────────────────
  {
    toolName: "mcp-server-filesystem",
    category: "mcp-server",
    maturityTier: "Emerging",
    confidenceScore: 6,
    deploymentModel: "self_hosted",
    minimumRuntimeRequirements: { runtime: "nodejs", minVersion: "18" },
    knownConstraints: [
      "Requires access to the local filesystem — not viable in sandboxed or serverless environments without volume mounts",
      "No built-in access control beyond what the OS filesystem provides — scope carefully",
    ],
    adoptionSignals: { organizations: ["Anthropic", "Various MCP early adopters"] },
    maintenanceSignals: { lastCommit: "active", lastRelease: "active", vendorSupportStatement: "Anthropic reference implementation" },
  },
];

// ── Patterns ──────────────────────────────────────────────────────────────────

const PATTERNS: Array<typeof manifestPatterns.$inferInsert> = [
  {
    patternName: "pipeline",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Foundational pattern — widespread" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      knownGotchas: [
        "Handoff schema between stages must be explicitly defined before building — undocumented field names are the most common pipeline failure in production",
        "Stage N failure after stage N-1 has written output leaves the system in a partial state; all stages must be idempotent for safe retry",
        "A slow stage blocks all downstream stages — there is no parallelism to absorb latency variance",
        "Context window accumulates across stages if each stage passes the full prior output; budget context per stage or implement summarization at handoff points",
      ],
      failurePosture: "Recoverable stage by stage — a failed stage can retry without re-running prior stages if outputs are checkpointed",
      scaleConsiderations: [
        "Throughput is bounded by the slowest stage — parallelism within a stage (batch processing) is the primary scale lever",
        "Long pipelines accumulate latency linearly; profile each stage independently before assuming the pipeline meets SLA",
      ],
      stateHandoffPoints: [
        "Each stage boundary is a state handoff — the output schema at each boundary must be agreed between the producing and consuming stage",
        "Error state must be propagated explicitly across boundaries; do not rely on exceptions crossing stage boundaries",
      ],
      mixingNotes: "Pipelines are frequently used as the backbone with a supervisor or DAG handling a complex step internally. This is a common and well-understood hybrid.",
    },
  },
  {
    patternName: "dag",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Foundational pattern — widespread" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      knownGotchas: [
        "Merge strategy for conflicting parallel outputs must be designed before building — 'we'll figure out conflicts at the merge step' is not a design",
        "Parallel branches calling the same LLM API simultaneously amplify rate limit pressure proportionally to branch count; budget for concurrent calls explicitly",
        "The merge step receives all branch outputs simultaneously — context window at the merge agent must budget for the combined output of all branches",
        "Branch failure handling must be decided upfront: fail all, proceed with partial results, or wait with timeout",
        "DAGs are harder to debug than pipelines — a failing branch produces no output, and the merge step may not distinguish 'branch produced null' from 'branch was never called'",
      ],
      failurePosture: "Partial — individual branch failures can be isolated if the merge step is designed to handle missing inputs; without explicit handling, a branch failure often causes merge step failure",
      scaleConsiderations: [
        "Parallelism amplifies rate limit consumption — 5 parallel branches each making 3 LLM calls consumes 15 concurrent request slots",
        "Branch count is the primary scale knob; adding branches adds parallelism but also adds merge complexity and rate limit pressure",
      ],
      stateHandoffPoints: [
        "The merge step is the primary state convergence point — it must reconcile potentially conflicting branch outputs",
        "Shared state written by parallel branches requires explicit conflict resolution; branches should write to isolated namespaces where possible",
      ],
      mixingNotes: "Each branch of a DAG can itself be a pipeline internally. This is a natural and common composition.",
    },
  },
  {
    patternName: "supervisor",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Foundational pattern — widespread" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      knownGotchas: [
        "The supervisor is a single point of failure — if it crashes, all in-flight sub-agent work may be lost",
        "Timeout asymmetry: when one sub-agent is slow while others complete, the supervisor must decide whether to wait, proceed with partial results, or fail the run",
        "Supervisors tend to accumulate context across many sub-agent calls; context window pressure grows with the number of dispatches",
        "Dynamic dispatch is harder to test than static branching — the supervisor's routing logic must be separately tested",
        "Sub-agent output quality variance is amplified — a weak sub-agent response can derail the supervisor's subsequent routing decisions",
      ],
      failurePosture: "Catastrophic without explicit mitigation — supervisor failure typically means all in-flight sub-agent work is lost; checkpoint sub-agent results as they complete",
      scaleConsiderations: [
        "Supervisor context window grows linearly with dispatches; long-running supervisors with many sub-agents will hit context limits before other scale limits",
        "Sub-agent concurrency is limited by rate limits; supervisors that dispatch aggressively in parallel need explicit concurrency caps",
      ],
      stateHandoffPoints: [
        "The supervisor owns all state — it must maintain consistent context across potentially many sub-agent calls",
        "Sub-agent results should be persisted as they arrive, not only when the supervisor finalizes its output",
      ],
      mixingNotes: "Supervisors are frequently used at the top level with pipeline or DAG handling structured sub-tasks. Avoid nested supervisors — debugging becomes exponentially harder.",
    },
  },
  {
    patternName: "event_driven",
    maturityTier: "Emerging",
    confidenceScore: 7,
    adoptionSignals: { description: "Growing adoption for async agent coordination" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      knownGotchas: [
        "Message ordering is not guaranteed by default in most event systems — agents must handle out-of-order events or the queue must provide ordering guarantees explicitly",
        "Dead letter queue design is mandatory, not optional — unhandled events silently disappear without it",
        "At-least-once delivery means agents may process the same event multiple times; all event handlers must be idempotent",
        "Debugging is significantly harder than synchronous patterns — a failure in one agent may not surface until a downstream agent processes a stale or missing event",
      ],
      failurePosture: "Isolated — individual event processing failures are contained if dead letter queues are in place; without them, failures are silent and data loss is likely",
      scaleConsiderations: [
        "Event queues can absorb traffic spikes that would overwhelm synchronous systems — the primary scale advantage",
        "Consumer lag is the key health metric — monitor time-to-process, not just queue depth",
      ],
      stateHandoffPoints: [
        "Event payload must carry all state the consuming agent needs — do not rely on shared state that the producer and consumer both read",
        "Event schema versioning is required for any system that runs in production for more than a few weeks",
      ],
      mixingNotes: "Often used as the top-level coordination mechanism with pipeline or supervisor handling the processing of each event internally.",
    },
  },
  {
    patternName: "peer_to_peer",
    maturityTier: "Emerging",
    confidenceScore: 5,
    adoptionSignals: { description: "Niche — experimental in production contexts" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      knownGotchas: [
        "Emergent behavior is hard to predict and even harder to debug — agents interacting directly can produce coordination patterns that were never designed",
        "Consensus is the core unsolved problem — when two agents disagree, there is no authority to resolve it without explicit consensus protocol design",
        "Debugging is the hardest of any pattern — tracing which agent said what to which other agent requires purpose-built observability from day one",
      ],
      failurePosture: "Degraded rather than catastrophic if designed carefully — individual agent failures reduce capability but do not halt the system; in practice, emergent deadlocks are common without careful design",
      scaleConsiderations: ["Communication overhead grows with agent count; peer-to-peer does not scale linearly"],
      stateHandoffPoints: ["All agents share equal responsibility for consistency — this is a coordination problem that must be explicitly solved"],
      mixingNotes: "Rarely used as a top-level pattern. Most production systems that appear to be peer-to-peer have an implicit supervisor coordinating them.",
    },
  },
  {
    patternName: "hierarchical",
    maturityTier: "Emerging",
    confidenceScore: 6,
    adoptionSignals: { description: "Used for genuinely multi-domain systems" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      knownGotchas: [
        "Debugging failures across hierarchy levels requires purpose-built distributed tracing — standard logging is insufficient",
        "Context window pressure at the top-level orchestrator grows with the number of sub-orchestrators it must coordinate",
        "Latency compounds at each level — a hierarchy that looks manageable in design often has unacceptable p95 latency in production",
      ],
      failurePosture: "Domain-isolated — a failing sub-orchestrator affects only its domain if the top-level orchestrator is designed to handle partial results",
      scaleConsiderations: ["Each level of hierarchy adds coordination overhead; three or more levels require careful latency budgeting"],
      stateHandoffPoints: ["State handoffs between orchestrator levels must be explicitly designed; do not assume state flows automatically across boundaries"],
      mixingNotes: "Appropriate for genuinely multi-domain systems where domains have independent lifecycles. Avoid hierarchical patterns for systems that can be expressed as a flat DAG.",
    },
  },
];

// ── Failure modes ─────────────────────────────────────────────────────────────

const FAILURE_MODES: Array<typeof manifestFailureModes.$inferInsert> = [
  {
    failureModeName: "cascading_agent_failures",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Universally applicable failure mode" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      description: "One agent's incorrect or degraded output propagates unchecked into downstream agents, compounding the error. By the time the system produces a final output, the original failure is buried under layers of plausible-looking reasoning.",
      likelihoodSignals: [
        "Sequential patterns (pipeline, DAG) without output validation at handoff boundaries",
        "Agents that accept upstream output as ground truth without independent verification",
        "Long chains where the first agent's output directly shapes every subsequent agent's context",
      ],
      detectionApproach: "Structured output schema validation at every handoff boundary. Trace IDs that propagate through the chain. Periodic ground-truth re-anchoring by giving a downstream agent access to the original input.",
      mitigationApproaches: [
        "Schema validation at every handoff, throwing on mismatch rather than silently defaulting",
        "Confidence scoring on intermediate outputs — low confidence triggers escalation before propagating",
        "Ground-truth re-anchoring: give a downstream agent access to the original input at key checkpoints",
      ],
      domainApplicability: ["general", "finance", "hipaa"],
    },
  },
  {
    failureModeName: "reasoning_loops",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Universally applicable failure mode" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      description: "An agent repeatedly attempts the same approach or re-asks the same question without making progress. Token consumption grows linearly; time-to-response degrades.",
      likelihoodSignals: [
        "Fully autonomous agents that self-direct their next step based on prior output",
        "Long-running research or planning agents with access to external data sources",
        "Absence of an explicit iteration cap in the agent runtime",
        "Agents that grade their own output and retry when the grade is insufficient",
      ],
      detectionApproach: "Iteration counters with hard caps enforced at the runtime level (not in the prompt). Semantic similarity detection on consecutive reasoning steps. Wall-clock timeouts per agent call.",
      mitigationApproaches: [
        "Hard iteration cap (10 cycles max) enforced in the runner, not the prompt",
        "Semantic similarity check between consecutive reasoning steps",
        "Escalate to HITL when cap is reached — do not silently fail or produce a partial output",
      ],
      domainApplicability: ["general"],
    },
  },
  {
    failureModeName: "tool_misuse_under_failure",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Universally applicable failure mode" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      description: "When an agent encounters unexpected input, partial failure, or ambiguity, it calls tools in sequences that were never designed or tested. Write-access tools called in unexpected sequences can corrupt external state in ways that are difficult to detect and expensive to reverse.",
      likelihoodSignals: [
        "Agents with write-access tools (database writes, API mutations, file system writes)",
        "Agents that call tools dynamically based on runtime reasoning rather than a fixed call graph",
        "External integrations where the agent cannot verify the state of the external system before acting",
        "Absence of tool call validation or allowlisting",
      ],
      detectionApproach: "Structured logging of all tool calls with sequence IDs. Anomaly detection on tool call patterns relative to expected call graphs. Dry-run mode for destructive operations before execution.",
      mitigationApproaches: [
        "Tool call allowlisting per agent role — agents can only call tools in their declared scope",
        "HITL gate before any write operation to an external system",
        "Idempotency keys on all write tool calls",
        "Dry-run mode that validates the operation before executing it",
      ],
      domainApplicability: ["general", "finance", "hipaa"],
    },
  },
  {
    failureModeName: "nondeterministic_output_divergence",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Universally applicable failure mode" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      description: "The same input produces structurally or semantically incompatible outputs across runs. Downstream agents or systems receive different schemas, field names, or data types depending on run timing, temperature, or model version.",
      likelihoodSignals: [
        "Structured output agents running at temperature above zero",
        "Multiple agents independently producing the same output type without a shared schema",
        "Optional fields in output schemas that downstream agents treat as required",
        "Agents that incorporate time-sensitive external data without versioning",
      ],
      detectionApproach: "Zod/JSON schema validation on every agent output, throwing on first mismatch. Regression test suite run on every prompt change. Output diff monitoring across runs for the same seeded input.",
      mitigationApproaches: [
        "Temperature 0 for all classification, extraction, and structured output tasks",
        "Shared Zod schemas for all handoff contracts, validated at both producer and consumer",
        "Versioned output schemas with explicit version fields on handoff payloads",
        "Pin external data sources used in structured output tasks",
      ],
      domainApplicability: ["general"],
    },
  },
  {
    failureModeName: "agent_memory_corruption",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Universally applicable failure mode" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      description: "Agents read state that was written incorrectly, partially, or by the wrong agent. Unlike traditional data corruption, the agent confidently acts on wrong information — there is no exception or error signal.",
      likelihoodSignals: [
        "Multiple agents with write access to shared state",
        "Cross-session persistence without write ordering or checksums",
        "Agents that update state incrementally rather than atomically",
        "Shared state that lacks an explicit owner per namespace",
      ],
      detectionApproach: "State checksums validated on read. Write-ahead logging with rollback capability. Explicit state ownership — one agent per namespace. Canary reads before acting on retrieved state.",
      mitigationApproaches: [
        "Single-writer principle per state namespace",
        "Atomic state updates with optimistic concurrency control (version number checked before write)",
        "State validation on read, not just write",
        "TTL-based expiry to prevent stale state from persisting indefinitely",
      ],
      domainApplicability: ["general", "finance", "hipaa"],
    },
  },
  {
    failureModeName: "agent_handoff_schema_failures",
    maturityTier: "Established",
    confidenceScore: 9,
    adoptionSignals: { description: "Universally applicable failure mode" },
    maintenanceSignals: {},
    domainKnowledgePayload: {
      description: "Structured data passed between agents doesn't match what the receiving agent expects. The mismatch may be a missing field, a changed type, or a semantic shift where the field name stayed the same but the meaning changed.",
      likelihoodSignals: [
        "Agent-to-agent handoffs without shared schema definitions",
        "Independently evolving agents whose output schemas drift over time",
        "Optional fields in producer schemas that consumer schemas treat as required",
        "Multiple producers for the same handoff schema type",
      ],
      detectionApproach: "Runtime schema validation at both producer and consumer. Type-checked handoff contracts shared as a single source of truth. Integration tests that exercise the actual handoff path end-to-end.",
      mitigationApproaches: [
        "Shared Zod schemas for all agent handoff contracts — single source of truth, imported by both producer and consumer",
        "Explicit version field on all handoff payloads",
        "Consumer-side validation that throws rather than silently defaults when a field is missing",
        "Integration test coverage for every handoff boundary",
      ],
      domainApplicability: ["general"],
    },
  },
];

// ── Org list ──────────────────────────────────────────────────────────────────

const ORG_LIST: Array<{ orgName: string; tier: 1 | 2 | 3; signals: Record<string, unknown> }> = [
  // Tier 1 — market influence
  { orgName: "Anthropic",        tier: 1, signals: { basis: "market-influence", notes: "Frontier model lab defining agentic norms; Claude, MCP, Constitutional AI" } },
  { orgName: "OpenAI",           tier: 1, signals: { basis: "market-influence", notes: "GPT series, Assistants API, function calling; de facto industry standard setters" } },
  { orgName: "Google",           tier: 1, signals: { basis: "market-influence", notes: "Gemini, Vertex AI, DeepMind research; platform decisions shape industry at scale" } },
  { orgName: "Microsoft",        tier: 1, signals: { basis: "market-influence", notes: "Azure OpenAI, Copilot, Semantic Kernel, AutoGen; enterprise agentic platform" } },
  { orgName: "Amazon",           tier: 1, signals: { basis: "market-influence", notes: "AWS Bedrock, SageMaker; cloud infrastructure for majority of deployed LLM systems" } },
  { orgName: "Meta",             tier: 1, signals: { basis: "market-influence", notes: "Llama series open weights; dominant open model adoption signal" } },
  { orgName: "Nvidia",           tier: 1, signals: { basis: "market-influence", notes: "GPU infrastructure underpinning all LLM training and inference at scale" } },
  // Tier 1 — deep commitment
  { orgName: "LangChain",        tier: 1, signals: { basis: "committed", notes: "Dominant framework ecosystem (LangGraph, LangSmith); extensive engineering publications" } },
  { orgName: "Hugging Face",     tier: 1, signals: { basis: "committed", notes: "Open-source model hub; smolagents; prolific technical publishing" } },
  // Tier 2
  { orgName: "Cohere",           tier: 2, signals: { notes: "Serious model provider with genuine enterprise engineering depth" } },
  { orgName: "Mistral",          tier: 2, signals: { notes: "Strong open model engineering; growing enterprise adoption" } },
  { orgName: "Together AI",      tier: 2, signals: { notes: "Inference infrastructure with real technical credibility" } },
  { orgName: "Weights & Biases", tier: 2, signals: { notes: "MLflow competitor; observability tooling and publications; Weave for LLM tracing" } },
  { orgName: "Pinecone",         tier: 2, signals: { notes: "Vector DB provider with substantive engineering content" } },
  { orgName: "Weaviate",         tier: 2, signals: { notes: "Vector DB provider with substantive engineering content" } },
  { orgName: "Modal",            tier: 2, signals: { notes: "Agent infrastructure with real technical credibility" } },
  { orgName: "E2B",              tier: 2, signals: { notes: "Sandboxed code execution for agents; real technical credibility" } },
  { orgName: "Databricks",       tier: 2, signals: { notes: "Strong engineering depth; MLflow ownership; serious publications" } },
  { orgName: "Cursor",           tier: 2, signals: { notes: "AI-native company running agentic systems as core product" } },
  // Tier 3
  { orgName: "CrewAI",           tier: 3, signals: { notes: "Multi-agent framework; growing but not yet established track record" } },
  { orgName: "LlamaIndex",       tier: 3, signals: { notes: "RAG and data framework; growing but not yet established" } },
  { orgName: "Haystack",         tier: 3, signals: { notes: "LLM pipeline framework (deepset); growing adoption in RAG" } },
  { orgName: "Composio",         tier: 3, signals: { notes: "Tooling layer for agent integrations; newer but gaining traction" } },
];

// ── Seeder functions ──────────────────────────────────────────────────────────

async function seedTools() {
  await db.insert(manifestTools).values(TOOLS).onConflictDoNothing({ target: manifestTools.toolName });
  console.log(`manifest_tools: seeded ${TOOLS.length} entries`);
}

async function seedPatterns() {
  await db.insert(manifestPatterns).values(PATTERNS).onConflictDoNothing({ target: manifestPatterns.patternName });
  console.log(`manifest_patterns: seeded ${PATTERNS.length} entries`);
}

async function seedFailureModes() {
  await db.insert(manifestFailureModes).values(FAILURE_MODES).onConflictDoNothing({ target: manifestFailureModes.failureModeName });
  console.log(`manifest_failure_modes: seeded ${FAILURE_MODES.length} entries`);
}

async function seedOrgList() {
  let inserted = 0;
  let skipped = 0;

  for (const org of ORG_LIST) {
    const existing = await db
      .select({ id: orgList.id })
      .from(orgList)
      .where(eq(orgList.orgName, org.orgName))
      .limit(1);

    if (existing.length > 0) { skipped++; continue; }

    await db.insert(orgList).values({
      orgName: org.orgName,
      tier: org.tier,
      signals: org.signals,
      maintenanceActive: true,
      status: "active",
    });
    inserted++;
  }

  console.log(`org_list: inserted ${inserted}, skipped ${skipped} existing`);
}

// ── Themes ────────────────────────────────────────────────────────────────────

const TOKEN_VOCABULARY_KEYS = [
  "color.primary", "color.secondary", "color.accent", "color.surface",
  "color.text.primary", "color.text.secondary",
  "typography.fontFamily.heading", "typography.fontFamily.body",
  "radius.base", "radius.large",
];

type TokenMap = Record<string, string>;

const SYSTEM_FONTS = "Inter, system-ui, sans-serif";
const MONO_FONTS = "JetBrains Mono, ui-monospace, monospace";

const THEME_PRESETS: Array<{ name: string; tokenMap: TokenMap }> = [
  {
    name: "default_light",
    tokenMap: {
      "color.primary": "#1a1a2e", "color.secondary": "#16213e", "color.accent": "#7c3aed",
      "color.surface": "#ffffff", "color.text.primary": "#1a1a2e", "color.text.secondary": "#6b7280",
      "typography.fontFamily.heading": SYSTEM_FONTS, "typography.fontFamily.body": SYSTEM_FONTS,
      "radius.base": "6px", "radius.large": "12px",
    },
  },
  {
    name: "default_dark",
    tokenMap: {
      "color.primary": "#e2e8f0", "color.secondary": "#cbd5e1", "color.accent": "#7c3aed",
      "color.surface": "#0f172a", "color.text.primary": "#f1f5f9", "color.text.secondary": "#94a3b8",
      "typography.fontFamily.heading": SYSTEM_FONTS, "typography.fontFamily.body": SYSTEM_FONTS,
      "radius.base": "6px", "radius.large": "12px",
    },
  },
  {
    name: "professional_light",
    tokenMap: {
      "color.primary": "#1e40af", "color.secondary": "#1d4ed8", "color.accent": "#2563eb",
      "color.surface": "#f8fafc", "color.text.primary": "#0f172a", "color.text.secondary": "#475569",
      "typography.fontFamily.heading": SYSTEM_FONTS, "typography.fontFamily.body": SYSTEM_FONTS,
      "radius.base": "4px", "radius.large": "8px",
    },
  },
  {
    name: "professional_dark",
    tokenMap: {
      "color.primary": "#93c5fd", "color.secondary": "#60a5fa", "color.accent": "#3b82f6",
      "color.surface": "#0c1426", "color.text.primary": "#e2e8f0", "color.text.secondary": "#94a3b8",
      "typography.fontFamily.heading": SYSTEM_FONTS, "typography.fontFamily.body": SYSTEM_FONTS,
      "radius.base": "4px", "radius.large": "8px",
    },
  },
  {
    name: "minimal_light",
    tokenMap: {
      "color.primary": "#171717", "color.secondary": "#404040", "color.accent": "#525252",
      "color.surface": "#fafafa", "color.text.primary": "#171717", "color.text.secondary": "#737373",
      "typography.fontFamily.heading": SYSTEM_FONTS, "typography.fontFamily.body": SYSTEM_FONTS,
      "radius.base": "2px", "radius.large": "4px",
    },
  },
  {
    name: "minimal_dark",
    tokenMap: {
      "color.primary": "#e5e5e5", "color.secondary": "#d4d4d4", "color.accent": "#a3a3a3",
      "color.surface": "#0a0a0a", "color.text.primary": "#fafafa", "color.text.secondary": "#a3a3a3",
      "typography.fontFamily.heading": SYSTEM_FONTS, "typography.fontFamily.body": SYSTEM_FONTS,
      "radius.base": "2px", "radius.large": "4px",
    },
  },
  {
    name: "bold_light",
    tokenMap: {
      "color.primary": "#7c3aed", "color.secondary": "#6d28d9", "color.accent": "#f59e0b",
      "color.surface": "#ffffff", "color.text.primary": "#1c1917", "color.text.secondary": "#57534e",
      "typography.fontFamily.heading": SYSTEM_FONTS, "typography.fontFamily.body": SYSTEM_FONTS,
      "radius.base": "8px", "radius.large": "16px",
    },
  },
  {
    name: "bold_dark",
    tokenMap: {
      "color.primary": "#a78bfa", "color.secondary": "#8b5cf6", "color.accent": "#f59e0b",
      "color.surface": "#0c0a09", "color.text.primary": "#fafaf9", "color.text.secondary": "#a8a29e",
      "typography.fontFamily.heading": SYSTEM_FONTS, "typography.fontFamily.body": SYSTEM_FONTS,
      "radius.base": "8px", "radius.large": "16px",
    },
  },
];

async function seedThemes() {
  let inserted = 0;
  let skipped = 0;

  const themeIds: Record<string, string> = {};

  for (const preset of THEME_PRESETS) {
    const version = computeThemeVersion(preset.tokenMap, null);
    const existing = await db.select().from(themes).where(eq(themes.name, preset.name)).limit(1);
    if (existing.length > 0) {
      themeIds[preset.name] = existing[0].id;
      skipped++;
      continue;
    }
    const [row] = await db.insert(themes).values({
      name: preset.name,
      owner: "global",
      tokenMap: preset.tokenMap,
      customCss: null,
      version,
      status: "published",
    }).returning();
    themeIds[preset.name] = row.id;
    inserted++;
  }

  console.log(`themes: inserted ${inserted}, skipped ${skipped} existing`);

  // Seed global assignments: light → default_light, dark → default_dark
  const GLOBAL_ASSIGNMENTS = [
    { mode: "light", themeName: "default_light" },
    { mode: "dark",  themeName: "default_dark" },
  ];

  let aInserted = 0;
  let aSkipped = 0;
  for (const { mode, themeName } of GLOBAL_ASSIGNMENTS) {
    const existing = await db
      .select()
      .from(themeAssignments)
      .where(eq(themeAssignments.owner, "global"))
      .limit(10);

    if (existing.some(a => a.mode === mode)) {
      aSkipped++;
      continue;
    }

    const themeId = themeIds[themeName];
    if (!themeId) continue;

    const version = computeThemeVersion(
      THEME_PRESETS.find(p => p.name === themeName)!.tokenMap,
      null
    );

    await db.insert(themeAssignments).values({
      owner: "global",
      mode,
      themeId,
      tokenOverrides: {},
      logoUrl: null,
      status: "published",
      version,
    });
    aInserted++;
  }

  console.log(`theme_assignments: inserted ${aInserted}, skipped ${aSkipped} existing`);
}

// ── UI string defaults ────────────────────────────────────────────────────────

const UI_STRING_DEFAULTS: Array<{ key: string; value: string }> = [
  { key: "ui.string.productName",    value: "Agent12" },
  { key: "ui.string.tagline",        value: "Architecture recommendations for agentic systems" },
  { key: "ui.string.ctaLabel",       value: "Analyze Architecture" },
  { key: "ui.string.section.wave1",  value: "Core Architecture" },
  { key: "ui.string.section.wave2",  value: "Failure & Control" },
  { key: "ui.string.section.cv",     value: "Compatibility & Validation" },
  { key: "ui.string.section.pass1",  value: "Architecture Recommendation" },
];

async function seedUiStrings() {
  let inserted = 0;
  let skipped = 0;

  for (const { key, value } of UI_STRING_DEFAULTS) {
    const existing = await db
      .select()
      .from(config)
      .where(eq(config.key, key))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(config).values({ key, value, owner: "global" });
    inserted++;
  }

  console.log(`ui.string config: inserted ${inserted}, skipped ${skipped} existing`);
}

async function main() {
  console.log("Seeding database...");
  await seedTools();
  await seedPatterns();
  await seedFailureModes();
  await seedOrgList();
  await seedThemes();
  await seedUiStrings();
  console.log("Done.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
