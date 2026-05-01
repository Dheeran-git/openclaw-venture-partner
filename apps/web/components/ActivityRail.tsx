import type { ActivityEvent } from "../lib/fixtures";

export function ActivityRail({ events }: { events: ActivityEvent[] }) {
  return (
    <aside className="oc-rail">
      <div className="oc-rail-head">
        <span
          className="oc-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--fg-secondary)",
          }}
        >
          Activity
        </span>
      </div>
      <div className="oc-tl">
        {events.map((e, i) => (
          <div key={i} className={`oc-ev ${kindClass(e.kind)}`}>
            <div className="oc-ev-text">{e.text}</div>
            <div className="oc-ev-meta">{e.meta}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

function kindClass(kind: ActivityEvent["kind"]) {
  switch (kind) {
    case "live":
      return "oc-ev-live";
    case "ok":
      return "oc-ev-ok";
    case "warn":
      return "oc-ev-warn";
    default:
      return "";
  }
}
