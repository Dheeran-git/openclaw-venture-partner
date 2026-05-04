"use client";

import { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { StatCards } from "../components/StatCards";
import { LeadTable } from "../components/LeadTable";
import { ActivityRail } from "../components/ActivityRail";
import { stats } from "../lib/fixtures";
import { useLeads } from "../hooks/useLeads";
import { useScoutActivity } from "../hooks/useScoutActivity";

export default function Page() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const { leads, loading } = useLeads();
  const { events, pushOptimistic } = useScoutActivity();

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
      <ActivityRail events={events} />
    </div>
  );
}
