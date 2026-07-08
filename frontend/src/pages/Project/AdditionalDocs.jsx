import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

function authBlob(path) {
  return fetch(path, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } })
    .then(r => r.ok ? r.blob() : null);
}

const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

export default function AdditionalDocs({ project }) {
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => api.listProjectDocs(project.id, 'extra').then(setDocs).catch(() => {});
  useEffect(() => { load(); }, [project.id]);

  async function pick(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const b64 = await new Promise((ok, bad) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(',')[1]);
        r.onerror = bad;
        r.readAsDataURL(file);
      });
      await api.uploadProjectDoc(project.id, { filename: file.name, mime: file.type, fileBase64: b64, kind: 'extra' });
      await load();
    } catch (err) { alert(err.message); }
    setBusy(false);
  }

  async function view(d) {
    const b = await authBlob(`/api/project-docs/${d.id}/file?inline=1`);
    if (!b) return;
    const url = URL.createObjectURL(b);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  return (
    <div>
      <div className="page-title" style={{ marginBottom:3 }}>Additional Docs</div>
      <div className="page-sub">{project.client} · {project.code}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, margin:'14px 0' }}>
        <div style={{ fontSize:11, color:'var(--muted)' }}>
          Reference documents, lighting grids, show flows, floor plans — anything the team needs on hand.
          Docs appear as an Additional Docs tab on the producer and crew call sheet views.
        </div>
        <label className="btn btn-primary" style={{ cursor:'pointer', flexShrink:0 }}>
          {busy ? 'Uploading…' : '+ Upload Doc'}
          <input type="file" onChange={pick} disabled={busy} style={{ display:'none' }} />
        </label>
      </div>
      {docs.length === 0 && <div className="empty">No additional documents yet.</div>}
      {docs.map(d => (
        <div key={d.id} onClick={() => view(d)}
          style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', marginBottom:10, cursor:'pointer' }}>
          <span style={{ fontSize:18 }}>📄</span>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ fontSize:13, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.filename}</div>
            <div style={{ fontSize:10, color:'var(--muted)' }}>{fmtSize(Number(d.size) || 0)}{d.uploaded_by ? ` · ${d.uploaded_by}` : ''}</div>
          </div>
          <button title="Delete" onClick={async e => {
            e.stopPropagation();
            if (!confirm(`Delete ${d.filename}?`)) return;
            try { await api.deleteProjectDoc(d.id); load(); } catch (er) { alert(er.message); }
          }} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:13, cursor:'pointer' }}>✕</button>
        </div>
      ))}
    </div>
  );
}
