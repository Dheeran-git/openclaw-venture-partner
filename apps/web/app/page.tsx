"use client";

import { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { StatCards } from "../components/StatCards";
import { LeadTable } from "../components/LeadTable";
import { ActivityRail } from "../components/ActivityRail";
import {
  activity as initialActivity,
  leads,
  stats,
  type ActivityEvent,
} from "../lib/fixtures";

export default function Page() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [running, setRunning] = useState(false);
  const [activity, setActivity] =
    useState<ActivityEvent[]>(initialActivity);

  async function handleRunScout(query: string) {
    if (running) return;
    setRunning(true);
    setActivity((prev) => [
      { kind: "live", text: `Scouting "${query}"...`, meta: "now" },
      ...prev,
    ]);

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

  return (
    <div className="oc-app">
      <Sidebar />
      <main className="oc-main">
        <Topbar
          title="Lead Inbox"
          subtitle={`${leads.length} leads queued · sorted by score`}
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
      <ActivityRail events={activity} />
    </div>
  );
}
