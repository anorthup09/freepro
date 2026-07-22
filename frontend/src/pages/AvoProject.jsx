import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import { AvoHeader, AVO, AVO_STATUSES, DELIVERABLE_STATUSES, DELIV_STATUS, FOCUS_COLOR, ClipIcon, EditorSelect, VersionInput, stepV } from './Avo.jsx';
import { CATEGORIES } from './AvoEdit.jsx';
import { MILESTONES, nextMilestone } from '../components/GanttChart.jsx';
import { AvoForm, BLANK_DELIVERABLE_FORM } from './Project/Deliverables.jsx';
import ContractSendModal from '../components/ContractSendModal.jsx';
import RfrModal from '../components/RfrModal.jsx';

const th = { padding:'7px 10px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', whiteSpace:'nowrap' };
const td = { padding:'4px 6px', verticalAlign:'middle' };
const cellInput = { background:'transparent', border:'1px solid transparent', fontSize:12, width:'100%', padding:'5px 6px', borderRadius:5 };

const TYPE_COLORS = ['#5ABF80', '#d66a9b', '#e6c229', '#e8955a', '#f08080', '#4a9eff', '#a78bfa', '#40A0A0'];
const typeColor = t => { let h = 0; for (const c of t || '') h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return TYPE_COLORS[Math.abs(h) % TYPE_COLORS.length]; };
const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '—';

// Inline-editable text cell: saves on blur. Read-only renders static text.
function Cell({ value, onSave, placeholder, style, readOnly, multiline }) {
  const [v, setV] = useState(value || '');
  useEffect(() => setV(value || ''), [value]);
  if (readOnly) return <span style={{ ...cellInput, ...style, display:'inline-block', border:'1px solid transparent', background:'transparent', cursor:'default', minHeight:0, ...(multiline ? { whiteSpace:'pre-wrap' } : { whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }) }}>{value || ''}</span>;
  if (multiline) return (
    <textarea value={v} placeholder={placeholder} onChange={e => setV(e.target.value)}
      onBlur={() => { if (v !== (value || '')) onSave(v); }} rows={3}
      style={{ ...cellInput, ...style, minHeight:58, resize:'vertical', whiteSpace:'pre-wrap', lineHeight:1.4 }} />
  );
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
function SmartTable({ rows, colDefs, config, onConfig, saveExtra, leading, trailing, emptyText, footerRight, minWidth, onReorder, readOnly, corner }) {
  if (readOnly) onReorder = null; // no drag-reorder in the read-only client view
  const [mergeMode, setMergeMode] = useState(false);
  const [selA, setSelA] = useState(null);   // {ri, ci}
  const [selB, setSelB] = useState(null);
  const [dragRow, setDragRow] = useState(null);
  const [dragCol, setDragCol] = useState(null);
  const [overRow, setOverRow] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [openFilter, setOpenFilter] = useState(null); // column key with the filter dropdown open
  const [filters, setFilters] = useState({});
  const [liveWidths, setLiveWidths] = useState({});   // in-progress column widths while dragging
  const resizeRef = useRef(null);

  const customCols = config?.cols || [];
  const merges = config?.merges || {};
  // Column-level expand (wrap all cells) + per-cell collapse overrides + widths.
  const expandedCols = new Set(config?.expandedCols || []);
  const collapsedCells = new Set(config?.collapsedCells || []);
  const widths = config?.widths || {};
  const patchConfig = obj => onConfig({ ...config, ...obj });
  const colWidth = c => liveWidths[c.key] ?? widths[c.key] ?? c.minWidth ?? undefined;
  const isExpandable = c => c.custom || c.expandable;
  const toggleColExpand = key => { const s = new Set(expandedCols); s.has(key) ? s.delete(key) : s.add(key); patchConfig({ expandedCols: [...s] }); };
  const toggleCellCollapse = wid => { const s = new Set(collapsedCells); s.has(wid) ? s.delete(wid) : s.add(wid); patchConfig({ collapsedCells: [...s] }); };
  useEffect(() => {
    function move(e) {
      if (!resizeRef.current) return;
      const { key, startX, startW } = resizeRef.current;
      setLiveWidths(lw => ({ ...lw, [key]: Math.max(60, startW + (e.clientX - startX)) }));
    }
    function up() {
      const r = resizeRef.current; if (!r) return; resizeRef.current = null;
      setLiveWidths(lw => {
        if (lw[r.key] != null) patchConfig({ widths: { ...widths, [r.key]: Math.round(lw[r.key]) } });
        const { [r.key]: _drop, ...rest } = lw; return rest;
      });
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [config]);
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
    onConfig({ ...config, cols: customCols, merges, order: keys });
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
  const filterActive = allCols.some(c => (filters[c.key] || '').trim());
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
              {leading && <th style={{ ...th, width:34, textAlign:'center' }}>{corner || null}</th>}
              {allCols.map(c => { const w = colWidth(c); return (
                <th key={c.key} draggable={!readOnly} title={readOnly ? undefined : 'Drag to reorder column'}
                  onDragStart={() => setDragCol(c.key)}
                  onDragOver={e => { e.preventDefault(); setOverCol(c.key); }}
                  onDragLeave={() => setOverCol(o => o === c.key ? null : o)}
                  onDrop={() => { dropCol(c.key); setDragCol(null); setOverCol(null); }}
                  onDragEnd={() => { setDragCol(null); setOverCol(null); }}
                  style={{ ...th, cursor:'grab', position:'relative', width:w, maxWidth:w, background: overCol === c.key && dragCol && dragCol !== c.key ? `${AVO}20` : undefined, opacity: dragCol === c.key ? 0.5 : 1 }}>
                  {c.label}
                  {isExpandable(c) && !readOnly && (
                    <button title={expandedCols.has(c.key) ? 'Collapse all cells in this column' : 'Expand all cells in this column'} draggable={false}
                      onClick={e => { e.stopPropagation(); toggleColExpand(c.key); }}
                      style={{ background:'none', border:'none', cursor:'pointer', padding:'0 3px', fontSize:10, color: expandedCols.has(c.key) ? AVO : 'var(--muted)' }}>{expandedCols.has(c.key) ? '▤' : '⤢'}</button>
                  )}
                  <button title="Filter by this column" draggable={false}
                    onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setOpenFilter(o => o?.key === c.key ? null : { key: c.key, x: r.left, y: r.bottom }); }}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:'0 3px', fontSize:9,
                      color: (filters[c.key] || '').trim() ? AVO : 'var(--muted)', opacity: (filters[c.key] || '').trim() ? 1 : 0.7 }}>⧩</button>
                  {!readOnly && <span className="tbl-col-grip" title="Drag to adjust column width" draggable={false}
                    onMouseDown={e => { e.preventDefault(); e.stopPropagation(); const thEl = e.currentTarget.closest('th'); resizeRef.current = { key: c.key, startX: e.clientX, startW: thEl ? thEl.getBoundingClientRect().width : 120 }; }}
                    onClick={e => e.stopPropagation()} />}
                  {openFilter?.key === c.key && (
                    <div onClick={e => e.stopPropagation()}
                      style={{ position:'fixed', top:openFilter.y + 4, left:Math.min(openFilter.x, window.innerWidth - 180), zIndex:130, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:7, padding:8, boxShadow:'0 8px 20px rgba(0,0,0,0.5)', minWidth:150 }}>
                      <div style={{ fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Filter by {c.label}</div>
                      <input autoFocus value={filters[c.key] || ''} placeholder="Contains…"
                        onChange={e => setFilters(f => ({ ...f, [c.key]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && setOpenFilter(null)}
                        style={{ width:'100%', fontSize:11, padding:'4px 8px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)' }} />
                      <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
                        <button onClick={() => { setFilters(f => ({ ...f, [c.key]: '' })); setOpenFilter(null); }}
                          style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:0 }}>Clear</button>
                        <button onClick={() => setOpenFilter(null)}
                          style={{ background:'none', border:'none', color:AVO, fontSize:9, fontWeight:800, cursor:'pointer', padding:0 }}>Done</button>
                      </div>
                    </div>
                  )}
                  {c.custom && !readOnly && (
                    <span style={{ marginLeft:5, whiteSpace:'nowrap' }}>
                      <button title="Rename column" onClick={() => renameColumn(c)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:'0 2px' }}>✎</button>
                      <button title="Remove column" onClick={() => removeColumn(c)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:'0 2px' }}>✕</button>
                    </span>
                  )}
                </th>
              ); })}
              {trailing && <th style={{ ...th, width:34 }}></th>}
            </tr>
          </thead>
          <tbody>
            {shownRows.length === 0 && (
              <tr><td colSpan={nCols} style={{ ...td, padding:'12px 14px', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>{emptyText || 'Nothing here yet.'}</td></tr>
            )}
            {shownRows.map((r, ri) => r.__header ? (
              <tr key={r.id}>
                <td colSpan={nCols} style={{ padding:'7px 12px', background:'rgba(255,255,255,0.04)', borderTop:'1px solid var(--border)' }}>
                  <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:r.__color || 'var(--muted)' }}>{r.__header}</span>
                </td>
              </tr>
            ) : (
              <tr key={r.id}
                onDragOver={dragRow != null ? e => { e.preventDefault(); setOverRow(ri); } : undefined}
                onDrop={dragRow != null ? () => { dropRow(ri); setDragRow(null); setOverRow(null); } : undefined}
                style={{ borderTop: overRow === ri && dragRow != null && dragRow !== ri ? `2px solid ${AVO}` : '1px solid rgba(255,255,255,0.04)', opacity: r.__dim ? 0.5 : dragRow === ri ? 0.4 : 1, background: r.tracker_color ? `${r.tracker_color}22` : undefined }}>
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
                  const wid = `${r.id}|${c.key}`;
                  const w = colWidth(c);
                  const colExp = expandedCols.has(c.key);
                  const eff = colExp && !collapsedCells.has(wid);   // this cell wrapped?
                  const content = c.custom
                    ? <Cell value={r.extra?.[c.key]} placeholder="…" readOnly={readOnly} multiline={eff} onSave={v => saveExtra(r.id, c.key, v)} />
                    : c.render(r, eff);
                  return (
                    <td key={c.key} rowSpan={span?.rs} colSpan={span?.cs} onClick={() => cellClick(ri, ci)}
                      style={{ ...td, minWidth: w || c.minWidth, width: w, maxWidth: w, position:'relative',
                        ...(span ? { border:'1px solid rgba(255,255,255,0.09)', verticalAlign:'middle' } : {}),
                        ...(mergeMode ? { cursor:'pointer', background: sel ? `${AVO}30` : span ? 'rgba(255,255,255,0.03)' : undefined } : {}) }}>
                      <div style={mergeMode ? { pointerEvents:'none' } : undefined}>{content}</div>
                      {colExp && isExpandable(c) && !readOnly && !mergeMode && (
                        <button title={eff ? 'Collapse this cell' : 'Expand this cell'}
                          onClick={ev => { ev.stopPropagation(); toggleCellCollapse(wid); }}
                          style={{ position:'absolute', top:2, right:2, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:4, color:'var(--muted)', cursor:'pointer', fontSize:9, lineHeight:1, padding:'1px 3px', opacity:0.85 }}>{eff ? '▴' : '⤢'}</button>
                      )}
                    </td>
                  );
                })}
                {trailing && <td style={{ ...td, textAlign:'center' }}>{trailing(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        {footerRight?.addRow && <button onClick={footerRight.addRow} style={pillBtn()}>{footerRight.label || '+ Add Row'}</button>}
        <button onClick={addColumn} style={pillBtn('#a78bfa')}>+ Add Column</button>
        <button onClick={() => { setMergeMode(m => !m); setSelA(null); setSelB(null); }}
          style={mergeMode ? { ...pillBtn(), background:'rgba(255,255,255,0.9)', color:'#0b0b0b' } : pillBtn()}>
          {mergeMode ? '✕ Done Merging' : '⬚ Merge Cells'}
        </button>
        {filterActive && (
          <>
            <button onClick={() => { setFilters({}); setOpenFilter(null); }} style={pillBtn()}>✕ Clear Filters</button>
            <span style={{ fontSize:10, color:'var(--muted)' }}>{shownRows.length} of {rows.length} rows</span>
          </>
        )}
        {mergeMode && !selA && <span style={{ fontSize:10, color:'var(--muted)' }}>Click the first cell, then the last cell of the block to merge.</span>}
        {mergeMode && selA && !selB && !selAnchor && <span style={{ fontSize:10, color:'var(--muted)' }}>Now click the last cell of the block.</span>}
        {mergeMode && selAnchor && <button onClick={unmerge} style={pillBtn('#e05252')}>Unmerge This Cell</button>}
        {mergeMode && rect && (rect.r1 !== rect.r2 || rect.c1 !== rect.c2) && (
          <button onClick={applyMerge} style={{ ...pillBtn(), background:'rgba(255,255,255,0.9)', color:'#0b0b0b' }}>✓ Apply Merge</button>
        )}
        <div style={{ flex:1 }} />
        {footerRight?.node}
      </div>
      )}
    </div>
  );
}

// 10 row color-coding options for the tracker (hover the pencil to pick)
const ROW_COLORS = ['#e05252', '#E8500A', '#e6c229', '#5ABF80', '#35c4c8', '#4a9eff', '#6366f1', '#a78bfa', '#d66a9b', '#8a8f98'];

// Stable color per category name so the pills read consistently
const CAT_COLORS = ['#4a9eff', '#e6c229', '#9DC183', '#a78bfa', '#e05252', '#35c4c8', '#d66a9b', '#E8500A', '#6366f1', '#5ABF80'];
const catColor = s => { if (!s) return null; let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return CAT_COLORS[h % CAT_COLORS.length]; };

