import {
  LLMError,
  MODEL_MAP,
  type ProviderAdapter,
  type ProviderRequest,
  type LLMRawResponse,
  type StreamChunk,
} from "../types";
import { sseStream } from "../sseStream";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const HEALTH_PROBE_TIMEOUT_MS = 4_000;

export const groqProvider: ProviderAdapter = {
  name: "groq",

  isConfigured() {
    return !!process.env.GROQ_API_KEY;
  },

  async healthCheck() {
    const key = process.env.GROQ_API_KEY;
    if (!key) return false;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), HEALTH_PROBE_TIMEOUT_MS);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: ctrl.signal,
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  },

  async complete(req: ProviderRequest): Promise<LLMRawResponse> {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new LLMError("GROQ_API_KEY missing", "groq");

    const model = MODEL_MAP.groq[req.tier];
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: req.prompt }],
      temperature: req.temperature ?? 0.2,
    };
    if (req.max_tokens) body.max_tokens = req.max_tokens;
    if (req.json) body.response_format = { type: "json_object" };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new LLMError(
        `groq ${res.status}: ${text.slice(0, 400)}`,
        "groq"
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new LLMError("groq empty response", "groq");

    return {
      text,
      model: data.model ?? model,
      input_tokens: data.usage?.prompt_tokens,
      output_tokens: data.usage?.completion_tokens,
    };
  },

  async *stream(req: ProviderRequest): AsyncIterable<StreamChunk> {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new LLMError("GROQ_API_KEY missing", "groq");

    const model = MODEL_MAP.groq[req.tier];
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: req.prompt }],
      temperature: req.temperature ?? 0.2,
      stream: true,
    };
    if (req.max_tokens) body.max_tokens = req.max_tokens;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new LLMError(
        `groq stream ${res.status}: ${text.slice(0, 400)}`,
        "groq"
      );
    }

    yield* sseStream(res.body, "groq");
  },
};
