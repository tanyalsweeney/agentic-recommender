import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set — check .env.local");

export const anthropic = new Anthropic({ apiKey });

// Minimal seed manifest for evals — enough for agents to reason with.
// The real manifest will be built in Phase 6 (maintenance pipeline).
export const SEED_MANIFEST = {
  tools: [
    { name: "langchain", category: "orchestration-framework", maturityTier: "Established", version: "0.3.0", platformCompat: ["aws", "gcp", "azure", "local"], modelCompat: ["all"] },
    { name: "langgraph", category: "orchestration-framework", maturityTier: "Established", version: "0.2.0", platformCompat: ["aws", "gcp", "azure", "local"], modelCompat: ["all"] },
    { name: "pinecone", category: "vector-db", maturityTier: "Established", version: "3.0.0", platformCompat: ["aws", "gcp", "azure"], modelCompat: ["all"] },
    { name: "redis", category: "memory-cache", maturityTier: "Established", version: "5.0.0", platformCompat: ["all"], modelCompat: ["all"] },
    { name: "anthropic-sdk", category: "llm-sdk", maturityTier: "Established", version: "0.39.0", platformCompat: ["all"], modelCompat: ["claude"] },
    { name: "openai-sdk", category: "llm-sdk", maturityTier: "Established", version: "4.0.0", platformCompat: ["all"], modelCompat: ["gpt"] },
    { name: "mcp-server-filesystem", category: "mcp-server", maturityTier: "Emerging", version: "1.0.0", platformCompat: ["local", "linux"], modelCompat: ["all"] },
    { name: "chromadb", category: "vector-db", maturityTier: "Emerging", version: "0.5.0", platformCompat: ["local", "aws"], modelCompat: ["all"] },
    { name: "playwright", category: "browser-automation", maturityTier: "Established", version: "1.44.0", platformCompat: ["all"], modelCompat: ["all"] },
    { name: "bullmq", category: "job-queue", maturityTier: "Established", version: "5.0.0", platformCompat: ["node"], modelCompat: ["all"] },
  ],
  patterns: [
    {
      name: "pipeline",
      maturityTier: "Established",
      description: "Sequential agent chain — each agent receives the previous agent's output as its primary input.",
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
      name: "dag",
      maturityTier: "Established",
      description: "Directed acyclic graph — some agents run in parallel, outputs converge at a merge step.",
      domainKnowledgePayload: {
        knownGotchas: [
          "Merge strategy for conflicting parallel outputs must be designed before building — 'we'll figure out conflicts at the merge step' is not a design",
          "Parallel branches calling the same LLM API simultaneously amplify rate limit pressure proportionally to branch count; budget for concurrent calls explicitly",
          "The merge step receives all branch outputs simultaneously — context window at the merge agent must budget for the combined output of all branches",
          "Branch failure handling must be decided upfront: fail all, proceed with partial results, or wait with timeout; the default behavior is rarely the right behavior",
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
      name: "supervisor",
      maturityTier: "Established",
      description: "Central orchestrator dispatches sub-agents dynamically and aggregates their results.",
      domainKnowledgePayload: {
        knownGotchas: [
          "The supervisor is a single point of failure — if it crashes, all in-flight sub-agent work may be lost; the supervisor must be the most reliable component in the system",
          "Timeout asymmetry: when one sub-agent is slow while others complete, the supervisor must decide whether to wait, proceed with partial results, or fail the run — this decision must be made before building",
          "Supervisors tend to accumulate context across many sub-agent calls; context window pressure grows with the number of dispatches and is often underestimated",
          "Dynamic dispatch is harder to test than static branching — the supervisor's routing logic must be separately tested with known inputs before relying on it in production",
          "Sub-agent output quality variance is amplified — a weak sub-agent response can derail the supervisor's subsequent routing decisions",
        ],
        failurePosture: "Catastrophic without explicit mitigation — supervisor failure typically means all in-flight sub-agent work is lost; checkpoint sub-agent results as they complete",
        scaleConsiderations: [
          "Supervisor context window grows linearly with dispatches; long-running supervisors with many sub-agents will hit context limits before they hit other scale limits",
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
      name: "event_driven",
      maturityTier: "Emerging",
      description: "Agents react to events or messages rather than being called directly.",
      domainKnowledgePayload: {
        knownGotchas: [
          "Message ordering is not guaranteed by default in most event systems — agents must be designed to handle out-of-order events or the queue must provide ordering guarantees explicitly",
          "Dead letter queue design is mandatory, not optional — unhandled events silently disappear without it",
          "At-least-once delivery means agents may process the same event multiple times; all event handlers must be idempotent",
          "Debugging is significantly harder than synchronous patterns — a failure in one agent may not surface until a downstream agent processes a stale or missing event",
        ],
        failurePosture: "Isolated — individual event processing failures are contained if dead letter queues are in place; without them, failures are silent and data loss is likely",
        scaleConsiderations: [
          "Event queues can absorb traffic spikes that would overwhelm synchronous systems — this is the primary scale advantage",
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
      name: "peer_to_peer",
      maturityTier: "Emerging",
      description: "Agents communicate directly with each other without a central coordinator.",
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
      name: "hierarchical",
      maturityTier: "Emerging",
      description: "Nested orchestrators managing sub-orchestrators, each responsible for a domain.",
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
  ],
  failureModes: [
    {
      name: "cascading_agent_failures",
      category: "failure_mode",
      domainKnowledgePayload: {
        description: "One agent's incorrect or degraded output propagates unchecked into downstream agents, compounding the error. By the time the system produces a final output, the original failure is buried under layers of plausible-looking reasoning.",
        likelihoodSignals: [
          "Sequential patterns (pipeline, DAG) without output validation at handoff boundaries",
          "Agents that accept upstream output as ground truth without independent verification",
          "Long chains where the first agent's output directly shapes every subsequent agent's context",
        ],
        detectionApproach: "Structured output schema validation at every handoff boundary. Trace IDs that propagate through the chain. Periodic ground-truth re-anchoring by giving a downstream agent access to the original input, not just the processed output.",
        mitigationApproaches: [
          "Schema validation at every handoff, throwing on mismatch rather than silently defaulting",
          "Confidence scoring on intermediate outputs — low confidence triggers escalation before propagating",
          "Ground-truth re-anchoring: give a downstream agent access to the original input at key checkpoints",
        ],
        domainApplicability: ["general", "finance", "hipaa"],
      },
    },
    {
      name: "reasoning_loops",
      category: "failure_mode",
      domainKnowledgePayload: {
        description: "An agent repeatedly attempts the same approach or re-asks the same question without making progress. Token consumption grows linearly; time-to-response degrades. In supervised systems, the supervisor may not detect the loop until it hits a resource limit.",
        likelihoodSignals: [
          "Fully autonomous agents that self-direct their next step based on prior output",
          "Long-running research or planning agents with access to external data sources",
          "Absence of an explicit iteration cap in the agent runtime",
          "Agents that grade their own output and retry when the grade is insufficient",
        ],
        detectionApproach: "Iteration counters with hard caps enforced at the runtime level (not in the prompt). Semantic similarity detection on consecutive reasoning steps — if two consecutive steps are more than 90% similar, surface an alert. Wall-clock timeouts per agent call.",
        mitigationApproaches: [
          "Hard iteration cap (10 cycles max) enforced in the runner, not the prompt",
          "Semantic similarity check between consecutive reasoning steps",
          "Escalate to HITL when cap is reached — do not silently fail or produce a partial output",
        ],
        domainApplicability: ["general"],
      },
    },
    {
      name: "tool_misuse_under_failure",
      category: "failure_mode",
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
      name: "nondeterministic_output_divergence",
      category: "failure_mode",
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
      name: "agent_memory_corruption",
      category: "failure_mode",
      domainKnowledgePayload: {
        description: "Agents read state that was written incorrectly, partially, or by the wrong agent. Unlike traditional data corruption, the agent confidently acts on wrong information — there is no exception or error signal. The system proceeds normally while producing wrong outputs.",
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
      name: "agent_handoff_schema_failures",
      category: "failure_mode",
      domainKnowledgePayload: {
        description: "Structured data passed between agents doesn't match what the receiving agent expects. The mismatch may be a missing field, a changed type, or a semantic shift where the field name stayed the same but the meaning changed. Without explicit schema contracts, these failures are silent.",
        likelihoodSignals: [
          "Agent-to-agent handoffs without shared schema definitions",
          "Independently evolving agents whose output schemas drift over time",
          "Optional fields in producer schemas that consumer schemas treat as required",
          "Multiple producers for the same handoff schema type",
        ],
        detectionApproach: "Runtime schema validation at both producer and consumer. Type-checked handoff contracts shared as a single source of truth. Integration tests that exercise the actual handoff path end-to-end, not just individual agents in isolation.",
        mitigationApproaches: [
          "Shared Zod schemas for all agent handoff contracts — single source of truth, imported by both producer and consumer",
          "Explicit version field on all handoff payloads",
          "Consumer-side validation that throws rather than silently defaults when a field is missing",
          "Integration test coverage for every handoff boundary",
        ],
        domainApplicability: ["general"],
      },
    },
  ],
};
