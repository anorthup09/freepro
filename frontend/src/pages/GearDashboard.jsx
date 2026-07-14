import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { GearRequestView } from '../components/GearRequestModal.jsx';

const fmtT = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

// Drives tile — tag hard drives from the asset database onto this shoot
function DrivesTile({ pid }) {
  const [drives, setDrives] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [q, setQ] = useState('');
  const load = () => api.driveRoster().then(setDrives).catch(() => setDrives([]));
  useEffect(() => { load(); }, []);

  const mine = (drives || []).filter(d => d.project_id === pid);
  const matches = (drives || []).filter(d => d.project_id !== pid)
    .filter(d => !q.trim() || [d.name, d.asset_tag, d.serial_number, d.location].some(v => (v || '').toLowerCase().includes(q.trim().toLowerCase())));

  async function tag(d) {
    if (d.project_id && !confirm(`${d.name}${d.asset_tag ? ' (' + d.asset_tag + ')' : ''} is tagged to ${d.project_code} — move it to this shoot?`)) return;
    try { await api.assignDrive(d.id, pid); load(); } catch (e) { alert(e.message); }
  }
  async function untag(d) {
    try { await api.returnDrive(d.id); load(); } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ flex: '1 1 340px', minWidth: 280, background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '3px solid #4a9eff', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>Drives <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>· {mine.length} on this shoot</span></div>
        <button className="btn btn-ghost btn-sm" onClick={() => setPickerOpen(o => !o)}>{pickerOpen ? 'Done' : '+ Tag Drive'}</button>
      </div>
      {drives === null && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading…</div>}
      {drives !== null && mine.length === 0 && !pickerOpen && (
        <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No drives tagged to this shoot yet.</div>
      )}
      {mine.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: 13 }}>💾</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}{d.asset_tag ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {d.asset_tag}</span> : ''}</div>
            <div style={{ fontSize: 9, color: 'var(--muted)' }}>{[d.serial_number, d.assigned_by ? `tagged by ${d.assigned_by}` : ''].filter(Boolean).join(' · ')}</div>
          </div>
          <button title="Return this drive" onClick={() => untag(d)}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--muted)', fontSize: 9, fontWeight: 800, padding: '2px 8px', cursor: 'pointer' }}>Return</button>
        </div>
      ))}
      {pickerOpen && (
        <div style={{ marginTop: 10 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search drives by name, tag, or serial…" style={{ marginBottom: 6, fontSize: 12 }} autoFocus />
          <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {matches.slice(0, 30).map(d => (
              <div key={d.id} onClick={() => tag(d)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>{d.name}{d.asset_tag ? <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {d.asset_tag}</span> : ''}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)' }}>{d.serial_number || ''}</div>
                </div>
                {d.project_id
                  ? <span style={{ fontSize: 9, fontWeight: 800, color: '#e6c229', border: '1px solid #e6c229', borderRadius: 10, padding: '1px 7px', whiteSpace: 'nowrap' }}>on {d.project_code}</span>
                  : <span style={{ fontSize: 9, fontWeight: 800, color: '#5ABF80', border: '1px solid #5ABF80', borderRadius: 10, padding: '1px 7px', whiteSpace: 'nowrap' }}>{d.location || 'in office'}</span>}
              </div>
            ))}
            {matches.length === 0 && <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No drives match.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

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
                style={{ background: text.trim() ? 'var(--orange)' : 'var(--border)', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 800, cursor: text.trim() ? 'pointer' : 'default' }}>
                Post
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
