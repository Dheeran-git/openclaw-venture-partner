"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, RefreshCw, Zap } from "lucide-react";
import { Sidebar } from "../../../components/Sidebar";
import { useSession } from "../../../lib/auth";

export default function ConnectPage() {
  const session = useSession();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  useEffect(() => {
    if (session === null) router.replace("/auth/login");
  }, [session, router]);

  const generateCode = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/generate-bind-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "telegram" }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { code: string; expires_at: string };
      setCode(data.code);
      setExpiresAt(new Date(data.expires_at));
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate code once session is ready
  useEffect(() => {
    if (session) generateCode();
  }, [session, generateCode]);

  // Countdown timer — auto-refresh when expired
  useEffect(() => {
    if (!expiresAt) return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) generateCode();
    }, 1000);
    return () => clearInterval(tick);
  }, [expiresAt, generateCode]);

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSeedDemo() {
    setSeedError(null);
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

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

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

  return (
    <div className="oc-app" style={{ gridTemplateColumns: "256px 1fr" }}>
      <Sidebar {...userMeta} initialActive="settings" />

      <main className="oc-main">
        <div
          style={{
            padding: "48px 24px",
            maxWidth: 480,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Settings / Connect
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
              Link Telegram
            </h1>
            <p style={{ color: "var(--fg-secondary)", lineHeight: 1.6 }}>
              Connect your Telegram account to receive pitch notifications and
              approve outreach from your phone — without opening the dashboard.
            </p>
          </div>

          {/* Code card */}
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-emphasis)",
              borderRadius: 12,
              padding: "32px 24px",
              textAlign: "center",
              marginBottom: 24,
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
                }}
              >
                ···
              </div>
            ) : (
              <>
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

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <button className="oc-btn oc-btn-primary" onClick={copyCode}>
                    {copied ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                    {copied ? "Copied" : "Copy code"}
                  </button>
                  <button
                    className="oc-btn oc-btn-secondary"
                    onClick={generateCode}
                    disabled={loading}
                    title="Generate new code"
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
              </>
            )}
          </div>

          {/* Demo seed (parachute for live demos) */}
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "16px 20px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--fg-secondary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 8,
                fontFamily: "var(--font-mono)",
              }}
            >
              Demo mode
            </div>
            <p style={{ fontSize: 13, color: "var(--fg-secondary)", lineHeight: 1.5, marginTop: 0, marginBottom: 12 }}>
              Seed a high-quality lead, score, drafted pitch, and Lighthouse audit
              for a guaranteed-working live demo. Replaces any prior seed.
            </p>
            <button
              className="oc-btn oc-btn-secondary"
              onClick={handleSeedDemo}
              disabled={seeding}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <Zap size={13} strokeWidth={1.5} />
              {seeding ? "Seeding..." : "Seed demo data"}
            </button>
            {seedError && (
              <div style={{ color: "#EF4444", fontSize: 12, marginTop: 8 }}>{seedError}</div>
            )}
          </div>

          {/* Instructions */}
          <div
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "16px 20px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--fg-secondary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: 12,
                fontFamily: "var(--font-mono)",
              }}
            >
              How to connect
            </div>
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
              {[
                <>
                  Open Telegram and find{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--brand-coral)",
                      fontSize: 12,
                    }}
                  >
                    {botUsername ? `@${botUsername}` : "your OpenClaw VP bot"}
                  </code>
                </>,
                <>
                  Send{" "}
                  <code
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--brand-coral)",
                      fontSize: 12,
                    }}
                  >
                    /start
                  </code>
                </>,
                "Type or paste your 6-digit code when prompted",
                "Done — you'll receive a confirmation message",
              ].map((step, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    fontSize: 13,
                    color: "var(--fg-secondary)",
                  }}
                >
                  <span
                    style={{
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
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </main>
    </div>
  );
}
