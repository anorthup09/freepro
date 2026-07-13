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

export default function VendorContractReport() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState(null);
  const [onlyUnsent, setOnlyUnsent] = useState(false);

  useEffect(() => { api.vendorContractReport().then(setRows).catch(e => alert(e.message)); }, []);

  const shown = (rows || []).filter(r => !onlyUnsent || !r.contract_status);
  const unsent = (rows || []).filter(r => !r.contract_status).length;
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
              Every contractor being hired across production &amp; post
              {rows && <span> · {rows.length} contractor slot{rows.length !== 1 ? 's' : ''} · <b style={{ color: unsent ? '#e05252' : '#5ABF80' }}>{unsent}</b> without a contract sent</span>}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setOnlyUnsent(v => !v)}>
            {onlyUnsent ? 'Show all' : 'Only not sent'}
          </button>
        </div>
        {!rows && <div className="empty">Loading…</div>}
        {rows && (
          <div className="budget-tbl-wrap" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 10, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={th}>Project Code</th>
                  <th style={th}>Contractor Name</th>
                  <th style={{ ...th, textAlign: 'right' }}>Est. Total</th>
                  <th style={th}>Contract</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id} onClick={() => nav(`/projects/${r.project_id}?tab=crew`)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                    <td style={{ ...td, fontWeight: 700, color: 'var(--orange)', whiteSpace: 'nowrap' }}>
                      {r.code}
                      <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--muted)' }}>{r.title}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.contractor_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{r.position_name}</div>
                    </td>
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
                {shown.length === 0 && <tr><td colSpan={4} style={{ ...td, color: 'var(--muted)', fontStyle: 'italic' }}>No contractors found.</td></tr>}
              </tbody>
              {shown.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'var(--muted)' }} colSpan={2}>Total</td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 800, color: '#5ABF80' }}>{fmt$(total)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
          Est. Total = day rate × labor days + gear rate × gear days from the crew slot. Click a row to open that project's Crew tab.
        </div>
      </div>
    </div>
  );
}
