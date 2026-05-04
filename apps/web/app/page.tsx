"use client";

import { useEffect, useRef, useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { StatCards } from "../components/StatCards";
import { LeadTable } from "../components/LeadTable";
import { ActivityRail } from "../components/ActivityRail";
import { LeadDetail } from "../components/LeadDetail";
import { stats } from "../lib/fixtures";
import { useLeads } from "../hooks/useLeads";
import { useScoutActivity } from "../hooks/useScoutActivity";

export default function Page() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const { leads, loading } = useLeads();
  const { events, pushOptimistic } = useScoutActivity();
  const hasAutoSelected = useRef(false);

  // Pre-select the highest-scored lead once leads first load.
  useEffect(() => {
    if (hasAutoSelected.current || leads.length === 0) return;
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
  }, [leads]);

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
        console.error(`/api/scout ${res.status}: ${err.error ?? "(no detail)"}`);
      }
    } catch (err) {
      console.error("/api/scout fetch failed:", (err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const subtitle = loading
    ? "Loading leads..."
    : `${leads.length} leads queued · sorted by score`;

  return (
    <div className="oc-app">
      <Sidebar />
      <main className="oc-main">
        <Topbar
          title="Lead Inbox"
          subtitle={subtitle}
          onRunScout={handleRunScout}
          running={running}
        />
        <div className="oc-content">
          <StatCards stats={stats} />
          <LeadTable
            leads={leads}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
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
    </div>
  );
}
