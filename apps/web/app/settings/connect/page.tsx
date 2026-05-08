"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, Zap, Send, MessageSquare, Trash2 } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useSession } from "../../../lib/auth";

type Platform = "telegram" | "discord";

interface PlatformMeta {
  id: Platform;
  label: string;
  Icon: typeof Send;
  description: string;
}

const PLATFORMS: PlatformMeta[] = [
  {
    id: "telegram",
    label: "Telegram",
    Icon: Send,
    description:
      "Connect your Telegram account to receive pitch notifications and approve outreach from your phone — without opening the dashboard.",
  },
  {
    id: "discord",
    label: "Discord",
    Icon: MessageSquare,
    description:
      "Receive lead alerts and approve pitches from any Discord server where you've added the OpenClaw VP bot.",
  },
];

export default function ConnectPage() {
  const session = useSession();
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("telegram");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  // Tracks the platform the currently-displayed code was generated for.
  // Used so we don't accept a stale response when the user has already
  // switched tabs again before the previous fetch resolves.
  const inflightPlatform = useRef<Platform | null>(null);

  useEffect(() => {
    if (session === null) router.replace("/auth/login");
  }, [session, router]);

  const generateCode = useCallback(async (target: Platform) => {
    setLoading(true);
    setCopied(false);
    inflightPlatform.current = target;
    try {
      const res = await fetch("/api/settings/generate-bind-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: target }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { code: string; expires_at: string };
      // Drop response if user has switched platforms while we were
      // waiting -- prevents flicker between codes.
      if (inflightPlatform.current !== target) return;
      setCode(data.code);
      setExpiresAt(new Date(data.expires_at));
    } finally {
      if (inflightPlatform.current === target) setLoading(false);
    }
  }, []);

  // Generate code when session is ready or when the platform tab changes.
  // Browser tab/window switches DON'T trigger this -- the existing 15-min
  // code is still valid, no need to burn a fresh one. (No visibility
  // listener wired on purpose.)
  useEffect(() => {
    if (session) generateCode(platform);
  }, [session, platform, generateCode]);

  // Countdown timer — auto-refresh when expired.
  useEffect(() => {
    if (!expiresAt) return;
    const tick = setInterval(() => {
      const left = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      );
      setTimeLeft(left);
      if (left === 0) generateCode(platform);
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresAt, generateCode, platform]);

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSeedDemo() {
    setSeedError(null);
    setClearMsg(null);
    setSeeding(true);
    try {
      const res = await fetch("/api/demo/seed", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        redirect?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Seed failed");
      }
      router.push((json.redirect ?? "/") as never);
    } catch (err) {
      setSeedError((err as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  async function handleClearDemo() {
    setSeedError(null);
    setClearMsg(null);
    setClearing(true);
    try {
      const res = await fetch("/api/demo/clear", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        cleared?: number;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Clear failed");
      }
      setClearMsg(
        (json.cleared ?? 0) > 0
          ? "Demo data cleared."
          : "No demo data to clear."
      );
      // Bounce them home so the inbox refreshes without the seeded row.
      // Small delay so they actually see the toast before navigation.
      setTimeout(() => router.push("/" as never), 800);
    } catch (err) {
      setSeedError((err as Error).message);
    } finally {
      setClearing(false);
    }
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const telegramBot = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const active = PLATFORMS.find((p) => p.id === platform)!;

  if (!session) return null;

  const userMeta = {
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
  };

  const telegramSteps: React.ReactNode[] = [
    <>
      Open Telegram and find{" "}
      <code className="oc-mono" style={inlineCodeStyle}>
        {telegramBot ? `@${telegramBot}` : "your OpenClaw VP bot"}
      </code>
    </>,
    <>
      Send{" "}
      <code className="oc-mono" style={inlineCodeStyle}>
        /start
      </code>
    </>,
    "Type or paste your 6-digit code when prompted",
    "Done — you'll receive a confirmation message",
  ];

  const discordSteps: React.ReactNode[] = [
    "Make sure the OpenClaw VP bot is invited to your Discord server",
    <>
      In any channel where the bot is present, run{" "}
      <code className="oc-mono" style={inlineCodeStyle}>
        /bind code:{code ?? "<6-digit>"}
      </code>
    </>,
    "Done — the bot will reply with a confirmation",
  ];

  const steps = platform === "telegram" ? telegramSteps : discordSteps;

  return (
    <div className="oc-app" style={{ gridTemplateColumns: "256px 1fr" }}>
      <Sidebar {...userMeta} initialActive="settings" />

      <main className="oc-main">
        <div
          style={{
            padding: "48px 24px 64px",
            maxWidth: 720,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Settings / Connect
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Link {active.label}
            </h1>
            <p style={{ color: "var(--fg-secondary)", lineHeight: 1.6, margin: 0 }}>
              {active.description}
            </p>
          </div>

          {/* Platform tabs */}
          <div
            role="tablist"
            aria-label="Chat platform"
            style={{
              display: "flex",
              gap: 8,
              padding: 4,
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              marginBottom: 20,
            }}
          >
            {PLATFORMS.map((p) => {
              const isActive = p.id === platform;
              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    if (p.id !== platform) setPlatform(p.id);
                  }}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "10px 16px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "var(--fg-primary)" : "var(--fg-secondary)",
                    background: isActive ? "var(--bg-elevated)" : "transparent",
                    transition: "background 0.12s, color 0.12s",
                  }}
                >
                  <p.Icon size={14} strokeWidth={1.7} />
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Code card */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-emphasis)",
              borderRadius: 12,
              padding: "32px 24px",
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            {loading ? (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 40,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: "var(--fg-dim)",
                  marginBottom: 20,
                }}
              >
                ···
              </div>
            ) : (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 48,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  color: "var(--fg-primary)",
                  marginBottom: 20,
                }}
              >
                {code ?? "——"}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <button
                className="oc-btn oc-btn-primary"
                onClick={copyCode}
                disabled={!code}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy code"}
              </button>
              <button
                className="oc-btn oc-btn-secondary"
                onClick={() => generateCode(platform)}
                disabled={loading}
                title="Generate new code"
                aria-label="Generate new code"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {timeLeft > 0 && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-dim)",
                  letterSpacing: "0.06em",
                }}
              >
                expires in {minutes}:{String(seconds).padStart(2, "0")}
              </div>
            )}
          </div>

          {/* Two-column footer: instructions left, demo seed right.
              Stacks vertically on narrow viewports via flex-wrap. */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div style={{ flex: "1 1 360px", minWidth: 0 }}>
              {/* Instructions */}
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "16px 20px",
                  height: "100%",
                }}
              >
                <div style={sectionLabelStyle}>How to connect</div>
                <ol
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {steps.map((step, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        fontSize: 13,
                        color: "var(--fg-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={stepNumberStyle}>{i + 1}</span>
                      <span style={{ minWidth: 0, wordBreak: "break-word" }}>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div style={{ flex: "1 1 280px", minWidth: 0 }}>
              {/* Demo seed (parachute for live demos) */}
              <div
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "16px 20px",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={sectionLabelStyle}>Demo mode</div>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--fg-secondary)",
                    lineHeight: 1.5,
                    marginTop: 0,
                    marginBottom: 12,
                    flex: 1,
                  }}
                >
                  Seed a high-quality lead, score, drafted pitch, and Lighthouse
                  audit for a guaranteed-working live demo. Replaces any prior
                  seed. <strong style={{ color: "var(--fg-primary)" }}>Clear</strong> wipes the demo lead so it doesn&apos;t
                  mix with your real inbox.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="oc-btn oc-btn-secondary"
                    onClick={handleSeedDemo}
                    disabled={seeding || clearing}
                    style={{ flex: 1, justifyContent: "center" }}
                  >
                    <Zap size={13} strokeWidth={1.5} />
                    {seeding ? "Seeding..." : "Seed demo data"}
                  </button>
                  <button
                    className="oc-btn oc-btn-ghost"
                    onClick={handleClearDemo}
                    disabled={clearing || seeding}
                    title="Remove the demo lead, pitch, and proof so it doesn't mix with real leads."
                    aria-label="Clear demo data"
                    style={{
                      paddingLeft: 14,
                      paddingRight: 14,
                      color: "var(--fg-secondary)",
                    }}
                  >
                    <Trash2 size={13} strokeWidth={1.5} />
                    {clearing ? "Clearing..." : "Clear"}
                  </button>
                </div>
                {seedError && (
                  <div
                    style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}
                  >
                    {seedError}
                  </div>
                )}
                {clearMsg && !seedError && (
                  <div
                    style={{
                      color: "var(--fg-secondary)",
                      fontSize: 12,
                      marginTop: 8,
                    }}
                  >
                    {clearMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const inlineCodeStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  color: "var(--brand-coral)",
  fontSize: 12,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--fg-secondary)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 12,
  fontFamily: "var(--font-mono)",
};

const stepNumberStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--fg-dim)",
  background: "var(--bg-card)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 4,
  width: 20,
  height: 20,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  marginTop: 1,
};
