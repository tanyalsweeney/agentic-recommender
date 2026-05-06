import type { PerToolCvResult } from "./per-tool-lookup.js";

export interface ConflictResult {
  toolName: string;
  agentKey: string | null;
  description: string;
  // Lowest version satisfying the violated constraint, or null for upper-bound constraints.
  compatibleVersion: string | null;
  severity: "low" | "medium" | "high" | "critical";
}

// Checks per-tool results against version constraints declared by Wave 1 agents.
// Resolves a compatible version alongside each conflict so the correction exchange
// has a resolution path, not just a flag.
export async function runCrossAgentConflictCheck(
  tools: PerToolCvResult[],
  wave1Results: {
    toolIntegration?: { declaredConstraints?: string[] };
    orchestration?:   { declaredConstraints?: string[] };
    security?:        { declaredConstraints?: string[] };
  }
): Promise<ConflictResult[]> {
  const constraints = [
    ...(wave1Results.toolIntegration?.declaredConstraints ?? []),
    ...(wave1Results.orchestration?.declaredConstraints   ?? []),
    ...(wave1Results.security?.declaredConstraints        ?? []),
  ];

  if (!constraints.length) return [];

  const byName = new Map(tools.map((t) => [t.toolName.toLowerCase(), t]));
  const conflicts: ConflictResult[] = [];

  for (const constraint of constraints) {
    const parsed = parseConstraint(constraint);
    if (!parsed) continue;

    const tool = byName.get(parsed.toolName.toLowerCase());
    if (!tool?.version) continue;

    if (violates(tool.version, parsed.op, parsed.version)) {
      conflicts.push({
        toolName:          parsed.toolName,
        agentKey:          tool.agentKey,
        description:       `${tool.toolName} ${tool.version} violates: ${constraint}`,
        compatibleVersion: resolveCompatible(parsed.op, parsed.version),
        severity:          "high",
      });
    }
  }

  return conflicts;
}

// ── helpers ───────────────────────────────────────────────────────────────────

interface Constraint { toolName: string; op: string; version: string }

// Matches: "langchain >= 0.2.0", "redis > 4.0", "numpy == 1.24.0"
const PATTERN = /(\S+)\s*(>=|>|<=|<|==|!=)\s*([\d.]+)/;

function parseConstraint(text: string): Constraint | null {
  const m = PATTERN.exec(text);
  return m ? { toolName: m[1], op: m[2], version: m[3] } : null;
}

function violates(current: string, op: string, required: string): boolean {
  const c = semverCmp(current, required);
  switch (op) {
    case ">=": return c < 0;
    case ">":  return c <= 0;
    case "<=": return c > 0;
    case "<":  return c >= 0;
    case "==": return c !== 0;
    case "!=": return c === 0;
    default:   return false;
  }
}

function resolveCompatible(op: string, required: string): string | null {
  if (op === "==" || op === ">=") return required;
  if (op === ">") {
    const parts = required.split(".").map(Number);
    parts[parts.length - 1] += 1;
    return parts.join(".");
  }
  return null; // upper-bound constraints have no deterministic minimum
}

function semverCmp(a: string, b: string): number {
  const ap = a.split(".").map(Number);
  const bp = b.split(".").map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const d = (ap[i] ?? 0) - (bp[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
