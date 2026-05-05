import { describe, it, expect } from "vitest";
import { assembleChunks, parseAssembledInput } from "../callers/base.js";

// ── assembleChunks ────────────────────────────────────────────────────────────

describe("assembleChunks", () => {
  it("joins partial chunks into the full JSON string", () => {
    const chunks = ['{"recommendedPattern":', ' "dag",', ' "rationale": "parallel tasks"}'];
    expect(assembleChunks(chunks)).toBe('{"recommendedPattern": "dag", "rationale": "parallel tasks"}');
  });

  it("handles a single chunk", () => {
    expect(assembleChunks(['{"key":"value"}'])).toBe('{"key":"value"}');
  });

  it("returns empty string for empty chunk list", () => {
    expect(assembleChunks([])).toBe("");
  });

  it("handles chunks with nested objects", () => {
    const obj = { a: { b: [1, 2, 3] }, c: null };
    const json = JSON.stringify(obj);
    // split at an arbitrary mid-point to simulate streaming
    const mid = Math.floor(json.length / 2);
    const chunks = [json.slice(0, mid), json.slice(mid)];
    expect(assembleChunks(chunks)).toBe(json);
  });
});

// ── parseAssembledInput ───────────────────────────────────────────────────────

describe("parseAssembledInput", () => {
  it("parses valid assembled JSON into an object", () => {
    expect(parseAssembledInput('{"key":"value"}', "test-agent")).toEqual({ key: "value" });
  });

  it("parses arrays", () => {
    expect(parseAssembledInput('[1,2,3]', "test-agent")).toEqual([1, 2, 3]);
  });

  it("throws with the agent name on invalid JSON", () => {
    expect(() => parseAssembledInput('{"partial":', "my-agent")).toThrow("my-agent");
  });

  it("throws on empty string input", () => {
    expect(() => parseAssembledInput("", "intake")).toThrow("intake");
  });

  it("produces the same output as a direct JSON.parse on the same string", () => {
    const obj = { concerns: [{ id: "c1", resolved: true }], cyclesUsed: 2 };
    const json = JSON.stringify(obj);
    expect(parseAssembledInput(json, "skeptic")).toEqual(JSON.parse(json));
  });
});

// ── output parity across split boundaries ─────────────────────────────────────

describe("assembleChunks + parseAssembledInput output parity", () => {
  it("produces the same result as parsing the unsplit JSON string", () => {
    const expected = {
      recommendedPattern: "dag",
      rationale: "Parallel sub-tasks with explicit dependencies",
      tradeoffs: { advantages: ["parallelism"], limitations: ["complex to debug"] },
      costSignals: { computeIntensity: "medium" },
    };
    const json = JSON.stringify(expected);

    // Simulate the model emitting the JSON in three arbitrary chunks
    const c1 = json.slice(0, 20);
    const c2 = json.slice(20, 60);
    const c3 = json.slice(60);
    const assembled = assembleChunks([c1, c2, c3]);

    expect(parseAssembledInput(assembled, "orchestration")).toEqual(expected);
  });

  it("handles single-byte chunks (worst-case fragmentation)", () => {
    const obj = { x: 1 };
    const json = JSON.stringify(obj);
    const singleByteChunks = json.split("");
    expect(parseAssembledInput(assembleChunks(singleByteChunks), "test-agent")).toEqual(obj);
  });
});

// ── mid-stream error propagation ──────────────────────────────────────────────

describe("mid-stream error propagation", () => {
  it("surfaces an error thrown during async iteration", async () => {
    async function* failingStream(): AsyncGenerator<string> {
      yield '{"partial"';
      throw new Error("TCP connection reset");
    }

    const chunks: string[] = [];
    await expect(async () => {
      for await (const chunk of failingStream()) {
        chunks.push(chunk);
      }
    }).rejects.toThrow("TCP connection reset");

    // Chunks accumulated before the error are preserved
    expect(chunks).toEqual(['{"partial"']);
  });

  it("does not swallow errors — a partially assembled JSON string is not parseable", () => {
    // Simulates what would be in the buffer if a connection dropped mid-stream
    const partialChunks = ['{"recommendedPattern": "dag", "rationale": "Par'];
    const partial = assembleChunks(partialChunks);
    expect(() => parseAssembledInput(partial, "orchestration")).toThrow("orchestration");
  });

  it("surfaces an error thrown after multiple successful chunks", async () => {
    async function* lateFailStream(): AsyncGenerator<string> {
      yield '{"a":1}'; // valid-looking chunk 1
      yield '{"b":2}'; // valid-looking chunk 2
      throw new Error("Server closed connection");
    }

    await expect(async () => {
      for await (const _chunk of lateFailStream()) {
        // consuming chunks
      }
    }).rejects.toThrow("Server closed connection");
  });
});
