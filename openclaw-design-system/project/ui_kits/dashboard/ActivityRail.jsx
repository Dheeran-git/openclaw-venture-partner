const ActivityRail = ({ events }) => (
  <div className="oc-rail">
    <div className="oc-rail-head">
      <div className="oc-section-label" style={{margin:0}}>ACTIVITY</div>
      <button className="oc-btn oc-btn-ghost" style={{height:24,padding:"0 6px"}} title="Refresh"><Icon.Refresh size={12}/></button>
    </div>
    <div className="oc-tl">
      {events.map((e, i) => (
        <div key={i} className={`oc-ev oc-ev-${e.kind || "default"}`}>
          <div className="oc-ev-text">{e.text}</div>
          <div className="oc-meta oc-mono" style={{fontSize:10,letterSpacing:"0.06em"}}>{e.meta}</div>
        </div>
      ))}
    </div>
  </div>
);
window.ActivityRail = ActivityRail;
