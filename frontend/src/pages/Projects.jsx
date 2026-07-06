import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

const STATUS_PILL = {
  PLANNING:  'amber',
  ACTIVE:    'green',
  WRAPPED:   'purple',
  DELIVERED: 'green',
  ARCHIVED:  '',
};

export default function Projects() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ code:'', title:'', client:'', city:'', state:'', startDate:'', endDate:'' });
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

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

  const activeProjects = projects
    .filter(p => p.status !== 'ARCHIVED')
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));

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
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
      </nav>
      <div className="wrap">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div>
            <div className="page-title">Production</div>
            <div className="page-sub">{projects.length} shoot{projects.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Link to="/crew-views" className="btn btn-ghost">Crew Views</Link>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ New Project</button>
          </div>
        </div>

        {projects.length === 0 && <div className="empty">No projects yet — create one to get started.</div>}

        <div className="proj-list">
          {activeProjects.map(p => {
            const d = daysUntil(p.start_date);
            return (
            <Link key={p.id} to={`/projects/${p.id}`} className="proj-card">
              <div className="proj-card-info">
                <div className="proj-card-code">{p.code}</div>
                <div className="proj-card-title">{p.title}</div>
                <div className="proj-card-meta">{p.client} · {p.city}, {p.state} · {new Date(p.start_date?.slice(0,10)+'T12:00:00').toLocaleDateString()} – {new Date(p.end_date?.slice(0,10)+'T12:00:00').toLocaleDateString()}</div>
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
              <button
                onClick={e => archiveProject(e, p.id)}
                style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, color:'var(--muted)', fontSize:11, padding:'3px 9px', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
              >Archive</button>
              <span className="proj-card-arrow">›</span>
            </Link>
            );
          })}
        </div>

        {projects.some(p => p.status === 'ARCHIVED') && (
          <div style={{ marginTop:24 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowArchived(s => !s)}
              style={{ marginBottom:10, color:'var(--muted)' }}
            >{showArchived ? '▾' : '▸'} Archived ({projects.filter(p => p.status === 'ARCHIVED').length})</button>
            {showArchived && (
              <div className="proj-list" style={{ opacity:0.6 }}>
                {projects.filter(p => p.status === 'ARCHIVED').map(p => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="proj-card">
                    <div className="proj-card-info">
                      <div className="proj-card-code">{p.code}</div>
                      <div className="proj-card-title">{p.title}</div>
                      <div className="proj-card-meta">{p.client} · {p.city}, {p.state}</div>
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
