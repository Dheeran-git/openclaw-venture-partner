import { LLMError } from "./types";

/**
 * Per-user daily LLM spend cap (build guide §4). Default $5/day. Zero or
 * negative disables the guard entirely (treat as "unlimited").
 */
function getDailyBudgetUsd(): number {
  const raw = process.env.USER_DAILY_BUDGET_USD;
  if (!raw) return 5.0;
  const n = Number(raw);
  if (Number.isNaN(n)) return 5.0;
  return n;
}

export class BudgetExceededError extends LLMError {
  constructor(
    public readonly user_id: string,
    public readonly spentUsd: number,
    public readonly capUsd: number
  ) {
    super(
      `Daily AI quota reached for user (${spentUsd.toFixed(4)} USD of ${capUsd.toFixed(2)} cap). Resets at midnight UTC.`,
      "router"
    );
    this.name = "BudgetExceededError";
  }
}

interface BudgetState {
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
}

/**
 * Look up today's spend from the materialized view; throw if exceeded.
 *
 * Soft-fails (returns "unlimited") when:
 * - Supabase env vars are missing (smoke tests, local without DB).
 * - The materialized view doesn't yet exist (first-run before migration 0016 applies).
 * - The DB query throws (connectivity issues).
 *
 * Telemetry must not block product calls. The trade-off is documented per
 * build guide §4 — guards are per-user-friendly, not absolute.
 */
export async function checkBudget(user_id: string): Promise<BudgetState> {
  const capUsd = getDailyBudgetUsd();
  if (capUsd <= 0) {
    return { spentUsd: 0, capUsd, remainingUsd: Infinity };
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return { spentUsd: 0, capUsd, remainingUsd: capUsd };
  }

  try {
    const { createServiceRoleClient } = await import("@openclaw/db/client");
    const db = createServiceRoleClient();
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    // user_daily_spend is a materialized view added in migration 0016;
    // generated types may not yet include it.
    const dbAny = db as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (k: string, v: unknown) => {
            eq: (k: string, v: unknown) => {
              maybeSingle: () => Promise<{
                data: { total_cost_usd?: number | string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };
    const { data, error } = await dbAny
      .from("user_daily_spend")
      .select("total_cost_usd")
      .eq("user_id", user_id)
      .eq("day", today.toISOString())
      .maybeSingle();
    if (error) {
      console.warn("[budget] view read failed:", error.message);
      return { spentUsd: 0, capUsd, remainingUsd: capUsd };
    }
    const spentUsd = Number(
      (data as { total_cost_usd?: number | string } | null)?.total_cost_usd ?? 0
    );
    if (spentUsd >= capUsd) {
      throw new BudgetExceededError(user_id, spentUsd, capUsd);
    }
    return {
      spentUsd,
      capUsd,
      remainingUsd: Math.max(0, capUsd - spentUsd),
    };
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err;
    console.warn("[budget] check threw:", (err as Error).message);
    return { spentUsd: 0, capUsd, remainingUsd: capUsd };
  }
}
