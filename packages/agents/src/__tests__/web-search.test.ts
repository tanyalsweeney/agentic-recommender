/**
 * Unit tests for searchToolData — one LLM web search per tool covering all
 * data points with no structured API source: pricing, EOL, breaking changes,
 * trip hazards, and source URLs for every page consulted.
 *
 * Requiring URLs per source is intentional: the model must commit to a
 * checkable page for each claim. Missing URLs surface uncertainty;
 * fabricated URLs are catchable. Either is better than unverifiable claims.
 *
 * Anthropic SDK mocked — no real API calls, no tokens consumed.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn() }));

import Anthropic from "@anthropic-ai/sdk";
import { searchToolData } from "../web-search.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeToolUseResponse(input: Record<string, unknown>) {
  return {
    content: [{ type: "tool_use", name: "tool_research_output", input }],
  };
}

// ── setup ─────────────────────────────────────────────────────────────────────

const MockAnthropic = vi.mocked(Anthropic);
let mockCreate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  mockCreate = vi.fn();
  MockAnthropic.mockImplementation(
    () => ({ beta: { messages: { create: mockCreate } } }) as unknown as Anthropic
  );
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  vi.clearAllMocks();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe("searchToolData", () => {
  it("returns all fields and source URLs when the model produces structured output", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse({
      pricing: "Free",
      pricingFlagged: false,
      eolDate: null,
      breakingChanges: ["v0.2.0: chain() removed — use LCEL pipe() instead"],
      tripHazards: ["Context window pressure exceeds 128k at >10 parallel sub-agents"],
      sourceUrls: {
        registry: "https://pypi.org/project/langchain/0.1.0/",
        docs: "https://python.langchain.com/docs/",
        changelog: "https://github.com/langchain-ai/langchain/releases",
      },
    }));

    const result = await searchToolData("langchain", "0.1.0");

    expect(result.pricing).toBe("Free");
    expect(result.pricingFlagged).toBe(false);
    expect(result.eolDate).toBeNull();
    expect(result.breakingChanges).toHaveLength(1);
    expect(result.tripHazards).toHaveLength(1);
    expect(result.sourceUrls.registry).toContain("pypi.org");
    expect(result.sourceUrls.docs).toContain("python.langchain.com");
    expect(result.sourceUrls.changelog).toContain("releases");
  });

  it("includes a pricing URL when the tool has a paid tier", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse({
      pricing: "Free tier (1 index, 100k vectors). Paid from $70/month.",
      pricingFlagged: false,
      eolDate: null,
      breakingChanges: [],
      tripHazards: [],
      sourceUrls: {
        registry: "https://www.npmjs.com/package/@pinecone-database/pinecone",
        pricing: "https://www.pinecone.io/pricing/",
        docs: "https://docs.pinecone.io/",
      },
    }));

    const result = await searchToolData("pinecone", "3.0.0");

    expect(result.pricingFlagged).toBe(false);
    expect(result.sourceUrls.pricing).toBe("https://www.pinecone.io/pricing/");
    // User can click straight to the pricing page to verify the tier claim
    expect(result.sourceUrls).toHaveProperty("pricing");
  });

  it("omits the pricing key from sourceUrls when pricing cannot be determined", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse({
      pricing: null,
      pricingFlagged: true,
      eolDate: null,
      breakingChanges: [],
      tripHazards: [],
      sourceUrls: {
        registry: "https://pypi.org/project/some-tool/",
      },
    }));

    const result = await searchToolData("some-tool", "1.0.0");

    expect(result.pricingFlagged).toBe(true);
    expect(result.pricing).toBeNull();
    // No pricing URL when pricing is unknown — absence is the signal
    expect(result.sourceUrls.pricing).toBeUndefined();
    expect(result.sourceUrls.registry).toBeDefined();
  });

  it("includes an EOL date and changelog URL when the version is end-of-life", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse({
      pricing: "Open-source",
      pricingFlagged: false,
      eolDate: "2024-06-30",
      breakingChanges: [],
      tripHazards: ["No security patches after 2024-06-30"],
      sourceUrls: {
        registry: "https://pypi.org/project/old-lib/1.0.0/",
        changelog: "https://github.com/some/old-lib/blob/main/CHANGELOG.md#100",
      },
    }));

    const result = await searchToolData("old-lib", "1.0.0");

    expect(result.eolDate).toBe("2024-06-30");
    expect(result.sourceUrls.changelog).toContain("CHANGELOG");
  });

  it("includes a docs URL with trip hazards so users can read full context", async () => {
    mockCreate.mockResolvedValue(makeToolUseResponse({
      pricing: "Free",
      pricingFlagged: false,
      eolDate: null,
      breakingChanges: [],
      tripHazards: [
        "Requires headless browser binaries (~300MB) — Lambda zip deployment not viable",
        "Minimum 1GB memory for headless Chrome",
      ],
      sourceUrls: {
        registry: "https://www.npmjs.com/package/playwright/v/1.44.0",
        docs: "https://playwright.dev/docs/intro",
      },
    }));

    const result = await searchToolData("playwright", "1.44.0");

    expect(result.tripHazards).toHaveLength(2);
    // User can click docs to read the full deployment constraints
    expect(result.sourceUrls.docs).toContain("playwright.dev");
  });

  it("returns empty sourceUrls and flags pricing when model produces text only", async () => {
    // Model searched but did not call the output tool — safe fallback
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "Langchain is a popular orchestration framework..." }],
    });

    const result = await searchToolData("langchain", null);

    expect(result.pricingFlagged).toBe(true);
    expect(result.pricing).toBeNull();
    expect(result.breakingChanges).toHaveLength(0);
    expect(result.tripHazards).toHaveLength(0);
    expect(result.sourceUrls).toEqual({});
  });

  it("throws when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(searchToolData("langchain", "0.1.0")).rejects.toThrow(
      "ANTHROPIC_API_KEY is not set"
    );
  });
});
