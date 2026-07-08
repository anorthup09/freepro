import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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

const pillBtn = () => ({ background:'var(--bg)', border:'1px solid rgba(255,255,255,0.55)', color:'#e8e8e8', borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer' });

/*
 * SmartTable — shared grid with custom text columns and cell merging.
 * colDefs: [{ key, label, render(row) | null, minWidth }] — base columns.
 * config: { cols:[{key,label}], merges:{ "<rowId>|<colKey>": {rs,cs} } } (per tab, stored on the page).
 * saveExtra(rowId, key, value) persists custom-cell values (row.extra).
 */
function SmartTable({ rows, colDefs, config, onConfig, saveExtra, leading, trailing, emptyText, footerRight, minWidth, onReorder }) {
  const [mergeMode, setMergeMode] = useState(false);
  const [selA, setSelA] = useState(null);   // {ri, ci}
  const [selB, setSelB] = useState(null);
  const [dragRow, setDragRow] = useState(null);
  const [dragCol, setDragCol] = useState(null);
  const [overRow, setOverRow] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({});

  const customCols = config?.cols || [];
  const merges = config?.merges || {};
  const baseCols = [
    ...colDefs.map(c => ({ ...c, custom: false })),
    ...customCols.map(c => ({ key: c.key, label: c.label, custom: true })),
  ];
  // Saved column order (drag-to-reorder); unknown keys keep their natural spot
  const order = config?.order || [];
  const allCols = [...baseCols].sort((a, b) => {
    const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
    if (ia === -1 && ib === -1) return baseCols.indexOf(a) - baseCols.indexOf(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  function dropCol(toKey) {
    if (!dragCol || dragCol === toKey) return;
    const keys = allCols.map(c => c.key).filter(k => k !== dragCol);
    keys.splice(keys.indexOf(toKey), 0, dragCol);
    onConfig({ cols: customCols, merges, order: keys });
  }
  function dropRow(toIdx) {
    if (dragRow == null || dragRow === toIdx || !onReorder) return;
    const next = [...rows];
    const [moved] = next.splice(dragRow, 1);
    next.splice(toIdx, 0, moved);
    onReorder(next);
  }

  // Column filters — substring match on the cell's raw value
  const valOf = (r, c) => c.custom ? (r.extra?.[c.key] ?? '') : (r[c.key] ?? '');
  const filterActive = showFilter && allCols.some(c => (filters[c.key] || '').trim());
  const shownRows = filterActive
    ? rows.filter(r => allCols.every(c => {
        const f = (filters[c.key] || '').trim().toLowerCase();
        return !f || String(valOf(r, c) || '').toLowerCase().includes(f);
      }))
    : rows;
  // While a filter hides rows, merges and row dragging pause (positions shift)
  const canReorder = onReorder && !filterActive;

  // Resolve merge anchors/covered cells from current row & column order
  const anchorAt = {}; const covered = new Set();
  if (!filterActive) rows.forEach((r, ri) => allCols.forEach((c, ci) => {
    const m = merges[`${r.id}|${c.key}`];
    if (!m) return;
    const rs = Math.max(1, Math.min(m.rs || 1, rows.length - ri));
    const cs = Math.max(1, Math.min(m.cs || 1, allCols.length - ci));
    if (rs < 2 && cs < 2) return;
    anchorAt[`${ri},${ci}`] = { rs, cs };
    for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) if (i || j) covered.add(`${ri + i},${ci + j}`);
  }));

  const rect = selA && selB ? {
    r1: Math.min(selA.ri, selB.ri), r2: Math.max(selA.ri, selB.ri),
    c1: Math.min(selA.ci, selB.ci), c2: Math.max(selA.ci, selB.ci),
  } : null;
  const inRect = (ri, ci) => rect ? ri >= rect.r1 && ri <= rect.r2 && ci >= rect.c1 && ci <= rect.c2
    : selA ? selA.ri === ri && selA.ci === ci : false;

  function cellClick(ri, ci) {
    if (!mergeMode || filterActive) return;
    if (!selA || (selA && selB)) { setSelA({ ri, ci }); setSelB(null); }
    else setSelB({ ri, ci });
  }
  const selAnchor = selA && !selB ? anchorAt[`${selA.ri},${selA.ci}`] : null;

  function applyMerge() {
    if (!rect || (rect.r1 === rect.r2 && rect.c1 === rect.c2)) return;
    const row = rows[rect.r1]; const col = allCols[rect.c1];
    const next = { ...merges };
    // Clear any existing merges overlapping the new rectangle
    for (const k of Object.keys(next)) {
      const [rid, ck] = k.split('|');
      const ri = rows.findIndex(r => r.id === rid); const ci = allCols.findIndex(c => c.key === ck);
      if (ri >= rect.r1 - (next[k].rs || 1) + 1 && ri <= rect.r2 && ci >= rect.c1 - (next[k].cs || 1) + 1 && ci <= rect.c2) delete next[k];
    }
    next[`${row.id}|${col.key}`] = { rs: rect.r2 - rect.r1 + 1, cs: rect.c2 - rect.c1 + 1 };
    onConfig({ ...config, cols: customCols, merges: next });
    setSelA(null); setSelB(null);
  }
  function unmerge() {
    if (!selA) return;
    const row = rows[selA.ri]; const col = allCols[selA.ci];
    const next = { ...merges };
    delete next[`${row.id}|${col.key}`];
    onConfig({ ...config, cols: customCols, merges: next });
    setSelA(null); setSelB(null);
  }
  function addColumn() {
    const label = prompt('New column name:');
    if (!label || !label.trim()) return;
    const key = 'c' + Date.now().toString(36);
    onConfig({ ...config, cols: [...customCols, { key, label: label.trim() }], merges });
  }
  function renameColumn(c) {
    const label = prompt('Rename column:', c.label);
    if (!label || !label.trim()) return;
    onConfig({ ...config, cols: customCols.map(x => x.key === c.key ? { ...x, label: label.trim() } : x), merges });
  }
  function removeColumn(c) {
    if (!confirm(`Remove the "${c.label}" column? Its cell contents will be hidden.`)) return;
    const next = { ...merges };
    for (const k of Object.keys(next)) if (k.endsWith('|' + c.key)) delete next[k];
    onConfig({ ...config, cols: customCols.filter(x => x.key !== c.key), merges: next });
  }

  const nCols = allCols.length + (leading ? 1 : 0) + (trailing ? 1 : 0) + (onReorder ? 1 : 0);

  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
      <div className="budget-tbl-wrap">
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth: minWidth || undefined }}>
          <thead>
            <tr>
              {onReorder && <th style={{ ...th, width:26 }}></th>}
              {leading && <th style={{ ...th, width:34 }}></th>}
              {allCols.map(c => (
                <th key={c.key} draggable title="Drag to reorder column"
                  onDragStart={() => setDragCol(c.key)}
                  onDragOver={e => { e.preventDefault(); setOverCol(c.key); }}
                  onDragLeave={() => setOverCol(o => o === c.key ? null : o)}
                  onDrop={() => { dropCol(c.key); setDragCol(null); setOverCol(null); }}
                  onDragEnd={() => { setDragCol(null); setOverCol(null); }}
                  style={{ ...th, cursor:'grab', background: overCol === c.key && dragCol && dragCol !== c.key ? `${AVO}20` : undefined, opacity: dragCol === c.key ? 0.5 : 1 }}>
                  {c.label}
                  {c.custom && (
                    <span style={{ marginLeft:5, whiteSpace:'nowrap' }}>
                      <button title="Rename column" onClick={() => renameColumn(c)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:'0 2px' }}>✎</button>
                      <button title="Remove column" onClick={() => removeColumn(c)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:'0 2px' }}>✕</button>
                    </span>
                  )}
                </th>
              ))}
              {trailing && <th style={{ ...th, width:34 }}></th>}
            </tr>
            {showFilter && (
              <tr>
                {onReorder && <th></th>}
                {leading && <th></th>}
                {allCols.map(c => (
                  <th key={c.key} style={{ padding:'2px 6px 6px' }}>
                    <input value={filters[c.key] || ''} placeholder="Filter…"
                      onChange={e => setFilters(f => ({ ...f, [c.key]: e.target.value }))}
                      style={{ width:'100%', fontSize:10, padding:'3px 7px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)' }} />
                  </th>
                ))}
                {trailing && <th></th>}
              </tr>
            )}
          </thead>
          <tbody>
            {shownRows.length === 0 && (
              <tr><td colSpan={nCols} style={{ ...td, padding:'12px 14px', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>{emptyText || 'Nothing here yet.'}</td></tr>
            )}
            {shownRows.map((r, ri) => (
              <tr key={r.id}
                onDragOver={dragRow != null ? e => { e.preventDefault(); setOverRow(ri); } : undefined}
                onDrop={dragRow != null ? () => { dropRow(ri); setDragRow(null); setOverRow(null); } : undefined}
                style={{ borderTop: overRow === ri && dragRow != null && dragRow !== ri ? `2px solid ${AVO}` : '1px solid rgba(255,255,255,0.04)', opacity: r.__dim ? 0.5 : dragRow === ri ? 0.4 : 1 }}>
                {onReorder && (
                  <td style={{ ...td, textAlign:'center', width:26 }}>
                    <span draggable={!filterActive} title={filterActive ? 'Clear filters to reorder rows' : 'Drag to reorder row'}
                      onDragStart={() => setDragRow(ri)}
                      onDragEnd={() => { setDragRow(null); setOverRow(null); }}
                      style={{ cursor:'grab', color:'var(--muted)', fontSize:11, userSelect:'none', padding:'2px 4px' }}>⠿</span>
                  </td>
                )}
                {leading && <td style={{ ...td, textAlign:'center' }}>{leading(r)}</td>}
                {allCols.map((c, ci) => {
                  if (covered.has(`${ri},${ci}`)) return null;
                  const span = anchorAt[`${ri},${ci}`];
                  const sel = mergeMode && inRect(ri, ci);
                  const content = c.custom
                    ? <Cell value={r.extra?.[c.key]} placeholder="…" onSave={v => saveExtra(r.id, c.key, v)} />
                    : c.render(r);
                  return (
                    <td key={c.key} rowSpan={span?.rs} colSpan={span?.cs} onClick={() => cellClick(ri, ci)}
                      style={{ ...td, minWidth: c.minWidth,
                        ...(span ? { border:'1px solid rgba(255,255,255,0.09)', verticalAlign:'middle' } : {}),
                        ...(mergeMode ? { cursor:'pointer', background: sel ? `${AVO}30` : span ? 'rgba(255,255,255,0.03)' : undefined } : {}) }}>
                      <div style={mergeMode ? { pointerEvents:'none' } : undefined}>{content}</div>
                    </td>
                  );
                })}
                {trailing && <td style={{ ...td, textAlign:'center' }}>{trailing(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        {footerRight?.addRow && <button onClick={footerRight.addRow} style={pillBtn(AVO)}>+ Add Row</button>}
        <button onClick={addColumn} style={pillBtn('#a78bfa')}>+ Add Column</button>
        <button onClick={() => { setMergeMode(m => !m); setSelA(null); setSelB(null); }}
          style={mergeMode ? { ...pillBtn(), background:'rgba(255,255,255,0.9)', color:'#0b0b0b' } : pillBtn()}>
          {mergeMode ? '✕ Done Merging' : '⬚ Merge Cells'}
        </button>
        <button onClick={() => { setShowFilter(v => !v); if (showFilter) setFilters({}); }}
          style={showFilter ? { ...pillBtn(), background:'rgba(255,255,255,0.9)', color:'#0b0b0b' } : pillBtn()}>
          {showFilter ? '✕ Clear Filters' : '⧩ Filter'}
        </button>
        {filterActive && <span style={{ fontSize:10, color:'var(--muted)' }}>{shownRows.length} of {rows.length} rows</span>}
        {mergeMode && !selA && <span style={{ fontSize:10, color:'var(--muted)' }}>Click the first cell, then the last cell of the block to merge.</span>}
        {mergeMode && selA && !selB && !selAnchor && <span style={{ fontSize:10, color:'var(--muted)' }}>Now click the last cell of the block.</span>}
        {mergeMode && selAnchor && <button onClick={unmerge} style={pillBtn('#e05252')}>Unmerge This Cell</button>}
        {mergeMode && rect && (rect.r1 !== rect.r2 || rect.c1 !== rect.c2) && (
          <button onClick={applyMerge} style={{ ...pillBtn(), background:'rgba(255,255,255,0.9)', color:'#0b0b0b' }}>✓ Apply Merge</button>
        )}
        <div style={{ flex:1 }} />
        {footerRight?.node}
      </div>
    </div>
  );
}

// ── Video Tracker: rows are the pipeline edits carrying this project code ──
function VideoTracker({ edits, setEdits, config, onConfig, code }) {
  const nav = useNavigate();
  async function saveEdit(id, data) {
    try { const full = await api.updateAvoEdit(id, data); setEdits(es => es.map(x => x.id === id ? { ...x, ...full } : x)); }
    catch (e) { alert(e.message); }
  }
  async function addRow() {
    const title = prompt('Video title for the new edit:');
    if (!title || !title.trim()) return;
    try {
      const e = await api.createAvoEdit({ title: title.trim(), projectCode: code });
      setEdits(es => [...es, e]);
    } catch (err) { alert(err.message); }
  }
  function reorder(next) {
    setEdits(next);
    next.forEach((e, i) => api.updateAvoEdit(e.id, { trackerSort: i }).catch(() => {}));
  }
  const statusOf = k => AVO_STATUSES.find(([key]) => key === k);
  const colDefs = [
    { key:'tracker_type', label:'Type', minWidth:110, render: e => {
      const tc = typeColor(e.tracker_type);
      return <Cell value={e.tracker_type} placeholder="Type…" onSave={v => saveEdit(e.id, { trackerType: v })}
        style={e.tracker_type ? { background:`${tc}22`, border:`1px solid ${tc}55`, color:tc, fontWeight:700, textAlign:'center', borderRadius:12 } : {}} />;
    } },
    { key:'title', label:'Video Title', minWidth:150, render: e =>
      <span onClick={() => nav(`/avo/${e.id}`)} style={{ fontSize:12, fontWeight:700, cursor:'pointer', padding:'5px 6px', display:'inline-block' }}>{e.title}</span> },
    { key:'style', label:'Style', minWidth:140, render: e => <Cell value={e.style} placeholder="Style…" onSave={v => saveEdit(e.id, { style: v })} /> },
    { key:'notes', label:'Notes', minWidth:170, render: e => <Cell value={e.notes} placeholder="Notes…" onSave={v => saveEdit(e.id, { notes: v })} /> },
    { key:'end_date', label:'Due Date', render: e => <span style={{ whiteSpace:'nowrap', fontSize:12 }}>{fmtD(e.end_date)}</span> },
    { key:'video_assets', label:'Video Assets', minWidth:160, render: e => <Cell value={e.video_assets} placeholder="iPhone videos, music…" onSave={v => saveEdit(e.id, { videoAssets: v })} /> },
    { key:'lead_editor', label:'Editor', render: e => <span style={{ fontSize:12, whiteSpace:'nowrap' }}>{e.lead_editor || '—'}</span> },
    { key:'review_link', label:'Review Link', render: e => e.review_link
      ? <a href={e.review_link} target="_blank" rel="noreferrer" style={{ color:'#4a9eff', fontSize:11 }}>▶ {e.review_link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 22)}</a>
      : <span style={{ color:'var(--muted)', fontSize:11 }}>—</span> },
    { key:'status', label:'Status', render: e => {
      const st = statusOf(e.status);
      return st ? <span style={{ background:`${st[2]}22`, border:`1px solid ${st[2]}`, color:st[2], borderRadius:12, padding:'2px 10px', fontSize:9, fontWeight:800, whiteSpace:'nowrap' }}>{st[1]}</span> : null;
    } },
  ];
  return (
    <>
      <SmartTable rows={edits} colDefs={colDefs} config={config} onConfig={onConfig} minWidth={1050}
        saveExtra={(id, k, v) => saveEdit(id, { extra: { [k]: v } })}
        onReorder={reorder} footerRight={{ addRow }}
        emptyText="No edits with this project code yet — add them from the pipeline and they'll appear here automatically."
        leading={e => (
          <button className="vt-edit" title="Open this edit" onClick={() => nav(`/avo/${e.id}`)}
            style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:5, padding:'2px 6px', fontSize:11, cursor:'pointer' }}>✎</button>
        )} />
      <div style={{ padding:'8px 2px', fontSize:10, color:'var(--muted)' }}>
        Feeds live from the editing pipeline. Title, due date, editor, review link, and status come from each edit; Type, Style, Notes, Video Assets, and any custom columns are editable here.
      </div>
    </>
  );
}

// ── Generic editable grid (to-dos, lower thirds) ──
function Grid({ kind, columns, rows, setRows, pageId, doneKey, renderCell, config, onConfig }) {
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
  const colDefs = columns.map(([c, label, placeholder]) => ({
    key: c, label,
    render: r => renderCell?.(r, c, v => saveCell(r.id, c, v)) || <Cell value={r[c]} placeholder={placeholder} onSave={v => saveCell(r.id, c, v)} />,
  }));
  const shown = doneKey ? rows.map(r => r[doneKey] ? { ...r, __dim: true } : r) : rows;
  function reorder(next) {
    setRows(next.map(({ __dim, ...r }) => r));
    next.forEach((r, i) => api.updateAvoGridRow(kind, r.id, { sort: i }).catch(() => {}));
  }
  return (
    <SmartTable rows={shown} colDefs={colDefs} config={config} onConfig={onConfig}
      saveExtra={(id, k, v) => api.updateAvoGridRow(kind, id, { extra: { [k]: v } }).then(r => setRows(rs => rs.map(x => x.id === id ? r : x))).catch(e => alert(e.message))}
      footerRight={{ addRow }} onReorder={reorder}
      leading={doneKey ? r => (
        <input type="checkbox" checked={r[doneKey] || false} style={{ width:'auto', accentColor:AVO }}
          onChange={e => saveCell(r.id, doneKey, e.target.checked)} />
      ) : undefined}
      trailing={r => (
        <button title="Delete row" onClick={() => removeRow(r.id)}
          style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
      )} />
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

function MusicGrid({ rows, setRows, pageId, code, title, config, onConfig }) {
  const [share, setShare] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dragColKey, setDragColKey] = useState(null);
  const [showFilter, setShowFilter] = useState(false);
  const [filters, setFilters] = useState({});
  const customCols = config?.cols || [];
  const filterKeys = ['category', 'url', 'note', ...customCols.map(c => c.key)];
  const filterActive = showFilter && filterKeys.some(k => (filters[k] || '').trim());
  const musicVal = (r, k) => customCols.some(c => c.key === k) ? (r.extra?.[k] ??  '') : (r[k] ?? '');
  const shownRows = filterActive
    ? rows.filter(r => filterKeys.every(k => {
        const f = (filters[k] || '').trim().toLowerCase();
        return !f || String(musicVal(r, k) || '').toLowerCase().includes(f);
      }))
    : rows;
  function dropRowOn(targetId) {
    if (!dragId || dragId === targetId) return;
    const next = [...rows];
    const from = next.findIndex(r => r.id === dragId);
    const [moved] = next.splice(from, 1);
    next.splice(next.findIndex(r => r.id === targetId), 0, moved);
    setRows(next);
    next.forEach((r, i) => api.updateAvoGridRow('music', r.id, { sort: i }).catch(() => {}));
  }
  function dropColOn(targetKey) {
    if (!dragColKey || dragColKey === targetKey) return;
    const next = customCols.filter(c => c.key !== dragColKey);
    next.splice(next.findIndex(c => c.key === targetKey), 0, customCols.find(c => c.key === dragColKey));
    onConfig({ cols: next });
  }
  async function addRow() {
    try { const r = await api.addAvoGridRow(pageId, 'music'); setRows(rs => [...rs, r]); }
    catch (e) { alert(e.message); }
  }
  async function saveCell(rowId, col, val) {
    try { const r = await api.updateAvoGridRow('music', rowId, { [col]: val }); setRows(rs => rs.map(x => x.id === rowId ? r : x)); }
    catch (e) { alert(e.message); }
  }
  async function saveExtra(rowId, key, val) {
    try { const r = await api.updateAvoGridRow('music', rowId, { extra: { [key]: val } }); setRows(rs => rs.map(x => x.id === rowId ? r : x)); }
    catch (e) { alert(e.message); }
  }
  async function removeRow(rowId) {
    try { await api.deleteAvoGridRow('music', rowId); setRows(rs => rs.filter(x => x.id !== rowId)); }
    catch (e) { alert(e.message); }
  }
  function addColumn() {
    const label = prompt('New column name:');
    if (!label || !label.trim()) return;
    onConfig({ cols: [...customCols, { key: 'c' + Date.now().toString(36), label: label.trim() }] });
  }
  function renameColumn(c) {
    const label = prompt('Rename column:', c.label);
    if (!label || !label.trim()) return;
    onConfig({ cols: customCols.map(x => x.key === c.key ? { ...x, label: label.trim() } : x) });
  }
  function removeColumn(c) {
    if (!confirm(`Remove the "${c.label}" column? Its cell contents will be hidden.`)) return;
    onConfig({ cols: customCols.filter(x => x.key !== c.key) });
  }
  // Rows sharing a video title collapse into one group (title cell spans them)
  const groups = [];
  {
    const seen = {};
    for (const r of shownRows) {
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
            <tr>
              <th style={th}>Video Title</th><th style={th}>Link</th><th style={th}>Note</th>
              {customCols.map(c => (
                <th key={c.key} draggable title="Drag to reorder column"
                  onDragStart={() => setDragColKey(c.key)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { dropColOn(c.key); setDragColKey(null); }}
                  onDragEnd={() => setDragColKey(null)}
                  style={{ ...th, cursor:'grab', opacity: dragColKey === c.key ? 0.5 : 1 }}>
                  {c.label}
                  <span style={{ marginLeft:5, whiteSpace:'nowrap' }}>
                    <button title="Rename column" onClick={() => renameColumn(c)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:'0 2px' }}>✎</button>
                    <button title="Remove column" onClick={() => removeColumn(c)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:'0 2px' }}>✕</button>
                  </span>
                </th>
              ))}
              <th style={{ ...th, width:34 }}></th>
            </tr>
            {showFilter && (
              <tr>
                {filterKeys.map(k => (
                  <th key={k} style={{ padding:'2px 6px 6px' }}>
                    <input value={filters[k] || ''} placeholder="Filter…"
                      onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
                      style={{ width:'100%', fontSize:10, padding:'3px 7px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)' }} />
                  </th>
                ))}
                <th></th>
              </tr>
            )}
          </thead>
          <tbody>
            {shownRows.length === 0 && (
              <tr><td colSpan={4 + customCols.length} style={{ ...td, padding:'12px 14px', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Nothing here yet.</td></tr>
            )}
            {groups.map(([video, grp]) => grp.map((r, j) => (
              <tr key={r.id}
                onDragOver={dragId ? e => { e.preventDefault(); setOverId(r.id); } : undefined}
                onDrop={dragId ? () => { dropRowOn(r.id); setDragId(null); setOverId(null); } : undefined}
                style={{ borderTop: overId === r.id && dragId && dragId !== r.id ? `2px solid ${AVO}` : j === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none', opacity: dragId === r.id ? 0.4 : 1 }}>
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
                {customCols.map(c => (
                  <td key={c.key} style={{ ...td, minWidth:110 }}>
                    <Cell value={r.extra?.[c.key]} placeholder="…" onSave={v => saveExtra(r.id, c.key, v)} />
                  </td>
                ))}
                <td style={{ ...td, textAlign:'center', whiteSpace:'nowrap' }}>
                  <span draggable title="Drag to reorder row"
                    onDragStart={() => setDragId(r.id)}
                    onDragEnd={() => { setDragId(null); setOverId(null); }}
                    style={{ cursor:'grab', color:'var(--muted)', fontSize:11, userSelect:'none', padding:'2px 3px' }}>⠿</span>
                  <button title="Delete row" onClick={() => removeRow(r.id)}
                    style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <button onClick={addRow} style={pillBtn(AVO)}>+ Add Row</button>
        <button onClick={addColumn} style={pillBtn('#a78bfa')}>+ Add Column</button>
        <button onClick={() => { setShowFilter(v => !v); if (showFilter) setFilters({}); }}
          style={showFilter ? { ...pillBtn(), background:'rgba(255,255,255,0.9)', color:'#0b0b0b' } : pillBtn()}>
          {showFilter ? '✕ Clear Filters' : '⧩ Filter'}
        </button>
        <div style={{ flex:1 }} />
        <button onClick={() => setShare(true)} disabled={!shareGroups.length}
          style={{ background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:14, padding:'3px 14px', fontSize:10, fontWeight:800, cursor: shareGroups.length ? 'pointer' : 'default', opacity: shareGroups.length ? 1 : 0.4 }}>
          Share
        </button>
      </div>
      {share && <MusicShareModal groups={shareGroups} code={code} title={title} onClose={() => setShare(false)} />}
    </div>
  );
}

// ── User-defined table: every column is custom, full SmartTable feature set ──
function CustomTable({ table, onChange, onDelete }) {
  const rows = table.rows || [];
  const setRows = fn => onChange({ ...table, rows: typeof fn === 'function' ? fn(rows) : fn });
  async function addRow() {
    try { const r = await api.addAvoTableRow(table.id); setRows([...rows, r]); }
    catch (e) { alert(e.message); }
  }
  function reorder(next) {
    setRows(next);
    next.forEach((r, i) => api.updateAvoTableRow(r.id, { sort: i }).catch(() => {}));
  }
  function saveConfig(next) {
    onChange({ ...table, config: next });
    api.updateAvoTable(table.id, { config: next }).catch(e => alert(e.message));
  }
  async function rename() {
    const name = prompt('Rename table:', table.name);
    if (!name || !name.trim()) return;
    onChange({ ...table, name: name.trim() });
    api.updateAvoTable(table.id, { name: name.trim() }).catch(e => alert(e.message));
  }
  return (
    <>
      <SmartTable rows={rows} colDefs={[]} config={table.config || {}} onConfig={saveConfig}
        saveExtra={(id, k, v) => api.updateAvoTableRow(id, { extra: { [k]: v } })
          .then(r => setRows(rows.map(x => x.id === id ? r : x))).catch(e => alert(e.message))}
        footerRight={{ addRow }} onReorder={reorder}
        emptyText="Empty table — add rows and columns to build it out."
        trailing={r => (
          <button title="Delete row" onClick={async () => {
            try { await api.deleteAvoTableRow(r.id); setRows(rows.filter(x => x.id !== r.id)); }
            catch (e) { alert(e.message); }
          }} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
        )} />
      <div style={{ display:'flex', gap:10, padding:'8px 2px' }}>
        <button onClick={rename} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:10, cursor:'pointer', padding:0 }}>✎ Rename Table</button>
        <button onClick={onDelete} style={{ background:'none', border:'none', color:'var(--red-text, #e05252)', fontSize:10, cursor:'pointer', padding:0 }}>✕ Delete Table</button>
      </div>
    </>
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
  const [tables, setTables] = useState([]);
  const [tab, setTab] = useState('tracker');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.avoProject(id)
      .then(p => { setPage(p); setEdits(p.edits || []); setLowerThirds(p.lowerThirds || []); setTodos(p.todos || []); setMusic(p.music || []); setTables(p.customTables || []); })
      .catch(e => setErr(e.message));
  }, [id]);

  async function addTable() {
    const name = prompt('Name for the new table:');
    if (!name || !name.trim()) return;
    try {
      const t = await api.createAvoTable(id, name.trim());
      setTables(ts => [...ts, t]);
      setTab('table:' + t.id);
    } catch (e) { alert(e.message); }
  }
  async function deleteTable(t) {
    if (!confirm(`Delete the "${t.name}" table and all its rows?`)) return;
    try {
      await api.deleteAvoTable(t.id);
      setTables(ts => ts.filter(x => x.id !== t.id));
      setTab('tracker');
    } catch (e) { alert(e.message); }
  }

  const gridConfig = page?.grid_config || {};
  const cfgFor = k => gridConfig[k] || { cols: [], merges: {} };
  const saveCfg = k => next => {
    const gc = { ...gridConfig, [k]: next };
    setPage(p => ({ ...p, grid_config: gc }));
    api.updateAvoProject(id, { gridConfig: gc }).catch(e => alert(e.message));
  };

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
              {tables.map(t => (
                <button key={t.id} onClick={() => setTab('table:' + t.id)}
                  style={{
                    background: tab === 'table:' + t.id ? `${AVO}2e` : 'transparent', border:`1px solid ${tab === 'table:' + t.id ? AVO : 'var(--border)'}`,
                    color: tab === 'table:' + t.id ? AVO : 'var(--muted)', borderRadius:16, padding:'5px 14px', fontSize:11, fontWeight:800, cursor:'pointer',
                  }}>
                  {t.name}
                </button>
              ))}
              <button onClick={addTable} title="Add a custom table as a new tab"
                style={{ background:'var(--bg)', border:'1px solid rgba(255,255,255,0.55)', color:'#e8e8e8', borderRadius:16, padding:'5px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                + Add Custom Table
              </button>
            </div>

            {tab === 'tracker' && <VideoTracker edits={edits} setEdits={setEdits} code={page.code} config={cfgFor('tracker')} onConfig={saveCfg('tracker')} />}
            {tab === 'todos' && (
              <Grid kind="todos" pageId={id} doneKey="done" rows={todos} setRows={setTodos} renderCell={todoCell}
                config={cfgFor('todos')} onConfig={saveCfg('todos')}
                columns={[['category', 'Category', 'Takeaways…'], ['video', 'Video', 'Which video'], ['needs', 'Needs', 'Script, music, shot list…'], ['text', 'To Do', 'Status / who’s on it…']]} />
            )}
            {tab === 'music' && (
              <MusicGrid pageId={id} rows={music} setRows={setMusic} code={page.code} title={page.title}
                config={cfgFor('music')} onConfig={next => saveCfg('music')({ ...cfgFor('music'), ...next })} />
            )}
            {tables.map(t => tab === 'table:' + t.id && (
              <CustomTable key={t.id} table={t}
                onChange={next => setTables(ts => ts.map(x => x.id === t.id ? next : x))}
                onDelete={() => deleteTable(t)} />
            ))}
            {tab === 'lower-thirds' && (
              <Grid kind="lower-thirds" pageId={id} rows={lowerThirds} setRows={setLowerThirds}
                config={cfgFor('lower-thirds')} onConfig={saveCfg('lower-thirds')}
                columns={[['name', 'Name', 'Full name'], ['title', 'Title', 'On-screen title / role'], ['notes', 'Notes', '']]} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
