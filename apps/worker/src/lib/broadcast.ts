/**
 * Worker-side broadcast helper. Posts to Supabase Realtime's REST
 * broadcast endpoint (/realtime/v1/api/broadcast) so the worker
 * doesn't need to maintain a WebSocket subscription just to emit
 * progress. Frontend subscribers on the same channel receive these
 * messages identically to WS-originated broadcasts.
 *
 * Broadcast failures are warned-and-swallowed: progress events are
 * ephemeral telemetry, and a 5xx from Realtime should not abort a
 * scout run that's otherwise succeeding. The DB writes are the source
 * of truth.
 */
export type ProgressKind = "live" | "ok" | "warn";

function bareSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }
  return raw
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|realtime)\/v1$/i, "");
}

export type PublishProgressFn = (
  kind: ProgressKind,
  text: string,
  meta: string
) => Promise<void>;

export function makePublisher(userId: string): PublishProgressFn {
  const topic = `scout:${userId}`;

  return async (kind, text, meta) => {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
    }
    const url = `${bareSupabaseUrl()}/realtime/v1/api/broadcast`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              topic,
              event: "progress",
              payload: {
                kind,
                text,
                meta,
                ts: new Date().toISOString(),
              },
            },
          ],
        }),
      });
    } catch (err) {
      console.warn(
        `[broadcast] network error for ${topic}: ${(err as Error).message}`
      );
      return;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(
        `[broadcast] ${res.status} for ${topic}: ${body.slice(0, 200)}`
      );
    }
  };
}
