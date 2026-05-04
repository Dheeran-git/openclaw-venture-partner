"use client";

import { useEffect, useState } from "react";
import { DEMO_USER_ID } from "@openclaw/shared";
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
      .select("id", { count: "exact", head: true })
      .eq("user_id", DEMO_USER_ID),
    supabase
      .from("pitches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", DEMO_USER_ID)
      .eq("status", "sent"),
  ]);
  return {
    leadsQueued: leadsRes.count ?? 0,
    pitchesSent: pitchesRes.count ?? 0,
  };
}

export function useStats() {
  const [stats, setStats] = useState<Stats>({ leadsQueued: 0, pitchesSent: 0 });

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    fetchCounts(supabase).then(setStats).catch(console.error);

    const channel = supabase
      .channel("stats-watch")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads", filter: `user_id=eq.${DEMO_USER_ID}` },
        () => fetchCounts(supabase).then(setStats).catch(console.error)
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pitches", filter: `user_id=eq.${DEMO_USER_ID}` },
        () => fetchCounts(supabase).then(setStats).catch(console.error)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pitches", filter: `user_id=eq.${DEMO_USER_ID}` },
        () => fetchCounts(supabase).then(setStats).catch(console.error)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return stats;
}
