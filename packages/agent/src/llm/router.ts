import { copilotProvider } from "./providers/copilot.js";
import { openrouterProvider } from "./providers/openrouter.js";
import { geminiProvider } from "./providers/gemini.js";
import { anthropicProvider } from "./providers/anthropic.js";
import { LLMError, type ProviderAdapter, type ProviderName } from "./types.js";

/**
 * Provider order is locked per CLAUDE.md:
 *   Copilot → OpenRouter → Gemini → Anthropic
 *
 * Configuration check (`isConfigured`) is synchronous and cheap. If a remote
 * health check is added later, results are cached for 60s — see HEALTH_TTL_MS.
 */
const PROVIDER_ORDER: ProviderAdapter[] = [
  copilotProvider,
  openrouterProvider,
  geminiProvider,
  anthropicProvider,
];

const HEALTH_TTL_MS = 60_000;
const healthCache = new Map<ProviderName, { ok: boolean; expiresAt: number }>();

async function isHealthy(provider: ProviderAdapter): Promise<boolean> {
  if (!provider.isConfigured()) return false;
  if (!provider.healthCheck) return true;

  const cached = healthCache.get(provider.name);
  if (cached && cached.expiresAt > Date.now()) return cached.ok;

  let ok = false;
  try {
    ok = await provider.healthCheck();
  } catch {
    ok = false;
  }
  healthCache.set(provider.name, {
    ok,
    expiresAt: Date.now() + HEALTH_TTL_MS,
  });
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
    "no healthy LLM provider available — set at least one of " +
      "COPILOT_TOKEN, OPENROUTER_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY",
    "router"
  );
}

export function getProviderByName(name: ProviderName): ProviderAdapter {
  const found = PROVIDER_ORDER.find((p) => p.name === name);
  if (!found) throw new LLMError(`unknown provider: ${name}`, "router");
  return found;
}

export const ALL_PROVIDERS = PROVIDER_ORDER;
