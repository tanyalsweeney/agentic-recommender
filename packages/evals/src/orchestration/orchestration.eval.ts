import { describe, it, expect } from "vitest";
import { callOrchestrationAgent } from "@agent12/agents";
import { DEFAULT_PROVIDER_CONFIGS, SEED_MANIFEST } from "../helpers.js";

const parallelResearchContext = {
  description:
    "Multi-source research agent. Given a topic, it simultaneously queries 3 different " +
    "sources (web search, academic papers, company docs) using separate sub-agents, " +
    "then a synthesis agent combines the results into a structured report. " +
    "Sub-agents are independent — they don't depend on each other's output.",
  orchestrationPattern: { state: "low_confidence" },
  scale: { selected: "medium_volume" },
};

describe("Orchestration eval 4: parallel research → DAG pattern", () => {
  it("recommends DAG pattern for parallel independent sub-agents", async () => {
    const output = await callOrchestrationAgent(SEED_MANIFEST, parallelResearchContext, DEFAULT_PROVIDER_CONFIGS.orchestration);
    expect(output.recommendedPattern).toBe("dag");
  });

  it("does not recommend pipeline for a system with parallel execution", async () => {
    const output = await callOrchestrationAgent(SEED_MANIFEST, parallelResearchContext, DEFAULT_PROVIDER_CONFIGS.orchestration);
    expect(output.recommendedPattern).not.toBe("pipeline");
  });

  it("acknowledges parallelism in the agent structure description", async () => {
    const output = await callOrchestrationAgent(SEED_MANIFEST, parallelResearchContext, DEFAULT_PROVIDER_CONFIGS.orchestration);
    const structureText = JSON.stringify(output.agentStructure).toLowerCase();
    expect(structureText).toMatch(/parallel|concurrent|simultaneous/);
  });
});
