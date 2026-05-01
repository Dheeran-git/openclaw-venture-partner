import Anthropic from "@anthropic-ai/sdk";
import {
  LLMError,
  MODEL_MAP,
  type ProviderAdapter,
  type ProviderRequest,
  type LLMRawResponse,
} from "../types";

export const anthropicProvider: ProviderAdapter = {
  name: "anthropic",

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  },

  async complete(req: ProviderRequest): Promise<LLMRawResponse> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new LLMError("ANTHROPIC_API_KEY missing", "anthropic");

    const modelId = MODEL_MAP.anthropic[req.tier];
    const client = new Anthropic({ apiKey: key });

    try {
      const message = await client.messages.create({
        model: modelId,
        max_tokens: req.max_tokens ?? 4096,
        temperature: req.temperature ?? 0.2,
        messages: [
          {
            role: "user",
            content: req.json
              ? `${req.prompt}\n\nRespond with valid JSON only -- no markdown fences, no commentary.`
              : req.prompt,
          },
        ],
      });

      const block = message.content.find((b) => b.type === "text");
      const text = block && block.type === "text" ? block.text : "";
      if (!text) throw new LLMError("anthropic empty response", "anthropic");

      return {
        text,
        model: message.model,
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      };
    } catch (err) {
      throw new LLMError(
        `anthropic error: ${(err as Error).message}`,
        "anthropic",
        err
      );
    }
  },
};
