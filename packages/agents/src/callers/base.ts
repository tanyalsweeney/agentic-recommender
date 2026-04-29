import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ProviderConfig } from "../schemas/index.js";
import { PROVIDER_REGISTRY, ProviderName } from "../providers.js";

const MAX_TOKENS = 8192;

// Manifest section flags. Omitting a key defaults to false (exclude).
// Each caller declares exactly what its agent needs — nothing more.
// This reduces input tokens per call by 20-80% depending on the agent,
// and is the primary cost mitigation for the OpenAI-compatible path.
export interface ManifestSections {
  tools?: boolean;
  patterns?: boolean;
  failureModes?: boolean;
}

export function filterManifest(manifest: unknown, sections: ManifestSections): unknown {
  if (!manifest || typeof manifest !== "object") return manifest;
  const m = manifest as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  if (sections.tools && m.tools !== undefined)       result.tools = m.tools;
  if (sections.patterns && m.patterns !== undefined) result.patterns = m.patterns;
  if (sections.failureModes && m.failureModes !== undefined) result.failureModes = m.failureModes;
  return result;
}

export interface CallAgentOptions<T> {
  agentName: string;
  systemPrompt: string;
  manifest: unknown;
  verifiedContext: unknown;
  upstreamOutputs?: unknown;
  zodSchema: z.ZodType<T>;
  providerConfig: ProviderConfig;
}

export async function callAgent<T>(opts: CallAgentOptions<T>): Promise<T> {
  const entry = PROVIDER_REGISTRY[opts.providerConfig.provider as ProviderName];
  if (!entry) {
    throw new Error(
      `Unknown provider "${opts.providerConfig.provider}". ` +
      `Registered providers: ${Object.keys(PROVIDER_REGISTRY).join(", ")}`
    );
  }
  if (entry.type === "anthropic") {
    return callAnthropicAgent(opts, entry);
  }
  return callOpenAICompatibleAgent(opts, entry);
}

async function callAnthropicAgent<T>(
  opts: CallAgentOptions<T>,
  entry: typeof PROVIDER_REGISTRY[keyof typeof PROVIDER_REGISTRY] & { type: "anthropic" }
): Promise<T> {
  const { agentName, systemPrompt, manifest, verifiedContext, upstreamOutputs, zodSchema, providerConfig } = opts;

  const apiKey = process.env[entry.systemApiKeyEnvVar];
  if (!apiKey) throw new Error(`${entry.systemApiKeyEnvVar} is not set`);
  const client = new Anthropic({ apiKey });

  const toolName = `${agentName.replace(/-/g, "_")}_output`;
  const inputSchema = zodToJsonSchema(zodSchema, { target: "openAi" });
  const { $schema: _, ...schemaBody } = inputSchema as Record<string, unknown>;

  const upstreamBlock = upstreamOutputs
    ? `\n\nUPSTREAM AGENT OUTPUTS:\n${JSON.stringify(upstreamOutputs, null, 2)}`
    : "";

  const response = await client.messages.create({
    model: providerConfig.model,
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

async function callOpenAICompatibleAgent<T>(
  opts: CallAgentOptions<T>,
  entry: typeof PROVIDER_REGISTRY[keyof typeof PROVIDER_REGISTRY] & { type: "openai-compatible" }
): Promise<T> {
  const { agentName, systemPrompt, manifest, verifiedContext, upstreamOutputs, zodSchema, providerConfig } = opts;

  const apiKey = process.env[entry.systemApiKeyEnvVar];
  if (!apiKey) throw new Error(`${entry.systemApiKeyEnvVar} is not set`);
  const client = new OpenAI({ apiKey, baseURL: entry.baseUrl });

  const toolName = `${agentName.replace(/-/g, "_")}_output`;
  const inputSchema = zodToJsonSchema(zodSchema, { target: "openAi" });
  const { $schema: _, ...schemaBody } = inputSchema as Record<string, unknown>;

  const upstreamBlock = upstreamOutputs
    ? `\n\nUPSTREAM AGENT OUTPUTS:\n${JSON.stringify(upstreamOutputs, null, 2)}`
    : "";

  // No prompt caching on the OpenAI-compatible path. Manifest and system prompt
  // are sent in full every call. Mitigated by checkpoint reuse; filtered manifest
  // per agent is a planned fast follow to reduce token cost further.
  const response = await client.chat.completions.create({
    model: providerConfig.model,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content:
          `MANIFEST (tool and pattern knowledge base):\n${JSON.stringify(manifest, null, 2)}\n\n` +
          `VERIFIED CONTEXT (user's confirmed architecture decisions):\n${JSON.stringify(verifiedContext, null, 2)}` +
          `${upstreamBlock}\n\nProvide your structured output using the ${toolName} function.`,
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: toolName,
          description: `Structured output for the ${agentName} agent`,
          parameters: schemaBody as Record<string, unknown>,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: toolName } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    throw new Error(`${agentName}: no tool call in response — model did not call the function`);
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return zodSchema.parse(parsed);
}
