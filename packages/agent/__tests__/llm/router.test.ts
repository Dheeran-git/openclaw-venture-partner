import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { pickProvider, pickStreamingProvider } from "../../src/llm/router";
import { LLMError, PROVIDER_NAMES } from "../../src/llm/types";

const ENV_KEYS = [
  "COPILOT_TOKEN",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "OPENROUTER_API_KEY",
  "ANTHROPIC_API_KEY",
] as const;

describe("LLM router — provider selection", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    // Avoid telemetry writes during tests.
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("throws when no provider is configured", async () => {
    await expect(pickProvider()).rejects.toBeInstanceOf(LLMError);
    await expect(pickProvider()).rejects.toThrow(/no healthy LLM provider/);
  });

  it("returns Gemini first when only Gemini is set (top of new priority chain)", async () => {
    process.env.GEMINI_API_KEY = "x";
    const p = await pickProvider();
    expect(p.name).toBe("gemini");
  });

  // Groq has a remote healthCheck() so a unit test would always fail it.
  // Coverage of "second-in-order falls through" is captured by the
  // OpenRouter-only test below, which has no healthCheck.

  it("falls through to OpenRouter when Gemini/Groq absent", async () => {
    process.env.OPENROUTER_API_KEY = "x";
    const p = await pickProvider();
    expect(p.name).toBe("openrouter");
  });

  it("ignores Copilot env even when set — Copilot is dropped from the active order", async () => {
    process.env.COPILOT_TOKEN = "x";
    await expect(pickProvider()).rejects.toThrow(/no healthy LLM provider/);
  });

  it("ignores Anthropic env even when set — Anthropic is dropped from the active order", async () => {
    process.env.ANTHROPIC_API_KEY = "x";
    await expect(pickProvider()).rejects.toThrow(/no healthy LLM provider/);
  });

  it("respects PROVIDER_ORDER (Gemini beats OpenRouter when both are set)", async () => {
    process.env.GEMINI_API_KEY = "x";
    process.env.OPENROUTER_API_KEY = "x";
    const p = await pickProvider();
    expect(p.name).toBe("gemini");
  });

  it("preferred=openrouter returns openrouter when configured", async () => {
    process.env.GEMINI_API_KEY = "x";
    process.env.OPENROUTER_API_KEY = "x"; // gemini would normally win
    const p = await pickProvider("openrouter");
    expect(p.name).toBe("openrouter");
  });

  it("preferred=openrouter throws when openrouter is unconfigured", async () => {
    process.env.GEMINI_API_KEY = "x";
    await expect(pickProvider("openrouter")).rejects.toThrow(/not healthy or not configured/);
  });

  it("preferred=unknown throws", async () => {
    process.env.GEMINI_API_KEY = "x";
    await expect(pickProvider("nonexistent" as never)).rejects.toThrow(/unknown provider/);
  });

  it("PROVIDER_NAMES still enumerates the historical 5 strings (type compatibility)", () => {
    expect(PROVIDER_NAMES).toEqual(["copilot", "gemini", "groq", "openrouter", "anthropic"]);
  });
});

describe("LLM router — streaming-capable selection", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("throws when no streaming provider is configured", async () => {
    await expect(pickStreamingProvider()).rejects.toThrow(/streaming-capable/);
  });

  it("skips Gemini (no .stream) and falls through to a streaming provider", async () => {
    // Only Gemini set — Gemini does not implement stream(), so this should
    // throw rather than return a non-streaming provider.
    process.env.GEMINI_API_KEY = "x";
    await expect(pickStreamingProvider()).rejects.toThrow(/streaming-capable/);
  });

  it("returns a streaming provider (OpenRouter is the simplest no-healthCheck path)", async () => {
    // OpenRouter has no healthCheck() so isHealthy short-circuits on
    // isConfigured() alone — no network probe needed in tests.
    process.env.OPENROUTER_API_KEY = "x";
    const p = await pickStreamingProvider();
    expect(p.name).toBe("openrouter");
    expect(p.stream).toBeDefined();
  });

  it("preferred=copilot for streaming throws since Copilot is no longer in the active order", async () => {
    process.env.COPILOT_TOKEN = "x";
    await expect(pickStreamingProvider("copilot")).rejects.toThrow(/unknown provider|streaming-capable/);
  });
});
