"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

interface Stats {
  leadsQueued: number;
  pitchesSent: number;
}

async function fetchCounts(
  supabase: ReturnType<typeof getSupabaseBrowser>
): Promise<Stats> {
  const [leadsRes, pitchesRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("pitches")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
  ]);
  return {
    leadsQueued: leadsRes.count ?? 0,
    pitchesSent: pitchesRes.count ?? 0,
  };
}

export function useStats(userId?: string) {
  const [stats, setStats] = useState<Stats>({ leadsQueued: 0, pitchesSent: 0 });

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
