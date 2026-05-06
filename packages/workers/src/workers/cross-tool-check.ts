export interface ToolCompatibilityInput {
  toolName: string;
  version: string | null;
  dependencies: string[];
}

export interface CrossToolConflict {
  // All tools in the group involved in this dependency conflict
  toolPair: string[];
  sharedDependency: string;
  source: "algorithmic" | "llm";
  // Null for algorithmic conflicts — when no intersection exists, there is no
  // version to recommend. The correction exchange asks agents to propose
  // alternative tools instead.
  compatibleVersion: string | null;
  description: string;
}

// ── algorithmic layer ─────────────────────────────────────────────────────────
//
// Group-based: tools sharing a dependency form a group (one group per dep).
// Finds the version range intersection that satisfies ALL tools in the group.
// If no intersection exists, the group has a genuine conflict.
// Algorithmic flags are candidates — the LLM layer confirms or dismisses.

export function runCrossToolCompatibilityCheck(
  tools: ToolCompatibilityInput[]
): CrossToolConflict[] {
  if (tools.length < 2) return [];

  // Build dep groups: depName → [{toolName, constraints}]
  const groups = new Map<string, Array<{ toolName: string; constraints: Constraint[] }>>();

  for (const tool of tools) {
    for (const dep of tool.dependencies) {
      const name = depName(dep);
      if (!name) continue;
      const constraints = depConstraints(dep);
      if (!constraints.length) continue;

      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push({ toolName: tool.toolName, constraints });
    }
  }

  const conflicts: CrossToolConflict[] = [];

  for (const [dep, entries] of groups) {
    if (entries.length < 2) continue;

    const all = entries.flatMap((e) => e.constraints);

    if (!hasIntersection(all)) {
      const toolPair = entries.map((e) => e.toolName);
      const summary = entries
        .map((e) => `${e.toolName}(${e.constraints.map((c) => c.op + c.version).join(",")})`)
        .join(" vs ");

      conflicts.push({
        toolPair,
        sharedDependency: dep,
        source: "algorithmic",
        compatibleVersion: null,
        description: `No compatible ${dep} version satisfies all tools: ${summary}`,
      });
    }
  }

  return conflicts;
}

// ── LLM reasoning scaffold ────────────────────────────────────────────────────
//
// Detects architectural incompatibilities not in package declarations:
// competing orchestration frameworks, embedding dimension mismatches, etc.
// One LLM call over the full tool set + manifest context.
// Returns [] until the implementation is wired.

export async function runCrossToolLlmCheck(
  _tools: ToolCompatibilityInput[],
  _manifest: unknown
): Promise<CrossToolConflict[]> {
  return [];
}

// ── helpers ───────────────────────────────────────────────────────────────────

interface Constraint { op: string; version: string }

// Dep name = everything before the first version operator or @
// Handles: "openai>=1.0.0", "pydantic>=1.7.4,<3", "openai@>=1.0.0"
const DEP_NAME_RE = /^([a-zA-Z0-9._-]+)(?:@|>=|>|<=|<|==|!=|$)/;
function depName(dep: string): string | null {
  return DEP_NAME_RE.exec(dep)?.[1] ?? null;
}

const CONSTRAINT_RE = /(>=|>|<=|<|==|!=)\s*([\d.]+)/g;
function depConstraints(dep: string): Constraint[] {
  const out: Constraint[] = [];
  let m: RegExpExecArray | null;
  CONSTRAINT_RE.lastIndex = 0;
  while ((m = CONSTRAINT_RE.exec(dep)) !== null) {
    out.push({ op: m[1], version: m[2] });
  }
  return out;
}

// Returns true when there exists a version satisfying all constraints in the group.
// Finds the effective lower bound (max of all >=/>), the effective upper bound
// (min of all <=/< ), and checks whether lower < upper.
function hasIntersection(constraints: Constraint[]): boolean {
  let loVer = "0";
  let loInc = true;  // >=
  let hiVer: string | null = null;
  let hiInc = false; // <

  for (const { op, version } of constraints) {
    if (op === ">=" || op === ">") {
      const inc = op === ">=";
      const cmp = semverCmp(version, loVer);
      if (cmp > 0 || (cmp === 0 && !inc && loInc)) {
        loVer = version;
        loInc = inc;
      }
    } else if (op === "<=" || op === "<") {
      const inc = op === "<=";
      if (hiVer === null) {
        hiVer = version;
        hiInc = inc;
      } else {
        const cmp = semverCmp(version, hiVer);
        if (cmp < 0 || (cmp === 0 && !inc && hiInc)) {
          hiVer = version;
          hiInc = inc;
        }
      }
    }
  }

  if (hiVer === null) return true; // no upper bound

  const cmp = semverCmp(loVer, hiVer);
  if (cmp < 0) return true;
  if (cmp === 0 && loInc && hiInc) return true;
  return false;
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
