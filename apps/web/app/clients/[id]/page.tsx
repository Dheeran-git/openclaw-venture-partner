"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailPlus } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useSession } from "../../../lib/auth";
import { useStats } from "../../../hooks/useStats";
import { useClientDetail } from "../../../hooks/useClientDetail";
import { MemoryRenderer } from "../../../components/client-detail/MemoryRenderer";
import { ReplyCard } from "../../../components/client-detail/ReplyCard";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const session = useSession();
  const userId = session?.user.id;
  const { leadsQueued, pitchesSent } = useStats(userId);
  const { client, replies, loading } = useClientDetail(id);

  const [simulating, setSimulating] = useState(false);
  const [simBody, setSimBody] = useState(
    "Yes, this looks great. Tuesday 2pm PST works on my end. Send a Calendly link?"
  );
  const [simSubject, setSimSubject] = useState("Re: Next.js dashboard rebuild");

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

  async function handleSimulate() {
    setSimulating(true);
    try {
      const lastPitchId = replies.length > 0 ? replies[replies.length - 1]!.pitch_id : null;
      // Look up the most recent pitch for this client's source_lead_id
      let pitchId = lastPitchId;
      if (!pitchId && client?.source_lead_id) {
        // Best-effort: use the source lead's most recent pitch
        const res = await fetch(`/api/clients/${id}/source-pitch`);
        if (res.ok) {
          const json = (await res.json()) as { pitch_id?: string };
          pitchId = json.pitch_id ?? null;
        }
      }
      if (!pitchId) {
        alert("No pitch found to attach reply to. Send a pitch first.");
        return;
      }
      const res = await fetch("/api/email/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pitch_id: pitchId,
          from_email: client?.contact_email ?? "test@example.com",
          subject: simSubject,
          body_text: simBody,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert((j as { error?: string }).error ?? "Simulate failed");
      }
    } finally {
      setSimulating(false);
    }
  }

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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link
              href={"/clients" as never}
              style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--fg-secondary)", textDecoration: "none" }}
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
            </Link>
            <div>
              <h1 className="oc-h1">{client?.company_name ?? "Loading…"}</h1>
              <div className="oc-h1-sub">
                {client?.contact_email ?? ""} · {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </div>
            </div>
          </div>
          <div className="oc-topbar-actions">
            <button
              className="oc-btn oc-btn-secondary"
              onClick={handleSimulate}
              disabled={simulating}
            >
              <MailPlus size={13} strokeWidth={1.5} />
              {simulating ? "Sending…" : "Simulate inbound reply"}
            </button>
          </div>
        </div>

        <div className="oc-content" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 24 }}>
          {/* Memory column */}
          <div>
            <div className="oc-section-label" style={{ marginBottom: 8 }}>CLIENT MEMORY</div>
            <div
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: "20px 22px",
                minHeight: 240,
              }}
            >
              {loading && <div className="oc-meta">Loading…</div>}
              {!loading && client?.memory_md && <MemoryRenderer md={client.memory_md} />}
              {!loading && !client?.memory_md && (
                <div className="oc-meta" style={{ fontSize: 13 }}>
                  No memory yet. The agent will start populating this after the
                  first approved reply.
                </div>
              )}
            </div>

            {/* Simulator (free-tier) */}
            <details
              style={{
                marginTop: 16,
                background: "var(--bg-card)",
                border: "1px dashed var(--border-subtle)",
                borderRadius: 12,
                padding: "12px 16px",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--fg-secondary)",
                }}
              >
                Simulate inbound reply (free-tier, no custom domain)
              </summary>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="text"
                  value={simSubject}
                  onChange={(e) => setSimSubject(e.target.value)}
                  placeholder="Subject"
                  style={{
                    background: "var(--bg-base)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    padding: "6px 10px",
                    fontSize: 12,
                    color: "var(--fg-primary)",
                  }}
                />
                <textarea
                  value={simBody}
                  onChange={(e) => setSimBody(e.target.value)}
                  rows={4}
                  className="oc-textarea"
                  style={{ width: "100%" }}
                />
                <div className="oc-meta" style={{ fontSize: 11 }}>
                  This injects an email_replies row + fires the classify+draft
                  worker. No DNS or Resend Inbound config required.
                </div>
              </div>
            </details>
          </div>

          {/* Replies column */}
          <div>
            <div className="oc-section-label" style={{ marginBottom: 8 }}>REPLY THREAD</div>
            {loading && <div className="oc-meta">Loading…</div>}
            {!loading && replies.length === 0 && (
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
                No replies yet. Use the simulator to seed one.
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {replies.map((r) => (
                <ReplyCard key={r.id} reply={r} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
