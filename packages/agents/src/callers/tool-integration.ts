import { ProviderConfig } from "../schemas/index.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { ToolIntegrationAgentOutput } from "../schemas/index.js";
import { callAgent, filterManifest } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/tool-integration.txt"),
  "utf-8"
);

export async function callToolIntegrationAgent(
  manifest: unknown,
  verifiedContext: unknown,
  providerConfig: ProviderConfig
): Promise<ToolIntegrationAgentOutput> {
  return callAgent({
    agentName: "tool_integration",
    systemPrompt: PROMPT,
    manifest: filterManifest(manifest, { tools: true }),
    verifiedContext,
    zodSchema: ToolIntegrationAgentOutput,
    providerConfig,
  });
}
