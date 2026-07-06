import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';

const TILES = [
  {
    key: 'profi',
    title: 'ProFi',
    tagline: 'Project Finance · In High Fidelity',
    desc: 'Client-ready budgets, vendor cost control, and final reconciliation — mixed and mastered.',
    accent: '#5ABF80',
    icon: '$',
    to: '/finance',
    status: 'In Development',
  },
  {
    key: 'freepro',
    title: 'FreePro',
    em: true,
    tagline: 'Production Management',
    desc: 'Call sheets, schedules, crew, travel, gear, shot lists, and client views.',
    accent: 'var(--orange)',
    icon: '🎬',
    to: '/projects',
    status: null,
  },
  {
    key: 'avo',
    title: 'AvocadoPost',
    tagline: 'Post-Production Management',
    desc: 'Edit pipelines, review & approval, versioning, and delivery.',
    accent: '#9DC183',
    icon: '🥑',
    to: null,
    status: 'In Development',
  },
];

export const STATUS_COLORS = {
  RFP: '#e6c229', Draft: 'var(--muted)', Sent: '#4a9eff', Live: '#5ABF80', Dead: '#e05252', Reconciled: '#9DC183',
};

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtCloseMonth(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 15).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export default function Hub() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const [view, setView] = useState(() => localStorage.getItem('hub_view') || 'tiles');
  const [projects, setProjects] = useState(null);

  useEffect(() => { localStorage.setItem('hub_view', view); }, [view]);
  useEffect(() => {
    if (view === 'projects' && !projects) api.financeProjects().then(setProjects).catch(e => alert(e.message));
  }, [view, projects]);

  const gridProjects = (projects || []).filter(p => p.budget_status !== 'RFP');

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div>
          <div className="logo" style={{ fontSize:18 }}>Unbridled <em>Media</em></div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:2 }}>Operating Platform</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
            {[['tiles','Tiles'],['projects','Projects']].map(([k, label]) => (
              <button key={k} onClick={() => setView(k)}
                style={{ background: view === k ? 'var(--orange)' : 'transparent', color: view === k ? '#fff' : 'var(--muted)', border:'none', padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </div>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          {user?.role === 'ADMIN' && (
            <button className="btn btn-ghost btn-sm" title="Download a full database backup (all projects, budgets, contracts, roster)"
              onClick={async () => {
                try {
                  const r = await fetch('/api/admin/backup', { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
                  if (!r.ok) throw new Error('Backup failed');
                  const blob = await r.blob();
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `freepro-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                } catch (e) { alert(e.message); }
              }}>⬇ Backup</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        </div>
      </div>

      {view === 'tiles' ? (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 16px 60px' }}>
          <div style={{ width:'100%', maxWidth:1000 }}>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:22, fontWeight:800 }}>Where to today?</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Every project, from budget to delivery.</div>
            </div>
            <div className="hub-tiles" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
              {TILES.map(t => {
                const clickable = !!t.to;
                return (
                  <div key={t.key}
                    onClick={() => clickable && nav(t.to)}
                    style={{
                      background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${t.accent}`,
                      borderRadius:12, padding:'26px 24px 22px', cursor: clickable ? 'pointer' : 'default',
                      opacity: clickable ? 1 : 0.65, transition:'transform .15s ease, border-color .15s ease',
                      display:'flex', flexDirection:'column', minHeight:200,
                    }}
                    onMouseEnter={e => { if (clickable) e.currentTarget.style.transform = 'translateY(-3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:`${t.accent}22`, color:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800 }}>
                        {t.icon}
                      </div>
                      {t.status && (
                        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:t.accent, border:`1px solid ${t.accent}55`, borderRadius:20, padding:'3px 10px' }}>
                          {t.status}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:17, fontWeight:800 }}>
                      {t.em ? <>Free<em style={{ color:'var(--orange)', fontStyle:'normal' }}>Pro</em></> : t.title}
                    </div>
                    <div style={{ fontSize:10, color:t.accent, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', margin:'3px 0 10px' }}>{t.tagline}</div>
                    <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.55, flex:1 }}>{t.desc}</div>
                    {clickable && <div style={{ fontSize:11, color:t.accent, fontWeight:600, marginTop:14 }}>Open →</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex:1, padding:'6px 26px 60px' }}>
          <div style={{ maxWidth:1200, margin:'0 auto' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
              <div>
                <div className="page-title">All Projects</div>
                <div className="page-sub">{projects ? `${gridProjects.length} project${gridProjects.length === 1 ? '' : 's'} · RFPs live in ProFi` : 'Loading…'}</div>
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
                          <span title="FreePro" onClick={() => nav(`/projects/${p.id}`)} style={{ cursor:'pointer', padding:'0 7px' }}>🎬</span>
                          <span title="AvocadoPost — in development" style={{ opacity:0.3, padding:'0 7px' }}>🥑</span>
                        </td>
                      </tr>
                    );
                  })}
                  {projects && gridProjects.length === 0 && <tr><td colSpan={8} style={{ padding:16, color:'var(--muted)', fontStyle:'italic' }}>No projects yet (RFP budgets appear in ProFi's RFP folder once approved).</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
