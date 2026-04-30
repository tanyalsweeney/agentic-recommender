import type { FlowChildJob } from "bullmq";

// BullMQ FlowProducer spec for a single pipeline run.
// Children complete before their parent runs — this enforces wave ordering:
//   Wave 1 (x4, parallel) → Wave 2 (cooperative) → Wave 2.5 (CV) → Wave 3 (Skeptic) → Pass 1 (TW)
//
// Pass this spec to FlowProducer.add() to submit a run to the queue.
export function buildPipelineFlowSpec(runId: string): FlowChildJob & { queueName: string } {
  const job = (name: string, children?: FlowChildJob[]): FlowChildJob => ({
    name,
    queueName: "pipeline",
    data: { runId },
    ...(children ? { children } : {}),
  });

  const wave1 = [
    job("wave1.orchestration"),
    job("wave1.security"),
    job("wave1.memory_state"),
    job("wave1.tool_integration"),
  ];

  return {
    name: "pass1.technical_writer",
    queueName: "pipeline",
    data: { runId },
    children: [
      job("wave3.skeptic", [
        job("wave2_5.compatibility_validator", [
          job("wave2.cooperative", wave1),
        ]),
      ]),
    ],
  };
}
