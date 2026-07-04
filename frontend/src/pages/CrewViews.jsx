import React, { useEffect, useState, useRef } from 'react';
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

// Metallic orange frame around the viewport — instant visual cue that
// you're on the crew-views landing rather than the admin projects page.
// The sheen angle follows device tilt (scroll as fallback), like ShineBorder.
function MetallicFrame() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = null;
    const setAngle = (deg) => {
      if (raf) return;
      raf = requestAnimationFrame(() => { el.style.setProperty('--frame-angle', `${deg}deg`); raf = null; });
    };
    const onOrient = (e) => { if (e.gamma != null || e.beta != null) setAngle(115 + (e.gamma || 0) * 2 + (e.beta || 0)); };
    const onScroll = () => setAngle(115 + (window.scrollY / 5) % 360);
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('deviceorientation', onOrient); window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={ref} style={{
      position: 'fixed', inset: 0, zIndex: 999, pointerEvents: 'none',
      border: '5px solid transparent',
      borderImage: 'linear-gradient(var(--frame-angle, 115deg), #F7B58C, #E8500A 25%, #7A2A05 50%, #E8500A 75%, #F7B58C) 1',
      boxShadow: 'inset 0 0 18px rgba(232,80,10,0.25)',
    }} />
  );
}

// Same landing layout as the Projects page, but every card opens the
// project's crew share view.
export default function CrewViews() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { api.getCrewViews().then(setProjects).catch(e => setLoadError(e.message)); }, []);

  function logout() {
    localStorage.removeItem('fp_token');
    setUser(null);
    nav('/login');
  }

  function openCrewView(e, project) {
    e.preventDefault();
    nav(`/share/${project.crewToken}`);
  }

  const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) + 'T12:00:00');
  function daysUntil(startDate) {
    if (!startDate) return null;
    return Math.ceil((new Date(startDate.slice(0, 10) + 'T12:00:00') - today) / 86400000);
  }

  const activeProjects = projects
    .filter(p => p.status !== 'ARCHIVED')
    .sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  const archived = projects.filter(p => p.status === 'ARCHIVED');

  function card(p, showDays) {
    const d = showDays ? daysUntil(p.start_date) : null;
    return (
      <a key={p.id} href="#" onClick={e => openCrewView(e, p)} className="proj-card" style={{ opacity: openingId === p.id ? 0.6 : 1 }}>
        <div className="proj-card-info">
          <div className="proj-card-code">{p.code}</div>
          <div className="proj-card-title">{p.title}</div>
          <div className="proj-card-meta">
            {p.client}
            {p.start_date && ` · ${new Date(p.start_date.slice(0,10)+'T12:00:00').toLocaleDateString()} – ${new Date(p.end_date?.slice(0,10)+'T12:00:00').toLocaleDateString()}`}
          </div>
        </div>
        {d != null && d > 0 && (
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:20, fontWeight:700, color:'var(--orange)', lineHeight:1 }}>{d}</div>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>days away</div>
          </div>
        )}
        {d === 0 && <div style={{ fontSize:11, fontWeight:700, color:'var(--orange)', flexShrink:0 }}>Today!</div>}
        <span className={`pill ${STATUS_PILL[p.status] || ''}`}>{p.status.replace(/_/g, ' ')}</span>
        <span className="proj-card-arrow">›</span>
      </a>
    );
  }

  return (
    <>
      <MetallicFrame />
      <nav className="nav">
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <span className="logo">Free<em>Pro</em></span>
          <span style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.06em', paddingLeft:1 }}>Powered by Unbridled Media</span>
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>{user?.name}</span>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={logout}>Sign out</button>
      </nav>
      <div className="wrap">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div>
            <div className="page-title">Crew Views</div>
            <div className="page-sub">{projects.length} shoot{projects.length !== 1 ? 's' : ''} · opens the crew share view</div>
          </div>
        </div>

        {loadError && <div className="login-err" style={{ marginBottom:12 }}>{loadError}</div>}
        {projects.length === 0 && !loadError && <div className="empty">No projects yet.</div>}

        <div className="proj-list">
          {activeProjects.map(p => card(p, true))}
        </div>

        {archived.length > 0 && (
          <div style={{ marginTop:24 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(s => !s)}
              style={{ marginBottom:10, color:'var(--muted)' }}>
              {showArchived ? '▾' : '▸'} Archived ({archived.length})
            </button>
            {showArchived && <div className="proj-list" style={{ opacity:0.6 }}>{archived.map(p => card(p, false))}</div>}
          </div>
        )}
      </div>
    </>
  );
}
