const PitchCard = ({ pitch, onApprove, onReject, sent }) => {
  const [body, setBody] = React.useState(pitch.body);
  const [editing, setEditing] = React.useState(false);
  return (
    <div className="oc-pitch">
      <div className="oc-pitch-head">
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span className="oc-mono oc-meta" style={{textTransform:"uppercase",letterSpacing:"0.08em"}}>{pitch.id}</span>
          <StatusPill status={sent ? "sent" : pitch.status}/>
        </div>
        <span className="oc-mono oc-meta">drafted {pitch.draftedAgo} ago</span>
      </div>
      {editing ? (
        <textarea className="oc-textarea" value={body} onChange={(e)=>setBody(e.target.value)} rows={14}/>
      ) : (
        <div className="oc-pitch-body">{body}</div>
      )}
      <div className="oc-pitch-pov">
        <div className="oc-pov-label">PROOF-OF-VALUE</div>
        <div className="oc-pov-row">
          <Icon.ExternalLink size={14}/>
          <span className="oc-mono" style={{color:"var(--brand-coral)"}}>{pitch.pov.label}</span>
          <span className="oc-meta">· {pitch.pov.note}</span>
        </div>
      </div>
      <div className="oc-pitch-foot">
        <div style={{display:"flex",gap:8}}>
          <button className="oc-btn oc-btn-secondary" onClick={()=>setEditing(!editing)}>
            <Icon.Edit size={14}/> {editing ? "Done editing" : "Edit"}
          </button>
          <button className="oc-btn oc-btn-destructive" onClick={onReject}>Reject</button>
        </div>
        <button className="oc-btn oc-btn-primary" onClick={onApprove} disabled={sent}>
          {sent ? <><Icon.Check size={14}/> Sent</> : <>Approve & send <Icon.ChevR size={14}/></>}
        </button>
      </div>
    </div>
  );
};
window.PitchCard = PitchCard;

const LeadDetail = ({ lead, pitch, onClose, sent, onApprove, onReject }) => {
  if (!lead) return null;
  return (
    <div className="oc-detail">
      <div className="oc-detail-head">
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <ScoreBadge score={lead.score}/>
          <div>
            <div style={{fontSize:16,fontWeight:500,color:"var(--fg-primary)"}}>{lead.title}</div>
            <div className="oc-meta oc-mono" style={{marginTop:2}}>{lead.id} · {lead.budget} · {lead.age} ago</div>
          </div>
        </div>
        <button className="oc-btn oc-btn-ghost" onClick={onClose}><Icon.X size={16}/></button>
      </div>
      <div className="oc-detail-tags">
        <SourceBadge source={lead.source}/>
        <LayerTag layer={lead.layer}/>
        <StatusPill status={lead.status}/>
      </div>
      <div className="oc-detail-body">
        <div className="oc-section-label">PITCH DRAFT</div>
        <PitchCard pitch={pitch} onApprove={onApprove} onReject={onReject} sent={sent}/>
        <div className="oc-section-label" style={{marginTop:24}}>SIGNAL</div>
        <div className="oc-signal">
          <div className="oc-signal-row"><span className="oc-meta">Posted</span><span>2026-04-30 · 14:18 UTC</span></div>
          <div className="oc-signal-row"><span className="oc-meta">Match</span><span>React · Next.js · perf · Vercel stack</span></div>
          <div className="oc-signal-row"><span className="oc-meta">Notes</span><span>Mentioned migration off Webflow; willing to consider 2-week scope.</span></div>
        </div>
      </div>
    </div>
  );
};
window.LeadDetail = LeadDetail;
