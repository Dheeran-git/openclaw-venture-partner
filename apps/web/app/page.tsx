"use client";

import { useState } from "react";
import { Sidebar } from "../components/Sidebar";
import { Topbar } from "../components/Topbar";
import { StatCards } from "../components/StatCards";
import { LeadTable } from "../components/LeadTable";
import { ActivityRail } from "../components/ActivityRail";
import { activity, leads, stats } from "../lib/fixtures";

export default function Page() {
  const [selectedId, setSelectedId] = useState<string | undefined>();

  return (
    <div className="oc-app">
      <Sidebar />
      <main className="oc-main">
        <Topbar
          title="Lead Inbox"
          subtitle={`${leads.length} leads queued · sorted by score`}
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
