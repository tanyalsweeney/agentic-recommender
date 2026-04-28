import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { IntakeAgentOutput } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/intake.txt"),
  "utf-8"
);

export async function callIntakeAgent(
  manifest: unknown,
  verifiedContext: { description: string; constraints: string[] },
  client: Anthropic
): Promise<IntakeAgentOutput> {
  return callAgent({
    agentName: "intake",
    systemPrompt: PROMPT,
    manifest,
    verifiedContext,
    zodSchema: IntakeAgentOutput,
    client,
  });
}
