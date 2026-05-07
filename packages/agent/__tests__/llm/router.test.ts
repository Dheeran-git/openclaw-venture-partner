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

  it("returns Copilot first when only Copilot is set (top of priority chain)", async () => {
    process.env.COPILOT_TOKEN = "x";
    const p = await pickProvider();
    expect(p.name).toBe("copilot");
  });

  it("returns Gemini when only Gemini is set", async () => {
    process.env.GEMINI_API_KEY = "x";
    const p = await pickProvider();
    expect(p.name).toBe("gemini");
  });

  it("falls through to OpenRouter when Copilot/Gemini/Groq absent", async () => {
    process.env.OPENROUTER_API_KEY = "x";
    const p = await pickProvider();
    expect(p.name).toBe("openrouter");
  });

  it("Anthropic is dormant — returns it only when explicitly the only configured provider", async () => {
    process.env.ANTHROPIC_API_KEY = "x";
    const p = await pickProvider();
    expect(p.name).toBe("anthropic");
  });

  it("respects PROVIDER_ORDER (Copilot beats every other when all are set)", async () => {
    for (const k of ENV_KEYS) process.env[k] = "x";
    const p = await pickProvider();
    expect(p.name).toBe("copilot");
  });

  it("preferred=gemini returns gemini when configured", async () => {
    process.env.GEMINI_API_KEY = "x";
    process.env.COPILOT_TOKEN = "x"; // would normally win
    const p = await pickProvider("gemini");
    expect(p.name).toBe("gemini");
  });

  it("preferred=gemini throws when gemini is unconfigured", async () => {
    process.env.COPILOT_TOKEN = "x";
    await expect(pickProvider("gemini")).rejects.toThrow(/not healthy or not configured/);
  });

  it("preferred=unknown throws", async () => {
    process.env.COPILOT_TOKEN = "x";
    await expect(pickProvider("nonexistent" as never)).rejects.toThrow(/unknown provider/);
  });

  it("PROVIDER_NAMES enumerates exactly the 5 known providers", () => {
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

  it("skips Copilot/Gemini (no .stream) and returns the first streaming provider", async () => {
    // Only Copilot set — Copilot does not implement stream(), so this should
    // throw rather than return a non-streaming provider.
    process.env.COPILOT_TOKEN = "x";
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

  it("preferred=copilot for streaming throws because Copilot has no stream()", async () => {
    process.env.COPILOT_TOKEN = "x";
    await expect(pickStreamingProvider("copilot")).rejects.toThrow(/does not support streaming/);
  });
});
