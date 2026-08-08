import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { useAuth } from '../../App.jsx';
import Overview from './Overview.jsx';
import Schedule from './Schedule.jsx';
import Crew from './Crew.jsx';
import Deliverables from './Deliverables.jsx';
import AdditionalDocs from './AdditionalDocs.jsx';
import Travel from './Travel.jsx';
import Gear from './Gear.jsx';
import GearList from './GearList.jsx';
import GearRequestModal from '../../components/GearRequestModal.jsx';
import Catering from './Catering.jsx';
import Questions from './Questions.jsx';
import Scripts from './Scripts.jsx';
import ShotList from './ShotList.jsx';
import ProducerChecklist from './ProducerChecklist.jsx';
import Locations from './Locations.jsx';
import HomeButton from '../../components/HomeButton.jsx';

const BASE_TABS = [
  { id: 'overview',            label: 'Overview' },
  { id: 'deliverable-overview', label: 'Deliverable' },
];

const BASE_LOGISTICS_TABS = [
  { id: 'locations',   label: 'Locations' },
  { id: 'crew',        label: 'Crew/Talent' },
];

const GEAR_TABS = [
  { id: 'gear-request', label: 'Gear Request' },
  { id: 'gear',      label: 'Gear Management' },
  { id: 'gear-list', label: 'Gear List' },
];

// Gear Request tab: fill out the request inline, or view it locked once submitted
function GearRequestTab({ project }) {
  const [request, setRequest] = useState(undefined); // undefined=loading, null=none
  useEffect(() => {
    api.gearRequestForProject(project.id).then(setRequest).catch(() => setRequest(null));
  }, [project.id]);
  if (request === undefined) return <div className="empty">Loading…</div>;
  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>
      <GearRequestModal embedded projectId={project.id} existing={request || null}
        onClose={() => {}} onSubmitted={r => setRequest({ ...r, code: project.code, title: project.title })} />
    </div>
  );
}

// shooting_call / est_wrap may be stored as 24h "HH:MM" — display as 12h
function fmt12(t) {
  if (!t) return t;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return t;
  let h = parseInt(m[1], 10);
  const mer = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${mer}`;
}

// Shot list day dates are free text (or occasionally ISO); show compactly
// without the year, e.g. "FRI, AUG 7"
function fmtSlHeaderDate(str) {
  if (!str) return str;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (iso) {
    return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`)
      .toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }).toUpperCase().replace(/,\s*$/, '');
  }
  return String(str).replace(/,?\s*\d{4}\s*$/, '');
}

// Phase icons for the merged desktop dock (same glyphs as the ProjectView
// phase nav — duplicated here to avoid a circular import)
const PHASE_ICONS = {
  overview: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  finance:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 .9-3 2.2c0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2s-3-1.1-3-2.5"/></svg>,
  pre:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9z"/><path d="M4 9l1.5-4L9 6l2-3.5L14.5 4 17 1.5 20 4l-1 5"/></svg>,
  post:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9.5l5 2.5-5 2.5v-5z" fill="currentColor" stroke="none"/></svg>,
};
const PHASES = [['overview','Overview','#e8e8e8'],['finance','Finance','#5ABF80'],['pre','Pre-Pro','var(--orange)'],['post','Post-Pro','#9DC183']];

// Section-dock icons — line-art, matching the Finance dock (Harbinger/Budget/VCC)
const PROJ_NAV_ICONS = {
  overview: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>,
  logistics: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3.5h6v1M9 10h6M9 14h4"/></svg>,
  schedule: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>,
  gear: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.3"/><path d="M8 7l1.3-2h5.4L16 7"/></svg>,
  deliverable: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8z"/><path d="M3.5 8l8.5 5 8.5-5M12 13v8.5"/></svg>,
};

