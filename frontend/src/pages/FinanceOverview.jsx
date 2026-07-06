import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { FinanceHeader } from './Finance.jsx';
import { STATUS_COLORS } from './Hub.jsx';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtCloseMonth(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 15).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function FinanceOverview() {
  const nav = useNavigate();
  const [projects, setProjects] = useState(null);

  useEffect(() => { api.financeProjects().then(setProjects).catch(e => alert(e.message)); }, []);

  const gridProjects = (projects || []).filter(p => p.budget_status !== 'RFP');

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <FinanceHeader crumb="Overview" />
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'6px 26px 60px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
          <div>
            <div className="page-title">Project Finance Overview</div>
            <div className="page-sub">{projects ? `${gridProjects.length} project${gridProjects.length === 1 ? '' : 's'} · RFPs live in the RFP folder` : 'Loading…'}</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => nav('/finance/report')}>📄 Weekly Finance Report</button>
        </div>
        <div className="pos-table-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, minWidth:820 }}>
            <thead>
              <tr style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left' }}>
                <th style={{ padding:'10px 8px 10px 16px' }}>Code</th>
                <th style={{ padding:8 }}>Project</th>
                <th style={{ padding:8 }}>Budget Owner</th>
                <th style={{ padding:8 }}>Status</th>
                <th style={{ padding:8, textAlign:'right' }}>Total Budget</th>
                <th style={{ padding:8, textAlign:'right' }}>Total Fee</th>
                <th style={{ padding:8 }}>Close Month</th>
                <th style={{ padding:'8px 16px 8px 8px', textAlign:'right' }}>Open In</th>
              </tr>
            </thead>
            <tbody>
              {gridProjects.map(p => {
                const dead = p.budget_status === 'Dead';
                const sc = STATUS_COLORS[p.budget_status] || 'var(--muted)';
                return (
                  <tr key={p.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)', opacity: dead ? 0.5 : 1 }}>
                    <td style={{ padding:'8px 8px 8px 16px', color:'var(--muted)', whiteSpace:'nowrap' }}>{p.code}</td>
                    <td style={{ padding:8 }}>
                      <div style={{ fontWeight:600 }}>{p.title}</div>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>{p.client}</div>
                    </td>
                    <td style={{ padding:8, whiteSpace:'nowrap' }}>{p.media_rep || '—'}</td>
                    <td style={{ padding:8 }}>
                      <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:sc, border:`1px solid ${sc}55`, borderRadius:10, padding:'2px 8px', whiteSpace:'nowrap' }}>
                        {p.budget_id ? (p.budget_status || 'Draft') : 'No budget'}
                      </span>
                    </td>
                    <td style={{ padding:8, textAlign:'right', fontWeight:700, whiteSpace:'nowrap' }}>{p.budget_id ? fmt$(p.budget_total) : '—'}</td>
                    <td style={{ padding:8, textAlign:'right', fontWeight:600, color:'#5ABF80', whiteSpace:'nowrap' }}>{p.budget_id ? fmt$(p.fee) : '—'}</td>
                    <td style={{ padding:8, whiteSpace:'nowrap' }}>{fmtCloseMonth(p.close_month)}</td>
                    <td style={{ padding:'8px 16px 8px 8px', textAlign:'right', whiteSpace:'nowrap' }}>
                      <span title="ProFi" onClick={() => nav(`/finance/${p.id}`)} style={{ cursor:'pointer', color:'#5ABF80', fontWeight:800, padding:'0 7px' }}>$</span>
                      <FreeProLink p={p} nav={nav} />
                      <span title="AvocadoPost — in development" style={{ opacity:0.3, padding:'0 7px' }}>🥑</span>
                    </td>
                  </tr>
                );
              })}
              {projects && gridProjects.length === 0 && <tr><td colSpan={8} style={{ padding:16, color:'var(--muted)', fontStyle:'italic' }}>No projects yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


function FreeProLink({ p, nav }) {
  const [open, setOpen] = React.useState(false);
  const shoots = p.shoots || [];
  if (shoots.length <= 1) {
    return <span title="FreePro" onClick={() => nav(`/projects/${p.id}?tab=schedule`)} style={{ cursor:'pointer', padding:'0 7px' }}>🎬</span>;
  }
  return (
    <span style={{ position:'relative', display:'inline-block' }}>
      <span title="FreePro — pick a shoot" onClick={() => setOpen(o => !o)} style={{ cursor:'pointer', padding:'0 7px' }}>🎬▾</span>
      {open && (
        <div style={{ position:'absolute', right:0, top:'120%', zIndex:60, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:5, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', minWidth:190, textAlign:'left' }}>
          {shoots.map(sh => (
            <div key={sh.code} onClick={() => { setOpen(false); nav(`/projects/${p.id}?tab=schedule&shoot=${encodeURIComponent(sh.code)}`); }}
              style={{ padding:'6px 10px', borderRadius:6, cursor:'pointer', fontSize:11 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ color:'#e6c229', fontWeight:800 }}>{sh.code}</span>
              {sh.trip && <span style={{ color:'var(--muted)' }}> — {sh.trip}</span>}
            </div>
          ))}
          <div onClick={() => { setOpen(false); nav(`/projects/${p.id}`); }}
            style={{ padding:'6px 10px', borderRadius:6, cursor:'pointer', fontSize:11, color:'var(--muted)', borderTop:'1px solid var(--border)', marginTop:3 }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            Project home
          </div>
        </div>
      )}
    </span>
  );
}
