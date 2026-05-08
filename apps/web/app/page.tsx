"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { StatCards } from "../components/StatCards";
import { LeadTable } from "../components/LeadTable";
import { ActivityRail } from "../components/ActivityRail";
import { LeadDetail } from "../components/LeadDetail";
import { ToastStack, pushToast } from "../components/ToastStack";
import type { StatCard } from "../lib/fixtures";
import { useLeads } from "../hooks/useLeads";
import { useScoutActivity } from "../hooks/useScoutActivity";
import { useStats } from "../hooks/useStats";
import { useSession } from "../lib/auth";

export default function Page() {
  const session = useSession();
  const [leadParam, setLeadParam] = useState<string | undefined>();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const { leads, loading } = useLeads(session?.user.id);
  const { events, pushOptimistic } = useScoutActivity(session?.user.id);
  const { leadsQueued, pitchesSent, hoursSaved } = useStats(session?.user.id);

  const liveStats: StatCard[] = [
    { label: "Leads queued", value: String(leadsQueued) },
    { label: "Pitches sent", value: String(pitchesSent) },
    { label: "Reply rate", value: "—" },
    {
      label: "Hours saved",
      value: hoursSaved > 0 ? `${hoursSaved}h` : "—",
      accent: true,
    },
  ];
  const hasAutoSelected = useRef(false);

  // Read ?lead=<id> on mount (client-side only — avoids the static-prerender
  // Suspense requirement of useSearchParams). When present, jump straight
  // to that lead's detail panel and skip the highest-score auto-select.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const param = new URLSearchParams(window.location.search).get("lead");
    if (param) {
      setLeadParam(param);
      setSelectedId(param);
      hasAutoSelected.current = true;
    }
  }, []);

  // Pre-select the highest-scored lead once leads first load,
  // unless a ?lead=... query param already provided one.
  useEffect(() => {
    if (hasAutoSelected.current || leads.length === 0) return;
    if (leadParam) {
      hasAutoSelected.current = true;
      return;
    }
    const best = leads.reduce<(typeof leads)[0] | null>((acc, l) => {
      if (acc === null) return l;
      if (l.score === null) return acc;
      if (acc.score === null) return l;
      return l.score > acc.score ? l : acc;
    }, null);
    if (best) {
      setSelectedId(best.id);
      hasAutoSelected.current = true;
    }
  }, [leads, leadParam]);

  async function handleRunScout(query: string) {
    if (running) return;
    setRunning(true);
    pushOptimistic({
      kind: "live",
      text: `Scouting "${query}"...`,
      meta: "now",
    });

    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const detail = err.error ?? `HTTP ${res.status}`;
        pushToast(`Couldn't run scout: ${detail}`, "error");
        return;
      }
      pushToast(`Scouting "${query}" — leads will appear shortly.`, "info");
    } catch (err) {
      pushToast(`Scout request failed: ${(err as Error).message}`, "error");
    } finally {
      setRunning(false);
    }
  }

  // Surface the pipeline's terminal "Scout complete" broadcast as a
  // success toast. We can't dedup by timestamp (ActivityEvent has none),
  // so we dedup by object identity — each new broadcast creates a fresh
  // event reference that pops to events[0].
  const lastToastedEventRef = useRef<unknown>(null);
  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[0];
    if (!latest) return;
    if (lastToastedEventRef.current === latest) return;
    if (latest.kind === "ok" && latest.text.startsWith("Scout complete")) {
      lastToastedEventRef.current = latest;
      pushToast(latest.text, "success");
    }
  }, [events]);

  const subtitle = loading
    ? "Loading leads..."
    : `${leads.length} leads queued · sorted by score`;

  const userMeta = session?.user
    ? {
        userName: session.user.user_metadata?.full_name as string | undefined
          ?? session.user.email?.split("@")[0]
          ?? "You",
        userHandle: session.user.email ?? "",
        userInitials: (
          session.user.user_metadata?.full_name as string | undefined
            ?? session.user.email ?? "?"
        ).slice(0, 2).toUpperCase(),
      }
    : undefined;

  return (
    <div className="oc-app">
      <Sidebar {...userMeta} inboxCount={leadsQueued} pitchesCount={pitchesSent} />
      <main className="oc-main">
        <Topbar
          title="Lead Inbox"
          subtitle={subtitle}
          onRunScout={handleRunScout}
          running={running}
          userId={session?.user.id}
        />
        <div className="oc-content">
          <StatCards stats={liveStats} />
          {/* Belt-and-suspenders scroll: oc-content's overflow chain
              should already handle long lists, but on shorter viewports
              the StatCards push the table past the fold without engaging
              scroll. Wrap the table in its own flex:1 + overflow:auto
              container so the table body scrolls reliably while the
              StatCards stay pinned at the top of the content area. */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              minHeight: 0,
            }}
          >
            <LeadTable
              leads={leads}
              loading={loading}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </div>
      </main>
      {selectedId ? (
        <LeadDetail
          leadId={selectedId}
          onClose={() => setSelectedId(undefined)}
        />
      ) : (
        <ActivityRail events={events} />
      )}
      <ToastStack />
    </div>
  );
}