function DropdownTab({ label, subtabs, tab, setTab, dropUp, icon, excludeActive = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = subtabs.some(t => t.id === tab && !excludeActive.includes(t.id));

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position:'relative' }} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {icon ? (
        <button className={`dock-btn${isActive ? ' on' : ''}`} onClick={() => setOpen(o => !o)} aria-label={label}>
          {icon}
          <span className="dock-lbl">{label}</span>
        </button>
      ) : (
        <button className={`tab${isActive ? ' on' : ''}`} onClick={() => setOpen(o => !o)}>
          {label} ▾
        </button>
      )}
      {open && (
        // Flush outer wrapper (bottom/top:100%) whose 6px inner margin becomes a
        // hoverable bridge — without it the gap between button and menu is dead
        // space that fires onMouseLeave and closes the menu before you reach it.
        <div style={{ position:'absolute', ...(dropUp ? { bottom:'100%' } : { top:'100%' }), left:0, zIndex:200 }}>
          <div style={{ ...(dropUp ? { marginBottom:6 } : { marginTop:6 }), background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, boxShadow:'0 4px 12px rgba(0,0,0,0.3)', minWidth:160, overflow:'hidden' }}>
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
        </div>
      )}
    </div>
  );
}

const FRONTEND_BASE = window.location.origin;

const csLongDate = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';

