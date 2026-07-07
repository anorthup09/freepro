import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';

export const AVO = '#9DC183';
export const AVO_STATUSES = [
  ['FOCUS', 'Focus', '#e05252'],
  ['ASSIGNED', 'Assigned Current Edits', '#4a9eff'],
  ['COMING_SOON', 'Coming Soon', '#e6c229'],
  ['CLOSED', 'Closed Tasks', '#8a8f98'],
];

export function AvoHeader() {
  const { user, setUser } = useAuth();
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
        </Link>
        <Link to="/avo" style={{ fontSize:12, color:AVO, fontWeight:700, letterSpacing:'0.04em', textDecoration:'none' }}>🥑 AvocadoPost</Link>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
        <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Back to Hub</Link>
        <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
      </div>
    </div>
  );
}

const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '—';
const overdue = d => d && new Date(String(d).slice(0, 10) + 'T23:59:00') < new Date();
export const fmtV = v => 'V' + (Number(v) || 1).toFixed(1);
export const stepV = (v, dir) => Math.max(0.1, Math.round(((Number(v) || 1) + dir * 0.1) * 10) / 10);

function ProjectLookup() {
  const nav = useNavigate();
  const [pages, setPages] = useState(null);
  const [liveCodes, setLiveCodes] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    api.avoProjects().then(setPages).catch(() => setPages([]));
    api.avoProjectCodes().then(setLiveCodes).catch(() => setLiveCodes([]));
  }, []);

  const match = p => !q.trim()
    || p.code.toLowerCase().includes(q.trim().toLowerCase())
    || (p.title || '').toLowerCase().includes(q.trim().toLowerCase());
  const filtered = (pages || []).filter(match);
  // Live ProFi projects that don't have a page yet show as tiles too
  const pageCodes = new Set((pages || []).map(p => p.code.toLowerCase()));
  const liveExtra = liveCodes.filter(c => !pageCodes.has(c.code.toLowerCase())).filter(match);
  const exactMatch = (pages || []).some(p => p.code.toLowerCase() === q.trim().toLowerCase())
    || liveCodes.some(c => c.code.toLowerCase() === q.trim().toLowerCase());

  async function openLive(c) {
    try {
      const p = await api.createAvoProject(c.code, c.title);
      nav(`/avo/project/${p.id}`);
    } catch (e) { alert(e.message); }
  }
  async function createPage() {
    try {
      const p = await api.createAvoProject(q.trim());
      nav(`/avo/project/${p.id}`);
    } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:800 }}>Project Lookup</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search projects…"
          style={{ width:220, fontSize:12, padding:'6px 10px' }} />
      </div>
      <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>Recent Projects</div>
      {!pages && <div style={{ fontSize:11, color:'var(--muted)' }}>Loading…</div>}
      {pages && filtered.length === 0 && liveExtra.length === 0 && !q.trim() && (
        <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No project pages yet — type a project code above to create one.</div>
      )}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
        {filtered.map(p => (
          <div key={p.id} onClick={() => nav(`/avo/project/${p.id}`)}
            style={{ background:'var(--bg)', border:'1px solid var(--border)', borderLeft:`3px solid ${AVO}`, borderRadius:8, padding:'10px 14px', minWidth:170, cursor:'pointer' }}>
            <div style={{ fontSize:12, fontWeight:800 }}>{p.code}</div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{p.title || 'Lower thirds · to-dos'}</div>
          </div>
        ))}
        {liveExtra.map(c => (
          <div key={c.code} onClick={() => openLive(c)}
            style={{ background:'var(--bg)', border:'1px solid var(--border)', borderLeft:'3px solid #5ABF80', borderRadius:8, padding:'10px 14px', minWidth:170, cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, fontWeight:800 }}>{c.code}</span>
              <span style={{ fontSize:8, fontWeight:800, color:'#5ABF80', border:'1px solid #5ABF8055', borderRadius:8, padding:'1px 6px', textTransform:'uppercase' }}>Live</span>
            </div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>{c.title || c.client || 'ProFi project'}</div>
          </div>
        ))}
        {q.trim() && !exactMatch && (
          <div onClick={createPage}
            style={{ background:'transparent', border:`1px dashed ${AVO}`, color:AVO, borderRadius:8, padding:'10px 14px', minWidth:170, cursor:'pointer', display:'flex', alignItems:'center', fontSize:12, fontWeight:700 }}>
            + Create “{q.trim()}”
          </div>
        )}
      </div>
    </div>
  );
}

