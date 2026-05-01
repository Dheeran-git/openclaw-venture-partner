const Sidebar = ({ active = "inbox", onNav }) => {
  const items = [
    { id: "inbox", icon: <Icon.Inbox size={16} />, label: "Inbox", count: "12" },
    { id: "scout", icon: <Icon.Search size={16} />, label: "Scout", count: "running", live: true },
    { id: "pitches", icon: <Icon.File size={16} />, label: "Pitches", count: "42" },
    { id: "clients", icon: <Icon.Users size={16} />, label: "Clients", count: "8" },
  ];
  const tools = [
    { id: "templates", icon: <Icon.Templates size={16} />, label: "Templates" },
    { id: "settings", icon: <Icon.Settings size={16} />, label: "Settings" },
  ];
  return (
    <aside className="oc-sidebar">
      <div className="oc-brand">
        <img src="../../assets/openclaw-mark-flat.svg" width="24" height="24" alt=""/>
        <div className="oc-brand-text">
          <div className="oc-brand-name">OpenClaw</div>
          <div className="oc-brand-sub">Venture Partner</div>
        </div>
      </div>
      <div className="oc-nav-section">
        {items.map((it) => (
          <button key={it.id}
            className={`oc-nav-item ${active === it.id ? "active" : ""}`}
            onClick={() => onNav?.(it.id)}>
            {it.icon}
            <span>{it.label}</span>
            {it.count && (
              <span className={`oc-nav-count ${it.live ? "live" : ""}`}>
                {it.live && <span className="oc-pulse-dot" />}
                {it.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="oc-nav-heading">Workspace</div>
      <div className="oc-nav-section">
        {tools.map((it) => (
          <button key={it.id} className="oc-nav-item">{it.icon}<span>{it.label}</span></button>
        ))}
      </div>
      <div className="oc-sidebar-foot">
        <div className="oc-avatar">AP</div>
        <div className="oc-foot-text">
          <div style={{fontSize:13,fontWeight:500}}>Anya Petrov</div>
          <div style={{fontFamily:"var(--font-mono)",fontSize:11,color:"var(--fg-secondary)"}}>freelance.anya</div>
        </div>
      </div>
    </aside>
  );
};
window.Sidebar = Sidebar;
