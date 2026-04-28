import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { CompatibilityValidatorOutput } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/compatibility-validator.txt"),
  "utf-8"
);

// CV uses web search to verify live tool data. The web_search tool is passed
// alongside the output tool so the model can look up real documentation.
export async function callCompatibilityValidator(
  manifest: unknown,
  verifiedContext: unknown,
  upstreamOutputs: { wave1: unknown; wave2: unknown },
  client: Anthropic
): Promise<CompatibilityValidatorOutput> {
  return callAgent({
    agentName: "compatibility_validator",
    systemPrompt: PROMPT,
    manifest,
    verifiedContext,
    upstreamOutputs,
    zodSchema: CompatibilityValidatorOutput,
    client,
  });
  // TODO Phase 3: add web_search_20250305 tool alongside the output tool
  // so CV can perform live research per tool before filling in the output schema.
}
