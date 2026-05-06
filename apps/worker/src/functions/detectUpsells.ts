import { createServiceRoleClient } from "@openclaw/db";
import { inngest } from "../inngest";

/**
 * Phase 5 step 6 — daily cron that scans active clients and flags candidates
 * for follow-up. Two rules for now:
 *   1. last reply older than 14 days → "Consider following up; no inbound for 2+ weeks."
 *   2. memory_md mentions project completion AND no upsell flagged in 7 days
 *      → "Project ending; pitch next engagement."
 *
 * Future work: parse `memory_md` with an LLM-as-judge pass for richer signals.
 * For hackathon scope these two rules cover the demo.
 */
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const COMPLETION_PATTERNS = [
  /project (?:ending|completing|wrap[-\s]*up|wraps up|ships)/i,
  /(?:final|last) milestone/i,
  /handoff (?:next|in|on)/i,
  /going live (?:next|in|on)/i,
];

export const detectUpsells = inngest.createFunction(
  {
    id: "detect-upsells",
    name: "Clients: scan for upsell candidates",
  },
  { cron: "0 9 * * *" }, // 09:00 UTC daily
  async ({ step }) => {
    return runUpsellScan(step as unknown as InngestStepLike);
  }
);

/** Manual-invocation variant — fired by the /clients "Scan now" button. */
export const detectUpsellsManual = inngest.createFunction(
  {
    id: "detect-upsells-manual",
    name: "Clients: manual upsell scan",
  },
  { event: "client/upsell-scan" },
  async ({ step }) => {
    return runUpsellScan(step as unknown as InngestStepLike);
  }
);

interface InngestStepLike {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

async function runUpsellScan(step: InngestStepLike): Promise<{ scanned: number; flagged: number }> {
  const supabase = createServiceRoleClient();
  const now = Date.now();

  const { clients, replyMap } = await step.run("load-clients-and-replies", async () => {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, user_id, memory_md, upsell_flagged_at, last_reply_at, status")
      .eq("status", "active");

    const userIds = Array.from(new Set((clients ?? []).map((c) => c.user_id)));
    const replyMap = new Map<string, string>(); // client_id → most recent received_at
    if (userIds.length > 0) {
      const { data: replies } = await supabase
        .from("email_replies")
        .select("client_id, received_at")
        .in("user_id", userIds)
        .not("client_id", "is", null)
        .order("received_at", { ascending: false });
      for (const r of replies ?? []) {
        if (r.client_id && !replyMap.has(r.client_id)) {
          replyMap.set(r.client_id, r.received_at);
        }
      }
    }
    return { clients: clients ?? [], replyMap };
  });

  let flagged = 0;

  await step.run("flag-candidates", async () => {
    for (const c of clients) {
      const lastReply = replyMap.get(c.id) ?? c.last_reply_at;
      const memory = c.memory_md ?? "";

      let reason: string | null = null;

      const lastReplyMs = lastReply ? new Date(lastReply).getTime() : null;
      const flaggedRecently =
        c.upsell_flagged_at && now - new Date(c.upsell_flagged_at).getTime() < SEVEN_DAYS_MS;

      // Rule 2 (project completion phrasing) takes priority — more actionable
      if (!flaggedRecently && COMPLETION_PATTERNS.some((re) => re.test(memory))) {
        reason = "Project completion phrasing detected in memory — pitch next engagement.";
      }
      // Rule 1 (stale conversation) only if not already flagged for completion
      else if (
        !flaggedRecently &&
        lastReplyMs !== null &&
        now - lastReplyMs > FOURTEEN_DAYS_MS
      ) {
        const days = Math.floor((now - lastReplyMs) / (24 * 60 * 60 * 1000));
        reason = `No inbound reply in ${days} days — consider a polite follow-up.`;
      }

      if (reason) {
        await supabase
          .from("clients")
          .update({
            upsell_flagged_at: new Date().toISOString(),
            upsell_reason: reason,
            ...(lastReply ? { last_reply_at: lastReply } : {}),
          })
          .eq("id", c.id);
        flagged += 1;
      } else if (lastReply && lastReply !== c.last_reply_at) {
        // Keep last_reply_at fresh even if we didn't flag
        await supabase
          .from("clients")
          .update({ last_reply_at: lastReply })
          .eq("id", c.id);
      }
    }
  });

  return { scanned: clients.length, flagged };
}
