import type { LLMPurpose, ProviderName } from "./types";

/**
 * Logs every LLM invocation to the `llm_calls` table.
 *
 * Failures here are logged to the console but never thrown -- telemetry
 * must not break the call. If Supabase env vars are missing (e.g. during
 * local smoke tests with no DB), the function is a no-op.
 */
export interface LogCallInput {
  user_id: string;
  purpose: LLMPurpose;
  prompt_version: string;
  provider: ProviderName;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
  duration_ms: number;
  request: { prompt: string; tier: string; json: boolean };
  response: { text: string } | { error: string };
}

export async function logLLMCall(input: LogCallInput): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    if (process.env.OPENCLAW_LLM_DEBUG === "1") {
      console.log(
        `[llm] ${input.provider}/${input.model} ${input.duration_ms}ms (telemetry skipped -- Supabase not configured)`
      );
    }
    return;
  }

  try {
    const { createServerClient } = await import("@openclaw/db/client");
    const db = createServerClient();
    const { error } = await db.from("llm_calls").insert({
      user_id: input.user_id,
      purpose: input.purpose,
      prompt_version: input.prompt_version,
      model: input.model,
      provider: input.provider,
      input_tokens: input.input_tokens ?? null,
      output_tokens: input.output_tokens ?? null,
      cost_usd: input.cost_usd ?? null,
      duration_ms: input.duration_ms,
      request: input.request,
      response: input.response,
    });
    if (error) {
      console.warn("[llm] telemetry insert failed:", error.message);
    }
  } catch (err) {
    console.warn("[llm] telemetry threw:", (err as Error).message);
  }
}
