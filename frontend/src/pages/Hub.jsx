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

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div>
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:26, filter:'brightness(0) invert(1)', opacity:0.95, display:'block' }} />
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:5 }}>Operating Platform</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
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


        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 16px 60px' }}>
          <div style={{ width:'100%', maxWidth:1150 }}>
            <PipelinePanel />
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

    </div>
  );
}


export const PIPELINE_STAGES = [
  ['rfp', 'RFP'],
  ['budget_approved', 'Budget Approved'],
  ['contract_signed', 'Contract Signed'],
  ['first_invoice', 'First Invoice Sent'],
  ['pre_production', 'Pre Production'],
  ['production', 'Production'],
  ['post_production', 'Post-Production'],
  ['reconcile', 'Reconcile'],
  ['second_invoice', 'Second Invoice Sent'],
  ['closed', 'Closed'],
];

function derivedState(p, key) {
  if (key === 'rfp') {
    if (!p.budget_id) return null;
    return p.budget_status === 'RFP' ? 'active' : 'done';
  }
  if (key === 'budget_approved') {
    if (['Live', 'Reconciled'].includes(p.budget_status)) return 'done';
    if (p.budget_status === 'RFP') return 'active';
    return null;
  }
  if (key === 'reconcile' && p.budget_status === 'Reconciled') return 'done';
  return null;
}

function PipelinePanel() {
  const [projects, setProjects] = useState(null);
  const [showRfp, setShowRfp] = useState(() => localStorage.getItem('pipeline_rfp') !== 'off');
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    api.financeProjects().then(ps => {
      setProjects(ps);
      const o = {};
      for (const p of ps) { try { o[p.id] = JSON.parse(p.pipeline || '{}'); } catch { o[p.id] = {}; } }
      setOverrides(o);
    }).catch(() => setProjects([]));
  }, []);
  useEffect(() => { localStorage.setItem('pipeline_rfp', showRfp ? 'on' : 'off'); }, [showRfp]);

  if (!projects) return null;
  const rows = projects.filter(p => p.budget_status !== 'Dead' && (showRfp || p.budget_status !== 'RFP'));
  if (!rows.length) return null;

  function stateFor(p, key) {
    const o = overrides[p.id] || {};
    return o[key] !== undefined && o[key] !== null ? o[key] : derivedState(p, key);
  }
  function cycle(p, key) {
    const cur = stateFor(p, key);
    const next = !cur ? 'active' : cur === 'active' ? 'done' : null;
    const po = { ...(overrides[p.id] || {}), [key]: next };
    setOverrides(o => ({ ...o, [p.id]: po }));
    api.savePipeline(p.id, po).catch(() => {});
  }

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginBottom:30 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em' }}>Project Pipeline</div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:10, color:'var(--muted)' }}>
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#e6c229', marginRight:4 }} />In progress
            <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%', background:'#5ABF80', margin:'0 4px 0 12px' }} />Complete
          </span>
          <button onClick={() => setShowRfp(v => !v)}
            style={{ background: showRfp ? 'rgba(230,194,41,0.15)' : 'transparent', border:'1px solid ' + (showRfp ? '#e6c229' : 'var(--border)'), color: showRfp ? '#e6c229' : 'var(--muted)', borderRadius:20, padding:'3px 12px', fontSize:10, fontWeight:700, cursor:'pointer' }}>
            {showRfp ? '✓ ' : ''}RFPs
          </button>
        </div>
      </div>

      {rows.map(p => (
        <div key={p.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'8px 0', borderTop:'1px solid rgba(255,255,255,0.04)', flexWrap:'wrap' }}>
          <div style={{ width:230, minWidth:180, fontSize:11, color:'var(--muted)' }}>
            {p.client} | {p.code}
            <div style={{ fontWeight:700, fontSize:13, color:'var(--text)' }}>{p.title}</div>
          </div>
          <div style={{ flex:1, minWidth:420, display:'flex', gap:4 }}>
            {PIPELINE_STAGES.map(([key, label]) => {
              const st = stateFor(p, key);
              const bg = st === 'done' ? '#5ABF80' : st === 'active' ? '#e6c229' : 'rgba(255,255,255,0.06)';
              const color = st ? '#0b0b0b' : 'var(--muted)';
              return (
                <div key={key} title={label + ' — click to cycle: in progress → complete → clear'}
                  onClick={() => cycle(p, key)}
                  style={{ flex:1, height:28, background:bg, color, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:8, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.02em', cursor:'pointer', textAlign:'center', lineHeight:1.15, padding:'0 2px', userSelect:'none' }}>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