// Pencil that opens the edit on click, and reveals a 10-swatch color palette on
// hover to color-code the row. Palette is portaled so the scroll wrap can't clip it.
function RowColorPencil({ edit, onOpen, onPick }) {
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const hideTimer = useRef(null);
  const show = () => {
    clearTimeout(hideTimer.current);
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, left: r.left });
  };
  const hideSoon = () => { hideTimer.current = setTimeout(() => setPos(null), 160); };
  const cur = edit.tracker_color || null;
  return (
    <span style={{ position:'relative', display:'inline-block' }} onMouseEnter={show} onMouseLeave={hideSoon}>
      <button ref={btnRef} className="vt-edit" title="Open this edit · hover to color-code the row" onClick={onOpen}
        style={{ background: cur ? `${cur}22` : 'none', border:`1px solid ${cur || 'var(--border)'}`, color: cur || 'var(--muted)', borderRadius:5, padding:'2px 6px', fontSize:11, cursor:'pointer' }}>✎</button>
      {pos && createPortal(
        <div onMouseEnter={show} onMouseLeave={hideSoon}
          style={{ position:'fixed', top:pos.top, left:pos.left, zIndex:400, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:8, boxShadow:'0 8px 24px rgba(0,0,0,0.55)', display:'grid', gridTemplateColumns:'repeat(5, 18px)', gap:6 }}>
          {ROW_COLORS.map(c => (
            <button key={c} title={c} onClick={() => { onPick(c); setPos(null); }}
              style={{ width:18, height:18, borderRadius:'50%', background:c, cursor:'pointer', padding:0, border: cur === c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.25)' }} />
          ))}
          <button onClick={() => { onPick(null); setPos(null); }} title="Clear color"
            style={{ gridColumn:'span 5', marginTop:2, background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:6, fontSize:9, fontWeight:800, padding:'3px 0', cursor:'pointer' }}>Clear</button>
        </div>, document.body)}
    </span>
  );
}

// ── Video Tracker: rows are the pipeline edits carrying this project code ──
function VideoTracker({ edits, setEdits, config, onConfig, code, readOnly, onOpenEdit, A = api }) {
  const nav = useNavigate();
  async function saveEdit(id, data) {
    try { const full = await A.updateAvoEdit(id, data); setEdits(es => es.map(x => x.id === id ? { ...x, ...full } : x)); }
    catch (e) { alert(e.message); }
  }
  const [addForm, setAddForm] = useState(null);   // BLANK form when the pop-out is open
  const [savingAdd, setSavingAdd] = useState(false);
  const [colsOpen, setColsOpen] = useState(false); // column show/hide menu
  const [colsAnchor, setColsAnchor] = useState({ x: 0, y: 0 });
  async function submitAdd(ev) {
    ev.preventDefault();
    if (savingAdd) return;
    setSavingAdd(true);
    try {
      const e = await A.createAvoEdit({ ...addForm, projectCode: code });
      setEdits(es => [...es, e]);
      setAddForm(null);
    } catch (err) { alert(err.message); }
    setSavingAdd(false);
  }
  function reorder(next) {
    const real = next.filter(r => !r.__header);
    setEdits(real);
    real.forEach((e, i) => A.updateAvoEdit(e.id, { trackerSort: i }).catch(() => {}));
  }
  async function dupeRow(e) {
    try {
      const copy = await A.duplicateAvoEdit(e.id);
      setEdits(es => { const i = es.findIndex(x => x.id === e.id); const next = [...es]; next.splice(i < 0 ? es.length : i + 1, 0, copy); return next; });
    } catch (err) { alert(err.message); }
  }
  const statusOf = k => AVO_STATUSES.find(([key]) => key === k);
  // Category options: the standard list + any custom categories already used on
  // this project's edits, so a category typed once is reusable from the dropdown.
  const usedCategories = [...new Set(edits.map(e => e.category).filter(Boolean))];
  const categoryOptions = [...new Set([...CATEGORIES, ...usedCategories])];
  const ALL_COLS = [
    { key:'category', label:'Category', minWidth:130, render: e => {
      const cc = catColor(e.category);
      if (readOnly) return e.category
        ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:12, background: cc ? `${cc}22` : 'transparent', border:`1px solid ${cc ? cc + '55' : 'var(--border)'}`, color: cc || 'var(--muted)', whiteSpace:'nowrap' }}>{e.category}</span>
        : <span style={{ color:'var(--muted)', fontSize:11 }}>—</span>;
      return (
        <select value={e.category || ''} onChange={ev => {
          if (ev.target.value === '__add__') { const c = prompt('New category name:'); if (c && c.trim()) saveEdit(e.id, { category: c.trim() }); return; }
          saveEdit(e.id, { category: ev.target.value });
        }} style={{ fontSize:11, fontWeight:700, padding:'4px 8px', borderRadius:12, width:'100%',
          background: cc ? `${cc}22` : 'transparent', border: `1px solid ${cc ? cc + '55' : 'var(--border)'}`, color: cc || 'var(--muted)', textAlign:'center' }}>
          <option value="">—</option>
          {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__add__">+ Add category…</option>
        </select>
      );
    } },
    { key:'tracker_type', label:'Type', minWidth:120, render: e => {
      const TRACKER_TYPES = [['Pre-Event', '#4a9eff'], ['On-Site', '#e6c229'], ['Post-Event', '#9DC183'], ['Standard Edit', '#a78bfa']];
      const tc = (TRACKER_TYPES.find(([t]) => t === e.tracker_type) || [null, null])[1];
      if (readOnly) return e.tracker_type
        ? <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:12, background: tc ? `${tc}22` : 'transparent', border:`1px solid ${tc ? tc + '55' : 'var(--border)'}`, color: tc || 'var(--muted)', whiteSpace:'nowrap' }}>{e.tracker_type}</span>
        : <span style={{ color:'var(--muted)', fontSize:11 }}>—</span>;
      return (
        <select value={e.tracker_type || ''} onChange={ev => saveEdit(e.id, { trackerType: ev.target.value })}
          style={{ fontSize:11, fontWeight:700, padding:'4px 8px', borderRadius:12, width:'100%',
            background: tc ? `${tc}22` : 'transparent', border: `1px solid ${tc ? tc + '55' : 'var(--border)'}`, color: tc || 'var(--muted)', textAlign:'center' }}>
          <option value="">—</option>
          {e.tracker_type && !TRACKER_TYPES.some(([t]) => t === e.tracker_type) && <option value={e.tracker_type}>{e.tracker_type}</option>}
          {TRACKER_TYPES.map(([t]) => <option key={t} value={t}>{t}</option>)}
        </select>
      );
    } },
    { key:'title', label:'Video Title', minWidth:150, render: e =>
      <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
        <span onClick={() => onOpenEdit ? onOpenEdit(e) : nav(`/avo/${e.id}`)} style={{ fontSize:12, fontWeight:700, cursor:'pointer', padding:'5px 6px' }}>{e.title}</span>
        {e.file_count > 0 && <span title={`${e.file_count} file${e.file_count === 1 ? '' : 's'} in this edit's folder`} style={{ display:'inline-flex', alignItems:'center', gap:2, color:'var(--muted)', fontSize:9, fontWeight:700, whiteSpace:'nowrap' }}><ClipIcon size={10} /> {e.file_count}</span>}
      </span> },
    { key:'description', label:'Description', minWidth:190, expandable:true, render: (e, expanded) =>
      <Cell value={e.description} placeholder="Description…" readOnly={readOnly} multiline={expanded} onSave={v => saveEdit(e.id, { description: v })} /> },
    { key:'end_date', label:'Due Date', render: e => <span style={{ whiteSpace:'nowrap', fontSize:12 }}>{fmtD(e.end_date)}</span> },
    { key:'video_assets', label:'Video Assets', minWidth:160, expandable:true, render: (e, expanded) => <Cell value={e.video_assets} placeholder="iPhone videos, music…" readOnly={readOnly} multiline={expanded} onSave={v => saveEdit(e.id, { videoAssets: v })} /> },
    { key:'lead_editor', label:'Editor', render: e => <span style={{ fontSize:12, whiteSpace:'nowrap' }}>{e.current_editor || e.lead_editor || '—'}</span> },
    { key:'review_link', label:'Review Link', render: e => e.review_link
      ? <a href={e.review_link} target="_blank" rel="noreferrer" style={{ color:'#4a9eff', fontSize:11 }}>▶ {e.review_link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 22)}</a>
      : <span style={{ color:'var(--muted)', fontSize:11 }}>—</span> },
    { key:'latest_comment', label:'Latest Comment', minWidth:150, render: e => e.latest_comment
      ? <span style={{ fontSize:11 }} title={e.latest_comment}>{e.latest_comment.slice(0, 40)}{e.latest_comment.length > 40 ? '…' : ''}</span>
      : <span style={{ color:'var(--muted)', fontSize:11 }}>—</span> },
    { key:'status', label:'Status', render: e => {
      const st = DELIV_STATUS(e.workflow_status);
      return (
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
          {e.focus && <span title="Focus" style={{ background:`${FOCUS_COLOR}22`, border:`1px solid ${FOCUS_COLOR}`, color:FOCUS_COLOR, borderRadius:12, padding:'2px 7px', fontSize:8, fontWeight:800 }}>FOCUS</span>}
          {st
            ? <span style={{ background:`${st[2]}22`, border:`1px solid ${st[2]}`, color:st[2], borderRadius:12, padding:'2px 10px', fontSize:9, fontWeight:800, whiteSpace:'nowrap' }}>{st[1]}</span>
            : <span style={{ color:'var(--muted)', fontSize:9, fontWeight:700 }}>Upcoming</span>}
        </span>
      );
    } },
    // Optional field columns — off by default, toggled from the Columns menu.
    { key:'aspect_ratio', label:'Aspect Ratio', render: e => <Cell value={e.aspect_ratio} placeholder="16:9…" readOnly={readOnly} onSave={v => saveEdit(e.id, { aspectRatio: v })} /> },
    { key:'resolution', label:'Resolution', render: e => <Cell value={e.resolution} placeholder="1080p…" readOnly={readOnly} onSave={v => saveEdit(e.id, { resolution: v })} /> },
    { key:'frame_rate', label:'Frame Rate', render: e => <Cell value={e.frame_rate} placeholder="23.976…" readOnly={readOnly} onSave={v => saveEdit(e.id, { frameRate: v })} /> },
    { key:'drive', label:'Drive', render: e => <Cell value={e.drive} placeholder="Drive…" readOnly={readOnly} onSave={v => saveEdit(e.id, { drive: v })} /> },
    { key:'asset_ref', label:'Asset Ref', render: e => <Cell value={e.asset_ref} placeholder="Asset ref…" readOnly={readOnly} onSave={v => saveEdit(e.id, { assetRef: v })} /> },
    { key:'music_ref', label:'Music Ref', render: e => <Cell value={e.music_ref} placeholder="Music ref…" readOnly={readOnly} onSave={v => saveEdit(e.id, { musicRef: v })} /> },
    { key:'creative', label:'Creative', render: e => <span style={{ fontSize:12, whiteSpace:'nowrap' }}>{e.creative || '—'}</span> },
    { key:'start_date', label:'Start Date', render: e => <span style={{ whiteSpace:'nowrap', fontSize:12 }}>{fmtD(e.start_date)}</span> },
    { key:'version', label:'V#', render: e => <span style={{ fontSize:12, whiteSpace:'nowrap' }}>V{(Number(e.version) || 1).toFixed(1)}</span> },
    { key:'approved', label:'Approved', render: e => e.approved
      ? <span style={{ color:'#5ABF80', fontSize:11, fontWeight:800 }}>✓</span>
      : <span style={{ color:'var(--muted)', fontSize:11 }}>—</span> },
  ];
  // Core columns show by default; optional ones show when toggled on. The user's
  // choices (and column order) persist in the page's tracker grid_config.
  const CORE_KEYS = new Set(['category', 'tracker_type', 'title', 'description', 'end_date', 'video_assets', 'lead_editor', 'review_link', 'latest_comment', 'status']);
  const hiddenCols = new Set(config?.hidden || []);
  const shownCols = new Set(config?.shown || []);
  const colDefs = ALL_COLS.filter(c => CORE_KEYS.has(c.key) ? !hiddenCols.has(c.key) : shownCols.has(c.key));
  function toggleCol(c) {
    const h = new Set(config?.hidden || []); const s = new Set(config?.shown || []);
    if (CORE_KEYS.has(c.key)) { h.has(c.key) ? h.delete(c.key) : h.add(c.key); }
    else { s.has(c.key) ? s.delete(c.key) : s.add(c.key); }
    onConfig({ ...config, hidden: [...h], shown: [...s] });
  }
  const GROUPS = [['Pre-Event', '#4a9eff'], ['On-Site', '#e6c229'], ['Post-Event', '#9DC183'], ['Standard Edit', '#a78bfa']];
  const grouped = [];
  for (const [g, color] of GROUPS) {
    const members = edits.filter(e => e.tracker_type === g);
    if (members.length) grouped.push({ id: 'hdr-' + g, __header: g, __color: color }, ...members);
  }
  const untyped = edits.filter(e => !GROUPS.some(([g]) => g === e.tracker_type));
  if (untyped.length) {
    if (grouped.length) grouped.push({ id: 'hdr-other', __header: 'No Type Yet', __color: 'var(--muted)' });
    grouped.push(...untyped);
  }
  const columnsWheel = readOnly ? null : (
    <button title="Add or remove columns"
      onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setColsAnchor({ x: r.left, y: r.bottom }); setColsOpen(o => !o); }}
      style={{ background:'none', border:'none', color: colsOpen ? AVO : 'var(--muted)', cursor:'pointer', fontSize:14, lineHeight:1, padding:2 }}>⚙</button>
  );
  return (
    <>
      {colsOpen && !readOnly && createPortal(
        <>
          <div onClick={() => setColsOpen(false)} style={{ position:'fixed', inset:0, zIndex:130 }} />
          <div style={{ position:'fixed', top:colsAnchor.y + 4, left:colsAnchor.x, zIndex:131, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:6, minWidth:210, maxHeight:360, overflowY:'auto', boxShadow:'0 10px 28px rgba(0,0,0,0.55)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'2px 6px 6px' }}>
              <span style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:700 }}>Show columns</span>
              <button onClick={() => setColsOpen(false)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:12, lineHeight:1 }}>✕</button>
            </div>
            {ALL_COLS.map(c => {
              const visible = CORE_KEYS.has(c.key) ? !hiddenCols.has(c.key) : shownCols.has(c.key);
              return (
                <label key={c.key} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, padding:'4px 6px', borderRadius:6, cursor:'pointer' }}>
                  <input type="checkbox" checked={visible} onChange={() => toggleCol(c)} style={{ width:'auto', accentColor:AVO }} />
                  {c.label}
                </label>
              );
            })}
            <div style={{ fontSize:9.5, color:'var(--muted)', padding:'6px 6px 2px', lineHeight:1.4 }}>Tip: drag a column header to reorder. Use + Add Column below for a custom field.</div>
          </div>
        </>, document.body)}
      <SmartTable rows={grouped} colDefs={colDefs} config={config} onConfig={onConfig} minWidth={1050} readOnly={readOnly} corner={columnsWheel}
        saveExtra={(id, k, v) => saveEdit(id, { extra: { [k]: v } })}
        onReorder={reorder} footerRight={{ addRow: () => setAddForm({ ...BLANK_DELIVERABLE_FORM }), label: '+ Add Deliverable' }}
        emptyText="No edits with this project code yet — add them from the pipeline and they'll appear here automatically."
        leading={e => (
          <span style={{ display:'inline-flex', gap:3, alignItems:'center' }}>
            <RowColorPencil edit={e} onOpen={() => onOpenEdit ? onOpenEdit(e) : nav(`/avo/${e.id}`)} onPick={c => saveEdit(e.id, { trackerColor: c })} />
            <button title="Duplicate this row" onClick={() => dupeRow(e)}
              style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:5, padding:'2px 6px', fontSize:11, cursor:'pointer' }}>⧉</button>
          </span>
        )} />
      <div style={{ padding:'8px 2px', fontSize:10, color:'var(--muted)' }}>
        Feeds live from the editing pipeline. Title, due date, editor, review link, and status come from each edit; Type, Notes, Video Assets, and any custom columns are editable here.
      </div>
      {addForm && (
        <AvoForm title="Add Deliverable" form={addForm} setForm={setAddForm}
          onSubmit={submitAdd} onCancel={() => setAddForm(null)} saving={savingAdd} />
      )}
    </>
  );
}

