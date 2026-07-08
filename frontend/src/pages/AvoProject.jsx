import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { AvoHeader, AVO, AVO_STATUSES } from './Avo.jsx';

const th = { padding:'7px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', whiteSpace:'nowrap' };
const td = { padding:'4px 6px', verticalAlign:'middle' };
const cellInput = { background:'transparent', border:'1px solid transparent', fontSize:12, width:'100%', padding:'5px 6px', borderRadius:5 };

const TYPE_COLORS = ['#5ABF80', '#d66a9b', '#e6c229', '#e8955a', '#f08080', '#4a9eff', '#a78bfa', '#40A0A0'];
const typeColor = t => { let h = 0; for (const c of t || '') h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return TYPE_COLORS[Math.abs(h) % TYPE_COLORS.length]; };
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '—';

// Inline-editable text cell: saves on blur
function Cell({ value, onSave, placeholder, style }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  return (
    <input value={v} placeholder={placeholder} onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== (value || '')) onSave(v); }}
      onFocus={e => e.target.style.borderColor = 'var(--border)'}
      style={{ ...cellInput, ...style }} />
  );
}

// ── Video Tracker: rows are the pipeline edits carrying this project code ──
function VideoTracker({ edits, setEdits }) {
  const nav = useNavigate();
  async function saveEdit(id, data) {
    try { const full = await api.updateAvoEdit(id, data); setEdits(es => es.map(x => x.id === id ? { ...x, ...full } : x)); }
    catch (e) { alert(e.message); }
  }
  const statusOf = k => AVO_STATUSES.find(([key]) => key === k);
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
      <div className="budget-tbl-wrap">
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:1050 }}>
          <thead>
            <tr>
              <th style={{ ...th, width:30 }}></th>
              <th style={th}>Type</th><th style={th}>Video Title</th><th style={th}>Style</th><th style={th}>Notes</th>
              <th style={th}>Due Date</th><th style={th}>Video Assets</th><th style={th}>Editor</th>
              <th style={th}>Review Link</th><th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {edits.length === 0 && (
              <tr><td colSpan={10} style={{ ...td, padding:'14px', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>
                No edits with this project code yet — add them from the pipeline and they'll appear here automatically.
              </td></tr>
            )}
            {edits.map(e => {
              const st = statusOf(e.status);
              const tc = typeColor(e.tracker_type);
              return (
                <tr key={e.id} className="vt-row" style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ ...td, textAlign:'center' }}>
                    <button className="vt-edit" title="Open this edit" onClick={() => nav(`/avo/${e.id}`)}
                      style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:5, padding:'2px 6px', fontSize:11, cursor:'pointer' }}>✎</button>
                  </td>
                  <td style={{ ...td, minWidth:110 }}>
                    <Cell value={e.tracker_type} placeholder="Type…" onSave={v => saveEdit(e.id, { trackerType: v })}
                      style={e.tracker_type ? { background:`${tc}22`, border:`1px solid ${tc}55`, color:tc, fontWeight:700, textAlign:'center', borderRadius:12 } : {}} />
                  </td>
                  <td style={{ ...td, minWidth:150 }}>
                    <span onClick={() => nav(`/avo/${e.id}`)} style={{ fontSize:12, fontWeight:700, cursor:'pointer', padding:'5px 6px', display:'inline-block' }}>{e.title}</span>
                  </td>
                  <td style={{ ...td, minWidth:140 }}><Cell value={e.style} placeholder="Style…" onSave={v => saveEdit(e.id, { style: v })} /></td>
                  <td style={{ ...td, minWidth:170 }}><Cell value={e.notes} placeholder="Notes…" onSave={v => saveEdit(e.id, { notes: v })} /></td>
                  <td style={{ ...td, whiteSpace:'nowrap', fontSize:12 }}>{fmtD(e.end_date)}</td>
                  <td style={{ ...td, minWidth:160 }}><Cell value={e.video_assets} placeholder="iPhone videos, music…" onSave={v => saveEdit(e.id, { videoAssets: v })} /></td>
                  <td style={{ ...td, fontSize:12, whiteSpace:'nowrap' }}>{e.lead_editor || '—'}</td>
                  <td style={{ ...td, maxWidth:160 }}>
                    {e.review_link
                      ? <a href={e.review_link} target="_blank" rel="noreferrer" style={{ color:'#4a9eff', fontSize:11 }}>▶ {e.review_link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 22)}</a>
                      : <span style={{ color:'var(--muted)', fontSize:11 }}>—</span>}
                  </td>
                  <td style={td}>
                    {st && <span style={{ background:`${st[2]}22`, border:`1px solid ${st[2]}`, color:st[2], borderRadius:12, padding:'2px 10px', fontSize:9, fontWeight:800, whiteSpace:'nowrap' }}>{st[1]}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding:'8px 14px', fontSize:10, color:'var(--muted)', borderTop:'1px solid var(--border)' }}>
        Feeds live from the editing pipeline. Title, due date, editor, review link, and status come from each edit; Type, Style, Notes, and Video Assets are editable here.
      </div>
    </div>
  );
}

