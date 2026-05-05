import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// Mock SDK modules before any imports that use them. vi.mock() is hoisted,
// so these execute before the base.ts module loads and replaces the real
// Anthropic and OpenAI constructors with controllable fakes.
vi.mock("@anthropic-ai/sdk", () => ({ default: vi.fn() }));
vi.mock("openai", () => ({ default: vi.fn() }));

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { callAgent } from "../callers/base.js";

// ── fake Anthropic MessageStream ──────────────────────────────────────────────
//
// Minimal event emitter that satisfies the two methods callAnthropicAgent uses:
//   stream.on("inputJson", handler) — registers a listener
//   stream.finalMessage()           — fires queued events then resolves
//
// Events fire synchronously inside finalMessage() so that toolInputChunks is
// fully populated before the assembled string is checked.

class FakeAnthropicStream {
  private listeners = new Map<string, Array<(chunk: string) => void>>();

  constructor(
    private readonly chunks: string[] = [],
    private readonly error: Error | null = null,
    private readonly usage = { input_tokens: 100, output_tokens: 50 }
  ) {}

  on(event: string, listener: (chunk: string) => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(listener);
    return this;
  }

  async finalMessage() {
    if (this.error) throw this.error;
    for (const chunk of this.chunks) {
      for (const handler of this.listeners.get("inputJson") ?? []) {
        handler(chunk);
      }
    }
    return {
      usage: this.usage,
      content: [],
      id: "msg_fake",
      model: "claude-sonnet-4-6",
      role: "assistant",
      stop_reason: "tool_use",
      type: "message",
    };
  }
}

// ── fake OpenAI async iterable ────────────────────────────────────────────────
//
// Each item in the array becomes one streamed chunk. Pass `arguments` to emit
// a tool call delta; pass `usage` to emit a usage chunk (matches the trailing
// usage chunk OpenAI sends when stream_options: { include_usage: true }).

interface FakeOpenAIChunkOpts {
  arguments?: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

async function* makeOpenAIStream(items: FakeOpenAIChunkOpts[]) {
  for (const item of items) {
    yield {
      choices:
        item.arguments !== undefined
          ? [{ delta: { tool_calls: [{ function: { arguments: item.arguments } }] } }]
          : [{ delta: {} }],
      usage: item.usage ?? null,
    };
  }
}

// ── shared fixtures ───────────────────────────────────────────────────────────

const TestSchema = z.object({ result: z.string() });
type TestOutput = z.infer<typeof TestSchema>;

const VALID_OUTPUT: TestOutput = { result: "ok" };
const VALID_JSON = JSON.stringify(VALID_OUTPUT);

const ANTHROPIC_OPTS = {
  agentName: "test-agent",
  systemPrompt: "You are a test agent.",
  manifest: {},
  verifiedContext: {},
  zodSchema: TestSchema,
  providerConfig: { provider: "anthropic", model: "claude-sonnet-4-6" },
};

const OPENAI_OPTS = {
  agentName: "test-agent",
  systemPrompt: "You are a test agent.",
  manifest: {},
  verifiedContext: {},
  zodSchema: TestSchema,
  providerConfig: { provider: "kimi", model: "moonshot-v1-8k" },
};

// ── Anthropic streaming tests ─────────────────────────────────────────────────

describe("callAnthropicAgent — streaming integration", () => {
  const MockAnthropic = vi.mocked(Anthropic);
  let mockMessagesStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockMessagesStream = vi.fn();
    MockAnthropic.mockImplementation(
      () => ({ messages: { stream: mockMessagesStream } }) as unknown as Anthropic
    );
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    vi.clearAllMocks();
  });

