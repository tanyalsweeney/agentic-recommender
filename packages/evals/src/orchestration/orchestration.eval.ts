/**
 * Orchestration agent eval — 1 case.
 * Unskip and wire callOrchestrationAgent() in Phase 2c.
 */
import { describe, it, expect } from "vitest";
import { OrchestrationAgentOutput } from "@agent12/agents";

async function callOrchestrationAgent(_verifiedContext: object): Promise<OrchestrationAgentOutput> {
  throw new Error("callOrchestrationAgent not implemented — Phase 2c");
}

// A system with parallel research sub-agents converging to synthesis should get DAG,
// not pipeline (sequential only) or supervisor (single controller).

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
  it.skip("recommends DAG pattern for parallel independent sub-agents", async () => {
    const output = await callOrchestrationAgent(parallelResearchContext);
    expect(output.recommendedPattern).toBe("dag");
  });

  it.skip("does not recommend pipeline for a system with parallel execution", async () => {
    const output = await callOrchestrationAgent(parallelResearchContext);
    expect(output.recommendedPattern).not.toBe("pipeline");
  });

  it.skip("acknowledges parallelism in the agent structure description", async () => {
    const output = await callOrchestrationAgent(parallelResearchContext);
    const structureText = JSON.stringify(output.agentStructure).toLowerCase();
    expect(structureText).toMatch(/parallel|concurrent|simultaneous/);
  });
});
