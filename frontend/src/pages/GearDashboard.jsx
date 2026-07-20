import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { GearRequestView } from '../components/GearRequestModal.jsx';
import DrivesTile from '../components/DrivesTile.jsx';

const fmtT = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';


// Per-shoot gear dashboard: locked mirror of the submitted gear request on the
// left, an activity feed (comments + events) on the right.
export default function GearDashboard() {
  const { pid } = useParams();
  const nav = useNavigate();
  const [request, setRequest] = useState(undefined); // undefined=loading, null=none
  const [feed, setFeed] = useState([]);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api.gearRequestForProject(pid).then(setRequest).catch(() => setRequest(null));
    api.gearActivity(pid).then(setFeed).catch(() => {});
  }, [pid]);

  async function post() {
    const body = text.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const row = await api.addGearActivity(pid, body);
      setFeed(f => [...f, row]);
      setText('');
    } catch (e) { alert(e.message); }
    setPosting(false);
  }

  const header = request && request !== null
    ? `${request.code || ''} — ${request.title || ''}`
    : 'Gear Dashboard';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 16px 60px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/projects')}>‹ Gear Management</button>
        <div style={{ fontSize: 18, fontWeight: 800, margin: '10px 0 16px' }}>{header}</div>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Left — locked gear request form */}
          <div style={{ flex: '1 1 460px', minWidth: 300, background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '3px solid var(--orange)', borderRadius: 12, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Gear Request</div>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '2px 8px' }}>🔒 Locked</span>
            </div>
            {request === undefined && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
            {request === null && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No gear request has been submitted for this shoot yet.</div>}
            {request && <GearRequestView r={request} />}
          </div>

          <DrivesTile pid={pid} />

          {/* Right — activity feed */}
          <div style={{ flex: '1 1 340px', minWidth: 280, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 12 }}>Activity</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
              {feed.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No activity yet.</div>}
              {feed.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 6, borderRadius: 3, flexShrink: 0, background: a.kind === 'event' ? 'var(--orange)' : '#4a9eff' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', fontStyle: a.kind === 'event' ? 'italic' : 'normal' }}>{a.body}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{a.author || 'someone'} · {fmtT(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment…"
                onKeyDown={e => e.key === 'Enter' && post()} style={{ flex: 1, fontSize: 13 }} />
              <button onClick={post} disabled={!text.trim() || posting}
                style={{ background: text.trim() ? 'var(--orange)' : 'var(--border)', color: 'var(--text)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 800, cursor: text.trim() ? 'pointer' : 'default' }}>
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
