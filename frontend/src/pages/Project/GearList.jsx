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

const SOURCES = [
  { id: 'internal',      label: 'Internal',      color: '#4a9eff', bg: 'rgba(74,158,255,0.12)' },
  { id: 'contractor',    label: 'Contractor',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  { id: 'rental_house',  label: 'Rental House',  color: '#ff8c00', bg: 'rgba(255,140,0,0.12)' },
  { id: 'online_rental', label: 'Online Rental', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
];

function sourceMeta(id) {
  return SOURCES.find(s => s.id === id) || SOURCES[0];
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
  const sourceSummary = SOURCES.map(s => ({ ...s, count: items.filter(i => i.source === s.id).length })).filter(s => s.count > 0);

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
        SOURCES.map(src => {
          const srcItems = items.filter(i => i.source === src.id);
          return (
            <div key={src.id} style={{ background:'var(--bg2)', border:`1px solid var(--border)`, borderRadius:8, marginBottom:12, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom: srcItems.length ? '1px solid var(--border)' : 'none', borderLeft:`3px solid ${src.color}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:src.color }} />
                  <div style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em', color:src.color }}>{src.label}</div>
                  {srcItems.length > 0 && <div style={{ fontSize:11, color:'var(--muted)' }}>({srcItems.length})</div>}
                </div>
              </div>
              {srcItems.length === 0 && (
                <div style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No items in this category.</div>
              )}
              {srcItems.map(item => {
                const catLabel = CATEGORIES.find(c => c.id === item.category)?.label || item.category;
                return (
                  <GearItemRow key={item.id} item={item} editId={editId} editForm={editForm} catLabel={catLabel}
                    onEdit={() => { setEditId(item.id); setEditForm({ category: item.category, item: item.item, source: item.source, notes: item.notes||'' }); setShowAdd(false); }}
                    onSave={handleEdit} onCancel={() => setEditId(null)} onDelete={() => handleDelete(item.id)}
                    setEditForm={setEditForm} />
                );
              })}
            </div>
          );
        })
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
          <span style={{ fontSize:13, fontWeight:500, color:'var(--text)' }}>{item.item}</span>
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
