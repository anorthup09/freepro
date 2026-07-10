import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => Number(v || 0);
const INCLUDED = ['Live', 'Reconcile', 'Reconciled', 'Closed'];
const STATUS_DOT = { Live: '#5ABF80', Reconcile: '#9DC183', Reconciled: '#9DC183', Closed: '#8a8f98' };

function fmtCloseMonth(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  return `${mo}/${y.slice(2)}`;
}
function closeMonthLabel(m) {
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 15).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// Client Invoice Report — deposit + final invoices for every live/closed
// project, grouped by close month within the selected year.
export default function ClientInvoiceReport() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [expanded, setExpanded] = useState({});   // months whose settled projects are expanded

  useEffect(() => { api.financeProjects().then(setProjects).catch(() => setProjects([])); }, []);

  const rows = useMemo(() => (projects || [])
    .filter(p => p.budget_id && INCLUDED.includes(p.budget_status))
    .map(p => {
      const extras = Array.isArray(p.extra_deposits) ? p.extra_deposits : [];
      const deposits = num(p.deposit) + num(p.additional_deposit) + extras.reduce((a, x) => a + num(x.amount), 0);
      return { ...p, extras, finalInvoice: Math.max(num(p.budget_total) - deposits, 0) };
    }), [projects]);

  const years = useMemo(() => {
    const ys = new Set(rows.map(r => (r.close_month || '').slice(0, 4)).filter(Boolean));
    ys.add(String(new Date().getFullYear()));
    return [...ys].sort().reverse();
  }, [rows]);

  const inYear = rows.filter(r => (r.close_month || '').slice(0, 4) === year);
  const noClose = rows.filter(r => !r.close_month);
  const months = [...new Set(inYear.map(r => r.close_month))].sort();
  const maxExtras = Math.max(0, ...inYear.concat(noClose).map(r => r.extras.length));

  const sentCell = (amount, sentDate) => (
    <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
      <span style={{ fontWeight: 700 }}>{amount != null ? fmt$(amount) : '—'}</span>
      {amount != null && (
        <span style={{ fontSize: 9, fontWeight: 800, marginLeft: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
          color: sentDate ? '#5ABF80' : '#e6c229' }}>
          {sentDate ? 'Sent' : 'Unsent'}
        </span>
      )}
    </td>
  );

  const th = { padding: 8, textAlign: 'left', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
  const thR = { ...th, textAlign: 'right' };

  const table = list => (
    <div style={{ overflowX: 'auto', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 760 + maxExtras * 150 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 64 }} />
            <th style={th}>Project Code</th>
            <th style={th}>Project Name</th>
            <th style={thR}>First Invoice</th>
            {Array.from({ length: maxExtras }, (_, i) => <th key={i} style={thR}>Deposit {i + 2}</th>)}
            <th style={thR}>Final Invoice</th>
            <th style={thR}>Total Budget</th>
            <th style={{ ...th, textAlign: 'center' }}>Close MM/YY</th>
          </tr>
        </thead>
        <tbody>
          {list.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '8px 0 8px 10px', width: 64 }}>
                {r.budget_status === 'Live' ? (
                  <span title="Live — open in ProFi" onClick={() => nav(`/finance/${r.id}`)}
                    style={{ display: 'inline-block', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: '#5ABF80', border: '1px solid #5ABF80', borderRadius: 10, padding: '2px 9px', cursor: 'pointer' }}>Live</span>
                ) : (
                  <span title={`${r.budget_status} — open in ProFi`} onClick={() => nav(`/finance/${r.id}`)}
                    style={{ display: 'inline-block', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: '#0b0b0b', background: '#8a8f98', border: '1px solid #8a8f98', borderRadius: 10, padding: '2px 9px', cursor: 'pointer' }}>Closed</span>
                )}
              </td>
              <td style={{ padding: 8, whiteSpace: 'nowrap', fontWeight: 700 }}>{r.code}</td>
              <td style={{ padding: 8, minWidth: 160 }}>{r.title}</td>
              {sentCell(r.deposit != null && num(r.deposit) !== 0 ? num(r.deposit) : null, r.deposit_due)}
              {Array.from({ length: maxExtras }, (_, i) => {
                const x = r.extras[i];
                return x ? sentCell(num(x.amount), x.date) : <td key={i} style={{ padding: 8, textAlign: 'right', color: 'var(--muted)' }}>—</td>;
              })}
              {sentCell(r.finalInvoice, r.final_inv_date)}
              <td style={{ padding: 8, textAlign: 'right', fontWeight: 800, color: '#5ABF80', whiteSpace: 'nowrap' }}>{fmt$(r.budget_total)}</td>
              <td style={{ padding: 8, textAlign: 'center', whiteSpace: 'nowrap' }}>{fmtCloseMonth(r.close_month)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <Link to="/reports" style={{ fontSize: 12, color: '#e6c229', fontWeight: 700, letterSpacing: '0.04em', textDecoration: 'none' }}>Reports</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>All Reports</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        </div>
      </div>
      <div style={{ maxWidth: 1150, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Client Invoice Report</div>
            <div className="page-sub">Deposit and final invoices for live and closed projects, grouped by close month</div>
          </div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>Year
            <select value={year} onChange={e => setYear(e.target.value)} style={{ width: 'auto' }}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>

        {!projects && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '30px 0' }}>Loading…</div>}
        {projects && months.length === 0 && noClose.length === 0 && (
          <div className="empty" style={{ marginTop: 20 }}>No live or closed projects with a {year} close month.</div>
        )}

        {months.map(m => {
          const set = inYear.filter(r => r.close_month === m);
          const nowMonth = new Date().toISOString().slice(0, 7);
          // Fully settled = closed AND final invoice sent. In past months these
          // condense into a single strip up top; anything still open — not
          // closed, or closed without a final invoice — stays expanded.
          const settled = m < nowMonth ? set.filter(r => r.budget_status !== 'Live' && r.final_inv_date) : [];
          const active = set.filter(r => !settled.includes(r));
          const ordered = [...active.filter(r => r.budget_status === 'Live'), ...active.filter(r => r.budget_status !== 'Live')];
          const isOpen = !!expanded[m];
          return (
            <div key={m} style={{ marginTop: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#5ABF80', marginBottom: 8 }}>
                {closeMonthLabel(m)}
              </div>
              {settled.length > 0 && (
                <div style={{ marginBottom: ordered.length ? 8 : 0 }}>
                  <div onClick={() => setExpanded(x => ({ ...x, [m]: !x[m] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: isOpen ? '10px 10px 0 0' : 10, padding: '8px 14px', cursor: 'pointer', fontSize: 11, color: 'var(--muted)' }}>
                    <span style={{ fontSize: 9 }}>{isOpen ? '▾' : '▸'}</span>
                    <span style={{ fontWeight: 700 }}>{settled.length} closed & final-invoiced project{settled.length !== 1 ? 's' : ''}</span>
                    <span style={{ marginLeft: 'auto', fontWeight: 800, color: '#5ABF80' }}>{fmt$(settled.reduce((a, r) => a + num(r.budget_total), 0))}</span>
                  </div>
                  {isOpen && table(settled)}
                </div>
              )}
              {ordered.length > 0 && table(ordered)}
            </div>
          );
        })}

        {noClose.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', marginBottom: 8 }}>
              No Close Month Set
            </div>
            {table(noClose)}
          </div>
        )}
      </div>
    </div>
  );
}
