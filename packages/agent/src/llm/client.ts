import { ZodError, type ZodType } from "zod";
import { logLLMCall } from "./logger.js";
import { pickProvider } from "./router.js";
import {
  LLMValidationError,
  type LLMClient,
  type LLMRequest,
} from "./types.js";

/**
 * The single LLM entry point. Every business module imports this.
 * Resolves a provider, calls it, validates against the optional Zod
 * schema, retries once on validation failure, and logs every attempt
 * to `llm_calls`.
 */
async function complete<T = string>(opts: LLMRequest<T>): Promise<T> {
  const provider = await pickProvider(opts.provider);
  const tier = opts.model ?? "balanced";
  const useJson = !!opts.schema;

  const attempt = async (
    prompt: string,
    note: "first" | "retry"
  ): Promise<{ text: string; raw: Awaited<ReturnType<typeof provider.complete>> }> => {
    const startedAt = Date.now();
    try {
      const raw = await provider.complete({
        prompt,
        tier,
        json: useJson,
        temperature: opts.temperature,
        max_tokens: opts.max_tokens,
      });
      await logLLMCall({
        user_id: opts.user_id,
        purpose: opts.purpose,
        prompt_version: opts.prompt_version + (note === "retry" ? "+retry" : ""),
        provider: provider.name,
        model: raw.model,
        input_tokens: raw.input_tokens,
        output_tokens: raw.output_tokens,
        cost_usd: raw.cost_usd,
        duration_ms: Date.now() - startedAt,
        request: { prompt, tier, json: useJson },
        response: { text: raw.text },
      });
      return { text: raw.text, raw };
    } catch (err) {
      await logLLMCall({
        user_id: opts.user_id,
        purpose: opts.purpose,
        prompt_version: opts.prompt_version + (note === "retry" ? "+retry" : ""),
        provider: provider.name,
        model: "unknown",
        duration_ms: Date.now() - startedAt,
        request: { prompt, tier, json: useJson },
        response: { error: (err as Error).message },
      });
      throw err;
    }
  };

  const { text } = await attempt(opts.prompt, "first");

  if (!opts.schema) {
    return text as T;
  }

  const firstParse = tryParseAndValidate(text, opts.schema);
  if (firstParse.ok) return firstParse.value;

  // One retry with feedback
  const retryPrompt =
    `${opts.prompt}\n\n` +
    `Your previous response failed schema validation. Errors:\n` +
    `${firstParse.errorMessage}\n\n` +
    `Return JSON only, matching the requested schema exactly.`;
  const { text: retryText } = await attempt(retryPrompt, "retry");
  const secondParse = tryParseAndValidate(retryText, opts.schema);
  if (secondParse.ok) return secondParse.value;

  throw new LLMValidationError(
    secondParse.raw,
    secondParse.zodError,
    provider.name
  );
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; raw: string; zodError: ZodError; errorMessage: string };

function tryParseAndValidate<T>(
  text: string,
  schema: ZodType<T>
): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(stripJsonFence(text));
  } catch (err) {
    const message = `Response was not valid JSON: ${(err as Error).message}`;
    return {
      ok: false,
      raw: text,
      zodError: new ZodError([
        { code: "custom", path: [], message },
      ]),
      errorMessage: message,
    };
  }

  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };

  const issues = result.error.issues
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  return {
    ok: false,
    raw: text,
    zodError: result.error,
    errorMessage: issues,
  };
}

/** Trim ```json ... ``` fences models sometimes emit despite instructions. */
function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```$/, "")
      .trim();
  }
  return trimmed;
}

export const llm: LLMClient = { complete };
