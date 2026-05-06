"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, FileText, Inbox, Users } from "lucide-react";
import type { SearchHit } from "../app/api/search/route";

const TYPE_ICON = {
  lead: Inbox,
  pitch: FileText,
  client: Users,
} as const;

const TYPE_LABEL: Record<SearchHit["type"], string> = {
  lead: "Lead",
  pitch: "Pitch",
  client: "Client",
};

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: ac.signal,
        });
        const json = (await res.json().catch(() => ({}))) as { hits?: SearchHit[] };
        setHits(json.hits ?? []);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(handle);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      return () => document.removeEventListener("mousedown", onDoc);
    }
    return undefined;
  }, [open]);

  // ⌘K shortcut to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        wrapRef.current?.querySelector("input")?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div className="oc-search">
        <Search size={14} strokeWidth={1.5} />
        <input
          placeholder="Search leads, clients, pitches"
          aria-label="Search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <kbd
          aria-hidden
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--fg-dim)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          ⌘K
        </kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            minWidth: 360,
            maxHeight: 480,
            overflowY: "auto",
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
            zIndex: 50,
          }}
        >
          {loading && hits.length === 0 && (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--fg-dim)", fontSize: 12 }}>
              Searching…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--fg-dim)", fontSize: 12 }}>
              No matches.
            </div>
          )}
          {hits.map((h) => {
            const Icon = TYPE_ICON[h.type];
            return (
              <Link
                key={`${h.type}:${h.id}`}
                href={h.href as never}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 14px",
                  borderBottom: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <Icon size={14} strokeWidth={1.5} style={{ color: "var(--fg-secondary)", marginTop: 2 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      className="oc-mono oc-meta"
                      style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}
                    >
                      {TYPE_LABEL[h.type]}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: "var(--fg-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h.title}
                    </span>
                  </div>
                  {h.excerpt && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--fg-secondary)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h.excerpt}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
