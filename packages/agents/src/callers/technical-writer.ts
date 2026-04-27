import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { TechnicalWriterOutput } from "../schemas/index.js";
import { callAgent } from "./base.js";

const PROMPT = readFileSync(
  resolve(fileURLToPath(import.meta.url), "../../../prompts/technical-writer.txt"),
  "utf-8"
);

export async function callTechnicalWriterAgent(
  manifest: unknown,
  verifiedContext: unknown,
  upstreamOutputs: { wave1: unknown; wave2: unknown; cv: unknown; skeptic: unknown },
  client: Anthropic
): Promise<TechnicalWriterOutput> {
  return callAgent({
    agentName: "technical_writer",
    systemPrompt: PROMPT,
    manifest,
    verifiedContext,
    upstreamOutputs,
    zodSchema: TechnicalWriterOutput,
    client,
  });
}
