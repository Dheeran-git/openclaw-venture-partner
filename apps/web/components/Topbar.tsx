"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { NotificationsBell } from "./NotificationsBell";
import { SearchBar } from "./SearchBar";

export function Topbar({
  title,
  subtitle,
  defaultQuery = "react next.js",
  onRunScout,
  running = false,
  userId,
}: {
  title: string;
  subtitle?: string;
  defaultQuery?: string;
  onRunScout?: (query: string) => void;
  running?: boolean;
  userId?: string;
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
        <SearchBar />
        <NotificationsBell userId={userId} />
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
          data-scout-query
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
