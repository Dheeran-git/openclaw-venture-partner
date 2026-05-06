"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, Check } from "lucide-react";
import Link from "next/link";
import { useNotifications } from "../hooks/useNotifications";

export function NotificationsBell({ userId }: { userId: string | undefined }) {
  const { notifications, unreadCount, markRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(ev.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
    return undefined;
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className="oc-btn oc-btn-ghost"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell size={16} strokeWidth={1.5} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: "var(--brand-coral)",
              boxShadow: "0 0 0 2px var(--bg-base)",
            }}
            aria-label={`${unreadCount} unread`}
          />
        )}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 360,
            maxHeight: 480,
            overflowY: "auto",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            zIndex: 50,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <span
              className="oc-mono"
              style={{
                fontSize: 11,
                color: "var(--fg-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Notifications {unreadCount > 0 && `· ${unreadCount} unread`}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="oc-btn oc-btn-ghost"
                style={{ fontSize: 11, padding: "2px 8px", height: "auto" }}
                onClick={() => markRead()}
              >
                <Check size={12} strokeWidth={2} /> Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--fg-secondary)",
                fontSize: 12,
              }}
            >
              You&apos;re all caught up.
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {notifications.map((n) => {
                const inner = (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderBottom: "1px solid var(--border-subtle)",
                      background: n.read_at ? "transparent" : "rgba(255,77,77,0.05)",
                      cursor: n.href ? "pointer" : "default",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--fg-primary)", fontWeight: n.read_at ? 400 : 500 }}>
                        {n.title}
                      </span>
                      <span className="oc-mono oc-meta" style={{ fontSize: 10, flexShrink: 0 }}>
                        {new Date(n.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {n.body && (
                      <span style={{ fontSize: 12, color: "var(--fg-secondary)", lineHeight: 1.5 }}>
                        {n.body}
                      </span>
                    )}
                  </div>
                );
                return (
                  <li key={n.id} onClick={() => !n.read_at && markRead(n.id)}>
                    {n.href ? (
                      <Link href={n.href as never} style={{ textDecoration: "none", color: "inherit" }}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
