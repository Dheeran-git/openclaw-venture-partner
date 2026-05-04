"use client";

import { useState } from "react";
import { Search, Bell } from "lucide-react";

export function Topbar({
  title,
  subtitle,
  defaultQuery = "react next.js",
  onRunScout,
  running = false,
}: {
  title: string;
  subtitle?: string;
  defaultQuery?: string;
  onRunScout?: (query: string) => void;
  running?: boolean;
}) {
  const [query, setQuery] = useState(defaultQuery);
  const trimmed = query.trim();
  const canSubmit = !running && trimmed.length >= 2;

  function submit() {
    if (!canSubmit) return;
    onRunScout?.(trimmed);
  }

  return (
    <div className="oc-topbar">
      <div>
        <h1 className="oc-h1">{title}</h1>
        {subtitle && <div className="oc-h1-sub">{subtitle}</div>}
      </div>
      <div className="oc-topbar-actions">
        <div className="oc-search" style={{ opacity: 0.45, pointerEvents: "none", cursor: "default" }}>
          <Search size={14} strokeWidth={1.5} />
          <input
            placeholder="Search leads, clients, pitches"
            aria-label="Search"
            readOnly
            tabIndex={-1}
          />
        </div>
        <button
          type="button"
          className="oc-btn oc-btn-ghost"
          aria-label="Notifications"
          style={{ opacity: 0.45, pointerEvents: "none" }}
          tabIndex={-1}
        >
          <Bell size={16} strokeWidth={1.5} />
        </button>
        <input
          className="oc-query"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="react next.js"
          aria-label="Scout query"
          spellCheck={false}
          disabled={running}
        />
        <button
          type="button"
          className="oc-btn oc-btn-primary"
          onClick={submit}
          disabled={!canSubmit}
        >
          <Search size={14} strokeWidth={1.5} />
          {running ? "Running..." : "Run scout"}
        </button>
      </div>
    </div>
  );
}
