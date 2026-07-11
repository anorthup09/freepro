import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { displayName } from '../utils/displayName.js';
import { STATUS_COLORS } from './Hub.jsx';
import { AVO_STATUSES } from './Avo.jsx';

const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' };
const secHdr = { fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 };
const cellInput = { background:'transparent', border:'1px solid transparent', fontSize:12, width:'100%', padding:'5px 6px', borderRadius:5 };
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '';

function StatusPill({ status, color }) {
  const c = color || STATUS_COLORS[status] || '#8a8f98';
  return <span style={{ background:`${c}22`, border:`1px solid ${c}`, color:c, borderRadius:12, padding:'2px 10px', fontSize:9, fontWeight:800, whiteSpace:'nowrap' }}>{status || '—'}</span>;
}

function BlurInput({ value, onSave, placeholder, type = 'text', style }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  return (
    <input type={type} value={v} placeholder={placeholder} onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== (value || '')) onSave(v); }}
      onFocus={e => e.target.style.borderColor = 'var(--border)'}
      style={{ ...cellInput, ...style }} />
  );
}

// ── Project documents (Creative Brief / VPP): preview tiles + pop-out viewer ──
const DOC_KINDS = [['brief', 'Creative Brief', '#e8955a'], ['vpp', 'VPP', '#4a9eff']];

function authBlob(path) {
  return fetch(path, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } })
    .then(r => r.ok ? r.blob() : null);
}

// Small inline preview of a stored file (image or PDF first page)
function DocThumb({ doc, height = 110 }) {
  const [url, setUrl] = useState(null);
  const isImg = (doc.mime || '').startsWith('image/');
  const isPdf = (doc.mime || '').includes('pdf');
  useEffect(() => {
    let obj;
    if (!isImg && !isPdf) return;
    authBlob(`/api/project-docs/${doc.id}/file?inline=1`).then(b => { if (b) { obj = URL.createObjectURL(b); setUrl(obj); } });
    return () => obj && URL.revokeObjectURL(obj);
  }, [doc.id]);
  if (!isImg && !isPdf) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, background:'rgba(255,255,255,0.04)', borderRadius:6 }}>📄</div>;
  if (!url) return <div style={{ height, background:'rgba(255,255,255,0.04)', borderRadius:6 }} />;
  if (isImg) return <img src={url} alt={doc.filename} style={{ width:'100%', height, objectFit:'cover', borderRadius:6, background:'#fff' }} />;
  return (
    <div style={{ height, borderRadius:6, overflow:'hidden', position:'relative', background:'#fff' }}>
      <iframe title={doc.filename} src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} tabIndex={-1}
        style={{ width:'200%', height:'200%', border:'none', transform:'scale(0.5)', transformOrigin:'0 0', pointerEvents:'none' }} />
      <div style={{ position:'absolute', inset:0 }} />
    </div>
  );
}

function DocViewer({ doc, onClose }) {
  const [url, setUrl] = useState(null);
  const isImg = (doc.mime || '').startsWith('image/');
  const isPdf = (doc.mime || '').includes('pdf');
  useEffect(() => {
    let obj;
    authBlob(`/api/project-docs/${doc.id}/file?inline=1`).then(b => { if (b) { obj = URL.createObjectURL(b); setUrl(obj); } });
    return () => obj && URL.revokeObjectURL(obj);
  }, [doc.id]);
  async function download() {
    const b = await authBlob(`/api/project-docs/${doc.id}/file`);
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:130, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, width:'100%', maxWidth:860, height:'88vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'12px 16px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
          <div style={{ fontSize:13, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{doc.filename}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={download}>⬇ Download</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ flex:1, background:'#333', display:'flex', alignItems:'center', justifyContent:'center', overflow:'auto' }}>
          {!isImg && !isPdf && <div style={{ color:'#aaa', fontSize:12 }}>No inline preview for this file type — use Download.</div>}
          {(isImg || isPdf) && !url && <div style={{ color:'#aaa', fontSize:12 }}>Loading…</div>}
          {url && isPdf && <iframe title={doc.filename} src={url} style={{ width:'100%', height:'100%', border:'none', background:'#fff' }} />}
          {url && isImg && <img src={url} alt={doc.filename} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />}
        </div>
      </div>
    </div>
  );
}

