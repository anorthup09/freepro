import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

function authFetch(path, opts = {}) {
  return fetch(path, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
}

// Authenticated photo thumbnail (file endpoint needs the bearer token, so a
// plain <img src> can't load it)
function Photo({ id, size = 72, onClick }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    let obj;
    authFetch(`/api/foodie/photos/${id}/file`)
      .then(r => r.ok ? r.blob() : null)
      .then(b => { if (b) { obj = URL.createObjectURL(b); setUrl(obj); } });
    return () => obj && URL.revokeObjectURL(obj);
  }, [id]);
  if (!url) return <div style={{ width:size, height:size, borderRadius:10, background:'rgba(255,255,255,0.05)', flexShrink:0 }} />;
  return <img src={url} alt="" onClick={onClick}
    style={{ width:size, height:size, borderRadius:10, objectFit:'cover', flexShrink:0, cursor: onClick ? 'zoom-in' : 'default' }} />;
}

function Stars({ value, myValue, onRate, size = 17 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || myValue || 0;
  return (
    <span style={{ display:'inline-flex', gap:2 }} onMouseLeave={() => setHover(0)}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onMouseEnter={() => setHover(n)}
          onClick={() => onRate(myValue === n ? 0 : n)}
          title={myValue === n ? 'Tap to clear your rating' : `Rate ${n} star${n>1?'s':''}`}
          style={{ fontSize:size, lineHeight:1, cursor:'pointer', filter: n <= shown ? 'none' : 'grayscale(1) opacity(0.35)', transition:'filter .1s' }}>
          ⭐
        </span>
      ))}
      <span style={{ fontSize:11, color:'var(--muted)', marginLeft:6, alignSelf:'center' }}>
        {Number(value) ? `${Number(value).toFixed(1)} avg` : 'No ratings yet'}
      </span>
    </span>
  );
}

const PRICE_OPTS = ['$', '$$', '$$$', '$$$$'];

