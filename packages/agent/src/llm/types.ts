import { z, type ZodType } from "zod";

export const LLM_PURPOSES = [
  "score_lead",
  "draft_pitch",
  "draft_reply",
  "extract_lead",
  "memory_update",
] as const;
export type LLMPurpose = (typeof LLM_PURPOSES)[number];

export type ModelTier = "fast" | "balanced" | "capable";

export const PROVIDER_NAMES = [
  "copilot",
  "gemini",
  "groq",
  "openrouter",
  "anthropic",
] as const;
export type ProviderName = (typeof PROVIDER_NAMES)[number];

/**
 * Per-provider mapping from abstract tier ("fast"/"balanced"/"capable") to a
 * concrete model id. Business code only ever passes the tier — providers
 * resolve it.
 */
export const MODEL_MAP: Record<ProviderName, Record<ModelTier, string>> = {
  copilot: {
    fast: "gpt-4o-mini",
    balanced: "gpt-4o",
    capable: "claude-3.5-sonnet",
  },
  openrouter: {
    fast: "openai/gpt-4o-mini",
    balanced: "openai/gpt-4o",
    capable: "anthropic/claude-3.5-sonnet",
  },
  gemini: {
    fast: "gemini-2.5-flash-lite",
    balanced: "gemini-2.5-flash",
    capable: "gemini-2.5-pro",
  },
  groq: {
    fast: "llama-3.1-8b-instant",
    balanced: "llama-3.3-70b-versatile",
    capable: "llama-3.3-70b-versatile",
  },
  anthropic: {
    fast: "claude-haiku-4-5-20251001",
    balanced: "claude-sonnet-4-6",
    capable: "claude-opus-4-7",
  },
};

export interface LLMRequest<T = string> {
  user_id: string;
  purpose: LLMPurpose;
  prompt: string;
  prompt_version: string;
  schema?: ZodType<T>;
  model?: ModelTier;
  /** Test-only override: force a specific provider. */
  provider?: ProviderName;
  temperature?: number;
  max_tokens?: number;
  /**
   * When set, the call is idempotency-checked: if a prior llm_calls row with
   * (user_id, idempotency_key) exists and has a successful response, return
   * the cached response instead of hitting the provider. Use to make Inngest
   * step retries free.
   */
  idempotencyKey?: string;
}

export interface LLMRawResponse {
  text: string;
  /** Concrete model id returned by the provider. */
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: number;
}

export interface ProviderRequest {
  prompt: string;
  tier: ModelTier;
  /** When true, the provider must return parseable JSON in `text`. */
  json: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface StreamChunk {
  chunk: string;
  done: boolean;
}

export interface ProviderAdapter {
  readonly name: ProviderName;
  /** Synchronous credential presence check. Cheap; called frequently. */
  isConfigured(): boolean;
  /** Optional remote ping. Cached for 60s by the router. */
  healthCheck?(): Promise<boolean>;
  complete(req: ProviderRequest): Promise<LLMRawResponse>;
  /** Optional streaming. Providers without SSE leave this undefined. */
  stream?(req: ProviderRequest): AsyncIterable<StreamChunk>;
}

export interface StreamOpts {
  user_id: string;
  purpose: LLMPurpose;
  prompt: string;
  prompt_version: string;
  model?: ModelTier;
  /** Test-only override: force a specific provider. */
  provider?: ProviderName;
  temperature?: number;
  max_tokens?: number;
  /** When set, a llm_calls row with this key short-circuits the call. */
  idempotencyKey?: string;
}

export interface LLMClient {
  complete<T = string>(opts: LLMRequest<T>): Promise<T>;
  stream(opts: StreamOpts): AsyncIterable<StreamChunk>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: ProviderName | "router",
    cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "LLMError";
  }
}

export class LLMValidationError extends LLMError {
  constructor(
    public readonly raw: string,
    public readonly zodError: z.ZodError,
    provider: ProviderName
  ) {
    super(`LLM response failed schema validation`, provider, zodError);
    this.name = "LLMValidationError";
  }
}
