import { ProviderConfig } from "../schemas/index.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { MemoryStateAgentOutput } from "../schemas/index.js";
import { callAgent, filterManifest } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/memory-state.txt"),
  "utf-8"
);

export async function callMemoryStateAgent(
  manifest: unknown,
  verifiedContext: unknown,
  providerConfig: ProviderConfig
): Promise<MemoryStateAgentOutput> {
  return callAgent({
    agentName: "memory_state",
    systemPrompt: PROMPT,
    manifest: filterManifest(manifest, { tools: true }),
    verifiedContext,
    zodSchema: MemoryStateAgentOutput,
    providerConfig,
  });
}