export default function FoodieRecs() {
  const { user, setUser } = useAuth();
  const [recs, setRecs] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:'', address:'', city:'', cuisine:'', price:'', notes:'' });
  const [formPhotos, setFormPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const markersRef = useRef([]);

  const load = () => api.getFoodieRecs().then(setRecs).catch(() => setRecs([]));
  useEffect(() => { load(); }, []);

  // ── Map: one pin per rec that geocoded ──
  useEffect(() => {
    if (!mapRef.current || !recs) return;
    if (!mapObj.current) {
      mapObj.current = L.map(mapRef.current, { scrollWheelZoom: false }).setView([39.1, -94.6], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors', maxZoom: 19,
      }).addTo(mapObj.current);
    }
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const pinned = recs.filter(r => r.lat != null && r.lon != null);
    pinned.forEach(r => {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#e8500a;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center"><span style="transform:rotate(45deg);font-size:12px">🍴</span></div>`,
        iconSize: [26, 26], iconAnchor: [13, 26], popupAnchor: [0, -24],
      });
      const m = L.marker([r.lat, r.lon], { icon }).addTo(mapObj.current);
      m.bindPopup(`<b>${r.name}</b><br>${[r.cuisine, r.price].filter(Boolean).join(' · ')}${Number(r.avg_rating) ? `<br>⭐ ${Number(r.avg_rating).toFixed(1)} (${r.rating_count})` : ''}${r.address ? `<br><span style="color:#777">${r.address}</span>` : ''}`);
      markersRef.current.push(m);
    });
    if (pinned.length) mapObj.current.fitBounds(L.latLngBounds(pinned.map(r => [r.lat, r.lon])).pad(0.25), { maxZoom: 13 });
  }, [recs]);

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const rec = await api.addFoodieRec(form);
      for (const f of formPhotos) {
        const b64 = await new Promise((res, rej) => {
          const rd = new FileReader();
          rd.onload = () => res(rd.result.split(',')[1]);
          rd.onerror = rej;
          rd.readAsDataURL(f);
        });
        await api.addFoodiePhoto(rec.id, { filename: f.name, mime: f.type, fileBase64: b64 });
      }
      setForm({ name:'', address:'', city:'', cuisine:'', price:'', notes:'' });
      setFormPhotos([]);
      setShowAdd(false);
      load();
    } catch (err) { alert(err.message); }
    setSaving(false);
  }

  async function rate(rec, rating) {
    try {
      const agg = await api.rateFoodieRec(rec.id, rating);
      setRecs(rs => [...rs.map(r => r.id === rec.id ? { ...r, ...agg } : r)]
        .sort((a, b) => (b.avg_rating - a.avg_rating) || (b.rating_count - a.rating_count)));
    } catch (err) { alert(err.message); }
  }

  async function addPhotoTo(rec, file) {
    try {
      const b64 = await new Promise((res, rej) => {
        const rd = new FileReader();
        rd.onload = () => res(rd.result.split(',')[1]);
        rd.onerror = rej;
        rd.readAsDataURL(file);
      });
      await api.addFoodiePhoto(rec.id, { filename: file.name, mime: file.type, fileBase64: b64 });
      load();
    } catch (err) { alert(err.message); }
  }

  async function remove(rec) {
    if (!confirm(`Remove ${rec.name}?`)) return;
    try { await api.deleteFoodieRec(rec.id); load(); } catch (err) { alert(err.message); }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <span style={{ fontSize:12, color:'#f0653c', fontWeight:700, letterSpacing:'0.04em' }}>🍜 Foodie Recs</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Reports</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div>
            <div className="page-title">Foodie Recs</div>
            <div className="page-sub">The team's favorite spots from the road — rate them, add photos, put them on the map</div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(s => !s)}>{showAdd ? 'Cancel' : '+ Add a Spot'}</button>
        </div>

        {showAdd && (
          <form onSubmit={submit} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:18, marginTop:14 }}>
            <div className="form-grid">
              <div className="field"><label>Restaurant Name *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} placeholder="Joe's KC BBQ" required /></div>
              <div className="field"><label>Cuisine</label><input value={form.cuisine} onChange={e => setForm(f => ({ ...f, cuisine:e.target.value }))} placeholder="BBQ, Tacos, Sushi…" /></div>
              <div className="field span2"><label>Address (used to pin it on the map)</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address:e.target.value }))} placeholder="3002 W 47th Ave, Kansas City, KS" /></div>
              <div className="field"><label>City</label><input value={form.city} onChange={e => setForm(f => ({ ...f, city:e.target.value }))} placeholder="Kansas City" /></div>
              <div className="field"><label>Price</label>
                <select value={form.price} onChange={e => setForm(f => ({ ...f, price:e.target.value }))}>
                  <option value="">—</option>
                  {PRICE_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field span2"><label>Why it's great</label><textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} placeholder="Get the burnt ends. Trust." /></div>
              <div className="field span2"><label>Photos</label>
                <input type="file" accept="image/*" multiple onChange={e => setFormPhotos([...e.target.files])} />
                {formPhotos.length > 0 && <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{formPhotos.length} photo{formPhotos.length > 1 ? 's' : ''} ready to upload</div>}
              </div>
            </div>
            <div className="btn-row" style={{ marginTop:12 }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Add Rec'}</button>
            </div>
          </form>
        )}

        <div ref={mapRef} style={{ height:340, borderRadius:12, border:'1px solid var(--border)', marginTop:16, overflow:'hidden', zIndex:0 }} />

        {recs === null && <div className="empty" style={{ marginTop:16 }}>Loading…</div>}
        {recs?.length === 0 && <div className="empty" style={{ marginTop:16 }}>No recs yet — be the first to add a spot.</div>}

        <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:16 }}>
          {(recs || []).map((r, i) => (
            <div key={r.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
              <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ fontSize:20, fontWeight:800, color: i < 3 ? 'var(--orange)' : 'var(--muted)', minWidth:34, textAlign:'center', lineHeight:1.2 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
                    <span style={{ fontSize:15, fontWeight:800 }}>{r.name}</span>
                    {r.cuisine && <span style={{ fontSize:11, color:'var(--tan)', fontWeight:600 }}>{r.cuisine}</span>}
                    {r.price && <span style={{ fontSize:11, color:'#5ABF80', fontWeight:700 }}>{r.price}</span>}
                    {r.city && <span style={{ fontSize:11, color:'var(--muted)' }}>📍 {r.city}</span>}
                  </div>
                  <div style={{ marginTop:5 }}>
                    <Stars value={r.avg_rating} myValue={r.my_rating} onRate={n => rate(r, n)} />
                    {r.rating_count > 0 && <span style={{ fontSize:10, color:'var(--muted)', marginLeft:4 }}>({r.rating_count} vote{r.rating_count > 1 ? 's' : ''})</span>}
                  </div>
                  {r.notes && <div style={{ fontSize:12, color:'var(--text)', marginTop:6, opacity:0.85 }}>{r.notes}</div>}
                  {r.address && <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>{r.address}{r.lat == null && ' · (no map pin — address didn\'t geocode)'}</div>}
                  {(r.photo_ids || []).length > 0 && (
                    <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                      {r.photo_ids.map(pid => <Photo key={pid} id={pid} onClick={() => setLightbox(pid)} />)}
                    </div>
                  )}
                  <div style={{ display:'flex', gap:14, marginTop:10, alignItems:'center' }}>
                    <label style={{ fontSize:10, color:'var(--muted)', cursor:'pointer' }}>
                      📷 Add photo
                      <input type="file" accept="image/*" style={{ display:'none' }}
                        onChange={e => { if (e.target.files[0]) addPhotoTo(r, e.target.files[0]); e.target.value = ''; }} />
                    </label>
                    <span style={{ fontSize:10, color:'var(--muted)' }}>added by {r.added_by}</span>
                    {(r.added_by === (user?.name || user?.email) || user?.role === 'ADMIN') && (
                      <button onClick={() => remove(r)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:10, cursor:'pointer', padding:0 }}>Remove</button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', cursor:'zoom-out', padding:20 }}>
          <Photo id={lightbox} size={Math.min(window.innerWidth - 40, 720)} />
        </div>
      )}
    </div>
  );
}
