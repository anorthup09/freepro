import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { displayName } from '../utils/displayName.js';

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const COMING_SOON = { label: 'STATUS COMING SOON', color: 'var(--orange)', dot: null };
function flightStatus(f, now) {
  const depart = f.depart_time ? new Date(f.depart_time) : null;
  const arrive = f.arrive_time ? new Date(f.arrive_time) : null;
  if (!depart) return COMING_SOON;
  const todayStr = now.toISOString().slice(0, 10);
  const departStr = depart.toISOString().slice(0, 10);
  if (todayStr < departStr) return COMING_SOON;
  if (now < depart) return { label: 'Pre-flight', color: '#6b7280', dot: '#6b7280' };
  if (arrive && now < arrive) return { label: 'In-flight', color: '#60a5fa', dot: '#60a5fa' };
  return { label: 'Arrived', color: '#22c55e', dot: '#22c55e' };
}

function fmt(dt) {
  if (!dt) return '';
  // Slice to date-only and use local noon to prevent UTC day-shift
  return new Date(String(dt).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_LABEL = { WAITING_ON_ASSETS:'Waiting on Assets', IN_PROGRESS:'In Progress', ROUGH_CUT:'Rough Cut', IN_REVIEW:'In Review', APPROVED:'Approved', DELIVERED:'Delivered' };

function shortName(name) {
  if (!name) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  // Remove middle initials (single letter with optional period)
  const filtered = parts.filter((p, i) => i === 0 || i === parts.length - 1 || !/^[A-Za-z]\.?$/.test(p));
  return filtered.join(' ');
}

const SHARE_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function displayMD(str) {
  if (!str) return null;
  const m = str.match(/^(\w{3})\s+(\d+)/);
  if (!m) return null;
  const mi = SHARE_MONTHS.indexOf(m[1]);
  return mi >= 0 ? `${String(mi + 1).padStart(2,'0')}-${String(parseInt(m[2])).padStart(2,'0')}` : null;
}

function fmtDT(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function fmtTime(str) {
  if (!str) return '';
  if (/AM|PM/i.test(str)) return str;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h)) return str;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function GearSection({ gear, onlineRentals = [], producerView, shareToken }) {
  const [editingGear, setEditingGear] = useState({});
  const [gearDraft, setGearDraft] = useState({});

  if (!gear && onlineRentals.length === 0) return null;
  const hasRental = gear && (gear.rental_company || gear.rental_contact || gear.rental_phone || gear.rental_email);
  const gearList = gear ? [
    { label: 'Camera', value: gear.camera_gear },
    { label: 'Grip', value: gear.grip_gear },
    { label: 'Electric', value: gear.electric_gear },
    { label: 'Audio', value: gear.audio_gear },
    { label: 'Media Management', value: gear.media_management_gear },
    { label: 'Editing', value: gear.editing_gear },
  ].filter(g => g.value) : [];
  const hasDelivery = gear && (gear.delivery_datetime || gear.pickup_datetime || gear.delivery_driver);
  const docs = gear ? [
    { label: 'Internal Request', done: gear.internal_request_submitted },
    { label: 'COI', done: gear.coi_received },
    { label: 'Rental Agreement', done: gear.rental_agreement_received },
    { label: 'CC Auth', done: gear.cc_auth_received },
  ] : [];
  const hasDocInfo = producerView && docs.some(d => d.done != null);

  function startEdit(label, value) {
    if (!shareToken) return;
    setEditingGear(e => ({ ...e, [label]: true }));
    setGearDraft(d => ({ ...d, [label]: value || '' }));
  }

  async function saveGearField(label) {
    setEditingGear(e => ({ ...e, [label]: false }));
    const keyMap = { Camera:'camera_gear', Grip:'grip_gear', Electric:'electric_gear', Audio:'audio_gear', 'Media Management':'media_management_gear', Editing:'editing_gear' };
    const dbKey = keyMap[label];
    if (!dbKey || !shareToken) return;
    const body = {};
    const allKeys = Object.values(keyMap);
    allKeys.forEach(k => { body[k] = gear?.[k] || null; });
    body[dbKey] = gearDraft[label] || null;
    try {
      const BACKEND = import.meta.env.VITE_API_URL || 'https://freepro-production.up.railway.app';
      await fetch(`${BACKEND}/share/${shareToken}/gear`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (gear) gear[dbKey] = gearDraft[label] || null;
    } catch(e) { /* silent */ }
  }

  if (!gear?.storage_location && !hasRental && !gearList.length && !hasDelivery && !hasDocInfo && onlineRentals.length === 0) return null;

  return (
    <section className="share-section">
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>
        <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', letterSpacing:'-0.01em', whiteSpace:'nowrap' }}>Gear</div>
        <div style={{ flex:1, height:1, background:'var(--border)' }} />
      </div>

      {gear?.storage_location && (
        <div style={{ marginBottom:10 }}>
          <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Storage Location</span>
          <div style={{ fontSize:13, color:'var(--text)', marginTop:3 }}>{gear.storage_location}</div>
        </div>
      )}

      {/* Rental House + Online Rentals side by side as tiles */}
      {(hasRental || onlineRentals.length > 0) && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8, fontWeight:600 }}>Rental House</div>
            {hasRental ? (
              <>
                <div style={{ fontSize:14, color:'var(--text)', fontWeight:600, marginBottom:4 }}>{gear.rental_company || '—'}</div>
                {(gear.rental_contact || gear.rental_phone || gear.rental_email) && (
                  <div style={{ fontSize:12, color:'var(--tan)', lineHeight:1.6 }}>
                    {gear.rental_contact && <div>{gear.rental_contact}</div>}
                    {gear.rental_phone && <div>{gear.rental_phone}</div>}
                    {gear.rental_email && <div>{gear.rental_email}</div>}
                  </div>
                )}
                {gear.rental_cost && <div style={{ fontSize:12, color:'var(--green,#4ade80)', fontWeight:600, marginTop:6 }}>Est. ${parseFloat(gear.rental_cost).toFixed(2)}</div>}
              </>
            ) : <div style={{ fontSize:12, color:'var(--muted)' }}>None</div>}
          </div>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8, fontWeight:600 }}>Online Rentals</div>
            {onlineRentals.length > 0 ? (
              <div>
                {onlineRentals.map((r, idx) => (
                  <div key={r.id} style={{ marginBottom: idx < onlineRentals.length - 1 ? 10 : 0, paddingBottom: idx < onlineRentals.length - 1 ? 10 : 0, borderBottom: idx < onlineRentals.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    {r.renter_name && <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:3 }}>{r.renter_name}</div>}
                    {r.confirmation && <div style={{ fontSize:11, color:'var(--muted)' }}>Conf # {r.confirmation}</div>}
                    {r.tracking_number && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Tracking: <span style={{ color:'var(--text)' }}>{r.tracking_number}</span></div>}
                    {r.notes && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', marginTop:2 }}>{r.notes}</div>}
                  </div>
                ))}
              </div>
            ) : <div style={{ fontSize:12, color:'var(--muted)' }}>None</div>}
          </div>
        </div>
      )}

      {(gearList.length > 0 || shareToken) && (() => {
        const ALL_CATS = ['Camera','Grip','Electric','Audio','Media Management','Editing'];
        const tiles = shareToken
          ? ALL_CATS.map(label => ({ label, value: gear?.[{ Camera:'camera_gear', Grip:'grip_gear', Electric:'electric_gear', Audio:'audio_gear', 'Media Management':'media_management_gear', Editing:'editing_gear' }[label]] || '' }))
          : gearList;
        if (!tiles.some(t => t.value) && !shareToken) return null;
        return (
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8, fontWeight:600 }}>
              Gear List{shareToken && <span style={{ fontSize:9, color:'var(--muted)', fontStyle:'italic', marginLeft:6, textTransform:'none', letterSpacing:0 }}>click to edit</span>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {tiles.map(g => (
                <div key={g.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', cursor: shareToken ? 'text' : 'default' }}
                  onClick={() => !editingGear[g.label] && startEdit(g.label, g.value)}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6, fontWeight:600 }}>{g.label}</div>
                  {editingGear[g.label] ? (
                    <textarea
                      autoFocus
                      value={gearDraft[g.label]}
                      onChange={e => setGearDraft(d => ({ ...d, [g.label]: e.target.value }))}
                      onBlur={() => saveGearField(g.label)}
                      style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13, lineHeight:1.5, resize:'vertical', minHeight:48, fontFamily:'inherit' }}
                    />
                  ) : (
                    <div style={{ fontSize:13, color: g.value ? 'var(--text)' : 'var(--muted)', lineHeight:1.5, whiteSpace:'pre-wrap', fontStyle: g.value ? 'normal' : 'italic' }}>
                      {g.value || (shareToken ? 'Click to add…' : '')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {hasDelivery && (
        <div style={{ marginBottom:10 }}>
          <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Delivery</span>
          <div style={{ marginTop:4 }}>
            {gear.delivery_datetime && <div style={{ fontSize:12, color:'var(--text)', marginBottom:2 }}>📦 Delivery: {gear.delivery_datetime}</div>}
            {gear.pickup_datetime && <div style={{ fontSize:12, color:'var(--text)', marginBottom:2 }}>🔄 Pickup: {gear.pickup_datetime}</div>}
            {gear.delivery_driver && (
              <div style={{ fontSize:12, color:'var(--tan)' }}>
                Driver: {gear.delivery_driver}{gear.delivery_driver_phone ? ` · ${gear.delivery_driver_phone}` : ''}
              </div>
            )}
          </div>
        </div>
      )}

      {producerView && (
        <div>
          <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Documents</span>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
            {docs.map(d => (
              <div key={d.label} style={{ display:'flex', alignItems:'center', gap:5, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'4px 10px', fontSize:11 }}>
                <span style={{ color: d.done ? 'var(--green, #4ade80)' : 'var(--muted)' }}>{d.done ? '✓' : '○'}</span>
                <span style={{ color: d.done ? 'var(--text)' : 'var(--muted)' }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function HotelRoster({ hotelBlocks, crewAssignments }) {
  // Build a flat map: crew_member_id → { guest, hotelBlock }
  const bookingMap = {};
  (hotelBlocks || []).forEach(hb => {
    (hb.guests || []).forEach(g => {
      if (g.crew_member_id) {
        if (!bookingMap[g.crew_member_id]) bookingMap[g.crew_member_id] = [];
        bookingMap[g.crew_member_id].push({ guest: g, hotel: hb });
      }
    });
  });

  // Guests that aren't linked to a crew member (manually entered names)
  const unlinkedGuests = [];
  (hotelBlocks || []).forEach(hb => {
    (hb.guests || []).forEach(g => {
      if (!g.crew_member_id) unlinkedGuests.push({ guest: g, hotel: hb });
    });
  });

  const crew = (crewAssignments || []).filter(a => a.crewMember);

  return (
    <div>
      {/* Hotel block headers */}
      {(hotelBlocks || []).map(hb => (
        <div key={hb.id} style={{ fontSize:12, color:'var(--tan)', marginBottom:6 }}>
          🏨 <span style={{ fontWeight:600, color:'var(--text)' }}>{hb.name}</span>
          {hb.address && <> · <a href={mapsUrl(hb.address)} target="_blank" rel="noreferrer" style={{ color:'var(--tan)', textDecoration:'underline' }}>{hb.address}</a></>}
          {hb.phone && <> · {hb.phone}</>}
        </div>
      ))}

      <div className="tl" style={{ marginTop:10 }}>
        {crew.map(a => {
          const bookings = bookingMap[a.crewMember.id] || [];
          const hasBooking = bookings.length > 0;
          const confirmed = bookings.some(b => b.guest.confirmation);
          const dim = !hasBooking || !confirmed;

          return (
            <div key={a.id} className="ev" style={{ opacity: dim ? 0.4 : 1 }}>
              <div className="ev-time" style={{ fontSize:18, lineHeight:1, paddingTop:2 }}>
                {confirmed ? '✓' : hasBooking ? '○' : '—'}
              </div>
              <div className="ev-body" style={{ borderLeft: `2px solid ${confirmed ? 'var(--green, #4ade80)' : 'var(--border)'}` }}>
                <div className="ev-title">{displayName(a.crewMember)}</div>
                <div className="ev-detail" style={{ color:'var(--muted)' }}>{a.position.name}</div>
                {bookings.map((b, i) => (
                  <div key={i} style={{ marginTop:3, fontSize:11, color: b.guest.confirmation ? 'var(--tan)' : 'var(--muted)' }}>
                    {bookings.length > 1 && <span style={{ color:'var(--muted)' }}>{b.hotel.name} · </span>}
                    {fmtDT(b.guest.check_in)} → {fmtDT(b.guest.check_out)}
                    {b.guest.confirmation
                      ? <span style={{ marginLeft:8, color:'var(--text)', fontWeight:500 }}>#{b.guest.confirmation}</span>
                      : <span style={{ marginLeft:8, color:'var(--muted)', fontStyle:'italic' }}>No confirmation</span>}
                  </div>
                ))}
                {!hasBooking && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, fontStyle:'italic' }}>No booking</div>}
              </div>
            </div>
          );
        })}

        {/* Unlinked guests (manually entered, no crew_member_id) */}
        {unlinkedGuests.map((b, i) => (
          <div key={`unlinked-${i}`} className="ev">
            <div className="ev-time" style={{ fontSize:18, lineHeight:1, paddingTop:2 }}>
              {b.guest.confirmation ? '✓' : '○'}
            </div>
            <div className="ev-body" style={{ borderLeft: `2px solid ${b.guest.confirmation ? 'var(--green, #4ade80)' : 'var(--border)'}` }}>
              <div className="ev-title">{b.guest.guest_name}</div>
              {unlinkedGuests.length > 1 && <div className="ev-detail" style={{ color:'var(--muted)' }}>{b.hotel.name}</div>}
              <div style={{ marginTop:3, fontSize:11, color: b.guest.confirmation ? 'var(--tan)' : 'var(--muted)' }}>
                {fmtDT(b.guest.check_in)} → {fmtDT(b.guest.check_out)}
                {b.guest.confirmation
                  ? <span style={{ marginLeft:8, color:'var(--text)', fontWeight:500 }}>#{b.guest.confirmation}</span>
                  : <span style={{ marginLeft:8, color:'var(--muted)', fontStyle:'italic' }}>No confirmation</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpecTiles({ techSpecs }) {
  if (!techSpecs) return null;
  const specs = [
    { label: 'Aspect Ratio', value: techSpecs.aspect_ratio },
    { label: 'Resolution',   value: techSpecs.resolution },
    { label: 'Frame Rate',   value: techSpecs.frame_rate },
  ].filter(s => s.value);
  if (!specs.length) return null;
  return (
    <section className="share-section">
      <div className="sec-lbl">Tech Specs</div>
      <div className="spec-tiles">
        {specs.map(s => (
          <div key={s.label} className="spec-tile">
            <div className="spec-tile-label">{s.label}</div>
            <div className="spec-tile-val">{s.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FlightStatusCell({ f }) {
  const now = useNow();
  const s = flightStatus(f, now);
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
      <div style={{ width:7, height:7, borderRadius:'50%', background: s.dot || 'transparent', border: s.dot ? 'none' : '1.5px solid var(--orange)', flexShrink:0 }} />
      <span style={{ fontSize: s.dot ? 11 : 9, fontWeight: s.dot ? 600 : 400, color:s.color, textTransform:'uppercase', letterSpacing: s.dot ? '0.05em' : '0.03em', fontStyle: s.dot ? 'normal' : 'italic' }}>{s.label}</span>
    </div>
  );
}

function FlightsTable({ flights }) {
  return (
    <table className="share-table">
      <thead>
        <tr>
          {['Passenger','Route','Departure','Arrival','Flight','Confirmation','Status'].map(c => <th key={c}>{c}</th>)}
        </tr>
      </thead>
      <tbody>
        {flights.map((f, i) => (
          <tr key={i}>
            <td>{f.crew_name || f.passenger_name || '—'}</td>
            <td>{f.origin} → {f.destination}</td>
            <td className="nowrap">{f.depart_display || fmtDT(f.depart_time)}</td>
            <td className="nowrap">{f.arrive_display || fmtDT(f.arrive_time)}</td>
            <td className="nowrap">{[f.airline, f.flight_number].filter(Boolean).join(' ') || '—'}</td>
            <td>{f.confirmation || '—'}</td>
            <td><FlightStatusCell f={f} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Producer View ────────────────────────────────────────────────────────────
function ProducerView({ data }) {
  const { project, locations, techSpecs, clientContacts, agencyContacts = [], keyTalent, crewAssignments, schedule, flights, hotelBlocks, rentalCars, deliverables, gear, onlineRentals = [] } = data;
  const scheduleRef = useRef(null);
  const [tagFilter, setTagFilter] = useState(null);
  return (
    <div className="share-view">
      <div className="share-header">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div>
            <div className="proj-code">{project.code}</div>
            <div className="proj-title">{project.title}</div>
            <div className="proj-meta" style={{ marginTop: 6 }}>
              <span className="meta">{project.client}</span>
              <span className="meta">{project.city}, {project.state}</span>
              <span className="meta">{fmt(project.start_date)} – {fmt(project.end_date)}</span>
            </div>
          </div>
          {schedule?.length > 0 && (
            <button onClick={() => scheduleRef.current?.scrollIntoView({ behavior:'smooth' })} style={{ flexShrink:0, marginTop:4, padding:'6px 14px', fontSize:12, fontWeight:600, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', cursor:'pointer', whiteSpace:'nowrap' }}>
              Jump to Schedule ↓
            </button>
          )}
        </div>
      </div>

      {/* ── Key Contacts at top ── */}
      {(project.poc_name || gear?.gear_person_name) && (
        <section className="share-section">
          <div className="sec-lbl">Key Contacts</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {project.poc_name && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Main POC</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{shortName(project.poc_name)}</div>
                {project.poc_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}>{project.poc_phone}</div>}
                {project.poc_email && <div style={{ fontSize:11, color:'var(--muted)' }}>{project.poc_email}</div>}
              </div>
            )}
            {gear?.gear_person_name && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Gear Contact</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{shortName(gear.gear_person_name)}</div>
                {gear.gear_person_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}>{gear.gear_person_phone}</div>}
              </div>
            )}
          </div>
        </section>
      )}

      <SpecTiles techSpecs={techSpecs} />

      {/* ── Hotels at top ── */}
      {hotelBlocks?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Hotel Accommodations</div>
          <HotelRoster hotelBlocks={hotelBlocks} crewAssignments={crewAssignments} />
        </section>
      )}

      {flights?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Flights</div>
          <FlightsTable flights={flights} />
        </section>
      )}

      {locations?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Locations</div>
          <div className="loc-grid">
            {locations.map(l => (
              <div key={l.id} className="loc">
                <div className="loc-ico">{l.emoji || '📍'}</div>
                <div>
                  <div className="loc-name">{l.name}</div>
                  {l.address
                    ? <a href={mapsUrl(l.address)} target="_blank" rel="noreferrer" className="loc-addr" style={{ color:'var(--tan)', textDecoration:'underline' }}>{l.address}</a>
                    : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {clientContacts?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Client Contacts</div>
          <ShareTable cols={['Name','Title','Email','Phone']} colClasses={['','','','nowrap']} rows={clientContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}

      {agencyContacts?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Agency Contacts</div>
          <ShareTable cols={['Name','Title','Email','Phone']} colClasses={['','','','nowrap']} rows={agencyContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}

      {keyTalent?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Key Talent</div>
          <ShareTable cols={['Name','Role','Phone','Email','Dietary','Notes']} colClasses={['','','nowrap','','','']} rows={keyTalent.map(t => [t.name, t.role, t.phone||'—', t.email||'—', t.dietary_restrictions||'—', t.notes||'—'])} />
        </section>
      )}

      {crewAssignments?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Crew</div>
          <ShareTable cols={['Position','Name','Email','Phone','Dietary']} colClasses={['','','','nowrap','']} rows={crewAssignments.map(a => [a.position.name, a.crewMember ? displayName(a.crewMember)||'TBD' : 'TBD', a.crewMember?.email||'—', a.crewMember?.phone||'—', <DietaryCell key={a.id} value={a.crewMember?.dietaryRestrictions} />])} />
        </section>
      )}

      {rentalCars?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Rental Cars</div>
          <ShareTable
            cols={['Vendor','Pick-up','Drop-off','Pick-up Date','Drop-off Date','Confirmation']}
            rows={rentalCars.map(r => [r.vendor, r.pickup_location||'—', r.dropoff_location||'—', fmtDT(r.pickup_date), fmtDT(r.dropoff_date), r.confirmation||'—'])}
          />
        </section>
      )}

      <GearSection gear={gear} onlineRentals={onlineRentals} producerView />

      {/* ── Post-Production ── */}
      {deliverables?.length > 0 && (
        <section className="share-section">
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:12, letterSpacing:'-0.01em' }}>Post-Production — Deliverables</div>
          {gear?.gear_person_name && (
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>
              DIT: <span style={{ color:'var(--text)', fontWeight:500 }}>{gear.gear_person_name}</span>
              {gear.gear_person_phone && <span style={{ marginLeft:8 }}>{gear.gear_person_phone}</span>}
            </div>
          )}
          <ShareTable
            cols={['Deliverable','Status','Editor','Specs','Due']}
            rows={deliverables.map(d => [
              d.title + (d.is_urgent ? ' ⚠' : ''),
              STATUS_LABEL[d.status] || d.status,
              d.editor_name || '—',
              [d.aspect_ratio, d.resolution].filter(Boolean).join(' · ') || '—',
              d.due_date || '—',
            ])}
          />
        </section>
      )}

      {/* ── Schedule (with integrated flights) at bottom ── */}
      <div ref={scheduleRef}>
        {(schedule||[]).length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8, margin:'24px 0 8px' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', letterSpacing:'-0.01em', flex:1 }}>Schedule</div>
            {['VIDEO','PHOTO'].map(tag => (
              <button key={tag} onClick={() => setTagFilter(f => f === tag ? null : tag)}
                style={{ fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:20, border:'1px solid var(--border)', background: tagFilter === tag ? 'var(--orange)' : 'var(--bg2)', color: tagFilter === tag ? '#fff' : 'var(--muted)', cursor:'pointer', letterSpacing:'.04em' }}>
                {tag}
              </button>
            ))}
          </div>
        )}
        {[...(schedule||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).filter(day => {
          if (!tagFilter) return true;
          if (day.events.some(e => (e.tags || []).some(t => t.type === tagFilter))) return true;
          return [day.call_time_tags, day.shooting_call_tags, day.lunch_tags, day.wrap_time_tags]
            .some(tags => Array.isArray(tags) && tags.includes(tagFilter));
        }).map((day, i) => (
          <DaySection key={day.id} day={day} showCalls flights={flights} dayIndex={i} tagFilter={tagFilter} />
        ))}
      </div>
    </div>
  );
}

// ── Crew View ────────────────────────────────────────────────────────────────
function CrewView({ data, shareToken }) {
  const { project, locations, techSpecs, clientContacts, agencyContacts = [], keyTalent, crewAssignments, schedule, flights, hotelBlocks, rentalCars, deliverables, gear, onlineRentals = [] } = data;
  const sortedSchedule = [...(schedule || [])].sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const scheduleRef = useRef(null);
  const [tagFilter, setTagFilter] = useState(null);
  return (
    <div className="share-view">
      <div className="share-header">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div>
            <div className="proj-code">{project.code}</div>
            <div className="proj-title">{project.title}</div>
            <div className="proj-meta" style={{ marginTop: 6 }}>
              <span className="meta">{project.client}</span>
              <span className="meta">{project.city}, {project.state}</span>
              <span className="meta">{fmt(project.start_date)} – {fmt(project.end_date)}</span>
            </div>
          </div>
          {schedule?.length > 0 && (
            <button onClick={() => scheduleRef.current?.scrollIntoView({ behavior:'smooth' })} style={{ flexShrink:0, marginTop:4, padding:'6px 14px', fontSize:12, fontWeight:600, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', cursor:'pointer', whiteSpace:'nowrap' }}>
              Jump to Schedule ↓
            </button>
          )}
        </div>
      </div>

      {(project.poc_name || gear?.gear_person_name) && (
        <section className="share-section">
          <div className="sec-lbl">Key Contacts</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {project.poc_name && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Main POC</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{shortName(project.poc_name)}</div>
                {project.poc_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}>{project.poc_phone}</div>}
                {project.poc_email && <div style={{ fontSize:11, color:'var(--muted)' }}>{project.poc_email}</div>}
              </div>
            )}
            {gear?.gear_person_name && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Gear Contact</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{shortName(gear.gear_person_name)}</div>
                {gear.gear_person_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}>{gear.gear_person_phone}</div>}
              </div>
            )}
          </div>
        </section>
      )}

      <SpecTiles techSpecs={techSpecs} />

      {hotelBlocks?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Hotel Accommodations</div>
          <HotelRoster hotelBlocks={hotelBlocks} crewAssignments={crewAssignments} />
        </section>
      )}

      {locations?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Locations</div>
          <div className="loc-grid">
            {locations.map(l => (
              <div key={l.id} className="loc">
                <div className="loc-ico">{l.emoji || '📍'}</div>
                <div>
                  <div className="loc-name">{l.name}</div>
                  {l.address
                    ? <a href={mapsUrl(l.address)} target="_blank" rel="noreferrer" className="loc-addr" style={{ color:'var(--tan)', textDecoration:'underline' }}>{l.address}</a>
                    : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {clientContacts?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Client Contacts</div>
          <ShareTable cols={['Name','Title','Email','Phone']} colClasses={['','','','nowrap']} rows={clientContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}

      {agencyContacts?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Agency Contacts</div>
          <ShareTable cols={['Name','Title','Email','Phone']} colClasses={['','','','nowrap']} rows={agencyContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}

      {keyTalent?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Key Talent</div>
          <ShareTable cols={['Name','Role','Phone','Email','Dietary','Notes']} colClasses={['','','nowrap','','','']} rows={keyTalent.map(t => [t.name, t.role, t.phone||'—', t.email||'—', t.dietary_restrictions||'—', t.notes||'—'])} />
        </section>
      )}

      {crewAssignments?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Crew</div>
          <ShareTable cols={['Position','Name','Email','Phone']} colClasses={['','','','nowrap']} rows={crewAssignments.map(a => [a.position.name, a.crewMember ? shortName(displayName(a.crewMember))||'TBD' : 'TBD', a.crewMember?.email||'—', a.crewMember?.phone||'—'])} />
        </section>
      )}

      {rentalCars?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Rental Cars</div>
          <ShareTable
            cols={['Vendor','Pick-up','Drop-off','Pick-up Date','Drop-off Date','Confirmation']}
            rows={rentalCars.map(r => [r.vendor, r.pickup_location||'—', r.dropoff_location||'—', fmtDT(r.pickup_date), fmtDT(r.dropoff_date), r.confirmation||'—'])}
          />
        </section>
      )}

      <GearSection gear={gear} onlineRentals={onlineRentals} shareToken={shareToken} />

      {deliverables?.length > 0 && (
        <section className="share-section">
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:12, letterSpacing:'-0.01em' }}>Post-Production — Deliverables</div>
          {gear?.gear_person_name && (
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>
              DIT: <span style={{ color:'var(--text)', fontWeight:500 }}>{gear.gear_person_name}</span>
              {gear.gear_person_phone && <span style={{ marginLeft:8 }}>{gear.gear_person_phone}</span>}
            </div>
          )}
          <ShareTable
            cols={['Deliverable','Status','Editor','Specs','Due']}
            rows={deliverables.map(d => [
              d.title + (d.is_urgent ? ' ⚠' : ''),
              STATUS_LABEL[d.status] || d.status,
              d.editor_name || '—',
              [d.aspect_ratio, d.resolution].filter(Boolean).join(' · ') || '—',
              d.due_date || '—',
            ])}
          />
        </section>
      )}

      <div ref={scheduleRef}>
        {sortedSchedule.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:8, margin:'24px 0 8px' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', letterSpacing:'-0.01em', flex:1 }}>Schedule</div>
            {['VIDEO','PHOTO'].map(tag => (
              <button key={tag} onClick={() => setTagFilter(f => f === tag ? null : tag)}
                style={{ fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:20, border:'1px solid var(--border)', background: tagFilter === tag ? 'var(--orange)' : 'var(--bg2)', color: tagFilter === tag ? '#fff' : 'var(--muted)', cursor:'pointer', letterSpacing:'.04em' }}>
                {tag}
              </button>
            ))}
          </div>
        )}
        {sortedSchedule.filter(day => {
          if (!tagFilter) return true;
          if (day.events.some(e => (e.tags || []).some(t => t.type === tagFilter))) return true;
          return [day.call_time_tags, day.shooting_call_tags, day.lunch_tags, day.wrap_time_tags]
            .some(tags => Array.isArray(tags) && tags.includes(tagFilter));
        }).map((day, i) => (
          <DaySection key={day.id} day={day} showCalls flights={flights} dayIndex={i} tagFilter={tagFilter} />
        ))}
      </div>
    </div>
  );
}

// ── Client View ──────────────────────────────────────────────────────────────
function ClientView({ data }) {
  const { project, locations, clientContacts, keyTalent, schedule } = data;
  return (
    <div className="share-view">
      <div className="share-header">
        <div className="proj-code">{project.code}</div>
        <div className="proj-title">{project.title}</div>
        <div className="proj-meta" style={{ marginTop: 6 }}>
          <span className="meta">{project.client}</span>
          <span className="meta">{project.city}, {project.state}</span>
          <span className="meta">{fmt(project.start_date)} – {fmt(project.end_date)}</span>
        </div>
      </div>
      {locations?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Locations</div>
          <div className="loc-grid">
            {locations.map(l => (
              <div key={l.id} className="loc">
                <div className="loc-ico">{l.emoji || '📍'}</div>
                <div><div className="loc-name">{l.name}</div><div className="loc-addr">{l.address}</div></div>
              </div>
            ))}
          </div>
        </section>
      )}
      {clientContacts?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Client Contacts</div>
          <ShareTable cols={['Name','Title','Email','Phone']} colClasses={['','','','nowrap']} rows={clientContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}
      {keyTalent?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Key Talent</div>
          <ShareTable cols={['Name','Role']} rows={keyTalent.map(t => [t.name, t.role])} />
        </section>
      )}
      {[...(schedule||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((day, i) => (
        <DaySection key={day.id} day={day} showCalls={false} dayIndex={i} />
      ))}
    </div>
  );
}

// ── Talent View ──────────────────────────────────────────────────────────────
function TalentView({ data }) {
  const { project, talent_name, locations, techSpecs, clientContacts, keyTalent, productionCrew, schedule } = data;
  const scheduleRef = useRef(null);

  // Only show days that have at least one event tagged for this talent
  const filteredSchedule = [...(schedule || [])].sort((a,b) => (a.date||'').localeCompare(b.date||'')).map(day => ({
    ...day,
    events: day.events.filter(e => (e.audience || []).includes(talent_name) || (e.audience || []).includes('talent')),
  })).filter(day => day.events.length > 0);

  return (
    <div className="share-view">
      <div className="share-header">
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
          <div>
            <div className="proj-code">{project.code}</div>
            <div className="proj-title">{project.title}</div>
            <div className="proj-meta" style={{ marginTop: 6 }}>
              <span className="meta">{project.client}</span>
              <span className="meta">{project.city}, {project.state}</span>
              <span className="meta">{fmt(project.start_date)} – {fmt(project.end_date)}</span>
            </div>
            {locations?.length > 0 && (
              <div style={{ marginTop:6, fontSize:12, color:'var(--muted)' }}>
                <span style={{ textTransform:'uppercase', letterSpacing:'.08em', fontSize:10, marginRight:6 }}>Shoot Location</span>
                {locations.map((l, i) => (
                  <span key={l.id}>
                    {i > 0 && <span style={{ margin:'0 6px', opacity:.4 }}>·</span>}
                    <span style={{ color:'var(--text)', fontWeight:500 }}>{l.name}</span>
                    {l.address && <span style={{ color:'var(--muted)', marginLeft:4 }}>— {l.address}</span>}
                  </span>
                ))}
              </div>
            )}
          </div>
          {filteredSchedule.length > 0 && (
            <button onClick={() => scheduleRef.current?.scrollIntoView({ behavior:'smooth' })} style={{ flexShrink:0, marginTop:4, padding:'6px 14px', fontSize:12, fontWeight:600, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', cursor:'pointer', whiteSpace:'nowrap' }}>
              Jump to Schedule ↓
            </button>
          )}
        </div>
      </div>

      {(() => {
        const talentRecord = (keyTalent || []).find(t => t.name === talent_name);
        const wardrobeNotes = talentRecord?.wardrobe_notes;
        const arrivalNotes = talentRecord?.arrival_notes;
        if (!project.poc_name && !wardrobeNotes && !arrivalNotes) return null;
        return (
          <section className="share-section">
            <div className="sec-lbl">Key Contacts</div>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {project.poc_name && (
                <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Main POC</div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{shortName(project.poc_name)}</div>
                  {project.poc_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}>{project.poc_phone}</div>}
                  {project.poc_email && <div style={{ fontSize:11, color:'var(--muted)' }}>{project.poc_email}</div>}
                </div>
              )}
              {wardrobeNotes && (
                <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Wardrobe Notes</div>
                  <div style={{ fontSize:13, color:'var(--text)', whiteSpace:'pre-wrap' }}>{wardrobeNotes}</div>
                </div>
              )}
              {arrivalNotes && (
                <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Arrival Notes</div>
                  <div style={{ fontSize:13, color:'var(--text)', whiteSpace:'pre-wrap' }}>{arrivalNotes}</div>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {(clientContacts?.length > 0 || productionCrew?.length > 0) && (
        <section className="share-section">
          <div style={{ display:'flex', gap:8, flexWrap:'nowrap', overflowX:'auto' }}>
            {(clientContacts || []).map(c => (
              <div key={c.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:'1 1 0', minWidth:0 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>Client</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{c.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{c.title}</div>
                {c.phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:3 }}>{c.phone}</div>}
                {c.email && <div style={{ fontSize:11, color:'var(--muted)' }}>{c.email}</div>}
              </div>
            ))}
            {(productionCrew || []).map(a => (
              <div key={a.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:'1 1 0', minWidth:0 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>{a.position.name}</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{a.crewMember ? shortName(displayName(a.crewMember)) || 'TBD' : 'TBD'}</div>
                {a.crewMember?.phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:3 }}>{a.crewMember.phone}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      <div ref={scheduleRef}>
        {filteredSchedule.length > 0 && (
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', margin:'24px 0 8px', letterSpacing:'-0.01em' }}>Schedule</div>
        )}
        {filteredSchedule.length === 0 && (
          <section className="share-section">
            <div style={{ fontSize:13, color:'var(--muted)', fontStyle:'italic' }}>No schedule items have been tagged for {talent_name} yet.</div>
          </section>
        )}
        {filteredSchedule.map((day, i) => (
          <DaySection key={day.id} day={day} showCalls={false} dayIndex={i} talentCallTime={day.talent_call_time} hideCallWrap />
        ))}
      </div>
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────
function ShareTable({ cols, rows, colClasses = [] }) {
  return (
    <table className="share-table">
      <thead>
        <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => <td key={j} className={colClasses[j] || ''}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

function timeToMins(str) {
  if (!str) return 9999;
  const ampm = /([0-9]{1,2}):([0-9]{2})\s*(AM|PM)/i.exec(str);
  if (ampm) {
    let h = parseInt(ampm[1], 10); const m = parseInt(ampm[2], 10); const pm = ampm[3].toUpperCase() === 'PM';
    if (pm && h !== 12) h += 12; if (!pm && h === 12) h = 0; return h * 60 + m;
  }
  const hm = /([0-9]{1,2}):([0-9]{2})/.exec(str);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  return 9999;
}

function isoDate(ts) { if (!ts) return null; return new Date(ts).toISOString().slice(0, 10); }

function extractTime(display) {
  if (!display) return null;
  const m = display.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  return m ? m[1] : null;
}
function flightTime(f, leg) {
  if (leg === 'depart') {
    const t = extractTime(f.depart_display);
    if (t) return t;
    return f.depart_time ? new Date(f.depart_time).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '';
  }
  const t = extractTime(f.arrive_display);
  if (t) return t;
  return f.arrive_time ? new Date(f.arrive_time).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '';
}

function DietaryCell({ value }) {
  const [show, setShow] = useState(false);
  if (!value || value === 'N/A') return <span>—</span>;
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <span style={{ cursor:'pointer', fontSize:14 }} onClick={() => setShow(s => !s)}>⚠️</span>
      {show && (
        <div style={{ position:'absolute', right:0, top:'100%', marginTop:4, zIndex:99, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', fontSize:11, color:'var(--text)', whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(0,0,0,0.3)', minWidth:120 }}>
          {value}
          <div style={{ marginTop:4, fontSize:10, color:'var(--muted)', cursor:'pointer' }} onClick={() => setShow(false)}>✕ close</div>
        </div>
      )}
    </div>
  );
}

function DaySection({ day, showCalls, flights, dayIndex, talentCallTime, hideCallWrap, tagFilter }) {
  const [open, setOpen] = useState(true);
  const now = useNow();

  const filteredDay = tagFilter
    ? { ...day, events: day.events.filter(e => (e.tags || []).some(t => t.type === tagFilter)) }
    : day;

  const dayStr = filteredDay.date ? isoDate(new Date(filteredDay.date)) : null;
  const dayMD = dayStr ? dayStr.slice(5) : null; // "MM-DD"
  const flightLegs = (flights || []).flatMap(f => {
    const legs = [];
    const departMD = f.depart_display ? displayMD(f.depart_display) : null;
    const arriveMD = f.arrive_display ? displayMD(f.arrive_display) : null;
    const departMatch =
      (departMD && dayMD && departMD === dayMD) ||
      (!departMD && f.depart_time && isoDate(new Date(f.depart_time)) === dayStr) ||
      (departMD && f.depart_time && isoDate(new Date(f.depart_time)) === dayStr);
    const arriveMatch =
      (arriveMD && dayMD && arriveMD === dayMD) ||
      (!arriveMD && f.arrive_time && isoDate(new Date(f.arrive_time)) === dayStr) ||
      (arriveMD && f.arrive_time && isoDate(new Date(f.arrive_time)) === dayStr);
    if (departMatch) legs.push({ ...f, _leg:'depart', _time: flightTime(f,'depart') });
    if (arriveMatch) legs.push({ ...f, _leg:'arrive', _time: flightTime(f,'arrive') });
    return legs;
  });

  const SYNTHETIC_META_SHARE = {
    ct:  { color:'#4a9eff', bg:'rgba(74,158,255,0.08)',   notesKey:'call_time_notes',      tagsKey:'call_time_tags' },
    sct: { color:'#ff8c00', bg:'rgba(255,140,0,0.10)',    notesKey:'shooting_call_notes',  tagsKey:'shooting_call_tags' },
    lt:  { color:'#4ade80', bg:'rgba(74,222,128,0.08)',   notesKey:'lunch_notes',          tagsKey:'lunch_tags' },
    wt:  { color:'#a78bfa', bg:'rgba(167,139,250,0.08)', notesKey:'wrap_time_notes',      tagsKey:'wrap_time_tags' },
  };
  const syntheticDayItems = tagFilter ? [] : [
    day.call_time          && { _type:'synthetic', _key:'ct',  _sort: timeToMins(day.call_time),           startTime: day.call_time,          title:'General Call Time', notes: day.call_time_notes,      tags: day.call_time_tags },
    day.shooting_call_time && { _type:'synthetic', _key:'sct', _sort: timeToMins(day.shooting_call_time),  startTime: day.shooting_call_time, title:'Shooting Call',     notes: day.shooting_call_notes,  tags: day.shooting_call_tags },
    day.lunch_time         && { _type:'synthetic', _key:'lt',  _sort: timeToMins(day.lunch_time),          startTime: day.lunch_time,         title:'Lunch',             notes: day.lunch_notes,          tags: day.lunch_tags },
    day.wrap_time          && { _type:'synthetic', _key:'wt',  _sort: timeToMins(day.wrap_time),           startTime: day.wrap_time,          title:'Est. Wrap',         notes: day.wrap_time_notes,      tags: day.wrap_time_tags },
  ].filter(Boolean);

  const allItems = [
    ...syntheticDayItems,
    ...filteredDay.events.map(e => ({ _type:'event', _sort: timeToMins(e.start_time), ...e })),
    ...(tagFilter ? [] : flightLegs.map(f => ({ _type:'flight', _sort: timeToMins(f._time), ...f }))),
  ].sort((a, b) => a._sort - b._sort);

  const hasWeather = day.weather_high != null || day.weather_condition;
  const weatherStr = hasWeather
    ? [
        day.weather_condition,
        day.weather_high != null && day.weather_low != null ? `${day.weather_high}°↑ ${day.weather_low}°↓` : null,
        day.weather_precip != null ? `${day.weather_precip}% precip` : null,
        day.weather_sunrise ? `☀ ${day.weather_sunrise}` : null,
        day.weather_sunset  ? `☽ ${day.weather_sunset}`  : null,
      ].filter(Boolean).join(' · ')
    : null;

  return (
    <section className="share-section">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <div className="sec-lbl" style={{ margin:0 }}>Day {dayIndex != null ? dayIndex + 1 : day.day_number} — {new Date(day.date.slice ? day.date.slice(0,10) + 'T12:00:00' : day.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
            {weatherStr || 'Weather coming soon'}
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
          {talentCallTime && (
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', lineHeight:1, marginBottom:2 }}>Call Time</div>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em', lineHeight:1 }}>{fmtTime(talentCallTime)}</div>
            </div>
          )}
          {allItems.length > 0 && (
            <button onClick={() => setOpen(o => !o)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:11, cursor:'pointer', padding:0 }}>
              {open ? 'Collapse' : `Show (${allItems.length})`}
            </button>
          )}
        </div>
      </div>

      {!hideCallWrap && (day.call_time || day.shooting_call_time || day.lunch_time || day.wrap_time) && (() => {
        const slots = [
          { label: 'Call Time',      value: day.call_time },
          { label: 'Shooting Call',  value: day.shooting_call_time },
          { label: 'Lunch',          value: day.lunch_time },
          { label: 'Est. Wrap',      value: day.wrap_time },
        ].filter(s => s.value);
        return (
          <div style={{ display:'inline-flex', marginTop:8, border:'1px solid var(--border2)', borderRadius:8, overflow:'hidden' }}>
            {slots.map((s, i) => (
              <div key={s.label} style={{ padding:'6px 14px', borderLeft: i > 0 ? '1px solid var(--border2)' : 'none', display:'flex', flexDirection:'column', gap:2 }}>
                <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600 }}>{s.label}</div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--tan)', fontVariantNumeric:'tabular-nums' }}>{fmtTime(s.value)}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {(day.crew_lunch || day.gear_storage || day.gs_audio) && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
          {[
            { label:'Crew Meal', value: day.crew_lunch },
            { label:'Gear Storage', value: day.gear_storage },
            { label:'Audio Contact', value: day.gs_audio },
          ].filter(f => f.value).map(f => (
            <div key={f.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'5px 10px', fontSize:11 }}>
              <span style={{ color:'var(--muted)', marginRight:5 }}>{f.label}:</span>
              <span style={{ color:'var(--text)', fontWeight:500 }}>{f.value}</span>
            </div>
          ))}
        </div>
      )}

      {showCalls && day.crewCalls?.length > 0 && (
        <div style={{ marginTop:8 }}>
          <ShareTable
            cols={['Position','Name','Call','Wrap']}
            rows={day.crewCalls.map(c => [c.crewAssignment.position.name, c.crewAssignment.crewMember ? displayName(c.crewAssignment.crewMember)||'TBD' : 'TBD', c.call_time ? fmtTime(c.call_time) : '—', c.wrap_time ? fmtTime(c.wrap_time) : '—'])}
          />
        </div>
      )}

      {allItems.length === 0 && (
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:6, fontStyle:'italic' }}>No events added for this day.</div>
      )}

      {allItems.length > 0 && open && (
        <div className="tl" style={{ marginTop:8 }}>
              {allItems.map((item, i) => item._type === 'synthetic' ? (() => {
                const sm = SYNTHETIC_META_SHARE[item._key];
                const itemTags = Array.isArray(item.tags) ? item.tags : [];
                return (
                  <div key={item._key} className="ev">
                    <div className="ev-time" style={{ color: sm.color }}>{fmtTime(item.startTime)}</div>
                    <div className="ev-body" style={{ borderLeft:`2px solid ${sm.color}`, background: sm.bg }}>
                      <div className="ev-title" style={{ color: sm.color }}>{item.title}</div>
                      {item.notes && <div className="ev-detail">{item.notes}</div>}
                      {itemTags.length > 0 && (
                        <div className="ev-tags" style={{ marginTop:4 }}>
                          {itemTags.map(t => <span key={t} className={`etag ${t === 'VIDEO' ? 'etag-video' : 'etag-photo'}`}>{t === 'VIDEO' ? '🎬 Video' : '📷 Photo'}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : item._type === 'flight' ? (
                <div key={`f-${item.id}-${item._leg}`} className="ev">
                  <div className="ev-time">✈ {item._time}</div>
                  <div className="ev-body" style={{ borderLeft:'2px solid var(--orange)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                      <div className="ev-title">{item._leg === 'depart' ? 'Departure' : 'Arrival'} — {item.crew_name || item.passenger_name}</div>
                      {item._leg === 'depart' && (() => { const s = flightStatus(item, now); return s ? (
                        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, background:'rgba(0,0,0,0.25)', borderRadius:20, padding:'3px 10px' }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background: s.dot || 'transparent', border: s.dot ? 'none' : '1.5px solid var(--orange)', flexShrink:0 }} />
                          <span style={{ fontSize: s.dot ? 10 : 9, fontWeight: s.dot ? 600 : 400, color:s.color, textTransform:'uppercase', letterSpacing: s.dot ? '0.06em' : '0.03em', fontStyle: s.dot ? 'normal' : 'italic' }}>{s.label}</span>
                        </div>
                      ) : null; })()}
                    </div>
                    <div className="ev-detail">
                      {item.origin} → {item.destination}
                      {(item.airline || item.flight_number) && <span style={{ color:'var(--muted)', marginLeft:8 }}>{[item.airline, item.flight_number].filter(Boolean).join(' ')}</span>}
                      {item.confirmation && <span style={{ color:'var(--muted)', marginLeft:8 }}>#{item.confirmation}</span>}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={item.id || i} className="ev">
                  <div className="ev-time">{fmtTime(item.start_time)}{item.end_time ? ` – ${fmtTime(item.end_time)}` : ''}</div>
                  <div className={`ev-body${item.is_alert ? ' warn' : ''}`} style={!item.is_alert ? { borderLeft:'2px solid var(--orange)', ...(item.is_filming ? { background:'linear-gradient(90deg, rgba(255,140,0,0.12) 0%, transparent 100%)', borderRadius:'0 6px 6px 0' } : {}) } : {}}>
                    <div className={`ev-title${item.is_alert ? ' alert' : ''}`} style={item.is_filming ? { color:'var(--orange)' } : {}}>{item.is_filming ? '🎬 ' : ''}{item.title}</div>
                    {item.detail && <div className="ev-detail">{item.detail}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
    </section>
  );
}

// ── Main Share Page ──────────────────────────────────────────────────────────
export default function Share() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const isPdf = searchParams.get('pdf') === '1';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPublicShare(token).then(d => {
      if (d.error) setError(d.error);
      else setData(d);
    }).catch(() => setError('Failed to load share'));
  }, [token]);

  useEffect(() => {
    if (isPdf && data) {
      setTimeout(() => window.print(), 400);
    }
  }, [isPdf, data]);

  if (error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#7A7565' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>404</div>
        <div>{error}</div>
      </div>
    </div>
  );

  if (!data) return null;

  const { view_type } = data;

  return (
    <>
      <nav className="nav" style={{ justifyContent:'space-between' }}>
        <div className="logo">Free<em>Pro</em></div>
        <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>
          {view_type === 'talent' ? `${data.talent_name} — Talent` : `${view_type.charAt(0).toUpperCase() + view_type.slice(1)} View`}
        </div>
        <button
          onClick={() => window.print()}
          style={{ background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--tan)', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}
        >Download PDF</button>
      </nav>
      <div className="wrap">
        {view_type === 'producer' && <ProducerView data={data} />}
        {view_type === 'crew'     && <CrewView     data={data} shareToken={token} />}
        {view_type === 'client'   && <ClientView   data={data} />}
        {view_type === 'talent'   && <TalentView   data={data} />}
      </div>
    </>
  );
}
