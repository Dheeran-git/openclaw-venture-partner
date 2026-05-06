"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  resource_type: string | null;
  resource_id: string | null;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    const res = await fetch("/api/notifications");
    const json = (await res.json().catch(() => ({ notifications: [] }))) as {
      notifications?: NotificationRow[];
    };
    setNotifications(json.notifications ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    reload();

    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const markRead = useCallback(async (id?: string) => {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : {}),
    });
    reload();
  }, [reload]);

  return { notifications, unreadCount, loading, markRead, reload };
}