export function ShareDropdown({ projectId, showShotList, crews = [] }) {
  const navigate = useNavigate();
  const [shares, setShares] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [openSec, setOpenSec] = useState({ links: false, crewCopy: false, pdfs: false, fullpdf: false, crewPdf: false, dailycrew: false, talentpdf: false });
  const toggleSec = k => setOpenSec(s => ({ ...s, [k]: !s[k] }));
  const [csDays, setCsDays] = useState([]);
  const [talentList, setTalentList] = useState([]);
  const [csDownloading, setCsDownloading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    api.getShares(projectId).then(setShares).catch(() => {});
    api.getSchedule(projectId).then(setCsDays).catch(() => {});
    api.getTalent(projectId).then(setTalentList).catch(() => {});
  }, [projectId]);

  // Days that actually have a call sheet (call times / schedule), matching the Call Sheet page.
  const sheetDays = (csDays || []).filter(d => d.call_time || d.shooting_call_time || d.wrap_time || (d.events || []).length || (d.crewCalls || []).length);

  async function downloadCallSheet(dayId) {
    if (csDownloading) return;
    setCsDownloading(true);
    try {
      const blob = await api.downloadCallSheet(projectId, dayId);
      // Preview in a new tab (inline PDF) — the viewer can save from there.
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setOpen(false);
    } catch (e) { alert('Could not generate PDF: ' + e.message); }
    finally { setCsDownloading(false); }
  }

  async function openTalentCallSheet(talentId) {
    try {
      const blob = await api.downloadTalentCallSheet(projectId, talentId);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setOpen(false);
    } catch (e) { alert('Could not generate PDF: ' + e.message); }
  }

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

  async function ensureShare(viewType, talentName = null, crewGroupId = null) {
    let share = shares.find(s => s.view_type === viewType && s.talent_name === talentName && (s.crew_group_id || null) === crewGroupId);
    if (!share) {
      share = await api.createShare(projectId, { viewType, talentName, crewGroupId });
      setShares(prev => [...prev, share]);
    }
    return share;
  }

  async function handleOption(viewType, talentName = null, crewGroupId = null) {
    const share = await ensureShare(viewType, talentName, crewGroupId);
    copyLink(share);
  }

  async function openPdf(viewType, talentName = null, crewGroupId = null) {
    const share = await ensureShare(viewType, talentName, crewGroupId);
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
          <div className="share-menu-item" onClick={() => { setOpen(false); navigate(`/projects/${projectId}/emails`); }}
            style={{ border:'1px solid rgba(255,255,255,0.5)', borderRadius:5, margin:'6px 8px 2px', padding:'6px 10px', color:'var(--text)' }}>
            Send Call Sheet Emails
          </div>
          <div className="share-menu-item" onClick={() => { setOpen(false); navigate(`/projects/${projectId}/talent-callsheets`); }}
            style={{ border:'1px solid rgba(255,255,255,0.5)', borderRadius:5, margin:'2px 8px 4px', padding:'6px 10px', color:'var(--text)' }}>
            Talent
          </div>
          {/* ── Full Schedule Links (collapsible) ── */}
          <div className="share-menu-item" onClick={() => toggleSec('links')}
            style={{ borderTop:'1px solid var(--border)', margin:'4px 0 0', padding:'6px 14px', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>Full Schedule Links</span><span>{openSec.links ? '▾' : '▸'}</span>
          </div>
          {openSec.links && <>
            <div className="share-menu-item" onClick={() => handleOption('producer')}>Producer View</div>
            {crews.length > 0 ? (
              <>
                <div className="share-menu-item" onClick={() => toggleSec('crewCopy')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>Crew View</span><span style={{ color:'var(--muted)' }}>{openSec.crewCopy ? '▾' : '▸'}</span>
                </div>
                {openSec.crewCopy && <>
                  <div className="share-menu-item" onClick={() => handleOption('crew')} style={{ paddingLeft:26 }}>All Crews</div>
                  {crews.map(c => (
                    <div key={c.id} className="share-menu-item" onClick={() => handleOption('crew', null, c.id)} style={{ paddingLeft:26, color: c.color || undefined }}>{c.name}</div>
                  ))}
                </>}
              </>
            ) : (
              <div className="share-menu-item" onClick={() => handleOption('crew')}>Crew View</div>
            )}
            <div className="share-menu-item" onClick={() => handleOption('client')}>Client View</div>
          </>}
          {/* ── PDFs (collapsible) ── */}
          <div className="share-menu-item" onClick={() => toggleSec('pdfs')}
            style={{ borderTop:'1px solid var(--border)', margin:'4px 0 0', padding:'6px 14px', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>PDFs</span><span>{openSec.pdfs ? '▾' : '▸'}</span>
          </div>
          {openSec.pdfs && <>
            {/* Full Schedule PDFs */}
            <div className="share-menu-item" onClick={() => toggleSec('fullpdf')} style={{ paddingLeft:20, fontWeight:600, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Full Schedule PDFs</span><span style={{ color:'var(--muted)' }}>{openSec.fullpdf ? '▾' : '▸'}</span>
            </div>
            {openSec.fullpdf && <>
              <div className="share-menu-item" onClick={() => openPdf('producer')} style={{ paddingLeft:34 }}>Producer PDF</div>
              {crews.length > 0 ? (
                <>
                  <div className="share-menu-item" onClick={() => toggleSec('crewPdf')} style={{ paddingLeft:34, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>Crew PDF</span><span style={{ color:'var(--muted)' }}>{openSec.crewPdf ? '▾' : '▸'}</span>
                  </div>
                  {openSec.crewPdf && <>
                    <div className="share-menu-item" onClick={() => openPdf('crew')} style={{ paddingLeft:48 }}>All Crews</div>
                    {crews.map(c => (
                      <div key={c.id} className="share-menu-item" onClick={() => openPdf('crew', null, c.id)} style={{ paddingLeft:48, color: c.color || undefined }}>{c.name}</div>
                    ))}
                  </>}
                </>
              ) : (
                <div className="share-menu-item" onClick={() => openPdf('crew')} style={{ paddingLeft:34 }}>Crew PDF</div>
              )}
              <div className="share-menu-item" onClick={() => openPdf('client')} style={{ paddingLeft:34 }}>Client PDF</div>
            </>}
            {/* Daily Crew PDFs */}
            <div className="share-menu-item" onClick={() => toggleSec('dailycrew')} style={{ paddingLeft:20, fontWeight:600, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Daily Crew PDFs</span><span style={{ color:'var(--muted)' }}>{openSec.dailycrew ? '▾' : '▸'}</span>
            </div>
            {openSec.dailycrew && (
              sheetDays.length === 0
                ? <div className="share-menu-item" style={{ paddingLeft:34, color:'var(--muted)', fontStyle:'italic' }}>No call sheet days yet</div>
                : <>
                    <div className="share-menu-item" style={{ paddingLeft:34, fontWeight:700 }} onClick={() => downloadCallSheet(null)}>
                      {csDownloading ? 'Generating…' : `All days (${sheetDays.length})`}
                    </div>
                    {sheetDays.map((d, i) => (
                      <div key={d.id} className="share-menu-item" style={{ paddingLeft:48 }} onClick={() => downloadCallSheet(d.id)}>
                        Day {i + 1} — {csLongDate(d.date)}
                      </div>
                    ))}
                  </>
            )}
            {/* Talent */}
            <div className="share-menu-item" onClick={() => toggleSec('talentpdf')} style={{ paddingLeft:20, fontWeight:600, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>Talent</span><span style={{ color:'var(--muted)' }}>{openSec.talentpdf ? '▾' : '▸'}</span>
            </div>
            {openSec.talentpdf && (
              talentList.length === 0
                ? <div className="share-menu-item" style={{ paddingLeft:34, color:'var(--muted)', fontStyle:'italic' }}>No talent added yet</div>
                : talentList.map(t => (
                    <div key={t.id} className="share-menu-item" style={{ paddingLeft:34 }} onClick={() => openTalentCallSheet(t.id)}>{t.name}</div>
                  ))
            )}
          </>}
          {showShotList && <>
            <div style={{ borderTop:'1px solid var(--border)', margin:'4px 0' }} />
            <div className="share-menu-item" onClick={async () => {
              const share = await ensureShare('producer');
              const url = `${FRONTEND_BASE}/share/${share.token}?tab=shot-list&pdf=1`;
              window.open(url, '_blank');
              setOpen(false);
            }} style={{ border:'1px solid rgba(255,255,255,0.5)', borderRadius:5, margin:'4px 8px', padding:'6px 10px', color:'var(--text)' }}>Shot List PDF</div>
          </>}
        </div>
      )}
      {toast && <div className="share-toast">{toast}</div>}
    </div>
  );
}

export default function Project({ idOverride, onControls }) {
  // Pre-Pro runs the aurora at 30% — busy pages, gentler wash
  useEffect(() => {
    document.body.classList.add('aurora-soft');
    return () => document.body.classList.remove('aurora-soft');
  }, []);
  const { id: idParam } = useParams();
  const id = idOverride || idParam;
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const { user } = useAuth();
  const isAgency = user?.role === 'AGENCY';
  const isCrew = user?.role === 'CREW';
  // Solutions + Crew are finance-free viewers with the same reduced section nav
  const isViewer = isAgency || isCrew;
  const [tab, setTab] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    return q || (isViewer ? 'schedule' : 'overview');
  });

  // Keep the active tab in the URL so a refresh returns to the same tab
  useEffect(() => {
    const url = new URL(window.location);
    if (tab === 'overview') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url);
  }, [tab]);

  // The sticky nav wraps taller on mobile; pin the glass bar just below it
  const [navH, setNavH] = useState(48);
  useEffect(() => {
    const el = document.querySelector('nav.nav');
    if (!el) return;
    const update = () => setNavH(Math.round(el.getBoundingClientRect().height));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [project]);
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
  const [showScripts, setShowScripts] = useState(() => {
    try { return localStorage.getItem(`scripts-${id}`) === 'true'; } catch { return false; }
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

  function toggleScripts(val) {
    setShowScripts(val);
    try { localStorage.setItem(`scripts-${id}`, String(val)); } catch {}
    api.updateProject(id, { showScripts: val }).catch(() => {});
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
      if (p.show_scripts != null) {
        setShowScripts(!!p.show_scripts);
        try { localStorage.setItem(`scripts-${id}`, String(!!p.show_scripts)); } catch {}
      }
    }).catch(() => nav('/projects'));
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
  const [scheduleFocusDate, setScheduleFocusDate] = useState(null);

  useEffect(() => {
    function onScroll() { setGlassVisible(window.scrollY > 60); }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // When embedded in Project View, hand the ?/Share controls up to the parent so
  // they can sit inline with the project name (the shell nav is hidden there).
  useEffect(() => {
    if (!onControls) return;
    onControls({ setTab, tab, hasUnanswered, projectId: id, showShotList, crews: project?.crews || [], isAgency, isCrew });
  }, [onControls, tab, hasUnanswered, id, showShotList, project, isAgency, isCrew]);

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
    ? Math.ceil((new Date(startDate.slice(0,10)+'T12:00:00') - new Date(new Date().toLocaleDateString('en-CA')+'T12:00:00')) / 86400000)
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
      <div className="proj-glass-head" style={{
        position: 'fixed',
        top: navH,
        left: 0,
        right: 0,
        zIndex: 90,
        pointerEvents: 'none',
        opacity: glassVisible ? 1 : 0,
        transform: glassVisible ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        backdropFilter: 'blur(5px) saturate(140%)',
        WebkitBackdropFilter: 'blur(5px) saturate(140%)',
        background: 'rgba(10,10,8,0.18)',
        maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
        padding: tab === 'shot-list' ? '14px 20px 24px' : '10px 20px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'padding 0.2s ease',
      }}>
        <div>
          <div style={{ fontSize:10, color:'rgba(255,255,255,0.65)', textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:2 }}>{project.code}</div>
          <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:16, letterSpacing:'-0.3px', color:'var(--text)', lineHeight:1 }}>{project.title}</div>
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
            {currentShotListDay.date && (
              <>
                <div style={{ width:1, height:28, background:'rgba(255,255,255,0.12)' }} />
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:2 }}>Date</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'rgba(255,255,255,0.9)', letterSpacing:'.02em', whiteSpace:'nowrap' }}>{fmtSlHeaderDate(currentShotListDay.date)}</div>
                </div>
              </>
            )}
            {(currentShotListDay.shooting_call || currentShotListDay.est_wrap) && <div style={{ width:1, height:28, background:'rgba(255,255,255,0.12)' }} />}
            {currentShotListDay.shooting_call && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:2 }}>Shooting Call</div>
                <div style={{ fontSize:15, fontWeight:800, color:'rgba(255,255,255,0.9)', fontVariantNumeric:'tabular-nums', letterSpacing:'.02em' }}>{fmt12(currentShotListDay.shooting_call)}</div>
              </div>
            )}
            {currentShotListDay.shooting_call && currentShotListDay.est_wrap && <div style={{ width:1, height:28, background:'rgba(255,255,255,0.12)' }} />}
            {currentShotListDay.est_wrap && (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:2 }}>Est. Wrap</div>
                <div style={{ fontSize:15, fontWeight:800, color:'rgba(255,255,255,0.9)', fontVariantNumeric:'tabular-nums', letterSpacing:'.02em' }}>{fmt12(currentShotListDay.est_wrap)}</div>
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
          <Link to="/projects" className="logo">Free<em>Pro</em></Link>
          <span style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.06em', paddingLeft:1 }}>Powered by Unbridled Media</span>
        </div>
        {/* Right cluster: Share, logo, then ? sits directly left of the home button */}
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          {!glassVisible && !isAgency && !isCrew && <ShareDropdown projectId={id} showShotList={showShotList} crews={project?.crews || []} />}
          <Link to="/" title="Back to the Unbridled Media hub" style={{ display:'flex', alignItems:'center' }}>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:18, filter:'brightness(0) invert(1)', opacity:0.9 }} />
          </Link>
          {!isAgency && !isCrew && <button
            className={`q-btn${tab === 'questions' ? ' on' : ''}${hasUnanswered && tab !== 'questions' ? ' glow' : ''}`}
            onClick={() => setTab('questions')}
            title={hasUnanswered ? 'Questions — unanswered waiting' : 'Questions'}
            aria-label="Questions"
          >?</button>}
          <HomeButton />
        </div>
      </nav>

      {/* Project section nav — floated to the bottom, styled like the Finance dock;
          collapses to icons-only once the page is scrolled */}
      <div className={`proj-bottomnav no-print${glassVisible ? ' shrunk' : ''}${idOverride ? ' merged' : ''}`}>
        {idOverride && (
          <>
            {PHASES.map(([k, label, color]) => (
              <button key={k} className={`dock-btn phase${k === 'pre' ? ' on' : ''}`}
                style={k === 'pre' ? { color } : undefined}
                onClick={() => k !== 'pre' && window.dispatchEvent(new CustomEvent('fp-phase', { detail: k }))} aria-label={label}>
                {PHASE_ICONS[k]}
                <span className="dock-lbl">{label}</span>
              </button>
            ))}
            <div aria-hidden style={{ width:1, alignSelf:'stretch', margin:'6px 6px', background:'rgba(255,255,255,0.14)' }} />
          </>
        )}
        {!isAgency && !isCrew && (
          <button className={`dock-btn${tab === 'overview' ? ' on' : ''}`} onClick={() => { setTab('overview'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Overview">
            {PROJ_NAV_ICONS.overview}
            <span className="dock-lbl">Overview</span>
          </button>
        )}
        <button className={`dock-btn${tab === 'schedule' ? ' on' : ''}`} onClick={() => setTab('schedule')} aria-label="Schedule">
          {PROJ_NAV_ICONS.schedule}
          <span className="dock-lbl">Schedule</span>
        </button>
        <DropdownTab dropUp icon={PROJ_NAV_ICONS.logistics} label="Logistics" subtabs={isViewer
          ? [{ id:'travel', label:'Travel' }, { id:'shot-list', label:'Shot List' }, { id:'additional-docs', label:'Additional Docs' }]
          : [...BASE_LOGISTICS_TABS, ...(showTravel ? [{ id:'travel', label:'Travel' }] : []), ...(showCateringGrid ? [{ id:'catering', label:'Catering/Meals' }] : []), ...(showShotList ? [{ id:'shot-list', label:'Shot List' }] : []), ...(showScripts ? [{ id:'scripts', label:'Scripts' }] : []), { id:'additional-docs', label:'Additional Docs' }, { id:'producer-checklist', label:'Producer Checklist' }]} tab={tab} setTab={setTab} />
        <DropdownTab dropUp icon={PROJ_NAV_ICONS.gear} label="Gear" subtabs={GEAR_TABS} tab={tab} setTab={setTab} />
        <button className={`dock-btn${tab === 'deliverable-overview' ? ' on' : ''}`} onClick={() => setTab('deliverable-overview')} aria-label="Deliverable">
          {PROJ_NAV_ICONS.deliverable}
          <span className="dock-lbl">Deliverable</span>
        </button>
      </div>

      <div className="wrap">
        {tab === 'overview'             && <Overview     project={project} setProject={setProject} onTabChange={setTab} showCateringGrid={showCateringGrid} setShowCateringGrid={toggleCateringGrid} onCateringTabChange={() => setTab('catering')} showShotList={showShotList} setShowShotList={toggleShotList} onShotListTabChange={() => setTab('shot-list')} showScripts={showScripts} setShowScripts={toggleScripts} onScriptsTabChange={() => setTab('scripts')} showTravel={showTravel} setShowTravel={toggleTravel} onTravelTabChange={() => setTab('travel')} />}
        {tab === 'schedule'             && <Schedule     project={project} showCateringGrid={showCateringGrid} setShowCateringGrid={toggleCateringGrid} onCateringTabChange={() => setTab('catering')} showShotList={showShotList} setShowShotList={toggleShotList} onShotListTabChange={() => setTab('shot-list')} showScripts={showScripts} setShowScripts={toggleScripts} onScriptsTabChange={() => setTab('scripts')} showTravel={showTravel} setShowTravel={toggleTravel} onTravelTabChange={() => setTab('travel')} focusDate={scheduleFocusDate} onFocusConsumed={() => setScheduleFocusDate(null)} />}
        {tab === 'catering'             && <Catering     project={project} />}
        {tab === 'scripts'              && <Scripts      project={project} />}
        {tab === 'shot-list'            && <ShotList     project={project} onScenesChange={setShotListScenes} onCurrentDayChange={setCurrentShotListDay} onOpenScheduleDay={(iso) => { setScheduleFocusDate(iso); setTab('schedule'); }} />}
        {tab === 'crew'                 && <Crew         project={project} onProjectUpdate={setProject} />}
        {tab === 'travel'               && <Travel       project={project} />}
        {tab === 'gear-request'         && <GearRequestTab project={project} />}
        {tab === 'gear'                 && <Gear         project={project} setProject={setProject} />}
        {tab === 'gear-list'            && <GearList     project={project} />}
        {tab === 'deliverable-overview' && <Deliverables project={project} />}
        {tab === 'producer-checklist'   && <ProducerChecklist project={project} />}
        {tab === 'additional-docs' && <AdditionalDocs project={project} />}
        {tab === 'locations'            && <Locations    project={project} setProject={setProject} />}
        {tab === 'questions'            && <Questions    project={project} />}
      </div>
    </>
  );
}