function DocsTile({ pid, docs, setDocs }) {
  const [busy, setBusy] = useState(null);   // kind being uploaded
  const [view, setView] = useState(null);
  async function pick(kind, e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(kind);
    try {
      const b64 = await new Promise((ok, bad) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(',')[1]);
        r.onerror = bad;
        r.readAsDataURL(file);
      });
      const d = await api.uploadProjectDoc(pid, { filename: file.name, mime: file.type, fileBase64: b64, kind });
      setDocs(ds => [d, ...ds]);
    } catch (err) { alert(err.message); }
    setBusy(null);
  }
  return (
    <div className="pv-docs" style={{ ...card, marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:10 }}>
        <div style={{ ...secHdr, marginBottom:0 }}>Creative Docs</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {DOC_KINDS.map(([kind, label]) => (
            <label key={kind} style={{ background:'var(--bg)', border:'1px solid rgba(255,255,255,0.55)', color:'#e8e8e8', borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer' }}>
              {busy === kind ? 'Uploading…' : `+ ${label}`}
              <input type="file" onChange={e => pick(kind, e)} disabled={!!busy} style={{ display:'none' }} />
            </label>
          ))}
        </div>
      </div>
      {docs.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No documents yet — upload the creative brief and VPP.</div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:10 }}>
        {docs.map(d => {
          const [, label, color] = DOC_KINDS.find(([k]) => k === d.kind) || DOC_KINDS[0];
          return (
            <div key={d.id} onClick={() => setView(d)} title={`${d.filename} — click to view`}
              style={{ cursor:'pointer', border:'1px solid var(--border)', borderRadius:8, padding:6, position:'relative' }}>
              <DocThumb doc={d} />
              <div style={{ fontSize:9, fontWeight:800, color, marginTop:5 }}>{label}</div>
              <div style={{ fontSize:9, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.filename}</div>
              <button title="Delete" onClick={async e => {
                e.stopPropagation();
                if (!confirm(`Delete ${d.filename}?`)) return;
                try { await api.deleteProjectDoc(d.id); setDocs(ds => ds.filter(x => x.id !== d.id)); }
                catch (er) { alert(er.message); }
              }} style={{ position:'absolute', top:4, right:4, background:'rgba(0,0,0,0.55)', border:'none', color:'#ccc', borderRadius:5, fontSize:10, cursor:'pointer', padding:'1px 5px' }}>✕</button>
            </div>
          );
        })}
      </div>
      {view && <DocViewer doc={view} onClose={() => setView(null)} />}
    </div>
  );
}

// Initials chip for the task assignee (same look as budget tags)
const CHIP_COLORS = ['#5ABF80', '#d66a9b', '#e6c229', '#e8955a', '#4a9eff', '#a78bfa', '#40A0A0', '#f08080'];
const chipColor = n => { let h = 0; for (const c of n || '') h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length]; };
const initialsOf = n => {
  const parts = String(n || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

function AssigneeChip({ assigneeId, assigneeName, members, onPick }) {
  const [open, setOpen] = useState(false);
  const box = React.useRef(null);
  useEffect(() => {
    const close = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const c = chipColor(assigneeName);
  return (
    <div ref={box} style={{ position:'relative', flexShrink:0 }}>
      {assigneeId ? (
        <button title={`${assigneeName} — click to change`} onClick={() => setOpen(o => !o)}
          style={{ width:24, height:24, borderRadius:'50%', background:`${c}33`, border:`1.5px solid ${c}`, color:c, fontSize:9, fontWeight:800, cursor:'pointer', padding:0 }}>
          {initialsOf(assigneeName)}
        </button>
      ) : (
        <button title="Tag a crew member" onClick={() => setOpen(o => !o)}
          style={{ width:24, height:24, borderRadius:'50%', background:'none', border:'1.5px dashed var(--border)', color:'var(--muted)', fontSize:12, cursor:'pointer', padding:0 }}>
          +
        </button>
      )}
      {open && (
        <div style={{ position:'absolute', top:'110%', left:0, zIndex:40, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, minWidth:170, maxHeight:200, overflowY:'auto', boxShadow:'0 8px 20px rgba(0,0,0,0.5)' }}>
          {assigneeId && (
            <div onClick={() => { onPick(''); setOpen(false); }}
              style={{ padding:'7px 12px', fontSize:11, color:'var(--muted)', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>— Unassign —</div>
          )}
          {members.map(m => (
            <div key={m.id} onClick={() => { onPick(m.id); setOpen(false); }}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', fontSize:11, fontWeight: m.id === assigneeId ? 800 : 500, cursor:'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <span style={{ width:18, height:18, borderRadius:'50%', background:`${chipColor(m.name)}33`, border:`1px solid ${chipColor(m.name)}`, color:chipColor(m.name), fontSize:7, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {initialsOf(m.name)}
              </span>
              {m.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── One-off task row: checkbox / task / tag / due date; click ▸ for notes ──
function TaskRow({ t, members, onSave, onDelete }) {
  const [open, setOpen] = useState(false);
  const overdue = t.due_date && !t.done && String(t.due_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
  return (
    <div style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', opacity: t.done ? 0.5 : 1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 2px' }}>
        <input type="checkbox" checked={t.done || false} style={{ width:'auto', accentColor:'#5ABF80' }}
          onChange={e => onSave({ done: e.target.checked })} />
        <AssigneeChip assigneeId={t.assignee_id} assigneeName={t.assignee_name} members={members}
          onPick={id => onSave({ assigneeId: id })} />
        <div style={{ flex:1, minWidth:0 }}>
          <BlurInput value={t.text} placeholder="Task…" onSave={v => onSave({ text: v })}
            style={{ fontWeight:600, textDecoration: t.done ? 'line-through' : 'none' }} />
        </div>
        <button title={open ? 'Hide notes' : 'Add description / notes'} onClick={() => setOpen(o => !o)}
          style={{ background:'none', border:'none', color: t.notes ? '#4a9eff' : 'var(--muted)', fontSize:11, cursor:'pointer', padding:'0 2px' }}>
          {open ? '▾' : '▸'}
        </button>
        <button title="Delete task" onClick={onDelete}
          style={{ background:'none', border:'none', color:'var(--muted)', fontSize:11, cursor:'pointer', padding:'0 2px' }}>✕</button>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 2px 8px 56px' }}>
        <input type="date" value={t.due_date ? String(t.due_date).slice(0, 10) : ''}
          onChange={e => onSave({ dueDate: e.target.value })}
          style={{ width:'auto', fontSize:10, padding:'3px 6px', color: overdue ? '#e05252' : undefined }} />
      </div>
      {open && (
        <div style={{ padding:'0 2px 10px 24px' }}>
          <textarea defaultValue={t.notes || ''} placeholder="Description / notes…"
            onBlur={e => { if (e.target.value !== (t.notes || '')) onSave({ notes: e.target.value }); }}
            style={{ width:'100%', minHeight:54, fontSize:11 }} />
        </div>
      )}
    </div>
  );
}

export default function ProjectOverview({ pid, onOpenFinance }) {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.projectOverview(pid).then(setData).catch(e => setErr(e.message));
    // Tag from the Unbridled crew only (company = Unbridled Media); contractors
    // are excluded. project_tasks.assignee_id references crew_members.
    api.getCrew().then(rs => setMembers(rs
      .filter(m => (m.company || '').toLowerCase().includes('unbridled'))
      .map(m => ({ id: m.id, name: displayName(m) }))
      .sort((a, b) => a.name.localeCompare(b.name)))).catch(() => {});
  }, [pid]);

  if (err) return <div className="empty">{err}</div>;
  if (!data) return <div className="empty">Loading…</div>;
  const { project, budgetStatus, budgetAmount, budgetFee, shoots, edits, callNotes, tasks, docs = [] } = data;
  const fmt$ = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const setDocs = fn => setData(d => ({ ...d, docs: typeof fn === 'function' ? fn(d.docs || []) : fn }));
  const setTasks = fn => setData(d => ({ ...d, tasks: typeof fn === 'function' ? fn(d.tasks) : fn }));
  const setNotes = fn => setData(d => ({ ...d, callNotes: typeof fn === 'function' ? fn(d.callNotes) : fn }));

  async function saveTask(id, patch) {
    try { const t = await api.updateProjectTask(id, patch); setTasks(ts => ts.map(x => x.id === id ? t : x)); }
    catch (e) { alert(e.message); }
  }

  const avoStatus = k => AVO_STATUSES.find(([key]) => key === k);

  return (
    <div className="pv-overview" style={{ maxWidth:1250, margin:'0 auto', padding:'8px 16px 60px', display:'grid', gridTemplateColumns:'1fr 320px', gridTemplateRows:'auto 1fr', gap:16, alignItems:'start' }}>
      {/* ── Budget tile: status left, running total right ── */}
      <div className="pv-head" title="Open the finance page"
        onClick={() => onOpenFinance ? onOpenFinance() : nav(`/finance/${pid}`)}
        style={{ gridColumn:1, ...card, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Budget Status</span>
          <StatusPill status={budgetStatus || 'No budget'} />
        </div>
        {budgetAmount != null && (
          <span className="pv-amt" style={{ fontSize:13, fontWeight:800, whiteSpace:'nowrap' }}>
            <span style={{ color:'#5ABF80' }}>Budget {fmt$(budgetAmount)}</span>
            <span style={{ color:'var(--muted)', fontWeight:400 }}> | </span>
            <span style={{ color:'#e6c229' }}>Est Fee {fmt$(budgetFee || 0)}</span>
          </span>
        )}
      </div>

      {/* ── Left: cover page ── */}
      <div className="pv-left" style={{ gridColumn:1, display:'flex', flexDirection:'column', gap:16 }}>
        <div className="pv-shoots" style={card}>
          <div style={secHdr}>Shoots</div>
          {shoots.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No production shoots yet — they appear when the budget goes Live.</div>}
          {shoots.map(s => (
            <div key={s.id} onClick={() => nav(`/projects/${s.id}`)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 4px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
              <span style={{ fontSize:11, fontWeight:800, minWidth:120 }}>{s.shoot_code || s.code}</span>
              <span style={{ fontSize:11, color:'var(--text)', flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.title}</span>
              <span style={{ fontSize:10, color:'var(--muted)', whiteSpace:'nowrap' }}>{fmtD(s.start_date)}{s.end_date && s.end_date !== s.start_date ? ` – ${fmtD(s.end_date)}` : ''}</span>
              <StatusPill status={s.status} color={s.status === 'ARCHIVED' ? '#8a8f98' : '#E8500A'} />
            </div>
          ))}
        </div>

        <div className="pv-post" style={card}>
          <div style={secHdr}>Post-Production at a Glance</div>
          {edits.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No edits on this project code yet.</div>}
          {edits.map(e => {
            const st = avoStatus(e.status);
            return (
              <div key={e.id} onClick={() => nav(`/avo/${e.id}`)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 4px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                <span style={{ fontSize:11, fontWeight:700, flex:1 }}>{e.title} <span style={{ color:'var(--muted)', fontWeight:400 }}>· v{Number(e.version) || 1}</span></span>
                <span style={{ fontSize:10, color:'var(--muted)', whiteSpace:'nowrap' }}>{e.lead_editor || ''}</span>
                {e.end_date && <span style={{ fontSize:10, color:'var(--muted)', whiteSpace:'nowrap' }}>due {fmtD(e.end_date)}</span>}
                {st && <StatusPill status={st[1]} color={st[2]} />}
              </div>
            );
          })}
        </div>

        <div className="pv-notes" style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
            <div style={{ ...secHdr, marginBottom:0 }}>Client Call Notes</div>
            <button onClick={async () => {
              try { const n = await api.addCallNote(pid, {}); setNotes(ns => [n, ...ns]); }
              catch (e) { alert(e.message); }
            }} style={{ background:'var(--bg)', border:'1px solid rgba(255,255,255,0.55)', color:'#e8e8e8', borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer' }}>
              + Add Note
            </button>
          </div>
          {callNotes.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No call notes yet — capture takeaways from each client call here.</div>}
          {callNotes.map(n => (
            <div key={n.id} style={{ display:'flex', gap:8, alignItems:'flex-start', padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
              <input type="date" value={n.call_date ? String(n.call_date).slice(0, 10) : ''}
                onChange={async e => {
                  try { const u = await api.updateCallNote(n.id, { callDate: e.target.value }); setNotes(ns => ns.map(x => x.id === n.id ? u : x)); }
                  catch (er) { alert(er.message); }
                }}
                style={{ width:'auto', fontSize:10, padding:'3px 6px', flexShrink:0 }} />
              <textarea defaultValue={n.note || ''} placeholder="Call takeaways…"
                onBlur={async e => {
                  if (e.target.value === (n.note || '')) return;
                  try { const u = await api.updateCallNote(n.id, { note: e.target.value }); setNotes(ns => ns.map(x => x.id === n.id ? u : x)); }
                  catch (er) { alert(er.message); }
                }}
                style={{ flex:1, minHeight:40, fontSize:12 }} />
              <button title="Delete note" onClick={async () => {
                if (!confirm('Delete this call note?')) return;
                try { await api.deleteCallNote(n.id); setNotes(ns => ns.filter(x => x.id !== n.id)); }
                catch (e) { alert(e.message); }
              }} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer', paddingTop:6 }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: docs tile above the elongated to-do column ── */}
      <div className="pv-right" style={{ gridColumn:2, gridRow:'1 / span 2' }}>
      <DocsTile pid={pid} docs={docs} setDocs={setDocs} />
      <div className="pv-todo" style={{ ...card, minHeight:420, display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ ...secHdr, marginBottom:0 }}>To-Do</div>
          <button onClick={async () => {
            try { const t = await api.addProjectTask(pid, {}); setTasks(ts => [...ts, t]); }
            catch (e) { alert(e.message); }
          }} style={{ background:'var(--bg)', border:'1px solid rgba(255,255,255,0.55)', color:'#e8e8e8', borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer' }}>
            + Add Task
          </button>
        </div>
        <div style={{ fontSize:10, color:'var(--muted)', marginBottom:8 }}>One-off tasks for this project. Tagged tasks show up on that person's hub dashboard.</div>
        {tasks.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Nothing yet.</div>}
        {tasks.map(t => (
          <TaskRow key={t.id} t={t} members={members}
            onSave={patch => saveTask(t.id, patch)}
            onDelete={async () => {
              if (!confirm('Delete this task?')) return;
              try { await api.deleteProjectTask(t.id); setTasks(ts => ts.filter(x => x.id !== t.id)); }
              catch (e) { alert(e.message); }
            }} />
        ))}
      </div>
      </div>
    </div>
  );
}
