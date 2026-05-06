import { copilotProvider } from "./providers/copilot";
import { geminiProvider } from "./providers/gemini";
import { groqProvider } from "./providers/groq";
import { openrouterProvider } from "./providers/openrouter";
import { anthropicProvider } from "./providers/anthropic";
import { LLMError, type ProviderAdapter, type ProviderName } from "./types";

/**
 * Provider order is locked per PRODUCTION_BUILD_GUIDE.md §4:
 *   Copilot -> Gemini -> Groq -> OpenRouter -> Anthropic (dormant)
 *
 * Configuration check (`isConfigured`) is synchronous and cheap. Remote
 * health-check results are cached for 60s — see HEALTH_TTL_MS.
 */
const PROVIDER_ORDER: ProviderAdapter[] = [
  copilotProvider,
  geminiProvider,
  groqProvider,
  openrouterProvider,
  anthropicProvider,
];

const HEALTH_TTL_MS = 60_000;
const healthCache = new Map<ProviderName, { ok: boolean; expiresAt: number }>();

async function recordProviderHealth(
  provider: ProviderName,
  ok: boolean,
  latency_ms: number,
  error?: Error
): Promise<void> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return;
  try {
    const { createServiceRoleClient } = await import("@openclaw/db/client");
    const db = createServiceRoleClient();
    // provider_health is added in migration 0016; the generated DB types
    // may not yet include it, so cast through unknown.
    const dbAny = db as unknown as {
      from: (t: string) => {
        insert: (row: Record<string, unknown>) => Promise<unknown>;
      };
    };
    await dbAny.from("provider_health").insert({
      provider,
      ok,
      latency_ms,
      error_kind: error ? error.name : null,
      error_message: error ? error.message.slice(0, 400) : null,
    });
  } catch {
    /* never throw from telemetry */
  }
}

async function isHealthy(provider: ProviderAdapter): Promise<boolean> {
  if (!provider.isConfigured()) return false;
  if (!provider.healthCheck) return true;

  const cached = healthCache.get(provider.name);
  if (cached && cached.expiresAt > Date.now()) return cached.ok;

  let ok = false;
  let err: Error | undefined;
  const startedAt = Date.now();
  try {
    ok = await provider.healthCheck();
  } catch (e) {
    ok = false;
    err = e as Error;
  }
  const latency = Date.now() - startedAt;
  healthCache.set(provider.name, {
    ok,
    expiresAt: Date.now() + HEALTH_TTL_MS,
  });
  // Fire-and-forget; don't block selection on telemetry write.
  void recordProviderHealth(provider.name, ok, latency, err);
  return ok;
}

export async function pickProvider(
  preferred?: ProviderName
): Promise<ProviderAdapter> {
  if (preferred) {
    const explicit = PROVIDER_ORDER.find((p) => p.name === preferred);
    if (!explicit) throw new LLMError(`unknown provider: ${preferred}`, "router");
    if (!(await isHealthy(explicit))) {
      throw new LLMError(
        `provider '${preferred}' is not healthy or not configured`,
        "router"
      );
    }
    return explicit;
  }

  for (const provider of PROVIDER_ORDER) {
    if (await isHealthy(provider)) return provider;
  }

  throw new LLMError(
    "no healthy LLM provider available -- set at least one of " +
      "COPILOT_TOKEN, GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY",
    "router"
  );
}

/**
 * Pick the first healthy provider that exposes a stream() method. Used by
 * LLMClient.stream() to bypass providers (Copilot, Gemini) that don't ship
 * server-side streaming in our setup.
 */
export async function pickStreamingProvider(
  preferred?: ProviderName
): Promise<ProviderAdapter> {
  if (preferred) {
    const explicit = PROVIDER_ORDER.find((p) => p.name === preferred);
    if (!explicit) throw new LLMError(`unknown provider: ${preferred}`, "router");
    if (!explicit.stream) {
      throw new LLMError(
        `provider '${preferred}' does not support streaming`,
        "router"
      );
    }
    if (!(await isHealthy(explicit))) {
      throw new LLMError(
        `provider '${preferred}' is not healthy or not configured`,
        "router"
      );
    }
    return explicit;
  }

  for (const provider of PROVIDER_ORDER) {
    if (provider.stream && (await isHealthy(provider))) return provider;
  }

  throw new LLMError(
    "no streaming-capable LLM provider available -- set one of " +
      "GROQ_API_KEY, OPENROUTER_API_KEY, ANTHROPIC_API_KEY",
    "router"
  );
}

export function getProviderByName(name: ProviderName): ProviderAdapter {
  const found = PROVIDER_ORDER.find((p) => p.name === name);
  if (!found) throw new LLMError(`unknown provider: ${name}`, "router");
  return found;
}

export const ALL_PROVIDERS = PROVIDER_ORDER;
