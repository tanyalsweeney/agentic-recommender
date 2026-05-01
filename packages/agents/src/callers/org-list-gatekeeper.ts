import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { OrgListGatekeeperOutput, ProviderConfig } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/org-list-gatekeeper.txt"),
  "utf-8"
);

export async function callOrgListGatekeeperAgent(
  currentOrgList: unknown,
  proposedChange: unknown,
  providerConfig: ProviderConfig,
  secondPass?: { humanOverrideReasoning: string },
): Promise<OrgListGatekeeperOutput> {
  return callAgent({
    agentName: "org-list-gatekeeper",
    systemPrompt: PROMPT,
    manifest: currentOrgList,
    verifiedContext: {
      proposedChange,
      isSecondPass: secondPass !== undefined,
      humanOverrideReasoning: secondPass?.humanOverrideReasoning ?? null,
    },
    zodSchema: OrgListGatekeeperOutput,
    providerConfig,
  });
}
