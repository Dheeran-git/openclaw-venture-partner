"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ExternalLink,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Wrench,
  BookOpen,
} from "lucide-react";
import { Sidebar } from "../../components/Sidebar";
import { useSession } from "../../lib/auth";

interface StatusResponse {
  configured: boolean;
  gateway_url: string | null;
  control_ui_url: string | null;
  health: "ok" | "unreachable" | "unknown";
  latency_ms: number | null;
  error: string | null;
}

interface SkillSpec {
  name: string;
  triggers: string[];
  blurb: string;
}

const SKILLS: SkillSpec[] = [
  {
    name: "scout",
    triggers: ["find leads for {query}", "scout {query}"],
    blurb: "Trigger a multi-source scrape across Upwork, LinkedIn, Reddit, Indeed, Contra, Freelancer.",
  },
  {
    name: "draft_pitch",
    triggers: ["draft pitch for {target}", "write outreach"],
    blurb: "Stream a personalized pitch with proof-of-value attached. Human approval before send.",
  },
  {
    name: "approve_pitch",
    triggers: ["approve {pitch}", "send it"],
    blurb: "HMAC-verified, payload-hash-gated approval that releases the email through Resend.",
  },
  {
    name: "reject_pitch",
    triggers: ["reject {pitch}", "skip this"],
    blurb: "Reject a drafted pitch with optional feedback note that flows into client_memory.",
  },
  {
    name: "show_top_lead",
    triggers: ["show top lead", "what's hot"],
    blurb: "Surface the highest-scoring un-actioned lead with score, signals, and reasoning.",
  },
  {
    name: "client_memory",
    triggers: ["client {name}", "what do we know about {client}"],
    blurb: "Read the running memory_md for an existing client — past pitches, preferences, signals.",
  },
  {
    name: "reply_to_email",
    triggers: ["reply to {client}", "draft reply"],
    blurb: "Classify an inbound reply and draft 3 tone-variant responses for human selection.",
  },
  {
    name: "lighthouse_audit",
    triggers: ["audit {url}", "run lighthouse on {url}"],
    blurb: "Run PageSpeed Insights and attach the result as a proof artifact to a pitch.",
  },
  {
    name: "help",
    triggers: ["help", "what can you do"],
    blurb: "List capabilities and current state — onboarding fallback for unrecognized prompts.",
  },
];

const MCP_TOOLS = [
  "runScout",
  "getRecentLeads",
  "getTopLead",
  "draftPitch",
  "approvePitch",
  "rejectPitch",
  "editPitch",
  "getPendingPitches",
  "bindTelegram",
  "bindDiscord",
  "notifyAgent",
];

export default function AgentPage() {
  const session = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session === null) router.replace("/auth/login");
  }, [session, router]);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/openclaw/status")
      .then((r) => r.json())
      .then((j: StatusResponse) => {
        if (!cancelled) {
          setStatus(j);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus({
          configured: false,
          gateway_url: null,
          control_ui_url: null,
          health: "unreachable",
          latency_ms: null,
          error: err.message,
        });
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

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

  const isConnected = status?.configured && status.health === "ok";
  const controlUrl = status?.control_ui_url;

  return (
    <div className="oc-app" style={{ gridTemplateColumns: "256px 1fr" }}>
      <Sidebar {...userMeta} initialActive="agent" />

      <main className="oc-main">
        <div
          style={{
            padding: "32px 32px 48px",
            maxWidth: 920,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Personal AI Substrate
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginBottom: 6 }}>
              Your OpenClaw Agent
            </h1>
            <p style={{ color: "var(--fg-secondary)", lineHeight: 1.55, margin: 0, maxWidth: 680 }}>
              The dashboard you&apos;re in is one face of the agent. The other face — the conversational
              one — runs on an OpenClaw Gateway: a long-running personal-AI process that ingests our
              Skills, dispatches them against natural-language prompts, and calls back into this app
              via the MCP server for every tool execution.
            </p>
          </div>

          <StatusCard status={status} loading={loading} controlUrl={controlUrl ?? null} />

          <SectionHeader icon={BookOpen} title="Skills deployed to the Gateway" />
          <div style={{ display: "grid", gap: 8, marginBottom: 32 }}>
            {SKILLS.map((s) => (
              <SkillRow key={s.name} skill={s} />
            ))}
          </div>

          <SectionHeader icon={Wrench} title="MCP tools the Gateway can call" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 6,
              marginBottom: 32,
            }}
          >
            {MCP_TOOLS.map((t) => (
              <code
                key={t}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--fg-primary)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  padding: "6px 10px",
                  borderRadius: 6,
                }}
              >
                {t}
              </code>
            ))}
          </div>

          <SectionHeader icon={Activity} title="Architecture at runtime" />
          <ArchDiagram isConnected={!!isConnected} />
        </div>
      </main>
    </div>
  );
}

