import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import { STATUS_COLORS } from './Hub.jsx';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export function FinanceHeader({ crumb }) {
  const { user, setUser } = useAuth();
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
        <Link to="/" className="logo" style={{ fontSize:18, textDecoration:'none' }}>Unbridled <em>Media</em></Link>
        <Link to="/finance" style={{ fontSize:11, color:'#5ABF80', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', textDecoration:'none' }}>ProFi</Link>
        {crumb && <span style={{ fontSize:11, color:'var(--muted)' }}>· {crumb}</span>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
      </div>
    </div>
  );
}

const FOLDERS = {
  live: { label: 'Live Projects', match: p => p.budget_status !== 'RFP' && p.budget_status !== 'Dead' },
  rfp: { label: 'RFP', match: p => p.budget_status === 'RFP' },
  archive: { label: 'Archive', match: p => p.budget_status === 'Dead' },
};

export default function Finance() {
  const nav = useNavigate();
  const [projects, setProjects] = useState(null);
  const [folder, setFolder] = useState('live');

  useEffect(() => { api.financeProjects().then(setProjects).catch(e => alert(e.message)); }, []);

  const shown = (projects || []).filter(FOLDERS[folder].match);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <FinanceHeader />
      <div style={{ maxWidth:900, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:16 }}>
          <div>
            <div className="page-title">Project Finance</div>
            <div className="page-sub">Budgets, vendor cost control &amp; reconciliation</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {Object.entries(FOLDERS).map(([k, f]) => {
              const count = (projects || []).filter(f.match).length;
              const active = folder === k;
              const color = k === 'rfp' ? '#e6c229' : k === 'archive' ? '#e05252' : '#5ABF80';
              return (
                <button key={k} onClick={() => setFolder(k)}
                  style={{
                    background: active ? color : 'transparent', display:'inline-flex', alignItems:'center', gap:6,
                    border: '1px solid ' + (active ? color : 'var(--border)'),
                    color: active ? '#0b0b0b' : color, borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer',
                  }}>
                  {k === 'rfp' ? '📁 ' : k === 'archive' ? '🗄 ' : ''}{f.label}
                  <span style={{ fontSize:10, opacity:0.75 }}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {!projects && <div className="empty">Loading…</div>}
        {projects && shown.length === 0 && (
          <div className="empty">
            {folder === 'rfp' ? 'No budgets in RFP right now.' : folder === 'archive' ? 'No archived (dead) budgets.' : 'No live projects yet — create one in FreePro first.'}
          </div>
        )}
        {projects && shown.map(p => (
          <div key={p.id} onClick={() => nav(`/finance/${p.id}`)}
            style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 18px', marginBottom:10, cursor:'pointer', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', opacity: p.budget_status === 'Dead' ? 0.55 : 1 }}>
            <div style={{ flex:1, minWidth:180 }}>
              <div style={{ fontSize:10, color:'var(--muted)' }}>{p.code}</div>
              <div style={{ fontSize:15, fontWeight:700 }}>{p.title}</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>{p.client}</div>
            </div>
            <div style={{ display:'flex', gap:22, alignItems:'center' }}>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Budget</div>
                <div style={{ fontSize:14, fontWeight:700, color: p.budget_id ? 'var(--text)' : 'var(--muted)' }}>{p.budget_id ? fmt$(p.budget_total) : '—'}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Direct Costs</div>
                <div style={{ fontSize:14, fontWeight:700, color: p.vcc_total ? '#e6c229' : 'var(--muted)' }}>{p.vcc_total ? fmt$(p.vcc_total) : '—'}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Gross Profit</div>
                <div style={{ fontSize:14, fontWeight:700, color: p.budget_id ? '#5ABF80' : 'var(--muted)' }}>
                  {p.budget_id ? fmt$((p.budget_total - (p.total_cap_co || 0)) - p.vcc_total) : '—'}
                </div>
              </div>
              {(() => { const sc = STATUS_COLORS[p.budget_status] || 'var(--muted)'; return (
                <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:sc, border:`1px solid ${sc}55`, borderRadius:10, padding:'2px 8px', whiteSpace:'nowrap' }}>
                  {p.budget_id ? (p.budget_status || 'Draft') : 'No budget'}
                </span>
              ); })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
