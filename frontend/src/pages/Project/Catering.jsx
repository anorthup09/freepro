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
  BREAKFAST: { color:'#4ade80', bg:'rgba(74,222,128,0.08)', emoji:'🍳', label:'Breakfast' },
  LUNCH:     { color:'#4ade80', bg:'rgba(74,222,128,0.08)', emoji:'🥗', label:'Lunch' },
  DINNER:    { color:'#4ade80', bg:'rgba(74,222,128,0.08)', emoji:'🍽️', label:'Dinner' },
};

// Meal service type — DELIVERY | PICKUP | DINEIN
const SERVICE_LABEL = { DELIVERY:'Delivery', PICKUP:'Pick Up', DINEIN:'Dine-In', CREWMEAL:'Crew Meal' };
const svcOf = entry => entry?.service_type || (entry && entry.is_delivery === false ? 'PICKUP' : entry ? 'DELIVERY' : '');

export default function Catering({ project }) {
  const [days, setDays] = useState([]);
  const [cateringModal, setCateringModal] = useState(null);
  const [cateringForm, setCateringForm] = useState({ mealTypes:[], name:'', address:'', orderNumber:'', deliveryTime:'', endTime:'', serviceType:'' });
  const [expandedDays, setExpandedDays] = useState({});
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

  function openCateringModal(dayId, mealType) {
    if (mealType) {
      const day = days.find(d => d.id === dayId);
      const existing = (day?.catering || []).find(c => c.meal_type === mealType);
      setCateringForm({
        mealTypes: [mealType],
        name: existing?.name || '',
        address: existing?.address || '',
        orderNumber: existing?.order_number || '',
        deliveryTime: existing?.delivery_time || '',
        endTime: existing?.end_time || '',
        serviceType: existing?.service_type || '',
      });
    } else {
      setCateringForm({ mealTypes: [], name: '', address: '', orderNumber: '', deliveryTime: '', endTime: '', serviceType: '' });
    }
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
      serviceType: existing?.service_type || '',
    });
  }

  async function saveCatering(e) {
    e.preventDefault();
    const dayId = cateringModal;
    const { mealTypes, name, address, orderNumber, deliveryTime, endTime, serviceType } = cateringForm;
    if (!mealTypes.length) return;
    try {
      const results = await api.saveCatering(project.id, dayId, { mealTypes, name, address, orderNumber, deliveryTime, endTime, serviceType, deleteMealTypes: [] });
      setDays(ds => ds.map(d => {
        if (d.id !== dayId) return d;
        const kept = (d.catering||[]).filter(c => !mealTypes.includes(c.meal_type));
        return { ...d, catering: [...kept, ...results] };
      }));
      // Clear fields and deselect meal so user can pick the next one
      setCateringForm({ mealTypes: [], name: '', address: '', orderNumber: '', deliveryTime: '', serviceType: '' });
      flashSaved();
    } catch(e) { alert(e.message); }
  }

  return (
    <div>
      {savedToast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#22c55e', color:'var(--text)', fontSize:13, fontWeight:600, padding:'8px 18px', borderRadius:20, zIndex:9999, boxShadow:'0 2px 12px rgba(0,0,0,0.25)', pointerEvents:'none', letterSpacing:'.02em' }}>
          ✓ Saved
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div className="page-title">Catering/Meals</div>
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
                <button title="Add / edit a meal" onClick={() => openCateringModal(d.id)}
                  style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', padding:6, display:'inline-flex', alignItems:'center', lineHeight:1 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
              </div>
              <div style={{ padding:'10px 14px' }}>
                {!catering.length && (
                  <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No meals set yet.</div>
                )}
                {['BREAKFAST','LUNCH','DINNER'].filter(mt => expandedDays[d.id] || byMeal[mt]).map(mt => {
                  const mc = MEAL_COLORS[mt];
                  const entry = byMeal[mt];
                  return (
                    <div key={mt} onClick={() => openCateringModal(d.id, mt)}
                      title={entry ? `Edit ${mc.label}` : `Add ${mc.label}`}
                      style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8, paddingBottom:8, borderBottom: mt !== 'DINNER' ? '1px solid var(--border)' : 'none', cursor:'pointer', borderRadius:6, marginLeft:-4, marginRight:-4, paddingLeft:4, paddingRight:4 }}>
                      <div style={{ fontSize:11, fontWeight:700, color: mc.color, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span>{mc.label}</span>
                        {entry && (entry.service_type
                          ? <span style={{ fontSize:8, fontWeight:800, color:'var(--orange)', border:'1px solid var(--orange)', background:'rgba(232,80,10,0.12)', borderRadius:9, padding:'1px 6px', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>{SERVICE_LABEL[entry.service_type]}</span>
                          : <span style={{ fontSize:8, fontWeight:800, color:'var(--muted)', border:'1px solid var(--border)', borderRadius:9, padding:'1px 6px', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }}>— Select —</span>)}
                      </div>
                      {entry ? (
                        <div style={{ textAlign:'right', fontSize:11 }}>
                          <div style={{ fontWeight:600, color:'var(--text)' }}>{entry.name}</div>
                          {entry.address && <div style={{ color:'var(--muted)', fontSize:10 }}>{entry.address}</div>}
                          {entry.order_number && <div style={{ color:'var(--muted)', fontSize:10 }}>Order #{entry.order_number}</div>}
                          {entry.delivery_time && <div style={{ color: mc.color, fontSize:10 }}>{fmtTime(entry.delivery_time)}</div>}
                        </div>
                      ) : (
                        <span style={{ fontSize:10, color:'var(--muted)', fontStyle:'italic' }}>Not set</span>
                      )}
                    </div>
                  );
                })}
                {catering.length > 0 && catering.length < 3 && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize:10, padding:'2px 8px', color:'var(--muted)' }}
                    onClick={() => setExpandedDays(m => ({ ...m, [d.id]: !m[d.id] }))}>
                    {expandedDays[d.id] ? '▾ Hide empty meals' : '▸ Show all meals'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Catering Modal */}
      {cateringModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setCateringModal(null)}>
          <div className="modal">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
              <div className="modal-title" style={{ marginBottom:0 }}>Add Catering Info</div>
              <select value={cateringForm.serviceType}
                title="Delivery: food comes to you. Pick Up / Dine-In: the address becomes a driving stop on the schedule."
                onChange={e => setCateringForm(f=>({ ...f, serviceType: e.target.value }))}
                style={{ width:130, flexShrink:0, fontSize:12, fontWeight:700, background:'var(--bg)', border:`1px solid ${cateringForm.serviceType ? 'var(--orange)' : 'var(--border)'}`, color: cateringForm.serviceType ? 'var(--orange)' : 'var(--muted)', borderRadius:6, padding:'6px 10px', cursor:'pointer' }}>
                <option value="">— Select —</option>
                <option value="DELIVERY">Delivery</option>
                <option value="PICKUP">Pick Up</option>
                <option value="DINEIN">Dine-In</option>
                <option value="CREWMEAL">Crew Meal</option>
              </select>
            </div>
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
                        {mc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Name of Catering / Restaurant</label><input value={cateringForm.name} onChange={e => setCateringForm(f=>({...f,name:e.target.value}))} placeholder="Catering Co." /></div>
                <div className="field span2"><label>Address</label><input value={cateringForm.address} onChange={e => setCateringForm(f=>({...f,address:e.target.value}))} placeholder="123 Main St" /></div>
                <div className="field span2"><label>Order Number</label><input value={cateringForm.orderNumber} onChange={e => setCateringForm(f=>({...f,orderNumber:e.target.value}))} placeholder="#12345" /></div>
                <div className="field"><label>Reservation/Delivery/Start Time</label><input type="time" value={cateringForm.deliveryTime} onChange={e => setCateringForm(f=>({...f,deliveryTime:e.target.value}))} /></div>
                <div className="field"><label>End Time</label><input type="time" value={cateringForm.endTime} onChange={e => setCateringForm(f=>({...f,endTime:e.target.value}))} /></div>
              </div>
              <div className="btn-row" style={{ display:'flex', alignItems:'center' }}>
                <button className="btn btn-primary" type="submit">Save Catering</button>
                <button type="button" className="btn btn-ghost" onClick={() => setCateringModal(null)}>Cancel</button>
                <button type="button" title="Clear the fields"
                  onClick={() => setCateringForm(f => ({ ...f, name:'', address:'', orderNumber:'', deliveryTime:'' }))}
                  style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--muted)', cursor:'pointer', padding:6, display:'inline-flex', alignItems:'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
