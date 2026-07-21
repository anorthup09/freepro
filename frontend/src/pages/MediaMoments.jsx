import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const ACCENT = '#e6c229';

// Admin-only archive of every MediaMoment (fun fact) submission, with delete.
export default function MediaMoments() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.allFunFacts().then(setRows).catch(e => setErr(e.message)); }, []);
  const fmtD = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  async function remove(r) {
    if (!confirm(`Delete this MediaMoment from ${r.member_name || r.member_email}?`)) return;
    try { await api.deleteFunFact(r.id); setRows(rs => rs.filter(x => x.id !== r.id)); }
    catch (e) { alert(e.message); }
  }
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <span style={{ fontSize:12, color:ACCENT, fontWeight:700, letterSpacing:'0.04em' }}>MediaMoments</span>
        </div>
        <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>‹ Reports</Link>
      </div>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div className="page-title">MediaMoments</div>
        <div className="page-sub">Every MediaMoment submission from the weekly team prompts{rows ? ` · ${rows.length}` : ''}.</div>
        {err && <div className="empty">{err}</div>}
        {rows && rows.length === 0 && <div className="empty">No MediaMoment submissions yet.</div>}
        {(rows || []).map(r => (
          <div key={r.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderLeft:`3px solid ${ACCENT}`, borderRadius:10, padding:'14px 18px', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
              <div style={{ fontSize:13, fontWeight:800 }}>{r.member_name || r.member_email}</div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{fmtD(r.created_at)} · {r.week}</div>
                <button title="Delete this submission" onClick={() => remove(r)}
                  style={{ background:'none', border:'1px solid var(--border2)', color:'var(--red-text, #e05252)', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, cursor:'pointer' }}>✕ Delete</button>
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', margin:'6px 0 3px' }}>{r.prompt}</div>
            <div style={{ fontSize:13, lineHeight:1.55 }}>“{r.answer}”</div>
          </div>
        ))}
      </div>
    </div>
  );
}
