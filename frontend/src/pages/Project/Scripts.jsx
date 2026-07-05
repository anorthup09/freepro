import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function ScriptTile({ script, projectId, onUpdate, onDelete }) {
  const [name, setName] = useState(script.name);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { setName(script.name); }, [script.name]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === script.name) { setName(script.name); return; }
    try { onUpdate(await api.updateScript(projectId, script.id, { name: trimmed })); }
    catch (e) { alert(e.message); setName(script.name); }
  }

  // Each upload replaces the previous file for this script
  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('File is too large — 20 MB max.'); return; }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      const dataBase64 = btoa(binary);
      onUpdate(await api.updateScript(projectId, script.id, { fileName: file.name, mime: file.type || 'application/octet-stream', dataBase64 }));
    } catch (err) { alert(err.message); }
    setUploading(false);
  }

  async function viewFile() {
    try {
      const blob = await api.fetchScriptBlob(projectId, script.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', marginBottom:10, flexWrap:'wrap' }}>
      <span style={{ fontSize:18, flexShrink:0 }}>📄</span>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={saveName}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
        placeholder="Script name…"
        style={{ flex:'1 1 140px', minWidth:0, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:14, fontWeight:600, fontFamily:'inherit', padding:0 }}
      />
      <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto', flexShrink:0 }}>
        {script.has_file && script.file_name && (
          <span style={{ fontSize:11, color:'var(--muted)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{script.file_name}</span>
        )}
        {script.has_file && (
          <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={viewFile}>View</button>
        )}
        <button className="btn btn-primary btn-sm" style={{ fontSize:11, whiteSpace:'nowrap' }} disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? 'Uploading…' : script.has_file ? 'Replace' : 'Upload'}
        </button>
        <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:12 }} onClick={() => { if (confirm(`Delete "${script.name}"?`)) onDelete(script.id); }}>✕</button>
      </div>
      <input ref={fileRef} type="file" accept={ACCEPT} style={{ display:'none' }} onChange={handleFile} />
    </div>
  );
}

export default function Scripts({ project }) {
  const [scripts, setScripts] = useState([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.getScripts(project.id).then(setScripts).catch(() => {});
  }, [project.id]);

  const sorted = [...scripts].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  async function addScript() {
    setAdding(true);
    try {
      const n = scripts.length + 1;
      const s = await api.createScript(project.id, { name: `Script ${n}` });
      setScripts(prev => [...prev, s]);
    } catch (e) { alert(e.message); }
    setAdding(false);
  }

  function handleUpdate(updated) {
    setScripts(prev => prev.map(s => s.id === updated.id ? updated : s));
  }

  async function handleDelete(sid) {
    try {
      await api.deleteScript(project.id, sid);
      setScripts(prev => prev.filter(s => s.id !== sid));
    } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16, gap:10 }}>
        <div>
          <div className="page-title" style={{ marginBottom:0 }}>Scripts</div>
          <div className="page-sub">{project.client} · {project.code}</div>
        </div>
        <button className="btn btn-primary btn-sm" disabled={adding} onClick={addScript}>+ Add Script</button>
      </div>

      {sorted.length === 0 && <div className="empty">No scripts yet — add one, name it, and upload a PDF or Word doc.</div>}

      {sorted.map(s => (
        <ScriptTile key={s.id} script={s} projectId={project.id} onUpdate={handleUpdate} onDelete={handleDelete} />
      ))}

      {sorted.length > 0 && (
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>
          Scripts appear on the producer, crew, and client views in alphabetical order. Uploading again replaces the previous file.
        </div>
      )}
    </div>
  );
}
