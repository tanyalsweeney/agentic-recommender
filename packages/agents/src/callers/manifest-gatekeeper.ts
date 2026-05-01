import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { ManifestGatekeeperOutput, ProviderConfig } from "../schemas/index.js";
import { callAgent, filterManifest } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/manifest-gatekeeper.txt"),
  "utf-8"
);

export async function callManifestGatekeeperAgent(
  currentManifest: unknown,
  proposedEntry: unknown,
  providerConfig: ProviderConfig,
  priorCycleFindings?: unknown,
): Promise<ManifestGatekeeperOutput> {
  return callAgent({
    agentName: "manifest-gatekeeper",
    systemPrompt: PROMPT,
    manifest: filterManifest(currentManifest, { tools: true, patterns: true, failureModes: true }),
    verifiedContext: proposedEntry,
    upstreamOutputs: priorCycleFindings,
    zodSchema: ManifestGatekeeperOutput,
    providerConfig,
  });
}
