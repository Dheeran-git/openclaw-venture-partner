import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  LLMError,
  MODEL_MAP,
  type ProviderAdapter,
  type ProviderRequest,
  type LLMRawResponse,
} from "../types.js";

export const geminiProvider: ProviderAdapter = {
  name: "gemini",

  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  },

  async complete(req: ProviderRequest): Promise<LLMRawResponse> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new LLMError("GEMINI_API_KEY missing", "gemini");

    const modelId = MODEL_MAP.gemini[req.tier];
    const client = new GoogleGenerativeAI(key);
    const model = client.getGenerativeModel({
      model: modelId,
      generationConfig: {
        temperature: req.temperature ?? 0.2,
        maxOutputTokens: req.max_tokens,
        responseMimeType: req.json ? "application/json" : "text/plain",
      },
    });

    try {
      const result = await model.generateContent(req.prompt);
      const text = result.response.text();
      if (!text) throw new LLMError("gemini empty response", "gemini");
      const usage = result.response.usageMetadata;
      return {
        text,
        model: modelId,
        input_tokens: usage?.promptTokenCount,
        output_tokens: usage?.candidatesTokenCount,
      };
    } catch (err) {
      throw new LLMError(
        `gemini error: ${(err as Error).message}`,
        "gemini",
        err
      );
    }
  },
};
