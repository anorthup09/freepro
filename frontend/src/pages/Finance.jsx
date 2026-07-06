import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api, onSaveState } from '../api.js';
import { STATUS_COLORS } from './Hub.jsx';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

export function SaveIndicator() {
  const [state, setState] = useState(null); // null | 'saving' | 'saved'
  useEffect(() => {
    let hideTimer;
    const off = onSaveState(s2 => {
      clearTimeout(hideTimer);
      setState(s2);
      if (s2 === 'saved') hideTimer = setTimeout(() => setState(null), 2200);
    });
    return () => { off(); clearTimeout(hideTimer); };
  }, []);
  if (!state) return null;
  const saved = state === 'saved';
  return (
    <div className="no-print" style={{
      position:'fixed', bottom:18, right:20, zIndex:200, pointerEvents:'none',
      background: saved ? 'rgba(90,191,128,0.15)' : 'var(--bg2)',
      border: '1px solid ' + (saved ? '#5ABF80' : 'var(--border)'),
      color: saved ? '#5ABF80' : 'var(--muted)',
      borderRadius:20, padding:'6px 16px', fontSize:11, fontWeight:700,
      boxShadow:'0 6px 18px rgba(0,0,0,0.4)', transition:'opacity .2s ease',
    }}>
      {saved ? '✓ Saved' : 'Saving…'}
    </div>
  );
}

export function FinanceHeader({ crumb }) {
  const { user, setUser } = useAuth();
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
        </Link>
        <Link to="/finance" style={{ fontSize:12, color:'#5ABF80', fontWeight:700, letterSpacing:'0.04em', textDecoration:'none' }}>ProFi</Link>
        {crumb && <span style={{ fontSize:11, color:'var(--muted)' }}>· {crumb}</span>}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
        <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Back to Hub</Link>
        <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
      </div>
      <SaveIndicator />
    </div>
  );
}

const FOLDERS = {
  rfp: { label: 'RFP', match: p => p.budget_status === 'RFP' },
  live: { label: 'Live Projects', match: p => p.budget_status !== 'RFP' && p.budget_status !== 'Dead' && p.budget_status !== 'Closed' },
  archive: { label: 'Archive', match: p => p.budget_status === 'Dead' || p.budget_status === 'Closed' },
};

