import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

function fmtTime(str) {
  if (!str) return '';
  if (/AM|PM/i.test(str)) return str;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h)) return str;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function parseDay(dateStr) {
  if (!dateStr) return new Date();
  return new Date(dateStr.slice(0, 10) + 'T12:00:00');
}

const MEAL_COLORS = {
  BREAKFAST: { color:'#fbbf24', bg:'rgba(251,191,36,0.10)', emoji:'🍳', label:'Breakfast' },
  LUNCH:     { color:'#4ade80', bg:'rgba(74,222,128,0.08)',  emoji:'🥗', label:'Lunch' },
  DINNER:    { color:'#f87171', bg:'rgba(248,113,113,0.10)', emoji:'🍽️', label:'Dinner' },
};

export default function Catering({ project }) {
  const [days, setDays] = useState([]);
  const [cateringModal, setCateringModal] = useState(null);
  const [cateringForm, setCateringForm] = useState({ mealTypes:[], name:'', address:'', orderNumber:'', deliveryTime:'' });
  const [savedToast, setSavedToast] = useState(false);
  const toastTimer = React.useRef(null);

  function flashSaved() {
    setSavedToast(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setSavedToast(false), 1800);
  }

  useEffect(() => {
    api.getSchedule(project.id).then(d => {
      setDays([...d].sort((a,b) => (a.date||'').localeCompare(b.date||'')));
    }).catch(() => {});
  }, [project.id]);

  function openCateringModal(dayId) {
    setCateringForm({ mealTypes: [], name: '', address: '', orderNumber: '', deliveryTime: '' });
    setCateringModal(dayId);
  }

  function selectMealType(mt) {
    const day = days.find(d => d.id === cateringModal);
    const existing = (day?.catering || []).find(c => c.meal_type === mt);
    setCateringForm({
      mealTypes: [mt],
      name: existing?.name || '',
      address: existing?.address || '',
      orderNumber: existing?.order_number || '',
      deliveryTime: existing?.delivery_time || '',
    });
  }

  async function saveCatering(e) {
    e.preventDefault();
    const dayId = cateringModal;
    const { mealTypes, name, address, orderNumber, deliveryTime } = cateringForm;
    if (!mealTypes.length) return;
    try {
      const results = await api.saveCatering(project.id, dayId, { mealTypes, name, address, orderNumber, deliveryTime, deleteMealTypes: [] });
      setDays(ds => ds.map(d => {
        if (d.id !== dayId) return d;
        const kept = (d.catering||[]).filter(c => !mealTypes.includes(c.meal_type));
        return { ...d, catering: [...kept, ...results] };
      }));
      // Clear fields and deselect meal so user can pick the next one
      setCateringForm({ mealTypes: [], name: '', address: '', orderNumber: '', deliveryTime: '' });
      flashSaved();
    } catch(e) { alert(e.message); }
  }

  return (
    <div>
      {savedToast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#22c55e', color:'#fff', fontSize:13, fontWeight:600, padding:'8px 18px', borderRadius:20, zIndex:9999, boxShadow:'0 2px 12px rgba(0,0,0,0.25)', pointerEvents:'none', letterSpacing:'.02em' }}>
          ✓ Saved
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div className="page-title">Catering</div>
          <div className="page-sub">{project.city}, {project.state}</div>
        </div>
      </div>

      {days.length === 0 && (
        <div className="empty">No shoot days yet — add days in the Schedule tab first.</div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
        {days.map((d, i) => {
          const catering = d.catering || [];
          const byMeal = Object.fromEntries(catering.map(c => [c.meal_type, c]));
          return (
            <div key={d.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontWeight:700, fontSize:13 }}>
                  Day {i+1} · {parseDay(d.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:'3px 10px' }} onClick={() => openCateringModal(d.id)}>
                  + Add Catering
                </button>
              </div>
              <div style={{ padding:'10px 14px' }}>
                {['BREAKFAST','LUNCH','DINNER'].map(mt => {
                  const mc = MEAL_COLORS[mt];
                  const entry = byMeal[mt];
                  return (
                    <div key={mt} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, paddingBottom:8, borderBottom: mt !== 'DINNER' ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontSize:11, fontWeight:700, color: mc.color }}>{mc.emoji} {mc.label}</div>
                      {entry ? (
                        <div style={{ textAlign:'right', fontSize:11 }}>
                          <div style={{ fontWeight:600, color:'var(--text)' }}>{entry.name}</div>
                          {entry.address && <div style={{ color:'var(--muted)', fontSize:10 }}>{entry.address}</div>}
                          {entry.order_number && <div style={{ color:'var(--muted)', fontSize:10 }}>Order #{entry.order_number}</div>}
                          {entry.delivery_time && <div style={{ color: mc.color, fontSize:10 }}>🚚 {fmtTime(entry.delivery_time)}</div>}
                        </div>
                      ) : (
                        <span style={{ fontSize:10, color:'var(--muted)', fontStyle:'italic' }}>Not set</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Catering Modal */}
      {cateringModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setCateringModal(null)}>
          <div className="modal">
            <div className="modal-title">Add Catering Info</div>
            <form onSubmit={saveCatering}>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:8 }}>Meal(s)</div>
                <div style={{ display:'flex', gap:10 }}>
                  {['BREAKFAST','LUNCH','DINNER'].map(mt => {
                    const mc = MEAL_COLORS[mt];
                    const sel = cateringForm.mealTypes.includes(mt);
                    return (
                      <button key={mt} type="button"
                        onClick={() => selectMealType(mt)}
                        style={{ flex:1, padding:'8px 6px', borderRadius:8, border:`2px solid ${sel ? mc.color : 'var(--border)'}`, background: sel ? mc.bg : 'var(--bg)', color: sel ? mc.color : 'var(--muted)', fontWeight:700, fontSize:12, cursor:'pointer', transition:'all .12s' }}>
                        {mc.emoji} {mc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Name of Catering / Restaurant</label><input value={cateringForm.name} onChange={e => setCateringForm(f=>({...f,name:e.target.value}))} placeholder="Catering Co." /></div>
                <div className="field span2"><label>Address</label><input value={cateringForm.address} onChange={e => setCateringForm(f=>({...f,address:e.target.value}))} placeholder="123 Main St" /></div>
                <div className="field"><label>Order Number</label><input value={cateringForm.orderNumber} onChange={e => setCateringForm(f=>({...f,orderNumber:e.target.value}))} placeholder="#12345" /></div>
                <div className="field"><label>Est. Delivery Time</label><input type="time" value={cateringForm.deliveryTime} onChange={e => setCateringForm(f=>({...f,deliveryTime:e.target.value}))} /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" type="submit">Save Catering</button>
                <button type="button" className="btn btn-ghost" onClick={() => setCateringModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
