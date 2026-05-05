export interface ToolResultInput {
  toolName: string;
  version: string | null;
  cves: { critical: string[]; high: string[] };
  license: string | null;
  isCopyleft: boolean;
}

export interface ConflictResult {
  toolName: string;
  description: string;
  compatibleAlternativeVersion: string;
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Check per-tool results against declared constraints from Wave 1 agents.
 * When a version conflict is found, surfaces a compatible alternative version
 * rather than just a rejection flag — callers get a resolution path.
 *
 * Constraint format parsed: "{toolName} {operator} {version} ..."
 * e.g. "langchain >= 0.2.0 required for openai-sdk 4.x compatibility"
 */
export async function runCrossAgentConflictCheck(
  toolResults: ToolResultInput[],
  wave1Results: {
    toolIntegration?: { declaredConstraints?: string[] };
    orchestration?: { declaredConstraints?: string[] };
    security?: { declaredConstraints?: string[] };
  }
): Promise<ConflictResult[]> {
  const constraints: string[] = [
    ...(wave1Results.toolIntegration?.declaredConstraints ?? []),
    ...(wave1Results.orchestration?.declaredConstraints ?? []),
    ...(wave1Results.security?.declaredConstraints ?? []),
  ];

  if (constraints.length === 0) return [];

  const conflicts: ConflictResult[] = [];
  const toolMap = new Map(toolResults.map((t) => [t.toolName.toLowerCase(), t]));

  for (const constraint of constraints) {
    const parsed = parseVersionConstraint(constraint);
    if (!parsed) continue;

    const tool = toolMap.get(parsed.toolName.toLowerCase());
    if (!tool || !tool.version) continue;

    if (violatesConstraint(tool.version, parsed.operator, parsed.requiredVersion)) {
      const compatibleVersion = resolveCompatibleVersion(parsed.operator, parsed.requiredVersion);
      conflicts.push({
        toolName: parsed.toolName,
        description: `${tool.toolName} ${tool.version} violates constraint: ${constraint}`,
        compatibleAlternativeVersion: compatibleVersion,
        severity: "high",
      });
    }
  }

  return conflicts;
}

interface ParsedConstraint {
  toolName: string;
  operator: string;
  requiredVersion: string;
}

// Matches patterns like: "langchain >= 0.2.0", "redis > 4.0", "numpy == 1.24.0"
const CONSTRAINT_PATTERN = /(\S+)\s*(>=|>|<=|<|==|!=)\s*([\d.]+)/;

function parseVersionConstraint(text: string): ParsedConstraint | null {
  const match = CONSTRAINT_PATTERN.exec(text);
  if (!match) return null;
  return { toolName: match[1], operator: match[2], requiredVersion: match[3] };
}

function violatesConstraint(current: string, operator: string, required: string): boolean {
  const cmp = compareVersions(current, required);
  switch (operator) {
    case ">=": return cmp < 0;
    case ">":  return cmp <= 0;
    case "<=": return cmp > 0;
    case "<":  return cmp >= 0;
    case "==": return cmp !== 0;
    case "!=": return cmp === 0;
    default:   return false;
  }
}

function resolveCompatibleVersion(operator: string, requiredVersion: string): string {
  // For >= and > constraints, the required version itself (or a minor bump) is the
  // lowest compatible option. Surface it as the recommendation.
  if (operator === ">" ) {
    const parts = requiredVersion.split(".").map(Number);
    parts[parts.length - 1] += 1;
    return parts.join(".");
  }
  return requiredVersion;
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
