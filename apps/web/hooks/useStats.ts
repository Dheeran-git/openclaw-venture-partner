"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

interface Stats {
  leadsQueued: number;
  pitchesSent: number;
  pitchesDrafted: number;
  /** Hours saved heuristic: 2 min/lead-scored + 20 min/pitch-drafted + 10 min/pitch-sent.
   *  See PRODUCTION_BUILD_GUIDE.md "Hours saved" rationale (B4). */
  hoursSaved: number;
}

async function fetchCounts(
  supabase: ReturnType<typeof getSupabaseBrowser>
): Promise<Stats> {
  const [leadsRes, pitchesSentRes, pitchesDraftedRes] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }),
    supabase
      .from("pitches")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase.from("pitches").select("id", { count: "exact", head: true }),
  ]);
  const leadsQueued = leadsRes.count ?? 0;
  const pitchesSent = pitchesSentRes.count ?? 0;
  const pitchesDrafted = pitchesDraftedRes.count ?? 0;
  const minutes = leadsQueued * 2 + pitchesDrafted * 20 + pitchesSent * 10;
  const hoursSaved = Math.round((minutes / 60) * 10) / 10;
  return { leadsQueued, pitchesSent, pitchesDrafted, hoursSaved };
}

export function useStats(userId?: string) {
  const [stats, setStats] = useState<Stats>({
    leadsQueued: 0,
    pitchesSent: 0,
    pitchesDrafted: 0,
    hoursSaved: 0,
  });

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowser();

    fetchCounts(supabase).then(setStats).catch(console.error);

    const channel = supabase
      .channel("stats-watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads", filter: `user_id=eq.${userId}` },
        () => fetchCounts(supabase).then(setStats).catch(console.error)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pitches", filter: `user_id=eq.${userId}` },
        () => fetchCounts(supabase).then(setStats).catch(console.error)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pitches", filter: `user_id=eq.${userId}` },
        () => fetchCounts(supabase).then(setStats).catch(console.error)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return stats;
}
