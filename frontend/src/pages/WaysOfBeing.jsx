import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

// Admin-only archive of every Ways of Being shoutout
export default function WaysOfBeing() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.allWobs().then(setRows).catch(e => setErr(e.message)); }, []);
  const fmtD = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <span style={{ fontSize:12, color:'#f7b52d', fontWeight:700, letterSpacing:'0.04em' }}>Ways of Being</span>
        </div>
        <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>‹ Reports</Link>
      </div>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div className="page-title">Ways of Being</div>
        <div className="page-sub">Every shoutout for someone going above and beyond — two are collected each week.</div>
        {err && <div className="empty">{err}</div>}
        {rows && rows.length === 0 && <div className="empty">No shoutouts yet — the first two arrive this week.</div>}
        {(rows || []).map((w, i) => (
          <div key={i} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderLeft:'3px solid #f7b52d', borderRadius:10, padding:'14px 18px', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
              <div style={{ fontSize:13, fontWeight:800 }}>🏆 {w.recipient_name}</div>
              <div style={{ fontSize:10, color:'var(--muted)' }}>{fmtD(w.created_at)} · {w.week}</div>
            </div>
            <div style={{ fontSize:13, lineHeight:1.55, margin:'6px 0 4px' }}>“{w.text}”</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>— {w.giver_name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
