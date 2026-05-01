import { ArrowUp, ArrowDown } from "lucide-react";
import type { StatCard } from "../lib/fixtures";

export function StatCards({ stats }: { stats: StatCard[] }) {
  return (
    <div className="oc-stats">
      {stats.map((s) => (
        <div className="oc-stat" key={s.label}>
          <div className="oc-stat-label">{s.label}</div>
          <div className={`oc-stat-value ${s.accent ? "accent" : ""}`}>
            {s.value}
          </div>
          {s.delta && (
            <div className={`oc-stat-delta ${s.deltaPositive ? "pos" : "neg"}`}>
              {s.deltaPositive ? (
                <ArrowUp size={10} strokeWidth={2.5} />
              ) : (
                <ArrowDown size={10} strokeWidth={2.5} />
              )}
              {s.delta}
            </div>
          )}
          {s.sub && <div className="oc-stat-sub">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}
