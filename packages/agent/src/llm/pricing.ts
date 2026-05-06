/**
 * Per-1M-token USD pricing per PRODUCTION_BUILD_GUIDE.md §4.
 *
 * Keys here are the *concrete model IDs* that providers return (or that we
 * resolve via MODEL_MAP). Add new entries as we use new models. Unknown
 * models return null cost — the call is logged with cost_usd = null.
 *
 * Copilot: zero — flat-fee subscription.
 * Anthropic Claude 4.x: production rates.
 */
export const PRICING: Record<string, { in: number; out: number }> = {
  // OpenAI / OpenRouter
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "openai/gpt-4o": { in: 2.5, out: 10.0 },
  "anthropic/claude-3.5-sonnet": { in: 3.0, out: 15.0 },
  "openrouter/auto": { in: 1.0, out: 3.0 }, // rough average; OpenRouter routes vary

  // Google Gemini (per published pricing)
  "gemini-2.5-flash-lite": { in: 0.05, out: 0.2 },
  "gemini-2.5-flash": { in: 0.075, out: 0.3 },
  "gemini-2.5-pro": { in: 1.25, out: 5.0 },
  "gemini-2.0-flash": { in: 0.075, out: 0.3 },

  // Groq Llama (per groq.com/pricing)
  "llama-3.1-8b-instant": { in: 0.05, out: 0.08 },
  "llama-3.3-70b-versatile": { in: 0.59, out: 0.79 },

  // Anthropic direct (Claude 4.x)
  "claude-haiku-4-5-20251001": { in: 1.0, out: 5.0 },
  "claude-sonnet-4-6": { in: 3.0, out: 15.0 },
  "claude-opus-4-7": { in: 15.0, out: 75.0 },

  // Copilot — zero (Pro flat-fee)
  "gpt-4o-mini": { in: 0, out: 0 },
  "gpt-4o": { in: 0, out: 0 },
  "claude-3.5-sonnet": { in: 0, out: 0 },
};

/**
 * Compute USD cost for a single LLM call. Returns null when the model is
 * not in the pricing table — that's a soft signal to add it.
 */
export function computeCostUsd(
  model: string,
  inputTokens: number | undefined,
  outputTokens: number | undefined
): number | null {
  const price = PRICING[model];
  if (!price) return null;
  if (inputTokens === undefined && outputTokens === undefined) return null;
  const inT = inputTokens ?? 0;
  const outT = outputTokens ?? 0;
  return (price.in * inT + price.out * outT) / 1_000_000;
}
