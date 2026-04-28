import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { SkepticOutput } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../prompts/skeptic.txt"),
  "utf-8"
);

export async function callSkepticAgent(
  manifest: unknown,
  verifiedContext: unknown,
  upstreamOutputs: { wave1: unknown; wave2: unknown; cv: unknown },
  client: Anthropic
): Promise<SkepticOutput> {
  return callAgent({
    agentName: "skeptic",
    systemPrompt: PROMPT,
    manifest,
    verifiedContext,
    upstreamOutputs,
    zodSchema: SkepticOutput,
    client,
  });
}
