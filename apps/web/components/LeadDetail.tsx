"use client";

import { X, ExternalLink } from "lucide-react";
import { useLeadDetail } from "../hooks/useLeadDetail";
import { ageFromIso } from "../lib/leadAdapters";
import { SOURCE_DOT, SOURCE_LABEL, type LeadSource } from "../lib/fixtures";

export function LeadDetail({
  leadId,
  onClose,
}: {
  leadId: string;
  onClose: () => void;
}) {
  const { detail, loading } = useLeadDetail(leadId);

  if (loading && !detail) {
    return (
      <div className="oc-detail">
        <div className="oc-detail-head">
          <span className="oc-mono oc-meta">Loading...</span>
          <button className="oc-btn oc-btn-ghost" onClick={onClose}>
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const { normalized, layer, scraped_at, score } = detail;

  return (
    <div className="oc-detail">
      {/* Head: score badge + title/meta + close */}
      <div className="oc-detail-head">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <SmallScoreBadge score={score?.score ?? null} />
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "var(--fg-primary)",
                lineHeight: 1.3,
              }}
            >
              {normalized.title}
            </div>
            <div className="oc-meta oc-mono" style={{ marginTop: 2 }}>
              {detail.id.slice(0, 8)} · {normalized.budget_text ?? "—"} ·{" "}
              {ageFromIso(scraped_at)} ago
            </div>
          </div>
        </div>
        <button className="oc-btn oc-btn-ghost" onClick={onClose}>
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>

      {/* Tags row */}
      <div className="oc-detail-tags">
        <SourceBadge source={normalized.source} />
        <LayerTag layer={layer} />
        <StatusPill scored={score !== null} />
      </div>

      {/* Body */}
      <div className="oc-detail-body">
        {/* SCORING section */}
        <div className="oc-section-label">SCORING</div>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
              marginBottom: score?.signals?.length ? 12 : 0,
            }}
          >
            <span
              className="oc-mono"
              style={{
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1,
                color: scoreColor(score?.score ?? null),
                flexShrink: 0,
              }}
            >
              {score?.score ?? "—"}
            </span>
            <p
              style={{
                fontSize: 13,
                color: score
                  ? "var(--fg-primary)"
                  : "var(--fg-secondary)",
                lineHeight: 1.65,
                flex: 1,
                margin: 0,
              }}
            >
              {score?.reasoning ?? "Score is being computed..."}
            </p>
          </div>
          {score?.signals && score.signals.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                paddingTop: 12,
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              {score.signals.map((sig) => (
                <span
                  key={sig}
                  className="oc-tag"
                  style={{
                    color: "var(--fg-secondary)",
                    background: "var(--bg-hover)",
                    borderColor: "var(--border-emphasis)",
                  }}
                >
                  {sig}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* PITCH DRAFT placeholder — Phase 3 */}
        <div className="oc-section-label" style={{ marginTop: 24 }}>
          PITCH DRAFT
        </div>
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px dashed var(--border-subtle)",
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 12,
            color: "var(--fg-dim)",
          }}
        >
          Pitch drafting in Phase 3.
        </div>

        {/* SIGNAL section */}
        <div className="oc-section-label" style={{ marginTop: 24 }}>
          SIGNAL
        </div>
        <div className="oc-signal">
          <div className="oc-signal-row">
            <span className="oc-meta">Posted</span>
            <span className="oc-mono" style={{ fontSize: 12 }}>
              {ageFromIso(normalized.posted_at)} ago
            </span>
          </div>
          <div className="oc-signal-row">
            <span className="oc-meta">Source</span>
            <span>
              <SourceBadge source={normalized.source} />
            </span>
          </div>
          <div className="oc-signal-row">
            <span className="oc-meta">URL</span>
            <a
              href={normalized.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="oc-mono"
              style={{
                fontSize: 11,
                color: "var(--brand-coral)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <ExternalLink size={11} strokeWidth={1.5} />
              {normalized.source_url}
            </a>
          </div>
          {normalized.budget_text && (
            <div className="oc-signal-row">
              <span className="oc-meta">Budget</span>
              <span className="oc-mono" style={{ fontSize: 12 }}>
                {normalized.budget_text}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function scoreColor(score: number | null): string {
  if (score === null) return "var(--fg-secondary)";
  if (score >= 90) return "#10B981";
  if (score >= 80) return "#3FAE6A";
  if (score >= 70) return "#D6B82A";
  if (score >= 60) return "#A88F1F";
  return "#EF4444";
}

function SmallScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="oc-score oc-score-pending">···</span>;
  }
  let bg = "#7A1F1F";
  let fg = "#FFFFFF";
  if (score >= 90) {
    bg = "#10B981";
    fg = "#053026";
  } else if (score >= 80) {
    bg = "#3FAE6A";
    fg = "#062719";
  } else if (score >= 70) {
    bg = "#D6B82A";
    fg = "#2A2400";
  } else if (score >= 60) {
    bg = "#A88F1F";
    fg = "#1A1500";
  }
  return (
    <span className="oc-score" style={{ background: bg, color: fg }}>
      {score}
    </span>
  );
}

function SourceBadge({ source }: { source: LeadSource }) {
  return (
    <span className="oc-source">
      <span
        className="oc-dot"
        style={{ background: SOURCE_DOT[source] }}
      />
      {SOURCE_LABEL[source]}
    </span>
  );
}

function LayerTag({ layer }: { layer: 1 | 2 | 3 }) {
  const map = {
    1: { c: "#8892AB", bg: "#0E1424", b: "#2A3350" },
    2: { c: "#FF4D4D", bg: "rgba(255,77,77,0.10)", b: "rgba(255,77,77,0.30)" },
    3: { c: "#00E5CC", bg: "rgba(0,229,204,0.10)", b: "rgba(0,229,204,0.30)" },
  }[layer];
  return (
    <span
      className="oc-tag"
      style={{ color: map.c, background: map.bg, borderColor: map.b }}
    >
      L{layer}
    </span>
  );
}

function StatusPill({ scored }: { scored: boolean }) {
  const color = scored ? "#10B981" : "#00E5CC";
  const label = scored ? "Draft ready" : "Scoring";
  const live = !scored;
  return (
    <span
      className="oc-pill"
      style={{
        color,
        background: color + "1A",
        borderColor: color + "55",
      }}
    >
      <span
        className={`oc-dot ${live ? "pulse" : ""}`}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
