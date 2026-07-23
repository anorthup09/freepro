import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../api.js';

const LOC_TYPES = ['PRIMARY_VENUE', 'CREW_HOTEL', 'AIRPORT', 'OTHER'];
const LOC_LABELS = { PRIMARY_VENUE: 'Shooting Location', CREW_HOTEL: 'Hotel', SECONDARY: 'Rental Car Location', AIRPORT: 'Airport', OTHER: 'Other' };
const BLANK_LOC = { name: '', address: '', type: 'PRIMARY_VENUE', emoji: '', arrivalNotes: '', spaceMap: null };

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// Free place search (OpenStreetMap Nominatim) that fills name + address
function PlaceSearch({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounce = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounce.current);
    if (!val.trim()) { setResults([]); setOpen(false); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=6&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch { setResults([]); }
      setLoading(false);
    }, 400);
  }

  function pick(item) {
    const name = item.name || item.display_name.split(',')[0].trim();
    setQuery(name);
    setOpen(false);
    onSelect({ name, address: item.display_name });
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input value={query} onChange={handleChange} onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search for a place…" autoComplete="off" style={{ width: '100%', boxSizing: 'border-box' }} />
      {loading && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--muted)' }}>…</div>}
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 999, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {results.map((item, i) => (
            <div key={i} onMouseDown={() => pick(item)}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none', lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name || item.display_name.split(',')[0]}</div>
              <div style={{ color: 'var(--muted)', fontSize: 11 }}>{item.display_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Locations tab — venues, hotels, airports, and arrival notes for the shoot.
// The same data flows through to every share view (producer, crew, talent, client).
export default function Locations({ project, setProject }) {
  const [showLocModal, setShowLocModal] = useState(false);
  const [editLocId, setEditLocId] = useState(null);
  const [locForm, setLocForm] = useState(BLANK_LOC);
  const [uploading, setUploading] = useState({});
  const [hospBusy, setHospBusy] = useState({});
  const fileRefs = useRef({});

  // Auto-source the nearest hospital (ER) into a shooting location's notes.
  async function sourceHospital(locId) {
    setHospBusy(b => ({ ...b, [locId]: true }));
    try {
      const loc = await api.nearestHospital(project.id, locId);
      setProject(p => ({ ...p, locations: p.locations.map(l => l.id === locId ? loc : l) }));
    } catch { /* leave notes as-is on failure */ }
    finally { setHospBusy(b => ({ ...b, [locId]: false })); }
  }

  // Attach / replace a floor plan or space map on an existing location tile
  async function handleMapFile(locId, file) {
    if (!file) return;
    setUploading(u => ({ ...u, [locId]: true }));
    try {
      const base64 = await fileToBase64(file);
      await api.updateLocation(project.id, locId, { spaceMap: base64 });
      setProject(p => ({ ...p, locations: p.locations.map(l => l.id === locId ? { ...l, space_map: base64 } : l) }));
    } catch (e) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploading(u => ({ ...u, [locId]: false }));
    }
  }

  async function clearMap(locId) {
    await api.updateLocation(project.id, locId, { spaceMap: null });
    setProject(p => ({ ...p, locations: p.locations.map(l => l.id === locId ? { ...l, space_map: null } : l) }));
  }

  async function addLocation(e) {
    e.preventDefault();
    try {
      let saved;
      if (editLocId) {
        saved = await api.updateLocation(project.id, editLocId, locForm);
        setProject(p => ({ ...p, locations: p.locations.map(l => l.id === editLocId ? saved : l) }));
      } else {
        saved = await api.createLocation(project.id, locForm);
        setProject(p => ({ ...p, locations: [...(p.locations || []), saved] }));
      }
      setShowLocModal(false); setEditLocId(null); setLocForm(BLANK_LOC);
      // Shooting locations auto-source the nearest ER into their notes for the call sheet.
      if (saved && saved.type === 'PRIMARY_VENUE' && saved.address
          && !/nearest hospital/i.test(saved.notes || '')) {
        sourceHospital(saved.id);
      }
    } catch (e) { alert(e.message); }
  }

  function openEditLocation(l) {
    setLocForm({ name: l.name || '', address: l.address || '', type: l.type || 'PRIMARY_VENUE', emoji: l.emoji || '', arrivalNotes: l.arrival_notes || '', spaceMap: l.space_map || null });
    setEditLocId(l.id);
    setShowLocModal(true);
  }

  async function deleteLocation(id) {
    if (!confirm('Remove this location?')) return;
    await api.deleteLocation(project.id, id);
    setProject(p => ({ ...p, locations: p.locations.filter(l => l.id !== id) }));
  }

  const locations = project.locations || [];

  return (
    <div>
      <div className="sched-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="sec-lbl" style={{ marginBottom: 0, marginTop: 0, fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>Locations</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowLocModal(true)}>+ Add Location</button>
      </div>
      {!locations.length && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No locations added yet.</div>
      )}
      {LOC_TYPES.filter(t => locations.some(l => l.type === t)).map(type => {
        const group = locations.filter(l => l.type === type);
        return (
          <div key={type} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 4 }}>{LOC_LABELS[type]}</div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {group.map((l, i) => (
                <div key={l.id} style={{ padding: '10px 16px', borderBottom: i < group.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</span>
                    {l.address
                      ? <a href={`https://maps.google.com/?q=${encodeURIComponent(l.address)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--tan)', textDecoration: 'none' }}>{l.address}</a>
                      : <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>}
                    <div style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                      {l.space_map && (
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => clearMap(l.id)}>Remove Map</button>
                      )}
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 8px' }}
                        onClick={() => fileRefs.current[l.id]?.click()} disabled={uploading[l.id]}>
                        {uploading[l.id] ? 'Uploading…' : l.space_map ? 'Replace Map' : '+ Upload Map'}
                      </button>
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        ref={el => fileRefs.current[l.id] = el}
                        onChange={e => { handleMapFile(l.id, e.target.files[0]); e.target.value = ''; }} />
                      <button title="Edit name / address (override what the map search filled in)"
                        style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }} onClick={() => openEditLocation(l)}>✎</button>
                      <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }} onClick={() => deleteLocation(l.id)}>✕</button>
                    </div>
                  </div>
                  {l.arrival_notes && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, whiteSpace: 'pre-wrap' }}><span style={{ fontWeight: 700, color: 'var(--tan)' }}>Arrival: </span>{l.arrival_notes}</div>}
                  {/* Nearest hospital — auto-sourced for shooting locations, flows to the call sheet */}
                  {type === 'PRIMARY_VENUE' && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span>🏥</span>
                      {hospBusy[l.id]
                        ? <span style={{ fontStyle: 'italic' }}>Finding nearest hospital…</span>
                        : l.notes
                          ? <span><span style={{ fontWeight: 700, color: 'var(--tan)' }}>{l.notes.replace(/^Nearest Hospital:\s*/i, 'Nearest Hospital: ')}</span></span>
                          : <span style={{ fontStyle: 'italic' }}>No hospital sourced yet</span>}
                      <button title="Re-source the nearest hospital" onClick={() => sourceHospital(l.id)} disabled={hospBusy[l.id]}
                        style={{ background: 'none', border: 'none', color: 'var(--tan)', cursor: 'pointer', fontSize: 11, padding: 0 }}>↻</button>
                    </div>
                  )}
                  {l.space_map && (
                    <div style={{ marginTop: 8 }}>
                      <img src={l.space_map} alt={`Space map for ${l.name}`} style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 6, display: 'block' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {showLocModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && (setShowLocModal(false), setEditLocId(null))}>
          <div className="modal">
            <div className="modal-title">{editLocId ? 'Edit Location' : 'Add Location'}</div>
            <form onSubmit={addLocation}>
              <div className="form-grid" style={{ marginBottom: 12 }}>
                <div className="field span2">
                  <label>Search Place</label>
                  <PlaceSearch onSelect={({ name, address }) => setLocForm(f => ({ ...f, name, address }))} />
                </div>
                <div className="field span2"><label>Name</label><input value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} required placeholder="Auto-filled from search or type manually" /></div>
                <div className="field span2"><label>Address</label><input value={locForm.address} onChange={e => setLocForm(f => ({ ...f, address: e.target.value }))} required placeholder="Auto-filled from search or type manually" /></div>
                <div className="field"><label>Type</label>
                  <select value={locForm.type} onChange={e => setLocForm(f => ({ ...f, type: e.target.value }))}>
                    <option value="PRIMARY_VENUE">Shooting Location</option>
                    <option value="CREW_HOTEL">Hotel</option>
                    <option value="AIRPORT">Airport</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="field"><label>Emoji</label><input value={locForm.emoji} onChange={e => setLocForm(f => ({ ...f, emoji: e.target.value }))} placeholder="🏛" /></div>
                <div className="field span2"><label>Arrival Notes</label><textarea value={locForm.arrivalNotes} onChange={e => setLocForm(f => ({ ...f, arrivalNotes: e.target.value }))} rows={2} placeholder="Parking, entrance, check-in, loading dock…" /></div>
                <div className="field span2"><label>Room / Space Map</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRefs.current.__modal?.click()}>
                      {locForm.spaceMap ? 'Replace Map' : '+ Upload Map'}
                    </button>
                    {locForm.spaceMap && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLocForm(f => ({ ...f, spaceMap: null }))}>Remove</button>
                    )}
                    <input type="file" accept="image/*" style={{ display: 'none' }}
                      ref={el => fileRefs.current.__modal = el}
                      onChange={async e => { const file = e.target.files[0]; e.target.value = ''; if (file) { const b64 = await fileToBase64(file); setLocForm(f => ({ ...f, spaceMap: b64 })); } }} />
                  </div>
                  {locForm.spaceMap && <img src={locForm.spaceMap} alt="Space map preview" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 6, marginTop: 8, display: 'block' }} />}
                </div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">{editLocId ? 'Save Changes' : 'Add Location'}</button><button type="button" className="btn btn-ghost" onClick={() => { setShowLocModal(false); setEditLocId(null); setLocForm(BLANK_LOC); }}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
