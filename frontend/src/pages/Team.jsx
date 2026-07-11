import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import RosterLookup from '../components/RosterLookup.jsx';

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
  const { user, setUser } = useAuth();
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
        </Link>
        <span style={{ fontSize:12, color:BLUE, fontWeight:700, letterSpacing:'0.04em' }}>👥 Team Management</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
        <Link to="/crew-calendar" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Crew Calendar</Link>
        <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Back to Hub</Link>
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

const BLANK = { memberId:'', ptoType:'', title:'', startDate:'', endDate:'', onShoots:'', compNotes:'', managerId:'', notify:'' };

export default function Team() {
  const [rows, setRows] = useState(null);
  const [roster, setRoster] = useState([]);
  const [f, setF] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [closedOpen, setClosedOpen] = useState(false);
  const [view, setView] = useState('form'); // 'form' | 'pipeline'
  const { user } = useAuth();

  const displayOf = m => [m.preferred_first_name, m.preferred_last_name].filter(Boolean).join(' ').trim() || m.name;
  // Not selectable as requester or manager
  const EXCLUDED = ['allison boon', 'anna parnigoni', 'ariel lynch', 'brandon emery', 'cole seifert', 'dylan patterson', 'melinda love'];
  const selectable = roster.filter(m => !EXCLUDED.includes(displayOf(m).toLowerCase()));

  useEffect(() => {
    api.ptoList().then(setRows).catch(e => alert(e.message));
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
  const canSubmit = f.memberId && f.ptoType && f.title && f.startDate && f.endDate && f.onShoots && f.managerId;

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true);
    try {
      const row = await api.createPto(f);
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

  const th = { padding:'7px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', whiteSpace:'nowrap' };
  const td = { padding:'7px 10px', fontSize:12, verticalAlign:'middle' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <TeamHeader />
      <div style={{ maxWidth:1150, margin:'0 auto', padding:'6px 16px 80px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:4 }}>
          <div className="page-title" style={{ marginBottom:0 }}>Team Management</div>
          <div style={{ display:'flex', border:`1px solid ${BLUE}55`, borderRadius:16, overflow:'hidden' }}>
            {[['roster', 'Roster'], ['form', 'OOO Request'], ['pipeline', 'OOO Pipeline']].map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                style={{ background: view === v ? `${BLUE}2e` : 'transparent', border:'none', color: view === v ? BLUE : 'var(--muted)', padding:'6px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {view === 'roster' && <div style={{ maxWidth:760, margin:'12px auto 0' }}><RosterLookup /></div>}
        {view === 'form' && (
        <>
        <div style={{ maxWidth:680, margin:'0 auto' }}>
        <div style={{ fontSize:12, color:'#e05252', fontWeight:700, margin:'8px 0 16px' }}>
          Please remember to send your Backup Plan document with coverage for your ongoing projects before taking PTO.
        </div>

        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${BLUE}`, borderRadius:12, padding:'18px 20px', marginBottom:30 }}>
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
            <div>
              <span style={lbl}>Manager's Name (Must be person who approves your timecards) *</span>
              <MemberSelect roster={selectable} value={f.managerId} onChange={v => setF(x => ({ ...x, managerId: v }))} />
            </div>
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
        {!rows && <div className="empty">Loading…</div>}
        {rows && GROUPS.map(([key, label, color]) => {
          const group = rows.filter(r => r.status === key);
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
                <div className="budget-tbl-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10 }}>
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
        })}
        <div style={{ fontSize:10, color:'var(--muted)' }}>
          Approving a request moves it to the PTO/WFH Calendar; once the end date passes it closes automatically. All requests appear on the Crew Calendar.
        </div>
        </div>
        )}
      </div>
    </div>
  );
}
