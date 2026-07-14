import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

// Drives tile — tag hard drives from the asset database onto this shoot
export default function DrivesTile({ pid, title = 'Drives', style }) {
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
    <div style={{ flex: '1 1 340px', minWidth: 280, background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: '3px solid #4a9eff', borderRadius: 12, padding: '18px 20px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{title} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>· {mine.length} on this shoot</span></div>
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
