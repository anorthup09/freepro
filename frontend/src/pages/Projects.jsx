import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import GearRequestModal from '../components/GearRequestModal.jsx';

const STATUS_PILL = {
  PLANNING:  'amber',
  ACTIVE:    'green',
  WRAPPED:   'purple',
  DELIVERED: 'green',
  ARCHIVED:  '',
};

const gth = { padding:'8px 12px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' };
const gtd = { padding:'10px 12px', fontSize:12, borderBottom:'1px solid rgba(255,255,255,0.05)', verticalAlign:'middle' };
const fmtGD = d => d ? new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '—';

function GearManagement() {
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [tab, setTab] = useState('requested'); // 'requested' | 'none'
  const [showForm, setShowForm] = useState(false);
  const [viewing, setViewing] = useState(null);
  const load = () => api.gearOverview().then(setRows).catch(e => alert(e.message));
  useEffect(() => { load(); }, []);

  async function quickView(e, pid) {
    e.stopPropagation();
    try { setViewing(await api.gearRequestForProject(pid)); }
    catch { alert('Could not load the gear request.'); }
  }

  const shown = (rows || []).filter(r => tab === 'requested' ? r.hasRequest : !r.hasRequest);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div className="page-sub">Each production shoot has its own gear tile — click a row to open its gear dashboard.</div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ New Gear Request</button>
      </div>

      {/* Requested / No Request toggle */}
      <div style={{ display:'inline-flex', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden', marginBottom:14 }}>
        {[['requested', 'Gear Requested'], ['none', 'No Gear Request']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ background: tab === k ? 'rgba(232,80,10,0.22)' : 'transparent', border:'none',
              color: tab === k ? 'var(--orange)' : 'var(--muted)', fontSize:11, fontWeight:800, padding:'7px 18px', cursor:'pointer' }}>
            {label} {rows ? `(${(rows).filter(r => k === 'requested' ? r.hasRequest : !r.hasRequest).length})` : ''}
          </button>
        ))}
      </div>

      {!rows && <div className="empty">Loading…</div>}
      {rows && shown.length === 0 && (
        <div className="empty">{tab === 'requested' ? 'No shoots with a gear request yet.' : 'Every shoot has a gear request.'}</div>
      )}
      {rows && shown.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:820 }}>
            <thead>
              <tr>
                <th style={gth}>Shoot Code</th><th style={gth}>Shoot Title</th>
                <th style={gth}>Person Responsible</th><th style={gth}>Start</th><th style={gth}>End</th>
                <th style={gth}>Form of Travel</th><th style={{ ...gth, textAlign:'center' }}>Gear Request</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id} onClick={() => nav(`/gear/${r.id}`)} style={{ cursor:'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...gtd, fontWeight:800, whiteSpace:'nowrap' }}>{r.code}</td>
                  <td style={gtd}>{r.subtitle || r.title}</td>
                  <td style={gtd}>{r.person_responsible || <span style={{ color:'var(--muted)' }}>—</span>}</td>
                  <td style={{ ...gtd, whiteSpace:'nowrap' }}>{fmtGD(r.start_date)}</td>
                  <td style={{ ...gtd, whiteSpace:'nowrap' }}>{fmtGD(r.end_date)}</td>
                  <td style={gtd}>{r.form_of_travel || <span style={{ color:'var(--muted)' }}>—</span>}</td>
                  <td style={{ ...gtd, textAlign:'center' }}>
                    {r.hasRequest
                      ? <button onClick={e => quickView(e, r.id)}
                          style={{ background:'rgba(232,80,10,0.14)', border:'1px solid var(--orange)', color:'var(--orange)', borderRadius:10, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>Quick View</button>
                      : <span style={{ fontSize:10, color:'var(--muted)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && <GearRequestModal onClose={() => setShowForm(false)} onSubmitted={load} />}
      {viewing && <GearRequestModal existing={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

export default function Projects() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code:'', title:'', client:'', city:'', state:'', startDate:'', endDate:'' });
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [view, setView] = useState('production');
  const isCrew = user?.role === 'CREW';
  const isAgency = user?.role === 'AGENCY';

  useEffect(() => { api.getProjects().then(setProjects).catch(console.error); }, []);

  async function archiveProject(e, id) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm('Archive this project?')) return;
    await api.updateProject(id, { status: 'ARCHIVED' });
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: 'ARCHIVED' } : p));
  }

  async function unarchiveProject(e, id) {
    e.preventDefault(); e.stopPropagation();
    await api.updateProject(id, { status: 'PLANNING' });
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: 'PLANNING' } : p));
  }

  async function deleteProject(e, p) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Permanently delete "${p.code} — ${p.title}"?\n\nThis removes the shoot and all its crew, schedule, gear, and call-sheet data. This cannot be undone.`)) return;
    try {
      await api.deleteProject(p.id);
      setProjects(ps => ps.filter(x => x.id !== p.id));
    } catch (err) { alert(err.message); }
  }

  const isAdmin = user?.role === 'ADMIN';

  function logout() {
    localStorage.removeItem('fp_token');
    setUser(null);
    nav('/login');
  }

  async function create(e) {
    e.preventDefault(); setSaving(true);
    try {
      const proj = await api.createProject({
        ...form,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
      });
      setProjects(p => [proj, ...p]);
      setShowNew(false);
      setForm({ code:'', title:'', client:'', city:'', state:'', startDate:'', endDate:'', includePhoto:true });
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const today = new Date(new Date().toLocaleDateString('en-CA')+'T12:00:00');

  function daysUntil(startDate) {
    if (!startDate) return null;
    return Math.ceil((new Date(startDate.slice(0,10)+'T12:00:00') - today) / 86400000);
  }

  // Only production projects belong in FreePro — post-only projects (a budget with
  // no Production/shoot section) are excluded. has_production is undefined on older
  // payloads, which reads as included.
  const prodProjects = projects.filter(p => p.has_production !== false);
  const activeProjects = prodProjects
    .filter(p => p.status !== 'ARCHIVED' && p.status !== 'WRAPPED')
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  // Wrapped shoots drop to a condensed strip above Archived
  const wrappedProjects = prodProjects
    .filter(p => p.status === 'WRAPPED')
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));

  return (
    <>
      <nav className="nav">
        <Link to="/" title="Back to the Unbridled Media hub" style={{ display:'flex', alignItems:'center', marginRight:12 }}>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:18, filter:'brightness(0) invert(1)', opacity:0.9 }} />
          </Link>
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <Link to="/projects" className="logo">Free<em>Pro</em></Link>
          <span style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.06em', paddingLeft:1 }}>Powered by Unbridled Media</span>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 12, flex: 1, textAlign: 'center' }}>{user?.name}</span>
        <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none', marginRight:8 }}>Back to Hub</Link>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
      </nav>
      <div className="wrap">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden', marginBottom:6, width:'fit-content' }}>
              {[['production', 'Production Management'], ['gear', 'Gear Management']].map(([k, label]) => (
                <button key={k} onClick={() => setView(k)}
                  style={{ background: view === k ? 'rgba(232,80,10,0.25)' : 'transparent', border:'none',
                    color: view === k ? 'var(--orange)' : 'var(--muted)', fontSize:12, fontWeight:800, padding:'7px 18px', cursor:'pointer', fontFamily:'inherit' }}>
                  {label}
                </button>
              ))}
            </div>
            {view === 'production' && !isCrew && (() => {
              const planning = prodProjects.filter(p => p.status === 'PLANNING').length;
              const live = prodProjects.filter(p => p.status === 'ACTIVE').length;
              return <div className="page-sub">{planning} planning · {live} live shoot{live !== 1 ? 's' : ''}</div>;
            })()}
          </div>
          {view === 'production' && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {!isCrew && !isAgency && <Link to="/crew-calendar" className="btn btn-ghost">Crew Calendar</Link>}
              <Link to="/crew-views" className="btn btn-ghost">Crew Views</Link>
              {!isCrew && !isAgency && <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Project</button>}
            </div>
          )}
        </div>

        {view === 'gear' && <GearManagement />}
        {view === 'production' && isCrew && (
          <div className="empty" style={{ padding:'40px 20px', textAlign:'center' }}>
            Head to <Link to="/crew-views" style={{ color:'var(--orange)' }}>Crew Views</Link> for your call sheets and schedules,
            or switch to Gear Management above to submit and track gear requests.
          </div>
        )}
        {view === 'production' && !isCrew && projects.length === 0 && <div className="empty">No projects yet — create one to get started.</div>}

        {view === 'production' && !isCrew && (
        <div className="proj-list">
          {activeProjects.map(p => {
            const d = daysUntil(p.start_date);
            return (
            <Link key={p.id} to={`/projects/${p.id}`} className="proj-card">
              <div className="proj-card-info">
                <div className="proj-card-code">{p.code}</div>
                <div className="proj-card-title">{p.title}</div>
                <div className="proj-card-meta">{p.client} · {new Date(p.start_date?.slice(0,10)+'T12:00:00').toLocaleDateString()} – {new Date(p.end_date?.slice(0,10)+'T12:00:00').toLocaleDateString()}</div>
              </div>
              {d != null && d > 0 && (
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:20, fontWeight:700, color:'var(--orange)', lineHeight:1 }}>{d}</div>
                  <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>days away</div>
                </div>
              )}
              {d === 0 && (
                <div style={{ fontSize:11, fontWeight:700, color:'var(--orange)', flexShrink:0 }}>Today!</div>
              )}
              <span className={`pill ${STATUS_PILL[p.status] || ''}`}>{p.status.replace(/_/g,' ')}</span>
              {!isAgency && <button
                onClick={e => archiveProject(e, p.id)}
                style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, color:'var(--muted)', fontSize:11, padding:'3px 9px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
              >Archive</button>}
              {isAdmin && <button
                onClick={e => deleteProject(e, p)} title="Permanently delete this shoot"
                style={{ background:'none', border:'1px solid rgba(224,82,82,0.4)', borderRadius:5, color:'var(--red-text, #e08080)', fontSize:11, padding:'3px 9px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
              >Delete</button>}
              <span className="proj-card-arrow">›</span>
            </Link>
            );
          })}
        </div>
        )}

        {view === 'production' && !isCrew && wrappedProjects.length > 0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)', marginBottom:8 }}>
              Wrapped ({wrappedProjects.length})
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, opacity:0.75 }}>
              {wrappedProjects.map(p => (
                <Link key={p.id} to={`/projects/${p.id}`}
                  style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px', textDecoration:'none', color:'var(--text)' }}>
                  <span style={{ fontSize:11, fontWeight:800, color:'var(--muted)', flexShrink:0 }}>{p.code}</span>
                  <span style={{ fontSize:12, fontWeight:600, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</span>
                  <span className={`pill ${STATUS_PILL.WRAPPED || ''}`} style={{ flexShrink:0 }}>WRAPPED</span>
                  {!isAgency && <button onClick={e => archiveProject(e, p.id)}
                    style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, color:'var(--muted)', fontSize:10, padding:'2px 8px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                    Archive
                  </button>}
                  {isAdmin && <button onClick={e => deleteProject(e, p)} title="Permanently delete this shoot"
                    style={{ background:'none', border:'1px solid rgba(224,82,82,0.4)', borderRadius:5, color:'var(--red-text, #e08080)', fontSize:10, padding:'2px 8px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                    Delete
                  </button>}
                  <span className="proj-card-arrow">›</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {view === 'production' && !isCrew && projects.some(p => p.status === 'ARCHIVED') && (
          <div style={{ marginTop:24 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowArchived(s => !s)}
              style={{ marginBottom:10, color:'var(--muted)' }}
            >{showArchived ? '▾' : '▸'} Archived ({prodProjects.filter(p => p.status === 'ARCHIVED').length})</button>
            {showArchived && (
              <div className="proj-list" style={{ opacity:0.6 }}>
                {prodProjects.filter(p => p.status === 'ARCHIVED').map(p => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="proj-card">
                    <div className="proj-card-info">
                      <div className="proj-card-code">{p.code}</div>
                      <div className="proj-card-title">{p.title}</div>
                      <div className="proj-card-meta">{p.client}</div>
                    </div>
                    <span className="pill">ARCHIVED</span>
                    <button
                      onClick={e => unarchiveProject(e, p.id)}
                      style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, color:'var(--muted)', fontSize:11, padding:'3px 9px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
                    >Unarchive</button>
                    <span className="proj-card-arrow">›</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {showNew && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowNew(false)}>
          <div className="modal">
            <div className="modal-title">New Project</div>
            <form onSubmit={create}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field">
                  <label>Project Code</label>
                  <input placeholder="02.CGS00626" value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))} required />
                </div>
                <div className="field">
                  <label>Client</label>
                  <input placeholder="Casey's" value={form.client} onChange={e => setForm(f=>({...f,client:e.target.value}))} required />
                </div>
                <div className="field span2">
                  <label>Project Title</label>
                  <input placeholder="Casey's C3 Convention 2026" value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} required />
                </div>
                <div className="field">
                  <label>City</label>
                  <input placeholder="Kansas City" value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))} required />
                </div>
                <div className="field">
                  <label>State</label>
                  <input placeholder="MO" value={form.state} onChange={e => setForm(f=>({...f,state:e.target.value}))} required />
                </div>
                <div className="field">
                  <label>Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f=>({...f,startDate:e.target.value}))} required />
                </div>
                <div className="field">
                  <label>End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f=>({...f,endDate:e.target.value}))} required />
                </div>
              </div>
              <div className="btn-row" style={{ alignItems:'center' }}>
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create Project'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
                {(() => {
                  const on = form.includePhoto !== false;
                  return (
                    <div onClick={() => setForm(f => ({ ...f, includePhoto: !on }))}
                      title={on ? 'Photo department included — tap to remove' : 'Photo department excluded — tap to include'}
                      style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:7, cursor:'pointer', userSelect:'none' }}>
                      <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color: on ? 'rgba(74,222,128,0.9)' : 'var(--muted)', whiteSpace:'nowrap' }}>
                        {on ? 'Photo Included' : 'No Photo'}
                      </span>
                      <span style={{ width:32, height:18, borderRadius:100, flexShrink:0, position:'relative', transition:'background 0.2s, border-color 0.2s', background: on ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.08)', border:`1px solid ${on ? 'rgba(74,222,128,0.7)' : 'rgba(255,255,255,0.18)'}` }}>
                        <span style={{ position:'absolute', top:2, left: on ? 16 : 2, width:12, height:12, borderRadius:'50%', background: on ? '#4ade80' : 'rgba(255,255,255,0.45)', transition:'left 0.2s, background 0.2s' }} />
                      </span>
                    </div>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
