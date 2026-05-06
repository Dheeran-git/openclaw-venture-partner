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
  idempotency_key?: string;
  cached_response_json?: { text: string };
}

export interface CachedCall {
  text: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
}

/**
 * Look up a prior successful call by (user_id, idempotency_key). Returns
 * undefined if not found or if the prior call errored. Used to make Inngest
 * step retries free.
 */
export async function findCachedCall(
  user_id: string,
  idempotency_key: string
): Promise<CachedCall | undefined> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return undefined;
  try {
    const { createServiceRoleClient } = await import("@openclaw/db/client");
    const db = createServiceRoleClient();
    // Columns idempotency_key + cached_response_json are added in migration
    // 0016; the generated types may not yet include them, so we cast the
    // whole chain through `unknown` to bypass the type-system gap.
    const dbAny = db as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (k: string, v: unknown) => {
            eq: (k: string, v: unknown) => {
              order: (
                k: string,
                opts: { ascending: boolean }
              ) => {
                limit: (n: number) => {
                  maybeSingle: () => Promise<{
                    data: unknown;
                    error: { message: string } | null;
                  }>;
                };
              };
            };
          };
        };
      };
    };
    const { data, error } = await dbAny
      .from("llm_calls")
      .select(
        "model, input_tokens, output_tokens, cost_usd, cached_response_json, response"
      )
      .eq("user_id", user_id)
      .eq("idempotency_key", idempotency_key)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return undefined;
    const row = data as {
      model: string;
      input_tokens: number | null;
      output_tokens: number | null;
      cost_usd: number | string | null;
      cached_response_json: { text?: string } | null;
      response: { text?: string; error?: string } | null;
    };
    const text = row.cached_response_json?.text ?? row.response?.text;
    if (!text) return undefined;
    return {
      text,
      model: row.model,
      input_tokens: row.input_tokens ?? undefined,
      output_tokens: row.output_tokens ?? undefined,
      cost_usd:
        row.cost_usd === null || row.cost_usd === undefined
          ? undefined
          : Number(row.cost_usd),
    };
  } catch {
    return undefined;
  }
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
    const { createServiceRoleClient } = await import("@openclaw/db/client");
    const db = createServiceRoleClient();
    // Cast through unknown to allow idempotency_key + cached_response_json
    // before the regenerated DB types include them (migration 0016).
    const dbAny = db as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<{
          error: { message: string } | null;
        }>;
      };
    };
    const { error } = await dbAny.from("llm_calls").insert({
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
      idempotency_key: input.idempotency_key ?? null,
      cached_response_json: input.cached_response_json ?? null,
    });
    if (error) {
      console.warn("[llm] telemetry insert failed:", error.message);
    }
  } catch (err) {
    console.warn("[llm] telemetry threw:", (err as Error).message);
  }
}
