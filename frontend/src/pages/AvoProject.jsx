import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { AvoHeader, AVO } from './Avo.jsx';

const th = { padding:'7px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left' };
const td = { padding:'4px 6px', verticalAlign:'middle' };
const cellInput = { background:'transparent', border:'1px solid transparent', fontSize:12, width:'100%', padding:'5px 6px', borderRadius:5 };

// Inline-editable text cell: saves on blur
function Cell({ value, onSave, placeholder }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  return (
    <input value={v} placeholder={placeholder} onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== (value || '')) onSave(v); }}
      onFocus={e => e.target.style.borderColor = 'var(--border)'}
      style={cellInput} />
  );
}

function Grid({ title, kind, columns, rows, setRows, pageId, doneKey }) {
  async function addRow() {
    try { const r = await api.addAvoGridRow(pageId, kind); setRows(rs => [...rs, r]); }
    catch (e) { alert(e.message); }
  }
  async function saveCell(rowId, col, val) {
    try { const r = await api.updateAvoGridRow(kind, rowId, { [col]: val }); setRows(rs => rs.map(x => x.id === rowId ? r : x)); }
    catch (e) { alert(e.message); }
  }
  async function removeRow(rowId) {
    try { await api.deleteAvoGridRow(kind, rowId); setRows(rs => rs.filter(x => x.id !== rowId)); }
    catch (e) { alert(e.message); }
  }
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ fontSize:13, fontWeight:800 }}>{title}</div>
        <button onClick={addRow}
          style={{ background:`${AVO}22`, border:`1px solid ${AVO}`, color:AVO, borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer' }}>
          + Add Row
        </button>
      </div>
      <div className="budget-tbl-wrap">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {doneKey && <th style={{ ...th, width:34 }}></th>}
              {columns.map(([c, label]) => <th key={c} style={th}>{label}</th>)}
              <th style={{ ...th, width:34 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 2} style={{ ...td, padding:'12px 14px', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Nothing here yet.</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)', opacity: doneKey && r[doneKey] ? 0.5 : 1 }}>
                {doneKey && (
                  <td style={{ ...td, textAlign:'center' }}>
                    <input type="checkbox" checked={r[doneKey] || false} style={{ width:'auto', accentColor:AVO }}
                      onChange={e => saveCell(r.id, doneKey, e.target.checked)} />
                  </td>
                )}
                {columns.map(([c, , placeholder]) => (
                  <td key={c} style={{ ...td, textDecoration: doneKey && r[doneKey] && c === 'text' ? 'line-through' : 'none' }}>
                    <Cell value={r[c]} placeholder={placeholder} onSave={v => saveCell(r.id, c, v)} />
                  </td>
                ))}
                <td style={{ ...td, textAlign:'center' }}>
                  <button title="Delete row" onClick={() => removeRow(r.id)}
                    style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AvoProject() {
  const { id } = useParams();
  const nav = useNavigate();
  const [page, setPage] = useState(null);
  const [lowerThirds, setLowerThirds] = useState([]);
  const [todos, setTodos] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.avoProject(id)
      .then(p => { setPage(p); setLowerThirds(p.lowerThirds || []); setTodos(p.todos || []); })
      .catch(e => setErr(e.message));
  }, [id]);

  async function removePage() {
    if (!confirm(`Delete the project page for ${page.code} (and its grids)?`)) return;
    try { await api.deleteAvoProject(id); nav('/avo'); } catch (e) { alert(e.message); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <AvoHeader />
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'6px 16px 80px' }}>
        <div style={{ marginBottom:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/avo')}>‹ Pipeline</button>
        </div>
        {err && <div className="empty">{err}</div>}
        {!err && !page && <div className="empty">Loading…</div>}
        {page && (
          <>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:20 }}>
              <div>
                <div className="page-title">{page.code}</div>
                <input value={page.title || ''} placeholder="Add a project title…"
                  onChange={e => setPage(p => ({ ...p, title: e.target.value }))}
                  onBlur={e => api.updateAvoProject(id, { title: e.target.value }).catch(er => alert(er.message))}
                  style={{ ...cellInput, marginTop:4, maxWidth:340, color:'var(--muted)' }} />
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e05252)' }} onClick={removePage}>Delete Page</button>
            </div>
            <div style={{ display:'grid', gap:22 }}>
              <Grid title="Lower Thirds" kind="lower-thirds" pageId={id}
                columns={[['name', 'Name', 'Full name'], ['title', 'Title', 'On-screen title / role'], ['notes', 'Notes', '']]}
                rows={lowerThirds} setRows={setLowerThirds} />
              <Grid title="To-Do List" kind="todos" pageId={id} doneKey="done"
                columns={[['text', 'Task', 'What needs doing…']]}
                rows={todos} setRows={setTodos} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
