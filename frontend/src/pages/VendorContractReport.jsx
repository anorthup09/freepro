import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';

// Vendor Contract Report — every contractor being hired across production and
// post: what they're estimated to cost, and whether the contract went out.
const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '';
const th = { padding: '8px 12px', fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', whiteSpace: 'nowrap' };
const td = { padding: '8px 12px', fontSize: 12, verticalAlign: 'middle' };
const dt = { fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 };
const dv = { fontSize: 13, fontWeight: 600 };

// Pop-out showing the actual contract behind a report row (or the estimate
// breakdown when nothing has been sent yet).
function ContractDetailModal({ row, contract, loading, onClose, onCrew, onPost }) {
  const c = contract;
  const money = c
    ? { dayRate: c.day_rate, laborDays: c.labor_days, gearRate: c.gear_rate, gearDays: c.gear_days }
    : { dayRate: row.day_rate, laborDays: row.labor_days, gearRate: row.gear_cost, gearDays: row.gear_days };
  const laborTotal = Number(money.dayRate || 0) * Number(money.laborDays || 0);
  const gearTotal = Number(money.gearRate || 0) * Number(money.gearDays || 0);
  // Post-production rows (Color/Audio) carry a flat total instead of day rates
  const isPost = !!row.avo_page_id;
  const grandTotal = (c ? Number(c.quoted_total) : 0) || laborTotal + gearTotal || Number(row.est_total) || 0;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{c ? c.contractor_name : row.contractor_name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {(c ? c.position_name : row.position_name) || '—'}{c?.contractor_email ? ` · ${c.contractor_email}` : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ marginTop: 6 }}>
          {c
            ? (c.status === 'SIGNED'
                ? <span style={{ background: 'rgba(90,191,128,0.15)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>✓ Signed{c.signed_at ? ` · ${fmtD(c.signed_at)}` : ''}{c.signed_name ? ` by ${c.signed_name}` : ''}</span>
                : <span style={{ background: 'rgba(230,194,41,0.12)', border: '1px solid #e6c229', color: '#e6c229', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>Sent{c.created_at ? ` · ${fmtD(c.created_at)}` : ''} · awaiting signature</span>)
            : <span style={{ background: 'rgba(224,82,82,0.12)', border: '1px solid #e05252', color: '#e05252', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>No contract sent yet — showing {isPost ? 'tracker' : 'crew-slot'} estimate</span>}
        </div>
        {loading && <div className="empty" style={{ marginTop: 14 }}>Loading contract…</div>}
        {!loading && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
              <div><div style={dt}>Project</div><div style={dv}>{c ? c.project_code : row.code}</div><div style={{ fontSize: 10, color: 'var(--muted)' }}>{c ? c.project_title : row.title}</div></div>
              <div><div style={dt}>Dates</div><div style={dv}>{c ? `${fmtD(c.start_date) || '—'}${c.end_date ? ` – ${fmtD(c.end_date)}` : ''}` : (fmtD(row.start_date) || '—')}</div></div>
              <div><div style={dt}>Labor</div><div style={dv}>{Number(money.dayRate) > 0 ? `${fmt$(money.dayRate)} × ${Number(money.laborDays || 0)} day${Number(money.laborDays || 0) !== 1 ? 's' : ''}` : '—'}</div>{laborTotal > 0 && <div style={{ fontSize: 10, color: '#5ABF80', fontWeight: 700 }}>{fmt$(laborTotal)}</div>}</div>
              <div><div style={dt}>Gear</div><div style={dv}>{gearTotal > 0 ? `${fmt$(money.gearRate)} × ${Number(money.gearDays || 0)} day${Number(money.gearDays || 0) !== 1 ? 's' : ''}` : '—'}</div>{gearTotal > 0 && <div style={{ fontSize: 10, color: '#5ABF80', fontWeight: 700 }}>{fmt$(gearTotal)}</div>}</div>
            </div>
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(90,191,128,0.08)', border: '1px solid rgba(90,191,128,0.35)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ ...dt, marginBottom: 0 }}>Total</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#5ABF80' }}>{fmt$(grandTotal)}</span>
            </div>
            {c?.scope && (
              <div style={{ marginTop: 14 }}>
                <div style={dt}>Scope of Work</div>
                <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--text)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginTop: 4 }}>{c.scope}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
              {c && <a className="btn btn-ghost btn-sm" href={`/contract/${c.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Open signing page ↗</a>}
              {isPost
                ? <button className="btn btn-primary btn-sm" onClick={onPost}>Open in AvocadoPost</button>
                : <button className="btn btn-primary btn-sm" onClick={onCrew}>{c ? 'Open Crew tab' : 'Open Crew tab to send'}</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function VendorContractReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [onlyUnsent, setOnlyUnsent] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [detail, setDetail] = useState(null); // { row, contract, loading }

  useEffect(() => { api.vendorContractReport().then(setRows).catch(e => alert(e.message)); }, []);

  const openDetail = (r) => {
    setDetail({ row: r, contract: null, loading: true });
    api.vendorContractDetail(r.id)
      .then(c => setDetail(d => d && d.row.id === r.id ? { row: r, contract: c, loading: false } : d))
      .catch(() => setDetail(d => d && d.row.id === r.id ? { row: r, contract: null, loading: false } : d));
  };

  const active = (rows || []).filter(r => !r.archived);
  const archivedCount = (rows || []).length - active.length;
  const shown = (showArchived ? (rows || []) : active).filter(r => !onlyUnsent || !r.contract_status);
  const unsent = active.filter(r => !r.contract_status).length;
  const total = shown.reduce((s, r) => s + Number(r.est_total || 0), 0);

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
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '10px 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div className="page-title">Vendor Contracts</div>
            <div className="page-sub">
              Every contractor being hired across production &amp; post, ordered by start date
              {rows && <span> · {active.length} active slot{active.length !== 1 ? 's' : ''} · <b style={{ color: unsent ? '#e05252' : '#5ABF80' }}>{unsent}</b> without a contract sent</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {archivedCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(v => !v)}>
                {showArchived ? 'Hide archived' : `Archived (${archivedCount})`}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setOnlyUnsent(v => !v)}>
              {onlyUnsent ? 'Show all' : 'Only not sent'}
            </button>
          </div>
        </div>
        {!rows && <div className="empty">Loading…</div>}
        {rows && (
          <div className="budget-tbl-wrap" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={th}>Project Code</th>
                  <th style={th}>Contractor Name</th>
                  <th style={th}>Start</th>
                  <th style={th}>End</th>
                  <th style={{ ...th, textAlign: 'right' }}>Est. Total</th>
                  <th style={th}>Contract</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id} onClick={() => openDetail(r)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', opacity: r.archived ? 0.5 : 1 }}>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--orange)', whiteSpace: 'nowrap' }}>
                      {r.code}
                      <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--muted)' }}>{r.title}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.contractor_name}{r.archived && <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 800, color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Archived</span>}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.position_name}</div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtD(r.slot_start) || '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtD(r.slot_end) || '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#5ABF80', whiteSpace: 'nowrap' }}>{fmt$(r.est_total)}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {r.contract_status
                        ? <span style={{ background: 'rgba(90,191,128,0.15)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>
                            ✓ {r.contract_status === 'SIGNED' ? 'Signed' : 'Sent'}{r.contract_sent_at ? ` · ${fmtD(r.contract_sent_at)}` : ''}
                          </span>
                        : <span style={{ background: 'rgba(224,82,82,0.12)', border: '1px solid #e05252', color: '#e05252', borderRadius: 12, padding: '2px 10px', fontSize: 10, fontWeight: 800 }}>Not sent</span>}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={6} style={{ ...td, color: 'var(--muted)', fontStyle: 'italic' }}>No contractors found.</td></tr>}
              </tbody>
              {shown.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }} colSpan={4}>Total</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#5ABF80' }}>{fmt$(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Crew slots: Est. Total = day rate × labor days + gear rate × gear days. Color/Audio rows come from AvocadoPost project pages.
          Slots archive automatically once their end date passes. Click a row to see the contract details.
        </div>
        {detail && (
          <ContractDetailModal row={detail.row} contract={detail.contract} loading={detail.loading}
            onClose={() => setDetail(null)}
            onCrew={() => nav(`/projects/${detail.row.project_id}?tab=crew`)}
            onPost={() => nav(detail.row.avo_page_id ? `/avo/project/${detail.row.avo_page_id}` : '/avo')} />
        )}
      </div>
    </div>
  );
}
