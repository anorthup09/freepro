import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = v => Number(v) || 0;

function lineSubtotal(l, sectionLines) {
  if (l.percent != null) {
    const base = sectionLines.filter(x => x.percent == null && !x.is_travel).reduce((s, x) => s + num(x.qty) * num(x.unit_cost), 0);
    return num(l.percent) * base * num(l.qty);
  }
  return num(l.qty) * num(l.unit_cost);
}

export default function BudgetShare() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { api.getBudgetShare(token).then(setData).catch(e => setError(e.message)); }, [token]);

  if (error) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>{error}</div>;
  if (!data) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>Loading…</div>;

  const { project, budget, sections, lines } = data;
  const mgmtRate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;

  let nonTravel = 0, travel = 0, photo = 0;
  const photoIds = new Set(sections.filter(s => s.kind === 'photo').map(s => s.id));
  const bySection = {};
  for (const l of lines) (bySection[l.section_id] ||= []).push(l);
  for (const [sid, secLines] of Object.entries(bySection)) {
    for (const l of secLines) {
      const st = lineSubtotal(l, secLines);
      if (photoIds.has(sid)) photo += st;
      else if (l.is_travel) travel += st;
      else nonTravel += st;
    }
  }
  const mgmt = mgmtRate * nonTravel;
  const total = nonTravel + travel + mgmt + photo;

  const lbl = { fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'34px 16px 80px' }}>
      <div style={{ maxWidth:760, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:26, filter:'brightness(0) invert(1)', opacity:0.9 }} />
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:6, textTransform:'uppercase', letterSpacing:'0.1em' }}>Video Production Estimate</div>
        </div>

        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 22px', marginBottom:16 }}>
          <div style={{ fontSize:19, fontWeight:800 }}>{project.title}</div>
          <div style={{ display:'flex', gap:'6px 26px', flexWrap:'wrap', marginTop:8 }}>
            <div><span style={lbl}>Client </span><span style={{ fontSize:12, fontWeight:600 }}>{project.client}</span></div>
            <div><span style={lbl}>Project Code </span><span style={{ fontSize:12, fontWeight:600 }}>{project.code}</span></div>
            {budget.budget_date && <div><span style={lbl}>Budget Dated </span><span style={{ fontSize:12, fontWeight:600 }}>{new Date(budget.budget_date + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</span></div>}
            {budget.media_rep && <div><span style={lbl}>Media Rep </span><span style={{ fontSize:12, fontWeight:600 }}>{budget.media_rep}</span></div>}
          </div>
        </div>

        {sections.map(sec => {
          const secLines = (bySection[sec.id] || []).sort((a, b) => a.sort - b.sort);
          const active = secLines.filter(l => lineSubtotal(l, secLines) > 0);
          if (!active.length) return null;
          const main = active.filter(l => !l.is_travel);
          const trav = active.filter(l => l.is_travel);
          const secTotal = active.reduce((s, l) => s + lineSubtotal(l, secLines), 0);
          return (
            <div key={sec.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, marginBottom:14, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10, padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--tan)' }}>{sec.title}</div>
                  {sec.subtitle && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, whiteSpace:'pre-wrap' }}>{sec.subtitle}</div>}
                </div>
                <div style={{ fontSize:14, fontWeight:800, whiteSpace:'nowrap' }}>{fmt$(secTotal)}</div>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <tbody>
                  {main.map(l => <ShareRow key={l.id} l={l} secLines={secLines} />)}
                  {trav.length > 0 && (
                    <tr><td colSpan={3} style={{ padding:'8px 20px 2px', fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--tan)' }}>Travel</td></tr>
                  )}
                  {trav.map(l => <ShareRow key={l.id} l={l} secLines={secLines} />)}
                </tbody>
              </table>
            </div>
          );
        })}

        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 22px' }}>
          {[
            ['Production & Post-Production', nonTravel],
            ['Travel', travel],
            ['Project Management & Coordination', mgmt],
            ...(photo > 0 ? [['Photography', photo]] : []),
          ].filter(([, v]) => v > 0).map(([label, val]) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', color:'var(--muted)' }}>
              <span>{label}</span><span style={{ fontWeight:600, color:'var(--text)' }}>{fmt$(val)}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:800, borderTop:'1px solid var(--border)', marginTop:8, paddingTop:10 }}>
            <span>TOTAL PROJECT ESTIMATE</span><span style={{ color:'var(--tan)' }}>{fmt$(total)}</span>
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:18 }}>
          <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.6 }}>
            Estimate for Unbridled Media video production services.<br />
            All figures subject to change based on actuals and/or final output.
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginTop:12 }} onClick={() => window.print()}>Print / Save PDF</button>
        </div>
      </div>
    </div>
  );
}

function ShareRow({ l, secLines }) {
  const st = lineSubtotal(l, secLines);
  return (
    <tr style={{ borderTop:'1px solid rgba(255,255,255,0.03)' }}>
      <td style={{ padding:'6px 8px 6px 20px' }}>
        <div style={{ fontWeight:600 }}>{l.scope}</div>
        {l.notes && <div style={{ fontSize:10, color:'var(--muted)' }}>{l.notes}</div>}
      </td>
      <td style={{ padding:'6px 8px', textAlign:'right', whiteSpace:'nowrap', color:'var(--muted)', fontSize:11 }}>
        {l.percent == null ? `${Number(l.qty)} × ${fmt$(l.unit_cost)}` : ''}
      </td>
      <td style={{ padding:'6px 20px 6px 8px', textAlign:'right', fontWeight:700, whiteSpace:'nowrap', width:110 }}>{fmt$(st)}</td>
    </tr>
  );
}
