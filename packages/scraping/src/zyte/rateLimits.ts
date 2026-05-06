/**
 * Per-source token-bucket rate limiter. Rates per build guide §5.2.
 * In-process only — production scale would key Upstash; for hackathon
 * scale a single Vercel worker invocation is fine.
 */
import type { SourceType } from "../types";

interface Bucket {
  tokens: number;
  capacity: number;
  refillRatePerSec: number;
  lastRefill: number;
}

const RATE_RPM: Record<SourceType, number> = {
  upwork: 10,
  linkedin: 4,
  indeed: 8,
  freelancer: 6,
  contra: 6,
  reddit: 30,
  x: 20,
  github: 30,
  other: 10,
};

const buckets: Partial<Record<SourceType, Bucket>> = {};

function getBucket(source: SourceType): Bucket {
  let b = buckets[source];
  if (b) return b;
  const rpm = RATE_RPM[source];
  b = {
    tokens: rpm,
    capacity: rpm,
    refillRatePerSec: rpm / 60,
    lastRefill: Date.now(),
  };
  buckets[source] = b;
  return b;
}

function refill(b: Bucket): void {
  const now = Date.now();
  const elapsed = (now - b.lastRefill) / 1000;
  if (elapsed <= 0) return;
  b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillRatePerSec);
  b.lastRefill = now;
}

/** Wait until at least one token is available, then consume it. */
export async function takeRateToken(source: SourceType): Promise<void> {
  const b = getBucket(source);
  for (let i = 0; i < 30; i++) {
    refill(b);
    if (b.tokens >= 1) {
      b.tokens -= 1;
      return;
    }
    const waitMs = Math.max(50, 1000 / b.refillRatePerSec);
    await new Promise((r) => setTimeout(r, waitMs));
  }
  throw new Error(`rate limit: gave up waiting for token (source=${source})`);
}
