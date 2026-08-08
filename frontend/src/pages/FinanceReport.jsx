import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { STATUS_COLORS } from './Hub.jsx';
import HomeButton from '../components/HomeButton.jsx';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCM = m => {
  if (!m) return '—';
  const [y, mo] = String(m).split('-');
  return new Date(Number(y), Number(mo) - 1, 15).toLocaleDateString('en-US', { month:'long' }) + ', ' + y;
};
const fmtDT = d => d ? new Date(d).toLocaleString('en-US', { month:'long', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '—';

export default function FinanceReport() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear())); // default: current year
  const [closeMonth, setCloseMonth] = useState('all');                 // 'all' | '01'..'12'
  const [versions, setVersions] = useState(null);     // saved report versions (newest first)
  const [selectedBatch, setSelectedBatch] = useState('');
  const [pulling, setPulling] = useState(false);

  // On open: load the version list and show the latest saved report. We don't
  // regenerate on every open (that's what "Pull Report" is for) — but if there
  // is no saved report at all, bootstrap the first one so the page is never
  // blank and the latest always loads by default thereafter.
  useEffect(() => {
    api.financeReportVersions().then(vs => {
      setVersions(vs);
      if (vs.length) { setSelectedBatch(vs[0].batchId); api.financeReportVersion(vs[0].batchId).then(setReport).catch(e => setError(e.message)); }
      else pullReport();
    }).catch(e => setError(e.message));
  }, []);

  async function pullReport() {
    if (pulling) return;
    setPulling(true);
    try {
      const r = await api.weeklyFinanceReport();
      setReport(r);
      const vs = await api.financeReportVersions();
      setVersions(vs);
      setSelectedBatch(r.batchId || (vs[0] && vs[0].batchId) || '');
    } catch (e) { alert(e.message); }
    setPulling(false);
  }

  async function loadVersion(batchId) {
    setSelectedBatch(batchId);
    if (!batchId) return;
    try { setReport(await api.financeReportVersion(batchId)); } catch (e) { alert(e.message); }
  }

  // Gray button with an orange outline that fills orange on hover.
  const csBtn = (disabled) => ({
    background: 'var(--bg2)', border: '1px solid var(--orange)', color: 'var(--text)',
    borderRadius: 6, fontSize: 12, fontWeight: 600, padding: '6px 12px',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
  });
  const csOn = e => { if (e.currentTarget.disabled) return; e.currentTarget.style.background = 'var(--orange)'; e.currentTarget.style.color = '#fff'; };
  const csOff = e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.color = 'var(--text)'; };

  const controls = (
    <div className="no-print" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', justifyContent:'flex-end', marginLeft:'auto' }}>
      {versions && versions.length > 0 && (
        <label style={{ display:'flex', alignItems:'center', gap:6 }} title="View a previous report version">
          <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700 }}>Version</span>
          <select value={selectedBatch} onChange={e => loadVersion(e.target.value)}
            style={{ fontSize:12, background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:8, padding:'6px 10px', maxWidth:260 }}>
            {versions.map((v, i) => <option key={v.batchId} value={v.batchId}>{fmtDT(v.generatedAt)}{i === 0 ? ' (latest)' : ''}</option>)}
          </select>
        </label>
      )}
      <button className="home-glass glass-action" onClick={() => window.print()} disabled={!report} title="Print / Save PDF" aria-label="Print / Save PDF">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>
        </svg>
        <span className="ga-label">Print / Save PDF</span>
      </button>
      <button className="home-glass glass-action" onClick={pullReport} disabled={pulling} title="Pull Report" aria-label="Pull Report">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 15l2.5-3 2 2L16 10"/>
        </svg>
        <span className="ga-label">{pulling ? 'Pulling…' : 'Pull Report'}</span>
      </button>
      <HomeButton />
    </div>
  );

  if (error) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>{error}</div>;

  // No report loaded yet (none pulled, or none exist): show the header + a prompt
  if (!report) return (
    <div style={{ minHeight:'100vh', background:'transparent', padding:'30px 16px 80px' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:22, filter:'brightness(0) invert(1)', opacity:0.9 }} />
            <div style={{ fontSize:19, fontWeight:800, marginTop:10 }}>Weekly Project Finance Report</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
              {versions === null ? 'Loading…' : 'No report generated yet — hit Pull Report to snapshot the current portfolio.'}
            </div>
          </div>
          {controls}
        </div>
      </div>
    </div>
  );

  const secTitle = { fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80', margin:'22px 0 8px' };
  const card = { borderRadius:12, overflow:'hidden' };
  const th = { padding:'8px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left' };
  const td = { padding:'6px 10px', fontSize:12 };

  const yearOf = p => (p.close_month ? String(p.close_month).slice(0, 4) : null);
  const years = [...new Set([String(new Date().getFullYear()), ...report.current.map(yearOf).filter(Boolean)])].sort().reverse();
  const monthOf = p => (p.close_month ? String(p.close_month).slice(5, 7) : null);
  const shown = report.current
    .filter(p => year === 'all' ? true : year === 'none' ? !yearOf(p) : yearOf(p) === year)
    .filter(p => closeMonth === 'all' ? true : monthOf(p) === closeMonth)
    .sort((a, b) => (a.close_month || '9999-99').localeCompare(b.close_month || '9999-99'));
  const totalPortfolio = shown.reduce((s, c) => s + Number(c.budget_total || 0), 0);
  const totalFees = shown.reduce((s, c) => s + Number(c.fee || 0), 0);

  return (
    <div style={{ minHeight:'100vh', background:'transparent', padding:'30px 16px 80px' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:22, filter:'brightness(0) invert(1)', opacity:0.9 }} />
            <div style={{ fontSize:19, fontWeight:800, marginTop:10 }}>Weekly Project Finance Report</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
              Generated {fmtDT(report.generatedAt)}
              {report.previousAt ? ` · changes since ${fmtDT(report.previousAt)}` : ' · first report (baseline — all projects listed as current portfolio)'}
            </div>
          </div>
          {controls}
        </div>

        {!report.firstReport && (
          <>
            <div style={secTitle}>New Projects ({report.added.length})</div>
            <div className="glass" style={card}>
              {report.added.length === 0 ? <div style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No new projects this period.</div> : (
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr><th style={th}>Code</th><th style={th}>Project</th><th style={th}>Owner</th><th style={th}>Status</th><th style={{ ...th, textAlign:'right' }}>Budget</th><th style={{ ...th, textAlign:'right' }}>Gross Profit</th></tr></thead>
                  <tbody>{report.added.map(p => (
                    <tr key={p.project_id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ ...td, color:'var(--muted)' }}>{p.code}</td>
                      <td style={{ ...td, fontWeight:600 }}>{p.title}</td>
                      <td style={td}>{p.media_rep || '—'}</td>
                      <td style={td}>{p.budget_status}</td>
                      <td style={{ ...td, textAlign:'right', fontWeight:700 }}>{fmt$(p.budget_total)}</td>
                      <td style={{ ...td, textAlign:'right', color:'#5ABF80', fontWeight:600 }}>{fmt$(p.fee)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>

            <div style={secTitle}>Changed Projects ({report.changed.length})</div>
            <div className="glass" style={card}>
              {report.changed.length === 0 ? <div style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No changes this period.</div> : (
                report.changed.map(p => (
                  <div key={p.project_id} style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontSize:12, fontWeight:700 }}>{p.code} — {p.title} <span style={{ fontWeight:400, color:'var(--muted)' }}>({p.media_rep || 'no owner'})</span></div>
                    {p.diffs.map((d, i) => (
                      <div key={i} style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                        {d.field}: <span style={{ color:'var(--text)' }}>{d.money ? fmt$(d.from) : d.field === 'Close Month' ? fmtCM(d.from === '—' ? null : d.from) : d.from}</span> → <span style={{ color:'#e6c229', fontWeight:600 }}>{d.money ? fmt$(d.to) : d.field === 'Close Month' ? fmtCM(d.to === '—' ? null : d.to) : d.to}</span>
                        {d.money && <span style={{ marginLeft:8, color: d.to - d.from >= 0 ? '#5ABF80' : '#e05252' }}>({d.to - d.from >= 0 ? '+' : ''}{fmt$(d.to - d.from)})</span>}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div style={secTitle}>Closed / Dead ({report.closed.length})</div>
            <div className="glass" style={card}>
              {report.closed.length === 0 ? <div style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No closings this period.</div> : (
                report.closed.map(p => (
                  <div key={p.project_id} style={{ padding:'10px 14px', borderTop:'1px solid rgba(255,255,255,0.04)', display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                    <div style={{ fontSize:12 }}><b>{p.code}</b> — {p.title} <span style={{ color:'#e05252', fontSize:11 }}>({p.reason})</span></div>
                    <div style={{ fontSize:12 }}>Budget {fmt$(p.budget_total)} · Gross Profit <span style={{ color:'#5ABF80' }}>{fmt$(p.fee)}</span></div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
          <div style={secTitle}>Projects by Year ({shown.length})</div>
          <select className="no-print" value={closeMonth} onChange={e => setCloseMonth(e.target.value)}
            style={{ width:150, fontSize:12, background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:8, padding:'5px 10px', marginRight:8 }}>
            <option value="all">All Close Months</option>
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
              <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>
          <select className="no-print" value={year} onChange={e => setYear(e.target.value)}
            style={{ width:150, fontSize:12, background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:8, padding:'5px 10px' }}>
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
            {report.current.some(p => !yearOf(p)) && <option value="none">No close month</option>}
          </select>
        </div>
        <div className="glass" style={card}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr><th style={th}>Code</th><th style={th}>Project</th><th style={th}>Owner</th><th style={th}>Status</th><th style={{ ...th, textAlign:'right' }}>Budget</th><th style={{ ...th, textAlign:'right' }}>Gross Profit</th><th style={th}>Close</th></tr></thead>
            <tbody>
              {shown.map(p => {
                const sc = STATUS_COLORS[p.budget_status] || 'var(--muted)';
                return (
                  <tr key={p.project_id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)', opacity: p.budget_status === 'Dead' ? 0.55 : 1 }}>
                    <td style={{ ...td, color:'var(--muted)', whiteSpace:'nowrap' }}>{p.code}</td>
                    <td style={{ ...td, fontWeight:600 }}>{p.title}</td>
                    <td style={td}>{p.media_rep || '—'}</td>
                    <td style={td}><span style={{ color:sc, fontWeight:700, fontSize:10, textTransform:'uppercase' }}>{p.budget_status}</span></td>
                    <td style={{ ...td, textAlign:'right', fontWeight:700, whiteSpace:'nowrap' }}>{fmt$(p.budget_total)}</td>
                    <td style={{ ...td, textAlign:'right', color:'#5ABF80', whiteSpace:'nowrap' }}>{fmt$(p.fee)}</td>
                    <td style={{ ...td, whiteSpace:'nowrap' }}>{fmtCM(p.close_month)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop:'1px solid var(--border)' }}>
                <td colSpan={4} style={{ ...td, fontWeight:800, textAlign:'right', textTransform:'uppercase', fontSize:10, color:'var(--muted)' }}>Totals</td>
                <td style={{ ...td, textAlign:'right', fontWeight:800 }}>{fmt$(totalPortfolio)}</td>
                <td style={{ ...td, textAlign:'right', fontWeight:800, color:'#5ABF80' }}>{fmt$(totalFees)}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ fontSize:10, color:'var(--muted)', marginTop:16, textAlign:'center' }}>
          Each report saves a snapshot — the next report shows changes since this one. Unbridled Media · ProFi
        </div>
      </div>
    </div>
  );
}
