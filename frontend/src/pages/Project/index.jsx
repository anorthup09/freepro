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
import ShotList from './ShotList.jsx';

const BASE_TABS = [
  { id: 'overview',            label: 'Overview' },
  { id: 'deliverable-overview', label: 'Deliverable Overview' },
];

const BASE_LOGISTICS_TABS = [
  { id: 'schedule',    label: 'Schedule' },
  { id: 'crew',        label: 'Crew' },
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
      <button className={`tab${isActive ? ' on' : ''}`} onClick={() => setOpen(o => !o)}>
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

function ShareDropdown({ projectId, showShotList }) {
  const navigate = useNavigate();
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
          <div style={{ borderTop:'1px solid var(--border)', margin:'4px 0', padding:'6px 14px 3px', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Download PDF</div>
          <div className="share-menu-item" onClick={() => openPdf('producer')}>Producer PDF</div>
          <div className="share-menu-item" onClick={() => openPdf('crew')}>Crew PDF</div>
          <div className="share-menu-item" onClick={() => openPdf('client')}>Client PDF</div>
          <div style={{ borderTop:'1px solid var(--border)', margin:'4px 0' }} />
          {showShotList && (
            <div className="share-menu-item" onClick={async () => {
              const share = await ensureShare('producer');
              const url = `${FRONTEND_BASE}/share/${share.token}?tab=shot-list&pdf=1`;
              window.open(url, '_blank');
              setOpen(false);
            }} style={{ border:'1px solid rgba(255,255,255,0.5)', borderRadius:5, margin:'4px 8px', padding:'6px 10px', color:'#fff' }}>Shot List PDF</div>
          )}
          <div className="share-menu-item" onClick={() => { setOpen(false); navigate(`/projects/${projectId}/talent-callsheets`); }} style={{ border:'1px solid rgba(255,255,255,0.5)', borderRadius:5, margin:'4px 8px', padding:'6px 10px', color:'#fff' }}>Talent</div>
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
  const [hasUnanswered, setHasUnanswered] = useState(false);
  const [showCateringGrid, setShowCateringGrid] = useState(() => {
    try { return localStorage.getItem(`catering-${id}`) === 'true'; } catch { return false; }
  });
  const [showShotList, setShowShotList] = useState(() => {
    try { return localStorage.getItem(`shotlist-${id}`) === 'true'; } catch { return false; }
  });
  const [showTravel, setShowTravel] = useState(() => {
    try { return localStorage.getItem(`travel-${id}`) === 'true'; } catch { return false; }
  });

  function toggleCateringGrid(val) {
    setShowCateringGrid(val);
    try { localStorage.setItem(`catering-${id}`, String(val)); } catch {}
  }

  function toggleShotList(val) {
    setShowShotList(val);
    try { localStorage.setItem(`shotlist-${id}`, String(val)); } catch {}
    api.updateProject(id, { showShotList: val }).catch(() => {});
  }

  function toggleTravel(val) {
    setShowTravel(val);
    try { localStorage.setItem(`travel-${id}`, String(val)); } catch {}
  }

  useEffect(() => {
    api.getProject(id).then(p => {
      setProject(p);
      if (p.show_shot_list != null) {
        setShowShotList(!!p.show_shot_list);
        try { localStorage.setItem(`shotlist-${id}`, String(!!p.show_shot_list)); } catch {}
      }
    }).catch(() => nav('/'));
  }, [id]);

  useEffect(() => {
    api.getQuestions(id).then(qs => setHasUnanswered(qs.some(q => !q.answer))).catch(() => {});
  }, [id]);

  // Refresh unanswered count when switching away from Questions tab
  useEffect(() => {
    if (tab !== 'questions') {
      api.getQuestions(id).then(qs => setHasUnanswered(qs.some(q => !q.answer))).catch(() => {});
    }
  }, [tab]);

  const [glassVisible, setGlassVisible] = useState(false);
  const [clockTime, setClockTime] = useState(new Date());
  const [shotListScenes, setShotListScenes] = useState([]);
  const [currentShotListDay, setCurrentShotListDay] = useState(null);

  useEffect(() => {
    function onScroll() { setGlassVisible(window.scrollY > 60); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  function calcWrapTime(startTime, shots) {
    if (!startTime) return null;
    const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let [, h, m, meridiem] = match;
    h = parseInt(h); m = parseInt(m);
    if (meridiem.toUpperCase() === 'PM' && h !== 12) h += 12;
    if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
    const totalStart = h * 60 + m;
    const shotMins = shots.reduce((s, sh) => s + (sh.est_minutes || 0), 0);
    const totalEnd = totalStart + shotMins;
    const endH = Math.floor(totalEnd / 60) % 24;
    const endM = totalEnd % 60;
    const period = endH >= 12 ? 'PM' : 'AM';
    const displayH = endH % 12 || 12;
    return `${displayH}:${String(endM).padStart(2, '0')} ${period}`;
  }

  const shootingCall = shotListScenes.length > 0 ? shotListScenes[0].est_start_time || null : null;
  const lastScene = shotListScenes.length > 0 ? shotListScenes[shotListScenes.length - 1] : null;
  const shootingWrap = lastScene ? calcWrapTime(lastScene.est_start_time, lastScene.shots || []) : null;

  if (!project) return null;

  const startDate = project.start_date || project.startDate;
  const daysUntil = startDate
    ? Math.ceil((new Date(startDate.slice(0,10)+'T12:00:00') - new Date(new Date().toISOString().slice(0,10)+'T12:00:00')) / 86400000)
    : null;

  const STATUS_PILL = { PLANNING:'amber', ACTIVE:'green', WRAPPED:'purple', ARCHIVED:'' };
  const ALL_STATUSES = ['PLANNING','ACTIVE','WRAPPED','ARCHIVED'];

  async function changeStatus(newStatus) {
    try {
      await api.updateProject(project.id, { status: newStatus });
      setProject(p => ({ ...p, status: newStatus }));
    } catch(e) { alert(e.message); }
  }

  return (
    <>
      {/* Liquid glass sticky bar — shown on scroll across all tabs */}
      <div style={{
        position: 'fixed',
        top: 48,
        left: 0,
        right: 0,
        zIndex: 90,
        pointerEvents: 'none',
        opacity: glassVisible ? 1 : 0,
        transform: glassVisible ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        background: 'rgba(10,10,8,0.55)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        padding: tab === 'shot-list' ? '14px 20px' : '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'padding 0.2s ease',
      }}>
        <div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:2 }}>{project.code}</div>
          <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:16, letterSpacing:'-0.3px', color:'#fff', lineHeight:1 }}>{project.title}</div>
          {tab === 'shot-list' && (
            <div style={{ marginTop:5, fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:'.08em', fontVariantNumeric:'tabular-nums' }}>
              <span style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'.14em', marginRight:5, color:'rgba(255,255,255,0.3)' }}>Current Time</span>
              {clockTime.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', second:'2-digit', hour12:true })}
            </div>
          )}
        </div>
        {tab === 'shot-list' && currentShotListDay ? (
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:2 }}>Day</div>
              <div style={{ fontSize:15, fontWeight:800, color:'rgba(255,255,255,0.9)', fontVariantNumeric:'tabular-nums', letterSpacing:'.02em' }}>{currentShotListDay.day_number}</div>
            </div>
            {(currentShotListDay.shooting_call || currentShotListDay.est_wrap) && <div style={{ width:1, height:28, background:'rgba(255,255,255,0.12)' }} />}
            {currentShotListDay.shooting_call && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:2 }}>Shooting Call</div>
                <div style={{ fontSize:15, fontWeight:800, color:'rgba(255,255,255,0.9)', fontVariantNumeric:'tabular-nums', letterSpacing:'.02em' }}>{currentShotListDay.shooting_call}</div>
              </div>
            )}
            {currentShotListDay.shooting_call && currentShotListDay.est_wrap && <div style={{ width:1, height:28, background:'rgba(255,255,255,0.12)' }} />}
            {currentShotListDay.est_wrap && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:2 }}>Est. Wrap</div>
                <div style={{ fontSize:15, fontWeight:800, color:'rgba(255,255,255,0.9)', fontVariantNumeric:'tabular-nums', letterSpacing:'.02em' }}>{currentShotListDay.est_wrap}</div>
              </div>
            )}
          </div>
        ) : daysUntil != null && daysUntil > 0 ? (
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:20, fontWeight:700, color:'var(--orange)', lineHeight:1 }}>{daysUntil}</span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:'0.06em' }}>days until {project.title}</span>
          </div>
        ) : daysUntil != null && daysUntil === 0 ? (
          <span style={{ fontSize:13, fontWeight:700, color:'var(--orange)' }}>Day 1 is today!</span>
        ) : null}
      </div>
      <nav className="nav">
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <Link to="/" className="logo">Free<em>Pro</em></Link>
          <span style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.06em', paddingLeft:1 }}>Powered by Unbridled Media</span>
        </div>
        <div className="tabs">
          <button className={`tab${tab === 'overview' ? ' on' : ''}`} onClick={() => setTab('overview')}>Overview</button>
          <DropdownTab label="Logistics" subtabs={[...BASE_LOGISTICS_TABS, ...(showTravel ? [{ id:'travel', label:'Travel' }] : []), ...(showCateringGrid ? [{ id:'catering', label:'Catering/Meals' }] : []), ...(showShotList ? [{ id:'shot-list', label:'Shot List' }] : [])]} tab={tab} setTab={setTab} />
          <DropdownTab label="Gear" subtabs={GEAR_TABS} tab={tab} setTab={setTab} />
          <button className={`tab${tab === 'deliverable-overview' ? ' on' : ''}`} onClick={() => setTab('deliverable-overview')}>Deliverable Overview</button>
        </div>
        <button
          className={`tab${tab === 'questions' ? ' on' : ''}`}
          onClick={() => setTab('questions')}
          style={{ marginLeft:'auto', border:'1px solid var(--orange)', borderRadius:6, color:'#fff', flexShrink:0, display:'flex', alignItems:'center', gap:5 }}
        >
          {hasUnanswered && tab !== 'questions' && <span style={{ fontSize:11, color:'var(--orange)' }}>!</span>}
          Questions
        </button>
        <ShareDropdown projectId={id} showShotList={showShotList} />
      </nav>

      <div className="wrap">
        {tab === 'overview'             && <Overview     project={project} setProject={setProject} onTabChange={setTab} />}
        {tab === 'schedule'             && <Schedule     project={project} showCateringGrid={showCateringGrid} setShowCateringGrid={toggleCateringGrid} onCateringTabChange={() => setTab('catering')} showShotList={showShotList} setShowShotList={toggleShotList} onShotListTabChange={() => setTab('shot-list')} showTravel={showTravel} setShowTravel={toggleTravel} onTravelTabChange={() => setTab('travel')} />}
        {tab === 'catering'             && <Catering     project={project} />}
        {tab === 'shot-list'            && <ShotList     project={project} onScenesChange={setShotListScenes} onCurrentDayChange={setCurrentShotListDay} />}
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
