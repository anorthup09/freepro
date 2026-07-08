import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
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

// ── One-off task row: checkbox / task / tag / due date; click ▸ for notes ──
function TaskRow({ t, members, onSave, onDelete }) {
  const [open, setOpen] = useState(false);
  const overdue = t.due_date && !t.done && String(t.due_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
  return (
    <div style={{ borderBottom:'1px solid rgba(255,255,255,0.05)', opacity: t.done ? 0.5 : 1 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 2px' }}>
        <input type="checkbox" checked={t.done || false} style={{ width:'auto', accentColor:'#5ABF80' }}
          onChange={e => onSave({ done: e.target.checked })} />
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
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 2px 8px 24px' }}>
        <select value={t.assignee_id || ''} onChange={e => onSave({ assigneeId: e.target.value })}
          style={{ width:'auto', fontSize:10, padding:'3px 6px' }}>
          <option value="">— Tag —</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
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

export default function ProjectOverview({ pid }) {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.projectOverview(pid).then(setData).catch(e => setErr(e.message));
    api.dashboardTeam().then(ms => setMembers(ms.map(m => ({ id: m.id, name: m.name })))).catch(() => {});
  }, [pid]);

  if (err) return <div className="empty">{err}</div>;
  if (!data) return <div className="empty">Loading…</div>;
  const { project, budgetStatus, shoots, edits, callNotes, tasks } = data;
  const setTasks = fn => setData(d => ({ ...d, tasks: typeof fn === 'function' ? fn(d.tasks) : fn }));
  const setNotes = fn => setData(d => ({ ...d, callNotes: typeof fn === 'function' ? fn(d.callNotes) : fn }));

  async function saveTask(id, patch) {
    try { const t = await api.updateProjectTask(id, patch); setTasks(ts => ts.map(x => x.id === id ? t : x)); }
    catch (e) { alert(e.message); }
  }

  const avoStatus = k => AVO_STATUSES.find(([key]) => key === k);

  return (
    <div className="pv-overview" style={{ maxWidth:1250, margin:'0 auto', padding:'8px 16px 60px', display:'grid', gridTemplateColumns:'1fr 320px', gap:16, alignItems:'start' }}>
      {/* ── Left: cover page ── */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ ...card, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div style={{ fontSize:11, color:'var(--muted)', fontWeight:800, letterSpacing:'0.04em' }}>{project.code}</div>
            <div style={{ fontSize:18, fontWeight:800 }}>{project.title}</div>
            <div style={{ fontSize:12, color:'var(--muted)' }}>{project.client}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Budget Status</div>
            <StatusPill status={budgetStatus || 'No budget'} />
          </div>
        </div>

        <div style={card}>
          <div style={secHdr}>Shoots</div>
          {shoots.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No production shoots yet — they appear when the budget goes Live.</div>}
          {shoots.map(s => (
            <div key={s.id} onClick={() => nav(`/projects/${s.id}`)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 4px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
              <span style={{ fontSize:11, fontWeight:800, minWidth:120 }}>{s.code}</span>
              <span style={{ fontSize:11, color:'var(--muted)', flex:1 }}>{[s.city, s.state].filter(Boolean).join(', ')}</span>
              <span style={{ fontSize:10, color:'var(--muted)', whiteSpace:'nowrap' }}>{fmtD(s.start_date)}{s.end_date && s.end_date !== s.start_date ? ` – ${fmtD(s.end_date)}` : ''}</span>
              <StatusPill status={s.status} color={s.status === 'ARCHIVED' ? '#8a8f98' : '#E8500A'} />
            </div>
          ))}
        </div>

        <div style={card}>
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

        <div style={card}>
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

      {/* ── Right: elongated to-do column ── */}
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
  );
}
