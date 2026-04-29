import { ProviderConfig } from "../schemas/index.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { FailureObservabilityAgentOutput } from "../schemas/index.js";
import { callAgent, filterManifest } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/failure-observability.txt"),
  "utf-8"
);

export async function callFailureObservabilityAgent(
  manifest: unknown,
  verifiedContext: unknown,
  providerConfig: ProviderConfig
): Promise<FailureObservabilityAgentOutput> {
  return callAgent({
    agentName: "failure_observability",
    systemPrompt: PROMPT,
    manifest: filterManifest(manifest, { patterns: true, failureModes: true }),
    verifiedContext,
    zodSchema: FailureObservabilityAgentOutput,
    providerConfig,
  });
}
