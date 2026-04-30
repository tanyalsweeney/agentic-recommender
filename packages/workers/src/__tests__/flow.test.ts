import { describe, it, expect } from "vitest";
import { buildPipelineFlowSpec } from "../flows/pipeline.js";

// These tests verify the job hierarchy we build for BullMQ FlowProducer.
// They do not hit Redis — they verify the specification we produce.
// BullMQ's enforcement of child-before-parent ordering is its own concern.
//
// Wave ordering (children complete before parent runs):
//   Wave 1 (x4, parallel) → Wave 2 (cooperative) → Wave 2.5 (CV) → Wave 3 (Skeptic) → Pass 1 (TW)

const RUN_ID = "run-test-abc123";

describe("buildPipelineFlowSpec", () => {
  it("root job is the Technical Writer", () => {
    const spec = buildPipelineFlowSpec(RUN_ID);
    expect(spec.name).toBe("pass1.technical_writer");
  });

  it("Technical Writer has exactly one child: the Skeptic", () => {
    const spec = buildPipelineFlowSpec(RUN_ID);
    expect(spec.children).toHaveLength(1);
    expect(spec.children![0].name).toBe("wave3.skeptic");
  });

  it("Skeptic has exactly one child: the Compatibility Validator", () => {
    const spec = buildPipelineFlowSpec(RUN_ID);
    const skeptic = spec.children![0];
    expect(skeptic.children).toHaveLength(1);
    expect(skeptic.children![0].name).toBe("wave2_5.compatibility_validator");
  });

  it("CV has exactly one child: the Wave 2 cooperative job", () => {
    const spec = buildPipelineFlowSpec(RUN_ID);
    const cv = spec.children![0].children![0];
    expect(cv.children).toHaveLength(1);
    expect(cv.children![0].name).toBe("wave2.cooperative");
  });

  it("Wave 2 has exactly 4 Wave 1 children running in parallel", () => {
    const spec = buildPipelineFlowSpec(RUN_ID);
    const wave2 = spec.children![0].children![0].children![0];
    const childNames = wave2.children!.map((c) => c.name).sort();
    expect(childNames).toEqual([
      "wave1.memory_state",
      "wave1.orchestration",
      "wave1.security",
      "wave1.tool_integration",
    ]);
  });

  it("all jobs carry the run ID in their data", () => {
    const spec = buildPipelineFlowSpec(RUN_ID);

    function collectData(node: typeof spec): string[] {
      const ids: string[] = [];
      if (node.data?.runId) ids.push(node.data.runId as string);
      for (const child of node.children ?? []) {
        ids.push(...collectData(child));
      }
      return ids;
    }

    const runIds = collectData(spec);
    expect(runIds.length).toBeGreaterThan(0);
    expect(runIds.every((id) => id === RUN_ID)).toBe(true);
  });

  it("all jobs target the same queue", () => {
    const spec = buildPipelineFlowSpec(RUN_ID);

    function collectQueues(node: typeof spec): string[] {
      const queues = [node.queueName];
      for (const child of node.children ?? []) {
        queues.push(...collectQueues(child));
      }
      return queues;
    }

    const queues = collectQueues(spec);
    expect(queues.every((q) => q === "pipeline")).toBe(true);
  });
});