  it("accumulates inputJson chunks across multiple events and returns Zod-parsed output", async () => {
    // Split the JSON across 3 chunks to verify accumulation
    const mid = Math.floor(VALID_JSON.length / 2);
    const chunks = [VALID_JSON.slice(0, 3), VALID_JSON.slice(3, mid), VALID_JSON.slice(mid)];
    mockMessagesStream.mockReturnValue(new FakeAnthropicStream(chunks));

    const result = await callAgent(ANTHROPIC_OPTS);
    expect(result).toEqual(VALID_OUTPUT);
  });

  it("extracts input and output token counts from finalMessage usage", async () => {
    const usage = { input_tokens: 1234, output_tokens: 567 };
    mockMessagesStream.mockReturnValue(new FakeAnthropicStream([VALID_JSON], null, usage));

    // No throw means usage was destructured without error.
    // logAgentCall is a no-op in tests (AGENT_CALL_LOG not set).
    await expect(callAgent(ANTHROPIC_OPTS)).resolves.toEqual(VALID_OUTPUT);
    expect(mockMessagesStream).toHaveBeenCalledOnce();
  });

  it("throws the correct error when no inputJson events are emitted", async () => {
    mockMessagesStream.mockReturnValue(new FakeAnthropicStream([]));

    await expect(callAgent(ANTHROPIC_OPTS)).rejects.toThrow(
      "test-agent: no tool_use block in stream — model did not call the tool"
    );
  });

  it("propagates errors thrown by finalMessage without swallowing them", async () => {
    const err = new Error("TCP connection reset by peer");
    mockMessagesStream.mockReturnValue(new FakeAnthropicStream([], err));

    await expect(callAgent(ANTHROPIC_OPTS)).rejects.toThrow("TCP connection reset by peer");
  });
});

// ── OpenAI-compatible streaming tests ────────────────────────────────────────

describe("callOpenAICompatibleAgent — streaming integration", () => {
  const MockOpenAI = vi.mocked(OpenAI);
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.KIMI_API_KEY = "test-key";
    mockCreate = vi.fn();
    MockOpenAI.mockImplementation(
      () => ({ chat: { completions: { create: mockCreate } } }) as unknown as OpenAI
    );
  });

  afterEach(() => {
    delete process.env.KIMI_API_KEY;
    vi.clearAllMocks();
  });

  it("accumulates tool call argument chunks and returns Zod-parsed output", async () => {
    const mid = Math.floor(VALID_JSON.length / 2);
    mockCreate.mockResolvedValue(
      makeOpenAIStream([
        { arguments: VALID_JSON.slice(0, mid) },
        { arguments: VALID_JSON.slice(mid) },
      ])
    );

    const result = await callAgent(OPENAI_OPTS);
    expect(result).toEqual(VALID_OUTPUT);
  });

  it("captures usage from a trailing usage-only chunk", async () => {
    // OpenAI sends usage in a final chunk with no choices content when
    // stream_options: { include_usage: true } is set.
    mockCreate.mockResolvedValue(
      makeOpenAIStream([
        { arguments: VALID_JSON },
        { usage: { prompt_tokens: 200, completion_tokens: 80 } },
      ])
    );

    await expect(callAgent(OPENAI_OPTS)).resolves.toEqual(VALID_OUTPUT);
  });

  it("handles usage and tool call arguments in the same chunk", async () => {
    // Some providers colocate usage with the last content chunk.
    mockCreate.mockResolvedValue(
      makeOpenAIStream([
        { arguments: VALID_JSON, usage: { prompt_tokens: 100, completion_tokens: 40 } },
      ])
    );

    await expect(callAgent(OPENAI_OPTS)).resolves.toEqual(VALID_OUTPUT);
  });

  it("throws the correct error when no tool call chunks appear in the stream", async () => {
    // Stream yields only a usage chunk — no tool_calls delta.
    mockCreate.mockResolvedValue(
      makeOpenAIStream([{ usage: { prompt_tokens: 50, completion_tokens: 0 } }])
    );

    await expect(callAgent(OPENAI_OPTS)).rejects.toThrow(
      "test-agent: no tool call in stream — model did not call the function"
    );
  });
});
