import React, { useState, useEffect } from 'react';
import { api } from '../../api.js';

const CATEGORIES = [
  { id: 'camera',           label: 'Camera' },
  { id: 'grip',             label: 'Grip' },
  { id: 'electric',         label: 'Electric' },
  { id: 'audio',            label: 'Audio' },
  { id: 'media_management', label: 'Media Management' },
  { id: 'editing',          label: 'Editing' },
  { id: 'other',            label: 'Other' },
];

const UNASSIGNED = { id: 'unassigned', label: 'Unassigned', color: '#7A7565', bg: 'rgba(122,117,101,0.12)' };
const SOURCES = [
  { id: 'internal',      label: 'Internal',      color: '#4a9eff', bg: 'rgba(74,158,255,0.12)' },
  { id: 'contractor',    label: 'Contractor',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { id: 'rental_house',  label: 'Rental House',  color: '#ff8c00', bg: 'rgba(255,140,0,0.12)' },
  { id: 'online_rental', label: 'Online Rental', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
];

function sourceMeta(id) {
  return SOURCES.find(s => s.id === id) || UNASSIGNED;
}

const BLANK_FORM = { category: 'camera', item: '', source: 'internal', notes: '' };

export default function GearList({ project }) {
  const [items, setItems] = useState([]);
  const [groupBy, setGroupBy] = useState('category'); // 'category' | 'source'
  const [showAdd, setShowAdd] = useState(false);
  const [addCategory, setAddCategory] = useState('camera');
  const [form, setForm] = useState(BLANK_FORM);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState(null);
  const [overZone, setOverZone] = useState(null);
  const [splitOpen, setSplitOpen] = useState({});   // itemId -> expanded

  const sameLine = (a, b, source, contractorName) =>
    a.item === b.item && a.category === b.category &&
    (a.source || 'unassigned') === (source || 'unassigned') &&
    (a.contractor_name || '') === (contractorName || '');

  // Move the WHOLE card; if the target already holds the same item, merge qtys
  async function assign(itemId, source, contractorName) {
    try {
      const me = items.find(i => i.id === itemId);
      if (!me) return;
      const dupe = items.find(i => i.id !== itemId && sameLine(i, me, source, contractorName));
      if (dupe) {
        const updated = await api.updateGearItem(project.id, dupe.id, { qty: Number(dupe.qty || 1) + Number(me.qty || 1) });
        await api.deleteGearItem(project.id, itemId);
        setItems(prev => prev.filter(i => i.id !== itemId).map(i => i.id === updated.id ? updated : i));
      } else {
        const item = await api.updateGearItem(project.id, itemId, { source, contractorName: contractorName || '' });
        setItems(prev => prev.map(i => i.id === item.id ? item : i));
      }
    } catch (err) { alert(err.message); }
  }

  // Move ONE unit of a multi-qty card: decrement the original and grow/create
  // a row for the same item at the target source
  async function assignUnit(itemId, source, contractorName) {
    try {
      const me = items.find(i => i.id === itemId);
      if (!me) return;
      if (Number(me.qty || 1) <= 1) return assign(itemId, source, contractorName);
      const dec = await api.updateGearItem(project.id, itemId, { qty: Number(me.qty) - 1 });
      const existing = items.find(i => i.id !== itemId && sameLine(i, me, source, contractorName));
      if (existing) {
        const grown = await api.updateGearItem(project.id, existing.id, { qty: Number(existing.qty || 1) + 1 });
        setItems(prev => prev.map(i => i.id === dec.id ? dec : i.id === grown.id ? grown : i));
      } else {
        const created = await api.createGearItem(project.id, { category: me.category, item: me.item, qty: 1, source, contractorName: contractorName || '', notes: me.notes || '' });
        setItems(prev => [...prev.map(i => i.id === dec.id ? dec : i), created]);
      }
    } catch (err) { alert(err.message); }
  }
  function handleDrop(data, source, contractorName) {
    if (!data) return;
    if (data.startsWith('unit:')) assignUnit(data.slice(5), source, contractorName);
    else assign(data, source, contractorName);
  }
  // Only actual contractors get gear lanes — contract slots, or crew from a
  // non-Unbridled company
  const contractors = [...new Set((project.crewAssignments || [])
    .filter(a => a.crewMember && (a.is_contractor || !(a.crewMember.company || '').toLowerCase().includes('unbridled')))
    .map(a => [a.crewMember.preferredFirstName, a.crewMember.preferredLastName].filter(Boolean).join(' ').trim() || a.crewMember.name)
    .filter(Boolean))].sort();

  useEffect(() => {
    api.getGearItems(project.id)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [project.id]);

  function openAdd(category) {
    setAddCategory(category);
    setForm({ ...BLANK_FORM, category });
    setShowAdd(true);
    setEditId(null);
  }

  async function handleAdd(e) {
    e.preventDefault();
    try {
      const item = await api.createGearItem(project.id, form);
      setItems(prev => [...prev, item]);
      setForm({ ...BLANK_FORM, category: form.category });
      setShowAdd(false);
    } catch(err) { alert(err.message); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    try {
      const item = await api.updateGearItem(project.id, editId, editForm);
      setItems(prev => prev.map(i => i.id === item.id ? item : i));
      setEditId(null);
    } catch(err) { alert(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this gear item?')) return;
    await api.deleteGearItem(project.id, id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  // Group items
  const grouped = groupBy === 'category'
    ? CATEGORIES.map(cat => ({ key: cat.id, label: cat.label, items: items.filter(i => i.category === cat.id) })).filter(g => g.items.length > 0 || true)
    : SOURCES.map(src => ({ key: src.id, label: src.label, items: items.filter(i => i.source === src.id), meta: src })).filter(g => g.items.length > 0 || true);

  const totalItems = items.length;
  const sourceSummary = [...SOURCES, UNASSIGNED].map(s => ({ ...s, count: items.filter(i => (i.source || 'unassigned') === s.id).length })).filter(s => s.count > 0);

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div className="page-title" style={{ marginBottom:3 }}>Gear List</div>
          <div className="page-sub">{project.client} · {project.code}</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, overflow:'hidden' }}>
            {['category','source'].map(g => (
              <button key={g} onClick={() => setGroupBy(g)}
                style={{ padding:'5px 12px', fontSize:11, fontWeight:600, border:'none', cursor:'pointer', letterSpacing:'.03em', textTransform:'capitalize',
                  background: groupBy === g ? 'var(--orange)' : 'transparent',
                  color: groupBy === g ? '#fff' : 'var(--muted)' }}>
                By {g}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd('camera')}>+ Add Item</button>
        </div>
      </div>

      {/* Summary bar */}
      {totalItems > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          <div style={{ fontSize:12, color:'var(--muted)', padding:'4px 0', alignSelf:'center' }}>{totalItems} item{totalItems !== 1 ? 's' : ''} total</div>
          {sourceSummary.map(s => (
            <div key={s.id} style={{ display:'flex', alignItems:'center', gap:5, background:s.bg, border:`1px solid ${s.color}22`, borderRadius:20, padding:'3px 10px' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:s.color, flexShrink:0 }} />
              <span style={{ fontSize:11, fontWeight:600, color:s.color }}>{s.count} {s.label}</span>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>Loading…</div>}

      {/* Add form (shown above groups) */}
      {showAdd && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:16, marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Add Gear Item</div>
          <form onSubmit={handleAdd}>
            <div className="form-grid">
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Source</label>
                <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                  {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="field span2">
                <label>Item Description</label>
                <input required value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} placeholder="e.g. 2x RED V-Raptor XL" autoFocus />
              </div>
              <div className="field span2">
                <label>Notes (optional)</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Owned by John Doe, bringing day 1–3" />
              </div>
            </div>
            <div className="btn-row">
              <button type="submit" className="btn btn-primary btn-sm">Add</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Groups */}
      {groupBy === 'category' ? (
        CATEGORIES.map(cat => {
          const catItems = items.filter(i => i.category === cat.id);
          return (
            <div key={cat.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, marginBottom:12, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom: catItems.length ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--muted)' }}>{cat.label}</div>
                <button className="btn btn-ghost btn-sm" style={{ padding:'2px 10px', fontSize:11 }} onClick={() => openAdd(cat.id)}>+ Add</button>
              </div>
              {catItems.length === 0 && (
                <div style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No items yet.</div>
              )}
              {catItems.map(item => (
                <GearItemRow key={item.id} item={item} editId={editId} editForm={editForm}
                  onEdit={() => { setEditId(item.id); setEditForm({ category: item.category, item: item.item, source: item.source, notes: item.notes||'' }); setShowAdd(false); }}
                  onSave={handleEdit} onCancel={() => setEditId(null)} onDelete={() => handleDelete(item.id)}
                  setEditForm={setEditForm} />
              ))}
            </div>
          );
        })
      ) : (
        <div className="gl-split" style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
          {/* Left: the By Category list slides into a column — drag items right */}
          <div className="gl-left" style={{ flex:'0 0 46%', minWidth:0 }}>
            <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--muted)', marginBottom:8 }}>
              By Category — drag each piece into its source →
            </div>
            {CATEGORIES.map(cat => {
              const catItems = items.filter(i => i.category === cat.id);
              if (!catItems.length) return null;
              return (
                <div key={cat.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, marginBottom:10, overflow:'hidden' }}>
                  <div style={{ padding:'7px 12px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--muted)' }}>{cat.label}</div>
                  {catItems.map(item => {
                    const sm = sourceMeta(item.source || 'unassigned');
                    const assigned = item.source && item.source !== 'unassigned';
                    const multi = Number(item.qty) > 1;
                    const open = !!splitOpen[item.id];
                    return (
                      <React.Fragment key={item.id}>
                      <div draggable
                        onDragStart={e => { setDragId(item.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', item.id); }}
                        onDragEnd={() => { setDragId(null); setOverZone(null); }}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 12px', borderBottom: open ? 'none' : '1px solid rgba(255,255,255,0.04)',
                          cursor:'grab', opacity: dragId === item.id ? 0.4 : 1, background: assigned ? 'transparent' : 'rgba(232,80,10,0.05)' }}>
                        <span style={{ color:'var(--muted)', fontSize:12, flexShrink:0 }}>⠿</span>
                        <span style={{ fontSize:12, flex:1, minWidth:0 }}>{multi && <b style={{ color:'var(--orange)' }}>{item.qty}× </b>}{item.item}</span>
                        {multi && (
                          <button onClick={() => setSplitOpen(o => ({ ...o, [item.id]: !o[item.id] }))}
                            title="Split — drag single units to different sources"
                            style={{ background:'none', border:'1px solid var(--border)', color: open ? 'var(--orange)' : 'var(--muted)', borderRadius:10, padding:'1px 8px', fontSize:9, fontWeight:800, cursor:'pointer', flexShrink:0 }}>
                            {open ? '▴ split' : '▾ split'}
                          </button>
                        )}
                        <span title={item.contractor_name || sm.label}
                          style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', padding:'2px 8px', borderRadius:12, background:sm.bg, color:sm.color, border:`1px solid ${sm.color}44`, whiteSpace:'nowrap' }}>
                          {item.contractor_name && (item.source === 'contractor' || item.source === 'internal')
                            ? (item.source === 'internal' ? `Internal · ${item.contractor_name}` : item.contractor_name)
                            : sm.label}
                        </span>
                      </div>
                      {multi && open && (
                        <div draggable
                          onDragStart={e => { setDragId(item.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'unit:' + item.id); }}
                          onDragEnd={() => { setDragId(null); setOverZone(null); }}
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 12px 7px 34px', borderBottom:'1px solid rgba(255,255,255,0.04)',
                            cursor:'grab', fontSize:11, color:'var(--muted)', background:'rgba(255,255,255,0.02)' }}>
                          <span style={{ fontSize:11 }}>⠿</span>
                          <span><b style={{ color:'var(--orange)' }}>1×</b> {item.item} — drag one unit to a different source (repeat to split again)</span>
                        </div>
                      )}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
            {items.length === 0 && <div className="empty">No gear items yet.</div>}
          </div>

          {/* Right: source drop zones */}
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--muted)', marginBottom:-2 }}>Sources</div>
            {/* Internal — split by office */}
            {(() => {
              const internal = SOURCES.find(s2 => s2.id === 'internal');
              const count = items.filter(i => i.source === 'internal').length;
              return (
                <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderLeft:`3px solid ${internal.color}`, borderRadius:8, padding:'9px 12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:internal.color }} />
                    <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', color:internal.color }}>Internal</div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>({count})</div>
                  </div>
                  {[['STL', 'St. Louis'], ['DEN', 'Denver']].map(([site, siteLabel]) => {
                    const zone = 'internal:' + site;
                    const zoneItems = items.filter(i => i.source === 'internal' && i.contractor_name === site);
                    const over = overZone === zone;
                    return (
                      <div key={site}
                        onDragOver={e => { e.preventDefault(); setOverZone(zone); }}
                        onDragLeave={() => setOverZone(z => z === zone ? null : z)}
                        onDrop={e => { e.preventDefault(); handleDrop(e.dataTransfer.getData('text/plain') || dragId, 'internal', site); setOverZone(null); setDragId(null); }}
                        style={{ border:`1px ${over ? 'solid ' + internal.color : 'dashed var(--border)'}`, background: over ? internal.bg : 'transparent',
                          borderRadius:7, padding:'6px 10px', marginBottom:5, transition:'background .15s ease, border-color .15s ease' }}>
                        <div style={{ fontSize:11, fontWeight:700 }}>{siteLabel} <span style={{ fontSize:9, color:'var(--muted)' }}>({zoneItems.length})</span></div>
                        {zoneItems.length > 0 && (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                            {zoneItems.map(i => (
                              <span key={i.id} style={{ fontSize:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'2px 8px' }}>
                                {Number(i.qty) > 1 ? `${i.qty}× ` : ''}{i.item}
                                <span onClick={() => assign(i.id, 'unassigned', null)} style={{ marginLeft:5, cursor:'pointer', color:'var(--muted)', fontWeight:800 }}>✕</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            {SOURCES.filter(s2 => s2.id !== 'contractor' && s2.id !== 'internal').map(src => {
              const zoneItems = items.filter(i => i.source === src.id);
              const over = overZone === src.id;
              return (
                <div key={src.id}
                  onDragOver={e => { e.preventDefault(); setOverZone(src.id); }}
                  onDragLeave={() => setOverZone(z => z === src.id ? null : z)}
                  onDrop={e => { e.preventDefault(); handleDrop(e.dataTransfer.getData('text/plain') || dragId, src.id, null); setOverZone(null); setDragId(null); }}
                  style={{ background: over ? src.bg : 'var(--bg2)', border:`1px ${over ? 'solid' : 'dashed'} ${over ? src.color : 'var(--border)'}`,
                    borderLeft:`3px solid ${src.color}`, borderRadius:8, padding:'9px 12px', minHeight:44, transition:'background .15s ease, border-color .15s ease' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:src.color }} />
                    <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', color:src.color }}>{src.label}</div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>({zoneItems.length})</div>
                  </div>
                  {zoneItems.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                      {zoneItems.map(i => (
                        <span key={i.id} style={{ fontSize:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'2px 8px' }}>
                          {Number(i.qty) > 1 ? `${i.qty}× ` : ''}{i.item}
                          <span onClick={() => assign(i.id, 'unassigned', null)} style={{ marginLeft:5, cursor:'pointer', color:'var(--muted)', fontWeight:800 }}>✕</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Contractor: one sub-zone per crew member on the shoot */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderLeft:'3px solid #a78bfa', borderRadius:8, padding:'9px 12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: contractors.length ? 6 : 0 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#a78bfa' }} />
                <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', color:'#a78bfa' }}>Contractor</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>({items.filter(i => i.source === 'contractor').length})</div>
              </div>
              {contractors.length === 0 && <div style={{ fontSize:10, color:'var(--muted)', fontStyle:'italic' }}>No crew on this shoot yet — assign crew to see contractor lanes.</div>}
              {contractors.map(name => {
                const zone = 'contractor:' + name;
                const zoneItems = items.filter(i => i.source === 'contractor' && i.contractor_name === name);
                const over = overZone === zone;
                return (
                  <div key={name}
                    onDragOver={e => { e.preventDefault(); setOverZone(zone); }}
                    onDragLeave={() => setOverZone(z => z === zone ? null : z)}
                    onDrop={e => { e.preventDefault(); handleDrop(e.dataTransfer.getData('text/plain') || dragId, 'contractor', name); setOverZone(null); setDragId(null); }}
                    style={{ border:`1px ${over ? 'solid #a78bfa' : 'dashed var(--border)'}`, background: over ? 'rgba(167,139,250,0.12)' : 'transparent',
                      borderRadius:7, padding:'6px 10px', marginBottom:5, transition:'background .15s ease, border-color .15s ease' }}>
                    <div style={{ fontSize:11, fontWeight:700 }}>{name} <span style={{ fontSize:9, color:'var(--muted)' }}>({zoneItems.length})</span></div>
                    {zoneItems.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                        {zoneItems.map(i => (
                          <span key={i.id} style={{ fontSize:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'2px 8px' }}>
                            {Number(i.qty) > 1 ? `${i.qty}× ` : ''}{i.item}
                            <span onClick={() => assign(i.id, 'unassigned', null)} style={{ marginLeft:5, cursor:'pointer', color:'var(--muted)', fontWeight:800 }}>✕</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && items.length === 0 && !showAdd && (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--muted)', fontSize:13 }}>
          <div style={{ fontSize:24, marginBottom:8 }}>📦</div>
          <div style={{ fontWeight:600, marginBottom:4 }}>No gear items yet</div>
          <div style={{ fontSize:12, marginBottom:16 }}>Add camera, grip, audio, and other gear — tagged by where it's coming from.</div>
          <button className="btn btn-primary btn-sm" onClick={() => openAdd('camera')}>+ Add First Item</button>
        </div>
      )}

      {/* Edit modal */}
      {editId && !items.find(i => i.id === editId) === false && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditId(null)}>
          <div className="modal">
            <div className="modal-title">Edit Gear Item</div>
            <form onSubmit={handleEdit}>
              <div className="form-grid">
                <div className="field">
                  <label>Category</label>
                  <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Source</label>
                  <select value={editForm.source} onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}>
                    {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div className="field span2">
                  <label>Item Description</label>
                  <input required value={editForm.item} onChange={e => setEditForm(f => ({ ...f, item: e.target.value }))} />
                </div>
                <div className="field span2">
                  <label>Notes</label>
                  <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="btn-row">
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditId(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function GearItemRow({ item, editId, editForm, setEditForm, onEdit, onSave, onCancel, onDelete, catLabel }) {
  const sm = sourceMeta(item.source);
  const isEditing = editId === item.id;

  if (isEditing) {
    return (
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg3)' }}>
        <form onSubmit={onSave}>
          <div className="form-grid">
            <div className="field">
              <label>Category</label>
              <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Source</label>
              <select value={editForm.source} onChange={e => setEditForm(f => ({ ...f, source: e.target.value }))}>
                {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="field span2">
              <label>Item Description</label>
              <input required value={editForm.item} onChange={e => setEditForm(f => ({ ...f, item: e.target.value }))} autoFocus />
            </div>
            <div className="field span2">
              <label>Notes</label>
              <input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', alignItems:'flex-start', padding:'10px 14px', borderBottom:'1px solid var(--border)', gap:12 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{Number(item.qty) > 1 && <b style={{ color:'var(--orange)' }}>{item.qty}× </b>}{item.item}</span>
          <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', padding:'2px 8px', borderRadius:20, background:sm.bg, color:sm.color, border:`1px solid ${sm.color}33` }}>{sm.label}</span>
          {catLabel && <span style={{ fontSize:10, color:'var(--muted)', fontStyle:'italic' }}>{catLabel}</span>}
        </div>
        {item.notes && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{item.notes}</div>}
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, padding:'2px 4px' }} onClick={onEdit}>Edit</button>
        <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, padding:'2px 4px' }} onClick={onDelete}>✕</button>
      </div>
    </div>
  );
}
