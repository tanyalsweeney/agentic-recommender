import { ProviderConfig } from "../schemas/index.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { TrustControlAgentOutput } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/trust-control.txt"),
  "utf-8"
);

export async function callTrustControlAgent(
  manifest: unknown,
  verifiedContext: unknown,
  upstreamOutputs: { failureObservability: unknown },
  providerConfig: ProviderConfig
): Promise<TrustControlAgentOutput> {
  return callAgent({
    agentName: "trust_control",
    systemPrompt: PROMPT,
    manifest,
    verifiedContext,
    upstreamOutputs,
    zodSchema: TrustControlAgentOutput,
    providerConfig,
  });
}
