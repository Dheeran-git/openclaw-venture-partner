import {
  LLMError,
  MODEL_MAP,
  type ProviderAdapter,
  type ProviderRequest,
  type LLMRawResponse,
} from "../types.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const openrouterProvider: ProviderAdapter = {
  name: "openrouter",

  isConfigured() {
    return !!process.env.OPENROUTER_API_KEY;
  },

  async complete(req: ProviderRequest): Promise<LLMRawResponse> {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) throw new LLMError("OPENROUTER_API_KEY missing", "openrouter");

    const model = MODEL_MAP.openrouter[req.tier];
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
        "HTTP-Referer": "https://openclaw.local",
        "X-Title": "OpenClaw Venture Partner",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new LLMError(
        `openrouter ${res.status}: ${text.slice(0, 400)}`,
        "openrouter"
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) throw new LLMError("openrouter empty response", "openrouter");

    return {
      text,
      model: data.model ?? model,
      input_tokens: data.usage?.prompt_tokens,
      output_tokens: data.usage?.completion_tokens,
    };
  },
};
