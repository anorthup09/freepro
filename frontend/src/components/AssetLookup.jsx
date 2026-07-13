import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Asset Management — company gear inventory, same look-up pattern as the
// Roster database: search, detail card with edit/delete, + New Asset.
const STATUSES = [
  ['AVAILABLE', 'Available', '#5ABF80'],
  ['CHECKED_OUT', 'Checked Out', '#e6c229'],
  ['IN_REPAIR', 'In Repair', '#f87171'],
  ['RETIRED', 'Retired', '#7A7565'],
];
const statusOf = s => STATUSES.find(x => x[0] === s) || STATUSES[0];
const fmt$ = n => n == null || n === '' ? '' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

const BLANK = { assetTag:'', name:'', category:'', make:'', model:'', serialNumber:'', qty:1, status:'AVAILABLE', location:'', assignedTo:'', purchaseDate:'', purchasePrice:'', currentValue:'', notes:'' };

export default function AssetLookup() {
  const [assets, setAssets] = useState([]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('');
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(BLANK);

  useEffect(() => { api.getAssets().then(setAssets).catch(() => setAssets([])); }, []);

  const cats = useMemo(() => [...new Set(assets.map(a => a.category).filter(Boolean))].sort(), [assets]);
  const q = query.toLowerCase().trim();
  const matches = assets.filter(a =>
    (!cat || a.category === cat) &&
    (!q || [a.name, a.asset_tag, a.category, a.make, a.model, a.serial_number, a.location, a.assigned_to]
      .some(v => (v || '').toLowerCase().includes(q))));

  function startEdit() {
    const d = detail;
    setForm({
      assetTag: d.asset_tag || '', name: d.name || '', category: d.category || '', make: d.make || '',
      model: d.model || '', serialNumber: d.serial_number || '', qty: d.qty ?? 1, status: d.status || 'AVAILABLE',
      location: d.location || '', assignedTo: d.assigned_to || '',
      purchaseDate: d.purchase_date ? String(d.purchase_date).slice(0, 10) : '',
      purchasePrice: d.purchase_price ?? '', currentValue: d.current_value ?? '', notes: d.notes || '',
    });
    setEditing(true);
  }

  async function save(e) {
    e.preventDefault(); setSaving(true);
    try {
      const updated = await api.updateAsset(detail.id, form);
      setAssets(rs => rs.map(a => a.id === updated.id ? updated : a));
      setDetail(updated); setEditing(false);
    } catch (err) { alert(err.message); }
    setSaving(false);
  }

  async function remove() {
    if (!confirm(`Delete "${detail.name}" from the asset database? This cannot be undone.`)) return;
    try {
      await api.deleteAsset(detail.id);
      setAssets(rs => rs.filter(a => a.id !== detail.id));
      setDetail(null); setEditing(false);
    } catch (err) { alert(err.message); }
  }

  async function addAsset(e) {
    e.preventDefault();
    try {
      const a = await api.createAsset(addForm);
      setAssets(rs => [...rs, a]);
      setShowAdd(false); setAddForm(BLANK); setDetail(a); setEditing(false);
    } catch (err) { alert(err.message); }
  }

  const fields = (f, set) => (
    <div className="form-grid" style={{ marginBottom: 12 }}>
      <div className="field"><label>Asset Tag / ID</label><input value={f.assetTag} onChange={e => set(v=>({...v,assetTag:e.target.value}))} placeholder="UM-0042" /></div>
      <div className="field"><label>Category</label><input value={f.category} onChange={e => set(v=>({...v,category:e.target.value}))} placeholder="Camera, Lens, Audio…" list="asset-cats" /></div>
      <div className="field span2"><label>Name</label><input value={f.name} onChange={e => set(v=>({...v,name:e.target.value}))} required placeholder="Sony FX6 Body" /></div>
      <div className="field"><label>Make</label><input value={f.make} onChange={e => set(v=>({...v,make:e.target.value}))} /></div>
      <div className="field"><label>Model</label><input value={f.model} onChange={e => set(v=>({...v,model:e.target.value}))} /></div>
      <div className="field"><label>Serial Number</label><input value={f.serialNumber} onChange={e => set(v=>({...v,serialNumber:e.target.value}))} /></div>
      <div className="field"><label>Qty</label><input type="number" min="0" value={f.qty} onChange={e => set(v=>({...v,qty:e.target.value}))} /></div>
      <div className="field"><label>Status</label>
        <select value={f.status} onChange={e => set(v=>({...v,status:e.target.value}))}>
          {STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>
      <div className="field"><label>Location</label><input value={f.location} onChange={e => set(v=>({...v,location:e.target.value}))} placeholder="STL cage, DEN office…" /></div>
      <div className="field"><label>Assigned To</label><input value={f.assignedTo} onChange={e => set(v=>({...v,assignedTo:e.target.value}))} /></div>
      <div className="field"><label>Purchase Date</label><input type="date" value={f.purchaseDate} onChange={e => set(v=>({...v,purchaseDate:e.target.value}))} /></div>
      <div className="field"><label>Purchase Price</label><input type="number" step="0.01" value={f.purchasePrice} onChange={e => set(v=>({...v,purchasePrice:e.target.value}))} /></div>
      <div className="field"><label>Current Value</label><input type="number" step="0.01" value={f.currentValue} onChange={e => set(v=>({...v,currentValue:e.target.value}))} /></div>
      <div className="field span2"><label>Notes</label><textarea rows={3} value={f.notes} onChange={e => set(v=>({...v,notes:e.target.value}))} /></div>
      <datalist id="asset-cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
    </div>
  );

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Asset Database <span style={{ color:'var(--muted)', fontWeight:400, textTransform:'none', letterSpacing:'normal' }}>· {assets.length} assets</span></div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)}>+ New Asset</button>
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search by name, tag, serial, category, location, or person…" style={{ marginBottom:8 }} />
      {cats.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
          {['', ...cats].map(c => (
            <button key={c || 'all'} onClick={() => setCat(c)}
              style={{ background: cat === c ? 'rgba(232,80,10,0.2)' : 'transparent', border:`1px solid ${cat === c ? 'var(--orange)' : 'var(--border)'}`,
                color: cat === c ? 'var(--orange)' : 'var(--muted)', borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer' }}>
              {c || 'All'}
            </button>
          ))}
        </div>
      )}

      <div className="pos-table-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
        {matches.slice(0, q || cat ? 50 : 25).map(a => {
          const [, sLabel, sColor] = statusOf(a.status);
          return (
            <div key={a.id} onClick={() => { setDetail(a); setEditing(false); }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:600 }}>{a.name}{a.asset_tag ? <span style={{ color:'var(--muted)', fontWeight:400 }}> · {a.asset_tag}</span> : ''}</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{[a.category, [a.make, a.model].filter(Boolean).join(' '), a.location].filter(Boolean).join(' · ')}</div>
              </div>
              {Number(a.qty) > 1 && <span style={{ fontSize:10, color:'var(--muted)', flexShrink:0 }}>×{a.qty}</span>}
              <span style={{ background:`${sColor}22`, border:`1px solid ${sColor}`, color:sColor, borderRadius:12, padding:'2px 10px', fontSize:9, fontWeight:800, textTransform:'uppercase', flexShrink:0 }}>{sLabel}</span>
            </div>
          );
        })}
        {matches.length === 0 && <div className="empty" style={{ padding:'12px 14px' }}>{assets.length ? 'No match found.' : 'No assets yet — add one or import the spreadsheet.'}</div>}
        {matches.length > (q || cat ? 50 : 25) && <div style={{ padding:'7px 14px', fontSize:10, color:'var(--muted)' }}>{matches.length - (q || cat ? 50 : 25)} more — refine the search to see them.</div>}
      </div>

      {detail && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px 18px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div>
              <div style={{ fontWeight:600, fontSize:14 }}>{detail.name}{detail.asset_tag ? <span style={{ color:'var(--muted)', fontWeight:400 }}> · {detail.asset_tag}</span> : ''}</div>
              <div style={{ fontSize:11, color:'var(--muted)' }}>{[detail.category, [detail.make, detail.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {!editing && <button className="btn btn-ghost btn-sm" onClick={startEdit}>Edit</button>}
              {!editing && <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e08080)' }} onClick={remove}>Delete</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => { setDetail(null); setEditing(false); }}>✕</button>
            </div>
          </div>
          {editing ? (
            <form onSubmit={save}>
              {fields(form, setForm)}
              <div className="btn-row">
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 24px', fontSize:12 }}>
              <div><span style={{ color:'var(--muted)' }}>Status </span>{statusOf(detail.status)[1]}</div>
              <div><span style={{ color:'var(--muted)' }}>Qty </span>{detail.qty ?? 1}</div>
              {detail.serial_number && <div><span style={{ color:'var(--muted)' }}>Serial </span>{detail.serial_number}</div>}
              {detail.location && <div><span style={{ color:'var(--muted)' }}>Location </span>{detail.location}</div>}
              {detail.assigned_to && <div><span style={{ color:'var(--muted)' }}>Assigned To </span>{detail.assigned_to}</div>}
              {detail.purchase_date && <div><span style={{ color:'var(--muted)' }}>Purchased </span>{new Date(String(detail.purchase_date).slice(0,10)+'T12:00:00').toLocaleDateString()}</div>}
              {detail.purchase_price != null && <div><span style={{ color:'var(--muted)' }}>Purchase Price </span>{fmt$(detail.purchase_price)}</div>}
              {detail.current_value != null && <div><span style={{ color:'var(--muted)' }}>Current Value </span>{fmt$(detail.current_value)}</div>}
              {detail.extra && Object.keys(detail.extra).length > 0 && Object.entries(detail.extra).map(([k, v]) => (
                v ? <div key={k}><span style={{ color:'var(--muted)' }}>{k} </span>{String(v)}</div> : null
              ))}
              {detail.notes && <div style={{ gridColumn:'1/-1', marginTop:4, whiteSpace:'pre-wrap', color:'var(--muted)', fontSize:11, borderTop:'1px solid var(--border)', paddingTop:6 }}>{detail.notes}</div>}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal" style={{ maxWidth:560 }}>
            <div className="modal-title">New Asset</div>
            <form onSubmit={addAsset}>
              {fields(addForm, setAddForm)}
              <div className="btn-row">
                <button className="btn btn-primary">Add</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
