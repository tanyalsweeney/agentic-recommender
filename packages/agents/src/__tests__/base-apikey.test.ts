import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// Mock the SDK constructors so we can assert on the apiKey they receive.
// Each mock throws immediately after capture so we don't try to hit the network.
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => {
    throw new Error("ANTHROPIC_CTOR_STOP");
  }),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => {
    throw new Error("OPENAI_CTOR_STOP");
  }),
}));

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { callAgent } from "../callers/base.js";

const ZSchema = z.object({ ok: z.boolean() });

describe("callAgent threads apiKey to the SDK constructor", () => {
  let savedAnthropicEnv: string | undefined;
  let savedKimiEnv: string | undefined;

  beforeEach(() => {
    vi.mocked(Anthropic).mockClear();
    vi.mocked(OpenAI).mockClear();
    savedAnthropicEnv = process.env.ANTHROPIC_API_KEY;
    savedKimiEnv = process.env.KIMI_API_KEY;
    // Set obviously-wrong env values so we can detect if the env is being read
    // instead of the explicit apiKey argument.
    process.env.ANTHROPIC_API_KEY = "env-anthropic-DO-NOT-USE";
    process.env.KIMI_API_KEY = "env-kimi-DO-NOT-USE";
  });

  afterEach(() => {
    if (savedAnthropicEnv === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = savedAnthropicEnv;
    if (savedKimiEnv === undefined) delete process.env.KIMI_API_KEY;
    else process.env.KIMI_API_KEY = savedKimiEnv;
  });

  it("anthropic path: SDK gets the explicit apiKey, not process.env", async () => {
    await expect(
      callAgent({
        agentName: "test",
        systemPrompt: "test",
        manifest: {},
        verifiedContext: {},
        providerConfig: { provider: "anthropic", model: "claude-sonnet-4-6" },
        zodSchema: ZSchema,
        apiKey: "explicit-anthropic-key",
      }),
    ).rejects.toThrow("ANTHROPIC_CTOR_STOP");

    expect(Anthropic).toHaveBeenCalledTimes(1);
    expect(Anthropic).toHaveBeenCalledWith({ apiKey: "explicit-anthropic-key" });
  });

  it("openai-compatible path: SDK gets the explicit apiKey, not process.env", async () => {
    await expect(
      callAgent({
        agentName: "test",
        systemPrompt: "test",
        manifest: {},
        verifiedContext: {},
        providerConfig: { provider: "kimi", model: "moonshot-v1-8k" },
        zodSchema: ZSchema,
        apiKey: "explicit-kimi-key",
      }),
    ).rejects.toThrow("OPENAI_CTOR_STOP");

    expect(OpenAI).toHaveBeenCalledTimes(1);
    expect(OpenAI).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "explicit-kimi-key" }),
    );
  });
});
