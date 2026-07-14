import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// Hard Drives report — the full drive roster and where every drive is right
// now: out on a shoot, or home at its office location.
const fmtT = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '';
const th = { padding: '8px 12px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '8px 12px', fontSize: 12, verticalAlign: 'middle' };

export default function HardDrivesReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [drives, setDrives] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');   // all | out | home

  useEffect(() => { api.driveRoster().then(setDrives).catch(e => alert(e.message)); }, []);

  const out = (drives || []).filter(d => d.project_id);
  const shown = (drives || [])
    .filter(d => filter === 'all' || (filter === 'out' ? d.project_id : !d.project_id))
    .filter(d => !q.trim() || [d.name, d.asset_tag, d.serial_number, d.location, d.project_code, d.project_title]
      .some(v => (v || '').toLowerCase().includes(q.trim().toLowerCase())));

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
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Hard Drives</div>
            <div className="page-sub">
              The drive roster and where every drive is right now
              {drives && <span> · {drives.length} drives · <b style={{ color: '#e6c229' }}>{out.length}</b> out on shoots</span>}
            </div>
          </div>
          <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {[['all', 'All'], ['out', 'On Shoots'], ['home', 'In Office']].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                style={{ background: filter === k ? 'rgba(74,158,255,0.2)' : 'transparent', border: 'none',
                  color: filter === k ? '#4a9eff' : 'var(--muted)', fontSize: 11, fontWeight: 800, padding: '6px 14px', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by drive, tag, serial, shoot, or location…" style={{ margin: '10px 0' }} />
        {!drives && <div className="empty">Loading…</div>}
        {drives && (
          <div className="budget-tbl-wrap" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={th}>Drive</th>
                  <th style={th}>Serial</th>
                  <th style={th}>Where It Is</th>
                  <th style={th}>Since</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(d => (
                  <tr key={d.id} onClick={() => d.project_id && nav(`/gear/${d.project_id}`)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: d.project_id ? 'pointer' : 'default' }}>
                    <td style={td}>
                      <span style={{ fontWeight: 600 }}>💾 {d.name}</span>
                      {d.asset_tag && <span style={{ fontSize: 10, color: 'var(--muted)' }}> · {d.asset_tag}</span>}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{d.serial_number || '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {d.project_id
                        ? <span title={d.project_title}
                            style={{ background: 'rgba(230,194,41,0.12)', border: '1px solid #e6c229', color: '#e6c229', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>
                            ✈ {d.project_code} — {d.project_title}
                          </span>
                        : <span style={{ background: 'rgba(90,191,128,0.12)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>
                            🏠 {d.location || 'In office'}
                          </span>}
                    </td>
                    <td style={{ ...td, fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                      {d.project_id ? `${fmtT(d.assigned_at)}${d.assigned_by ? ` · ${d.assigned_by}` : ''}` : '—'}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={4} style={{ ...td, color: 'var(--muted)', fontStyle: 'italic' }}>No drives match.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Drives come from the HDD category of the asset database. Tag them onto shoots from the Gear Report → a shoot's gear dashboard → Drives tile, or the shoot's Gear tab. Click a row to open the holding shoot.
        </div>
      </div>
    </div>
  );
}
