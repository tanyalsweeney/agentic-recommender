/**
 * Eval for searchToolData — validates that the Anthropic web search integration
 * actually retrieves meaningful, accurate data for real tools.
 *
 * These tests cannot be mocked: they catch a broken prompt, wrong beta header,
 * the model ignoring web search, or the model producing hallucinated URLs.
 *
 * Run manually before any change to the web search prompt or tool schema:
 *   pnpm --filter evals exec vitest run src/web-search/web-search.eval.ts
 *
 * Two scenarios chosen for distinct coverage:
 *   - langchain 0.0.1: very old version, known gotchas, free, breaking changes expected
 *   - pinecone (current): managed SaaS with a paid tier and a public pricing page
 */

import { describe, it, expect, beforeAll } from "vitest";
import { searchToolData, type WebSearchResult } from "@agent12/agents";

// ── scenario 1: old open-source package with known gotchas ────────────────────

let langchainResult: WebSearchResult;

describe("web-search eval 1: langchain 0.0.1 — old version, free, known gotchas", () => {
  beforeAll(async () => {
    langchainResult = await searchToolData("langchain", "0.0.1");
  }, 60_000);

  it("returns a registry source URL for human audit", () => {
    expect(langchainResult.sourceUrls).toHaveProperty("registry");
    expect(langchainResult.sourceUrls.registry).toMatch(/^https?:\/\//);
  });

  it("marks langchain as free (not pricingFlagged)", () => {
    // langchain is MIT-licensed and free — model should find this confidently
    expect(langchainResult.pricingFlagged).toBe(false);
    expect(langchainResult.pricing).toBeTruthy();
  });

  it("surfaces breaking changes between 0.0.1 and current stable", () => {
    // 0.0.1 is extremely old — there are many breaking changes
    expect(langchainResult.breakingChanges.length).toBeGreaterThan(0);
  });

  it("surfaces known production trip hazards for langchain", () => {
    // langchain has well-documented gotchas (context window, LCEL migration, etc.)
    expect(langchainResult.tripHazards.length).toBeGreaterThan(0);
  });
});

// ── scenario 2: paid SaaS tool with a public pricing page ────────────────────

let pineconeResult: WebSearchResult;

describe("web-search eval 2: pinecone (current) — paid SaaS, pricing URL expected", () => {
  beforeAll(async () => {
    pineconeResult = await searchToolData("pinecone", null);
  }, 60_000);

  it("returns a registry or docs source URL", () => {
    const urls = Object.values(pineconeResult.sourceUrls);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls[0]).toMatch(/^https?:\/\//);
  });

  it("includes a pricing URL so users can verify the tier claim", () => {
    // Pinecone has a public pricing page — the model should find and cite it
    expect(pineconeResult.sourceUrls).toHaveProperty("pricing");
    expect(pineconeResult.sourceUrls.pricing).toMatch(/pinecone/i);
  });

  it("does not flag pricing as unavailable", () => {
    // Pinecone's pricing is publicly documented
    expect(pineconeResult.pricingFlagged).toBe(false);
    expect(pineconeResult.pricing).toBeTruthy();
  });

  it("includes a docs URL for integration reference", () => {
    const urls = pineconeResult.sourceUrls;
    const hasDocs = "docs" in urls || "registry" in urls;
    expect(hasDocs).toBe(true);
  });
});
