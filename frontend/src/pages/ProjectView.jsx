import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import FinanceProject from './FinanceProject.jsx';
import Project from './Project/index.jsx';
import AvoProject from './AvoProject.jsx';

const WHITE = '#e8e8e8';
const TABS = [
  ['finance', 'Project Finance', '#5ABF80'],
  ['pre', 'Pre-Production', 'var(--orange)'],
  ['post', 'Post-Production', '#9DC183'],
];

function PVHeader() {
  const { user, setUser } = useAuth();
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
        </Link>
        <Link to="/project-view" style={{ fontSize:12, color:WHITE, fontWeight:700, letterSpacing:'0.04em', textDecoration:'none' }}>🗂 Project View</Link>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
        <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Back to Hub</Link>
        <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
      </div>
    </div>
  );
}

// ── Landing: every project as a tile, organized by project code ──
export default function ProjectView() {
  const nav = useNavigate();
  const [projects, setProjects] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { api.financeProjects().then(setProjects).catch(e => alert(e.message)); }, []);

  // Clients running more than one project at once get a mini-hub tile
  const clients = useMemo(() => {
    const byClient = new Map();
    for (const p of projects || []) {
      const name = (p.client || '').trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!byClient.has(key)) byClient.set(key, { name, projects: [] });
      byClient.get(key).projects.push(p);
    }
    return [...byClient.values()].filter(c => c.projects.length > 1)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const shown = useMemo(() => {
    const list = [...(projects || [])].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(p => (p.code || '').toLowerCase().includes(s) || (p.title || '').toLowerCase().includes(s) || (p.client || '').toLowerCase().includes(s));
  }, [projects, q]);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <PVHeader />
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'6px 16px 80px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:18 }}>
          <div>
            <div className="page-title">Project View</div>
            <div className="page-sub">Every project — finance, pre-production, and post in one place</div>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code, title, client…" style={{ width:240 }} />
        </div>
        {!projects && <div className="empty">Loading…</div>}
        {projects && shown.length === 0 && <div className="empty">No projects match.</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:14 }}>
          {shown.map(p => (
            <div key={p.id} onClick={() => nav(`/project-view/${p.id}`)}
              style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${WHITE}44`, borderRadius:10, padding:'16px 18px', cursor:'pointer' }}>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--muted)', letterSpacing:'0.04em' }}>{p.code}</div>
              <div style={{ fontSize:14, fontWeight:800, margin:'4px 0 2px' }}>{p.title}</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>{p.client}</div>
              <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, fontWeight:800, color:'#5ABF80', border:'1px solid #5ABF8055', borderRadius:10, padding:'2px 8px' }}>{p.budget_status || 'No budget'}</span>
                {(p.shoots || []).length > 0 && <span style={{ fontSize:9, fontWeight:800, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.shoots.length} shoot{p.shoots.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
          ))}
        </div>

        {clients.length > 0 && (
          <>
            <div style={{ margin:'34px 0 12px' }}>
              <div style={{ fontSize:14, fontWeight:800 }}>Client Hub</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>Clients with multiple projects going at once — resources, branding, and every project in one place</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:14 }}>
              {clients.map(c => (
                <div key={c.name} onClick={() => nav(`/project-view/client/${encodeURIComponent(c.name)}`)}
                  style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid rgba(74,158,255,0.5)', borderRadius:10, padding:'16px 18px', cursor:'pointer' }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', margin:'3px 0 10px' }}>{c.projects.length} projects</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {c.projects.slice(0, 4).map(p => (
                      <span key={p.id} style={{ fontSize:9, fontWeight:800, color:'#4a9eff', border:'1px solid rgba(74,158,255,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.code}</span>
                    ))}
                    {c.projects.length > 4 && <span style={{ fontSize:9, color:'var(--muted)' }}>+{c.projects.length - 4} more</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Detail: one project, flip between Finance / Pre / Post ──
export function ProjectViewDetail() {
  const { pid } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('finance');
  const [shootId, setShootId] = useState('');   // FreePro project id for Pre-Production
  const [avoPageId, setAvoPageId] = useState('');

  useEffect(() => {
    api.financeProjects().then(list => {
      const p = list.find(x => x.id === pid);
      setProject(p || false);
      const withTiles = (p?.shoots || []).filter(s => s.freeproProjectId);
      if (withTiles.length) setShootId(withTiles[0].freeproProjectId);
      else setShootId(pid); // single-production budgets link the section to the parent tile
    }).catch(e => alert(e.message));
  }, [pid]);

  // Post tab: get (or create) the Avo project page for this code
  useEffect(() => {
    if (tab !== 'post' || !project || avoPageId) return;
    api.createAvoProject(project.code, project.title).then(p => setAvoPageId(p.id)).catch(e => alert(e.message));
  }, [tab, project]);

  const shoots = (project?.shoots || []).filter(s => s.freeproProjectId);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <PVHeader />
      <div style={{ maxWidth:1250, margin:'0 auto', padding:'0 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/project-view')}>‹ All Projects</button>
          {project && <div style={{ fontSize:13, fontWeight:800 }}>{project.code} — {project.title}</div>}
          <div style={{ flex:1 }} />
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:18, overflow:'hidden' }}>
            {TABS.map(([k, label, color]) => (
              <button key={k} onClick={() => setTab(k)}
                style={{ background: tab === k ? 'rgba(255,255,255,0.07)' : 'transparent', border:'none',
                  color: tab === k ? color : 'var(--muted)', fontSize:11, fontWeight:800, padding:'7px 16px', cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </div>
          {tab === 'pre' && shoots.length > 1 && (
            <select value={shootId} onChange={e => setShootId(e.target.value)} style={{ width:'auto', fontSize:11 }}>
              {shoots.map(s => <option key={s.freeproProjectId} value={s.freeproProjectId}>{s.code}</option>)}
            </select>
          )}
        </div>
      </div>

      {project === false && <div className="empty">Project not found.</div>}
      {project && tab === 'finance' && <FinanceProject pidOverride={pid} />}
      {project && tab === 'pre' && (shootId
        ? <Project idOverride={shootId} key={shootId} />
        : <div className="empty">No FreePro production tile yet — set the budget Live to create one.</div>)}
      {project && tab === 'post' && (avoPageId
        ? <div style={{ maxWidth:1250, margin:'0 auto', padding:'0 16px 40px' }}><AvoProject idOverride={avoPageId} embedded /></div>
        : <div className="empty">Loading post-production…</div>)}
    </div>
  );
}
