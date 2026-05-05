import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const WebSearchOutputSchema = z.object({
  pricing: z.string().nullish(),
  pricingFlagged: z.boolean(),
  eolDate: z.string().nullish(),        // YYYY-MM-DD or null
  breakingChanges: z.array(z.string()),
  tripHazards: z.array(z.string()),
  sourceUrls: z.record(z.string()),     // one URL per source consulted
});

export type WebSearchResult = z.infer<typeof WebSearchOutputSchema>;

/**
 * One Anthropic web search call per tool, covering every data point with no
 * structured API source: pricing, EOL date, breaking changes between the
 * recommended version and current stable, known production trip hazards, and
 * a source URL per page consulted for human audit.
 *
 * Requiring sourceUrls per source is intentional: the model must commit to a
 * checkable page for each claim. A missing URL surfaces model uncertainty; a
 * wrong URL is catchable. Both are better than unverifiable assertions.
 *
 * Uses the Anthropic beta web_search_20250305 server-side tool. The model
 * searches and synthesizes, then calls tool_research_output for structured
 * output. Falls back to empty/flagged result if no tool call is produced.
 */
export async function searchToolData(
  toolName: string,
  version: string | null
): Promise<WebSearchResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });
  const inputSchema = zodToJsonSchema(WebSearchOutputSchema, { target: "openAi" });
  const { $schema: _, ...schemaBody } = inputSchema as Record<string, unknown>;

  const versionStr = version
    ? `version ${version}`
    : "(version unknown — research the current stable release)";

  const response = await (client.beta.messages as unknown as {
    create: (params: object) => Promise<{
      content: Array<{ type: string; name?: string; input?: unknown }>;
    }>;
  }).create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    betas: ["web-search-2025-03-05"],
    tools: [
      { type: "web_search_20250305", name: "web_search" },
      {
        name: "tool_research_output",
        description: "Structured research findings for a tool",
        input_schema: schemaBody,
      },
    ],
    // Let the model use web_search as needed, then call tool_research_output.
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `Research ${toolName} ${versionStr} and call tool_research_output with:

1. pricing: What does this tool cost? Use "$0" or "Free" for free tools. For paid
   tools include the tier structure (e.g. "Free tier: 1 index. Paid from $70/month.").
   Never describe a license as a price — MIT/Apache are licenses, not prices.
2. pricingFlagged: true only if pricing genuinely cannot be determined after searching.
3. eolDate: Is this specific version end-of-life? YYYY-MM-DD, or null.
4. breakingChanges: What changed between ${version ?? "this version"} and current stable
   that would break existing code? Empty array if this IS the current stable version.
5. tripHazards: Known production gotchas specific to this version — deployment
   constraints, memory requirements, known incompatibilities, integration failures.
6. sourceUrls: One URL per source consulted. Allowed keys:
   "registry" (PyPI/npm page), "pricing" (pricing page if paid), "docs" (official
   docs), "changelog" (release notes), "advisory" (security advisory if relevant).
   Only include a key if you actually found and used that URL.

Use web_search to find current information, then call tool_research_output.`,
      },
    ],
  });

  const outputBlock = response.content.find(
    (b) => b.type === "tool_use" && b.name === "tool_research_output"
  );

  if (!outputBlock || outputBlock.type !== "tool_use") {
    return {
      pricing: null,
      pricingFlagged: true,
      eolDate: null,
      breakingChanges: [],
      tripHazards: [],
      sourceUrls: {},
    };
  }

  return WebSearchOutputSchema.parse(outputBlock.input);
}
