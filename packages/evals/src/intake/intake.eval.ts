import { describe, it, expect } from "vitest";
import { callIntakeAgent } from "@agent12/agents";
import { anthropic, SEED_MANIFEST } from "../helpers.js";

// ── eval case 1: high-confidence inference ────────────────────────────────────

const highConfidenceInput = {
  description:
    "I'm building a document processing pipeline. Three agents run in sequence: " +
    "one extracts text from PDFs, one classifies the content by topic, one generates " +
    "a structured summary. Runs on AWS Lambda. Using Claude Sonnet. No external APIs, " +
    "no user data, batch processing only. About 100 documents per day.",
  constraints: [],
};

describe("Intake eval 1: high-confidence inference", () => {
  it("infers orchestration pattern as pipeline with high confidence", async () => {
    const output = await callIntakeAgent(SEED_MANIFEST, highConfidenceInput, anthropic);
    expect(output.steps.orchestrationPattern.state).toBe("high_confidence");
    expect(output.steps.orchestrationPattern.selected).toMatch(/pipeline/i);
  });

  it("infers platform as AWS with high confidence", async () => {
    const output = await callIntakeAgent(SEED_MANIFEST, highConfidenceInput, anthropic);
    expect(output.steps.platformDeployment.state).toBe("high_confidence");
    expect(output.steps.platformDeployment.selected).toMatch(/aws|lambda/i);
  });

  it("infers model preference as Claude Sonnet with high confidence", async () => {
    const output = await callIntakeAgent(SEED_MANIFEST, highConfidenceInput, anthropic);
    expect(output.steps.modelPreferences.state).toBe("high_confidence");
    expect(output.steps.modelPreferences.selected).toMatch(/sonnet/i);
  });
});

// ── eval case 2: ambiguous description → low confidence ───────────────────────

const ambiguousInput = {
  description: "I want to build an AI agent that helps with my business.",
  constraints: [],
};

describe("Intake eval 2: ambiguous description → low confidence", () => {
  it("does not pre-select orchestration pattern when description is vague", async () => {
    const output = await callIntakeAgent(SEED_MANIFEST, ambiguousInput, anthropic);
    expect(output.steps.orchestrationPattern.state).toBe("low_confidence");
    expect(output.steps.orchestrationPattern.selected ?? null).toBeNull();
  });

  it("does not pre-select platform when description is vague", async () => {
    const output = await callIntakeAgent(SEED_MANIFEST, ambiguousInput, anthropic);
    expect(output.steps.platformDeployment.state).toBe("low_confidence");
  });
});

// ── eval case 3: constraint classification ────────────────────────────────────

const constraintInput = {
  description: "Building a customer data pipeline for HIPAA-regulated healthcare data.",
  constraints: [
    "must use open-source only, no commercial SaaS services",
    "minimize cost where possible",
    "no data leaves our VPC",
  ],
};

describe("Intake eval 3: constraint classification", () => {
  it("classifies 'open-source only' as binary_exclusion", async () => {
    const output = await callIntakeAgent(SEED_MANIFEST, constraintInput, anthropic);
    const openSource = output.constraintClassifications.find(c =>
      c.constraint.toLowerCase().includes("open-source") ||
      c.constraint.toLowerCase().includes("open source")
    );
    expect(openSource).toBeDefined();
    expect(openSource!.type).toBe("binary_exclusion");
  });

  it("classifies 'minimize cost' as optimization_target", async () => {
    const output = await callIntakeAgent(SEED_MANIFEST, constraintInput, anthropic);
    const cost = output.constraintClassifications.find(c =>
      c.constraint.toLowerCase().includes("cost") ||
      c.constraint.toLowerCase().includes("minim")
    );
    expect(cost).toBeDefined();
    expect(cost!.type).toBe("optimization_target");
  });

  it("classifies 'no data leaves VPC' as binary_exclusion", async () => {
    const output = await callIntakeAgent(SEED_MANIFEST, constraintInput, anthropic);
    const vpc = output.constraintClassifications.find(c =>
      c.constraint.toLowerCase().includes("vpc") ||
      c.constraint.toLowerCase().includes("leaves")
    );
    expect(vpc).toBeDefined();
    expect(vpc!.type).toBe("binary_exclusion");
  });
});
