import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';
import GearGantt, { countdownLabel } from '../components/GearGantt.jsx';
import GearRequestModal from '../components/GearRequestModal.jsx';
import AssetLookup from '../components/AssetLookup.jsx';

// Gear Manager report — every production shoot at a glance, ordered by start
// date. Shoots with a submitted gear request render in full color; shoots
// without one are greyed out so the gaps jump out.
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : 'TBD';
const th = { padding: '8px 12px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '8px 12px', fontSize: 12, verticalAlign: 'middle' };

const Check = ({ on, label }) => on
  ? <span style={{ color: '#5ABF80', fontWeight: 700, fontSize: 11 }}>✓ {label || ''}</span>
  : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>;

const CAT_LABEL = { camera:'Camera', grip:'Grip', electric:'Electric', audio:'Audio', media_management:'Media Management', editing:'Editing', other:'Other' };

// Printable check-out list of a shoot's INTERNAL gear — opens the browser
// print dialog over a clean black-on-white checklist.
async function printInternalChecklist(r) {
  const items = (await api.getGearItems(r.id)).filter(i => i.source === 'internal');
  const SITE_LABEL = { STL: 'St. Louis', DEN: 'Denver' };
  const bySite = {};
  for (const i of items) (bySite[i.contractor_name || ''] ||= []).push(i);
  const rows = Object.entries(bySite).map(([site, siteItems]) => {
    const byCat = {};
    for (const i of siteItems) (byCat[i.category] ||= []).push(i);
    return `
    ${site || Object.keys(bySite).length > 1 ? `<h1 class="site">${SITE_LABEL[site] || site || 'Office not set'}</h1>` : ''}
    ${Object.entries(byCat).map(([cat, list]) => `
      <h2>${CAT_LABEL[cat] || cat}</h2>
      ${list.map(i => `<div class="row"><span class="box"></span><b>${Number(i.qty) > 1 ? i.qty + '× ' : ''}</b>${i.item}${i.notes ? `<span class="note"> — ${i.notes}</span>` : ''}</div>`).join('')}`).join('')}`;
  }).join('');
  const w = window.open('', '_blank');
  w.document.write(`<!doctype html><html><head><title>Internal Gear — ${r.code}</title><style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 40px; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    h1.site { font-size: 14px; margin: 22px 0 0; color: #E8500A; }
    .sub { color: #555; font-size: 12px; margin-bottom: 18px; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1.5px solid #111; padding-bottom: 3px; margin: 18px 0 6px; }
    .row { display: flex; align-items: center; gap: 10px; font-size: 13px; padding: 5px 0; border-bottom: 1px solid #e5e5e5; }
    .box { width: 14px; height: 14px; border: 1.5px solid #111; border-radius: 3px; flex-shrink: 0; }
    .note { color: #666; font-size: 11px; }
    .sig { margin-top: 34px; display: flex; gap: 40px; font-size: 12px; color: #444; }
    .sig div { flex: 1; border-top: 1px solid #111; padding-top: 4px; }
  </style></head><body>
    <h1>Internal Gear Check-Out — ${r.code} · ${r.title}</h1>
    <div class="sub">${r.start_date ? new Date(String(r.start_date).slice(0,10)+'T12:00:00').toLocaleDateString() : 'Dates TBD'}${r.end_date ? ' – ' + new Date(String(r.end_date).slice(0,10)+'T12:00:00').toLocaleDateString() : ''}${r.request_name ? ' · Requested by ' + r.request_name : ''} · ${items.length} line item${items.length !== 1 ? 's' : ''}</div>
    ${rows || '<div style="color:#666; font-style:italic;">No internal gear assigned yet.</div>'}
    <div class="sig"><div>Checked out by / date</div><div>Checked in by / date</div></div>
  </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export default function GearReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [mode, setMode] = useState('shoots');      // 'shoots' | 'assets'
  const [showForm, setShowForm] = useState(false); // + New Gear Request
  const [viewing, setViewing] = useState(null);    // quick-view of a submitted request
  const [gearMgr, setGearMgr] = useState(null);

  const load = () => api.gearReport().then(setRows).catch(e => alert(e.message));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.getCrew().then(cs => {
      const m = cs.find(c => `${c.preferred_first_name || ''} ${c.preferred_last_name || ''}`.trim().toLowerCase() === 'mason vitro'
        || (c.name || '').toLowerCase() === 'mason vitro');
      setGearMgr(m || null);
    }).catch(() => {});
  }, []);

  async function quickView(e, pid) {
    e.stopPropagation();
    try { setViewing(await api.gearRequestForProject(pid)); }
    catch { alert('Could not load the gear request.'); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (rows || []).filter(r => !r.end_date || String(r.end_date).slice(0, 10) >= today);
  const past = (rows || []).filter(r => r.end_date && String(r.end_date).slice(0, 10) < today);
  const shown = showPast ? [...upcoming, ...past] : upcoming;
  const requested = upcoming.filter(r => r.request_submitted).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: '#e6c229', fontWeight: 700, letterSpacing: '0.04em' }}>Reports</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>
      <div style={{ maxWidth: 1150, margin: '0 auto', padding: '10px 16px 60px' }}>
        {gearMgr && (
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(232,80,10,0.08)', border:'1px solid rgba(232,80,10,0.4)', borderRadius:10, padding:'8px 14px', marginBottom:12 }}>
            <span style={{ fontSize:16 }}>🎒</span>
            <div>
              <div style={{ fontSize:12, fontWeight:800 }}>Gear Manager — {[gearMgr.preferred_first_name, gearMgr.preferred_last_name].filter(Boolean).join(' ') || gearMgr.name}</div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>
                {[gearMgr.email && <a key="e" href={`mailto:${gearMgr.email}`} style={{ color:'var(--orange)', textDecoration:'none' }}>{gearMgr.email}</a>,
                  gearMgr.phone && <a key="p" href={`tel:${String(gearMgr.phone).replace(/[^+\d]/g, '')}`} style={{ color:'var(--orange)', textDecoration:'none' }}>{gearMgr.phone}</a>]
                  .filter(Boolean).reduce((acc, el) => acc === null ? [el] : [...acc, ' · ', el], null) || 'Gear questions go here first.'}
              </div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Gear Report</div>
            <div className="page-sub">
              Every shoot reporting into FreePro, by start date — greyed shoots haven't submitted a gear request yet
              {rows && <span> · <b style={{ color: '#5ABF80' }}>{requested}</b> of {upcoming.length} upcoming shoots requested</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowPast(p => !p)}>
              {showPast ? 'Hide past shoots' : `Show past shoots (${past.length})`}
            </button>
            <button className={mode === 'assets' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setMode(m => m === 'assets' ? 'shoots' : 'assets')}>
              {mode === 'assets' ? '‹ Back to Shoots' : 'Asset Management'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ New Gear Request</button>
          </div>
        </div>
        {mode === 'assets' && <div style={{ marginTop:14 }}><AssetLookup /></div>}
        {mode === 'shoots' && rows && shown.length > 0 && (
          <div style={{ marginTop:12 }}><GearGantt rows={shown} onOpen={pid => nav(`/gear/${pid}`)} /></div>
        )}
        {mode === 'shoots' && !rows && <div className="empty">Loading…</div>}
        {mode === 'shoots' && rows && (
          <div className="budget-tbl-wrap" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ ...th, background: 'rgba(232,80,10,0.15)', color: 'var(--orange)', textAlign: 'center' }}>Countdown</th>
                  <th style={th}>Shoot Code</th><th style={th}>Shoot Name</th>
                  <th style={th}>Person Responsible</th>
                  <th style={th}>Start</th><th style={th}>End</th>
                  <th style={th}>Travel</th>
                  <th style={th}>Gear Request</th>
                  <th style={th}>Request Name</th>
                  <th style={th}>Needs Assignment</th>
                  <th style={{ ...th, borderLeft: '1px solid var(--border)' }}>Internal Gear</th>
                  <th style={th}>Online Rental</th><th style={th}>Rental House</th><th style={th}>Contractor(s)</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const on = !!r.request_submitted;
                  return (
                    <tr key={r.id} onClick={() => nav(`/gear/${r.id}`)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                        opacity: on ? 1 : 0.45, filter: on ? 'none' : 'grayscale(0.7)', transition: 'opacity .15s ease' }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.opacity = 0.75; }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.opacity = 0.45; }}>
                      <td style={{ ...td, background: 'rgba(232,80,10,0.12)', color: 'var(--orange)', fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap' }}>{countdownLabel(r.start_date)}</td>
                      <td style={{ ...td, fontWeight: 700, color: 'var(--orange)', whiteSpace: 'nowrap' }}>{r.code}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                        {r.subtitle && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.subtitle}</div>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.person_responsible || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtD(r.start_date)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtD(r.end_date)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.form_of_travel || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {on
                          ? <span onClick={e => quickView(e, r.id)} title="Quick view the submitted request"
                              style={{ background: 'rgba(90,191,128,0.15)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              ✓ {fmtD(r.request_submitted)}
                            </span>
                          : <span style={{ border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>Not requested</span>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.request_name || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        {Number(r.unassigned_items) > 0
                          ? <span title={`${r.unassigned_items} gear item${Number(r.unassigned_items) !== 1 ? 's' : ''} not yet assigned to a source`}
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%',
                                background: 'rgba(90,191,128,0.18)', border: '1.5px solid #5ABF80', color: '#5ABF80', fontSize: 12, fontWeight: 900 }}>!</span>
                          : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}
                      </td>
                      <td style={{ ...td, borderLeft: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                        <Check on={on || r.internal_request_submitted} />
                        {Number(r.internal_items) > 0 && (
                          <button onClick={e => { e.stopPropagation(); printInternalChecklist(r).catch(err => alert(err.message)); }}
                            title="Print the internal gear check-out list"
                            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, marginLeft: 8, padding: '2px 6px', cursor: 'pointer', color: 'var(--muted)', verticalAlign: 'middle', lineHeight: 0 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 17h10v4H7z"/></svg>
                          </button>
                        )}
                      </td>
                      <td style={td}>{Number(r.online_rentals) > 0
                        ? <span style={{ color: '#4a9eff', fontWeight: 700, fontSize: 11 }}>✓ {r.online_rentals} rental{Number(r.online_rentals) !== 1 ? 's' : ''}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}</td>
                      <td style={td}>{r.rental_company
                        ? <span style={{ color: '#e6c229', fontWeight: 700, fontSize: 11 }}>✓ {r.rental_company}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}</td>
                      <td style={{ ...td, maxWidth: 220 }}>{r.contractor_gear
                        ? <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: 11 }}>✓ {r.contractor_gear}</span>
                        : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>}</td>
                    </tr>
                  );
                })}
                {shown.length === 0 && <tr><td colSpan={14} style={{ ...td, color: 'var(--muted)', fontStyle: 'italic' }}>No shoots found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {mode === 'shoots' && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Internal Gear = a gear request covers cage equipment · Online Rental = entries on the shoot's Online Rentals list ·
          Rental House = a rental company on the Gear tab · Contractors = crew carrying a gear rate. Click any row to open the shoot's gear dashboard; click a green ✓ to quick-view the request.
        </div>}
      </div>
      {showForm && <GearRequestModal onClose={() => setShowForm(false)} onSubmitted={load} />}
      {viewing && <GearRequestModal existing={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
