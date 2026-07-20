import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { AVO, AvoHeader } from './Avo.jsx';
import GanttChart from '../components/GanttChart.jsx';

export default function AvoGantt() {
  const [edits, setEdits] = useState(null);
  const [mode, setMode] = useState('project'); // 'project' | 'edit'
  const [projectCode, setProjectCode] = useState('');
  const [editId, setEditId] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => { api.avoEdits().then(rows => setEdits(rows.filter(e => !e.archived))).catch(e => alert(e.message)); }, []);
  useEffect(() => { setShareUrl(''); setCopied(false); }, [mode, projectCode, editId]);

  const codes = useMemo(() => {
    const s = new Set();
    for (const e of edits || []) if (e.project_code) s.add(e.project_code);
    return [...s].sort();
  }, [edits]);

  const shown = useMemo(() => {
    if (!edits) return [];
    if (mode === 'edit') return edits.filter(e => String(e.id) === String(editId));
    return projectCode ? edits.filter(e => e.project_code === projectCode) : [];
  }, [edits, mode, projectCode, editId]);

  const ref = mode === 'edit' ? editId : projectCode;

  async function share() {
    try {
      const { token } = await api.avoGanttShare(mode, ref);
      const url = `${window.location.origin}/gantt/${token}`;
      setShareUrl(url);
      try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* show url to copy manually */ }
    } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <AvoHeader />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '22px 18px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <div className="page-title">Gantt View</div>
            <div className="page-sub">Timeline view of edit windows — shareable with clients</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <div className="seg-toggle" style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {['project', 'edit'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                style={{ background: mode === m ? `${AVO}2e` : 'transparent', border: 'none', color: mode === m ? AVO : 'var(--muted)', fontSize: 11, fontWeight: 700, padding: '7px 14px', cursor: 'pointer' }}>
                {m === 'project' ? 'Project Gantt' : 'Individual Edit'}
              </button>
            ))}
          </div>
          {mode === 'project' ? (
            <select value={projectCode} onChange={e => setProjectCode(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
              <option value="">— Select project code —</option>
              {codes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <select value={editId} onChange={e => setEditId(e.target.value)} style={{ width: 'auto', minWidth: 240 }}>
              <option value="">— Select an edit —</option>
              {(edits || []).map(e => <option key={e.id} value={e.id}>{e.title}{e.project_code ? ` (${e.project_code})` : ''}</option>)}
            </select>
          )}
          {ref && (
            <button className="btn btn-sm" onClick={share}
              style={{ background: `${AVO}2e`, border: `1px solid ${AVO}`, color: AVO, fontWeight: 700 }}>
              {copied ? '✓ Link Copied' : 'Share Public Gantt'}
            </button>
          )}
        </div>

        {shareUrl && !copied && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, wordBreak: 'break-all' }}>
            Public link: <a href={shareUrl} style={{ color: AVO }}>{shareUrl}</a>
          </div>
        )}

        {!edits && <div className="empty">Loading…</div>}
        {edits && !ref && <div className="empty">Pick a project or an individual edit above to see its Gantt.</div>}
        {edits && ref && <GanttChart edits={shown} />}
      </div>
    </div>
  );
}
