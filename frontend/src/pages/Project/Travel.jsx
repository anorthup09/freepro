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

function computeFlightStatus(f) {
  const now = new Date();
  const st = (f.status || '').toUpperCase();
  const delayed = st === 'DELAYED';
  if (st === 'CANCELLED') return { label: 'Cancelled', color: '#ef4444', dot: '#ef4444', cancelled: true };
  const depart = f.depart_time ? new Date(f.depart_time) : null;
  const arrive = f.arrive_time ? new Date(f.arrive_time) : null;
  if (!depart) return { label: 'Status Coming Soon', color: 'var(--muted)', dot: null, delayed };
  const todayStr = now.toISOString().slice(0, 10);
  const departStr = depart.toISOString().slice(0, 10);
  if (todayStr < departStr) return { label: 'Status Coming Soon', color: 'var(--muted)', dot: null, delayed };
  if (now < depart) return { label: 'Pre-Flight', color: '#a78bfa', dot: '#a78bfa', delayed };
  if (arrive && now < arrive) return { label: 'In-Flight', color: '#60a5fa', dot: '#60a5fa', delayed };
  return { label: 'Arrived', color: '#22c55e', dot: '#22c55e', delayed };
}

function FlightStatusBadge({ f }) {
  const s = computeFlightStatus(f);
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, marginLeft:'auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        {s.dot && <div style={{ width:6, height:6, borderRadius:'50%', background: s.dot, flexShrink:0 }} />}
        <span style={{ fontSize:10, fontWeight:600, color: s.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</span>
      </div>
      {s.delayed && <span style={{ fontSize:10, fontWeight:600, color:'#f59e0b' }}>(!) Delayed</span>}
    </div>
  );
}

// Debounce hook
function useDebounce(fn, delay) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('cancel') || s.includes('divert')) return 'var(--red-text)';
  if (s.includes('delay') || s.includes('late')) return 'var(--amber-text)';
  if (s.includes('landed') || s.includes('arrived') || s.includes('departed') || s.includes('en route') || s.includes('expected') || s.includes('scheduled') || s.includes('on time')) return 'var(--green-text)';
  return 'var(--muted)';
}

