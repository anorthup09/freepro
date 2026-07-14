import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => Number(v || 0);
const INCLUDED = ['Live', 'Reconcile', 'Reconciled', 'Closed'];
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—';

// Client Invoice Report — invoices that have been requested but not yet sent,
// plus the full request history.
export default function ClientInvoiceReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState(null);
  const [view, setView] = useState('outstanding');   // 'outstanding' | 'requests'

  useEffect(() => { api.financeProjects().then(setProjects).catch(() => setProjects([])); }, []);

  const rows = useMemo(() => (projects || [])
    .filter(p => p.budget_id && INCLUDED.includes(p.budget_status))
    .map(p => ({ ...p, extras: Array.isArray(p.extra_deposits) ? p.extra_deposits : [] })), [projects]);

  const requests = useMemo(() => rows.flatMap(r => r.extras
    .map((x, i) => ({ ...x, i, project: r }))
    .filter(x => x.number || x.sendToEmail || x.description || x.requestedAt))
    .sort((a, b) => String(b.requestedAt || '').localeCompare(String(a.requestedAt || ''))), [rows]);

  const outstanding = useMemo(() => requests.filter(x => !x.date), [requests]);

  const th = { padding: 8, textAlign: 'left', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
  const thR = { ...th, textAlign: 'right' };

  const statusPill = r => r.budget_status === 'Live'
    ? <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#5ABF80', border: '1px solid #5ABF80', borderRadius: 10, padding: '2px 9px' }}>Live</span>
    : <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0b0b0b', background: '#8a8f98', border: '1px solid #8a8f98', borderRadius: 10, padding: '2px 9px' }}>Closed</span>;

  const requestTable = (list, { withStatus }) => (
    <div style={{ overflowX: 'auto', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 940 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 64 }} />
            <th style={th}>Project</th>
            <th style={th}>Budget Owner</th>
            <th style={th}>Deposit #</th>
            <th style={th}>Description</th>
            <th style={th}>Send To</th>
            <th style={thR}>Amount</th>
            <th style={th}>Requested</th>
            {withStatus && <th style={th}>Status</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((x, idx) => (
            <tr key={idx} onClick={() => nav(`/finance/${x.project.id}`)} title="Open in ProFi"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
              <td style={{ padding: '8px 0 8px 10px', width: 64 }}>{statusPill(x.project)}</td>
              <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                <span style={{ fontWeight: 700 }}>{x.project.code}</span>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>{x.project.title}</div>
              </td>
              <td style={{ padding: 8, whiteSpace: 'nowrap', color: 'var(--muted)' }}>{x.project.media_rep || '—'}</td>
              <td style={{ padding: 8, fontWeight: 700 }}>{x.number || x.i + 2}</td>
              <td style={{ padding: 8, minWidth: 160 }}>{x.description || '—'}</td>
              <td style={{ padding: 8 }}>
                {x.sendToName || '—'}
                {x.sendToEmail && <div style={{ fontSize: 9, color: 'var(--muted)' }}>{x.sendToEmail}{x.cc ? ` · cc ${x.cc}` : ''}</div>}
              </td>
              <td style={{ padding: 8, textAlign: 'right', fontWeight: 800, color: '#5ABF80', whiteSpace: 'nowrap' }}>{x.amount != null ? fmt$(x.amount) : '—'}</td>
              <td style={{ padding: 8, whiteSpace: 'nowrap', fontSize: 11 }}>
                {fmtD(x.requestedAt)}
                {x.requestedBy && <div style={{ fontSize: 9, color: 'var(--muted)' }}>{x.requestedBy}</div>}
              </td>
              {withStatus && (
                <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                  {x.date
                    ? <span style={{ background: 'rgba(90,191,128,0.15)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>✓ Sent {fmtD(x.date)}</span>
                    : <span style={{ background: 'rgba(230,194,41,0.12)', border: '1px solid #e6c229', color: '#e6c229', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>Unsent</span>}
                </td>
              )}
            </tr>
          ))}
          {list.length === 0 && (
            <tr><td colSpan={withStatus ? 9 : 8} style={{ padding: 14, color: 'var(--muted)', fontStyle: 'italic' }}>
              {withStatus ? "No invoice requests yet — add one from a project's VCC." : 'Nothing outstanding — every requested invoice has been sent.'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  const totalOutstanding = outstanding.reduce((a, x) => a + num(x.amount), 0);

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
        </div>
      </div>
      <div style={{ maxWidth: 1150, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Client Outstanding Invoice Report</div>
            <div className="page-sub">Requested invoices waiting to go out{outstanding.length ? ` — ${outstanding.length} unsent · ${fmt$(totalOutstanding)}` : ''}</div>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            {[['outstanding', `Unsent (${outstanding.length})`], ['requests', `All Requests (${requests.length})`]].map(([k, label]) => (
              <button key={k} onClick={() => setView(k)}
                style={{ background: view === k ? 'rgba(90,191,128,0.2)' : 'transparent', border: 'none',
                  color: view === k ? '#5ABF80' : 'var(--muted)', fontSize: 11, fontWeight: 800, padding: '6px 14px', cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {!projects && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '30px 0' }}>Loading…</div>}
        {projects && view === 'outstanding' && requestTable(outstanding, { withStatus: false })}
        {projects && view === 'requests' && requestTable(requests, { withStatus: true })}
      </div>
    </div>
  );
}
