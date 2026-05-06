/**
 * Phase 6 — minimal Sentry + PostHog integration with no SDK dependencies.
 *
 * Both services accept simple HTTPS POSTs against documented endpoints,
 * so we ship a tiny shim instead of pulling in @sentry/nextjs (~200KB)
 * or posthog-node. If the env vars are missing the helpers no-op,
 * which means the dashboard and worker still run cleanly without
 * observability creds wired up.
 */

interface ParsedDsn {
  publicKey: string;
  projectId: string;
  host: string;
}

let cachedDsn: ParsedDsn | null | undefined;

function parseSentryDsn(): ParsedDsn | null {
  if (cachedDsn !== undefined) return cachedDsn;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return (cachedDsn = null);
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, "");
    return (cachedDsn = {
      publicKey: url.username,
      projectId,
      host: url.host,
    });
  } catch {
    return (cachedDsn = null);
  }
}

interface CaptureContext {
  user_id?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export async function captureException(
  err: unknown,
  context: CaptureContext = {}
): Promise<void> {
  const dsn = parseSentryDsn();
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  console.error("[captureException]", message, { ...context, stack });

  if (!dsn) return;
  try {
    const auth = "Sentry sentry_version=7,sentry_key=" + dsn.publicKey + ",sentry_client=openclaw/1.0";
    const eventBody = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: Date.now() / 1000,
      level: "error",
      platform: "javascript",
      logger: "openclaw",
      message,
      tags: context.tags ?? {},
      extra: context.extra ?? {},
      user: context.user_id ? { id: context.user_id } : undefined,
      ...(stack
        ? {
            exception: {
              values: [
                {
                  type: "Error",
                  value: message,
                  stacktrace: { frames: parseStack(stack) },
                },
              ],
            },
          }
        : {}),
    };
    await fetch("https://" + dsn.host + "/api/" + dsn.projectId + "/store/", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sentry-Auth": auth },
      body: JSON.stringify(eventBody),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  } catch {
    /* swallow — observability never throws */
  }
}

function parseStack(stack: string): Array<{ filename: string; function: string; lineno?: number }> {
  return stack
    .split("\n")
    .slice(1, 6)
    .map((line) => {
      const m = /at (?:(.+?) )?\(?(.+?):(\d+):\d+\)?$/.exec(line.trim());
      if (!m) return { filename: line.trim(), function: "<unknown>" };
      return { filename: m[2] ?? "", function: m[1] ?? "<anonymous>", lineno: Number(m[3]) };
    });
}

interface PostHogEventInput {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
}

export async function trackEvent(input: PostHogEventInput): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!key) return;
  try {
    await fetch(host + "/capture/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event: input.event,
        distinct_id: input.distinctId,
        properties: { ...input.properties, $lib: "openclaw-server" },
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  } catch {
    /* swallow */
  }
}

export function getPostHogConfig(): { key: string | null; host: string } {
  return {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  };
}
