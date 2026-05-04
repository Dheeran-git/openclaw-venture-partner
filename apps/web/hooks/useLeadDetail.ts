"use client";

import { useEffect, useState } from "react";
import type { NormalizedLead } from "@openclaw/shared";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

export interface LeadDetailScore {
  score: number;
  reasoning: string | null;
  signals: string[] | null;
  created_at: string;
}

export interface LeadDetailData {
  id: string;
  layer: 1 | 2 | 3;
  normalized: NormalizedLead;
  scraped_at: string;
  score: LeadDetailScore | null;
}

export function useLeadDetail(leadId: string | undefined) {
  const [detail, setDetail] = useState<LeadDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    const supabase = getSupabaseBrowser();
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setLoading(true);

      const { data: lead, error: leadErr } = await supabase
        .from("leads")
        .select("id, layer, normalized, scraped_at")
        .eq("id", leadId)
        .single();

      if (cancelled) return;
      if (leadErr || !lead) {
        console.error("[useLeadDetail] lead fetch failed:", leadErr?.message);
        setLoading(false);
        return;
      }

      const { data: scoreRow } = await supabase
        .from("scores")
        .select("score, reasoning, signals, created_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      setDetail({
        id: lead.id as string,
        layer: lead.layer as 1 | 2 | 3,
        normalized: lead.normalized as unknown as NormalizedLead,
        scraped_at: lead.scraped_at as string,
        score: scoreRow
          ? {
              score: scoreRow.score as number,
              reasoning: scoreRow.reasoning as string | null,
              signals: Array.isArray(scoreRow.signals)
                ? (scoreRow.signals as string[])
                : null,
              created_at: scoreRow.created_at as string,
            }
          : null,
      });
      setLoading(false);

      channelRef = supabase
        .channel(`lead-score-watch-${leadId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "scores",
            filter: `lead_id=eq.${leadId}`,
          },
          (payload) => {
            const s = payload.new as {
              score: number;
              reasoning: string | null;
              signals: unknown;
              created_at: string;
            };
            setDetail((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                score: {
                  score: s.score,
                  reasoning: s.reasoning,
                  signals: Array.isArray(s.signals)
                    ? (s.signals as string[])
                    : null,
                  created_at: s.created_at,
                },
              };
            });
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [leadId]);

  return { detail, loading };
}