function NewEditModal({ onClose, onCreated }) {
  const [f, setF] = useState({ title:'', projectCode:'', leadEditorId:'', startDate:'', endDate:'' });
  const [saving, setSaving] = useState(false);
  const [codes, setCodes] = useState([]);
  useEffect(() => { api.avoProjectCodes().then(setCodes).catch(() => setCodes([])); }, []);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  async function submit() {
    if (!f.title || saving) return;
    setSaving(true);
    try {
      const e = await api.createAvoEdit(f);
      onCreated(e);
    } catch (e2) { alert(e2.message); setSaving(false); }
  }
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${AVO}`, borderRadius:12, padding:'22px 24px', width:'100%', maxWidth:520 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>New Edit</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div><div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Video Title *</div>
            <input value={f.title} onChange={set('title')} /></div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:150 }}><div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Project Code</div>
              <select value={f.projectCode} onChange={set('projectCode')}>
                <option value="">— No project (Avo only) —</option>
                {codes.map(c => <option key={c.code} value={c.code}>{c.code}{c.title ? ` — ${c.title}` : ''}</option>)}
              </select></div>
            <div style={{ flex:1, minWidth:150 }}><div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Lead Editor</div>
              <EditorSelect value={f.leadEditorId} onChange={v => setF(x => ({ ...x, leadEditorId: v }))} /></div>
          </div>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:150 }}><div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Start Date</div>
              <input type="date" value={f.startDate} onChange={set('startDate')} /></div>
            <div style={{ flex:1, minWidth:150 }}><div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Due Date</div>
              <input type="date" value={f.endDate} onChange={set('endDate')} /></div>
          </div>
          <div style={{ fontSize:11, color:'var(--muted)' }}>A matching FreePro deliverable is created automatically when the code maps to a project with a shoot.</div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button disabled={!f.title || saving} onClick={submit}
              style={{ background: f.title ? AVO : 'var(--border)', color:'#0b0b0b', border:'none', borderRadius:8, padding:'8px 18px', fontSize:12, fontWeight:800, cursor: f.title ? 'pointer' : 'default' }}>
              {saving ? 'Creating…' : 'Create Edit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EditorSelect({ value, onChange, placeholder = '— Unassigned —' }) {
  const [roster, setRoster] = useState([]);
  useEffect(() => { api.getCrew().then(setRoster).catch(() => setRoster([])); }, []);
  const display = m => {
    const p = [m.preferred_first_name, m.preferred_last_name].filter(Boolean).join(' ').trim();
    return p || m.name;
  };
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {[...roster].sort((a, b) => display(a).localeCompare(display(b))).map(m => <option key={m.id} value={m.id}>{display(m)}</option>)}
    </select>
  );
}

export default function Avo() {
  const nav = useNavigate();
  const [edits, setEdits] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const load = () => api.avoEdits().then(setEdits).catch(e => alert(e.message));
  useEffect(() => { load(); }, []);

  async function act(e, id, fn) {
    e.stopPropagation();
    try { await fn(); load(); } catch (err) { alert(err.message); }
  }

  const th = { padding:'7px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', whiteSpace:'nowrap' };
  const td = { padding:'7px 10px', fontSize:12, verticalAlign:'middle' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <AvoHeader />
      <div style={{ maxWidth:1250, margin:'0 auto', padding:'6px 16px 80px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:18 }}>
          <div>
            <div className="page-title">Editing Pipeline</div>
            <div className="page-sub">{(edits || []).filter(e => e.status !== 'CLOSED').length} active edit{(edits || []).filter(e => e.status !== 'CLOSED').length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => nav('/avo/gantt')}
              style={{ background:'rgba(157,193,131,0.15)', border:`1px solid ${AVO}`, color:AVO, borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              Gantt View
            </button>
            <button onClick={() => setShowNew(true)}
              style={{ background:AVO, border:`1px solid ${AVO}`, color:'#0b0b0b', borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
              + Add New Edit
            </button>
          </div>
        </div>

        <ProjectLookup />

        {!edits && <div className="empty">Loading…</div>}

        {edits && AVO_STATUSES.map(([key, label, color]) => {
          const group = edits.filter(e => e.status === key);
          const collapsed = key === 'CLOSED' && !closedOpen;
          return (
            <div key={key} style={{ marginBottom:20 }}>
              <div onClick={() => key === 'CLOSED' && setClosedOpen(o => !o)}
                style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:8, cursor: key === 'CLOSED' ? 'pointer' : 'default' }}>
                <span style={{ background:`${color}22`, border:`1px solid ${color}`, color, borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  {key === 'CLOSED' ? (closedOpen ? '▾ ' : '▸ ') : ''}{label}
                </span>
                <span style={{ fontSize:11, color:'var(--muted)' }}>{group.length}</span>
              </div>
              {!collapsed && group.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', padding:'2px 4px 6px' }}>Nothing here.</div>}
              {!collapsed && group.length > 0 && (
                <div className="budget-tbl-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth:960 }}>
                    <thead>
                      <tr>
                        <th style={th}>Video Title</th><th style={th}>Lead Editor</th>
                        <th style={{ ...th, textAlign:'center' }}>V#</th><th style={th} colSpan={2}></th>
                        <th style={th}>Current Review Link</th><th style={th}>Latest Comment</th>
                        <th style={th}>Start</th><th style={th}>Due</th><th style={{ ...th, textAlign:'center' }}>Approved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map(e => (
                        <tr key={e.id} onClick={() => nav(`/avo/${e.id}`)} style={{ borderTop:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                          <td style={{ ...td, fontWeight:700 }}>
                            {e.title}
                            {e.project_code && <div style={{ fontSize:9, color:'var(--muted)', fontWeight:400 }}>{e.project_code}{e.project_title ? ` · ${e.project_title}` : ''}</div>}
                          </td>
                          <td style={td}>{e.lead_editor || '—'}</td>
                          <td style={{ ...td, textAlign:'center', whiteSpace:'nowrap' }} onClick={ev => ev.stopPropagation()}>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                              <button title="Version down 0.1" onClick={ev => act(ev, e.id, () => api.updateAvoEdit(e.id, { version: stepV(e.version, -1) }))}
                                style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:5, padding:'0 5px', fontSize:10, cursor:'pointer', lineHeight:'16px' }}>−</button>
                              <span style={{ fontWeight:800, color:AVO, minWidth:34, display:'inline-block' }}>{fmtV(e.version)}</span>
                              <button title="Version up 0.1" onClick={ev => act(ev, e.id, () => api.updateAvoEdit(e.id, { version: stepV(e.version, 1) }))}
                                style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:5, padding:'0 5px', fontSize:10, cursor:'pointer', lineHeight:'16px' }}>+</button>
                            </span>
                          </td>
                          <td style={{ ...td, padding:'7px 3px' }}>
                            <button title="Ready For Review — email the PM" onClick={ev => act(ev, e.id, () => api.avoRfr(e.id))}
                              style={{ background:'rgba(230,194,41,0.12)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:10, padding:'2px 9px', fontSize:9, fontWeight:800, cursor:'pointer' }}>
                              RFR
                            </button>
                          </td>
                          <td style={{ ...td, padding:'7px 3px' }}>
                            <button title="Log this version as sent for client review" onClick={ev => act(ev, e.id, () => api.avoSent(e.id))}
                              style={{ background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:10, padding:'2px 9px', fontSize:9, fontWeight:800, cursor:'pointer' }}>
                              Sent
                            </button>
                          </td>
                          <td style={td}>
                            {e.review_link
                              ? <a href={e.review_link} target="_blank" rel="noreferrer" onClick={ev => ev.stopPropagation()} style={{ color:'#4a9eff', fontSize:11 }}>▶ {e.review_link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 28)}</a>
                              : <span style={{ color:'var(--muted)' }}>—</span>}
                          </td>
                          <td style={{ ...td, maxWidth:220 }}>
                            {e.latest_comment
                              ? <span style={{ fontSize:11 }} title={e.latest_comment}>{e.latest_comment.slice(0, 46)}{e.latest_comment.length > 46 ? '…' : ''}</span>
                              : <span style={{ color:'var(--muted)' }}>—</span>}
                          </td>
                          <td style={{ ...td, whiteSpace:'nowrap' }}>{fmtD(e.start_date)}</td>
                          <td style={{ ...td, whiteSpace:'nowrap', color: e.status !== 'CLOSED' && overdue(e.end_date) ? '#e05252' : 'var(--text)', fontWeight: overdue(e.end_date) ? 700 : 400 }}>{fmtD(e.end_date)}</td>
                          <td style={{ ...td, textAlign:'center' }} onClick={ev => ev.stopPropagation()}>
                            <input type="checkbox" checked={e.approved || false} style={{ width:'auto', accentColor:AVO }}
                              onChange={ev => act(ev, e.id, () => api.updateAvoEdit(e.id, { approved: ev.target.checked }))} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showNew && <NewEditModal onClose={() => setShowNew(false)} onCreated={e => { setShowNew(false); nav(`/avo/${e.id}`); }} />}
    </div>
  );
}