// ── Generic editable grid (to-dos, music, lower thirds) ──
function Grid({ kind, columns, rows, setRows, pageId, doneKey, renderCell }) {
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
                  <td key={c} style={td}>
                    {renderCell?.(r, c, v => saveCell(r.id, c, v))
                      || <Cell value={r[c]} placeholder={placeholder} onSave={v => saveCell(r.id, c, v)} />}
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
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)' }}>
        <button onClick={addRow}
          style={{ background:`${AVO}22`, border:`1px solid ${AVO}`, color:AVO, borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer' }}>
          + Add Row
        </button>
      </div>
    </div>
  );
}

// ── Music options: rows grouped by video title, client-shareable table ──
function MusicShareModal({ groups, code, title, onClose }) {
  const tableRef = React.useRef(null);
  const [copied, setCopied] = useState(false);
  async function copy() {
    const html = '<meta charset="utf-8">' + tableRef.current.outerHTML;
    const text = groups.map(([video, rows]) =>
      `${video || 'Music'}\n${rows.map(r => '  - ' + r.url + (r.note ? ` (${r.note})` : '')).join('\n')}`).join('\n\n');
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
    } catch {
      const range = document.createRange();
      range.selectNode(tableRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('copy'); sel.removeAllRanges();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const tdw = { border:'1px solid #999', padding:'10px 14px', verticalAlign:'top', fontSize:14, color:'#111' };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'20px 22px', width:'100%', maxWidth:780, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>Music Options — {title || code}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={copy}
              style={{ background: copied ? AVO : `${AVO}26`, border:`1px solid ${AVO}`, color: copied ? '#0b0b0b' : AVO, borderRadius:20, padding:'5px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
              {copied ? '✓ Copied' : '📋 Copy for Email'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ background:'#fff', borderRadius:8, padding:14, overflowX:'auto' }}>
          <table ref={tableRef} style={{ borderCollapse:'collapse', width:'100%', background:'#ffffff', fontFamily:'Arial, sans-serif' }}>
            <thead>
              <tr>
                <td style={{ ...tdw, fontWeight:'bold' }}>Video</td>
                <td style={{ ...tdw, fontWeight:'bold' }}>Music Options</td>
              </tr>
            </thead>
            <tbody>
              {groups.map(([video, rows], i) => (
                <tr key={i}>
                  <td style={{ ...tdw, fontWeight:'bold' }}>{video || 'Music'}</td>
                  <td style={tdw}>
                    {rows.map((r, j) => (
                      <div key={j} style={{ marginBottom:4 }}>
                        <a href={r.url} style={{ color:'#1155cc' }}>{r.url}</a>{r.note ? ` (${r.note})` : ''}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MusicGrid({ rows, setRows, pageId, code, title }) {
  const [share, setShare] = useState(false);
  async function addRow() {
    try { const r = await api.addAvoGridRow(pageId, 'music'); setRows(rs => [...rs, r]); }
    catch (e) { alert(e.message); }
  }
  async function saveCell(rowId, col, val) {
    try { const r = await api.updateAvoGridRow('music', rowId, { [col]: val }); setRows(rs => rs.map(x => x.id === rowId ? r : x)); }
    catch (e) { alert(e.message); }
  }
  async function removeRow(rowId) {
    try { await api.deleteAvoGridRow('music', rowId); setRows(rs => rs.filter(x => x.id !== rowId)); }
    catch (e) { alert(e.message); }
  }
  // Rows sharing a video title collapse into one group (title cell spans them)
  const groups = [];
  {
    const seen = {};
    for (const r of rows) {
      const key = (r.category || '').trim().toLowerCase();
      if (key && seen[key] !== undefined) groups[seen[key]][1].push(r);
      else { if (key) seen[key] = groups.length; groups.push([r.category || '', [r]]); }
    }
  }
  const shareGroups = groups.filter(([, rs]) => rs.some(r => r.url));
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
      <div className="budget-tbl-wrap">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr><th style={th}>Video Title</th><th style={th}>Link</th><th style={th}>Note</th><th style={{ ...th, width:34 }}></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ ...td, padding:'12px 14px', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Nothing here yet.</td></tr>
            )}
            {groups.map(([video, grp]) => grp.map((r, j) => (
              <tr key={r.id} style={{ borderTop: j === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none' }}>
                {j === 0 && (
                  <td rowSpan={grp.length} style={{ ...td, minWidth:170, borderRight:'1px solid rgba(255,255,255,0.05)', verticalAlign:'top', paddingTop:8 }}>
                    <Cell value={r.category} placeholder="Video title…" onSave={v => saveCell(r.id, 'category', v)}
                      style={video ? { background:`${typeColor(video)}22`, border:`1px solid ${typeColor(video)}55`, color:typeColor(video), fontWeight:700, textAlign:'center', borderRadius:12 } : {}} />
                    {grp.length > 1 && <div style={{ fontSize:9, color:'var(--muted)', textAlign:'center', marginTop:3 }}>{grp.length} options</div>}
                  </td>
                )}
                <td style={{ ...td, minWidth:260 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Cell value={r.url} placeholder="https://…" onSave={v => saveCell(r.id, 'url', v)} style={{ color:'#4a9eff' }} />
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ color:'#4a9eff', fontSize:11, textDecoration:'none', flexShrink:0 }}>▶</a>}
                  </div>
                </td>
                <td style={{ ...td, minWidth:130 }}><Cell value={r.note} placeholder="instrumental version…" onSave={v => saveCell(r.id, 'note', v)} /></td>
                <td style={{ ...td, textAlign:'center' }}>
                  <button title="Delete row" onClick={() => removeRow(r.id)}
                    style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
        <button onClick={addRow}
          style={{ background:`${AVO}22`, border:`1px solid ${AVO}`, color:AVO, borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer' }}>
          + Add Row
        </button>
        <button onClick={() => setShare(true)} disabled={!shareGroups.length}
          style={{ background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:14, padding:'3px 14px', fontSize:10, fontWeight:800, cursor: shareGroups.length ? 'pointer' : 'default', opacity: shareGroups.length ? 1 : 0.4 }}>
          Share
        </button>
      </div>
      {share && <MusicShareModal groups={shareGroups} code={code} title={title} onClose={() => setShare(false)} />}
    </div>
  );
}

const TABS = [['tracker', 'Project Video Tracker'], ['todos', 'To-Do List'], ['music', 'Music Options'], ['lower-thirds', 'Lower Thirds']];

export default function AvoProject({ idOverride, embedded }) {
  const { id: idParam } = useParams();
  const id = idOverride || idParam;
  const nav = useNavigate();
  const [page, setPage] = useState(null);
  const [edits, setEdits] = useState([]);
  const [lowerThirds, setLowerThirds] = useState([]);
  const [todos, setTodos] = useState([]);
  const [music, setMusic] = useState([]);
  const [tab, setTab] = useState('tracker');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.avoProject(id)
      .then(p => { setPage(p); setEdits(p.edits || []); setLowerThirds(p.lowerThirds || []); setTodos(p.todos || []); setMusic(p.music || []); })
      .catch(e => setErr(e.message));
  }, [id]);

  async function removePage() {
    if (!confirm(`Delete the project page for ${page.code} (and its grids)?`)) return;
    try { await api.deleteAvoProject(id); nav('/avo'); } catch (e) { alert(e.message); }
  }

  const todoCell = (r, c, save) => c === 'category'
    ? <Cell value={r.category} placeholder="Category…" onSave={save}
        style={r.category ? { background:`${typeColor(r.category)}22`, border:`1px solid ${typeColor(r.category)}55`, color:typeColor(r.category), fontWeight:700, textAlign:'center', borderRadius:12 } : {}} />
    : c === 'text'
      ? <Cell value={r.text} placeholder="Status / who's on it…" onSave={save} style={{ fontStyle: r.text ? 'italic' : 'normal', color: r.text ? '#a78bfa' : undefined }} />
      : null;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {!embedded && <AvoHeader />}
      <div style={{ maxWidth:1250, margin:'0 auto', padding:'6px 16px 80px' }}>
        {!embedded && <div style={{ marginBottom:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/avo')}>‹ Pipeline</button>
        </div>}
        {err && <div className="empty">{err}</div>}
        {!err && !page && <div className="empty">Loading…</div>}
        {page && (
          <>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:14 }}>
              <div>
                <div className="page-title">{page.code}</div>
                <input value={page.title || ''} placeholder="Add a project title…"
                  onChange={e => setPage(p => ({ ...p, title: e.target.value }))}
                  onBlur={e => api.updateAvoProject(id, { title: e.target.value }).catch(er => alert(er.message))}
                  style={{ ...cellInput, marginTop:4, maxWidth:340, color:'var(--muted)' }} />
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e05252)' }} onClick={removePage}>Delete Page</button>
            </div>

            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
              {TABS.map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  style={{
                    background: tab === k ? `${AVO}2e` : 'transparent', border:`1px solid ${tab === k ? AVO : 'var(--border)'}`,
                    color: tab === k ? AVO : 'var(--muted)', borderRadius:16, padding:'5px 14px', fontSize:11, fontWeight:800, cursor:'pointer',
                  }}>
                  {label}{k === 'tracker' && edits.length ? ` (${edits.length})` : ''}
                </button>
              ))}
            </div>

            {tab === 'tracker' && <VideoTracker edits={edits} setEdits={setEdits} />}
            {tab === 'todos' && (
              <Grid kind="todos" pageId={id} doneKey="done" rows={todos} setRows={setTodos} renderCell={todoCell}
                columns={[['category', 'Category', 'Takeaways…'], ['video', 'Video', 'Which video'], ['needs', 'Needs', 'Script, music, shot list…'], ['text', 'To Do', 'Status / who’s on it…']]} />
            )}
            {tab === 'music' && (
              <MusicGrid pageId={id} rows={music} setRows={setMusic} code={page.code} title={page.title} />
            )}
            {tab === 'lower-thirds' && (
              <Grid kind="lower-thirds" pageId={id} rows={lowerThirds} setRows={setLowerThirds}
                columns={[['name', 'Name', 'Full name'], ['title', 'Title', 'On-screen title / role'], ['notes', 'Notes', '']]} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
