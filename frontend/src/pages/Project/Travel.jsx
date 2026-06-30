import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

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

export default function Travel({ project }) {
  const [hotels, setHotels] = useState([]);
  const [flights, setFlights] = useState([]);
  const [drives, setDrives] = useState([]);
  const [cars, setCars] = useState([]);

  const [showHotel, setShowHotel] = useState(false);
  const [hotelForm, setHotelForm] = useState({ name:'', address:'', phone:'' });
  const [guestHotelId, setGuestHotelId] = useState(null);
  const [guestForm, setGuestForm] = useState({ crewMemberId:'', guestName:'', confirmation:'', checkIn:'', checkOut:'', cost:'' });

  const [showFlight, setShowFlight] = useState(false);
  const [flightForm, setFlightForm] = useState({ crewMemberId:'', passengerName:'', origin:'', destination:'', departTime:'', arriveTime:'', airline:'', confirmation:'', isReturn:false, cost:'' });

  const [showDrive, setShowDrive] = useState(false);
  const [driveForm, setDriveForm] = useState({ origin:'', destination:'', notes:'', members:[] });
  const [driveMember, setDriveMember] = useState('');

  const [showCar, setShowCar] = useState(false);
  const [carForm, setCarForm] = useState({ vendor:'', pickupLocation:'', dropoffLocation:'', pickupDate:'', dropoffDate:'', confirmation:'', cost:'', notes:'' });

  // Crew from project assignments (not global roster)
  const projectCrew = project.crewAssignments || [];

  useEffect(() => {
    Promise.all([
      api.getHotels(project.id),
      api.getFlights(project.id),
      api.getDrives(project.id),
      api.getRentalCars(project.id),
    ]).then(([h,f,d,c]) => { setHotels(h); setFlights(f); setDrives(d); setCars(c); });
  }, [project.id]);

  async function addHotel(e) {
    e.preventDefault();
    const h = await api.createHotel(project.id, hotelForm);
    setHotels(prev => [...prev, { ...h, guests:[] }]);
    setShowHotel(false); setHotelForm({ name:'', address:'', phone:'' });
  }

  async function addGuest(e) {
    e.preventDefault();
    const g = await api.addGuest(project.id, guestHotelId, {
      ...guestForm,
      checkIn: new Date(guestForm.checkIn).toISOString(),
      checkOut: new Date(guestForm.checkOut).toISOString(),
      crewMemberId: guestForm.crewMemberId || null,
      cost: guestForm.cost || null,
    });
    setHotels(prev => prev.map(h => h.id === guestHotelId ? { ...h, guests: [...h.guests, g] } : h));
    setGuestHotelId(null); setGuestForm({ crewMemberId:'', guestName:'', confirmation:'', checkIn:'', checkOut:'', cost:'' });
  }

  async function removeGuest(hotelId, guestId) {
    await api.deleteGuest(project.id, guestId);
    setHotels(prev => prev.map(h => h.id === hotelId ? { ...h, guests: h.guests.filter(g => g.id !== guestId) } : h));
  }

  async function addFlight(e) {
    e.preventDefault();
    const f = await api.createFlight(project.id, {
      ...flightForm,
      departTime: new Date(flightForm.departTime).toISOString(),
      arriveTime: new Date(flightForm.arriveTime).toISOString(),
      crewMemberId: flightForm.crewMemberId || null,
      cost: flightForm.cost || null,
    });
    setFlights(prev => [...prev, f]);
    setShowFlight(false); setFlightForm({ crewMemberId:'', passengerName:'', origin:'', destination:'', departTime:'', arriveTime:'', airline:'', confirmation:'', isReturn:false, cost:'' });
  }

  async function removeFlight(id) {
    await api.deleteFlight(project.id, id);
    setFlights(prev => prev.filter(f => f.id !== id));
  }

  async function addDrive(e) {
    e.preventDefault();
    const d = await api.createDrive(project.id, driveForm);
    setDrives(prev => [...prev, d]);
    setShowDrive(false); setDriveForm({ origin:'', destination:'', notes:'', members:[] });
  }

  async function removeDrive(id) {
    await api.deleteDrive(project.id, id);
    setDrives(prev => prev.filter(d => d.id !== id));
  }

  function addDriveMember() {
    if (!driveMember.trim()) return;
    setDriveForm(f => ({ ...f, members: [...f.members, { name: driveMember }] }));
    setDriveMember('');
  }

  async function addCar(e) {
    e.preventDefault();
    const c = await api.createRentalCar(project.id, {
      ...carForm,
      pickupDate: carForm.pickupDate ? new Date(carForm.pickupDate).toISOString() : null,
      dropoffDate: carForm.dropoffDate ? new Date(carForm.dropoffDate).toISOString() : null,
      cost: carForm.cost || null,
    });
    setCars(prev => [...prev, c]);
    setShowCar(false); setCarForm({ vendor:'', pickupLocation:'', dropoffLocation:'', pickupDate:'', dropoffDate:'', confirmation:'', cost:'', notes:'' });
  }

  async function removeCar(id) {
    await api.deleteRentalCar(project.id, id);
    setCars(prev => prev.filter(c => c.id !== id));
  }

  const hotelTotal = totalCost(hotels.flatMap(h => h.guests));
  const flightTotal = totalCost(flights);
  const carTotal = totalCost(cars);

  return (
    <div>
      <div className="page-title" style={{ marginBottom:3 }}>Travel & Logistics</div>
      <div className="page-sub">{project.code} · {project.city}, {project.state} · {fmt(project.startDate)} – {fmt(project.endDate)}</div>

      {/* Hotels */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="sec-lbl" style={{ marginTop:0 }}>Hotels</div>
          {hotelTotal && <span style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{hotelTotal} total</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowHotel(true)}>+ Add Hotel</button>
      </div>
      {hotels.map(h => (
        <div key={h.id} className="h-card">
          <div className="h-name">{h.name}</div>
          <div className="h-addr">{h.address}{h.phone && ` · ${h.phone}`}</div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:11, color:'var(--muted)' }}>{h.guests.length} confirmation{h.guests.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => { setGuestHotelId(h.id); setGuestForm({ crewMemberId:'', guestName:'', confirmation:'', checkIn:'', checkOut:'', cost:'' }); }}>+ Add Confirmation</button>
          </div>
          <div className="guests">
            {h.guests.map(g => (
              <div key={g.id} className="gc" style={{ position:'relative' }}>
                <div className="gn">{g.guestName}</div>
                <div className="gconf">{g.confirmation ? `# ${g.confirmation}` : 'No confirmation'}</div>
                <div className="gdates">{fmt(g.checkIn)} – {fmt(g.checkOut)}</div>
                {g.cost && <div style={{ fontSize:10, color:'var(--green)', fontWeight:600 }}>{fmtCost(g.cost)}</div>}
                <button style={{ position:'absolute', top:4, right:6, background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => removeGuest(h.id, g.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {hotels.length === 0 && <div className="empty">No hotels added yet.</div>}

      {/* Flights */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="sec-lbl">Flights</div>
          {flightTotal && <span style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{flightTotal} total</span>}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowFlight(true)}>+ Add Flight</button>
      </div>
      {flights.map(f => (
        <div key={f.id} className="frow">
          <div className="fname">{f.passengerName}</div>
          <div className="froute"><span>{f.origin}</span><span className="farrow">→</span><span>{f.destination}</span></div>
          <div className="ftimes">{fmtDT(f.departTime)} → {fmtDT(f.arriveTime)}</div>
          {f.airline && <span className="abadge">{f.airline}</span>}
          {f.confirmation && <span style={{ fontSize:10, color:'var(--muted)' }}>{f.confirmation}</span>}
          {f.cost && <span style={{ fontSize:10, color:'var(--green)', fontWeight:600 }}>{fmtCost(f.cost)}</span>}
          {f.isReturn && <span className="badge">Return</span>}
          <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, marginLeft:'auto' }} onClick={() => removeFlight(f.id)}>✕</button>
        </div>
      ))}
      {flights.length === 0 && <div className="empty">No flights added yet.</div>}

      {/* Rental Cars */}
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
          <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, marginLeft:'auto' }} onClick={() => removeCar(c.id)}>✕</button>
        </div>
      ))}
      {cars.length === 0 && <div className="empty">No rental cars added yet.</div>}

      {/* Drive Groups */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="sec-lbl">Drive Groups</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowDrive(true)}>+ Add Group</button>
      </div>
      <div className="chips" style={{ marginBottom:16 }}>
        {drives.map(d => (
          <div key={d.id} className="chip" style={{ position:'relative' }}>
            <strong>{d.origin} → {d.destination}</strong>
            {d.members.map(m => m.name).join(', ')}
            {d.notes && <><br/><span style={{ color:'var(--muted)' }}>{d.notes}</span></>}
            <button style={{ position:'absolute', top:4, right:6, background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => removeDrive(d.id)}>✕</button>
          </div>
        ))}
        {drives.length === 0 && <span className="empty" style={{ padding:0 }}>No drive groups yet.</span>}
      </div>

      {/* Hotel Modal */}
      {showHotel && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowHotel(false)}>
          <div className="modal">
            <div className="modal-title">Add Hotel</div>
            <form onSubmit={addHotel}>
              <div className="form-grid cols1" style={{ marginBottom:12 }}>
                <div className="field"><label>Hotel Name</label><input value={hotelForm.name} onChange={e => setHotelForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Address</label><input value={hotelForm.address} onChange={e => setHotelForm(f=>({...f,address:e.target.value}))} required /></div>
                <div className="field"><label>Phone</label><input value={hotelForm.phone} onChange={e => setHotelForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Hotel</button><button type="button" className="btn btn-ghost" onClick={() => setShowHotel(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Confirmation Modal */}
      {guestHotelId && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setGuestHotelId(null)}>
          <div className="modal">
            <div className="modal-title">Add Confirmation</div>
            <form onSubmit={addGuest}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2">
                  <label>Crew Member</label>
                  <select value={guestForm.crewMemberId} onChange={e => {
                    const id = e.target.value;
                    const a = projectCrew.find(a => a.crewMemberId === id);
                    setGuestForm(f=>({ ...f, crewMemberId: id, guestName: a?.crewMember?.name || f.guestName }));
                  }}>
                    <option value="">— Select crew member —</option>
                    {projectCrew.filter(a => a.crewMember).map(a => (
                      <option key={a.crewMemberId} value={a.crewMemberId}>{a.crewMember.name} — {a.position.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field span2"><label>Guest Name</label><input value={guestForm.guestName} onChange={e => setGuestForm(f=>({...f,guestName:e.target.value}))} required /></div>
                <div className="field span2"><label>Confirmation #</label><input value={guestForm.confirmation} onChange={e => setGuestForm(f=>({...f,confirmation:e.target.value}))} placeholder="138215420" /></div>
                <div className="field"><label>Check In</label><input type="date" value={guestForm.checkIn} onChange={e => setGuestForm(f=>({...f,checkIn:e.target.value}))} required /></div>
                <div className="field"><label>Check Out</label><input type="date" value={guestForm.checkOut} onChange={e => setGuestForm(f=>({...f,checkOut:e.target.value}))} required /></div>
                <div className="field span2"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={guestForm.cost} onChange={e => setGuestForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Confirmation</button><button type="button" className="btn btn-ghost" onClick={() => setGuestHotelId(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Flight Modal */}
      {showFlight && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowFlight(false)}>
          <div className="modal">
            <div className="modal-title">Add Flight</div>
            <form onSubmit={addFlight}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2">
                  <label>Crew Member</label>
                  <select value={flightForm.crewMemberId} onChange={e => {
                    const id = e.target.value;
                    const a = projectCrew.find(a => a.crewMemberId === id);
                    setFlightForm(f=>({ ...f, crewMemberId: id, passengerName: a?.crewMember?.name || f.passengerName }));
                  }}>
                    <option value="">— Select crew member —</option>
                    {projectCrew.filter(a => a.crewMember).map(a => (
                      <option key={a.crewMemberId} value={a.crewMemberId}>{a.crewMember.name} — {a.position.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field span2"><label>Passenger Name</label><input value={flightForm.passengerName} onChange={e => setFlightForm(f=>({...f,passengerName:e.target.value}))} required /></div>
                <div className="field"><label>Origin</label><input value={flightForm.origin} onChange={e => setFlightForm(f=>({...f,origin:e.target.value}))} placeholder="STL" required /></div>
                <div className="field"><label>Destination</label><input value={flightForm.destination} onChange={e => setFlightForm(f=>({...f,destination:e.target.value}))} placeholder="MCI" required /></div>
                <div className="field"><label>Depart</label><input type="datetime-local" value={flightForm.departTime} onChange={e => setFlightForm(f=>({...f,departTime:e.target.value}))} required /></div>
                <div className="field"><label>Arrive</label><input type="datetime-local" value={flightForm.arriveTime} onChange={e => setFlightForm(f=>({...f,arriveTime:e.target.value}))} required /></div>
                <div className="field"><label>Airline</label><input value={flightForm.airline} onChange={e => setFlightForm(f=>({...f,airline:e.target.value}))} placeholder="Southwest" /></div>
                <div className="field"><label>Confirmation</label><input value={flightForm.confirmation} onChange={e => setFlightForm(f=>({...f,confirmation:e.target.value}))} placeholder="APMKP8" /></div>
                <div className="field span2"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={flightForm.cost} onChange={e => setFlightForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
                <div className="field span2" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <input type="checkbox" id="isReturn" checked={flightForm.isReturn} onChange={e => setFlightForm(f=>({...f,isReturn:e.target.checked}))} style={{ width:'auto' }} />
                  <label htmlFor="isReturn" style={{ textTransform:'none', letterSpacing:0, fontSize:12, color:'var(--text)' }}>Return flight</label>
                </div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Flight</button><button type="button" className="btn btn-ghost" onClick={() => setShowFlight(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Rental Car Modal */}
      {showCar && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowCar(false)}>
          <div className="modal">
            <div className="modal-title">Add Rental Car</div>
            <form onSubmit={addCar}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Vendor</label><input value={carForm.vendor} onChange={e => setCarForm(f=>({...f,vendor:e.target.value}))} placeholder="Enterprise" required /></div>
                <div className="field"><label>Pickup Location</label><input value={carForm.pickupLocation} onChange={e => setCarForm(f=>({...f,pickupLocation:e.target.value}))} placeholder="MCI Airport" /></div>
                <div className="field"><label>Dropoff Location</label><input value={carForm.dropoffLocation} onChange={e => setCarForm(f=>({...f,dropoffLocation:e.target.value}))} placeholder="MCI Airport" /></div>
                <div className="field"><label>Pickup Date</label><input type="date" value={carForm.pickupDate} onChange={e => setCarForm(f=>({...f,pickupDate:e.target.value}))} /></div>
                <div className="field"><label>Dropoff Date</label><input type="date" value={carForm.dropoffDate} onChange={e => setCarForm(f=>({...f,dropoffDate:e.target.value}))} /></div>
                <div className="field"><label>Confirmation #</label><input value={carForm.confirmation} onChange={e => setCarForm(f=>({...f,confirmation:e.target.value}))} placeholder="XT29183K" /></div>
                <div className="field"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={carForm.cost} onChange={e => setCarForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
                <div className="field span2"><label>Notes</label><input value={carForm.notes} onChange={e => setCarForm(f=>({...f,notes:e.target.value}))} placeholder="Full-size SUV" /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Rental Car</button><button type="button" className="btn btn-ghost" onClick={() => setShowCar(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Drive Group Modal */}
      {showDrive && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowDrive(false)}>
          <div className="modal">
            <div className="modal-title">Add Drive Group</div>
            <form onSubmit={addDrive}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>From</label><input value={driveForm.origin} onChange={e => setDriveForm(f=>({...f,origin:e.target.value}))} placeholder="STL Office" required /></div>
                <div className="field"><label>To</label><input value={driveForm.destination} onChange={e => setDriveForm(f=>({...f,destination:e.target.value}))} placeholder="Kansas City" required /></div>
                <div className="field span2"><label>Notes</label><input value={driveForm.notes} onChange={e => setDriveForm(f=>({...f,notes:e.target.value}))} placeholder="Leave 8 AM · Arrive noon" /></div>
                <div className="field span2">
                  <label>Passengers</label>
                  <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                    <input value={driveMember} onChange={e => setDriveMember(e.target.value)} placeholder="Name" onKeyDown={e => e.key==='Enter' && (e.preventDefault(), addDriveMember())} />
                    <button type="button" className="btn btn-ghost btn-sm" onClick={addDriveMember}>Add</button>
                  </div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    {driveForm.members.map((m,i) => (
                      <span key={i} className="badge" style={{ cursor:'pointer' }} onClick={() => setDriveForm(f=>({ ...f, members: f.members.filter((_,j)=>j!==i) }))}>
                        {m.name} ✕
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Drive Group</button><button type="button" className="btn btn-ghost" onClick={() => setShowDrive(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
