import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import { maybeMailNotice } from '../utils/mailNotice.js';
import RosterLookup from '../components/RosterLookup.jsx';
import { HubBottomNav } from './Hub.jsx';
import HomeButton from '../components/HomeButton.jsx';
import GlassDock from '../components/GlassDock.jsx';

const BLUE = '#4a9eff';
const PTO_TYPES = ['PTO', 'WFH', 'STL/DEN Only', 'Comp', 'Other OOO'];
const TYPE_COLORS = { 'PTO': '#4a9eff', 'WFH': '#5ABF80', 'STL/DEN Only': '#d66a9b', 'Comp': '#e6c229', 'Other OOO': '#a78bfa' };
const GROUPS = [
  ['REVIEW', 'Request In Review', '#a78bfa'],
  ['APPROVED', 'PTO/WFH Calendar', '#5ABF80'],
  ['CLOSED', 'Closed', '#8a8f98'],
];
const lbl = { fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, display:'block' };
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '—';

function TeamHeader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', gap:10 }}>
      <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
        <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
      </Link>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <Link to="/crew-calendar" className="evt-glass" style={{ textDecoration:'none' }}>Crew Calendar</Link>
        <HomeButton />
      </div>
    </div>
  );
}

function MemberSelect({ roster, value, onChange, placeholder = '— Select —' }) {
  const display = m => [m.preferred_first_name, m.preferred_last_name].filter(Boolean).join(' ').trim() || m.name;
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {[...roster].sort((a, b) => display(a).localeCompare(display(b))).map(m => <option key={m.id} value={m.id}>{display(m)}</option>)}
    </select>
  );
}

