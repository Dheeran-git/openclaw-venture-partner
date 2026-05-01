const SOURCE_DOTS = {
  upwork: "#14A800", linkedin: "#0A66C2", contra: "#F4B400",
  reddit: "#FF4500", x: "#1DA1F2", github: "#F0F4FF",
};
const SOURCE_LABEL = { upwork: "Upwork", linkedin: "LinkedIn", contra: "Contra", reddit: "Reddit", x: "X", github: "GitHub" };

const ScoreBadge = ({ score }) => {
  let bg = "#7A1F1F", fg = "#FFFFFF";
  if (score >= 90) { bg = "#10B981"; fg = "#053026"; }
  else if (score >= 80) { bg = "#3FAE6A"; fg = "#062719"; }
  else if (score >= 70) { bg = "#D6B82A"; fg = "#2A2400"; }
  else if (score >= 60) { bg = "#A88F1F"; fg = "#1A1500"; }
  else if (score >= 1)  { bg = "#7A1F1F"; fg = "#FFFFFF"; }
  else { bg = "#1E2538"; fg = "#8892AB"; } // archived
  return <span className="oc-score" style={{background: bg, color: fg}}>{score || "—"}</span>;
};
window.ScoreBadge = ScoreBadge;

const LayerTag = ({ layer }) => {
  const map = {
    1: { c: "#8892AB", bg: "#0E1424", b: "#2A3350" },
    2: { c: "#FF4D4D", bg: "rgba(255,77,77,0.10)", b: "rgba(255,77,77,0.30)" },
    3: { c: "#00E5CC", bg: "rgba(0,229,204,0.10)", b: "rgba(0,229,204,0.30)" },
  }[layer];
  return <span className="oc-tag" style={{color: map.c, background: map.bg, borderColor: map.b}}>L{layer}</span>;
};
window.LayerTag = LayerTag;

const StatusPill = ({ status }) => {
  const m = {
    "draft-ready": { c: "#10B981", l: "Draft ready" },
    "drafting":    { c: "#00E5CC", l: "Drafting", live: true },
    "scouting":    { c: "#00E5CC", l: "Scouting", live: true },
    "approved":    { c: "#10B981", l: "Approved" },
    "sent":        { c: "#10B981", l: "Sent" },
    "rejected":    { c: "#EF4444", l: "Rejected" },
    "archived":    { c: "#4A5268", l: "Archived" },
    "snoozed":     { c: "#F59E0B", l: "Snoozed" },
    "pending":     { c: "#3B82F6", l: "Pending" },
  }[status] || { c: "#8892AB", l: status };
  return (
    <span className="oc-pill" style={{color: m.c, background: m.c + "1A", borderColor: m.c + "55"}}>
      <span className={`oc-dot ${m.live ? "pulse" : ""}`} style={{background: m.c}}/>
      {m.l}
    </span>
  );
};
window.StatusPill = StatusPill;

const SourceBadge = ({ source }) => (
  <span className="oc-source">
    <span className="oc-dot" style={{background: SOURCE_DOTS[source]}}/>
    {SOURCE_LABEL[source]}
  </span>
);
window.SourceBadge = SourceBadge;

const LeadTable = ({ leads, selected, onSelect }) => {
  const [sortKey, setSortKey] = React.useState("score");
  const [sortDir, setSortDir] = React.useState("desc");
  const sorted = [...leads].sort((a, b) => {
    const v = (a[sortKey] > b[sortKey] ? 1 : -1) * (sortDir === "asc" ? 1 : -1);
    return v;
  });
  const Header = ({ col, label, align }) => (
    <div className="oc-th" style={{textAlign: align}}
         onClick={() => { if (sortKey === col) setSortDir(sortDir==="asc"?"desc":"asc"); else { setSortKey(col); setSortDir("desc"); } }}>
      {label}
      {sortKey === col && (sortDir === "asc" ? <Icon.Up size={10} stroke={2.5}/> : <Icon.Down size={10} stroke={2.5}/>)}
    </div>
  );
  return (
    <div className="oc-table">
      <div className="oc-thead">
        <div><input type="checkbox" className="oc-cb-input"/></div>
        <Header col="score" label="Score"/>
        <Header col="title" label="Lead"/>
        <div className="oc-th">Source</div>
        <div className="oc-th">Layer</div>
        <Header col="age" label="Age"/>
        <div className="oc-th">Status</div>
        <div className="oc-th"></div>
      </div>
      <div className="oc-tbody">
        {sorted.map((l) => (
          <div key={l.id}
               className={`oc-tr ${selected === l.id ? "selected" : ""}`}
               onClick={() => onSelect(l.id)}>
            <div onClick={(e) => e.stopPropagation()}><input type="checkbox" className="oc-cb-input"/></div>
            <div><ScoreBadge score={l.score}/></div>
            <div className="oc-lead-title">
              <div className="oc-lead-name">{l.title}</div>
              <div className="oc-lead-meta"><span className="oc-mono">{l.id}</span> · {l.budget}</div>
            </div>
            <div><SourceBadge source={l.source}/></div>
            <div><LayerTag layer={l.layer}/></div>
            <div className="oc-mono oc-meta">{l.age} ago</div>
            <div><StatusPill status={l.status}/></div>
            <div><Icon.ChevR size={14} /></div>
          </div>
        ))}
      </div>
    </div>
  );
};
window.LeadTable = LeadTable;