// ── Color & Audio contractor tracker (below the Video Tracker) ──
// Each row is a post-production contractor with billing info; costs can be
// held on the project VCC and a contract emailed from info@ for signature.
const CONTRACTOR_META = { color: { label: 'Color', accent: '#c77dff' }, audio: { label: 'Audio', accent: '#35c4c8' } };
const fmt$ = n => (n === null || n === undefined || n === '') ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const BLANK_CONTRACTOR = { name: '', email: '', rate: '', services: '', startDate: '', endDate: '', total: '', invoicePmId: '' };

// Name input with live roster search: picking a person also fills their email
function RosterNameField({ value, roster, onChange, onPick }) {
  const [open, setOpen] = useState(false);
  const q = (value || '').trim().toLowerCase();
  const matches = q.length < 2 ? [] : roster.filter(m => (m.__display || '').toLowerCase().includes(q)).slice(0, 6);
  return (
    <div style={{ position: 'relative' }}>
      <input value={value} required autoFocus placeholder="Start typing a roster name…"
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {matches.map(m => (
            <div key={m.id} onMouseDown={() => { onPick(m); setOpen(false); }}
              style={{ padding: '7px 12px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <b>{m.__display}</b>{m.email && <span style={{ color: 'var(--muted)', fontSize: 10.5 }}> — {m.email}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContractorTracker({ pageId }) {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null);       // { role, ...BLANK_CONTRACTOR }
  const [busy, setBusy] = useState(false);
  const [sendCtr, setSendCtr] = useState(null); // { contract, projectId, total }
  const [roster, setRoster] = useState([]);

  // "Send Final Invoice To" defaults to whoever is adding the contractor
  const myPmId = roster.find(m => (m.email || '').toLowerCase() === (user?.email || '').toLowerCase())?.id || '';

  useEffect(() => { api.avoContractors(pageId).then(setRows).catch(() => setRows([])); }, [pageId]);
  useEffect(() => {
    api.getCrew().then(ms => setRoster((ms || []).map(m => ({
      ...m, __display: [m.preferred_first_name, m.preferred_last_name].filter(Boolean).join(' ') || m.name,
    })))).catch(() => {});
  }, []);

  function openEdit(r) {
    setForm({
      id: r.id, role: r.role, name: r.name || '', email: r.email || '', rate: r.rate || '',
      services: r.services || '', startDate: r.start_date ? String(r.start_date).slice(0, 10) : '',
      endDate: r.end_date ? String(r.end_date).slice(0, 10) : '',
      total: r.total === null || r.total === undefined ? '' : String(r.total),
      invoicePmId: r.invoice_pm_id || '',
    });
  }
  // Persist the form (create or update) and return the saved row
  async function persistForm() {
    if (form.id) {
      const r = await api.updateAvoContractor(form.id, form);
      setRows(rs => rs.map(x => x.id === r.id ? r : x));
      return r;
    }
    const r = await api.addAvoContractor(pageId, form);
    setRows(rs => [...(rs || []), r]);
    return r;
  }
  async function submit(ev) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    try { await persistForm(); setForm(null); }
    catch (e) { alert(e.message); }
    setBusy(false);
  }
  async function remove(r) {
    if (!confirm(`Remove ${CONTRACTOR_META[r.role].label} contractor${r.name ? ` ${r.name}` : ''}?`)) return;
    try { await api.deleteAvoContractor(r.id); setRows(rs => rs.filter(x => x.id !== r.id)); }
    catch (e) { alert(e.message); }
  }
  // Save the form first so the hold/contract reflect what's on screen
  async function holdFromForm() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await persistForm();
      setForm(f => f && { ...f, id: r.id });
      const entry = await api.holdAvoContractorCost(r.id);
      alert(`Held $${Number(entry.amount).toLocaleString('en-US')} on the project's VCC for ${CONTRACTOR_META[r.role].label.toLowerCase()}.`);
    } catch (e) { alert(e.message); }
    setBusy(false);
  }
  async function sendContractFromForm() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await persistForm();
      setForm(f => f && { ...f, id: r.id });
      setSendCtr(await api.avoContractorContract(r.id));
    } catch (e) { alert(e.message); }
    setBusy(false);
  }
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: AVO }}>Color & Audio</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['color', 'audio'].map(role => (
            <button key={role} onClick={() => setForm({ role, ...BLANK_CONTRACTOR, invoicePmId: myPmId })}
              style={{ background: 'transparent', border: `1px solid ${CONTRACTOR_META[role].accent}`, color: CONTRACTOR_META[role].accent, borderRadius: 14, padding: '4px 14px', fontSize: 10.5, fontWeight: 800, cursor: 'pointer' }}>
              + Add {CONTRACTOR_META[role].label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={th}>Role</th><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Rate</th>
              <th style={th}>Services Provided</th><th style={th}>Start</th><th style={th}>End</th>
              <th style={{ ...th, textAlign: 'right' }}>Total Estimate</th>
              <th style={th}>Send Final Invoice To</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {(rows || []).length === 0 && (
              <tr><td colSpan={10} style={{ ...td, padding: '12px 14px', fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
                No color or audio contractors yet — add them with the buttons above.
              </td></tr>
            )}
            {(rows || []).map(r => {
              const meta = CONTRACTOR_META[r.role] || CONTRACTOR_META.color;
              const pm = roster.find(m => m.id === r.invoice_pm_id);
              const cellTxt = { ...td, padding: '9px 10px', fontSize: 12 };
              return (
                <tr key={r.id} onClick={() => openEdit(r)} title="Click to open this contractor's form"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                  <td style={{ ...td, padding: '4px 10px' }}>
                    <span style={{ background: `${meta.accent}22`, border: `1px solid ${meta.accent}`, color: meta.accent, borderRadius: 12, padding: '2px 10px', fontSize: 9.5, fontWeight: 800, whiteSpace: 'nowrap' }}>{meta.label}</span>
                  </td>
                  <td style={{ ...cellTxt, fontWeight: 600, minWidth: 120 }}>{r.name || '—'}</td>
                  <td style={{ ...cellTxt, color: 'var(--muted)', minWidth: 150 }}>{r.email || '—'}</td>
                  <td style={{ ...cellTxt, minWidth: 90 }}>{r.rate || '—'}</td>
                  <td style={{ ...cellTxt, minWidth: 160 }}>{r.services || '—'}</td>
                  <td style={{ ...cellTxt, whiteSpace: 'nowrap' }}>{r.start_date ? fmtD(r.start_date) : '—'}</td>
                  <td style={{ ...cellTxt, whiteSpace: 'nowrap' }}>{r.end_date ? fmtD(r.end_date) : '—'}</td>
                  <td style={{ ...cellTxt, textAlign: 'right', color: '#5ABF80', fontWeight: 700, whiteSpace: 'nowrap' }}>{r.total === null || r.total === undefined ? '—' : fmt$(r.total)}</td>
                  <td style={{ ...cellTxt, minWidth: 130 }}>{pm ? pm.__display : '—'}</td>
                  <td style={{ ...td, padding: '4px 10px' }}>
                    <button onClick={ev => { ev.stopPropagation(); remove(r); }} title="Remove"
                      style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {form && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setForm(null)}>
          <div className="modal">
            <div className="modal-title">{form.id ? '' : 'Add '}{CONTRACTOR_META[form.role].label} Contractor</div>
            <form onSubmit={submit}>
              <div className="form-grid cols1" style={{ marginBottom: 12 }}>
                <div className="field"><label>Name *</label>
                  <RosterNameField value={form.name} roster={roster}
                    onChange={v => setForm(f => ({ ...f, name: v }))}
                    onPick={m => setForm(f => ({ ...f, name: m.__display, email: m.email || f.email }))} /></div>
                <div className="field"><label>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="field"><label>Rate</label>
                  <input value={form.rate} placeholder="$550/day, $95/hr…" onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} /></div>
                <div className="field"><label>Services Provided</label>
                  <input value={form.services} placeholder="Color grade all deliverables…" onChange={e => setForm(f => ({ ...f, services: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="field" style={{ flex: 1 }}><label>Start Date</label>
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
                  <div className="field" style={{ flex: 1 }}><label>End Date</label>
                    <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
                </div>
                <div className="field"><label>Total Estimate ($)</label>
                  <input value={form.total} placeholder="1200" onChange={e => setForm(f => ({ ...f, total: e.target.value.replace(/[^0-9.]/g, '') }))} /></div>
                <div className="field"><label>Send Final Invoice To</label>
                  <EditorSelect value={form.invoicePmId} unbridledOnly placeholder="— Pick a project manager —" onChange={v => setForm(f => ({ ...f, invoicePmId: v }))} /></div>
              </div>
              <div className="btn-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save' : `Add ${CONTRACTOR_META[form.role].label}`}</button>
                <button type="button" disabled={busy || !(Number(form.total) > 0)} onClick={holdFromForm}
                  title={Number(form.total) > 0 ? 'Save and post this cost to the project VCC as a hold' : 'Enter a total estimate first'}
                  style={{ background: 'rgba(90,191,128,0.12)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: (busy || !(Number(form.total) > 0)) ? 0.5 : 1 }}>
                  Hold Cost → VCC
                </button>
                <button type="button" disabled={busy} onClick={sendContractFromForm}
                  title="Save, then preview the contract email and send it from info@ for review & signature"
                  style={{ background: `${CONTRACTOR_META[form.role].accent}18`, border: `1px solid ${CONTRACTOR_META[form.role].accent}`, color: CONTRACTOR_META[form.role].accent, borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
                  Send Contract
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {sendCtr && (
        <ContractSendModal projectId={sendCtr.projectId} contract={sendCtr.contract} total={sendCtr.total}
          onClose={() => setSendCtr(null)} onSent={to => alert(`Contract sent to ${to}.`)} />
      )}
    </div>
  );
}

// ── Generic editable grid (to-dos, lower thirds) ──
function Grid({ kind, columns, rows, setRows, pageId, doneKey, renderCell, config, onConfig, readOnly, A = api }) {
  async function addRow() {
    try { const r = await A.addAvoGridRow(pageId, kind); setRows(rs => [...rs, r]); }
    catch (e) { alert(e.message); }
  }
  async function saveCell(rowId, col, val) {
    try { const r = await A.updateAvoGridRow(kind, rowId, { [col]: val }); setRows(rs => rs.map(x => x.id === rowId ? r : x)); }
    catch (e) { alert(e.message); }
  }
  async function removeRow(rowId) {
    try { await A.deleteAvoGridRow(kind, rowId); setRows(rs => rs.filter(x => x.id !== rowId)); }
    catch (e) { alert(e.message); }
  }
  const colDefs = columns.map(([c, label, placeholder]) => ({
    key: c, label, expandable: true,
    render: (r, expanded) => renderCell?.(r, c, v => saveCell(r.id, c, v), readOnly, expanded) || <Cell value={r[c]} placeholder={placeholder} readOnly={readOnly} multiline={expanded} onSave={v => saveCell(r.id, c, v)} />,
  }));
  const shown = doneKey ? rows.map(r => r[doneKey] ? { ...r, __dim: true } : r) : rows;
  function reorder(next) {
    setRows(next.map(({ __dim, ...r }) => r));
    next.forEach((r, i) => A.updateAvoGridRow(kind, r.id, { sort: i }).catch(() => {}));
  }
  return (
    <SmartTable rows={shown} colDefs={colDefs} config={config} onConfig={onConfig} readOnly={readOnly}
      saveExtra={(id, k, v) => A.updateAvoGridRow(kind, id, { extra: { [k]: v } }).then(r => setRows(rs => rs.map(x => x.id === id ? r : x))).catch(e => alert(e.message))}
      footerRight={{ addRow }} onReorder={reorder}
      leading={doneKey ? r => (
        <input type="checkbox" checked={r[doneKey] || false} disabled={readOnly} style={{ width:'auto', accentColor:AVO }}
          onChange={e => saveCell(r.id, doneKey, e.target.checked)} />
      ) : undefined}
      trailing={readOnly ? undefined : r => (
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

function MusicGrid({ rows, setRows, pageId, code, title, config, onConfig, edits = [], setEdits, readOnly, A = api }) {
  const [share, setShare] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [dragColKey, setDragColKey] = useState(null);
  const [openFilter, setOpenFilter] = useState(null);
  const [filters, setFilters] = useState({});
  const [liveWidths, setLiveWidths] = useState({});   // in-progress widths while dragging
  const resizeRef = useRef(null);
  const customCols = config?.cols || [];
  const filterActive = ['category', 'url', 'note', ...customCols.map(c => c.key)].some(k => (filters[k] || '').trim());
  const filterKeys = ['category', 'url', 'note', ...customCols.map(c => c.key)];
  // Column-level expand (wrap all cells) + per-cell collapse overrides + widths.
  // Parent's onConfig merges into the saved music config, so pass just the delta.
  const expandedCols = new Set(config?.expandedCols || []);
  const collapsedCells = new Set(config?.collapsedCells || []);
  const widths = config?.widths || {};
  const colWidth = k => liveWidths[k] ?? widths[k] ?? undefined;
  const toggleColExpand = key => { const s = new Set(expandedCols); s.has(key) ? s.delete(key) : s.add(key); onConfig({ expandedCols: [...s] }); };
  const toggleCellCollapse = wid => { const s = new Set(collapsedCells); s.has(wid) ? s.delete(wid) : s.add(wid); onConfig({ collapsedCells: [...s] }); };
  const cellExpanded = (colKey, rowId) => expandedCols.has(colKey) && !collapsedCells.has(`${rowId}|${colKey}`);
  useEffect(() => {
    function move(e) {
      if (!resizeRef.current) return;
      const { key, startX, startW } = resizeRef.current;
      setLiveWidths(lw => ({ ...lw, [key]: Math.max(60, startW + (e.clientX - startX)) }));
    }
    function up() {
      const r = resizeRef.current; if (!r) return; resizeRef.current = null;
      setLiveWidths(lw => {
        if (lw[r.key] != null) onConfig({ widths: { ...widths, [r.key]: Math.round(lw[r.key]) } });
        const { [r.key]: _drop, ...rest } = lw; return rest;
      });
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [config]);
  // Small reusable header controls: expand-all toggle (for wrappable text cols)
  // + a drag handle on the right edge to resize the column.
  const colExpandBtn = (key) => !readOnly && (
    <button title={expandedCols.has(key) ? 'Collapse all cells in this column' : 'Expand all cells in this column'} draggable={false}
      onClick={e => { e.stopPropagation(); toggleColExpand(key); }}
      style={{ background:'none', border:'none', cursor:'pointer', padding:'0 3px', fontSize:10, color: expandedCols.has(key) ? AVO : 'var(--muted)' }}>{expandedCols.has(key) ? '▤' : '⤢'}</button>
  );
  const colResizeHandle = (key) => !readOnly && (
    <span className="tbl-col-grip" title="Drag to adjust column width" draggable={false}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); const thEl = e.currentTarget.closest('th'); resizeRef.current = { key, startX: e.clientX, startW: thEl ? thEl.getBoundingClientRect().width : 120 }; }}
      onClick={e => e.stopPropagation()} />
  );
  // Per-cell collapse toggle shown in a cell's corner while its column is expanded.
  const cellCollapseBtn = (colKey, rowId) => !readOnly && expandedCols.has(colKey) && (
    <button title={cellExpanded(colKey, rowId) ? 'Collapse this cell' : 'Expand this cell'}
      onClick={ev => { ev.stopPropagation(); toggleCellCollapse(`${rowId}|${colKey}`); }}
      style={{ position:'absolute', top:2, right:2, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:4, color:'var(--muted)', cursor:'pointer', fontSize:9, lineHeight:1, padding:'1px 3px', opacity:0.85 }}>{cellExpanded(colKey, rowId) ? '▴' : '⤢'}</button>
  );
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
    next.forEach((r, i) => A.updateAvoGridRow('music', r.id, { sort: i }).catch(() => {}));
  }
  function dropColOn(targetKey) {
    if (!dragColKey || dragColKey === targetKey) return;
    const next = customCols.filter(c => c.key !== dragColKey);
    next.splice(next.findIndex(c => c.key === targetKey), 0, customCols.find(c => c.key === dragColKey));
    onConfig({ cols: next });
  }
  async function addRow(category) {
    try {
      let r = await A.addAvoGridRow(pageId, 'music');
      if (category) r = await A.updateAvoGridRow('music', r.id, { category });
      setRows(rs => [...rs, r]);
    }
    catch (e) { alert(e.message); }
  }
  // Fill the matching video edit's "Music Ref" with a chosen song link
  async function selectSong(videoTitle, url) {
    const ed = edits.find(e => (e.title || '').trim().toLowerCase() === (videoTitle || '').trim().toLowerCase());
    if (!ed) { alert('No matching video in the Project Video Tracker for this title.'); return; }
    try {
      const full = await A.updateAvoEdit(ed.id, { musicRef: url });
      setEdits && setEdits(es => es.map(x => x.id === ed.id ? { ...x, ...full } : x));
    } catch (e) { alert(e.message); }
  }
  async function saveCell(rowId, col, val) {
    try { const r = await A.updateAvoGridRow('music', rowId, { [col]: val }); setRows(rs => rs.map(x => x.id === rowId ? r : x)); }
    catch (e) { alert(e.message); }
  }
  async function saveExtra(rowId, key, val) {
    try { const r = await A.updateAvoGridRow('music', rowId, { extra: { [key]: val } }); setRows(rs => rs.map(x => x.id === rowId ? r : x)); }
    catch (e) { alert(e.message); }
  }
  async function removeRow(rowId) {
    try { await A.deleteAvoGridRow('music', rowId); setRows(rs => rs.filter(x => x.id !== rowId)); }
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
  const filterWidget = (k, label) => (
    <>
      <button title="Filter by this column" draggable={false}
        onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setOpenFilter(o => o?.key === k ? null : { key: k, x: r.left, y: r.bottom }); }}
        style={{ background:'none', border:'none', cursor:'pointer', padding:'0 3px', fontSize:9,
          color: (filters[k] || '').trim() ? AVO : 'var(--muted)', opacity: (filters[k] || '').trim() ? 1 : 0.7 }}>⧩</button>
      {openFilter?.key === k && (
        <div onClick={e => e.stopPropagation()}
          style={{ position:'fixed', top:openFilter.y + 4, left:Math.min(openFilter.x, window.innerWidth - 180), zIndex:130, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:7, padding:8, boxShadow:'0 8px 20px rgba(0,0,0,0.5)', minWidth:150 }}>
          <div style={{ fontSize:8, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Filter by {label}</div>
          <input autoFocus value={filters[k] || ''} placeholder="Contains…"
            onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && setOpenFilter(null)}
            style={{ width:'100%', fontSize:11, padding:'4px 8px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:5, color:'var(--text)' }} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6 }}>
            <button onClick={() => { setFilters(f => ({ ...f, [k]: '' })); setOpenFilter(null); }}
              style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:0 }}>Clear</button>
            <button onClick={() => setOpenFilter(null)}
              style={{ background:'none', border:'none', color:AVO, fontSize:9, fontWeight:800, cursor:'pointer', padding:0 }}>Done</button>
          </div>
        </div>
      )}
    </>
  );

  // Rows sharing a video title collapse into one group (title cell spans them)
  const groups = [];
  {
    const seen = {};
    for (const r of shownRows) {
      const key = (r.category || '').trim().toLowerCase();
      if (key && seen[key] !== undefined) groups[seen[key]][1].push(r);
      else { if (key) seen[key] = groups.length; groups.push([r.category || '', [r]]); }
    }
    // Every video deliverable in the Project Video Tracker gets a group here,
    // even before any song options are added (empty group → title bubble + "+")
    if (!filterActive) {
      for (const e of edits) {
        const t = (e.title || '').trim();
        if (!t) continue;
        const key = t.toLowerCase();
        if (seen[key] === undefined) { seen[key] = groups.length; groups.push([t, []]); }
      }
    }
  }
  const musicRefOf = video => {
    const ed = edits.find(e => (e.title || '').trim().toLowerCase() === (video || '').trim().toLowerCase());
    return ed ? (ed.music_ref || '') : null;   // null = no matching video
  };
  const shareGroups = groups.filter(([, rs]) => rs.some(r => r.url));
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
      <div className="budget-tbl-wrap">
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, position:'relative', width:colWidth('category'), maxWidth:colWidth('category') }}>Video Title{filterWidget('category', 'Video Title')}{colResizeHandle('category')}</th>
              <th style={{ ...th, width:60, textAlign:'center' }}>Select</th>
              <th style={{ ...th, position:'relative', width:colWidth('url'), maxWidth:colWidth('url') }}>Link{colExpandBtn('url')}{filterWidget('url', 'Link')}{colResizeHandle('url')}</th>
              <th style={{ ...th, position:'relative', width:colWidth('note'), maxWidth:colWidth('note') }}>Note{colExpandBtn('note')}{filterWidget('note', 'Note')}{colResizeHandle('note')}</th>
              {customCols.map(c => (
                <th key={c.key} draggable={!readOnly} title={readOnly ? undefined : 'Drag to reorder column'}
                  onDragStart={() => setDragColKey(c.key)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => { dropColOn(c.key); setDragColKey(null); }}
                  onDragEnd={() => setDragColKey(null)}
                  style={{ ...th, cursor: readOnly ? 'default' : 'grab', position:'relative', width:colWidth(c.key), maxWidth:colWidth(c.key), opacity: dragColKey === c.key ? 0.5 : 1 }}>
                  {c.label}
                  {colExpandBtn(c.key)}
                  {filterWidget(c.key, c.label)}
                  {!readOnly && (
                    <span style={{ marginLeft:5, whiteSpace:'nowrap' }}>
                      <button title="Rename column" onClick={() => renameColumn(c)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:'0 2px' }}>✎</button>
                      <button title="Remove column" onClick={() => removeColumn(c)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:9, cursor:'pointer', padding:'0 2px' }}>✕</button>
                    </span>
                  )}
                  {colResizeHandle(c.key)}
                </th>
              ))}
              <th style={{ ...th, width:34 }}></th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={5 + customCols.length} style={{ ...td, padding:'12px 14px', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Nothing here yet.</td></tr>
            )}
            {groups.map(([video, grp]) => {
              const rowsForVideo = grp.length ? grp : [null];   // videos with no songs yet still show a row
              const mref = musicRefOf(video);                   // null = title not in the Video Tracker
              return rowsForVideo.map((r, j) => (
              <tr key={r ? r.id : 'empty-' + video}
                onDragOver={r && dragId ? e => { e.preventDefault(); setOverId(r.id); } : undefined}
                onDrop={r && dragId ? () => { dropRowOn(r.id); setDragId(null); setOverId(null); } : undefined}
                style={{ borderTop: r && overId === r.id && dragId && dragId !== r.id ? `2px solid ${AVO}` : j === 0 ? '1px solid rgba(255,255,255,0.08)' : 'none', opacity: r && dragId === r.id ? 0.4 : 1 }}>
                {j === 0 && (
                  <td rowSpan={rowsForVideo.length} style={{ ...td, minWidth:170, width:colWidth('category'), maxWidth:colWidth('category'), borderRight:'1px solid rgba(255,255,255,0.05)', verticalAlign:'top', paddingTop:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{ flex:1 }}>
                        <Cell value={r ? r.category : video} placeholder="Video title…" readOnly={readOnly} onSave={v => r ? saveCell(r.id, 'category', v) : addRow(v)}
                          style={video ? { background:`${typeColor(video)}22`, border:`1px solid ${typeColor(video)}55`, color:typeColor(video), fontWeight:700, textAlign:'center', borderRadius:12 } : {}} />
                      </div>
                      {!readOnly && <button title="Add a song option for this video" onClick={() => addRow(video)}
                        style={{ background:'none', border:`1px solid ${typeColor(video)}77`, color:typeColor(video), borderRadius:'50%', width:20, height:20, lineHeight:'16px', fontSize:14, fontWeight:800, cursor:'pointer', flexShrink:0, padding:0 }}>+</button>}
                    </div>
                    {grp.length > 1 && <div style={{ fontSize:9, color:'var(--muted)', textAlign:'center', marginTop:3 }}>{grp.length} options</div>}
                  </td>
                )}
                <td style={{ ...td, width:60, textAlign:'center' }}>
                  {r && (mref !== null && mref && r.url && mref === r.url
                    ? <span title="This song fills the video's Music Ref" style={{ color:AVO, fontSize:14 }}>✓</span>
                    : readOnly ? null
                    : mref === null
                      ? <span title="No matching video in the Project Video Tracker" style={{ color:'var(--muted)', fontSize:10 }}>—</span>
                      : <button title="Set this song as the video's Music Ref" onClick={() => selectSong(video, r.url)} disabled={!r.url}
                          style={{ background:'rgba(90,191,128,0.12)', border:`1px solid ${AVO}`, color:AVO, borderRadius:10, padding:'2px 9px', fontSize:9, fontWeight:800, cursor: r.url ? 'pointer' : 'default', opacity: r.url ? 1 : 0.4 }}>Select</button>)}
                </td>
                {r ? (
                <>
                <td style={{ ...td, minWidth:260, width:colWidth('url'), maxWidth:colWidth('url'), position:'relative' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <Cell value={r.url} placeholder="https://…" readOnly={readOnly} multiline={cellExpanded('url', r.id)} onSave={v => saveCell(r.id, 'url', v)} style={{ color:'#4a9eff' }} />
                    {r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ color:'#4a9eff', fontSize:11, textDecoration:'none', flexShrink:0 }}>▶</a>}
                  </div>
                  {cellCollapseBtn('url', r.id)}
                </td>
                <td style={{ ...td, minWidth:130, width:colWidth('note'), maxWidth:colWidth('note'), position:'relative' }}>
                  <Cell value={r.note} placeholder="instrumental version…" readOnly={readOnly} multiline={cellExpanded('note', r.id)} onSave={v => saveCell(r.id, 'note', v)} />
                  {cellCollapseBtn('note', r.id)}
                </td>
                {customCols.map(c => (
                  <td key={c.key} style={{ ...td, minWidth:110, width:colWidth(c.key), maxWidth:colWidth(c.key), position:'relative' }}>
                    <Cell value={r.extra?.[c.key]} placeholder="…" readOnly={readOnly} multiline={cellExpanded(c.key, r.id)} onSave={v => saveExtra(r.id, c.key, v)} />
                    {cellCollapseBtn(c.key, r.id)}
                  </td>
                ))}
                <td style={{ ...td, textAlign:'center', whiteSpace:'nowrap' }}>
                  {!readOnly && <>
                    <span draggable title="Drag to reorder row"
                      onDragStart={() => setDragId(r.id)}
                      onDragEnd={() => { setDragId(null); setOverId(null); }}
                      style={{ cursor:'grab', color:'var(--muted)', fontSize:11, userSelect:'none', padding:'2px 3px' }}>⠿</span>
                    <button title="Delete row" onClick={() => removeRow(r.id)}
                      style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
                  </>}
                </td>
                </>
                ) : (
                <td colSpan={2 + customCols.length + 1} style={{ ...td, fontSize:10, color:'var(--muted)', fontStyle:'italic' }}>No song options yet — click + to add one.</td>
                )}
              </tr>
            ));
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding:'8px 14px', borderTop:'1px solid var(--border)', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        {!readOnly && <button onClick={() => addRow()} style={pillBtn(AVO)}>+ Add Row</button>}
        {!readOnly && <button onClick={addColumn} style={pillBtn('#a78bfa')}>+ Add Column</button>}
        {filterActive && <button onClick={() => { setFilters({}); setOpenFilter(null); }} style={pillBtn()}>✕ Clear Filters</button>}
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
function CustomTable({ table, onChange, onDelete, readOnly, A = api }) {
  const rows = table.rows || [];
  const setRows = fn => onChange({ ...table, rows: typeof fn === 'function' ? fn(rows) : fn });
  async function addRow() {
    try { const r = await A.addAvoTableRow(table.id); setRows([...rows, r]); }
    catch (e) { alert(e.message); }
  }
  function reorder(next) {
    setRows(next);
    next.forEach((r, i) => A.updateAvoTableRow(r.id, { sort: i }).catch(() => {}));
  }
  function saveConfig(next) {
    onChange({ ...table, config: next });
    A.updateAvoTable(table.id, { config: next }).catch(e => alert(e.message));
  }
  async function rename() {
    const name = prompt('Rename table:', table.name);
    if (!name || !name.trim()) return;
    onChange({ ...table, name: name.trim() });
    A.updateAvoTable(table.id, { name: name.trim() }).catch(e => alert(e.message));
  }
  return (
    <>
      <SmartTable rows={rows} colDefs={[]} config={table.config || {}} onConfig={saveConfig} readOnly={readOnly}
        saveExtra={(id, k, v) => A.updateAvoTableRow(id, { extra: { [k]: v } })
          .then(r => setRows(rows.map(x => x.id === id ? r : x))).catch(e => alert(e.message))}
        footerRight={{ addRow }} onReorder={reorder}
        emptyText="Empty table — add rows and columns to build it out."
        trailing={readOnly ? undefined : r => (
          <button title="Delete row" onClick={async () => {
            try { await A.deleteAvoTableRow(r.id); setRows(rows.filter(x => x.id !== r.id)); }
            catch (e) { alert(e.message); }
          }} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
        )} />
      {!readOnly && (
        <div style={{ display:'flex', gap:10, padding:'8px 2px' }}>
          <button onClick={rename} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:10, cursor:'pointer', padding:0 }}>✎ Rename Table</button>
          <button onClick={onDelete} style={{ background:'none', border:'none', color:'var(--red-text, #e05252)', fontSize:10, cursor:'pointer', padding:0 }}>✕ Delete Table</button>
        </div>
      )}
    </>
  );
}

// ── Creative assets: drop photos / motion gfx on the page, tag them to a video ──
const fileSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB';
const fileIcon = m => (m || '').startsWith('image/') ? '🖼' : (m || '').startsWith('video/') ? '🎞' : (m || '').startsWith('audio/') ? '🎵' : '📄';

// A collapsible folder card with drag-and-drop upload and a file list. Used for
// both custom general-file folders and the per-edit folders on the Files tab.
function FileFolder({ title, subtitle, accent = AVO, files, onUpload, onDownload, onDelete, onRename, onRemoveFolder, readOnly, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const dragDepth = useRef(0);   // dragenter/leave bubble on children — count to stay stable
  const onlyFiles = ev => Array.from(ev.dataTransfer?.types || []).includes('Files');
  const enter = ev => { if (readOnly || !onlyFiles(ev)) return; ev.preventDefault(); dragDepth.current += 1; setDragging(true); setOpen(true); };
  const over = ev => { if (readOnly || !onlyFiles(ev)) return; ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; };
  const leave = ev => { if (readOnly) return; ev.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (dragDepth.current === 0) setDragging(false); };
  const drop = ev => { ev.preventDefault(); dragDepth.current = 0; setDragging(false); if (readOnly) return; Array.from(ev.dataTransfer?.files || []).forEach(onUpload); };
  return (
    <div onDragEnter={enter} onDragOver={over} onDragLeave={leave} onDrop={drop}
      style={{ position:'relative', background:'var(--bg2)', border:`1px solid ${dragging ? accent : 'var(--border)'}`, borderLeft:`3px solid ${accent}`, borderRadius:10, marginBottom:8, overflow:'hidden', boxShadow: dragging ? `0 0 0 2px ${accent}55 inset` : 'none' }}>
      {dragging && (
        <div style={{ position:'absolute', inset:0, zIndex:5, background:`${accent}18`, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <span style={{ fontSize:12, fontWeight:800, color:accent, background:'var(--bg2)', border:`1px dashed ${accent}`, borderRadius:8, padding:'6px 14px' }}>Drop to upload to “{title}”</span>
        </div>
      )}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer' }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize:11, color:'var(--muted)', width:10 }}>{open ? '▾' : '▸'}</span>
        <span style={{ fontSize:14 }}>📁</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12.5, fontWeight:800, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
          {subtitle && <div style={{ fontSize:9.5, color:'var(--muted)' }}>{subtitle}</div>}
        </div>
        <span style={{ fontSize:10, color:'var(--muted)', whiteSpace:'nowrap' }}>{files.length} file{files.length === 1 ? '' : 's'}</span>
        {!readOnly && (
          <span style={{ display:'inline-flex', gap:4 }} onClick={ev => ev.stopPropagation()}>
            <button className="btn btn-ghost btn-sm" title="Upload into this folder" onClick={() => inputRef.current?.click()}>＋</button>
            {onRename && <button className="btn btn-ghost btn-sm" title="Rename folder" onClick={onRename}>✎</button>}
            {onRemoveFolder && <button className="btn btn-ghost btn-sm" title="Delete folder" style={{ color:'var(--red-text, #e05252)' }} onClick={onRemoveFolder}>✕</button>}
            <input ref={inputRef} type="file" multiple style={{ display:'none' }} onChange={ev => { Array.from(ev.target.files || []).forEach(onUpload); ev.target.value = ''; }} />
          </span>
        )}
      </div>
      {open && (
        <div style={{ padding:'2px 14px 12px 34px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
          {files.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', padding:'8px 0' }}>{readOnly ? 'No files.' : 'Empty — drop files here or use ＋.'}</div>}
          {files.map(f => (
            <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span style={{ fontSize:15 }}>{fileIcon(f.mime)}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div onClick={() => onDownload(f)} style={{ fontSize:12, fontWeight:600, color:'#4a9eff', cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.filename}</div>
                <div style={{ fontSize:9.5, color:'var(--muted)' }}>{fileSize(f.size)} · {f.uploaded_by || 'unknown'} · {new Date(f.created_at).toLocaleDateString()}</div>
              </div>
              <button className="btn btn-ghost btn-sm" title="Download" onClick={() => onDownload(f)}>⬇</button>
              {!readOnly && <button className="btn btn-ghost btn-sm" title="Delete" style={{ color:'var(--red-text, #e05252)' }} onClick={() => onDelete(f)}>✕</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// The Files tab: general custom folders (top) + one auto folder per edit (below,
// mirroring each edit's Uploads section on its edit card).
function FilesTab({ pageId, assets, setAssets, folders, setFolders, edits, editFiles, setEditFiles, readOnly, A = api }) {
  const readFile = (file, cb) => {
    if (file.size > 20 * 1024 * 1024) return alert(`${file.name}: file too large (20MB max)`);
    const reader = new FileReader();
    reader.onload = () => cb({ filename: file.name, mime: file.type, fileBase64: String(reader.result).split(',')[1] });
    reader.readAsDataURL(file);
  };
  const dlAuth = async (url, name) => {
    try {
      const t = localStorage.getItem('fp_token');
      const r = await fetch(url, t ? { headers: { Authorization: `Bearer ${t}` } } : undefined);
      if (!r.ok) throw new Error('Download failed');
      const blob = await r.blob(); const el = document.createElement('a');
      el.href = URL.createObjectURL(blob); el.download = name; el.click(); URL.revokeObjectURL(el.href);
    } catch (e) { alert(e.message); }
  };
  // General files (avo_assets) grouped by folder
  const uploadAsset = (folderId) => (file) => readFile(file, async d => {
    try { const a = await A.uploadAvoAsset(pageId, { ...d, editIds: [], folderId }); setAssets(as => [a, ...as]); } catch (e) { alert(e.message); }
  });
  const delAsset = async f => { if (!confirm(`Delete ${f.filename}?`)) return; try { await A.deleteAvoAsset(f.id); setAssets(as => as.filter(x => x.id !== f.id)); } catch (e) { alert(e.message); } };
  const dlAsset = f => dlAuth(A.assetFileUrl ? A.assetFileUrl(f.id) : `/api/avo/assets/${f.id}/file`, f.filename);
  // Per-edit files (edit_files) — mirror the edit card Uploads
  const uploadEditFile = (editId) => (file) => readFile(file, async d => {
    try { const f = await A.avoUploadFile(editId, d); setEditFiles(fs => [...fs, { ...f, edit_id: editId }]); } catch (e) { alert(e.message); }
  });
  const delEditFile = async f => { if (!confirm(`Delete ${f.filename}?`)) return; try { await A.avoDeleteFile(f.id); setEditFiles(fs => fs.filter(x => x.id !== f.id)); } catch (e) { alert(e.message); } };
  const dlEditFile = f => dlAuth(`/api/avo/files/${f.id}`, f.filename);

  async function newFolder() {
    const name = prompt('New folder name:'); if (!name || !name.trim()) return;
    try { const f = await A.avoCreateFolder(pageId, name.trim()); setFolders(fs => [...fs, f]); } catch (e) { alert(e.message); }
  }
  const renameFolder = f => async () => { const name = prompt('Rename folder:', f.name); if (!name || !name.trim()) return; try { const u = await A.avoRenameFolder(f.id, name.trim()); setFolders(fs => fs.map(x => x.id === f.id ? u : x)); } catch (e) { alert(e.message); } };
  const removeFolder = f => async () => { if (!confirm(`Delete folder "${f.name}"? Its files move to Ungrouped.`)) return; try { await A.avoDeleteFolder(f.id); setFolders(fs => fs.filter(x => x.id !== f.id)); setAssets(as => as.map(a => a.folder_id === f.id ? { ...a, folder_id: null } : a)); } catch (e) { alert(e.message); } };

  const inFolder = fid => assets.filter(a => (a.folder_id || null) === fid);
  const ungrouped = inFolder(null);
  const secHdr = { fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:AVO };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
      {/* ── General files: custom folders ── */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={secHdr}>General Files</div>
          <span style={{ fontSize:10, color:'var(--muted)' }}>Custom folders for anything not tied to a single edit</span>
          <div style={{ flex:1 }} />
          {!readOnly && <button className="btn btn-ghost btn-sm" onClick={newFolder}>＋ New Folder</button>}
        </div>
        {folders.length === 0 && ungrouped.length === 0 && (
          <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', padding:'16px 0', textAlign:'center', border:'1px dashed var(--border)', borderRadius:10 }}>
            No general files yet{readOnly ? '.' : ' — create a folder to start organizing shared files.'}
          </div>
        )}
        {folders.map(f => (
          <FileFolder key={f.id} title={f.name} accent="#a78bfa" files={inFolder(f.id)}
            onUpload={uploadAsset(f.id)} onDownload={dlAsset} onDelete={delAsset}
            onRename={renameFolder(f)} onRemoveFolder={removeFolder(f)} readOnly={readOnly} />
        ))}
        {ungrouped.length > 0 && (
          <FileFolder title="Ungrouped" subtitle="Files not in a folder" accent="#8a8f98" files={ungrouped}
            onUpload={uploadAsset(null)} onDownload={dlAsset} onDelete={delAsset} readOnly={readOnly} />
        )}
      </div>

      {/* ── Per-edit folders (auto, one per edit) — mirror each edit's Uploads ── */}
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
          <div style={secHdr}>Edit Files</div>
          <span style={{ fontSize:10, color:'var(--muted)' }}>One folder per edit — mirrors the Uploads on each edit card</span>
        </div>
        {edits.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No edits on this project yet.</div>}
        {edits.map(e => (
          <FileFolder key={e.id} title={e.title || 'Untitled'} subtitle={e.tracker_type || ''} accent={AVO}
            files={editFiles.filter(f => f.edit_id === e.id)}
            onUpload={uploadEditFile(e.id)} onDownload={dlEditFile} onDelete={delEditFile} readOnly={readOnly} />
        ))}
      </div>
    </div>
  );
}

// Share the page as a read-only Client/Crew link, with an optional password.
function AvoShareModal({ page, url, onEnable, onDisable, onClose }) {
  const shared = !!page.share_token;
  const [pw, setPw] = useState(page.share_password || '');
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {}); };
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:520, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${AVO}`, borderRadius:12, padding:'18px 22px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontSize:15, fontWeight:800 }}>Share — Client / Crew View</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, marginBottom:14 }}>
          An editable view of this project — clients and crew can update the video tracker, edit cards, creative assets, music, lower thirds, and to-dos. Editor contract details, financials, and page controls stay hidden. Add a password to gate it, or leave it open.
        </div>
        {shared ? (
          <>
            <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Shareable link</label>
            <div style={{ display:'flex', gap:8, margin:'4px 0 14px' }}>
              <input readOnly value={url} onFocus={e => e.target.select()} style={{ flex:1, fontSize:12 }} />
              <button className="btn btn-primary btn-sm" onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
            </div>
            <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Password (optional)</label>
            <div style={{ display:'flex', gap:8, margin:'4px 0 4px' }}>
              <input value={pw} placeholder="No password" onChange={e => setPw(e.target.value)} style={{ flex:1, fontSize:12 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => onEnable(pw.trim())}>Save</button>
            </div>
            <div style={{ fontSize:10, color:'var(--muted)', marginBottom:16 }}>{page.share_password ? 'Viewers must enter this password.' : 'Anyone with the link can view.'}</div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              <button onClick={onDisable} style={{ background:'none', border:'1px solid var(--red-text, #e05252)', color:'var(--red-text, #e05252)', borderRadius:8, padding:'6px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>Turn off sharing</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <>
            <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Password (optional)</label>
            <input value={pw} placeholder="Leave blank for no password" onChange={e => setPw(e.target.value)} style={{ width:'100%', fontSize:12, margin:'4px 0 14px' }} />
            <button className="btn btn-primary" onClick={() => onEnable(pw.trim())}>Create shareable link</button>
          </>
        )}
      </div>
    </div>
  );
}

// Editable detail of one edit for the client/crew view (no Contract Editor
// card, no financials). Saves through the caller's api adapter so it works on
// both the internal preview and the public share link. Mirrors the producer
// edit card: header row of Category/Type/Status, version stepper, RFR/Sent,
// a collapsible timeline, and the activity log on the right.
function EditModal({ edit, statusOf, onSave, onClose, A = api, customCols = [] }) {
  const [e, setE] = useState(edit);
  const [activity, setActivity] = useState([]);
  const [tlOpen, setTlOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [rfrOpen, setRfrOpen] = useState(false);
  // Pull the full detail + activity when the card opens.
  useEffect(() => {
    A.avoEdit(edit.id).then(full => { setE(prev => ({ ...prev, ...full })); setActivity(full.activity || []); }).catch(() => {});
  }, [edit.id]);
  const parseMs = v => typeof v === 'string' ? JSON.parse(v || '{}') : (v || {});
  const ms = parseMs(e.milestones);
  const skips = Array.isArray(e.milestone_skips) ? e.milestone_skips : (typeof e.milestone_skips === 'string' ? JSON.parse(e.milestone_skips || '[]') : []);
  const save = async patch => {
    try { const full = await onSave(e.id, patch); if (full) setE(prev => ({ ...prev, ...full })); }
    catch (err) { alert(err.message); }
  };
  const act = async fn => { setBusy(true); try { setActivity(await fn()); } catch (err) { alert(err.message); } setBusy(false); };
  const addComment = async () => {
    if (!comment.trim()) return;
    try { const r = await A.avoComment(e.id, comment.trim()); setActivity(Array.isArray(r) ? r : r.activity); setComment(''); } catch (err) { alert(err.message); }
  };
  const delComment = async a => {
    if (!confirm('Delete this comment?')) return;
    try { setActivity(await A.deleteAvoComment(e.id, a.id)); } catch (err) { alert(err.message); }
  };
  const cc = catColor(e.category);
  const iso = d => d ? String(d).slice(0, 10) : '';
  const usedCats = [...new Set([...CATEGORIES, e.category].filter(Boolean))];
  const labelCss = { width:110, color:'var(--muted)', flexShrink:0, fontSize:12 };
  const inp = { fontSize:12, flex:1 };
  const hdr = { fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, fontWeight:700 };
  const TEXT_ROWS = [
    ['aspect_ratio', 'aspectRatio', 'Aspect Ratio'], ['resolution', 'resolution', 'Resolution'], ['frame_rate', 'frameRate', 'Frame Rate'],
    ['drive', 'drive', 'Drive'], ['asset_ref', 'assetRef', 'Asset Ref'], ['music_ref', 'musicRef', 'Music Ref'],
  ];
  const tlRows = MILESTONES.filter(([k]) => !skips.includes(k));
  const setTL = MILESTONES.filter(([k]) => ms[k] && !skips.includes(k)).length;
  const fmtWhen = d => { try { return new Date(d).toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ', ' + new Date(d).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }); } catch { return ''; } };
  const actBtn = (label, color, fn) => (
    <button disabled={busy} onClick={() => act(fn)}
      style={{ background:`${color}1f`, border:`1px solid ${color}`, color, borderRadius:20, padding:'5px 12px', fontSize:10.5, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>{label}</button>
  );
  return (
    <div onClick={ev => ev.target === ev.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' }}>
      <div style={{ width:'100%', maxWidth:1040, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${AVO}`, borderRadius:12, padding:'18px 22px', display:'flex', gap:20, flexWrap:'wrap' }}>
        {/* ── Left: details ── */}
        <div style={{ flex:'1 1 420px', minWidth:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, marginBottom:14 }}>
            <input value={e.title || ''} onChange={ev => setE(p => ({ ...p, title: ev.target.value }))}
              onBlur={ev => (e.title !== ev.target.value || ev.target.value === '') ? save({ title: ev.target.value }) : null}
              style={{ fontSize:18, fontWeight:800, background:'transparent', border:'none', borderBottom:`1px solid transparent`, flex:1, minWidth:0, color:'var(--text)' }}
              onFocus={ev => ev.target.style.borderBottom = `1px solid ${AVO}`}
              onBlurCapture={ev => ev.target.style.borderBottom = '1px solid transparent'} />
            <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
              <button disabled={busy} onClick={() => setRfrOpen(true)}
                style={{ background:'#e6c2291f', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'5px 12px', fontSize:10.5, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>RFR</button>
              {actBtn('Sent to Client', '#4a9eff', () => A.avoSent(e.id))}
              <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
            </div>
          </div>
          {rfrOpen && <RfrModal title={e.title} onClose={() => setRfrOpen(false)}
            onConfirm={async notes => { setRfrOpen(false); await act(() => A.avoRfr(e.id, notes)); }} />}
          {/* Category / Type / Status — one labeled row */}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:14 }}>
            <div style={{ flex:'1 1 130px' }}>
              <div style={hdr}>Category</div>
              <select value={e.category || ''} onChange={ev => save({ category: ev.target.value })}
                style={{ width:'100%', fontSize:11, fontWeight:700, padding:'5px 8px', borderRadius:8, background: cc ? `${cc}22` : 'var(--bg)', border:`1px solid ${cc ? cc + '55' : 'var(--border)'}`, color: cc || 'var(--text)' }}>
                <option value="">—</option>
                {usedCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ flex:'1 1 110px' }}>
              <div style={hdr}>Type</div>
              <input value={e.tracker_type || ''} placeholder="Type" onChange={ev => setE(p => ({ ...p, tracker_type: ev.target.value }))}
                onBlur={ev => save({ trackerType: ev.target.value })}
                style={{ width:'100%', fontSize:11, fontWeight:700, padding:'5px 8px', borderRadius:8, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)' }} />
            </div>
            <div style={{ flex:'1 1 130px' }}>
              <div style={hdr}>Status</div>
              <select value={e.workflow_status || ''} onChange={ev => save({ workflowStatus: ev.target.value })}
                style={{ width:'100%', fontSize:11, fontWeight:700, padding:'5px 8px', borderRadius:8, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)' }}>
                <option value="">Upcoming (not started)</option>
                {DELIVERABLE_STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div style={{ flex:'0 0 auto' }}>
              <div style={hdr}>Focus</div>
              <button type="button" onClick={() => save({ focus: !e.focus })}
                title={e.focus ? 'Remove the Focus flag' : 'Flag this edit as Focus (needs attention now)'}
                style={{ fontSize:11, fontWeight:800, padding:'6px 12px', borderRadius:8, cursor:'pointer',
                  background: e.focus ? `${FOCUS_COLOR}22` : 'var(--bg)', border:`1px solid ${e.focus ? FOCUS_COLOR : 'var(--border)'}`, color: e.focus ? FOCUS_COLOR : 'var(--muted)' }}>
                {e.focus ? '★ Focus' : '☆ Focus'}
              </button>
            </div>
          </div>
          {/* Version stepper + Approved pill */}
          <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginBottom:14 }}>
            <div>
              <div style={hdr}>Version</div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <button className="btn btn-ghost btn-sm" title="Version down 0.1" onClick={() => save({ version: stepV(e.version, -1) })}>−.1</button>
                <span style={{ fontSize:15, fontWeight:800, color:AVO }}><VersionInput value={e.version} onSave={n => save({ version: n })} style={{ width:44 }} /></span>
                <button className="btn btn-ghost btn-sm" title="Version up 0.1" onClick={() => save({ version: stepV(e.version, 1) })}>+.1</button>
              </div>
            </div>
            <div>
              <div style={hdr}>Approved</div>
              <button onClick={() => save({ approved: !e.approved })}
                style={{ background: e.approved ? 'rgba(90,191,128,0.15)' : 'transparent', border:`1px solid ${e.approved ? '#5ABF80' : 'var(--border)'}`,
                  color: e.approved ? '#5ABF80' : 'var(--muted)', borderRadius:20, padding:'5px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                {e.approved ? '✓ Approved' : 'Not Approved'}
              </button>
            </div>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={hdr}>Description</div>
            <textarea value={e.description || ''} placeholder="Add a description…" rows={2}
              onChange={ev => setE(p => ({ ...p, description: ev.target.value }))} onBlur={ev => save({ description: ev.target.value })}
              style={{ width:'100%', fontSize:12.5, lineHeight:1.5, resize:'vertical' }} />
          </div>
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:8 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center', padding:'4px 0' }}>
              <span style={labelCss}>Editor</span><span style={{ fontSize:12 }}>{e.current_editor || e.lead_editor || '—'}</span>
            </div>
            {TEXT_ROWS.map(([df, pk, label]) => (
              <div key={df} style={{ display:'flex', gap:10, alignItems:'center', padding:'4px 0' }}>
                <span style={labelCss}>{label}</span>
                <input value={e[df] || ''} onChange={ev => setE(p => ({ ...p, [df]: ev.target.value }))}
                  onBlur={ev => save({ [pk]: ev.target.value })} style={inp} />
              </div>
            ))}
            <div style={{ display:'flex', gap:10, alignItems:'center', padding:'4px 0' }}>
              <span style={labelCss}>Start</span>
              <input type="date" value={iso(e.start_date)} onChange={ev => save({ startDate: ev.target.value })} style={inp} />
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center', padding:'4px 0' }}>
              <span style={labelCss}>Due</span>
              <input type="date" value={iso(e.end_date)} onChange={ev => save({ endDate: ev.target.value })} style={inp} />
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center', padding:'4px 0' }}>
              <span style={labelCss}>Review Link</span>
              <input value={e.review_link || ''} placeholder="https://…" onChange={ev => setE(p => ({ ...p, review_link: ev.target.value }))}
                onBlur={ev => save({ reviewLink: ev.target.value })} style={inp} />
            </div>
          </div>
          {e.review_link && (
            <a href={e.review_link} target="_blank" rel="noreferrer"
              style={{ display:'inline-block', marginTop:12, background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:8, padding:'7px 16px', fontSize:12, fontWeight:800, textDecoration:'none' }}>
              ▶ Open review link
            </a>
          )}
          {customCols.length > 0 && (
            <div style={{ marginTop:14 }}>
              <div style={hdr}>Tracker Fields</div>
              {customCols.map(col => (
                <div key={col.key} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'4px 0' }}>
                  <span style={labelCss}>{col.label}</span>
                  <textarea value={e.extra?.[col.key] || ''} rows={1} placeholder={`${col.label}…`}
                    onChange={ev => setE(p => ({ ...p, extra: { ...(p.extra || {}), [col.key]: ev.target.value } }))}
                    onBlur={ev => save({ extra: { [col.key]: ev.target.value } })}
                    style={{ ...inp, resize:'vertical', minHeight:30, lineHeight:1.4 }} />
                </div>
              ))}
            </div>
          )}
          {/* Timeline — collapsed unless expanded */}
          <div style={{ marginTop:16 }}>
            <button onClick={() => setTlOpen(o => !o)}
              style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', padding:0, display:'flex', alignItems:'center', gap:6 }}>
              {tlOpen ? '▾' : '▸'} Timeline{setTL ? ` (${setTL})` : ''}
            </button>
            {tlOpen && (
              <div style={{ marginTop:8 }}>
                {tlRows.map(([k, label]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, fontSize:12, padding:'4px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                    <span>{label}</span>
                    <input type="date" value={iso(ms[k])} onChange={ev => save({ milestones: { [k]: ev.target.value } })} style={{ fontSize:12, width:160 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* ── Right: activity ── */}
        <div style={{ flex:'1 1 300px', minWidth:0, display:'flex', flexDirection:'column', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, maxHeight:'72vh' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em' }}>Activity</div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
            {activity.map(a => (
              <div key={a.id} style={{ fontSize:11.5, lineHeight:1.45 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                  <span style={{ color: a.kind === 'comment' ? 'var(--text)' : 'var(--muted)', fontWeight: a.kind === 'comment' ? 700 : 400 }}>
                    {a.kind === 'comment' ? '💬 ' : '• '}{a.author || 'someone'}{a.kind === 'comment' ? '' : ` ${a.body}`}
                  </span>
                  <span style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                    <span style={{ color:'var(--muted)', whiteSpace:'nowrap', fontSize:10 }}>{fmtWhen(a.created_at)}</span>
                    {a.kind === 'comment' && A.deleteAvoComment && <button title="Delete this comment" onClick={() => delComment(a)}
                      style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, padding:0, lineHeight:1 }}>✕</button>}
                  </span>
                </div>
                {a.kind === 'comment' && <div style={{ marginTop:2, whiteSpace:'pre-wrap' }}>{a.body}</div>}
              </div>
            ))}
            {activity.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No activity yet.</div>}
          </div>
          <div style={{ borderTop:'1px solid var(--border)', padding:10, display:'flex', gap:8 }}>
            <input value={comment} placeholder="Add a comment…" onChange={ev => setComment(ev.target.value)}
              onKeyDown={ev => { if (ev.key === 'Enter') addComment(); }} style={{ flex:1, fontSize:12 }} />
            <button className="btn btn-primary btn-sm" onClick={addComment} disabled={!comment.trim()}>Post</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const fmtMsDate = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' }) : '';

// The Post-Production Overview tab: a high-level, at-a-glance list — one row
// per deliverable with Name · Status (editable dropdown; RFR/Sent auto-set) ·
// Current Editor (timeline-derived) · Next Steps (next upcoming milestone) ·
// per-row RFR + Sent to Client actions (same flow as the edit card).
function DeliverableOverview({ edits, onSave, onOpenEdit, onStatus, readOnly, A = api, config, onConfig }) {
  const list = edits || [];
  const [rfrFor, setRfrFor] = useState(null);   // edit whose RFR notes modal is open
  const [busyId, setBusyId] = useState(null);   // edit mid-action
  // Resizable columns (same grip + persist flow as the SmartTable grids)
  const [liveWidths, setLiveWidths] = useState({});
  const resizeRef = useRef(null);
  const widths = config?.widths || {};
  const colWidth = k => liveWidths[k] ?? widths[k] ?? undefined;
  const canResize = !!onConfig;
  useEffect(() => {
    function move(ev) {
      if (!resizeRef.current) return;
      const { key, startX, startW } = resizeRef.current;
      setLiveWidths(lw => ({ ...lw, [key]: Math.max(60, startW + (ev.clientX - startX)) }));
    }
    function up() {
      const r = resizeRef.current; if (!r) return; resizeRef.current = null;
      setLiveWidths(lw => {
        if (lw[r.key] != null && onConfig) onConfig({ ...config, widths: { ...widths, [r.key]: Math.round(lw[r.key]) } });
        const { [r.key]: _drop, ...rest } = lw; return rest;
      });
    }
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [config]);
  const grip = key => canResize && (
    <span className="tbl-col-grip" title="Drag to adjust column width" draggable={false}
      onMouseDown={ev => { ev.preventDefault(); ev.stopPropagation(); const thEl = ev.currentTarget.closest('th'); resizeRef.current = { key, startX: ev.clientX, startW: thEl ? thEl.getBoundingClientRect().width : 120 }; }}
      onClick={ev => ev.stopPropagation()} />
  );
  const colHead = { padding:'8px 14px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', fontWeight:800, borderBottom:'1px solid var(--border)', whiteSpace:'nowrap', position:'relative' };
  const cell = { padding:'9px 14px', fontSize:12, borderBottom:'1px solid rgba(255,255,255,0.05)', verticalAlign:'middle' };
  const sendClient = async e => {
    setBusyId(e.id);
    try { await A.avoSent(e.id); onStatus?.(e.id, 'SENT'); }
    catch (err) { alert(err.message); }
    setBusyId(null);
  };
  const confirmRfr = async notes => {
    const e = rfrFor; setRfrFor(null); if (!e) return;
    setBusyId(e.id);
    try { await A.avoRfr(e.id, notes); onStatus?.(e.id, 'RFR'); }
    catch (err) { alert(err.message); }
    setBusyId(null);
  };
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:9, padding:'12px 16px' }}>
        <span style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>Post-Production Overview</span>
        <span style={{ fontSize:11, color:'var(--muted)' }}>· {list.length} deliverable{list.length === 1 ? '' : 's'}</span>
      </div>
      {list.length === 0 ? (
        <div style={{ padding:'14px 16px', borderTop:'1px solid var(--border)', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>
          No deliverables yet — add them in the Project Video Tracker.
        </div>
      ) : (
        <div style={{ overflowX:'auto', borderTop:'1px solid var(--border)' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:760 }}>
            <thead>
              <tr>
                <th style={{ ...colHead, width:colWidth('name'), maxWidth:colWidth('name') }}>Name of Edit{grip('name')}</th>
                <th style={{ ...colHead, width:colWidth('status'), maxWidth:colWidth('status') }}>Status{grip('status')}</th>
                <th style={{ ...colHead, width:colWidth('editor'), maxWidth:colWidth('editor') }}>Current Editor{grip('editor')}</th>
                <th style={{ ...colHead, width:colWidth('next'), maxWidth:colWidth('next') }}>Next Steps{grip('next')}</th>
                <th style={{ ...colHead, textAlign:'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(e => {
                const cur = DELIV_STATUS(e.workflow_status);   // null → Upcoming
                const nm = nextMilestone(e);
                const busy = busyId === e.id;
                return (
                  <tr key={e.id}>
                    <td style={{ ...cell, fontWeight:700 }}>
                      <span onClick={() => onOpenEdit?.(e)} style={{ cursor: onOpenEdit ? 'pointer' : 'default' }}>{e.title || 'Untitled'}</span>
                    </td>
                    <td style={cell}>
                      <select value={e.workflow_status || ''} disabled={readOnly}
                        onChange={ev => onSave(e.id, { workflowStatus: ev.target.value })}
                        style={{ fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:12, cursor: readOnly ? 'default' : 'pointer', appearance:'none',
                          background: cur ? `${cur[2]}22` : 'transparent', border:`1px solid ${cur ? cur[2] : 'var(--border)'}`, color: cur ? cur[2] : 'var(--muted)' }}>
                        <option value="" style={{ color:'var(--text)', background:'var(--bg2)' }}>Upcoming</option>
                        {DELIVERABLE_STATUSES.map(([k, label]) => <option key={k} value={k} style={{ color:'var(--text)', background:'var(--bg2)' }}>{label}</option>)}
                      </select>
                    </td>
                    <td style={{ ...cell, whiteSpace:'nowrap' }}>{e.current_editor || e.lead_editor || '—'}</td>
                    <td style={cell}>
                      {nm
                        ? <span><span style={{ fontWeight:700 }}>{nm.label}</span> <span style={{ color:'var(--muted)' }}>— {fmtMsDate(nm.date)}</span></span>
                        : <span style={{ color:'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ ...cell, textAlign:'right', whiteSpace:'nowrap' }}>
                      <div style={{ display:'inline-flex', gap:6, alignItems:'center' }}>
                        {/* Version stepper — same control as the edit card */}
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginRight:6 }} title="Version">
                          <button className="btn btn-ghost btn-sm" disabled={readOnly} title="Version down 0.1"
                            onClick={() => onSave(e.id, { version: stepV(e.version, -1) })}>−.1</button>
                          <span style={{ fontSize:14, fontWeight:800, color:AVO }}>
                            <VersionInput value={e.version} onSave={n => onSave(e.id, { version: n })} style={{ width:44 }} /></span>
                          <button className="btn btn-ghost btn-sm" disabled={readOnly} title="Version up 0.1"
                            onClick={() => onSave(e.id, { version: stepV(e.version, 1) })}>+.1</button>
                        </div>
                        <button disabled={busy} onClick={() => setRfrFor(e)}
                          style={{ background:'#e6c2291f', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'5px 12px', fontSize:10.5, fontWeight:800, cursor: busy ? 'default' : 'pointer', whiteSpace:'nowrap', opacity: busy ? 0.5 : 1 }}>RFR</button>
                        <button disabled={busy} onClick={() => sendClient(e)}
                          style={{ background:'#4a9eff1f', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:20, padding:'5px 12px', fontSize:10.5, fontWeight:800, cursor: busy ? 'default' : 'pointer', whiteSpace:'nowrap', opacity: busy ? 0.5 : 1 }}>Sent to Client</button>
                        <button disabled={readOnly} title={e.approved ? 'Click to remove approval' : 'Mark this edit approved'}
                          onClick={() => onSave(e.id, { approved: !e.approved })}
                          style={e.approved
                            ? { background:AVO, border:`1px solid ${AVO}`, color:'#0b0b0b', borderRadius:20, padding:'5px 12px', fontSize:10.5, fontWeight:800, cursor: readOnly ? 'default' : 'pointer', whiteSpace:'nowrap' }
                            : { background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:20, padding:'5px 12px', fontSize:10.5, fontWeight:800, cursor: readOnly ? 'default' : 'pointer', whiteSpace:'nowrap' }}>
                          {e.approved ? '✓ Approved' : 'Approve'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rfrFor && <RfrModal title={rfrFor.title} onClose={() => setRfrFor(null)} onConfirm={confirmRfr} />}
    </div>
  );
}

const TABS = [['overview', 'Post-Production Overview'], ['tracker', 'Project Video Tracker'], ['assets', 'Files'], ['todos', 'To-Do List'], ['music', 'Music Options'], ['lower-thirds', 'Lower Thirds']];

export default function AvoProject({ idOverride, embedded, shareData, clientView: clientViewProp, apiOverride }) {
  const { id: idParam } = useParams();
  const id = idOverride || (shareData ? shareData.id : idParam);
  const nav = useNavigate();
  const { user } = useAuth();
  // On the public share link, writes route through the token-scoped adapter.
  // Staff previewing "as client" keep their authenticated api.
  const A = apiOverride || api;
  const [page, setPage] = useState(shareData || null);
  const [edits, setEdits] = useState(shareData?.edits || []);
  const [lowerThirds, setLowerThirds] = useState(shareData?.lowerThirds || []);
  const [todos, setTodos] = useState(shareData?.todos || []);
  const [music, setMusic] = useState(shareData?.music || []);
  const [tables, setTables] = useState(shareData?.customTables || []);
  const [assets, setAssets] = useState(shareData?.assets || []);
  const [folders, setFolders] = useState(shareData?.folders || []);
  const [editFiles, setEditFiles] = useState(shareData?.editFiles || []);
  const [talent, setTalent] = useState(shareData?.talent || []);
  const [tab, setTab] = useState('overview');
  const [err, setErr] = useState('');
  const [previewClient, setPreviewClient] = useState(false); // admin/producer "View as Client" toggle
  const [pwDraft, setPwDraft] = useState('');                // inline "Public PW" field
  const [copied, setCopied] = useState(false);
  const [editView, setEditView] = useState(null);            // edit opened in client view
  const isStaff = ['ADMIN', 'PRODUCER'].includes(user?.role);
  // Client/Crew view is fully editable but strips internal bits (Delete Page,
  // Share, Contract Editor card, contractor tracker). Driven by the public
  // share link OR the staff "View as Client" toggle.
  const clientView = !!clientViewProp || previewClient;

  useEffect(() => {
    if (shareData) return; // public share view is pre-loaded, no authed fetch
    api.avoProject(id)
      .then(p => { setPage(p); setEdits(p.edits || []); setLowerThirds(p.lowerThirds || []); setTodos(p.todos || []); setMusic(p.music || []); setTables(p.customTables || []); setAssets(p.assets || []); setFolders(p.folders || []); setEditFiles(p.editFiles || []); setTalent(p.talent || []); })
      .catch(e => setErr(e.message));
  }, [id, shareData]);

  // Lower Thirds auto-fill from the project's Talent grid. Talent already present
  // in the grid (matched by name) drop out of the picker.
  async function addLowerThirdFromTalent(t) {
    try {
      const r = await A.addAvoGridRow(id, 'lower-thirds', { name: t.name || '', title: t.role || '', sort: lowerThirds.length });
      setLowerThirds(rs => [...rs, r]);
    } catch (e) { alert(e.message); }
  }
  async function addAllTalent(list) {
    try {
      let sort = lowerThirds.length;
      const added = [];
      for (const t of list) added.push(await A.addAvoGridRow(id, 'lower-thirds', { name: t.name || '', title: t.role || '', sort: sort++ }));
      setLowerThirds(rs => [...rs, ...added]);
    } catch (e) { alert(e.message); }
  }

  async function addTable() {
    const name = prompt('Name for the new table:');
    if (!name || !name.trim()) return;
    try {
      const t = await A.createAvoTable(id, name.trim());
      setTables(ts => [...ts, t]);
      setTab('table:' + t.id);
    } catch (e) { alert(e.message); }
  }
  async function deleteTable(t) {
    if (!confirm(`Delete the "${t.name}" table and all its rows?`)) return;
    try {
      await A.deleteAvoTable(t.id);
      setTables(ts => ts.filter(x => x.id !== t.id));
      setTab('tracker');
    } catch (e) { alert(e.message); }
  }
  // Save from the editable edit modal → refresh the tracker row + the open modal.
  async function saveEdit(eid, patch) {
    const full = await A.updateAvoEdit(eid, patch);
    setEdits(es => es.map(x => x.id === eid ? { ...x, ...full } : x));
    return full;
  }

  const gridConfig = page?.grid_config || {};
  const cfgFor = k => gridConfig[k] || { cols: [], merges: {} };
  const saveCfg = k => next => {
    const gc = { ...gridConfig, [k]: next };
    setPage(p => ({ ...p, grid_config: gc }));
    A.updateAvoProject(id, { gridConfig: gc }).catch(e => alert(e.message));
  };

  async function removePage() {
    if (!confirm(`Delete the project page for ${page.code} (and its grids)?`)) return;
    try { await api.deleteAvoProject(id); nav('/avo'); } catch (e) { alert(e.message); }
  }
  // Saving the "Public PW" field enables sharing (mints the link if needed) and
  // sets/clears the password. Empty = open link.
  async function enableShare(password) {
    try { const r = await api.avoShareEnable(id, password); setPage(p => ({ ...p, share_token: r.token, share_password: r.password })); }
    catch (e) { alert(e.message); }
  }
  async function disableShare() {
    if (!confirm('Turn off the shareable link? The current link will stop working.')) return;
    try { await api.avoShareDisable(id); setPage(p => ({ ...p, share_token: null, share_password: null })); setPwDraft(''); }
    catch (e) { alert(e.message); }
  }
  const shareUrl = page?.share_token ? `${window.location.origin}/avo-share/${page.share_token}` : '';
  useEffect(() => { setPwDraft(page?.share_password || ''); }, [page?.share_token, page?.share_password]);
  function copyShareLink() {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  }
  const statusOf = k => AVO_STATUSES.find(([key]) => key === k);

  const todoCell = (r, c, save, ro, expanded) => c === 'category'
    ? <Cell value={r.category} placeholder="Category…" onSave={save} readOnly={ro}
        style={r.category ? { background:`${typeColor(r.category)}22`, border:`1px solid ${typeColor(r.category)}55`, color:typeColor(r.category), fontWeight:700, textAlign:'center', borderRadius:12 } : {}} />
    : c === 'text'
      ? <Cell value={r.text} placeholder="Status / who's on it…" onSave={save} readOnly={ro} multiline={expanded} style={{ fontStyle: r.text ? 'italic' : 'normal', color: r.text ? '#a78bfa' : undefined }} />
      : null;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      {!embedded && <AvoHeader right={isStaff && !shareData ? (
        <div style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:9, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>View as</span>
          <div style={{ display:'inline-flex', border:`1px solid ${AVO}55`, borderRadius:14, overflow:'hidden' }}>
            {[['prod', 'Producer'], ['client', 'Client']].map(([k, label]) => (
              <button key={k} onClick={() => setPreviewClient(k === 'client')}
                style={{ background: (k === 'client') === previewClient ? `${AVO}2e` : 'transparent', border:'none',
                  color: (k === 'client') === previewClient ? AVO : 'var(--muted)', padding:'4px 12px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null} />}
      <div style={{ maxWidth:1250, margin:'0 auto', padding:'6px 16px 80px' }}>
        {!embedded && <div style={{ marginBottom:14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/avo')}>‹ Pipeline</button>
        </div>}
        {err && <div className="empty">{err}</div>}
        {!err && !page && <div className="empty">Loading…</div>}
        {page && (
          <>
            <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap:10, flexWrap:'wrap', marginBottom:14 }}>
              {/* Project View's header already shows code + title above the nav */}
              {!embedded ? (
                <div>
                  <div className="page-title">{page.code}</div>
                  {clientView
                    ? <div style={{ marginTop:4, fontSize:13, color:'var(--muted)' }}>{page.title || ''}</div>
                    : <input value={page.title || ''} placeholder="Add a project title…"
                        onChange={e => setPage(p => ({ ...p, title: e.target.value }))}
                        onBlur={e => api.updateAvoProject(id, { title: e.target.value }).catch(er => alert(er.message))}
                        style={{ ...cellInput, marginTop:4, maxWidth:340, color:'var(--muted)' }} />}
                </div>
              ) : <div />}
              {!clientView && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
                  <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e05252)' }} onClick={removePage}>Delete Page</button>
                  {isStaff && !shareData && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'flex-end',
                      border:`1px solid ${page.share_token ? AVO + '88' : 'var(--border)'}`, borderRadius:10, padding:'6px 10px' }}>
                      <span style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap', color: page.share_token ? AVO : 'var(--muted)' }}>Public PW</span>
                      <input value={pwDraft} placeholder="No password set" onChange={e => setPwDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') enableShare(pwDraft.trim()); }}
                        style={{ fontSize:12, width:150, padding:'4px 8px' }} />
                      <button className="btn btn-primary btn-sm" onClick={() => enableShare(pwDraft.trim())}>Save</button>
                      {page.share_token && (
                        <>
                          <span style={{ color:'var(--border2, #333)' }}>|</span>
                          <button className="btn btn-ghost btn-sm" onClick={copyShareLink} style={{ whiteSpace:'nowrap' }}>{copied ? '✓ Copied' : '🔗 Copy Link'}</button>
                          <button className="btn btn-ghost btn-sm" title="Turn off sharing" onClick={disableShare} style={{ color:'var(--red-text, #e05252)' }}>Off</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display:'flex', gap:6, flexWrap:'nowrap', overflowX:'auto', marginBottom:16, paddingBottom:4,
              WebkitMaskImage:'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)',
              maskImage:'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)' }}>
              {TABS.map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  style={{
                    background: tab === k ? `${AVO}2e` : 'transparent', border:`1px solid ${tab === k ? AVO : 'var(--border)'}`,
                    color: tab === k ? AVO : 'var(--muted)', borderRadius:16, padding:'5px 14px', fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                  }}>
                  {label}{k === 'tracker' && edits.length ? ` (${edits.length})` : ''}
                </button>
              ))}
              {tables.map(t => (
                <button key={t.id} onClick={() => setTab('table:' + t.id)}
                  style={{
                    background: tab === 'table:' + t.id ? `${AVO}2e` : 'transparent', border:`1px solid ${tab === 'table:' + t.id ? AVO : 'var(--border)'}`,
                    color: tab === 'table:' + t.id ? AVO : 'var(--muted)', borderRadius:16, padding:'5px 14px', fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0,
                  }}>
                  {t.name}
                </button>
              ))}
              <button onClick={addTable} title="Add a custom table as a new tab"
                style={{ background:'var(--bg)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:16, padding:'5px 14px', fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                + Add Custom Table
              </button>
            </div>

            {tab === 'overview' && (
              <DeliverableOverview edits={edits} onSave={saveEdit} readOnly={false} A={A}
                config={cfgFor('overview')} onConfig={saveCfg('overview')}
                onStatus={(eid, ws) => setEdits(es => es.map(x => x.id === eid ? { ...x, workflow_status: ws } : x))}
                onOpenEdit={clientView ? (e => setEditView(e)) : (e => nav(`/avo/${e.id}`))} />
            )}
            {tab === 'tracker' && <>
              <VideoTracker edits={edits} setEdits={setEdits} code={page.code} config={cfgFor('tracker')} onConfig={saveCfg('tracker')}
                A={A} onOpenEdit={clientView ? (e => setEditView(e)) : null} />
              {!clientView && <ContractorTracker pageId={id} />}
            </>}
            {tab === 'assets' && <FilesTab pageId={id} assets={assets} setAssets={setAssets} folders={folders} setFolders={setFolders}
              edits={edits} editFiles={editFiles} setEditFiles={setEditFiles} readOnly={clientView} A={A} />}
            {tab === 'todos' && (
              <Grid kind="todos" pageId={id} doneKey="done" rows={todos} setRows={setTodos} renderCell={todoCell} A={A}
                config={cfgFor('todos')} onConfig={saveCfg('todos')}
                columns={[['category', 'Category', 'Takeaways…'], ['video', 'Video', 'Which video'], ['needs', 'Needs', 'Script, music, shot list…'], ['text', 'To Do', 'Status / who’s on it…']]} />
            )}
            {tab === 'music' && (
              <MusicGrid pageId={id} rows={music} setRows={setMusic} code={page.code} title={page.title} A={A}
                edits={edits} setEdits={setEdits}
                config={cfgFor('music')} onConfig={next => saveCfg('music')({ ...cfgFor('music'), ...next })} />
            )}
            {tables.map(t => tab === 'table:' + t.id && (
              <CustomTable key={t.id} table={t} A={A}
                onChange={next => setTables(ts => ts.map(x => x.id === t.id ? next : x))}
                onDelete={() => deleteTable(t)} />
            ))}
            {tab === 'lower-thirds' && (() => {
              const used = new Set(lowerThirds.map(r => (r.name || '').trim().toLowerCase()).filter(Boolean));
              const avail = talent.filter(t => (t.name || '').trim() && !used.has(t.name.trim().toLowerCase()));
              return (
                <>
                  {talent.length > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                      <span style={{ fontSize:11, color:'var(--muted)', fontWeight:700 }}>Auto-fill from Talent</span>
                      <select value="" disabled={!avail.length}
                        onChange={e => { const t = avail.find(x => x.name === e.target.value); if (t) addLowerThirdFromTalent(t); e.target.value = ''; }}
                        style={{ fontSize:12, padding:'5px 10px', borderRadius:8, maxWidth:280, opacity: avail.length ? 1 : 0.5 }}>
                        <option value="">{avail.length ? '+ Add a talent…' : 'All talent added'}</option>
                        {avail.map(t => <option key={t.name} value={t.name}>{t.name}{t.role ? ` — ${t.role}` : ''}</option>)}
                      </select>
                      {avail.length > 0 && (
                        <button onClick={() => addAllTalent(avail)}
                          style={{ background:`${AVO}26`, border:`1px solid ${AVO}`, color:AVO, borderRadius:14, padding:'4px 12px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                          + Add all {avail.length}
                        </button>
                      )}
                    </div>
                  )}
                  <Grid kind="lower-thirds" pageId={id} rows={lowerThirds} setRows={setLowerThirds} A={A}
                    config={cfgFor('lower-thirds')} onConfig={saveCfg('lower-thirds')}
                    columns={[['name', 'Name', 'Full name'], ['title', 'Title', 'On-screen title / role'], ['notes', 'Notes', '']]} />
                </>
              );
            })()}
          </>
        )}
      </div>
      {editView && <EditModal edit={editView} statusOf={statusOf} onSave={saveEdit} onClose={() => setEditView(null)} A={A} customCols={cfgFor('tracker').cols || []} />}
    </div>
  );
}

// Public, editable Client/Crew view of a project page (optional password).
export function AvoShareView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [pwNeeded, setPwNeeded] = useState(false);
  const [pw, setPw] = useState('');
  const [usedPw, setUsedPw] = useState('');   // the password that unlocked this view
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function load(pwTry) {
    setBusy(true);
    try {
      const r = await api.avoShareView(token, pwTry);
      if (r._status === 401 && r.passwordRequired) { setPwNeeded(true); if (pwTry) setErr('Incorrect password — try again.'); }
      else if (r._status) { setErr(r.error || 'This link is unavailable.'); }
      else { setData(r); setUsedPw(pwTry || ''); setPwNeeded(false); setErr(''); }
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  useEffect(() => { load(); }, [token]);
  const shareApi = useMemo(() => api.avoShareApi(token, usedPw), [token, usedPw]);

  const shell = inner => (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'18px 26px', borderBottom:'1px solid var(--border)' }}>
        <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
        <span style={{ fontSize:12, color:AVO, fontWeight:700, letterSpacing:'0.04em' }}>🥑 AvocadoPost</span>
        {data && <span style={{ fontSize:11, color:'var(--muted)' }}>· {data.code}{data.title ? ` — ${data.title}` : ''}</span>}
      </div>
      {inner}
    </div>
  );

  if (data) return shell(<AvoProject shareData={data} clientView embedded apiOverride={shareApi} />);
  if (pwNeeded) return shell(
    <div style={{ maxWidth:360, margin:'80px auto', textAlign:'center' }}>
      <div style={{ fontSize:14, fontWeight:800, marginBottom:8 }}>This view is password-protected</div>
      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:14 }}>Enter the password shared with you to continue.</div>
      <form onSubmit={e => { e.preventDefault(); load(pw); }}>
        <input type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="Password"
          style={{ width:'100%', fontSize:13, marginBottom:10 }} />
        {err && <div style={{ fontSize:11, color:'#e05252', marginBottom:10 }}>{err}</div>}
        <button className="btn btn-primary" disabled={busy || !pw.trim()} style={{ width:'100%' }}>{busy ? 'Checking…' : 'View'}</button>
      </form>
    </div>
  );
  if (err) return shell(<div className="empty" style={{ margin:'60px 16px' }}>{err}</div>);
  return shell(<div className="empty" style={{ margin:'60px 16px' }}>Loading…</div>);
}
