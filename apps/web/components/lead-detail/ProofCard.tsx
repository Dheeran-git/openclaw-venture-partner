"use client";

import { useState } from "react";
import { Activity, Plus, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { useProofArtifacts, type LighthouseSummary } from "../../hooks/useProofArtifacts";

interface ProofCardProps {
  pitchId: string;
}

const SCORE_COLOR = (n: number): string => {
  if (n >= 90) return "#10B981";
  if (n >= 75) return "#3FAE6A";
  if (n >= 50) return "#D6B82A";
  return "#EF4444";
};

export function ProofCard({ pitchId }: ProofCardProps) {
  const { artifacts, loading } = useProofArtifacts(pitchId);
  const [adding, setAdding] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/pitches/${pitchId}/generate-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_url: targetUrl, artifact_type: "lighthouse" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Failed to start audit");
      }
      setAdding(false);
      setTargetUrl("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div className="oc-section-label" style={{ marginBottom: 8 }}>
        PROOF
      </div>

      {artifacts.length === 0 && !adding && (
        <button
          className="oc-btn oc-btn-secondary"
          onClick={() => setAdding(true)}
          style={{ width: "100%", justifyContent: "center" }}
        >
          <Activity size={13} strokeWidth={1.5} />
          Generate proof (Lighthouse audit)
        </button>
      )}

      {adding && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <label className="oc-meta" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Target URL
          </label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://yourcompany.com"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 13,
              color: "var(--fg-primary)",
              fontFamily: "var(--font-mono)",
            }}
            autoFocus
          />
          {error && (
            <div style={{ color: "#EF4444", fontSize: 12 }}>{error}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="oc-btn oc-btn-primary"
              onClick={handleSubmit}
              disabled={submitting || targetUrl.length === 0}
              style={{ flex: 1, justifyContent: "center" }}
            >
              {submitting ? "Starting..." : "Run audit"}
            </button>
            <button
              className="oc-btn oc-btn-ghost"
              onClick={() => {
                setAdding(false);
                setTargetUrl("");
                setError(null);
              }}
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: artifacts.length ? 0 : 8 }}>
        {artifacts.map((a) => {
          const isComplete = a.status === "complete";
          const isFailed = a.status === "failed";
          const meta = (a.metadata && typeof a.metadata === "object" ? (a.metadata as LighthouseSummary) : null);
          return (
            <div
              key={a.id}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Activity size={14} strokeWidth={1.5} style={{ color: "var(--brand-coral)", flexShrink: 0 }} />
                  <a
                    href={a.target_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="oc-mono"
                    style={{
                      fontSize: 12,
                      color: "var(--fg-primary)",
                      textDecoration: "none",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {a.target_url}
                  </a>
                </div>
                <StatusPill status={a.status} />
              </div>

              {isFailed && a.error && (
                <div style={{ color: "#EF4444", fontSize: 12 }}>{a.error}</div>
              )}

              {isComplete && meta && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    <ScoreTile label="Perf" value={meta.performance ?? 0} />
                    <ScoreTile label="A11y" value={meta.accessibility ?? 0} />
                    <ScoreTile label="BP" value={meta.best_practices ?? 0} />
                    <ScoreTile label="SEO" value={meta.seo ?? 0} />
                  </div>
                  {a.summary && (
                    <p style={{ fontSize: 12, color: "var(--fg-secondary)", margin: 0, lineHeight: 1.5 }}>
                      {a.summary}
                    </p>
                  )}
                  {meta.top_recommendations && meta.top_recommendations.length > 0 && (
                    <div
                      style={{
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 8,
                        overflow: "hidden",
                      }}
                    >
                      <button
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--fg-secondary)",
                          fontSize: 11,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                        onClick={() => setExpanded((e) => ({ ...e, [a.id]: !e[a.id] }))}
                      >
                        <span>Top recommendations ({meta.top_recommendations.length})</span>
                        {expanded[a.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </button>
                      {expanded[a.id] && (
                        <ul
                          style={{
                            margin: 0,
                            padding: "0 12px 12px 28px",
                            fontSize: 12,
                            color: "var(--fg-secondary)",
                            lineHeight: 1.65,
                            borderTop: "1px solid var(--border-subtle)",
                          }}
                        >
                          {meta.top_recommendations.map((r) => (
                            <li key={r.id}>
                              <strong style={{ color: "var(--fg-primary)" }}>{r.title}</strong>{" "}
                              <span style={{ color: SCORE_COLOR(r.impact === "high" ? 30 : r.impact === "medium" ? 60 : 80), fontSize: 10 }}>
                                · {r.impact} impact
                              </span>
                              <div style={{ marginTop: 2 }}>{r.description}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {artifacts.length > 0 && !adding && (
        <button
          className="oc-btn oc-btn-ghost"
          onClick={() => setAdding(true)}
          style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: 12 }}
        >
          <Plus size={12} strokeWidth={1.5} />
          Add another audit
        </button>
      )}
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  const color = SCORE_COLOR(value);
  return (
    <div
      style={{
        background: "var(--bg-base)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
        padding: "8px 10px",
        textAlign: "center",
      }}
    >
      <div className="oc-mono" style={{ fontSize: 18, fontWeight: 700, color }}>
        {value}
      </div>
      <div className="oc-meta" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "running" | "complete" | "failed" }) {
  const map = {
    pending: { color: "#8892AB", label: "Queued" },
    running: { color: "#00E5CC", label: "Running" },
    complete: { color: "#10B981", label: "Complete" },
    failed: { color: "#EF4444", label: "Failed" },
  } as const;
  const { color, label } = map[status];
  return (
    <span
      className="oc-pill"
      style={{
        color,
        background: color + "1A",
        borderColor: color + "55",
        fontSize: 11,
      }}
    >
      <span className={`oc-dot ${status === "running" ? "pulse" : ""}`} style={{ background: color }} />
      {label}
    </span>
  );
}
