"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useSession } from "../../../lib/auth";
import { useStats } from "../../../hooks/useStats";

export default function DataSettingsPage() {
  const session = useSession();
  const userId = session?.user.id;
  const { leadsQueued, pitchesSent } = useStats(userId);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function handleImport(file: File) {
    setError(null);
    setImporting(true);
    try {
      const text = await file.text();
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const json = (await res.json().catch(() => ({}))) as { imported?: number; skipped?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setImportResult({ imported: json.imported ?? 0, skipped: json.skipped ?? 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  }

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
        initialActive="settings"
      />
      <main className="oc-main">
        <div className="oc-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href={"/settings" as never} style={{ color: "var(--fg-secondary)", display: "flex", alignItems: "center", textDecoration: "none" }}>
              <ArrowLeft size={16} strokeWidth={1.5} />
            </Link>
            <div>
              <h1 className="oc-h1">Data</h1>
              <div className="oc-h1-sub">Export everything; import a previous snapshot.</div>
            </div>
          </div>
        </div>
        <div className="oc-content" style={{ maxWidth: 720, display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-primary)" }}>Export your data</div>
                <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                  Profile, leads, scores, pitches, proof artifacts, replies, clients,
                  approvals, and last 1000 audit-log entries — JSON, downloadable.
                </div>
              </div>
              <a className="oc-btn oc-btn-secondary" href="/api/export" download>
                <Download size={13} strokeWidth={1.5} /> Download
              </a>
            </div>
          </Card>

          <Card>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-primary)", marginBottom: 4 }}>
              Import leads
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              Upload a previously-exported JSON file. Only leads are restored;
              pitches, clients, and approvals are session-specific and are not
              re-imported. Dedup keys on (user_id, hash) so the import is idempotent.
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImport(f);
              }}
            />
            <button
              className="oc-btn oc-btn-secondary"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              <Upload size={13} strokeWidth={1.5} />
              {importing ? "Importing…" : "Choose JSON file"}
            </button>
            {importResult && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  background: "rgba(16,185,129,0.10)",
                  border: "1px solid rgba(16,185,129,0.3)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#10B981",
                }}
              >
                Imported {importResult.imported} leads, skipped {importResult.skipped} (already present).
              </div>
            )}
            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: "8px 12px",
                  background: "rgba(239,68,68,0.10)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#EF4444",
                }}
              >
                {error}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "16px 20px",
      }}
    >
      {children}
    </div>
  );
}
