const Topbar = ({ title, subtitle, onRunScout }) => {
  return (
    <div className="oc-topbar">
      <div>
        <h1 className="oc-h1">{title}</h1>
        {subtitle && <div className="oc-h1-sub">{subtitle}</div>}
      </div>
      <div className="oc-topbar-actions">
        <div className="oc-search">
          <Icon.Search size={14} />
          <input placeholder="Search leads, clients, pitches…" />
          <span className="oc-kbd">⌘K</span>
        </div>
        <button className="oc-btn oc-btn-ghost" title="Notifications"><Icon.Bell size={16} /></button>
        <button className="oc-btn oc-btn-primary" onClick={onRunScout}>
          <Icon.Search size={14} /> Run scout
        </button>
      </div>
    </div>
  );
};
window.Topbar = Topbar;

const StatCards = ({ stats }) => (
  <div className="oc-stats">
    {stats.map((s) => (
      <div className="oc-stat" key={s.label}>
        <div className="oc-stat-label">{s.label}</div>
        <div className={`oc-stat-value ${s.accent ? "accent" : ""}`}>{s.value}</div>
        {s.delta && (
          <div className={`oc-stat-delta ${s.deltaPositive ? "pos" : "neg"}`}>
            {s.deltaPositive ? <Icon.Up size={10} stroke={2.5} /> : <Icon.Down size={10} stroke={2.5} />}
            {s.delta}
          </div>
        )}
        {s.sub && <div className="oc-stat-sub">{s.sub}</div>}
      </div>
    ))}
  </div>
);
window.StatCards = StatCards;
