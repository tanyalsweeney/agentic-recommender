import { createHash } from "crypto";
import { readFileSync, statSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const PROMPTS_DIR = resolve(fileURLToPath(import.meta.url), "../../prompts");

function fileVersion(filename: string): string {
  const path = resolve(PROMPTS_DIR, filename);
  const content = readFileSync(path, "utf-8");
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 8);
  const mtime = statSync(path).mtime.toISOString().slice(0, 10);
  return `${mtime}-${hash}`;
}

// Computed once at startup. Version changes only when the prompt file changes.
export const agentVersions = {
  intake:                 fileVersion("intake.txt"),
  orchestration:          fileVersion("orchestration.txt"),
  security:               fileVersion("security.txt"),
  memoryState:            fileVersion("memory-state.txt"),
  toolIntegration:        fileVersion("tool-integration.txt"),
  failureObservability:   fileVersion("failure-observability.txt"),
  trustControl:           fileVersion("trust-control.txt"),
  compatibilityValidator: fileVersion("compatibility-validator.txt"),
  skeptic:                fileVersion("skeptic.txt"),
  technicalWriter:        fileVersion("technical-writer.txt"),
} as const;

export type AgentName = keyof typeof agentVersions;