// City search backed by Google (falls back to OSM) — the resolved city feeds
// into people's custom Hub greetings.
function CityField({ value, onChange }) {
  const [sugs, setSugs] = useState([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);
  const onType = v => {
    onChange(v);
    clearTimeout(timer.current);
    if (v.trim().length < 3) { setSugs([]); setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try { const r = await api.placeSearch(v.trim()); setSugs(r || []); setOpen(true); }
      catch { setSugs([]); }
      setSearching(false);
    }, 350);
  };
  // Prefer a clean "City, ST" from the formatted address; fall back to the name.
  const cityFrom = sg => {
    const parts = String(sg.address || '').split(',').map(s => s.trim()).filter(Boolean);
    const st = parts.find(p => /\b[A-Z]{2}\b/.test(p) && !/\d/.test(p));
    const city = sg.name || parts[0] || '';
    const stAbbr = st ? (st.match(/\b[A-Z]{2}\b/) || [])[0] : '';
    return stAbbr ? `${city}, ${stAbbr}` : city;
  };
  return (
    <div style={{ position:'relative' }}>
      <input value={value} placeholder="Search a city…" onChange={e => onType(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {searching && <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>searching…</div>}
      {open && sugs.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:120, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, maxHeight:200, overflowY:'auto' }}>
          {sugs.map((sg, i) => (
            <div key={i} onMouseDown={() => { onChange(cityFrom(sg)); setOpen(false); setSugs([]); }}
              style={{ padding:'7px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:12 }}>
              <div style={{ fontWeight:600 }}>{sg.name}</div>
              <div style={{ color:'var(--muted)', fontSize:10.5 }}>{sg.address}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const BLANK = { memberId:'', ptoType:'', title:'', startDate:'', endDate:'', onShoots:'', compNotes:'', managerId:'', notify:'' };
const EVT_BLANK = { name:'', startDate:'', endDate:'', location:'', people:[] };
const EVT = '#E8500A';

export default function Team() {
  const [rows, setRows] = useState(null);
  const [roster, setRoster] = useState([]);
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const [myView, setMyView] = useState(false);   // pipeline: only my requests (assignee or supervisor)
  const [events, setEvents] = useState(null);
  const [ef, setEf] = useState(EVT_BLANK);
  const [evtOpen, setEvtOpen] = useState(false);   // Misc. Event form expanded
  const [evtSaving, setEvtSaving] = useState(false);
  const [editingId, setEditingId] = useState(null); // event being edited (null = new)
  // Open on the OOO Pipeline when linked with ?view=pipeline (e.g. from the
  // Crew Calendar PTO/OOO blocks); otherwise default to the request form.
  const [view, setView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    return ['roster', 'form', 'pipeline', 'events'].includes(v) ? v : 'form';
  });
  const { user } = useAuth();
  // Solutions (AGENCY) OOO requests skip manager approval and go straight to the pipeline.
  const isSolutions = user?.role === 'AGENCY';

  const displayOf = m => [m.preferred_first_name, m.preferred_last_name].filter(Boolean).join(' ').trim() || m.name;
  // Not selectable as requester or manager
  const EXCLUDED = ['allison boon', 'anna parnigoni', 'ariel lynch', 'brandon emery', 'cole seifert', 'dylan patterson', 'melinda love'];
  const selectable = roster.filter(m => !EXCLUDED.includes(displayOf(m).toLowerCase()));

  useEffect(() => {
    api.ptoList().then(setRows).catch(e => alert(e.message));
    api.miscEvents().then(setEvents).catch(() => setEvents([]));
    api.getCrew().then(cs => setRoster(cs.filter(m => (m.company || '').toLowerCase().includes('unbridled')))).catch(() => setRoster([]));
  }, []);

  // Requester defaults to whoever is signed in (matched by email)
  useEffect(() => {
    if (!roster.length || !user?.email) return;
    const me = roster.find(m => (m.email || '').toLowerCase() === user.email.toLowerCase());
    if (me) setF(v => v.memberId ? v : { ...v, memberId: me.id });
  }, [roster, user?.email]);

  // Title auto-fills as "Name - Type" until it's manually edited
  const lastAuto = useRef('');
  useEffect(() => {
    const m = roster.find(x => x.id === f.memberId);
    const t = m && f.ptoType ? `${displayOf(m)} - ${f.ptoType}` : '';
    if (t) {
      setF(v => (!v.title || v.title === lastAuto.current) ? { ...v, title: t } : v);
      lastAuto.current = t;
    }
  }, [f.memberId, f.ptoType, roster.length]);

  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const canSubmit = f.memberId && f.ptoType && f.title && f.startDate && f.endDate && f.onShoots && (isSolutions || f.managerId);

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const row = await api.createPto(f);
      if (!isSolutions) maybeMailNotice("The manager's approval-request email");
      setRows(rs => [...(rs || []), row]);
      setF(BLANK);
      setView('pipeline');
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  async function patch(id, data) {
    try { const row = await api.updatePto(id, data); setRows(rs => rs.map(r => r.id === id ? row : r)); }
    catch (e) { alert(e.message); }
  }
  async function remove(id, title) {
    if (!confirm(`Delete "${title}"?`)) return;
    try { await api.deletePto(id); setRows(rs => rs.filter(r => r.id !== id)); }
    catch (e) { alert(e.message); }
  }

  const canSubmitEvt = ef.name.trim() && ef.startDate && ef.endDate;
  function editEvent(e) {
    setEf({
      name: e.name || '', startDate: String(e.start_date || '').slice(0, 10),
      endDate: String(e.end_date || '').slice(0, 10), location: e.location || '',
      people: e.people || [],
    });
    setEditingId(e.id);
    setEvtOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelEdit() { setEf(EVT_BLANK); setEditingId(null); setEvtOpen(false); }
  async function submitEvent() {
    if (!canSubmitEvt || evtSaving) return;
    setEvtSaving(true);
    try {
      if (editingId) {
        const row = await api.updateMiscEvent(editingId, ef);
        setEvents(es => es.map(e => e.id === editingId ? row : e));
      } else {
        const row = await api.createMiscEvent(ef);
        setEvents(es => [...(es || []), row]);
      }
      setEf(EVT_BLANK); setEvtOpen(false); setEditingId(null);
    } catch (e) { alert(e.message); }
    setEvtSaving(false);
  }
  async function removeEvent(id, name) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await api.deleteMiscEvent(id); setEvents(es => es.filter(e => e.id !== id)); if (editingId === id) cancelEdit(); }
    catch (e) { alert(e.message); }
  }

  const th = { padding:'7px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', whiteSpace:'nowrap' };
  const td = { padding:'7px 10px', fontSize:12, verticalAlign:'middle' };

  return (
    <div style={{ minHeight:'100vh', background:'transparent' }}>
      <TeamHeader />
      <HubBottomNav />
      <div style={{ maxWidth:1150, margin:'0 auto', padding:'6px 16px 110px' }}>
        <GlassDock top active={view} onSelect={setView} items={[
          { key:'roster', label:'Roster', color:BLUE, icon:(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5"/><circle cx="17" cy="9" r="2.4"/><path d="M16.5 14.7c2.9.3 5 2.1 5 4.8"/></svg>
          )},
          { key:'form', label:'OOO Request', color:BLUE, icon:(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18M12 13.5v4M10 15.5h4"/></svg>
          )},
          { key:'pipeline', label:'OOO Pipeline', color:BLUE, icon:(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2.2"/></svg>
          )},
          { key:'events', label:'Event Pipeline', color:EVT, icon:(
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M12 12.6l.95 1.92 2.12.31-1.53 1.49.36 2.11L12 18.44l-1.9 1 .36-2.11-1.53-1.49 2.12-.31z"/></svg>
          )},
        ]} />
        {view === 'roster' && <div style={{ maxWidth:760, margin:'12px auto 0' }}><RosterLookup /></div>}
        {view === 'form' && (
        <>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
        <div style={{ fontSize:12, color:'#e05252', fontWeight:700, margin:'8px 0 16px' }}>
          Please remember to send your Backup Plan document with coverage for your ongoing projects before taking PTO.
        </div>

        <div className="glass" style={{ borderTop:`3px solid ${BLUE}`, borderRadius:14, padding:'18px 20px', marginBottom:30 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(230px, 1fr))', gap:14 }}>
            <div>
              <span style={lbl}>Who is requesting PTO and/or OOO? *</span>
              <MemberSelect roster={selectable} value={f.memberId} onChange={v => setF(x => ({ ...x, memberId: v }))} />
            </div>
            <div>
              <span style={lbl}>PTO Type *</span>
              <select value={f.ptoType} onChange={set('ptoType')}>
                <option value="">Select option…</option>
                {PTO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <span style={lbl}>Type your first name followed by brief description of request (Example: Derik OOO Vacation or Derik STL ONLY) *</span>
              <input value={f.title} onChange={set('title')} placeholder="Enter text" />
            </div>
            <div>
              <span style={lbl}>Start date of PTO or OOO *</span>
              <input type="date" value={f.startDate} onChange={set('startDate')} />
            </div>
            <div>
              <span style={lbl}>End Date of PTO or OOO *</span>
              <input type="date" value={f.endDate} onChange={set('endDate')} />
            </div>
            {!isSolutions && (
              <div>
                <span style={lbl}>Manager's Name (Must be person who approves your timecards) *</span>
                <MemberSelect roster={selectable} value={f.managerId} onChange={v => setF(x => ({ ...x, managerId: v }))} />
              </div>
            )}
            <div>
              <span style={lbl}>Are you currently assigned to any shoots/travel for these dates? *</span>
              <select value={f.onShoots} onChange={set('onShoots')}>
                <option value="">Select option…</option>
                <option>No</option>
                <option>Yes</option>
                <option>Not sure</option>
              </select>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <span style={lbl}>If comp, please provide project code and production dates responsible for this comp time.</span>
              <input value={f.compNotes} onChange={set('compNotes')} placeholder="Enter text" />
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <span style={lbl}>Are there any other team members that you would like to notify about this request?</span>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[...selectable].sort((a, b) => displayOf(a).localeCompare(displayOf(b))).filter(m => m.id !== f.memberId).map(m => {
                  const name = displayOf(m);
                  const picked = f.notify.split(', ').filter(Boolean);
                  const on = picked.includes(name);
                  return (
                    <button key={m.id} type="button"
                      onClick={() => setF(v => ({ ...v, notify: (on ? picked.filter(n => n !== name) : [...picked, name]).join(', ') }))}
                      style={{
                        background: on ? `${BLUE}2e` : 'transparent', border:`1px solid ${on ? BLUE : 'var(--border)'}`,
                        color: on ? BLUE : 'var(--muted)', borderRadius:14, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer',
                      }}>
                      {on ? '✓ ' : ''}{name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
            <button disabled={!canSubmit || saving} onClick={submit}
              style={{ background: canSubmit ? BLUE : 'var(--border)', border:'none', color: canSubmit ? '#0b0b0b' : 'var(--muted)', borderRadius:8, padding:'9px 26px', fontSize:13, fontWeight:800, cursor: canSubmit ? 'pointer' : 'default' }}>
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </div>
        </div>
        </>
        )}

        {/* ── Pipeline ── */}
        {view === 'pipeline' && (
        <div style={{ marginTop:16 }}>
        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
          <button onClick={() => setMyView(v => !v)}
            title="Only requests where you are the assignee or the supervisor"
            style={myView
              ? { background:`${BLUE}2e`, border:`1px solid ${BLUE}`, color:BLUE, borderRadius:16, padding:'5px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }
              : { background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:16, padding:'5px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
            {myView ? '✓ ' : ''}My View
          </button>
        </div>
        {!rows && <div className="empty">Loading…</div>}
        {rows && (() => {
          const meId = (roster.find(m => (m.email || '').toLowerCase() === (user?.email || '').toLowerCase()) || {}).id;
          const shown = myView && meId ? rows.filter(r => r.member_id === meId || r.manager_id === meId) : rows;
          return GROUPS.map(([key, label, color]) => {
          const group = shown.filter(r => r.status === key);
          const collapsed = key === 'CLOSED' && !closedOpen;
          return (
            <div key={key} style={{ marginBottom:20 }}>
              <div onClick={() => key === 'CLOSED' && setClosedOpen(o => !o)}
                style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:8, cursor: key === 'CLOSED' ? 'pointer' : 'default' }}>
                <span style={{ background:`${color}22`, border:`1px solid ${color}`, color, borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em' }}>
                  {key === 'CLOSED' ? (closedOpen ? '▾ ' : '▸ ') : ''}{label}
                </span>
                <span style={{ fontSize:11, color:'var(--muted)' }}>{group.length}</span>
              </div>
              {!collapsed && group.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', padding:'2px 4px 6px' }}>Nothing here.</div>}
              {!collapsed && group.length > 0 && (
                <div className="budget-tbl-wrap glass" style={{ borderRadius:12 }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', minWidth:860 }}>
                    <thead>
                      <tr>
                        <th style={th}>Name</th><th style={th}>Assignee</th><th style={th}>Start</th><th style={th}>End</th>
                        <th style={th}>PTO Type</th><th style={th}>Supervisor</th><th style={{ ...th, textAlign:'center' }}>Approved</th>
                        <th style={th}>Comp Reference</th><th style={{ ...th, width:34 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map(r => {
                        const tc = TYPE_COLORS[r.pto_type] || BLUE;
                        return (
                          <tr key={r.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ ...td, fontWeight:700 }}>{r.title}</td>
                            <td style={td}>{r.member_name || '—'}</td>
                            <td style={{ ...td, whiteSpace:'nowrap' }}>{fmtD(r.start_date)}</td>
                            <td style={{ ...td, whiteSpace:'nowrap' }}>{fmtD(r.end_date)}</td>
                            <td style={td}>
                              <select value={r.pto_type} onChange={e => patch(r.id, { ptoType: e.target.value })}
                                style={{ width:'auto', background:`${tc}22`, border:`1px solid ${tc}`, color:tc, fontWeight:700, fontSize:11, borderRadius:12, padding:'3px 8px' }}>
                                {PTO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                            </td>
                            <td style={td}>{r.manager_name || '—'}</td>
                            <td style={{ ...td, textAlign:'center' }}>
                              {r.status === 'CLOSED' ? (
                                <span style={{ fontSize:9, fontWeight:800, color:'var(--muted)' }}>✓ Approved</span>
                              ) : (
                                <button title={r.status === 'APPROVED' ? 'Click to move back to review' : 'Approve this request'}
                                  onClick={() => patch(r.id, { approved: r.status !== 'APPROVED' })}
                                  style={r.status === 'APPROVED'
                                    ? { background:'#5ABF80', border:'1px solid #5ABF80', color:'#0b0b0b', borderRadius:12, padding:'3px 12px', fontSize:9, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }
                                    : { background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:12, padding:'3px 12px', fontSize:9, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                                  {r.status === 'APPROVED' ? '✓ Approved' : 'Approve'}
                                </button>
                              )}
                            </td>
                            <td style={{ ...td, color:'var(--muted)' }}>{r.comp_notes || '—'}</td>
                            <td style={{ ...td, textAlign:'center' }}>
                              <button title="Delete request" onClick={() => remove(r.id, r.title)}
                                style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        }); })()}
        <div style={{ fontSize:10, color:'var(--muted)' }}>
          Approving a request moves it to the PTO/WFH Calendar; once the end date passes it closes automatically. All requests appear on the Crew Calendar.
        </div>
        </div>
        )}

        {/* ── Event Pipeline ── */}
        {view === 'events' && (
        <div style={{ marginTop:16 }}>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
          {/* Condensed Misc. Event form — expands on click */}
          <div className="glass" style={{ borderTop:`3px solid ${EVT}`, borderRadius:14, marginBottom:26, overflow:'hidden' }}>
            <div onClick={() => setEvtOpen(o => !o)}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'14px 18px', cursor:'pointer' }}>
              <div style={{ fontSize:13, fontWeight:800, color:'var(--text)' }}>{editingId ? 'Edit Event' : 'Add a Misc. Event'}
                <span style={{ fontSize:11, fontWeight:500, color:'var(--muted)', marginLeft:8 }}>golf tournaments, retreats, office visits…</span>
              </div>
              <span aria-hidden style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:26, height:26, borderRadius:8, border:'1px solid var(--border)', color:EVT, fontSize:13, fontWeight:800 }}>
                {evtOpen ? '–' : '+'}
              </span>
            </div>
            {evtOpen && (
              <div style={{ padding:'0 18px 18px' }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(230px, 1fr))', gap:14 }}>
                  <div style={{ gridColumn:'1 / -1' }}>
                    <span style={lbl}>Name of Event *</span>
                    <input value={ef.name} onChange={e => setEf(v => ({ ...v, name: e.target.value }))} placeholder="e.g. Company Retreat" />
                  </div>
                  <div>
                    <span style={lbl}>Start Date *</span>
                    <input type="date" value={ef.startDate} onChange={e => setEf(v => ({ ...v, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <span style={lbl}>End Date *</span>
                    <input type="date" value={ef.endDate} onChange={e => setEf(v => ({ ...v, endDate: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn:'1 / -1' }}>
                    <span style={lbl}>Location <span style={{ textTransform:'none', letterSpacing:0, fontWeight:400 }}>— search a city (feeds custom greetings)</span></span>
                    <CityField value={ef.location} onChange={v => setEf(x => ({ ...x, location: v }))} />
                  </div>
                  <div style={{ gridColumn:'1 / -1' }}>
                    <span style={lbl}>People</span>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {[...selectable].sort((a, b) => displayOf(a).localeCompare(displayOf(b))).map(m => {
                        const on = ef.people.includes(m.id);
                        return (
                          <button key={m.id} type="button"
                            onClick={() => setEf(v => ({ ...v, people: on ? v.people.filter(id => id !== m.id) : [...v.people, m.id] }))}
                            style={{
                              background: on ? `${EVT}2e` : 'transparent', border:`1px solid ${on ? EVT : 'var(--border)'}`,
                              color: on ? EVT : 'var(--muted)', borderRadius:14, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer',
                            }}>
                            {on ? '✓ ' : ''}{displayOf(m)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
                  {editingId && (
                    <button onClick={cancelEdit}
                      style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:8, padding:'9px 20px', fontSize:13, fontWeight:800, cursor:'pointer' }}>
                      Cancel
                    </button>
                  )}
                  <button disabled={!canSubmitEvt || evtSaving} onClick={submitEvent}
                    style={{ background: canSubmitEvt ? EVT : 'var(--border)', border:'none', color: canSubmitEvt ? '#0b0b0b' : 'var(--muted)', borderRadius:8, padding:'9px 26px', fontSize:13, fontWeight:800, cursor: canSubmitEvt ? 'pointer' : 'default' }}>
                    {evtSaving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Event'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Event list */}
        {!events && <div className="empty">Loading…</div>}
        {events && (
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <span style={{ background:`${EVT}22`, border:`1px solid ${EVT}`, color:EVT, borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em' }}>Events</span>
              <span style={{ fontSize:11, color:'var(--muted)' }}>{events.length}</span>
            </div>
            {events.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', padding:'2px 4px 6px' }}>No events yet.</div>}
            {events.length > 0 && (
              <div className="budget-tbl-wrap glass" style={{ borderRadius:12 }}>
                <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
                  <thead>
                    <tr>
                      <th style={th}>Event</th><th style={th}>Start</th><th style={th}>End</th>
                      <th style={th}>Location</th><th style={th}>People</th><th style={{ ...th, width:64 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(e => (
                      <tr key={e.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ ...td, fontWeight:700 }}>{e.name}</td>
                        <td style={{ ...td, whiteSpace:'nowrap' }}>{fmtD(e.start_date)}</td>
                        <td style={{ ...td, whiteSpace:'nowrap' }}>{fmtD(e.end_date)}</td>
                        <td style={td}>{e.location || '—'}</td>
                        <td style={td}>
                          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                            {(e.peopleNames || []).length ? e.peopleNames.map(n => (
                              <span key={n} style={{ fontSize:10, fontWeight:700, color:EVT, background:`${EVT}1a`, border:`1px solid ${EVT}`, borderRadius:100, padding:'1px 9px', whiteSpace:'nowrap' }}>{n}</span>
                            )) : <span style={{ color:'var(--muted)' }}>—</span>}
                          </div>
                        </td>
                        <td style={{ ...td, textAlign:'center', whiteSpace:'nowrap' }}>
                          <button title="Edit event" onClick={() => editEvent(e)}
                            style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', padding:'0 6px', verticalAlign:'middle' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                          </button>
                          <button title="Delete event" onClick={() => removeEvent(e.id, e.name)}
                            style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer', padding:'0 6px', verticalAlign:'middle' }}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        <div style={{ fontSize:10, color:'var(--muted)' }}>
          Events act as out-of-office and appear on the Crew Calendar for every tagged person.
        </div>
        </div>
        )}
      </div>
    </div>
  );
}
