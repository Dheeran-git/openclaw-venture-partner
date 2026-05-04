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
import { DEMO_USER_ID } from "@openclaw/shared";
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

export function useScoutActivity(): UseScoutActivityResult {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const pushOptimistic = useCallback((event: ActivityEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, MAX_BUFFER));
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`scout:${DEMO_USER_ID}`)
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
  }, []);

  return { events, pushOptimistic };
}
