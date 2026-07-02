import React, { useRef, useState } from 'react';
import { api } from '../../api.js';

const LOC_LABELS = { PRIMARY_VENUE:'Shooting Location', CREW_HOTEL:'Hotel', SECONDARY:'Rental Car Location', AIRPORT:'Airport', OTHER:'Other' };

export default function SpaceInfo({ project, setProject }) {
  const [uploading, setUploading] = useState({});
  const fileRefs = useRef({});

  const locations = project.locations || [];

  async function handleFile(locId, file) {
    if (!file) return;
    setUploading(u => ({ ...u, [locId]: true }));
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      await api.updateLocation(project.id, locId, { spaceMap: base64 });
      setProject(p => ({
        ...p,
        locations: p.locations.map(l => l.id === locId ? { ...l, space_map: base64 } : l)
      }));
    } catch (e) {
      alert('Upload failed: ' + e.message);
    } finally {
      setUploading(u => ({ ...u, [locId]: false }));
    }
  }

  async function clearMap(locId) {
    await api.updateLocation(project.id, locId, { spaceMap: null });
    setProject(p => ({
      ...p,
      locations: p.locations.map(l => l.id === locId ? { ...l, space_map: null } : l)
    }));
  }

  if (!locations.length) {
    return (
      <div style={{ padding:'40px 0', textAlign:'center', color:'var(--muted)', fontSize:13, fontStyle:'italic' }}>
        No locations added yet. Add locations on the Overview tab first.
      </div>
    );
  }

  return (
    <div style={{ maxWidth:800 }}>
      <div className="sec-lbl" style={{ marginBottom:16, fontWeight:700 }}>Room / Space Info</div>
      <div style={{ fontSize:12, color:'var(--muted)', marginBottom:20 }}>
        Attach a floor plan or space map to each location. These images will appear on the Crew and Producer share views under the location tiles.
      </div>

      {locations.map(l => (
        <div key={l.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, marginBottom:12, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom: l.space_map ? '1px solid var(--border)' : 'none' }}>
            <div>
              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600, marginBottom:2 }}>
                {LOC_LABELS[l.type] || l.type}
              </div>
              <div style={{ fontSize:14, fontWeight:600 }}>{l.emoji || '📍'} {l.name}</div>
              {l.address && <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{l.address}</div>}
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {l.space_map && (
                <button className="btn btn-ghost btn-sm" onClick={() => clearMap(l.id)}>Remove Map</button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => fileRefs.current[l.id]?.click()}
                disabled={uploading[l.id]}
              >
                {uploading[l.id] ? 'Uploading…' : l.space_map ? 'Replace Map' : '+ Upload Map'}
              </button>
              <input
                type="file"
                accept="image/*"
                style={{ display:'none' }}
                ref={el => fileRefs.current[l.id] = el}
                onChange={e => handleFile(l.id, e.target.files[0])}
              />
            </div>
          </div>
          {l.space_map && (
            <div style={{ padding:16 }}>
              <img
                src={l.space_map}
                alt={`Space map for ${l.name}`}
                style={{ maxWidth:'100%', borderRadius:6, display:'block' }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
