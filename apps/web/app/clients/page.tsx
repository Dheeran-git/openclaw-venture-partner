"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "../../components/Sidebar";
import { useSession } from "../../lib/auth";
import { useStats } from "../../hooks/useStats";
import { getSupabaseBrowser } from "../../lib/supabaseBrowser";

interface ClientRow {
  id: string;
  company_name: string;
  contact_email: string | null;
  status: string | null;
  created_at: string;
}

export default function ClientsPage() {
  const session = useSession();
  const userId = session?.user.id;
  const { leadsQueued, pitchesSent } = useStats(userId);

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;
    const supabase = getSupabaseBrowser();

    async function load() {
      const { data, error } = await supabase
        .from("clients")
        .select("id, company_name, contact_email, status, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (!error) setClients((data as ClientRow[] | null) ?? []);
      setLoading(false);
    }
    load();

    const channel = supabase
      .channel(`clients-list-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clients", filter: `user_id=eq.${uid}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
    <div className="oc-app">
      <Sidebar
        {...userMeta}
        inboxCount={leadsQueued}
        pitchesCount={pitchesSent}
        initialActive="clients"
      />
      <main className="oc-main">
        <div className="oc-topbar">
          <div>
            <h1 className="oc-h1">Clients</h1>
            <div className="oc-h1-sub">
              {loading ? "Loading…" : `${clients.length} active client${clients.length === 1 ? "" : "s"}`}
            </div>
          </div>
        </div>

        <div className="oc-content">
          {!loading && clients.length === 0 && (
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
              No clients yet. Clients are auto-created when an inbound reply is
              classified as positive — try the demo seed and simulate a reply.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {clients.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}` as never}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 12,
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="oc-mono" style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-primary)" }}>
                    {c.company_name}
                  </div>
                  <span className="oc-mono oc-meta" style={{ fontSize: 11 }}>
                    {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="oc-mono oc-meta" style={{ fontSize: 12 }}>
                  {c.contact_email ?? "—"} · {c.status ?? "active"}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
