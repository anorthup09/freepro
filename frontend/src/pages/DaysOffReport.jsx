import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// Team Days Off — PTO and OOO days taken per person, from the PTO/OOO tracker.
// Counts weekdays in each approved request; WFH and STL/DEN Only don't count as
// time off, Comp and Other OOO roll into OOO. Pending requests are excluded.
const th = { padding: '9px 14px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' };
const td = { padding: '9px 14px', fontSize: 13, verticalAlign: 'middle' };
const num = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
const numh = { ...th, textAlign: 'right' };

export default function DaysOffReport() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { api.ptoReport().then(setRows).catch(e => alert(e.message)); }, []);

  const shown = (rows || []).filter(r => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const totals = (rows || []).reduce((a, r) => ({ pto: a.pto + r.pto, ooo: a.ooo + r.ooo, total: a.total + r.total }), { pto: 0, ooo: 0, total: 0 });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: '#e6c229', fontWeight: 700, letterSpacing: '0.04em' }}>Reports & Resources</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Team Days Off</div>
            <div className="page-sub">
              Weekdays taken off per person, from the PTO/OOO tracker
              {rows && <span> · {rows.length} {rows.length === 1 ? 'person' : 'people'}</span>}
            </div>
          </div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name…"
            style={{ fontSize: 12, padding: '7px 12px', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)' }} />
        </div>

        <div className="glass" style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Name</th>
                  <th style={numh}>PTO</th>
                  <th style={numh}>OOO</th>
                  <th style={numh}>Total Days Off</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 700 }}>{r.name}</td>
                    <td style={num}>{r.pto || '—'}</td>
                    <td style={num}>{r.ooo || '—'}</td>
                    <td style={{ ...num, fontWeight: 800, color: '#d66a9b' }}>{r.total}</td>
                  </tr>
                ))}
                {rows && shown.length === 0 && (
                  <tr><td style={{ ...td, color: 'var(--muted)' }} colSpan={4}>{q ? 'No one matches that search.' : 'No days off recorded yet.'}</td></tr>
                )}
                {!rows && (
                  <tr><td style={{ ...td, color: 'var(--muted)' }} colSpan={4}>Loading…</td></tr>
                )}
              </tbody>
              {rows && shown.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 800, textTransform: 'uppercase', fontSize: 10, letterSpacing: '.06em', color: 'var(--muted)' }}>Team total</td>
                    <td style={{ ...num, fontWeight: 800 }}>{totals.pto}</td>
                    <td style={{ ...num, fontWeight: 800 }}>{totals.ooo}</td>
                    <td style={{ ...num, fontWeight: 800, color: '#d66a9b' }}>{totals.total}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, lineHeight: 1.6 }}>
          Counts weekdays (Mon–Fri) in each request's date range. <b>PTO</b> is the PTO type; <b>OOO</b> rolls up Comp and Other OOO.
          WFH and STL/DEN Only are working arrangements, so they don't count as days off. Pending (in-review) requests are excluded.
        </div>
      </div>
    </div>
  );
}
