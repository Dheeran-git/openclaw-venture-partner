import { timingSafeEqual } from "crypto";

// In-memory rate buckets. Resets on cold start (acceptable for dev; Upstash in prod).
const buckets = new Map<string, { count: number; windowStart: number }>();
const bindFailures = new Map<string, { count: number; lockedUntil: number }>();

function compare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf); // consume constant time
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export type SecretKind = "shared" | "worker";

export function validateSecret(authHeader: string | null, kind: SecretKind): boolean {
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  const expected =
    kind === "shared" ? process.env.MCP_SHARED_SECRET : process.env.MCP_WORKER_SECRET;
  if (!expected) return false;
  return compare(token, expected);
}

export function checkRateLimit(
  key: string,
  maxPerMin = 60
): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const window = 60_000;
  const b = buckets.get(key);
  if (!b || now - b.windowStart > window) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }
  if (b.count >= maxPerMin) {
    return { allowed: false, retryAfter: Math.ceil((b.windowStart + window - now) / 1000) };
  }
  b.count++;
  return { allowed: true };
}

export function checkBindRateLimit(platformUserId: string): {
  allowed: boolean;
  retryAfter?: number;
} {
  const now = Date.now();

  // Hourly lockout (10 cumulative failures)
  const lock = bindFailures.get(platformUserId);
  if (lock && now < lock.lockedUntil) {
    return { allowed: false, retryAfter: Math.ceil((lock.lockedUntil - now) / 1000) };
  }

  // 5 attempts per minute
  const rl = checkRateLimit(`bind:${platformUserId}`, 5);
  return rl;
}

export function recordBindFailure(platformUserId: string): void {
  const now = Date.now();
  const entry = bindFailures.get(platformUserId) ?? { count: 0, lockedUntil: 0 };
  if (now < entry.lockedUntil) return;
  entry.count++;
  if (entry.count >= 10) {
    entry.lockedUntil = now + 3_600_000;
    entry.count = 0;
  }
  bindFailures.set(platformUserId, entry);
}