// City-level autocomplete (City, ST) backed by the geo search used for weather
function CityField({ label, required, value, onPick, placeholder }) {
  const [q, setQ] = useState(value?.label || '');
  const [sugs, setSugs] = useState([]);
  const [searching, setSearching] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const timer = useRef(null);
  const lastSugs = useRef([]);
  useEffect(() => { setQ(value?.label || ''); }, [value]);
  function onChange(e) {
    const v = e.target.value;
    setQ(v);
    onPick(null);
    setNoMatch(false);
    clearTimeout(timer.current);
    if (v.trim().length < 2) { setSugs([]); lastSugs.current = []; return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await api.geoSearch(v);
        setSugs(r); lastSugs.current = r;
        setNoMatch(r.length === 0);
      } catch { setSugs([]); lastSugs.current = []; setNoMatch(true); }
      setSearching(false);
    }, 300);
  }
  // Leaving the field without picking: snap to the top live match so the
  // saved value is always a real, mappable place.
  function onBlur() {
    setTimeout(() => {
      setSugs([]);
      if (!value && q.trim().length >= 2 && lastSugs.current.length) {
        const top = lastSugs.current[0];
        onPick({ label: top.label, latitude: top.latitude, longitude: top.longitude });
        setNoMatch(false);
      }
    }, 150);
  }
  return (
    <div className="field" style={{ position:'relative' }}>
      <label>{label} {required && <span style={{ color:'var(--red-text)' }}>*</span>}
        {value && <span style={{ color:'#5ABF80', marginLeft:6, fontSize:10 }}>✓</span>}
        {searching && <span style={{ color:'var(--muted)', marginLeft:6, fontSize:9 }}>searching…</span>}
      </label>
      <input value={q} onChange={onChange} onBlur={onBlur} placeholder={placeholder || 'Start typing a city…'} autoComplete="off" required={required && !value}
        style={noMatch && !value ? { borderColor:'var(--red-text, #e05252)' } : undefined} />
      {noMatch && !value && q.trim().length >= 2 && !searching && (
        <div style={{ fontSize:10, color:'var(--red-text, #e05252)', marginTop:3 }}>No mappable city found — check the spelling and pick from the list.</div>
      )}
      {sugs.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, zIndex:120, maxHeight:190, overflowY:'auto' }}>
          {sugs.map((sg, i) => (
            <div key={i} style={{ padding:'7px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)', fontSize:12 }}
              onMouseDown={() => { onPick({ label: sg.label, latitude: sg.latitude, longitude: sg.longitude }); setSugs([]); setNoMatch(false); }}>
              {sg.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const fmtDriveMins = m => m == null ? null : (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);

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
  const [flightLegs, setFlightLegs] = useState(null); // all legs the number flies that day
  const [selectedLegIdx, setSelectedLegIdx] = useState(-1);
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

  // Driving (driver + tagged passengers)
  const [drives, setDrives] = useState([]);
  const [showDrive, setShowDrive] = useState(false);
  const BLANK_DRIVE = { driverCrewMemberId:'', passengerIds:[], origin:null, destination:null, departDate:'', departTime:'', car:'', notes:'' }; // origin/destination: { label, latitude, longitude }
  const [driveForm, setDriveForm] = useState(BLANK_DRIVE);

  const projectCrew = project.crewAssignments || [];

  // Travel is often booked before the crew list is final, so the crew
  // dropdowns offer everyone: assigned crew first, then the full roster
  const [fullRoster, setFullRoster] = useState([]);
  useEffect(() => { api.getCrew().then(rs => setFullRoster(rs || [])).catch(() => {}); }, []);
  const assignedIds = new Set(projectCrew.filter(a => a.crewMember).map(a => a.crewMember.id));
  const rosterExtras = fullRoster.filter(m => !assignedIds.has(m.id))
    .sort((a, b) => (displayName(a) || '').localeCompare(displayName(b) || ''));
  const memberById = id => projectCrew.find(a => a.crewMember?.id === id)?.crewMember
    || fullRoster.find(m => m.id === id) || null;
  const crewOptions = (
    <>
      <option value="">— Select crew member —</option>
      {assignedIds.size > 0 && (
        <optgroup label="On this shoot">
          {projectCrew.filter(a => a.crewMember).map(a => (
            <option key={a.id} value={a.crewMember.id}>{displayName(a.crewMember)} — {a.position.name}</option>
          ))}
        </optgroup>
      )}
      {rosterExtras.length > 0 && (
        <optgroup label="Full roster">
          {rosterExtras.map(m => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
        </optgroup>
      )}
    </>
  );

  useEffect(() => {
    Promise.all([
      api.getHotels(project.id),
      api.getFlights(project.id),
      api.getRentalCars(project.id),
      api.getDrives(project.id),
    ]).then(([h,f,c,d]) => { setHotels(h); setFlights(f); setCars(c); setDrives(d); });
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

  // Safari rejects AeroDataBox's "YYYY-MM-DD HH:mm±TZ" strings; parse safely
  function safeIso(t) {
    if (!t) return null;
    const d = new Date(String(t).replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  // Airport-local "YYYY-MM-DD HH:mm±TZ" → "YYYY-MM-DDTHH:mm" for datetime-local
  const localWall = t2 => t2 ? String(t2).replace(' ', 'T').slice(0, 16) : null;

  // ── Flight lookup ──────────────────────────────────────────────────────────
  // A flight number can fly several legs in one day. Every lookup fills a legs
  // dropdown under the number/date row; picking a leg applies it to the form.
  function applyLeg(leg) {
    setFlightForm(f => ({
      ...f,
      flightNumber: leg.flightNumber || flightLookupQuery.toUpperCase(),
      airline: leg.airline || f.airline,
      origin: leg.origin || f.origin,
      destination: leg.destination || f.destination,
      departTime: localWall(leg.departTimeLocal) || safeIso(leg.departTime)?.slice(0,16) || f.departTime,
      arriveTime: localWall(leg.arriveTimeLocal) || safeIso(leg.arriveTime)?.slice(0,16) || f.arriveTime,
      departDisplay: leg.departDisplay || '',
      arriveDisplay: leg.arriveDisplay || '',
      status: leg.status || '',
    }));
  }
  const legLabel = leg => `${leg.origin || '?'} → ${leg.destination || '?'}${leg.departDisplay ? ` · ${leg.departDisplay}` : ''}${leg.arriveDisplay ? ` – ${leg.arriveDisplay}` : ''}`;
  async function lookupFlight() {
    if (!flightLookupQuery) return;
    setFlightLooking(true); setFlightLookupError(''); setFlightLegs(null); setSelectedLegIdx(-1);
    try {
      const data = await api.flightLookup(flightLookupQuery, flightLookupDate);
      const legs = Array.isArray(data.legs) && data.legs.length ? data.legs : [data];
      setFlightLegs(legs);
      if (legs.length === 1) { setSelectedLegIdx(0); applyLeg(legs[0]); }
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
        departTime: safeIso(flightForm.departTime)
          || (flightLookupDate ? safeIso(flightLookupDate + 'T12:00:00') : null),
        arriveTime: safeIso(flightForm.arriveTime),
        crewMemberId: flightForm.crewMemberId || null,
        departDisplay: flightForm.departDisplay || null,
        arriveDisplay: flightForm.arriveDisplay || null,
        cost: flightForm.cost || null,
      });
      setFlights(prev => [...prev, f]);
      setShowFlight(false);
      setFlightLookupQuery(''); setFlightLookupDate(''); setFlightLookupError(''); setFlightLegs(null); setSelectedLegIdx(-1);
      setFlightForm({ crewMemberId:null, passengerName:'', flightNumber:'', airline:'', origin:'', destination:'', departTime:'', arriveTime:'', departDisplay:'', arriveDisplay:'', confirmation:'', isReturn:false, cost:'', status:'' });
    } catch(err) { alert(err.message); }
  }

  // Duplicate a flight for another crew member — same flight, new person,
  // with the cost confirmed (fares often differ by booking)
  const [dupFlight, setDupFlight] = useState(null);   // { source, crewMemberId, confirmation, cost }
  async function submitDuplicate(e) {
    e.preventDefault();
    const s = dupFlight.source;
    try {
      const f = await api.createFlight(project.id, {
        crewMemberId: dupFlight.crewMemberId || null,
        passengerName: displayName(memberById(dupFlight.crewMemberId)) || 'Unknown',
        flightNumber: s.flight_number || '', airline: s.airline || '',
        origin: s.origin || '', destination: s.destination || '',
        departTime: s.depart_time || null, arriveTime: s.arrive_time || null,
        departDisplay: s.depart_display || null, arriveDisplay: s.arrive_display || null,
        isReturn: s.is_return || false, status: s.status || '',
        confirmation: dupFlight.confirmation || '',
        cost: dupFlight.cost || null,
      });
      setFlights(prev => [...prev, f]);
      setDupFlight(null);
    } catch (err) { alert(err.message); }
  }

  async function refreshFlightStatus(f) {
    if (!f.flight_number) return;
    const dateStr = f.depart_time ? f.depart_time.slice(0,10) : '';
    try {
      const data = await api.flightStatus(f.flight_number, dateStr, f.origin);
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

  // ── Driving ───────────────────────────────────────────────────────────────
  const crewById = id => memberById(id);
  async function addDrive(e) {
    e.preventDefault();
    const f = driveForm;
    if (!f.origin || !f.destination) return alert('Pick the From and To cities from the suggestions.');
    try {
      // Estimated drive time via OSRM between the two picked cities
      let driveMinutes = null;
      try {
        const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${f.origin.longitude},${f.origin.latitude};${f.destination.longitude},${f.destination.latitude}?overview=false`);
        const dj = await r.json();
        if (dj.routes?.[0]?.duration) driveMinutes = Math.round(dj.routes[0].duration / 60);
      } catch { /* estimate unavailable — save without it */ }
      const departISO = f.departDate && f.departTime ? new Date(`${f.departDate}T${f.departTime}`).toISOString() : null;
      const arriveISO = departISO && driveMinutes != null ? new Date(new Date(departISO).getTime() + driveMinutes * 60000).toISOString() : null;
      const d = await api.createDrive(project.id, {
        driverCrewMemberId: f.driverCrewMemberId,
        driverName: displayName(crewById(f.driverCrewMemberId)) || null,
        origin: f.origin.label,
        destination: f.destination.label,
        departTime: departISO,
        arriveTime: arriveISO,
        driveMinutes,
        car: f.car || null,
        notes: f.notes || null,
        members: f.passengerIds.map(id => ({ crewMemberId: id, name: displayName(crewById(id)) || '' })),
      });
      setDrives(prev => [...prev, d]);
      setShowDrive(false);
      setDriveForm(BLANK_DRIVE);
    } catch (err) { alert(err.message); }
  }
  async function removeDrive(id) {
    await api.deleteDrive(project.id, id);
    setDrives(prev => prev.filter(d => d.id !== id));
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
      <div className="page-sub">{project.code} · {fmt(project.start_date || project.startDate)} – {fmt(project.end_date || project.endDate)}</div>

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
      {(() => { let lastDay = null; return [...flights]
        .sort((a, b) => String(a.depart_time || '9999').localeCompare(String(b.depart_time || '9999')))
        .map(f => {
        const hoursUntil = f.depart_time ? (new Date(f.depart_time) - Date.now()) / 3600000 : Infinity;
        const showLive = hoursUntil <= 24;
        const day = f.depart_time ? String(f.depart_time).slice(0, 10) : 'tbd';
        const header = day !== lastDay ? (lastDay = day) && (
          <div style={{ fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', margin:'12px 0 4px' }}>
            {day === 'tbd' ? 'Date TBD' : new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </div>
        ) : null;
        return (
          <React.Fragment key={f.id}>
          {header}
          <div className="frow" style={{ flexDirection:'column', alignItems:'stretch', gap:5 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <div className="fname">{f.crew_name || f.passenger_name}</div>
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
                {showLive && f.flight_number && (
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => refreshFlightStatus(f)} title="Refresh live status">↻</button>
                )}
                <FlightStatusBadge f={f} />
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              {(f.depart_display || f.depart_time) && <div className="ftimes">{f.depart_display || fmtDT(f.depart_time)} → {f.arrive_display || (f.arrive_time ? fmtDT(f.arrive_time) : '?')}</div>}
              {f.is_return && <span className="badge" style={{ marginLeft:'auto' }}>Return</span>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              {f.airline && <span className="abadge">{f.airline}</span>}
              {f.flight_number && <span className="abadge">{f.flight_number}</span>}
              <div className="froute"><span>{f.origin}</span><span className="farrow">→</span><span>{f.destination}</span></div>
              {f.cost && <span style={{ fontSize:10, color:'var(--green)', fontWeight:600 }}>{fmtCost(f.cost)}</span>}
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
                <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} title="Add this same flight for another crew member"
                  onClick={() => setDupFlight({ source: f, crewMemberId: '', confirmation: '', cost: f.cost || '' })}>Duplicate</button>
                <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => openEditFlight(f)}>Edit</button>
                <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => removeFlight(f.id)}>✕</button>
              </div>
            </div>
            {f.confirmation && <div style={{ fontSize:10, color:'var(--muted)' }}>Conf # {f.confirmation}</div>}
          </div>
          </React.Fragment>
        );
      }); })()}
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

      {/* ── Driving ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="sec-lbl">Driving</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowDrive(true)}>+ Driver</button>
      </div>
      {drives.map(d => (
        <div key={d.id} className="frow" style={{ flexWrap:'wrap', gap:8 }}>
          <div className="fname">🚗 {d.driver || d.driver_name || 'Driver TBD'}</div>
          <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:10, padding:'1px 7px' }}>Driver</span>
          {(d.origin || d.destination) && (
            <div className="froute"><span>{d.origin || '?'}</span><span className="farrow">→</span><span>{d.destination || '?'}</span></div>
          )}
          {d.depart_time && <div className="ftimes">{fmtDT(d.depart_time)}{d.arrive_time ? ` → ~${fmtDT(d.arrive_time)}` : ''}</div>}
          {d.drive_minutes != null && <span style={{ fontSize:10, color:'#e6c229', fontWeight:700 }}>~{fmtDriveMins(d.drive_minutes)} drive</span>}
          {d.car && <span style={{ fontSize:10, color:'var(--muted)' }}>🚐 {d.car}</span>}
          {(d.members || []).length > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
              <span style={{ fontSize:10, color:'var(--muted)' }}>Passengers:</span>
              {(d.members || []).map(m => (
                <span key={m.id} style={{ fontSize:10, fontWeight:700, background:'rgba(90,191,128,0.12)', border:'1px solid rgba(90,191,128,0.5)', color:'#5ABF80', borderRadius:10, padding:'1px 8px', whiteSpace:'nowrap' }}>{m.name}</span>
              ))}
            </div>
          )}
          {d.notes && <span style={{ fontSize:10, color:'var(--muted)' }}>{d.notes}</span>}
          <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, marginLeft:'auto' }} onClick={() => removeDrive(d.id)}>✕</button>
        </div>
      ))}
      {drives.length === 0 && <div className="empty">No drivers added yet.</div>}


      {/* ── Add Driver Modal ── */}
      {showDrive && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowDrive(false)}>
          <div className="modal">
            <div className="modal-title">Add Driver</div>
            <form onSubmit={addDrive}>
              <div className="form-grid cols1" style={{ marginBottom:12 }}>
                <div className="field">
                  <label>Driver <span style={{ color:'var(--red-text)', marginLeft:3 }}>*</span></label>
                  <select value={driveForm.driverCrewMemberId} required
                    onChange={e => setDriveForm(f => ({ ...f, driverCrewMemberId: e.target.value, passengerIds: f.passengerIds.filter(id => id !== e.target.value) }))}>
                    {crewOptions}
                  </select>
                </div>
                <div className="field">
                  <label>Passengers <span style={{ color:'var(--muted)', fontSize:10 }}>(tap to tag)</span></label>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'6px 0' }}>
                    {projectCrew.filter(a => a.crewMember && a.crewMember.id !== driveForm.driverCrewMemberId).map(a => {
                      const id = a.crewMember.id;
                      const on = driveForm.passengerIds.includes(id);
                      return (
                        <button key={id} type="button"
                          onClick={() => setDriveForm(f => ({ ...f, passengerIds: on ? f.passengerIds.filter(x => x !== id) : [...f.passengerIds, id] }))}
                          style={{ fontSize:11, fontWeight:700, borderRadius:14, padding:'4px 12px', cursor:'pointer',
                            background: on ? 'rgba(90,191,128,0.15)' : 'var(--bg)',
                            border: on ? '1px solid #5ABF80' : '1px solid var(--border)',
                            color: on ? '#5ABF80' : 'var(--muted)' }}>
                          {on ? '✓ ' : ''}{displayName(a.crewMember)}
                        </button>
                      );
                    })}
                    {projectCrew.filter(a => a.crewMember).length === 0 && (
                      <span style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No crew assigned to this project yet.</span>
                    )}
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 130px 110px', gap:'6px 10px' }}>
                  <CityField label="From (City)" required value={driveForm.origin} onPick={v => setDriveForm(f=>({...f,origin:v}))} placeholder="St. Louis, Missouri…" />
                  <div className="field"><label>Departure Date <span style={{ color:'var(--red-text)' }}>*</span></label>
                    <input type="date" value={driveForm.departDate} onChange={e => setDriveForm(f=>({...f,departDate:e.target.value}))} required /></div>
                  <div className="field"><label>Time <span style={{ color:'var(--red-text)' }}>*</span></label>
                    <input type="time" value={driveForm.departTime} onChange={e => setDriveForm(f=>({...f,departTime:e.target.value}))} required /></div>
                </div>
                <CityField label="To (City)" required value={driveForm.destination} onPick={v => setDriveForm(f=>({...f,destination:v}))} placeholder="Columbia, Missouri…" />
                <div className="field"><label>Car Make/Model</label><input value={driveForm.car} onChange={e => setDriveForm(f=>({...f,car:e.target.value}))} placeholder="Ford Transit 350…" /></div>
                <div className="field"><label>Notes</label><input value={driveForm.notes} onChange={e => setDriveForm(f=>({...f,notes:e.target.value}))} placeholder="Pick up catering on the way…" /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Add Driver</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowDrive(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    setGuestForm(f=>({ ...f, crewMemberId: id, guestName: displayName(memberById(id)) || f.guestName }));
                  }}>
                    {crewOptions}
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
                  <label>Flight Number + Date <span style={{ color:'var(--muted)', fontSize:10 }}>— auto-fills route, times & status; multi-leg flights show a leg picker</span></label>
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
                  {flightLegs && (
                    <div style={{ marginTop:6 }}>
                      <label style={{ fontSize:10, color: flightLegs.length > 1 && selectedLegIdx === -1 ? 'var(--orange)' : 'var(--muted)' }}>
                        {flightLegs.length > 1
                          ? `This flight flies ${flightLegs.length} legs that day — select the leg for this schedule:`
                          : 'Flight leg'}
                      </label>
                      <select value={selectedLegIdx} style={{ marginTop:2 }}
                        onChange={e => { const i = Number(e.target.value); setSelectedLegIdx(i); if (flightLegs[i]) applyLeg(flightLegs[i]); }}>
                        {selectedLegIdx === -1 && <option value={-1}>— Select a leg —</option>}
                        {flightLegs.map((leg, i) => <option key={i} value={i}>{legLabel(leg)}</option>)}
                      </select>
                    </div>
                  )}
                  {flightForm.status && <div style={{ fontSize:11, fontWeight:600, color: statusColor(flightForm.status), marginTop:3 }}>{flightForm.status}</div>}
                </div>

                {/* Crew member */}
                <div className="field span2">
                  <label>Crew Member</label>
                  <select value={flightForm.crewMemberId || ''} onChange={e => {
                    const id = e.target.value || null;
                    setFlightForm(f=>({ ...f, crewMemberId: id, passengerName: displayName(memberById(id)) || f.passengerName }));
                  }}>
                    {crewOptions}
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
                    {crewOptions}
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
                    {crewOptions}
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

      {/* ── Duplicate Flight Modal ── */}
      {dupFlight && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setDupFlight(null)}>
          <div className="modal">
            <div className="modal-title">Duplicate Flight — {dupFlight.source.flight_number || `${dupFlight.source.origin} → ${dupFlight.source.destination}`}</div>
            <div style={{ fontSize:11, color:'var(--muted)', margin:'-6px 0 12px' }}>
              {[dupFlight.source.airline, `${dupFlight.source.origin} → ${dupFlight.source.destination}`,
                dupFlight.source.depart_display || (dupFlight.source.depart_time ? fmtDT(dupFlight.source.depart_time) : null)]
                .filter(Boolean).join(' · ')} — same flight, added for another crew member.
            </div>
            <form onSubmit={submitDuplicate}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2">
                  <label>Crew Member <span style={{ color:'var(--red-text)', marginLeft:3 }}>*</span></label>
                  <select value={dupFlight.crewMemberId} required onChange={e => setDupFlight(d=>({ ...d, crewMemberId: e.target.value }))}>
                    {crewOptions}
                  </select>
                </div>
                <div className="field"><label>Confirmation #</label><input value={dupFlight.confirmation} onChange={e => setDupFlight(d=>({...d,confirmation:e.target.value}))} placeholder="APMKP8" /></div>
                <div className="field"><label>Cost ($) <span style={{ color:'var(--muted)', fontSize:10 }}>confirm for this booking</span></label>
                  <input type="number" step="0.01" min="0" value={dupFlight.cost} onChange={e => setDupFlight(d=>({...d,cost:e.target.value}))} placeholder="0.00" /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Add Duplicate Flight</button>
                <button type="button" className="btn btn-ghost" onClick={() => setDupFlight(null)}>Cancel</button>
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
