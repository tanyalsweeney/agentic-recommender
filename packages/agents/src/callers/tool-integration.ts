import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { ToolIntegrationAgentOutput } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../../prompts/tool-integration.txt"),
  "utf-8"
);

export async function callToolIntegrationAgent(
  manifest: unknown,
  verifiedContext: unknown,
  client: Anthropic
): Promise<ToolIntegrationAgentOutput> {
  return callAgent({
    agentName: "tool_integration",
    systemPrompt: PROMPT,
    manifest,
    verifiedContext,
    zodSchema: ToolIntegrationAgentOutput,
    client,
  });
}
