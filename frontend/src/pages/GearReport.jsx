import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// Gear Manager report — every production shoot at a glance, ordered by start
// date. Shoots with a submitted gear request render in full color; shoots
// without one are greyed out so the gaps jump out.
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : 'TBD';
const th = { padding: '8px 12px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '8px 12px', fontSize: 12, verticalAlign: 'middle' };

const Check = ({ on, label }) => on
  ? <span style={{ color: '#5ABF80', fontWeight: 700, fontSize: 11 }}>✓ {label || ''}</span>
  : <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>;

export default function GearReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => { api.gearReport().then(setRows).catch(e => alert(e.message)); }, []);

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
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Gear Report</div>
            <div className="page-sub">
              Every shoot reporting into FreePro, by start date — greyed shoots haven't submitted a gear request yet
              {rows && <span> · <b style={{ color: '#5ABF80' }}>{requested}</b> of {upcoming.length} upcoming shoots requested</span>}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowPast(p => !p)}>
            {showPast ? 'Hide past shoots' : `Show past shoots (${past.length})`}
          </button>
        </div>
        {!rows && <div className="empty">Loading…</div>}
        {rows && (
          <div className="budget-tbl-wrap" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={th}>Shoot Code</th><th style={th}>Shoot Name</th>
                  <th style={th}>Start</th><th style={th}>End</th>
                  <th style={th}>Gear Request</th>
                  <th style={{ ...th, borderLeft: '1px solid var(--border)' }}>Internal Gear</th>
                  <th style={th}>Online Rental</th><th style={th}>Rental House</th><th style={th}>Contractor(s)</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => {
                  const on = !!r.request_submitted;
                  return (
                    <tr key={r.id} onClick={() => nav(`/projects/${r.id}`)}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer',
                        opacity: on ? 1 : 0.45, filter: on ? 'none' : 'grayscale(0.7)', transition: 'opacity .15s ease' }}
                      onMouseEnter={e => { if (!on) e.currentTarget.style.opacity = 0.75; }}
                      onMouseLeave={e => { if (!on) e.currentTarget.style.opacity = 0.45; }}>
                      <td style={{ ...td, fontWeight: 700, color: 'var(--orange)', whiteSpace: 'nowrap' }}>{r.code}</td>
                      <td style={td}>
                        <div style={{ fontWeight: 600 }}>{r.title}</div>
                        {r.subtitle && <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.subtitle}</div>}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtD(r.start_date)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtD(r.end_date)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {on
                          ? <span style={{ background: 'rgba(90,191,128,0.15)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>
                              ✓ {fmtD(r.request_submitted)}{r.request_by ? ` · ${r.request_by}` : ''}
                            </span>
                          : <span style={{ border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 700 }}>Not requested</span>}
                      </td>
                      <td style={{ ...td, borderLeft: '1px solid var(--border)' }}><Check on={on || r.internal_request_submitted} /></td>
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
                {shown.length === 0 && <tr><td colSpan={9} style={{ ...td, color: 'var(--muted)', fontStyle: 'italic' }}>No shoots found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Internal Gear = a gear request covers cage equipment · Online Rental = entries on the shoot's Online Rentals list ·
          Rental House = a rental company on the Gear tab · Contractors = crew carrying a gear rate. Click any row to open the shoot.
        </div>
      </div>
    </div>
  );
}
