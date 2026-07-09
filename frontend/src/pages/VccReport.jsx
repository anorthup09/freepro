import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMonth = m => {
  if (!m) return 'No close month';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 15).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// A project's VCC is "Closed" once its main budget is closed out
const isClosed = r => r.budget_status === 'Closed';

export default function VccReport() {
  const { user, setUser } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState('Live'); // 'Live' | 'Closed'
  const [month, setMonth] = useState('');   // '' = all months (Closed view)

  useEffect(() => { api.vccReport().then(setRows).catch(e => setErr(e.message)); }, []);

  const { live, closed, months } = useMemo(() => {
    const live = (rows || []).filter(r => !isClosed(r));
    const closed = (rows || []).filter(isClosed);
    const months = [...new Set(closed.map(r => r.close_month || ''))].sort().reverse();
    return { live, closed, months };
  }, [rows]);

  const shown = view === 'Live' ? live : closed.filter(r => !month || (r.close_month || '') === month);

  // Group by project
  const groups = useMemo(() => {
    const by = new Map();
    for (const r of shown) {
      if (!by.has(r.project_id)) by.set(r.project_id, { code: r.code, title: r.project_title, client: r.client, closeMonth: r.close_month, status: r.budget_status, entries: [] });
      by.get(r.project_id).entries.push(r);
    }
    return [...by.values()];
  }, [shown]);

  const total = shown.reduce((s, r) => s + Number(r.amount || 0), 0);
  const th = { padding:'7px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', whiteSpace:'nowrap' };
  const td = { padding:'7px 10px', fontSize:12, verticalAlign:'middle' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <span style={{ fontSize:12, color:'#e6c229', fontWeight:700, letterSpacing:'0.04em' }}>📈 Reports</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>‹ Reports</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        </div>
      </div>
      <div style={{ maxWidth:1050, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div className="page-title" style={{ marginBottom:2 }}>All VCCs</div>
            <div className="page-sub">Every virtual card entry across all projects</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>
              {['Live', 'Closed'].map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ background: view === v ? (v === 'Live' ? 'rgba(90,191,128,0.18)' : 'rgba(138,143,152,0.18)') : 'transparent',
                    border:'none', color: view === v ? (v === 'Live' ? '#5ABF80' : '#c7ccd4') : 'var(--muted)',
                    padding:'7px 20px', fontSize:12, fontWeight:800, cursor:'pointer' }}>
                  {v}{rows ? ` (${v === 'Live' ? live.length : closed.length})` : ''}
                </button>
              ))}
            </div>
            {view === 'Closed' && (
              <select value={month} onChange={e => setMonth(e.target.value)} style={{ width:'auto', fontSize:12 }}>
                <option value="">All months</option>
                {months.map(m => <option key={m || 'none'} value={m}>{fmtMonth(m)}</option>)}
              </select>
            )}
          </div>
        </div>

        {err && <div className="empty">{err}</div>}
        {!err && !rows && <div className="empty">Loading…</div>}
        {rows && shown.length === 0 && <div className="empty">No {view.toLowerCase()} VCC entries{view === 'Closed' && month ? ` for ${fmtMonth(month)}` : ''}.</div>}

        {rows && shown.length > 0 && (
          <div style={{ fontSize:12, color:'var(--muted)', margin:'10px 0 14px' }}>
            {shown.length} entr{shown.length === 1 ? 'y' : 'ies'} · <b style={{ color:'var(--text)' }}>{fmt$(total)}</b> total
          </div>
        )}

        <div style={{ display:'grid', gap:14 }}>
          {groups.map(g => (
            <div key={g.code + g.title} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
                <span style={{ fontSize:12, fontWeight:800 }}>{g.code}</span>
                <span style={{ fontSize:12, color:'var(--muted)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.title}{g.client ? ` · ${g.client}` : ''}</span>
                {view === 'Closed' && <span style={{ fontSize:10, color:'var(--muted)' }}>{fmtMonth(g.closeMonth)}</span>}
                <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
                  color: view === 'Live' ? '#5ABF80' : '#8a8f98', border:`1px solid ${view === 'Live' ? '#5ABF80' : '#8a8f98'}55`, borderRadius:20, padding:'2px 10px' }}>
                  {view}
                </span>
                <span style={{ fontSize:12, fontWeight:800 }}>{fmt$(g.entries.reduce((s, r) => s + Number(r.amount || 0), 0))}</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>
                    <th style={th}>Date</th><th style={th}>Vendor</th><th style={th}>Description</th><th style={th}>Category</th><th style={th}>Status</th><th style={{ ...th, textAlign:'right' }}>Amount</th>
                  </tr></thead>
                  <tbody>
                    {g.entries.map(r => (
                      <tr key={r.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ ...td, whiteSpace:'nowrap', color:'var(--muted)' }}>{r.entry_date ? String(r.entry_date).slice(0, 10) : '—'}</td>
                        <td style={td}>{r.vendor || '—'}</td>
                        <td style={td}>{r.description || '—'}</td>
                        <td style={{ ...td, color:'var(--muted)' }}>{r.category || '—'}</td>
                        <td style={td}>
                          <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em',
                            color: r.status === 'HOLD' ? '#e6c229' : '#5ABF80', border:`1px solid ${r.status === 'HOLD' ? '#e6c229' : '#5ABF80'}55`, borderRadius:20, padding:'2px 8px' }}>
                            {r.status || '—'}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign:'right', fontWeight:700, whiteSpace:'nowrap' }}>{fmt$(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
