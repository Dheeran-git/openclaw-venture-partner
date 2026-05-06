/**
 * Activity rail subscription -- broadcast-only, no DB reads.
 *
 * Subscribes to the `scout:{user_id}` channel that the worker
 * publishes progress events on (apps/worker/src/lib/broadcast.ts).
 * Events are ephemeral by design: they live only in the rail's
 * rolling buffer, capped at 12. A page refresh empties the rail,
 * which is the intended behavior for transient operational signal.
 *
 * pushOptimistic lets the page prepend a synthetic event the moment
 * the user clicks Run scout, before the worker's first broadcast
 * lands. The worker's broadcasts then layer on top in real time.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";
import type { ActivityEvent } from "../lib/fixtures";

const MAX_BUFFER = 12;

interface BroadcastPayload {
  kind?: ActivityEvent["kind"];
  text?: string;
  meta?: string;
  ts?: string;
}

export interface UseScoutActivityResult {
  events: ActivityEvent[];
  pushOptimistic: (event: ActivityEvent) => void;
}

export function useScoutActivity(userId?: string): UseScoutActivityResult {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const pushOptimistic = useCallback((event: ActivityEvent) => {
    setEvents((prev) => {
      // If the prior buffer has any events, insert a divider so successive
      // scout runs are visually separated.
      const divider: ActivityEvent | null =
        prev.length > 0 && prev[0]?.kind !== "divider"
          ? { kind: "divider", text: "new run", meta: "" }
          : null;
      const next = divider ? [event, divider, ...prev] : [event, ...prev];
      return next.slice(0, MAX_BUFFER);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`scout:${userId}`)
      .on(
        "broadcast",
        { event: "progress" },
        (frame: { payload: BroadcastPayload }) => {
          const p = frame.payload ?? {};
          const event: ActivityEvent = {
            kind: p.kind ?? "",
            text: p.text ?? "",
            meta: p.meta ?? "",
          };
          setEvents((prev) => [event, ...prev].slice(0, MAX_BUFFER));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { events, pushOptimistic };
}
