import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import GanttChart, { MilestoneTable } from '../components/GanttChart.jsx';

const AVO = '#9DC183';

// Public (no-auth) Gantt view reached via /gantt/:token share links.
export default function GanttShare() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.getGanttShare(token).then(setData).catch(e => setErr(e.message)); }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '26px 18px 60px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: AVO, fontWeight: 800, letterSpacing: '0.04em' }}>🥑 AvocadoPost</div>
            <div className="page-title" style={{ marginTop: 4 }}>
              {data ? (data.kind === 'project' ? `Project Timeline — ${data.ref}` : (data.edits[0]?.title || 'Edit Timeline')) : 'Edit Timeline'}
            </div>
            <div className="page-sub">Post-production schedule</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <button onClick={async () => {
                try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2500); }
                catch { prompt('Copy this link:', window.location.href); }
              }}
              style={{ background: copied ? AVO : `${AVO}26`, border:`1px solid ${AVO}`, color: copied ? '#0b0b0b' : AVO, borderRadius:20, padding:'5px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
              {copied ? '✓ Link Copied' : 'Share'}
            </button>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 22, filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          </div>
        </div>

        {err && <div className="empty">{err}</div>}
        {!err && !data && <div className="empty">Loading…</div>}
        {data && <GanttChart edits={data.edits} />}
        {data && (
          <div style={{ display:'grid', gap:14, marginTop:18 }}>
            {data.edits.map(ed => (
              <MilestoneTable key={ed.id} edit={ed} title={data.kind === 'project' ? ed.title : 'Timeline Dates'} />
            ))}
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 14 }}>
          Live view — dates update automatically as the edit schedule changes.
        </div>
      </div>
    </div>
  );
}
