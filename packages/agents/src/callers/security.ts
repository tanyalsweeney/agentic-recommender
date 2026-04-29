import { ProviderConfig } from "../schemas/index.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { SecurityAgentOutput } from "../schemas/index.js";
import { callAgent, filterManifest } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/security.txt"),
  "utf-8"
);

export async function callSecurityAgent(
  manifest: unknown,
  verifiedContext: unknown,
  providerConfig: ProviderConfig
): Promise<SecurityAgentOutput> {
  return callAgent({
    agentName: "security",
    systemPrompt: PROMPT,
    manifest: filterManifest(manifest, { tools: true }),
    verifiedContext,
    zodSchema: SecurityAgentOutput,
    providerConfig,
  });
}
