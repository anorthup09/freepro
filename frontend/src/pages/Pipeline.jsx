import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

const PIPELINE_STAGES = [
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
    if (['Live', 'Reconcile', 'Reconciled'].includes(p.budget_status)) return 'done';
    if (p.budget_status === 'RFP') return 'active';
    return null;
  }
  if (key === 'reconcile' && ['Reconcile', 'Reconciled'].includes(p.budget_status)) return 'done';
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


export default function Pipeline() {
  const { user, setUser } = useAuth();
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <span style={{ fontSize:11, color:'var(--orange)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Project Pipeline</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        </div>
      </div>
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'6px 26px 60px' }}>
        <div style={{ marginBottom:14 }}>
          <div className="page-title">Project Pipeline</div>
          <div className="page-sub">Click any stage to cycle: in progress → complete → clear</div>
        </div>
        <PipelinePanel />
      </div>
    </div>
  );
}
