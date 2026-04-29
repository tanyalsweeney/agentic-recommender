import { ProviderConfig } from "../schemas/index.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { IntakeAgentOutput } from "../schemas/index.js";
import { callAgent, filterManifest } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/intake.txt"),
  "utf-8"
);

export async function callIntakeAgent(
  manifest: unknown,
  verifiedContext: { description: string; constraints: string[] },
  providerConfig: ProviderConfig
): Promise<IntakeAgentOutput> {
  return callAgent({
    agentName: "intake",
    systemPrompt: PROMPT,
    manifest: filterManifest(manifest, { tools: true, patterns: true }),
    verifiedContext,
    zodSchema: IntakeAgentOutput,
    providerConfig,
  });
}
