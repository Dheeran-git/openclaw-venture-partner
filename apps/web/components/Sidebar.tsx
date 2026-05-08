"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Inbox,
  FileText,
  Users,
  Settings,
  LogOut,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getSupabaseBrowser } from "../lib/supabaseBrowser";
import { useRouter } from "next/navigation";

interface NavItem {
  id: string;
  icon: LucideIcon;
  label: string;
  count?: string;
  live?: boolean;
  future?: boolean;
  href?: string;
}

function buildPrimary(inboxCount: number, pitchesCount: number): NavItem[] {
  return [
    { id: "inbox", icon: Inbox, label: "Inbox", count: inboxCount > 0 ? String(inboxCount) : undefined, href: "/" },
    { id: "pitches", icon: FileText, label: "Pitches", count: pitchesCount > 0 ? String(pitchesCount) : undefined, href: "/pitches" },
    { id: "clients", icon: Users, label: "Clients", href: "/clients" },
  ];
}

const TOOLS: NavItem[] = [
  { id: "agent", icon: Sparkles, label: "Agent", href: "/agent" },
  { id: "settings", icon: Settings, label: "Settings", href: "/settings/connect" },
];

export function Sidebar({
  initialActive = "inbox",
  userInitials = "...",
  userName = "",
  userHandle = "",
  inboxCount = 0,
  pitchesCount = 0,
}: {
  initialActive?: string;
  userInitials?: string;
  userName?: string;
  userHandle?: string;
  inboxCount?: number;
  pitchesCount?: number;
}) {
  const [active, setActive] = useState(initialActive);
  const router = useRouter();
  const primary = buildPrimary(inboxCount, pitchesCount);

  async function handleSignOut() {
    await getSupabaseBrowser().auth.signOut();
    router.push("/auth/login");
  }

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
        {primary.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={active === item.id}
            onClick={() => {
              setActive(item.id);
              if (item.href) router.push(item.href as never);
            }}
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
            onClick={() => {
              setActive(item.id);
              if (item.href) router.push(item.href as never);
            }}
          />
        ))}
      </div>

      <div className="oc-sidebar-foot">
        <div className="oc-avatar">{userInitials}</div>
        <div className="flex-1 min-w-0">
          <div className="oc-foot-text-name">{userName}</div>
          <div className="oc-foot-text-handle truncate">{userHandle}</div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          title="Sign out"
          className="oc-btn oc-btn-ghost p-1 h-auto text-fg-dim hover:text-fg-secondary"
        >
          <LogOut size={14} />
        </button>
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
      className={`oc-nav-item ${active ? "active" : ""} ${item.future ? "future" : ""}`}
      onClick={item.future ? undefined : onClick}
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