export function LogoField({ value, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  useEffect(() => {
    if (!q.trim()) { setResults(null); return; }
    const t = setTimeout(() => api.searchClientLogos(q).then(setResults).catch(() => setResults([])), 300);
    return () => clearTimeout(t);
  }, [q]);
  function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const maxH = 96;
      const scale = Math.min(1, maxH / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      onChange(canvas.toDataURL('image/png'));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }
  return (
    <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-start' }}>
      <div style={{ flex:1, minWidth:180 }}>
        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Client Logo (PNG)</div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          {value && <img src={value} alt="Client logo" style={{ height:32, maxWidth:160, objectFit:'contain', background:'rgba(255,255,255,0.08)', borderRadius:6, padding:'2px 6px' }} />}
          <input type="file" accept="image/png" style={{ fontSize:12, maxWidth:190 }} onChange={upload} />
          {value && <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => onChange(null)}>Remove</button>}
        </div>
      </div>
      <div style={{ flex:1, minWidth:180, position:'relative' }}>
        <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Or reuse a past client logo</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search client…"
          style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'8px 10px', fontSize:13, width:'100%' }} />
        {results && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:20, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, marginTop:4, maxHeight:200, overflowY:'auto' }}>
            {results.length === 0 && <div style={{ padding:'8px 12px', fontSize:11, color:'var(--muted)' }}>No logos found for that client.</div>}
            {results.map(r => (
              <div key={r.client} onClick={() => { onChange(r.client_logo); setQ(''); setResults(null); }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                <img src={r.client_logo} alt={r.client} style={{ height:24, maxWidth:90, objectFit:'contain', background:'rgba(255,255,255,0.08)', borderRadius:4, padding:'1px 4px' }} />
                <span style={{ fontSize:12 }}>{r.client}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewProjectModal({ onClose, onCreated }) {
  const [f, setF] = useState({ code:'', title:'', client:'' });
  const [logo, setLogo] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const ok = f.code && f.title && f.client;
  const submit = async () => {
    if (!ok || saving) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const p = await api.createProject({ ...f, city: '—', state: '—', startDate: today, endDate: today, clientLogo: logo });
      await api.createBudget(p.id);
      onCreated(p);
    } catch (e) { alert(e.message); setSaving(false); }
  };
  const field = (label, k, type = 'text', ph = '') => (
    <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', flex:1, minWidth:120 }}>
      {label}
      <input type={type} value={f[k]} onChange={set(k)} placeholder={ph}
        style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'8px 10px', fontSize:13 }} />
    </label>
  );
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #5ABF80', borderRadius:12, padding:'22px 24px', width:'100%', maxWidth:560 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>New Project</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {field('Project Code', 'code', 'text', 'e.g. 02.CHP00126')}
            {field('Client', 'client')}
          </div>
          {field('Project Name', 'title')}
          <LogoField value={logo} onChange={setLogo} />
          <div style={{ fontSize:11, color:'var(--muted)' }}>A budget is created automatically in <span style={{ color:'#e6c229', fontWeight:700 }}>RFP</span> status.</div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button disabled={!ok || saving} onClick={submit}
              style={{ background: ok ? '#5ABF80' : 'var(--border)', color:'#0b0b0b', border:'none', borderRadius:8, padding:'8px 18px', fontSize:12, fontWeight:800, cursor: ok ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TileStatusPill({ p, onClosed }) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_COLORS[p.budget_status] || 'var(--muted)';
  const isLive = p.budget_status === 'Live';
  async function close(e) {
    e.stopPropagation();
    setOpen(false);
    if (!confirm(`Close ${p.title} and move it to Archive?`)) return;
    try {
      await api.updateBudget(p.budget_id, { status: 'Closed' });
      onClosed();
    } catch (err) { alert(err.message); }
  }
  return (
    <span style={{ position:'relative' }} onClick={e => e.preventDefault()}>
      <button type="button"
        onClick={e => { e.stopPropagation(); if (isLive) setOpen(o => !o); }}
        style={{ background:'none', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:sc, border:`1px solid ${sc}55`, borderRadius:10, padding:'2px 8px', whiteSpace:'nowrap', cursor: isLive ? 'pointer' : 'default', display:'inline-flex', alignItems:'center', gap:4 }}>
        {p.budget_id ? (p.budget_status || 'Draft') : 'No budget'}
        {isLive && <span style={{ fontSize:7 }}>▼</span>}
      </button>
      {open && (
        <div onClick={e => e.stopPropagation()}
          style={{ position:'absolute', top:'115%', right:0, zIndex:40, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:4, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', minWidth:170 }}>
          <div onClick={close}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, cursor:'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#8a8f98', flexShrink:0 }} />
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#8a8f98' }}>Close</div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>Moves the project to Archive</div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

export default function Finance() {
  const nav = useNavigate();
  const [projects, setProjects] = useState(null);
  const [folder, setFolder] = useState('live');
  const [showNew, setShowNew] = useState(false);

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
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
            <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowNew(true)}
              style={{ background:'rgba(90,191,128,0.2)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
              + New Project
            </button>
            <button onClick={() => nav('/finance/overview')}
              style={{ background:'rgba(232,80,10,0.2)', border:'1px solid var(--orange)', color:'var(--orange)', borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              Project Finance Overview
            </button>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
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
              <TileStatusPill p={p} onClosed={() => setProjects(ps => ps.map(x => x.id === p.id ? { ...x, budget_status: 'Closed' } : x))} />
            </div>
          </div>
        ))}
      </div>
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreated={p => nav(`/finance/${p.id}`)} />}
    </div>
  );
}
