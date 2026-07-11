import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import FinanceProject from './FinanceProject.jsx';
import Project from './Project/index.jsx';
import AvoProject from './AvoProject.jsx';
import ProjectOverview from './ProjectOverview.jsx';

const WHITE = '#e8e8e8';
const TABS = [
  ['overview', 'Overview', '#e8e8e8'],
  ['finance', 'Project Finance', '#5ABF80'],
  ['pre', 'Pre-Production', 'var(--orange)'],
  ['post', 'Post-Production', '#9DC183'],
];

// Minimal glyphs for the mobile dock (no emoji — consistent stroke icons)
const TAB_ICONS = {
  overview: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  finance:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 .9-3 2.2c0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2s-3-1.1-3-2.5"/></svg>,
  pre:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/><path d="M4 9l1.5-4L9 6l2-3.5L14.5 4 17 1.5 20 4l-1 5"/></svg>,
  post:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9.5l5 2.5-5 2.5v-5z" fill="currentColor" stroke="none"/></svg>,
};

// Instagram-style liquid-glass dock: pinned bottom-center on phones, icons +
// labels at the top of the page, shrinking to icons alone once you scroll.
function MobileTabDock({ tabs, tab, setTab }) {
  const [shrunk, setShrunk] = useState(false);
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { setShrunk(window.innerWidth <= 700 && window.scrollY > 60); raf = null; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="pvd-dock no-print" style={{
      position:'fixed', left:'50%', transform:'translateX(-50%)', bottom:'calc(env(safe-area-inset-bottom, 0px) + 14px)',
      zIndex:110, display:'flex', alignItems:'center', gap:2,
      padding: shrunk ? '6px 10px' : '8px 12px',
      background:'rgba(24,22,19,0.81)', backdropFilter:'blur(18px) saturate(1.5)', WebkitBackdropFilter:'blur(18px) saturate(1.5)',
      border:'1px solid rgba(255,255,255,0.12)', borderRadius:32,
      boxShadow:'0 10px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
      transition:'padding .25s ease',
    }}>
      {tabs.map(([k, label, color]) => {
        const on = tab === k;
        return (
          <button key={k} onClick={() => { setTab(k); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            aria-label={label}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              background: on ? 'rgba(255,255,255,0.10)' : 'transparent', border:'none', cursor:'pointer',
              color: on ? color : 'rgba(255,255,255,0.55)',
              borderRadius:22, padding: shrunk ? '8px 12px' : '7px 12px 6px',
              transition:'all .25s ease',
            }}>
            {TAB_ICONS[k]}
            <span style={{
              fontSize:9, fontWeight:800, letterSpacing:'0.02em', whiteSpace:'nowrap',
              maxHeight: shrunk ? 0 : 12, opacity: shrunk ? 0 : 1, overflow:'hidden',
              transition:'max-height .25s ease, opacity .2s ease',
            }}>{label.replace('Project ', '').replace('-Production', '-Pro')}</span>
          </button>
        );
      })}
    </div>
  );
}

function PVHeader({ showBack }) {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
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
        {showBack && <button className="btn btn-ghost btn-sm" onClick={() => nav('/project-view')}>‹ All Projects</button>}
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
  const [cq, setCq] = useState('');

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
    return [...byClient.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const shownClients = useMemo(() => {
    const s = cq.trim().toLowerCase();
    return s ? clients.filter(c => c.name.toLowerCase().includes(s)) : clients;
  }, [clients, cq]);

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
        <div style={{ marginBottom:18 }}>
          <div className="page-title">Project View</div>
          <div className="page-sub">Every project — finance, pre-production, and post in one place</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:800 }}>Project Hub</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code, title, client…" style={{ width:240 }} />
        </div>
        {!projects && <div className="empty">Loading…</div>}
        {projects && shown.length === 0 && <div className="empty">No projects match.</div>}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(230px, 1fr))', gap:14 }}>
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
            <div style={{ display:'flex', alignItems:'center', gap:14, margin:'34px 0 12px' }}>
              <div style={{ fontSize:14, fontWeight:800 }}>Client Hub</div>
              <input value={cq} onChange={e => setCq(e.target.value)} placeholder="Search clients…" style={{ width:240 }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(230px, 1fr))', gap:14 }}>
              {shownClients.map(c => (
                <div key={c.name} onClick={() => nav(`/project-view/client/${encodeURIComponent(c.name)}`)}
                  style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid rgba(74,158,255,0.5)', borderRadius:10, padding:'16px 18px', cursor:'pointer' }}>
                  <div style={{ fontSize:14, fontWeight:800 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', margin:'3px 0 10px' }}>{c.projects.length} project{c.projects.length !== 1 ? 's' : ''}</div>
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
  const [tab, setTab] = useState('overview');
  const [shootId, setShootId] = useState('');   // FreePro project id for Pre-Production
  const [avoPageId, setAvoPageId] = useState('');

  useEffect(() => {
    api.financeProjects().then(list => {
      const p = list.find(x => x.id === pid);
      setProject(p || false);
      const prod = (p?.shoots || []);
      const withTiles = prod.filter(s => s.freeproProjectId);
      if (withTiles.length) setShootId(withTiles[0].freeproProjectId);
      else if (prod.length) setShootId(pid); // single-production budgets link the section to the parent tile
      else setShootId(''); // post-only project — no pre-production tile
    }).catch(e => alert(e.message));
  }, [pid]);

  // Post tab: get (or create) the Avo project page for this code
  useEffect(() => {
    if (tab !== 'post' || !project || avoPageId) return;
    api.createAvoProject(project.code, project.title).then(p => setAvoPageId(p.id)).catch(e => alert(e.message));
  }, [tab, project]);

  const shoots = (project?.shoots || []).filter(s => s.freeproProjectId);
  // Pre-Production only exists when the budget has a Production (shoot) section.
  const hasProduction = (project?.shoots || []).length > 0;
  const tabs = TABS.filter(([k]) => k !== 'pre' || hasProduction);

  // If the user was on Pre and it disappears, fall back to Finance
  useEffect(() => { if (tab === 'pre' && project && !hasProduction) setTab('finance'); }, [tab, project, hasProduction]);

  return (
    <div className="pvd-page" style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <PVHeader showBack />
      <div style={{ maxWidth:1250, margin:'0 auto', padding:'0 16px' }}>
        <div className="pvd-bar" style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
          {project && (
            <div className="pvd-title" style={{ minWidth:0 }}>
              {project.client_logo
                ? <img src={project.client_logo} alt={project.client} style={{ height:20, maxWidth:120, objectFit:'contain', display:'block', marginBottom:3 }} />
                : project.client && <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, letterSpacing:'0.04em', marginBottom:1 }}>{project.client}</div>}
              <div style={{ fontSize:13, fontWeight:800 }}>{project.code} — {project.title}</div>
            </div>
          )}
          <div style={{ flex:1 }} />
          {tab === 'pre' && shoots.length > 1 && (
            <select value={shootId} onChange={e => setShootId(e.target.value)} style={{ width:'auto', fontSize:11 }}>
              {shoots.map(s => <option key={s.freeproProjectId} value={s.freeproProjectId}>{s.code}</option>)}
            </select>
          )}
        </div>
      </div>

      <MobileTabDock tabs={tabs} tab={tab} setTab={setTab} />

      {project === false && <div className="empty">Project not found.</div>}
      {project && tab === 'overview' && <ProjectOverview pid={pid} />}
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
