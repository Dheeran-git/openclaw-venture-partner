"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sidebar } from "../../components/Sidebar";
import { useSession } from "../../lib/auth";
import { useStats } from "../../hooks/useStats";
import { getSupabaseBrowser } from "../../lib/supabaseBrowser";
import type { PitchStatus } from "@openclaw/db/types";

interface PitchRow {
  id: string;
  lead_id: string;
  subject: string | null;
  draft: string;
  status: PitchStatus;
  created_at: string;
  approved_at: string | null;
  sent_at: string | null;
}

const STATUS_ORDER: Array<PitchStatus | "all"> = [
  "all",
  "draft",
  "approved",
  "sent",
  "rejected",
  "send_failed",
];

const STATUS_COLOR: Record<PitchStatus, string> = {
  draft: "#00E5CC",
  approved: "#10B981",
  sent: "#10B981",
  rejected: "#8892AB",
  send_failed: "#EF4444",
};

const STATUS_LABEL: Record<PitchStatus | "all", string> = {
  all: "All",
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
  rejected: "Rejected",
  send_failed: "Send failed",
};

export default function PitchesPage() {
  const session = useSession();
  const userId = session?.user.id;
  const { leadsQueued, pitchesSent } = useStats(userId);

  const [pitches, setPitches] = useState<PitchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PitchStatus | "all">("all");

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    const supabase = getSupabaseBrowser();

    async function load() {
      const { data, error } = await supabase
        .from("pitches")
        .select("id, lead_id, subject, draft, status, created_at, approved_at, sent_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (!error) setPitches((data as PitchRow[]) ?? []);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`pitches-list-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pitches", filter: `user_id=eq.${uid}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: pitches.length };
    for (const p of pitches) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [pitches]);

  const filtered = filter === "all" ? pitches : pitches.filter((p) => p.status === filter);

  const userMeta = session?.user
    ? {
        userName:
          (session.user.user_metadata?.full_name as string | undefined) ??
          session.user.email?.split("@")[0] ??
          "You",
        userHandle: session.user.email ?? "",
        userInitials: (
          (session.user.user_metadata?.full_name as string | undefined) ??
          session.user.email ??
          "?"
        )
          .slice(0, 2)
          .toUpperCase(),
      }
    : undefined;

  return (
    // Override the default 3-col grid (sidebar + main + 320px rail) — the
    // pitches page has no right rail, so reclaim that column for the list
    // and let oc-content's overflow:auto handle scrolling once the count
    // outgrows the viewport.
    <div className="oc-app" style={{ gridTemplateColumns: "256px 1fr" }}>
      <Sidebar
        {...userMeta}
        inboxCount={leadsQueued}
        pitchesCount={pitchesSent}
        initialActive="pitches"
      />
      <main className="oc-main">
        <div className="oc-topbar">
          <div>
            <h1 className="oc-h1">Pitches</h1>
            <div className="oc-h1-sub">
              {loading ? "Loading…" : `${pitches.length} total · drafted, approved, sent, or rejected`}
            </div>
          </div>
        </div>

        <div className="oc-content">
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {STATUS_ORDER.map((s) => {
              const active = filter === s;
              const count = counts[s] ?? 0;
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className="oc-pill"
                  style={{
                    cursor: "pointer",
                    background: active ? "var(--brand-coral)" : "var(--bg-card)",
                    color: active ? "#0B0F19" : "var(--fg-secondary)",
                    border: `1px solid ${active ? "var(--brand-coral)" : "var(--border-subtle)"}`,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {STATUS_LABEL[s]} {count > 0 && `(${count})`}
                </button>
              );
            })}
          </div>

          {!loading && filtered.length === 0 && (
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px dashed var(--border-subtle)",
                borderRadius: 12,
                padding: "32px 24px",
                textAlign: "center",
                color: "var(--fg-secondary)",
              }}
            >
              {filter === "all"
                ? "No pitches yet. Run scout, click a lead, then tap Draft pitch."
                : `No ${STATUS_LABEL[filter as PitchStatus].toLowerCase()} pitches.`}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((p) => {
              const color = STATUS_COLOR[p.status];
              const excerpt = p.draft.length > 200 ? p.draft.slice(0, 200) + "…" : p.draft;
              return (
                <Link
                  key={p.id}
                  href={`/?lead=${p.lead_id}`}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    textDecoration: "none",
                    color: "inherit",
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      className="oc-pill"
                      style={{
                        color,
                        background: color + "1A",
                        borderColor: color + "55",
                      }}
                    >
                      <span className="oc-dot" style={{ background: color }} />
                      {STATUS_LABEL[p.status]}
                    </span>
                    <span className="oc-mono oc-meta" style={{ fontSize: 11 }}>
                      {new Date(p.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {p.subject && (
                    <div
                      className="oc-mono"
                      style={{ fontSize: 13, color: "var(--fg-primary)", fontWeight: 500 }}
                    >
                      {p.subject}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--fg-secondary)",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {excerpt}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
