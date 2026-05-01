"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Inbox,
  Search,
  FileText,
  Users,
  LayoutGrid,
  Settings,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  count?: string;
  live?: boolean;
}

const PRIMARY: NavItem[] = [
  { id: "inbox", icon: Inbox, label: "Inbox", count: "12" },
  { id: "scout", icon: Search, label: "Scout", count: "running", live: true },
  { id: "pitches", icon: FileText, label: "Pitches", count: "42" },
  { id: "clients", icon: Users, label: "Clients", count: "8" },
];

const TOOLS: NavItem[] = [
  { id: "templates", icon: LayoutGrid, label: "Templates" },
  { id: "settings", icon: Settings, label: "Settings" },
];

export function Sidebar({
  initialActive = "inbox",
  userInitials = "AP",
  userName = "Anya Petrov",
  userHandle = "freelance.anya",
}: {
  initialActive?: string;
  userInitials?: string;
  userName?: string;
  userHandle?: string;
}) {
  const [active, setActive] = useState(initialActive);

  return (
    <aside className="oc-sidebar">
      <div className="oc-brand">
        <Image
          src="/assets/openclaw-mark-flat.svg"
          alt=""
          width={24}
          height={24}
          priority
        />
        <div>
          <div className="oc-brand-name">OpenClaw</div>
          <div className="oc-brand-sub">Venture Partner</div>
        </div>
      </div>

      <div className="oc-nav-section">
        {PRIMARY.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={active === item.id}
            onClick={() => setActive(item.id)}
          />
        ))}
      </div>

      <div className="oc-nav-heading">Workspace</div>
      <div className="oc-nav-section">
        {TOOLS.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={active === item.id}
            onClick={() => setActive(item.id)}
          />
        ))}
      </div>

      <div className="oc-sidebar-foot">
        <div className="oc-avatar">{userInitials}</div>
        <div>
          <div className="oc-foot-text-name">{userName}</div>
          <div className="oc-foot-text-handle">{userHandle}</div>
        </div>
      </div>
    </aside>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const { icon: Icon } = item;
  return (
    <button
      type="button"
      className={`oc-nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <Icon size={16} strokeWidth={1.5} />
      <span>{item.label}</span>
      {item.count && (
        <span className={`oc-nav-count ${item.live ? "live" : ""}`}>
          {item.live && <span className="oc-pulse-dot" />}
          {item.count}
        </span>
      )}
    </button>
  );
}
