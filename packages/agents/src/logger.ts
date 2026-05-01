/**
 * Agent call logger. Opt-in via AGENT_CALL_LOG env var.
 * Set AGENT_CALL_LOG=packages/evals/logs/agent-calls.csv to enable.
 * Appends one row per agent call. Creates the file with a header row on first write.
 */

import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

const CSV_HEADER = "timestamp,agent_name,provider,model,duration_ms,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,estimated_cost_usd\n";

// Pricing in USD per token (Sonnet 4.6 defaults; other models included for BYOK paths)
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-4-6": {
    input:      3.00  / 1_000_000,
    output:     15.00 / 1_000_000,
    cacheRead:  0.30  / 1_000_000,
    cacheWrite: 3.75  / 1_000_000,
  },
  "claude-opus-4-7": {
    input:      15.00 / 1_000_000,
    output:     75.00 / 1_000_000,
    cacheRead:  1.50  / 1_000_000,
    cacheWrite: 18.75 / 1_000_000,
  },
  "claude-haiku-4-5-20251001": {
    input:      0.80 / 1_000_000,
    output:     4.00 / 1_000_000,
    cacheRead:  0.08 / 1_000_000,
    cacheWrite: 1.00 / 1_000_000,
  },
};

export interface AgentCallStats {
  agentName: string;
  provider: string;
  model: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export function estimateCost(model: string, stats: Pick<AgentCallStats, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens">): number {
  const p = PRICING[model];
  if (!p) return 0;
  const billableInput = Math.max(0, stats.inputTokens - stats.cacheReadTokens - stats.cacheWriteTokens);
  return (
    billableInput         * p.input +
    stats.outputTokens    * p.output +
    stats.cacheReadTokens * p.cacheRead +
    stats.cacheWriteTokens * p.cacheWrite
  );
}

export function logAgentCall(stats: AgentCallStats): void {
  const logFile = process.env.AGENT_CALL_LOG;
  if (!logFile) return;

  try {
    mkdirSync(dirname(logFile), { recursive: true });

    if (!existsSync(logFile)) {
      writeFileSync(logFile, CSV_HEADER, "utf-8");
    }

    const cost = estimateCost(stats.model, stats);
    const row = [
      new Date().toISOString(),
      stats.agentName,
      stats.provider,
      stats.model,
      stats.durationMs,
      stats.inputTokens,
      stats.outputTokens,
      stats.cacheReadTokens,
      stats.cacheWriteTokens,
      cost.toFixed(6),
    ].join(",") + "\n";

    appendFileSync(logFile, row, "utf-8");
  } catch {
    // Never let logging break an agent call.
  }
}
