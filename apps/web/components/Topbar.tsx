"use client";

import { Search, Bell } from "lucide-react";

export function Topbar({
  title,
  subtitle,
  onRunScout,
}: {
  title: string;
  subtitle?: string;
  onRunScout?: () => void;
}) {
  return (
    <div className="oc-topbar">
      <div>
        <h1 className="oc-h1">{title}</h1>
        {subtitle && <div className="oc-h1-sub">{subtitle}</div>}
      </div>
      <div className="oc-topbar-actions">
        <div className="oc-search">
          <Search size={14} strokeWidth={1.5} />
          <input
            placeholder="Search leads, clients, pitches"
            aria-label="Search"
          />
          <span className="oc-kbd">{"⌘"}K</span>
        </div>
        <button
          type="button"
          className="oc-btn oc-btn-ghost"
          aria-label="Notifications"
        >
          <Bell size={16} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className="oc-btn oc-btn-primary"
          onClick={onRunScout}
        >
          <Search size={14} strokeWidth={1.5} />
          Run scout
        </button>
      </div>
    </div>
  );
}
