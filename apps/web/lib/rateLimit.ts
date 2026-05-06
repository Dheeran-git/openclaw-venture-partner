/**
 * Phase 6 — generalized rate limiting.
 *
 * Production: uses Upstash Redis REST API (free tier covers our scale)
 * via fetch, so no extra npm dep is required. Falls back to a per-process
 * in-memory Map when Upstash creds aren't set — fine for dev and the
 * hackathon submission. Cold starts reset the in-memory state, which is
 * acceptable behavior for the limits we set.
 *
 * Algorithm: fixed window. Each call increments a counter keyed by
 * `${prefix}:${id}:${windowStart}`; the counter is set to expire at
 * `windowStart + windowMs / 1000`. Simple, predictable, free of clock
 * skew because Upstash handles TTL server-side.
 */

interface RateLimitConfig {
  /** Stable identifier for the limit category (e.g. "scout", "pitch-draft"). */
  prefix: string;
  /** Caller identifier — typically user_id or IP. */
  id: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until the limit resets
}

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashIncr(key: string, ttlSec: number): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  // Pipeline: INCR then EXPIRE if value === 1 (so TTL is set only on first increment)
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(ttlSec), "NX"],
    ]),
  });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  const arr = (await res.json()) as Array<{ result: number }>;
  return arr[0]?.result ?? 0;
}

export async function rateLimit(cfg: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / cfg.windowMs) * cfg.windowMs;
  const resetAt = windowStart + cfg.windowMs;
  const key = `${cfg.prefix}:${cfg.id}:${windowStart}`;
  const ttlSec = Math.ceil(cfg.windowMs / 1000) + 5;

  let count: number;
  if (upstashConfigured()) {
    try {
      count = await upstashIncr(key, ttlSec);
    } catch {
      // Upstash transient error → fall back to in-memory for this call
      count = bumpMemory(key, resetAt);
    }
  } else {
    count = bumpMemory(key, resetAt);
  }

  const allowed = count <= cfg.limit;
  return {
    allowed,
    remaining: Math.max(0, cfg.limit - count),
    retryAfter: Math.ceil((resetAt - now) / 1000),
  };
}

function bumpMemory(key: string, resetAt: number): number {
  const entry = memoryBuckets.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt });
    pruneMemory();
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

function pruneMemory(): void {
  // Keep memory bounded — drop expired entries opportunistically
  if (memoryBuckets.size < 1000) return;
  const now = Date.now();
  for (const [k, v] of memoryBuckets) {
    if (v.resetAt < now) memoryBuckets.delete(k);
  }
}

/** Helper: produce a 429 Response with Retry-After header. */
export function rateLimited(retryAfter: number, message = "rate_limited"): Response {
  return Response.json(
    { ok: false, error: message, retry_after: retryAfter },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
