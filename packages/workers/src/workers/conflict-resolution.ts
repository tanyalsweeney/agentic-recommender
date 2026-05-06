import { runCrossToolCompatibilityCheck, type CrossToolConflict } from "./cross-tool-check.js";

// ── types ─────────────────────────────────────────────────────────────────────

export interface ConflictCorrectionRequest {
  conflictId: string;
  toolPair: string[];
  sharedDependency: string | null;
  conflictDescription: string;
  // Null when no version satisfies all constraints in the dependency group.
  compatibleVersion: string | null;
  // The single agent whose recommendation is out of line (when a compatible
  // version exists). Null when all involved agents must respond.
  outOfLineAgent: string | null;
  allInvolvedAgents: string[];
  // Declared dependencies of each tool in the conflict group, used to verify
  // proposed alternatives against the full dependency landscape of the group.
  toolDependencies?: Record<string, string[]>;
}

export interface ConflictResolutionResponse {
  agentKey: string;
  conflictId: string;
  resolution:
    | "accepted_compatible_version"
    | "proposed_alternative"
    | "flagged_unresolvable";
  updatedRecommendation?: unknown;
  resolutionNote: string;
  // Populated only when resolution === "proposed_alternative"
  alternativeVerified?: boolean;
  // "dependency-only" = CV ran a lightweight dep check (no CVE/pricing/web search).
  // Skeptic sees the scope and can use one of its 4 cycles to request full verification.
  alternativeVerificationScope?: "dependency-only" | "full" | "none";
  alternativeConflicts?: CrossToolConflict[];
}

// Injectable dep: takes a tool name, returns its declared dependencies.
// Used to verify proposed alternatives without a full per-tool lookup.
export type AlternativeVerifier = (
  toolName: string
) => Promise<{ dependencies: string[] } | null>;

// Caller signature: receives all correction requests for this agent (batched)
// and returns one response covering all of them.
export type ConflictResolutionCaller = (
  requests: ConflictCorrectionRequest[]
) => Promise<ConflictResolutionResponse>;

// ── exchange ──────────────────────────────────────────────────────────────────

/**
 * 1-cycle correction exchange from CV to affected wave 1/2 agents.
 *
 * All conflicts are collected before any agent is contacted. Each agent
 * receives a single batched call covering all its correction requests.
 *
 * When a compatible version exists: only the out-of-line agent is contacted.
 * When no compatible version exists: all involved agents are contacted.
 *
 * When an agent proposes a different tool, CV runs a dependency-only lookup
 * (no CVE/pricing/web search) on the alternative and checks it against the
 * existing tool group. The Skeptic receives the verification scope so it knows
 * what was and wasn't checked, and can use one of its 4 cycles to push back
 * for a full verification if needed.
 */
export async function runConflictResolutionExchange(
  requests: ConflictCorrectionRequest[],
  callers: Record<string, ConflictResolutionCaller>,
  verifyAlternative?: AlternativeVerifier
): Promise<ConflictResolutionResponse[]> {
  if (!requests.length) return [];

  // Collect all tools already in the system for dependency conflict checking
  const existingTools = requests.flatMap((r) => r.toolPair);

  // Group requests by the agent(s) who need to respond
  const byAgent = new Map<string, ConflictCorrectionRequest[]>();
  for (const request of requests) {
    const recipients = request.outOfLineAgent
      ? [request.outOfLineAgent]
      : request.allInvolvedAgents;

    for (const agentKey of recipients) {
      if (!byAgent.has(agentKey)) byAgent.set(agentKey, []);
      byAgent.get(agentKey)!.push(request);
    }
  }

  const responses: ConflictResolutionResponse[] = [];

  for (const [agentKey, agentRequests] of byAgent) {
    const caller = callers[agentKey];
    if (!caller) continue;

    const response = await caller(agentRequests);

    if (response.resolution === "proposed_alternative" && verifyAlternative) {
      // Merge toolDependencies from all requests this agent handled
      const toolDeps = Object.assign({}, ...agentRequests.map((r) => r.toolDependencies ?? {}));
      const enriched = await verifyProposedAlternative(
        response,
        existingTools,
        toolDeps,
        verifyAlternative
      );
      responses.push(enriched);
    } else {
      responses.push(response);
    }
  }

  return responses;
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function verifyProposedAlternative(
  response: ConflictResolutionResponse,
  existingTools: string[],
  toolDependencies: Record<string, string[]>,
  verifyAlternative: AlternativeVerifier
): Promise<ConflictResolutionResponse> {
  const rec = response.updatedRecommendation as { tool?: string } | undefined;
  const alternativeName = rec?.tool;

  if (!alternativeName) {
    return {
      ...response,
      alternativeVerified: false,
      alternativeVerificationScope: "none",
      alternativeConflicts: [],
    };
  }

  const lookupResult = await verifyAlternative(alternativeName);

  if (!lookupResult) {
    // Package not found — treat as unverified
    return {
      ...response,
      alternativeVerified: false,
      alternativeVerificationScope: "dependency-only",
      alternativeConflicts: [],
    };
  }

  // Check the alternative's dependencies against all tools in the group,
  // using the original constraints from the conflict request when available.
  const toolsToCheck = [
    { toolName: alternativeName, version: null, dependencies: lookupResult.dependencies },
    ...existingTools
      .filter((t) => t !== alternativeName)
      .map((t) => ({ toolName: t, version: null, dependencies: toolDependencies[t] ?? [] })),
  ];

  const conflicts = runCrossToolCompatibilityCheck(toolsToCheck);

  return {
    ...response,
    alternativeVerified: conflicts.length === 0,
    alternativeVerificationScope: "dependency-only",
    alternativeConflicts: conflicts,
  };
}
