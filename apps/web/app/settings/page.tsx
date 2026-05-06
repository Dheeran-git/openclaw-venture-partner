"use client";

import Link from "next/link";
import { User, Link2, Database, Settings as SettingsIcon, AlertTriangle } from "lucide-react";
import { Sidebar } from "../../components/Sidebar";
import { useSession } from "../../lib/auth";
import { useStats } from "../../hooks/useStats";

const SECTIONS = [
  {
    href: "/settings/profile",
    icon: User,
    title: "Profile",
    body: "Edit display name, skills, bio, and hourly rate. Used by the LLM when drafting pitches.",
  },
  {
    href: "/settings/connect",
    icon: Link2,
    title: "Connected accounts",
    body: "Link Telegram (and Discord, when configured) to receive pitch notifications and approve from chat.",
  },
  {
    href: "/settings/data",
    icon: Database,
    title: "Data",
    body: "Export your leads, pitches, and clients as JSON. Import from a previous export.",
  },
] as const;

export default function SettingsIndexPage() {
  const session = useSession();
  const userId = session?.user.id;
  const { leadsQueued, pitchesSent } = useStats(userId);

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
          <div>
            <h1 className="oc-h1">Settings</h1>
            <div className="oc-h1-sub">{session?.user?.email}</div>
          </div>
        </div>
        <div className="oc-content" style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.href}
                  href={s.href as never}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <Icon size={18} strokeWidth={1.5} style={{ color: "var(--brand-coral)", marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-primary)" }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "var(--fg-secondary)", marginTop: 4, lineHeight: 1.5 }}>
                      {s.body}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Provider preferences (read-only — managed via env vars) */}
          <div
            style={{
              marginTop: 32,
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div className="oc-section-label" style={{ marginBottom: 12 }}>
              <SettingsIcon size={11} strokeWidth={1.5} style={{ verticalAlign: -1, marginRight: 4 }} />
              PROVIDER PREFERENCES
            </div>
            <ProviderRow label="LLM chain" value="Copilot → Gemini → Groq → OpenRouter" />
            <ProviderRow label="Primary scraper" value={process.env.NEXT_PUBLIC_SCRAPER ?? "stub"} />
            <ProviderRow label="Daily budget cap" value="$5.00 USD" />
            <p style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 12, lineHeight: 1.5 }}>
              These are managed via environment variables in this build. User-controlled
              provider preferences are scheduled for a post-hackathon release.
            </p>
          </div>

          {/* Danger zone */}
          <div
            style={{
              marginTop: 16,
              background: "rgba(239,68,68,0.05)",
              border: "1px solid rgba(239,68,68,0.30)",
              borderRadius: 12,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                color: "#EF4444",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={13} strokeWidth={1.5} /> DANGER ZONE
            </div>
            <p style={{ fontSize: 12, color: "var(--fg-secondary)", lineHeight: 1.5, marginTop: 0, marginBottom: 12 }}>
              Sign out of all sessions. Account deletion is gated to a Supabase admin
              action in this build.
            </p>
            <a href="/auth/sign-out" className="oc-btn oc-btn-destructive" style={{ display: "inline-flex" }}>
              Sign out
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function ProviderRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
      <span style={{ color: "var(--fg-secondary)" }}>{label}</span>
      <span className="oc-mono" style={{ color: "var(--fg-primary)" }}>{value}</span>
    </div>
  );
}
