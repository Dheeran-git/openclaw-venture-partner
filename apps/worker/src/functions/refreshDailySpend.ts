import { createServiceRoleClient } from "@openclaw/db";
import { inngest } from "../inngest";

/**
 * Nightly cron that refreshes the `user_daily_spend` materialized view used
 * by the budget guard (build guide §4 + §8). Runs at 01:00 UTC. The
 * `concurrently` flag means the view is refreshed without blocking concurrent
 * reads — costs an extra index scan but lets the dashboard read at any time.
 */
export const refreshDailySpend = inngest.createFunction(
  {
    id: "refresh-daily-spend",
    name: "LLM: refresh user_daily_spend matview",
  },
  { cron: "0 1 * * *" },
  async ({ step }) => {
    return step.run("refresh-matview", async () => {
      const db = createServiceRoleClient() as unknown as {
        rpc: (
          name: string,
          args?: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      };
      // Refresh via a Postgres RPC. The function `refresh_user_daily_spend`
      // is defined in migration 0016. If it's missing (pre-0016 environment),
      // fall back to a no-op so the cron doesn't fail loudly.
      const { error } = await db.rpc("refresh_user_daily_spend");
      if (error) {
        console.warn("[refresh-daily-spend] rpc failed:", error.message);
        return { ok: false, message: error.message };
      }
      return { ok: true };
    });
  }
);
