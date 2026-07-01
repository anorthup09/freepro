import React, { useEffect, useState, useRef, useCallback } from 'react';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';

function fmt(dt) {
  return new Date(dt).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}
function fmtDT(dt) {
  return new Date(dt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
}
function fmtCost(n) {
  if (!n) return null;
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
}
function totalCost(items) {
  const t = items.reduce((s, i) => s + (parseFloat(i.cost) || 0), 0);
  return t > 0 ? '$' + t.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 }) : null;
}

function statusColor(s) {
  if (!s) return 'var(--muted)';
  const l = s.toLowerCase();
  if (l.includes('cancel')) return 'var(--red-text, #e08080)';
  if (l.includes('delay')) return 'var(--orange, #e8a030)';
  if (l.includes('time') || l.includes('arrived') || l.includes('landed')) return 'var(--green, #5abf80)';
  return 'var(--muted)';
}

// Debounce hook
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export default function Travel({ project }) {
  const [hotels, setHotels] = useState([]);
  const [flights, setFlights] = useState([]);
  const [cars, setCars] = useState([]);

  // Hotel add modal
  const [showHotel, setShowHotel] = useState(false);
  const [hotelQuery, setHotelQuery] = useState('');
  const [hotelSuggestions, setHotelSuggestions] = useState([]);
  const [hotelSearching, setHotelSearching] = useState(false);
  const [hotelForm, setHotelForm] = useState({ name:'', address:'', phone:'' });

  // Confirmation modal
  const [guestHotelId, setGuestHotelId] = useState(null);
  const [guestForm, setGuestForm] = useState({ selectedHotelId:'', crewMemberId:'', guestName:'', confirmation:'', checkIn:'', checkOut:'', cost:'' });

  // Flight modal
  const [showFlight, setShowFlight] = useState(false);
  const [flightLookupQuery, setFlightLookupQuery] = useState('');
  const [flightLookupDate, setFlightLookupDate] = useState('');
  const [flightLooking, setFlightLooking] = useState(false);
  const [flightLookupError, setFlightLookupError] = useState('');
  const [flightForm, setFlightForm] = useState({ crewMemberId:null, passengerName:'', flightNumber:'', airline:'', origin:'', destination:'', departTime:'', arriveTime:'', departDisplay:'', arriveDisplay:'', confirmation:'', isReturn:false, cost:'', status:'' });

  // Edit modals
  const [editFlight, setEditFlight] = useState(null); // flight object being edited
  const [editFlightForm, setEditFlightForm] = useState({ crewMemberId:'', confirmation:'', cost:'' });
  const [editGuest, setEditGuest] = useState(null); // { guest, hotelId }
  const [editGuestForm, setEditGuestForm] = useState({ confirmation:'', cost:'', checkIn:'', checkOut:'' });
  const [editCar, setEditCar] = useState(null); // car object being edited
  const [editCarForm, setEditCarForm] = useState({ vendor:'', pickupLocation:'', dropoffLocation:'', confirmation:'', cost:'', notes:'' });

  // Drive / car modals
  const [showCar, setShowCar] = useState(false);
  const [carForm, setCarForm] = useState({ crewMemberId:'', vendor:'', pickupLocation:'', dropoffLocation:'', pickupDate:'', dropoffDate:'', confirmation:'', cost:'', notes:'' });

  const projectCrew = project.crewAssignments || [];

  useEffect(() => {
    Promise.all([
      api.getHotels(project.id),
      api.getFlights(project.id),
      api.getRentalCars(project.id),
    ]).then(([h,f,c]) => { setHotels(h); setFlights(f); setCars(c); });
  }, [project.id]);

  // ── Hotel search ──────────────────────────────────────────────────────────
  const doHotelSearch = useCallback(async (q) => {
    if (q.length < 2) { setHotelSuggestions([]); return; }
    setHotelSearching(true);
    try {
      const results = await api.hotelSearch(q);
      setHotelSuggestions(results);
    } catch(_) { setHotelSuggestions([]); }
    setHotelSearching(false);
  }, []);

  const debouncedHotelSearch = useDebounce(doHotelSearch, 400);

  function onHotelQueryChange(e) {
    const q = e.target.value;
    setHotelQuery(q);
    setHotelForm(f => ({ ...f, name: q, address: '', phone: '' }));
    setHotelSuggestions([]);
    debouncedHotelSearch(q);
  }

  function selectHotelSuggestion(s) {
    setHotelQuery(s.name);
    setHotelForm({ name: s.name, address: s.address, phone: s.phone });
    setHotelSuggestions([]);
  }

  async function addHotel(e) {
    e.preventDefault();
    const h = await api.createHotel(project.id, hotelForm);
    setHotels(prev => [...prev, { ...h, guests:[] }]);
    setShowHotel(false);
    setHotelQuery(''); setHotelForm({ name:'', address:'', phone:'' }); setHotelSuggestions([]);
  }

  // ── Confirmations ─────────────────────────────────────────────────────────
  async function addGuest(e) {
    e.preventDefault();
    const targetHotelId = guestHotelId === '__pick__' ? guestForm.selectedHotelId : guestHotelId;
    try {
      const g = await api.addGuest(project.id, targetHotelId, {
        crewMemberId: guestForm.crewMemberId || null,
        guestName: guestForm.guestName,
        confirmation: guestForm.confirmation,
        checkIn: new Date(guestForm.checkIn + 'T12:00:00').toISOString(),
        checkOut: new Date(guestForm.checkOut + 'T12:00:00').toISOString(),
        cost: guestForm.cost || null,
      });
      setHotels(prev => prev.map(h => h.id === targetHotelId ? { ...h, guests: [...h.guests, g] } : h));
      setGuestHotelId(null);
      setGuestForm({ selectedHotelId:'', crewMemberId:'', guestName:'', confirmation:'', checkIn:'', checkOut:'', cost:'' });
    } catch(err) { alert(err.message); }
  }

  async function removeHotel(id) {
    if (!confirm('Remove this hotel and all its confirmations?')) return;
    await api.deleteHotel(project.id, id);
    setHotels(prev => prev.filter(h => h.id !== id));
  }

  async function removeGuest(hotelId, guestId) {
    await api.deleteGuest(project.id, guestId);
    setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, guests: h.guests.filter(g => g.id !== guestId) } : h));
  }

  // ── Flight lookup ──────────────────────────────────────────────────────────
  async function lookupFlight() {
    if (!flightLookupQuery) return;
    setFlightLooking(true); setFlightLookupError('');
    try {
      const data = await api.flightLookup(flightLookupQuery, flightLookupDate);
      setFlightForm(f => ({
        ...f,
        flightNumber: data.flightNumber || flightLookupQuery.toUpperCase(),
        airline: data.airline || f.airline,
        origin: data.origin || f.origin,
        destination: data.destination || f.destination,
        departTime: data.departTime ? new Date(data.departTime).toISOString().slice(0,16) : f.departTime,
        arriveTime: data.arriveTime ? new Date(data.arriveTime).toISOString().slice(0,16) : f.arriveTime,
        departDisplay: data.departDisplay || '',
        arriveDisplay: data.arriveDisplay || '',
        status: data.status || '',
      }));
    } catch(err) {
      setFlightLookupError(err.message || 'Flight not found');
    }
    setFlightLooking(false);
  }

  async function addFlight(e) {
    e.preventDefault();
    try {
      const f = await api.createFlight(project.id, {
        ...flightForm,
        passengerName: flightForm.passengerName || 'Unknown',
        departTime: flightForm.departTime
          ? new Date(flightForm.departTime).toISOString()
          : (flightLookupDate ? new Date(flightLookupDate + 'T12:00:00').toISOString() : null),
        arriveTime: flightForm.arriveTime ? new Date(flightForm.arriveTime).toISOString() : null,
        crewMemberId: flightForm.crewMemberId || null,
        departDisplay: flightForm.departDisplay || null,
        arriveDisplay: flightForm.arriveDisplay || null,
        cost: flightForm.cost || null,
      });
      setFlights(prev => [...prev, f]);
      setShowFlight(false);
      setFlightLookupQuery(''); setFlightLookupDate(''); setFlightLookupError('');
      setFlightForm({ crewMemberId:null, passengerName:'', flightNumber:'', airline:'', origin:'', destination:'', departTime:'', arriveTime:'', departDisplay:'', arriveDisplay:'', confirmation:'', isReturn:false, cost:'', status:'' });
    } catch(err) { alert(err.message); }
  }

  async function refreshFlightStatus(f) {
    if (!f.flight_number) return;
    const dateStr = f.depart_time ? f.depart_time.slice(0,10) : '';
    try {
      const data = await api.flightStatus(f.flight_number, dateStr);
      setFlights(prev => prev.map(fl => fl.id === f.id ? { ...fl, status: data.status } : fl));
    } catch(_) {}
  }

  async function removeFlight(id) {
    await api.deleteFlight(project.id, id);
    setFlights(prev => prev.filter(f => f.id !== id));
  }

  // ── Rental cars ───────────────────────────────────────────────────────────
  async function addCar(e) {
    e.preventDefault();
    const c = await api.createRentalCar(project.id, {
      ...carForm,
      pickupDate: carForm.pickupDate ? new Date(carForm.pickupDate).toISOString() : null,
      dropoffDate: carForm.dropoffDate ? new Date(carForm.dropoffDate).toISOString() : null,
      cost: carForm.cost || null,
    });
    setCars(prev => [...prev, c]);
    setShowCar(false);
    setCarForm({ crewMemberId:'', vendor:'', pickupLocation:'', dropoffLocation:'', pickupDate:'', dropoffDate:'', confirmation:'', cost:'', notes:'' });
  }
  async function removeCar(id) {
    await api.deleteRentalCar(project.id, id);
    setCars(prev => prev.filter(c => c.id !== id));
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────
  function openEditFlight(f) {
    setEditFlight(f);
    setEditFlightForm({ crewMemberId: f.crew_member_id || '', confirmation: f.confirmation || '', cost: f.cost || '' });
  }
  async function saveEditFlight(e) {
    e.preventDefault();
    try {
      const updated = await api.updateFlight(project.id, editFlight.id, {
        crewMemberId: editFlightForm.crewMemberId || null,
        confirmation: editFlightForm.confirmation || null,
        cost: editFlightForm.cost || null,
      });
      setFlights(prev => prev.map(f => f.id === editFlight.id ? { ...f, ...updated } : f));
      setEditFlight(null);
    } catch(err) { alert(err.message); }
  }

  function openEditGuest(g, hotelId) {
    setEditGuest({ guest: g, hotelId });
    setEditGuestForm({
      confirmation: g.confirmation || '',
      cost: g.cost || '',
      checkIn: g.check_in ? g.check_in.slice(0,10) : '',
      checkOut: g.check_out ? g.check_out.slice(0,10) : '',
    });
  }
  async function saveEditGuest(e) {
    e.preventDefault();
    try {
      const updated = await api.updateGuest(project.id, editGuest.guest.id, {
        confirmation: editGuestForm.confirmation || null,
        cost: editGuestForm.cost || null,
        checkIn: editGuestForm.checkIn ? new Date(editGuestForm.checkIn).toISOString() : null,
        checkOut: editGuestForm.checkOut ? new Date(editGuestForm.checkOut).toISOString() : null,
      });
      setHotels(prev => prev.map(h => h.id === editGuest.hotelId
        ? { ...h, guests: h.guests.map(g => g.id === editGuest.guest.id ? { ...g, ...updated } : g) }
        : h));
      setEditGuest(null);
    } catch(err) { alert(err.message); }
  }

  function openEditCar(c) {
    setEditCar(c);
    setEditCarForm({
      vendor: c.vendor || '',
      pickupLocation: c.pickup_location || '',
      dropoffLocation: c.dropoff_location || '',
      confirmation: c.confirmation || '',
      cost: c.cost || '',
      notes: c.notes || '',
    });
  }
  async function saveEditCar(e) {
    e.preventDefault();
    try {
      const updated = await api.updateRentalCar(project.id, editCar.id, {
        vendor: editCarForm.vendor || null,
        pickupLocation: editCarForm.pickupLocation || null,
        dropoffLocation: editCarForm.dropoffLocation || null,
        confirmation: editCarForm.confirmation || null,
        cost: editCarForm.cost || null,
        notes: editCarForm.notes || null,
      });
      setCars(prev => prev.map(c => c.id === editCar.id ? { ...c, ...updated } : c));
      setEditCar(null);
    } catch(err) { alert(err.message); }
  }

  const hotelTotal = totalCost(hotels.flatMap(h => h.guests));
  const flightTotal = totalCost(flights);
  const carTotal = totalCost(cars);

  return (
    <div>
      <div className="page-title" style={{ marginBottom:3 }}>Travel & Logistics</div>
      <div className="page-sub">{project.code} · {project.city}, {project.state} · {fmt(project.start_date || project.startDate)} – {fmt(project.end_date || project.endDate)}</div>

      {/* ── Hotels ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="sec-lbl" style={{ marginTop:0 }}>Hotels</div>
          {hotelTotal && <span style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{hotelTotal} total</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowHotel(true)}>+ Add Hotel</button>
      </div>
      {hotels.map(h => {
        // Build a map: crew_member_id → guest
        const bookingMap = {};
        h.guests.forEach(g => { if (g.crew_member_id) bookingMap[g.crew_member_id] = g; });
        const unlinked = h.guests.filter(g => !g.crew_member_id);
        const assignedCrew = (project.crewAssignments || []).filter(a => a.crewMember);

        return (
          <div key={h.id} className="h-card">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div>
                <div className="h-name">{h.name}</div>
                <div className="h-addr">
                  {h.address
                    ? <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.address)}`} target="_blank" rel="noreferrer" style={{ color:'var(--muted)', textDecoration:'underline' }}>{h.address}</a>
                    : null}
                  {h.phone && ` · ${h.phone}`}
                </div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setGuestHotelId(h.id); setGuestForm({ selectedHotelId:'', crewMemberId:'', guestName:'', confirmation:'', checkIn:'', checkOut:'', cost:'' }); }}>+ Add</button>
                <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => removeHotel(h.id)}>✕</button>
              </div>
            </div>

            {/* Crew roster */}
            <div style={{ marginTop:10 }}>
              {assignedCrew.map(a => {
                const g = bookingMap[a.crewMember.id];
                const confirmed = !!(g?.confirmation);
                const dim = !g || !confirmed;
                return (
                  <div key={a.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)', opacity: dim ? 0.45 : 1 }}>
                    <div style={{ fontSize:16, lineHeight:1, paddingTop:2, minWidth:14, color: confirmed ? 'var(--green, #4ade80)' : 'var(--muted)' }}>
                      {confirmed ? '✓' : g ? '○' : '—'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{displayName(a.crewMember)}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>{a.position.name}</div>
                      {g && (
                        <div style={{ fontSize:11, marginTop:2, color: confirmed ? 'var(--tan)' : 'var(--muted)' }}>
                          {fmt(g.check_in)} → {fmt(g.check_out)}
                          {g.confirmation && <span style={{ marginLeft:8, color:'var(--text)', fontWeight:500 }}>#{g.confirmation}</span>}
                          {!g.confirmation && <span style={{ marginLeft:8, fontStyle:'italic' }}>No confirmation</span>}
                          {g.cost && <span style={{ marginLeft:8, color:'var(--green)', fontWeight:600 }}>{fmtCost(g.cost)}</span>}
                        </div>
                      )}
                      {!g && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, fontStyle:'italic' }}>No booking</div>}
                    </div>
                    {g && (
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => openEditGuest(g, h.id)}>Edit</button>
                        <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => removeGuest(h.id, g.id)}>✕</button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unlinked guests (manually entered) */}
              {unlinked.map(g => (
                <div key={g.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'6px 0', borderBottom:'1px solid var(--border)', opacity: g.confirmation ? 1 : 0.45 }}>
                  <div style={{ fontSize:16, lineHeight:1, paddingTop:2, minWidth:14, color: g.confirmation ? 'var(--green, #4ade80)' : 'var(--muted)' }}>
                    {g.confirmation ? '✓' : '○'}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{g.guest_name}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>Guest</div>
                    <div style={{ fontSize:11, marginTop:2, color: g.confirmation ? 'var(--tan)' : 'var(--muted)' }}>
                      {fmt(g.check_in)} → {fmt(g.check_out)}
                      {g.confirmation && <span style={{ marginLeft:8, color:'var(--text)', fontWeight:500 }}>#{g.confirmation}</span>}
                      {!g.confirmation && <span style={{ marginLeft:8, fontStyle:'italic' }}>No confirmation</span>}
                      {g.cost && <span style={{ marginLeft:8, color:'var(--green)', fontWeight:600 }}>{fmtCost(g.cost)}</span>}
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => openEditGuest(g, h.id)}>Edit</button>
                    <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => removeGuest(h.id, g.id)}>✕</button>
                  </div>
                </div>
              ))}

              {assignedCrew.length === 0 && h.guests.length === 0 && (
                <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', padding:'6px 0' }}>No crew assigned yet.</div>
              )}
            </div>
          </div>
        );
      })}
      {hotels.length === 0 && <div className="empty">No hotels added yet.</div>}

      {/* ── Flights ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="sec-lbl">Flights</div>
          {flightTotal && <span style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{flightTotal} total</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowFlight(true)}>+ Add Flight</button>
      </div>
      {flights.map(f => {
        const hoursUntil = f.depart_time ? (new Date(f.depart_time) - Date.now()) / 3600000 : Infinity;
        const showLive = hoursUntil <= 24;
        return (
          <div key={f.id} className="frow" style={{ flexWrap:'wrap', gap:6 }}>
            <div className="fname">{f.crew_name || f.passenger_name}</div>
            {f.flight_number && <span className="abadge">{f.flight_number}</span>}
            <div className="froute"><span>{f.origin}</span><span className="farrow">→</span><span>{f.destination}</span></div>
            {(f.depart_display || f.depart_time) && <div className="ftimes">{f.depart_display || fmtDT(f.depart_time)} → {f.arrive_display || (f.arrive_time ? fmtDT(f.arrive_time) : '?')}</div>}
            {f.airline && <span className="abadge">{f.airline}</span>}
            {f.confirmation && <span style={{ fontSize:10, color:'var(--muted)' }}># {f.confirmation}</span>}
            {f.cost && <span style={{ fontSize:10, color:'var(--green)', fontWeight:600 }}>{fmtCost(f.cost)}</span>}
            {showLive && f.status && (
              <span style={{ fontSize:10, fontWeight:600, color: statusColor(f.status) }}>{f.status}</span>
            )}
            {showLive && f.flight_number && (
              <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => refreshFlightStatus(f)} title="Refresh live status">↻</button>
            )}
            {!showLive && f.depart_time && (
              <span style={{ fontSize:10, color:'var(--muted)' }}>Live status available within 24 hrs</span>
            )}
            {f.is_return && <span className="badge">Return</span>}
            <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, marginLeft:'auto' }} onClick={() => openEditFlight(f)}>Edit</button>
            <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => removeFlight(f.id)}>✕</button>
          </div>
        );
      })}
      {flights.length === 0 && <div className="empty">No flights added yet.</div>}

      {/* ── Rental Cars ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="sec-lbl">Rental Cars</div>
          {carTotal && <span style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{carTotal} total</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowCar(true)}>+ Add Rental Car</button>
      </div>
      {cars.map(c => (
        <div key={c.id} className="frow" style={{ flexWrap:'wrap' }}>
          <div className="fname">{c.vendor}</div>
          {c.pickup_location && <div className="froute"><span>{c.pickup_location}</span>{c.dropoff_location && <><span className="farrow">→</span><span>{c.dropoff_location}</span></>}</div>}
          {c.pickup_date && <div className="ftimes">{fmt(c.pickup_date)}{c.dropoff_date && ` – ${fmt(c.dropoff_date)}`}</div>}
          {c.confirmation && <span style={{ fontSize:10, color:'var(--muted)' }}>{c.confirmation}</span>}
          {c.cost && <span style={{ fontSize:10, color:'var(--green)', fontWeight:600 }}>{fmtCost(c.cost)}</span>}
          {c.notes && <span style={{ fontSize:10, color:'var(--muted)' }}>{c.notes}</span>}
          <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, marginLeft:'auto' }} onClick={() => openEditCar(c)}>Edit</button>
          <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => removeCar(c.id)}>✕</button>
        </div>
      ))}
      {cars.length === 0 && <div className="empty">No rental cars added yet.</div>}


      {/* ── Add Hotel Modal ── */}
      {showHotel && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowHotel(false)}>
          <div className="modal">
            <div className="modal-title">Add Hotel</div>
            <form onSubmit={addHotel}>
              <div className="form-grid cols1" style={{ marginBottom:12 }}>
                <div className="field" style={{ position:'relative' }}>
                  <label>Search Hotel Name</label>
                  <input
                    value={hotelQuery}
                    onChange={onHotelQueryChange}
                    placeholder="Marriott Kansas City Downtown…"
                    autoComplete="off"
                    required
                  />
                  {hotelSearching && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>Searching…</div>}
                  {hotelSuggestions.length > 0 && (
                    <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, zIndex:100, maxHeight:220, overflowY:'auto' }}>
                      {hotelSuggestions.map((s,i) => (
                        <div key={i} style={{ padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:12 }}
                          onMouseDown={() => selectHotelSuggestion(s)}>
                          <div style={{ fontWeight:500 }}>{s.name}</div>
                          <div style={{ color:'var(--muted)', fontSize:11 }}>{s.address}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="field">
                  <label>Address <span style={{ color:'var(--muted)', fontSize:10 }}>(auto-filled)</span></label>
                  <input value={hotelForm.address} onChange={e => setHotelForm(f=>({...f,address:e.target.value}))} placeholder="123 Main St, Kansas City, MO" />
                </div>
                <div className="field">
                  <label>Phone <span style={{ color:'var(--muted)', fontSize:10 }}>(auto-filled if available)</span></label>
                  <input value={hotelForm.phone} onChange={e => setHotelForm(f=>({...f,phone:e.target.value}))} />
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Add Hotel</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowHotel(false); setHotelQuery(''); setHotelSuggestions([]); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Confirmation Modal ── */}
      {guestHotelId && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setGuestHotelId(null)}>
          <div className="modal">
            <div className="modal-title">Add Confirmation</div>
            <form onSubmit={addGuest}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                {guestHotelId === '__pick__' && (
                  <div className="field span2">
                    <label>Hotel</label>
                    <select value={guestForm.selectedHotelId} onChange={e => setGuestForm(f=>({...f, selectedHotelId: e.target.value}))} required>
                      <option value="">— Select hotel —</option>
                      {hotels.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="field span2">
                  <label>Crew Member <span style={{ color:'var(--muted)', fontSize:10 }}>(optional)</span></label>
                  <select value={guestForm.crewMemberId} onChange={e => {
                    const id = e.target.value;
                    const a = projectCrew.find(a => a.crewMember?.id === id);
                    setGuestForm(f=>({ ...f, crewMemberId: id, guestName: displayName(a?.crewMember) || f.guestName }));
                  }}>
                    <option value="">— Select crew member —</option>
                    {projectCrew.filter(a => a.crewMember).map(a => (
                      <option key={a.crewMember.id} value={a.crewMember.id}>{displayName(a.crewMember)} — {a.position.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field span2">
                  <label>Guest Name{!guestForm.crewMemberId && <span style={{ color:'var(--red-text)', marginLeft:3 }}>*</span>}</label>
                  <input value={guestForm.guestName} onChange={e => setGuestForm(f=>({...f,guestName:e.target.value}))} placeholder="Alexander Northup" required={!guestForm.crewMemberId} />
                </div>
                <div className="field span2"><label>Confirmation #</label><input value={guestForm.confirmation} onChange={e => setGuestForm(f=>({...f,confirmation:e.target.value}))} placeholder="138215420" /></div>
                <div className="field"><label>Check In</label><input type="date" value={guestForm.checkIn} onChange={e => setGuestForm(f=>({...f,checkIn:e.target.value}))} required /></div>
                <div className="field"><label>Check Out</label><input type="date" value={guestForm.checkOut} onChange={e => setGuestForm(f=>({...f,checkOut:e.target.value}))} required /></div>
                <div className="field span2"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={guestForm.cost} onChange={e => setGuestForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Add Confirmation</button>
                <button type="button" className="btn btn-ghost" onClick={() => setGuestHotelId(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Flight Modal ── */}
      {showFlight && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowFlight(false)}>
          <div className="modal">
            <div className="modal-title">Add Flight</div>
            <form onSubmit={addFlight}>
              <div className="form-grid" style={{ marginBottom:12 }}>

                {/* Flight lookup row */}
                <div className="field span2">
                  <label>Flight Number + Date <span style={{ color:'var(--muted)', fontSize:10 }}>— auto-fills route, times & status</span></label>
                  <div style={{ display:'flex', gap:6 }}>
                    <input
                      value={flightLookupQuery}
                      onChange={e => setFlightLookupQuery(e.target.value)}
                      placeholder="UA1234"
                      style={{ width:100, flexShrink:0 }}
                    />
                    <input
                      type="date"
                      value={flightLookupDate}
                      onChange={e => setFlightLookupDate(e.target.value)}
                      style={{ flex:1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={lookupFlight}
                      disabled={flightLooking || !flightLookupQuery}
                      style={{ flexShrink:0 }}
                    >
                      {flightLooking ? 'Looking…' : 'Look up'}
                    </button>
                  </div>
                  {flightLookupError && <div style={{ fontSize:11, color:'var(--red-text, #e08080)', marginTop:3 }}>{flightLookupError}</div>}
                  {flightForm.status && <div style={{ fontSize:11, fontWeight:600, color: statusColor(flightForm.status), marginTop:3 }}>{flightForm.status}</div>}
                </div>

                {/* Crew member */}
                <div className="field span2">
                  <label>Crew Member</label>
                  <select value={flightForm.crewMemberId || ''} onChange={e => {
                    const id = e.target.value || null;
                    const a = projectCrew.find(a => a.crewMember?.id === id);
                    setFlightForm(f=>({ ...f, crewMemberId: id, passengerName: displayName(a?.crewMember) || f.passengerName }));
                  }}>
                    <option value="">— Select crew member —</option>
                    {projectCrew.filter(a => a.crewMember).map(a => (
                      <option key={a.crewMember.id} value={a.crewMember.id}>{displayName(a.crewMember)} — {a.position.name}</option>
                    ))}
                  </select>
                </div>

                <div className="field"><label>Confirmation #</label><input value={flightForm.confirmation} onChange={e => setFlightForm(f=>({...f,confirmation:e.target.value}))} placeholder="APMKP8" /></div>
                <div className="field"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={flightForm.cost} onChange={e => setFlightForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>

                {/* Auto-filled fields */}
                <div className="field"><label>Airline <span style={{ color:'var(--muted)', fontSize:10 }}>(auto)</span></label><input value={flightForm.airline} onChange={e => setFlightForm(f=>({...f,airline:e.target.value}))} placeholder="United" /></div>
                <div className="field"><label>Flight # <span style={{ color:'var(--muted)', fontSize:10 }}>(auto)</span></label><input value={flightForm.flightNumber} onChange={e => setFlightForm(f=>({...f,flightNumber:e.target.value}))} placeholder="UA1234" /></div>
                <div className="field"><label>Origin <span style={{ color:'var(--muted)', fontSize:10 }}>(auto)</span></label><input value={flightForm.origin} onChange={e => setFlightForm(f=>({...f,origin:e.target.value}))} placeholder="STL" /></div>
                <div className="field"><label>Destination <span style={{ color:'var(--muted)', fontSize:10 }}>(auto)</span></label><input value={flightForm.destination} onChange={e => setFlightForm(f=>({...f,destination:e.target.value}))} placeholder="MCI" /></div>
                <div className="field"><label>Depart <span style={{ color:'var(--muted)', fontSize:10 }}>(auto)</span></label><input type="datetime-local" value={flightForm.departTime} onChange={e => setFlightForm(f=>({...f,departTime:e.target.value}))} /></div>
                <div className="field"><label>Arrive <span style={{ color:'var(--muted)', fontSize:10 }}>(auto)</span></label><input type="datetime-local" value={flightForm.arriveTime} onChange={e => setFlightForm(f=>({...f,arriveTime:e.target.value}))} /></div>

                <div className="field span2" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <input type="checkbox" id="isReturn" checked={flightForm.isReturn} onChange={e => setFlightForm(f=>({...f,isReturn:e.target.checked}))} style={{ width:'auto' }} />
                  <label htmlFor="isReturn" style={{ textTransform:'none', letterSpacing:0, fontSize:12, color:'var(--text)' }}>Return flight</label>
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Add Flight</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowFlight(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Rental Car Modal ── */}
      {showCar && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowCar(false)}>
          <div className="modal">
            <div className="modal-title">Add Rental Car</div>
            <form onSubmit={addCar}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2">
                  <label>Crew Member</label>
                  <select value={carForm.crewMemberId} onChange={e => setCarForm(f=>({...f, crewMemberId: e.target.value}))}>
                    <option value="">— Select crew member —</option>
                    {projectCrew.filter(a => a.crewMember).map(a => (
                      <option key={a.crewMember.id} value={a.crewMember.id}>{displayName(a.crewMember)} — {a.position.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field span2"><label>Vendor</label><input value={carForm.vendor} onChange={e => setCarForm(f=>({...f,vendor:e.target.value}))} placeholder="Enterprise" required /></div>
                <div className="field"><label>Pickup Location</label><input value={carForm.pickupLocation} onChange={e => setCarForm(f=>({...f,pickupLocation:e.target.value}))} placeholder="MCI Airport" /></div>
                <div className="field"><label>Dropoff Location</label><input value={carForm.dropoffLocation} onChange={e => setCarForm(f=>({...f,dropoffLocation:e.target.value}))} placeholder="MCI Airport" /></div>
                <div className="field"><label>Pickup Date</label><input type="date" value={carForm.pickupDate} onChange={e => setCarForm(f=>({...f,pickupDate:e.target.value}))} /></div>
                <div className="field"><label>Dropoff Date</label><input type="date" value={carForm.dropoffDate} onChange={e => setCarForm(f=>({...f,dropoffDate:e.target.value}))} /></div>
                <div className="field"><label>Confirmation #</label><input value={carForm.confirmation} onChange={e => setCarForm(f=>({...f,confirmation:e.target.value}))} placeholder="XT29183K" /></div>
                <div className="field"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={carForm.cost} onChange={e => setCarForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
                <div className="field span2"><label>Notes</label><input value={carForm.notes} onChange={e => setCarForm(f=>({...f,notes:e.target.value}))} placeholder="Full-size SUV" /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Add Rental Car</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCar(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Flight Modal ── */}
      {editFlight && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditFlight(null)}>
          <div className="modal">
            <div className="modal-title">Edit Flight — {editFlight.flight_number || editFlight.origin + ' → ' + editFlight.destination}</div>
            <form onSubmit={saveEditFlight}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2">
                  <label>Crew Member</label>
                  <select value={editFlightForm.crewMemberId} onChange={e => setEditFlightForm(f=>({...f, crewMemberId: e.target.value}))}>
                    <option value="">— None —</option>
                    {projectCrew.filter(a => a.crewMember).map(a => (
                      <option key={a.crewMember.id} value={a.crewMember.id}>{displayName(a.crewMember)} — {a.position.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field"><label>Confirmation #</label><input value={editFlightForm.confirmation} onChange={e => setEditFlightForm(f=>({...f,confirmation:e.target.value}))} placeholder="APMKP8" /></div>
                <div className="field"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={editFlightForm.cost} onChange={e => setEditFlightForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditFlight(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Guest Modal ── */}
      {editGuest && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditGuest(null)}>
          <div className="modal">
            <div className="modal-title">Edit Confirmation — {editGuest.guest.crew_name || editGuest.guest.guest_name}</div>
            <form onSubmit={saveEditGuest}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Confirmation #</label><input value={editGuestForm.confirmation} onChange={e => setEditGuestForm(f=>({...f,confirmation:e.target.value}))} placeholder="138215420" /></div>
                <div className="field"><label>Check In</label><input type="date" value={editGuestForm.checkIn} onChange={e => setEditGuestForm(f=>({...f,checkIn:e.target.value}))} /></div>
                <div className="field"><label>Check Out</label><input type="date" value={editGuestForm.checkOut} onChange={e => setEditGuestForm(f=>({...f,checkOut:e.target.value}))} /></div>
                <div className="field span2"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={editGuestForm.cost} onChange={e => setEditGuestForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditGuest(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Car Modal ── */}
      {editCar && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditCar(null)}>
          <div className="modal">
            <div className="modal-title">Edit Rental Car — {editCar.vendor}</div>
            <form onSubmit={saveEditCar}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Vendor</label><input value={editCarForm.vendor} onChange={e => setEditCarForm(f=>({...f,vendor:e.target.value}))} placeholder="Enterprise" required /></div>
                <div className="field"><label>Pickup Location</label><input value={editCarForm.pickupLocation} onChange={e => setEditCarForm(f=>({...f,pickupLocation:e.target.value}))} /></div>
                <div className="field"><label>Dropoff Location</label><input value={editCarForm.dropoffLocation} onChange={e => setEditCarForm(f=>({...f,dropoffLocation:e.target.value}))} /></div>
                <div className="field"><label>Confirmation #</label><input value={editCarForm.confirmation} onChange={e => setEditCarForm(f=>({...f,confirmation:e.target.value}))} /></div>
                <div className="field"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={editCarForm.cost} onChange={e => setEditCarForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
                <div className="field span2"><label>Notes</label><input value={editCarForm.notes} onChange={e => setEditCarForm(f=>({...f,notes:e.target.value}))} /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditCar(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
