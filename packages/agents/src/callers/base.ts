import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192;

export interface CallAgentOptions<T> {
  agentName: string;
  systemPrompt: string;
  manifest: unknown;
  verifiedContext: unknown;
  upstreamOutputs?: unknown;
  zodSchema: z.ZodType<T>;
  client: Anthropic;
}

export async function callAgent<T>(opts: CallAgentOptions<T>): Promise<T> {
  const { agentName, systemPrompt, manifest, verifiedContext, upstreamOutputs, zodSchema, client } = opts;

  const toolName = `${agentName.replace(/-/g, "_")}_output`;
  const inputSchema = zodToJsonSchema(zodSchema, { target: "openAi" });
  // zodToJsonSchema wraps in { $schema, ... } — extract just the schema body
  const { $schema: _, ...schemaBody } = inputSchema as Record<string, unknown>;

  const upstreamBlock = upstreamOutputs
    ? `\n\nUPSTREAM AGENT OUTPUTS:\n${JSON.stringify(upstreamOutputs, null, 2)}`
    : "";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: systemPrompt,
        // Layer 1: static agent instructions — cached for 5-min TTL
        cache_control: { type: "ephemeral" },
      },
    ],
    tools: [
      {
        name: toolName,
        description: `Structured output for the ${agentName} agent`,
        input_schema: schemaBody as Anthropic.Tool["input_schema"],
      },
    ],
    tool_choice: { type: "tool", name: toolName },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `MANIFEST (tool and pattern knowledge base):\n${JSON.stringify(manifest, null, 2)}`,
            // Layer 2: manifest — cached, semi-stable
            cache_control: { type: "ephemeral" },
          },
          {
            type: "text",
            // Layer 3: verified context + upstream — changes every run, no cache
            text: `VERIFIED CONTEXT (user's confirmed architecture decisions):\n${JSON.stringify(verifiedContext, null, 2)}${upstreamBlock}\n\nProvide your structured output using the ${toolName} tool.`,
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) {
    throw new Error(`${agentName}: no tool_use block in response — model did not call the tool`);
  }

  return zodSchema.parse(toolUse.input);
}
