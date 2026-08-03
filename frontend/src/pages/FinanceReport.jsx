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
  const [year, setYear] = useState('all');
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

  const controls = (
    <div className="no-print" style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
      <button className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={!report}>Print / Save PDF</button>
      <button className="btn btn-primary btn-sm" onClick={pullReport} disabled={pulling}
        style={{ background:'#5ABF80', borderColor:'#5ABF80', color:'#08160E' }}>{pulling ? 'Pulling…' : 'Pull Report'}</button>
      <HomeButton />
    </div>
  );

  // Version picker — lives on the top-left, under the title, so previous report
  // versions are always clearly visible (not buried among the action buttons).
  const versionPicker = versions && versions.length > 0 && (
    <div className="no-print" style={{ display:'flex', alignItems:'center', gap:8, marginTop:10 }}>
      <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700 }}>Version</span>
      <select value={selectedBatch} onChange={e => loadVersion(e.target.value)}
        title="View a previous report version"
        style={{ fontSize:12, background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:8, padding:'6px 10px', maxWidth:280 }}>
        {versions.map((v, i) => <option key={v.batchId} value={v.batchId}>{fmtDT(v.generatedAt)}{i === 0 ? ' (latest)' : ''}</option>)}
      </select>
    </div>
  );

  if (error) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>{error}</div>;

  // No report loaded yet (none pulled, or none exist): show the header + a prompt
  if (!report) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'30px 16px 80px' }}>
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
  const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' };
  const th = { padding:'8px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left' };
  const td = { padding:'6px 10px', fontSize:12 };

  const yearOf = p => (p.close_month ? String(p.close_month).slice(0, 4) : null);
  const years = [...new Set(report.current.map(yearOf).filter(Boolean))].sort().reverse();
  const shown = report.current.filter(p => year === 'all' ? true : year === 'none' ? !yearOf(p) : yearOf(p) === year);
  const totalPortfolio = shown.reduce((s, c) => s + Number(c.budget_total || 0), 0);
  const totalFees = shown.reduce((s, c) => s + Number(c.fee || 0), 0);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'30px 16px 80px' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:22, filter:'brightness(0) invert(1)', opacity:0.9 }} />
            <div style={{ fontSize:19, fontWeight:800, marginTop:10 }}>Weekly Project Finance Report</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
              Generated {fmtDT(report.generatedAt)}
              {report.previousAt ? ` · changes since ${fmtDT(report.previousAt)}` : ' · first report (baseline — all projects listed as current portfolio)'}
            </div>
            {versionPicker}
          </div>
          {controls}
        </div>

        {!report.firstReport && (
          <>
            <div style={secTitle}>New Projects ({report.added.length})</div>
            <div style={card}>
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
            <div style={card}>
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
            <div style={card}>
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
          <select className="no-print" value={year} onChange={e => setYear(e.target.value)}
            style={{ width:150, fontSize:12, background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:8, padding:'5px 10px' }}>
            <option value="all">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
            {report.current.some(p => !yearOf(p)) && <option value="none">No close month</option>}
          </select>
        </div>
        <div style={card}>
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
