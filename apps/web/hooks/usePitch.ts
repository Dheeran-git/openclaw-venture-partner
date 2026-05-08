"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";
import type { PitchStatus } from "@openclaw/db/types";

export interface PitchData {
  id: string;
  lead_id: string;
  user_id: string;
  draft: string;
  subject: string | null;
  status: PitchStatus;
  payload_hash: string | null;
  expected_signal: Record<string, unknown> | null;
  created_at: string;
}

export function usePitch(leadId: string | undefined) {
  const [pitch, setPitch] = useState<PitchData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) {
      setPitch(null);
      return;
    }

    // Critical: reset state at the START of every effect run. Without
    // this, switching from a lead WITH a pitch to a lead WITHOUT one
    // leaves the previous lead's pitch on screen because the maybeSingle
    // null result didn't clear state. Caused rejected pitches to
    // "leak" across unrelated leads.
    setPitch(null);

    let cancelled = false;
    const supabase = getSupabaseBrowser();
    let channelRef: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("pitches")
        .select(
          "id, lead_id, user_id, draft, subject, status, payload_hash, expected_signal, created_at"
        )
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("[usePitch] fetch failed:", error.message);
        setPitch(null);
      } else {
        // data is either the latest pitch row or null when this lead has
        // no pitch yet. Either way, reflect the truth.
        setPitch(data ? (data as unknown as PitchData) : null);
      }
      setLoading(false);

      channelRef = supabase
        .channel(`pitch-watch-${leadId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "pitches",
            filter: `lead_id=eq.${leadId}`,
          },
          (payload) => {
            if (!cancelled) setPitch(payload.new as unknown as PitchData);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "pitches",
            filter: `lead_id=eq.${leadId}`,
          },
          (payload) => {
            if (!cancelled) {
              const updated = payload.new as PitchData;
              setPitch((prev) => {
                if (!prev || prev.id !== updated.id) return prev;
                return { ...prev, ...updated };
              });
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelRef) supabase.removeChannel(channelRef);
    };
  }, [leadId]);

  return { pitch, loading, setPitch };
}
