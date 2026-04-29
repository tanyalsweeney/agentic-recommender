import { ProviderConfig } from "../schemas/index.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { OrchestrationAgentOutput } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/orchestration.txt"),
  "utf-8"
);

export async function callOrchestrationAgent(
  manifest: unknown,
  verifiedContext: unknown,
  providerConfig: ProviderConfig
): Promise<OrchestrationAgentOutput> {
  return callAgent({
    agentName: "orchestration",
    systemPrompt: PROMPT,
    manifest,
    verifiedContext,
    zodSchema: OrchestrationAgentOutput,
    providerConfig,
  });
}
