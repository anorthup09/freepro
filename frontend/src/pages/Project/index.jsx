import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import Overview from './Overview.jsx';
import Schedule from './Schedule.jsx';
import Crew from './Crew.jsx';
import Deliverables from './Deliverables.jsx';
import Travel from './Travel.jsx';
import Gear from './Gear.jsx';
import GearList from './GearList.jsx';
import Catering from './Catering.jsx';
import SpaceInfo from './SpaceInfo.jsx';
import Questions from './Questions.jsx';

const BASE_TABS = [
  { id: 'overview',            label: 'Overview' },
  { id: 'deliverable-overview', label: 'Deliverable Overview' },
  { id: 'questions',           label: 'Questions' },
];

const LOGISTICS_TABS = [
  { id: 'schedule',    label: 'Schedule' },
  { id: 'crew',        label: 'Crew' },
  { id: 'travel',      label: 'Travel' },
  { id: 'space-info',  label: 'Room / Space Info' },
];

const GEAR_TABS = [
  { id: 'gear',      label: 'Gear Management' },
  { id: 'gear-list', label: 'Gear List' },
];

function DropdownTab({ label, subtabs, tab, setTab }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = subtabs.some(t => t.id === tab);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position:'relative' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className={`tab${isActive ? ' on' : ''}`} onClick={() => !isActive && setTab(subtabs[0].id)}>
        {label} ▾
      </button>
      {open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:200, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, boxShadow:'0 4px 12px rgba(0,0,0,0.3)', minWidth:160, overflow:'hidden' }}>
          {subtabs.map(t => (
            <div
              key={t.id}
              onClick={() => { setTab(t.id); setOpen(false); }}
              style={{ padding:'8px 14px', fontSize:12, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? 'var(--orange)' : 'var(--text)', cursor:'pointer', background: tab === t.id ? 'var(--bg2)' : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
              onMouseLeave={e => e.currentTarget.style.background = tab === t.id ? 'var(--bg2)' : 'transparent'}
            >
              {t.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  async function openPdf(viewType, talentName = null) {
    const share = await ensureShare(viewType, talentName);
    const url = `${FRONTEND_BASE}/share/${share.token}?pdf=1`;
    window.open(url, '_blank');
    setOpen(false);
  }

  const talentShares = shares.filter(s => s.view_type === 'talent');

  return (
    <div className="share-wrap" ref={ref} style={{ position: 'relative' }}>
      <button className="share-btn" onClick={() => setOpen(o => !o)}>
        Share ▾
      </button>
      {open && (
        <div className="share-menu">
          <div style={{ padding:'6px 14px 3px', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Copy Link</div>
          <div className="share-menu-item" onClick={() => handleOption('producer')}>Producer View</div>
          <div className="share-menu-item" onClick={() => handleOption('crew')}>Crew View</div>
          <div className="share-menu-item" onClick={() => handleOption('client')}>Client View</div>
          {talentShares.map(s => (
            <div key={s.id} className="share-menu-item" onClick={() => copyLink(s)}>
              {s.talent_name} — Talent
            </div>
          ))}
          <div style={{ borderTop:'1px solid var(--border)', margin:'4px 0', padding:'6px 14px 3px', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Download PDF</div>
          <div className="share-menu-item" onClick={() => openPdf('producer')}>Producer PDF</div>
          <div className="share-menu-item" onClick={() => openPdf('crew')}>Crew PDF</div>
          <div className="share-menu-item" onClick={() => openPdf('client')}>Client PDF</div>
          {talentShares.map(s => (
            <div key={`pdf-${s.id}`} className="share-menu-item" onClick={() => openPdf('talent', s.talent_name)}>
              {s.talent_name} — Talent PDF
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
  const [showCateringGrid, setShowCateringGrid] = useState(() => {
    try { return localStorage.getItem(`catering-${id}`) === 'true'; } catch { return false; }
  });

  function toggleCateringGrid(val) {
    setShowCateringGrid(val);
    try { localStorage.setItem(`catering-${id}`, String(val)); } catch {}
  }

  useEffect(() => {
    api.getProject(id).then(setProject).catch(() => nav('/'));
  }, [id]);

  if (!project) return null;

  const STATUS_PILL = { PLANNING:'amber', ACTIVE:'green', WRAPPED:'purple', DELIVERED:'green', ARCHIVED:'' };
  const ALL_STATUSES = ['PLANNING','ACTIVE','WRAPPED','DELIVERED','ARCHIVED'];

  async function changeStatus(newStatus) {
    try {
      await api.updateProject(project.id, { status: newStatus });
      setProject(p => ({ ...p, status: newStatus }));
    } catch(e) { alert(e.message); }
  }

  return (
    <>
      <nav className="nav">
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <Link to="/" className="logo">Free<em>Pro</em></Link>
          <span style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.06em', paddingLeft:1 }}>Powered by Unbridled Media</span>
        </div>
        <div className="tabs">
          {BASE_TABS.map(t => (
            <button key={t.id} className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
          <DropdownTab label="Logistics" subtabs={LOGISTICS_TABS} tab={tab} setTab={setTab} />
          <DropdownTab label="Gear" subtabs={GEAR_TABS} tab={tab} setTab={setTab} />
          {showCateringGrid && (
            <button className={`tab${tab === 'catering' ? ' on' : ''}`} onClick={() => setTab('catering')}>Catering</button>
          )}
        </div>
        <div style={{ marginLeft:'auto', position:'relative' }}>
          <select
            value={project.status}
            onChange={e => changeStatus(e.target.value)}
            className={`pill ${STATUS_PILL[project.status] || ''}`}
            style={{ cursor:'pointer', appearance:'none', WebkitAppearance:'none', paddingRight:22, fontWeight:500, fontSize:11, border:'1px solid', background:'var(--bg2)' }}
          >
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          <span style={{ position:'absolute', right:7, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', fontSize:9, color:'inherit' }}>▾</span>
        </div>
        <ShareDropdown projectId={id} />
      </nav>

      <div className="wrap">
        {tab === 'overview'             && <Overview     project={project} setProject={setProject} onTabChange={setTab} />}
        {tab === 'schedule'             && <Schedule     project={project} showCateringGrid={showCateringGrid} setShowCateringGrid={toggleCateringGrid} onCateringTabChange={() => setTab('catering')} />}
        {tab === 'catering'             && <Catering     project={project} />}
        {tab === 'crew'                 && <Crew         project={project} onProjectUpdate={setProject} />}
        {tab === 'travel'               && <Travel       project={project} />}
        {tab === 'gear'                 && <Gear         project={project} setProject={setProject} />}
        {tab === 'gear-list'            && <GearList     project={project} />}
        {tab === 'deliverable-overview' && <Deliverables project={project} />}
        {tab === 'space-info'           && <SpaceInfo    project={project} setProject={setProject} />}
        {tab === 'questions'            && <Questions    project={project} />}
      </div>
    </>
  );
}