function StatusCard({
  status,
  loading,
  controlUrl,
}: {
  status: StatusResponse | null;
  loading: boolean;
  controlUrl: string | null;
}) {
  if (loading || !status) {
    return (
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
          color: "var(--fg-dim)",
        }}
      >
        Checking Gateway…
      </div>
    );
  }

  const ok = status.configured && status.health === "ok";
  const accent = ok ? "#10B981" : status.configured ? "#F59E0B" : "#FF4D4D";
  const ToneIcon = ok ? CheckCircle2 : AlertTriangle;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${accent}55`,
        borderRadius: 12,
        padding: 20,
        marginBottom: 32,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: accent + "1A",
            border: `1px solid ${accent}55`,
            display: "grid",
            placeItems: "center",
            color: accent,
          }}
        >
          <ToneIcon size={18} strokeWidth={1.75} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {ok
              ? "Gateway connected"
              : status.configured
                ? "Gateway configured but unreachable"
                : "Gateway not configured"}
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-dim)", marginTop: 2 }}>
            {ok && status.gateway_url ? (
              <>
                <code style={{ fontFamily: "var(--font-mono)" }}>{status.gateway_url}</code>
                {status.latency_ms !== null && ` · ${status.latency_ms}ms`}
              </>
            ) : status.error ? (
              status.error
            ) : (
              "Set OPENCLAW_GATEWAY_URL in Vercel env to connect."
            )}
          </div>
        </div>
      </div>

      {ok && controlUrl ? (
        <a
          href={controlUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="oc-btn oc-btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <ExternalLink size={14} strokeWidth={1.75} />
          Open Control UI
        </a>
      ) : null}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof Sparkles;
  title: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
        marginTop: 8,
      }}
    >
      <Icon size={14} strokeWidth={1.75} style={{ color: "var(--fg-dim)" }} />
      <h2
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--fg-secondary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          margin: 0,
        }}
      >
        {title}
      </h2>
    </div>
  );
}

function SkillRow({ skill }: { skill: SkillSpec }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: 16,
        alignItems: "start",
      }}
    >
      <div>
        <code
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--brand-coral)",
            fontWeight: 600,
          }}
        >
          {skill.name}
        </code>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: "var(--fg-dim)",
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {skill.triggers.map((t) => (
            <div key={t}>&ldquo;{t}&rdquo;</div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", lineHeight: 1.55, paddingTop: 1 }}>
        {skill.blurb}
      </div>
    </div>
  );
}

function ArchDiagram({ isConnected }: { isConnected: boolean }) {
  const lineColor = isConnected ? "#10B981" : "#4A5268";
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "24px 20px",
        marginBottom: 32,
      }}
    >
      <pre
        style={{
          margin: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--fg-secondary)",
          lineHeight: 1.55,
          whiteSpace: "pre",
          overflowX: "auto",
        }}
      >{`  user @ Telegram / Discord / Web Control UI
              │
              ▼
  ┌──────────────────────────────────┐
  │   OpenClaw Gateway (Railway)     │   skills loaded:
  │   - matches user → skill         │   scout, draft_pitch,
  │   - calls our MCP for each tool  │   approve_pitch, ...
  └──────────────────────────────────┘
              │  HTTP JSON-RPC
              ▼
  ┌──────────────────────────────────┐
  │   /api/mcp  (this app, Vercel)   │   tools: runScout,
  │   - auth via MCP_SHARED_SECRET   │   draftPitch, approvePitch,
  │   - dispatches to Inngest        │   notifyAgent, ...
  └──────────────────────────────────┘
              │
              ▼
  ┌──────────────────────────────────┐
  │   Inngest workers + Supabase     │
  │   - Zyte multi-source scrape     │
  │   - LLM router + budget guard    │
  │   - Realtime → dashboard UI      │
  └──────────────────────────────────┘`}</pre>
      <div
        style={{
          marginTop: 16,
          fontSize: 11,
          color: "var(--fg-dim)",
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: lineColor }}>●</span> Gateway link is{" "}
        {isConnected ? "live" : "unconfigured / unreachable"}
      </div>
    </div>
  );
}
