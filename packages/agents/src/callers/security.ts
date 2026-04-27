import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { SecurityAgentOutput } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../../prompts/security.txt"),
  "utf-8"
);

export async function callSecurityAgent(
  manifest: unknown,
  verifiedContext: unknown,
  client: Anthropic
): Promise<SecurityAgentOutput> {
  return callAgent({
    agentName: "security",
    systemPrompt: PROMPT,
    manifest,
    verifiedContext,
    zodSchema: SecurityAgentOutput,
    client,
  });
}
