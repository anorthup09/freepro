import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import Overview from './Overview.jsx';
import Schedule from './Schedule.jsx';
import Crew from './Crew.jsx';
import Deliverables from './Deliverables.jsx';
import Travel from './Travel.jsx';
import Gear from './Gear.jsx';

const TABS = [
  { id: 'overview',         label: 'Overview' },
  { id: 'schedule',         label: 'Schedule' },
  { id: 'crew',             label: 'Crew' },
  { id: 'travel',           label: 'Travel' },
  { id: 'gear',             label: 'Gear' },
  { id: 'post-production',  label: 'Post-Production' },
];

const FRONTEND_BASE = window.location.origin;

function ShareDropdown({ projectId }) {
  const [shares, setShares] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    api.getShares(projectId).then(setShares).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function copyLink(share) {
    const url = `${FRONTEND_BASE}/share/${share.token}`;
    await navigator.clipboard.writeText(url);
    setToast('Copied!');
    setOpen(false);
    setTimeout(() => setToast(''), 2000);
  }

  async function ensureShare(viewType, talentName = null) {
    let share = shares.find(s => s.view_type === viewType && s.talent_name === talentName);
    if (!share) {
      share = await api.createShare(projectId, { viewType, talentName });
      setShares(prev => [...prev, share]);
    }
    return share;
  }

  async function handleOption(viewType, talentName = null) {
    const share = await ensureShare(viewType, talentName);
    copyLink(share);
  }

  const talentShares = shares.filter(s => s.view_type === 'talent');

  return (
    <div className="share-wrap" ref={ref} style={{ position: 'relative' }}>
      <button className="share-btn" onClick={() => setOpen(o => !o)}>
        Share ▾
      </button>
      {open && (
        <div className="share-menu">
          <div className="share-menu-item" onClick={() => handleOption('producer')}>Producer View</div>
          <div className="share-menu-item" onClick={() => handleOption('crew')}>Crew View</div>
          <div className="share-menu-item" onClick={() => handleOption('client')}>Client View</div>
          {talentShares.map(s => (
            <div key={s.id} className="share-menu-item" onClick={() => copyLink(s)}>
              {s.talent_name} — Talent
            </div>
          ))}
        </div>
      )}
      {toast && <div className="share-toast">{toast}</div>}
    </div>
  );
}

export default function Project() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.getProject(id).then(setProject).catch(() => nav('/'));
  }, [id]);

  if (!project) return null;

  const STATUS_PILL = { PLANNING:'amber', ACTIVE:'green', WRAPPED:'purple', DELIVERED:'green', ARCHIVED:'' };

  return (
    <>
      <nav className="nav">
        <Link to="/" className="logo">Free<em>-Pro</em></Link>
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className={`live pill ${STATUS_PILL[project.status] || ''}`} style={{ marginLeft:'auto' }}>
          {project.status.replace(/_/g,' ')}
        </span>
        <ShareDropdown projectId={id} />
      </nav>

      <div className="wrap">
        {tab === 'overview'     && <Overview     project={project} setProject={setProject} onTabChange={setTab} />}
        {tab === 'schedule'     && <Schedule     project={project} />}
        {tab === 'crew'         && <Crew         project={project} onProjectUpdate={setProject} />}
        {tab === 'travel'          && <Travel       project={project} />}
        {tab === 'gear'            && <Gear         project={project} setProject={setProject} />}
        {tab === 'post-production' && <Deliverables project={project} />}
      </div>
    </>
  );
}
