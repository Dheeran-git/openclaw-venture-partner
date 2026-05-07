"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, ChevronRight, Compass } from "lucide-react";
import {
  SOURCE_DOT,
  SOURCE_LABEL,
  type LeadRow,
  type LeadStatus,
} from "../lib/fixtures";
import { ageFromIso } from "../lib/leadAdapters";

type SortKey = "score" | "title" | "age";

export function LeadTable({
  leads,
  loading = false,
  selectedId,
  onSelect,
}: {
  leads: LeadRow[];
  loading?: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  if (!loading && leads.length === 0) {
    return <EmptyState />;
  }

  const sorted = [...leads].sort((a, b) => {
    const cmp = compare(a, b, sortKey);
    return cmp * (sortDir === "asc" ? 1 : -1);
  });

  function toggleSort(col: SortKey) {
    if (sortKey === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(col);
      setSortDir("desc");
    }
  }

  return (
    <div className="oc-table">
      <div className="oc-thead">
        <div>
          <input
            type="checkbox"
            className="oc-cb-input"
            aria-label="Select all"
          />
        </div>
        <SortHeader
          col="score"
          label="Score"
          sortKey={sortKey}
          sortDir={sortDir}
          onClick={() => toggleSort("score")}
        />
        <SortHeader
          col="title"
          label="Lead"
          sortKey={sortKey}
          sortDir={sortDir}
          onClick={() => toggleSort("title")}
        />
        <div className="oc-th">Source</div>
        <div className="oc-th">Layer</div>
        <SortHeader
          col="age"
          label="Age"
          sortKey={sortKey}
          sortDir={sortDir}
          onClick={() => toggleSort("age")}
        />
        <div className="oc-th">Status</div>
        <div className="oc-th" aria-hidden />
      </div>

      <div className="oc-tbody">
        {sorted.map((lead) => (
          <button
            type="button"
            key={lead.id}
            className={`oc-tr ${selectedId === lead.id ? "selected" : ""}`}
            onClick={() => onSelect(lead.id)}
          >
            <span onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                className="oc-cb-input"
                aria-label={`Select ${lead.id}`}
              />
            </span>
            <span>
              <ScoreBadge score={lead.score} />
            </span>
            <span className="oc-lead-title">
              <span className="oc-lead-name">{lead.title}</span>
              <span className="oc-lead-meta">
                <span className="oc-mono">{lead.id.slice(0, 8)}</span>
                {" · "}
                {lead.budget}
              </span>
            </span>
            <span>
              <SourceBadge source={lead.source} />
            </span>
            <span>
              <LayerTag layer={lead.layer} />
            </span>
            <span className="oc-mono oc-meta">
              {ageFromIso(lead.scraped_at)} ago
            </span>
            <span>
              <StatusPill status={lead.status} />
            </span>
            <span aria-hidden>
              <ChevronRight size={14} strokeWidth={1.5} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  function focusScoutInput() {
    if (typeof document === "undefined") return;
    const el = document.querySelector<HTMLInputElement>(
      "[data-scout-query]"
    );
    if (el) {
      el.focus();
      el.select();
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        padding: "64px 24px",
        background: "var(--bg-card)",
        border: "1px dashed var(--border-subtle)",
        borderRadius: 12,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          background: "rgba(255,77,77,0.10)",
          border: "1px solid rgba(255,77,77,0.30)",
          display: "grid",
          placeItems: "center",
          color: "var(--brand-coral)",
        }}
      >
        <Compass size={20} strokeWidth={1.5} />
      </div>
      <div
        className="eyebrow"
        style={{ fontSize: 11, color: "var(--fg-dim)", letterSpacing: "0.08em" }}
      >
        no leads yet
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
        Run your first scout
      </h2>
      <p
        style={{
          color: "var(--fg-secondary)",
          fontSize: 13,
          lineHeight: 1.55,
          maxWidth: 420,
          margin: 0,
        }}
      >
        Scout pulls real freelance leads from Upwork, LinkedIn, Indeed,
        Reddit, Contra, and Freelancer in parallel, scores each one against
        your profile, and auto-drafts pitches for the strongest matches.
      </p>
      <button
        type="button"
        onClick={focusScoutInput}
        className="oc-btn oc-btn-primary"
        style={{ marginTop: 4 }}
      >
        Pick a query
      </button>
    </div>
  );
}

function compare(a: LeadRow, b: LeadRow, key: SortKey): number {
  if (key === "score") {
    if (a.score === null && b.score === null) return 0;
    if (a.score === null) return -1; // pending sorts last in desc, first in asc
    if (b.score === null) return 1;
    return a.score - b.score;
  }
  if (key === "age") {
    // age ascending = oldest first; ISO string ascending = oldest first
    return a.scraped_at < b.scraped_at ? -1 : a.scraped_at > b.scraped_at ? 1 : 0;
  }
  // title
  return a.title.localeCompare(b.title);
}

function SortHeader({
  col,
  label,
  sortKey,
  sortDir,
  onClick,
}: {
  col: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onClick: () => void;
}) {
  const active = sortKey === col;
  return (
    <button type="button" className="oc-th" onClick={onClick}>
      {label}
      {active &&
        (sortDir === "asc" ? (
          <ArrowUp size={10} strokeWidth={2.5} />
        ) : (
          <ArrowDown size={10} strokeWidth={2.5} />
        ))}
    </button>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
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
  } else if (score >= 1) {
    bg = "#7A1F1F";
    fg = "#FFFFFF";
  } else {
    bg = "#1E2538";
    fg = "#8892AB";
  }
  return (
    <span className="oc-score" style={{ background: bg, color: fg }}>
      {score || "—"}
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

const STATUS_MAP: Record<
  LeadStatus,
  { c: string; l: string; live?: boolean }
> = {
  "draft-ready": { c: "#10B981", l: "Draft ready" },
  drafting: { c: "#00E5CC", l: "Drafting", live: true },
  scouting: { c: "#00E5CC", l: "Scouting", live: true },
  approved: { c: "#10B981", l: "Approved" },
  sent: { c: "#10B981", l: "Sent" },
  rejected: { c: "#EF4444", l: "Rejected" },
  archived: { c: "#4A5268", l: "Archived" },
  snoozed: { c: "#F59E0B", l: "Snoozed" },
  pending: { c: "#3B82F6", l: "Pending" },
};

function StatusPill({ status }: { status: LeadStatus }) {
  const m = STATUS_MAP[status];
  return (
    <span
      className="oc-pill"
      style={{
        color: m.c,
        background: m.c + "1A",
        borderColor: m.c + "55",
      }}
    >
      <span
        className={`oc-dot ${m.live ? "pulse" : ""}`}
        style={{ background: m.c }}
      />
      {m.l}
    </span>
  );
}

function SourceBadge({
  source,
}: {
  source: keyof typeof SOURCE_LABEL;
}) {
  return (
    <span className="oc-source">
      <span className="oc-dot" style={{ background: SOURCE_DOT[source] }} />
      {SOURCE_LABEL[source]}
    </span>
  );
}
