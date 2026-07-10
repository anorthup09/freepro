import React, { useState, useRef, useEffect } from 'react';
import { api } from '../../api.js';
import { useNavigate } from 'react-router-dom';
import { displayName } from '../../utils/displayName.js';

// Tap-to-contact links: phones dial, emails open the mail app
const Tel = ({ v }) => v ? <a href={`tel:${String(v).replace(/[^+\d]/g, '')}`} style={{ color:'inherit', textDecoration:'none' }}>{v}</a> : null;
const Mail = ({ v }) => v ? <a href={`mailto:${v}`} style={{ color:'inherit', textDecoration:'none' }}>{v}</a> : null;


const LOC_TYPES = ['PRIMARY_VENUE','CREW_HOTEL','AIRPORT','OTHER'];
const LOC_LABELS = { PRIMARY_VENUE:'Shooting Location', CREW_HOTEL:'Hotel', SECONDARY:'Rental Car Location', AIRPORT:'Airport', OTHER:'Other' };
const LOC_TAG = { PRIMARY_VENUE:'main', CREW_HOTEL:'crew', SECONDARY:'sec', AIRPORT:'sec', OTHER:'sec' };

const DAY_TYPES = [
  { value:'SHOOT',        label:'Shoot Day' },
  { value:'TRAVEL',       label:'Travel Day' },
  { value:'TRAVEL_SHOOT', label:'Travel/Shoot Day' },
  { value:'SCOUT',        label:'Scout Day' },
];
const DAY_TYPE_LABEL = Object.fromEntries(DAY_TYPES.map(d => [d.value, d.label]));

function fmtDate(d) {
  if (!d) return '';
  return new Date(d.slice(0,10) + 'T12:00:00').toLocaleDateString();
}

const STATUS_PILL = { PLANNING:'amber', ACTIVE:'green', WRAPPED:'purple', ARCHIVED:'' };
const ALL_STATUSES = ['PLANNING','ACTIVE','WRAPPED','ARCHIVED'];

function StatusSelect({ project, setProject }) {
  async function changeStatus(newStatus) {
    try {
      await api.updateProject(project.id, { status: newStatus });
      setProject(p => ({ ...p, status: newStatus }));
    } catch(e) { alert(e.message); }
  }
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
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
  );
}

function PlaceSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounce.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=6&addressdetails=1`, {
          headers: { 'Accept-Language': 'en' }
        });
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
      setLoading(false);
    }, 400);
  }

  function pick(item) {
    const name = item.name || item.display_name.split(',')[0].trim();
    const address = item.display_name;
    setQuery(name);
    setOpen(false);
    onSelect({ name, address });
  }

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search for a place…"
        autoComplete="off"
        style={{ width:'100%', boxSizing:'border-box' }}
      />
      {loading && <div style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', fontSize:11, color:'var(--muted)' }}>…</div>}
      {open && results.length > 0 && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, zIndex:999, maxHeight:200, overflowY:'auto', boxShadow:'0 4px 16px rgba(0,0,0,0.3)' }}>
          {results.map((item, i) => (
            <div key={i}
              onMouseDown={() => pick(item)}
              style={{ padding:'8px 12px', fontSize:12, cursor:'pointer', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', lineHeight:1.4 }}>
              <div style={{ fontWeight:600, color:'var(--text)' }}>{item.name || item.display_name.split(',')[0]}</div>
              <div style={{ color:'var(--muted)', fontSize:11 }}>{item.display_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function parseDay(dateStr) {
  if (!dateStr) return new Date();
  return new Date(dateStr.slice(0, 10) + 'T12:00:00');
}

export default function Overview({ project, setProject, onTabChange }) {
  const [editInfo, setEditInfo] = useState(false);
  const nav = useNavigate();
  const [scheduleDays, setScheduleDays] = useState([]);
  const [info, setInfo] = useState({ code: project.code, title: project.title, client: project.client, city: project.city, state: project.state, startDate: (project.start_date||project.startDate)?.slice(0,10), endDate: (project.end_date||project.endDate)?.slice(0,10), status: project.status, notes: project.notes || '' });
  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ name:'', address:'', type:'PRIMARY_VENUE', emoji:'', arrivalNotes:'' });
  const [editLocId, setEditLocId] = useState(null);   // location being edited in the modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [editContactId, setEditContactId] = useState(null);
  const [editContactForm, setEditContactForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [agencyForm, setAgencyForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [editAgencyId, setEditAgencyId] = useState(null);
  const [editAgencyForm, setEditAgencyForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [pocSaving, setPocSaving] = useState(false);
  const [sharePw, setSharePw] = useState(project.share_password || '');
  const [sharePwSaving, setSharePwSaving] = useState(false);
  const [sharePwSaved, setSharePwSaved] = useState(false);
  const [shares, setShares] = useState([]);
  const [copyToast, setCopyToast] = useState('');

  useEffect(() => {
    api.getShares(project.id).then(setShares).catch(() => {});
  }, [project.id]);

  async function copyShareLink(viewType) {
    let share = shares.find(s => s.view_type === viewType && !s.talent_name);
    if (!share) {
      share = await api.createShare(project.id, { viewType });
      setShares(prev => [...prev, share]);
    }
    const url = `${window.location.origin}/share/${share.token}`;
    await navigator.clipboard.writeText(url);
    setCopyToast(viewType);
    setTimeout(() => setCopyToast(''), 2000);
  }

  useEffect(() => {
    api.getSchedule(project.id).then(d => {
      setScheduleDays([...d].sort((a,b) => (a.date||'').localeCompare(b.date||'')));
    }).catch(() => {});
  }, [project.id]);

  async function saveDayType(dayId, value) {
    setScheduleDays(ds => ds.map(d => d.id === dayId ? { ...d, day_type: value } : d));
    try { await api.updateDay(project.id, dayId, { dayType: value }); } catch(e) { alert(e.message); }
  }

  async function saveInfo(e) {
    e.preventDefault();
    try {
      // code and client are locked (fed from the ProFi budget) — never send
      // them back: the displayed code can be the shoot code of another tile
      const { code, client, ...editable } = info;
      const updated = await api.updateProject(project.id, {
        ...editable,
        startDate: info.startDate ? new Date(info.startDate + 'T12:00:00').toISOString() : undefined,
        endDate: info.endDate ? new Date(info.endDate + 'T12:00:00').toISOString() : undefined,
      });
      setProject(p => ({ ...p, ...updated }));
      setInfo({ code: updated.code, title: updated.title, client: updated.client, city: updated.city, state: updated.state, startDate: (updated.start_date||updated.startDate)?.slice(0,10), endDate: (updated.end_date||updated.endDate)?.slice(0,10), status: updated.status, notes: updated.notes || '' });
      setEditInfo(false);
    } catch(e) { alert(e.message); }
  }

  async function saveSharePw(e) {
    e.preventDefault();
    setSharePwSaving(true);
    try {
      await api.updateProject(project.id, { sharePassword: sharePw || null });
      setSharePwSaved(true);
      setTimeout(() => setSharePwSaved(false), 2000);
    } catch(e) { alert(e.message); }
    setSharePwSaving(false);
  }

  async function savePoc(crewMemberId) {
    setPocSaving(true);
    try {
      await api.updateProject(project.id, { pocCrewMemberId: crewMemberId || null });
      setProject(p => ({ ...p, poc_crew_member_id: crewMemberId || null }));
    } catch(e) { alert(e.message); }
    setPocSaving(false);
  }

  async function addLocation(e) {
    e.preventDefault();
    try {
      if (editLocId) {
        const loc = await api.updateLocation(project.id, editLocId, locForm);
        setProject(p => ({ ...p, locations: p.locations.map(l => l.id === editLocId ? loc : l) }));
      } else {
        const loc = await api.createLocation(project.id, locForm);
        setProject(p => ({ ...p, locations: [...p.locations, loc] }));
      }
      setShowLocModal(false); setEditLocId(null); setLocForm({ name:'', address:'', type:'PRIMARY_VENUE', emoji:'', arrivalNotes:'' });
    } catch(e) { alert(e.message); }
  }

  function openEditLocation(l) {
    setLocForm({ name: l.name || '', address: l.address || '', type: l.type || 'PRIMARY_VENUE', emoji: l.emoji || '', arrivalNotes: l.arrival_notes || '' });
    setEditLocId(l.id);
    setShowLocModal(true);
  }

  async function deleteLocation(id) {
    if (!confirm('Remove this location?')) return;
    await api.deleteLocation(project.id, id);
    setProject(p => ({ ...p, locations: p.locations.filter(l => l.id !== id) }));
  }

  async function addContact(e) {
    e.preventDefault();
    try {
      const c = await api.createContact(project.id, contactForm);
      setProject(p => ({ ...p, clientContacts: [...p.clientContacts, c] }));
      setShowContactModal(false); setContactForm({ name:'', title:'', email:'', phone:'' });
    } catch(e) { alert(e.message); }
  }

  async function saveEditContact(e) {
    e.preventDefault();
    try {
      const c = await api.updateContact(project.id, editContactId, editContactForm);
      setProject(p => ({ ...p, clientContacts: p.clientContacts.map(x => x.id === editContactId ? c : x) }));
      setEditContactId(null);
    } catch(e) { alert(e.message); }
  }

  async function deleteContact(id) {
    await api.deleteContact(project.id, id);
    setProject(p => ({ ...p, clientContacts: p.clientContacts.filter(c => c.id !== id) }));
  }

  async function addAgencyContact(e) {
    e.preventDefault();
    try {
      const c = await api.createAgencyContact(project.id, agencyForm);
      setProject(p => ({ ...p, agencyContacts: [...(p.agencyContacts||[]), c] }));
      setShowAgencyModal(false); setAgencyForm({ name:'', title:'', email:'', phone:'' });
    } catch(e) { alert(e.message); }
  }

  async function saveEditAgency(e) {
    e.preventDefault();
    try {
      const c = await api.updateAgencyContact(project.id, editAgencyId, editAgencyForm);
      setProject(p => ({ ...p, agencyContacts: (p.agencyContacts||[]).map(x => x.id === editAgencyId ? c : x) }));
      setEditAgencyId(null);
    } catch(e) { alert(e.message); }
  }

  async function deleteAgencyContact(id) {
    await api.deleteAgencyContact(project.id, id);
    setProject(p => ({ ...p, agencyContacts: (p.agencyContacts||[]).filter(c => c.id !== id) }));
  }

  const assignedCrew = (project.crewAssignments || []).filter(a => a.crewMember);
  const pocId = project.poc_crew_member_id || '';
  const pocMember = assignedCrew.find(a => a.crewMember.id === pocId)?.crewMember || null;
  const gearPerson = project.gear?.gear_person_name ? {
    name: project.gear.gear_person_name,
    phone: project.gear.gear_person_phone,
    email: project.gear.gear_person_email,
  } : null;

  const startDate = project.start_date || project.startDate;
  const endDate = project.end_date || project.endDate;
  const shootDays = startDate && endDate
    ? Math.round((new Date(endDate.slice(0,10)+'T12:00:00') - new Date(startDate.slice(0,10)+'T12:00:00')) / 86400000) + 1
    : 0;

  const daysUntil = startDate
    ? Math.ceil((new Date(startDate.slice(0,10)+'T12:00:00') - new Date(new Date().toLocaleDateString('en-CA')+'T12:00:00')) / 86400000)
    : null;

  return (
    <div>
      {/* Header */}
      <div className="ov-head" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:18, borderBottom:'1px solid var(--border)', marginBottom:4 }}>
        <div>
          <button className="btn btn-ghost btn-sm" title="Open this project's budget to edit shoot details"
            onClick={() => nav(`/finance/${project.parent_project_id || project.id}`)}
            style={{ marginBottom:6, padding:'2px 10px', fontSize:11 }}>✎ Edit</button>
          <div className="proj-code">{project.code}</div>
          <div className="proj-title">{project.title}</div>
          {(project.shoot_name || project.subtitle) && (
            <div style={{ fontSize:13, fontWeight:700, color:'var(--orange)', marginTop:2 }}>Shoot: {project.shoot_name || project.subtitle}</div>
          )}
          <div className="proj-meta">
            <div className="meta"><span className="dot6" />{fmtDate(startDate)} – {fmtDate(endDate)}</div>
            <div className="meta"><span className="dot6" />{project.client}</div>
          </div>
          {project.notes && (
            <div style={{ marginTop:10, fontSize:13, color:'var(--muted)', maxWidth:480, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{project.notes}</div>
          )}
        </div>
        <div className="ov-head-actions" style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          {daysUntil != null && daysUntil > 0 && (
            <div className="ov-head-count" style={{ textAlign:'right', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px' }}>
              <div style={{ fontSize:22, fontWeight:700, color:'var(--orange)', lineHeight:1 }}>{daysUntil}</div>
              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>days until {project.title}</div>
            </div>
          )}
          {daysUntil != null && daysUntil === 0 && (
            <div className="ov-head-count" style={{ textAlign:'right', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--orange)' }}>Day 1 is today!</div>
            </div>
          )}
          <div className="ov-head-btns" style={{ display:'flex', alignItems:'center', gap:8 }}>
            <StatusSelect project={project} setProject={setProject} />
            <button className="btn btn-ghost btn-sm" onClick={() => setEditInfo(true)}>Edit Info</button>
          </div>
        </div>
      </div>

      {/* Public View Password */}
      <form onSubmit={saveSharePw} className="ov-pw-form" style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(232,80,10,0.12)', border:'1px solid rgba(232,80,10,0.45)', borderRadius:8, padding:'10px 14px', margin:'20px 0 10px' }}>
        <span style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap', color:'#fff', flexShrink:0 }}>Public PW</span>
        <input
          value={sharePw}
          onChange={e => { setSharePw(e.target.value.replace(/[^a-zA-Z0-9]/g, '')); setSharePwSaved(false); }}
          placeholder="No password set"
          style={{ width:140, flexShrink:0 }}
        />
        <div className="ov-pw-actions" style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button className="btn btn-ghost btn-sm" type="submit" disabled={sharePwSaving} style={{ color:'#fff' }}>
            {sharePwSaved ? 'Saved!' : sharePwSaving ? 'Saving…' : 'Save'}
          </button>
          {sharePw && <button type="button" className="btn btn-ghost btn-sm" style={{ color:'#fff' }} onClick={() => { setSharePw(''); }}>Clear</button>}
        </div>
        <div className="ov-pw-divider" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ color:'rgba(255,255,255,0.3)', fontSize:14, userSelect:'none' }}>|</span>
        </div>
        <div className="ov-quick-links" style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>Quick Copy Links</span>
          <div style={{ display:'flex', gap:4 }}>
          {['producer','crew','client'].map(vt => (
            <button key={vt} type="button" className="btn btn-ghost btn-sm" style={{ color:'#fff' }} onClick={() => copyShareLink(vt)}>
              {copyToast === vt ? '✓ Copied!' : `${vt.charAt(0).toUpperCase() + vt.slice(1)} View`}
            </button>
          ))}
          </div>
        </div>
      </form>

      {/* Main POC · Gear Contact · Client & Agency Contacts — one card */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:10 }}>
        <div className="ov-poc-row" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', width:160, flexShrink:0 }}>Main POC</span>
          <select value={pocId} onChange={e => savePoc(e.target.value)} style={{ width:'auto', minWidth:200, maxWidth:'100%', flexShrink:1 }}>
            <option value="">— Unassigned —</option>
            {assignedCrew.map(a => (
              <option key={a.crewMember.id} value={a.crewMember.id}>
                {displayName(a.crewMember)} — {a.position.name}
              </option>
            ))}
          </select>
          {pocSaving && <span style={{ fontSize:11, color:'var(--muted)' }}>Saving…</span>}
          {pocMember && !pocSaving && (
            <div style={{ fontSize:12, color:'var(--muted)', display:'flex', gap:16 }}>
              {pocMember.phone && <span style={{ color:'var(--tan)' }}><Tel v={pocMember.phone} /></span>}
              {pocMember.email && <span><Mail v={pocMember.email} /></span>}
            </div>
          )}
        </div>
        {gearPerson && (
          <div onClick={() => onTabChange?.('gear')} className="ov-poc-row"
            style={{ display:'flex', alignItems:'center', gap:12, borderTop:'1px solid var(--border2)', padding:'10px 16px', cursor:'pointer' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', width:160, flexShrink:0 }}>Gear Contact</span>
            <span style={{ fontWeight:500, fontSize:13, width:200, flexShrink:0 }}>{gearPerson.name}</span>
            {gearPerson.phone && <span style={{ fontSize:12, color:'var(--tan)' }}><Tel v={gearPerson.phone} /></span>}
            {gearPerson.email && <span style={{ fontSize:12, color:'var(--muted)' }}><Mail v={gearPerson.email} /></span>}
          </div>
        )}
        <div className="ov-poc-row" style={{ display:'flex', alignItems:'flex-start', gap:12, borderTop:'1px solid var(--border2)', padding:'10px 16px' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', width:160, flexShrink:0, paddingTop:4 }}>Client Contacts</span>
          <div style={{ flex:1, minWidth:0 }}>
            {project.clientContacts?.map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, padding:'3px 0', whiteSpace:'nowrap', overflow:'hidden' }}>
                <span style={{ fontWeight:700 }}>{c.name}</span>
                {c.title && <span style={{ color:'var(--muted)' }}>· {c.title}</span>}
                {c.phone && <span style={{ color:'var(--muted)' }}>· <Tel v={c.phone} /></span>}
                {c.email && <span style={{ color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis' }}>· <Mail v={c.email} /></span>}
                <span style={{ display:'flex', gap:4, marginLeft:'auto' }}>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => { setEditContactId(c.id); setEditContactForm({ name:c.name, title:c.title, email:c.email||'', phone:c.phone||'' }); }}>✎</button>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => deleteContact(c.id)}>✕</button>
                </span>
              </div>
            ))}
            {!project.clientContacts?.length && <span className="empty" style={{ padding:0, fontSize:12 }}>No client contacts yet.</span>}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ flexShrink:0 }} onClick={() => setShowContactModal(true)}>+ Add</button>
        </div>
        <div className="ov-poc-row" style={{ display:'flex', alignItems:'flex-start', gap:12, borderTop:'1px solid var(--border2)', padding:'10px 16px' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', width:160, flexShrink:0, paddingTop:4 }}>Agency Contacts</span>
          <div style={{ flex:1, minWidth:0 }}>
            {(project.agencyContacts||[]).map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, padding:'3px 0', whiteSpace:'nowrap', overflow:'hidden' }}>
                <span style={{ fontWeight:700 }}>{c.name}</span>
                {c.title && <span style={{ color:'var(--muted)' }}>· {c.title}</span>}
                {c.phone && <span style={{ color:'var(--muted)' }}>· <Tel v={c.phone} /></span>}
                {c.email && <span style={{ color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis' }}>· <Mail v={c.email} /></span>}
                <span style={{ display:'flex', gap:4, marginLeft:'auto' }}>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => { setEditAgencyId(c.id); setEditAgencyForm({ name:c.name, title:c.title, email:c.email||'', phone:c.phone||'' }); }}>✎</button>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => deleteAgencyContact(c.id)}>✕</button>
                </span>
              </div>
            ))}
            {!(project.agencyContacts?.length) && <span className="empty" style={{ padding:0, fontSize:12 }}>No agency contacts yet.</span>}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ flexShrink:0 }} onClick={() => setShowAgencyModal(true)}>+ Add</button>
        </div>
      </div>


      {/* Key Dates (left) + Contacts (right) */}
      <div className="ov-kd-grid" style={{ display:'grid', gap:20, marginBottom:20 }}>
        {/* Left: Key Dates */}
        <div className="ov-kd-dates">
          {scheduleDays.length > 0 && (
            <>
              <div className="sec-lbl" style={{ fontWeight:700, fontSize:12, color:'var(--text)' }}>Key Dates</div>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                {scheduleDays.map((d, i) => (
                  <div key={d.id} style={{ display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:12, padding:'10px 16px', borderBottom: i < scheduleDays.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize:13, fontWeight:600 }}>
                      Day {i + 1} · {parseDay(d.date).toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric' })}
                    </div>
                    <select
                      value={d.day_type || 'SHOOT'}
                      onChange={e => saveDayType(d.id, e.target.value)}
                      style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:12, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--orange)', cursor:'pointer', appearance:'none', WebkitAppearance:'none' }}
                    >
                      {DAY_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Crew */}
        <div className="ov-kd-contacts">
      {(project.crewAssignments||[]).length > 0 && (
        <>
          <div className="sec-lbl" style={{ fontWeight:700, fontSize:12, color:'var(--text)' }}>Crew</div>
          <div style={{ background:'rgba(232,80,10,0.12)', border:'1px solid rgba(232,80,10,0.45)', borderRadius:8, overflow:'hidden', marginBottom:20 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {(project.crewAssignments||[]).map((a, i) => (
                <div key={a.id} style={{ padding:'10px 16px', borderRight:'1px solid rgba(255,255,255,0.10)', borderBottom:'1px solid rgba(255,255,255,0.10)', display:'flex', flexDirection:'column', gap:2 }}>
                  <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', color:'rgba(251,146,60,0.85)', fontWeight:700 }}>{a.position?.name}{a.slotNumber > 1 ? ` ${a.slotNumber}` : ''}</div>
                  <div style={{ fontSize:13, fontWeight:600, color: a.crewMember ? '#fff' : 'rgba(255,255,255,0.4)', fontStyle: a.crewMember ? 'normal' : 'italic' }}>
                    {a.crewMember ? displayName(a.crewMember) : 'Unassigned'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
        </div>
      </div>

      {/* Edit Info Modal */}
      {editInfo && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditInfo(false)}>
          <div className="modal">
            <div className="modal-title">Edit Project Info</div>
            <form onSubmit={saveInfo}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Project Code</label><input value={info.code} disabled style={{ opacity:0.55, cursor:'not-allowed' }} /></div>
                <div className="field"><label>Title</label><input value={info.title} onChange={e => setInfo(i=>({...i,title:e.target.value}))} required /></div>
                <div className="field"><label>Client</label><input value={info.client} disabled style={{ opacity:0.55, cursor:'not-allowed' }} /></div>
                <div className="field"><label>Status</label>
                  <select value={info.status} onChange={e => setInfo(i=>({...i,status:e.target.value}))}>
                    {['PLANNING','ACTIVE','WRAPPED','ARCHIVED'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field"><label>Start Date</label><input type="date" value={info.startDate} onChange={e => setInfo(i=>({...i,startDate:e.target.value}))} /></div>
                <div className="field"><label>End Date</label><input type="date" value={info.endDate} onChange={e => setInfo(i=>({...i,endDate:e.target.value}))} /></div>
                <div className="field span2"><label>Notes</label><textarea value={info.notes} onChange={e => setInfo(i=>({...i,notes:e.target.value}))} /></div>
              </div>
              <div className="btn-row" style={{ alignItems:'center' }}>
                <button className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditInfo(false)}>Cancel</button>
                {(() => {
                  const on = (info.includePhoto ?? project.include_photo) !== false;
                  return (
                    <div onClick={() => setInfo(i => ({ ...i, includePhoto: !on }))}
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

      {/* Add Agency Contact Modal */}
      {showAgencyModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAgencyModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Agency Contact</div>
            <form onSubmit={addAgencyContact}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={agencyForm.name} onChange={e => setAgencyForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={agencyForm.title} onChange={e => setAgencyForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={agencyForm.email} onChange={e => setAgencyForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={agencyForm.phone} onChange={e => setAgencyForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Contact</button><button type="button" className="btn btn-ghost" onClick={() => setShowAgencyModal(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Agency Contact Modal */}
      {editAgencyId && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditAgencyId(null)}>
          <div className="modal">
            <div className="modal-title">Edit Agency Contact</div>
            <form onSubmit={saveEditAgency}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={editAgencyForm.name} onChange={e => setEditAgencyForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={editAgencyForm.title} onChange={e => setEditAgencyForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={editAgencyForm.email} onChange={e => setEditAgencyForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={editAgencyForm.phone} onChange={e => setEditAgencyForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditAgencyId(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Client Contact Modal */}
      {showContactModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowContactModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Client Contact</div>
            <form onSubmit={addContact}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={contactForm.name} onChange={e => setContactForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={contactForm.title} onChange={e => setContactForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={contactForm.email} onChange={e => setContactForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={contactForm.phone} onChange={e => setContactForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Contact</button><button type="button" className="btn btn-ghost" onClick={() => setShowContactModal(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Contact Modal */}
      {editContactId && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditContactId(null)}>
          <div className="modal">
            <div className="modal-title">Edit Client Contact</div>
            <form onSubmit={saveEditContact}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={editContactForm.name} onChange={e => setEditContactForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={editContactForm.title} onChange={e => setEditContactForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={editContactForm.email} onChange={e => setEditContactForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={editContactForm.phone} onChange={e => setEditContactForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditContactId(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
