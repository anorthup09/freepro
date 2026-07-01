import React, { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { displayName } from '../utils/displayName.js';

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

function GearSection({ gear, producerView }) {
  if (!gear) return null;
  const hasRental = gear.rental_company || gear.rental_contact || gear.rental_phone || gear.rental_email;
  const gearList = [
    { label: 'Camera', value: gear.camera_gear },
    { label: 'Grip', value: gear.grip_gear },
    { label: 'Electric', value: gear.electric_gear },
    { label: 'Audio', value: gear.audio_gear },
    { label: 'Media Management', value: gear.media_management_gear },
    { label: 'Editing', value: gear.editing_gear },
  ].filter(g => g.value);
  const hasDelivery = gear.delivery_datetime || gear.pickup_datetime || gear.delivery_driver;
  const docs = [
    { label: 'Internal Request', done: gear.internal_request_submitted },
    { label: 'COI', done: gear.coi_received },
    { label: 'Rental Agreement', done: gear.rental_agreement_received },
    { label: 'CC Auth', done: gear.cc_auth_received },
  ];
  const hasDocInfo = producerView && docs.some(d => d.done != null);

  if (!gear.storage_location && !hasRental && !gearList.length && !hasDelivery && !hasDocInfo) return null;

  return (
    <section className="share-section">
      <div className="sec-lbl">Gear</div>

      {gear.storage_location && (
        <div style={{ marginBottom:10 }}>
          <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Storage Location</span>
          <div style={{ fontSize:13, color:'var(--text)', marginTop:3 }}>{gear.storage_location}</div>
        </div>
      )}

      {hasRental && (
        <div style={{ marginBottom:10 }}>
          <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Rental House</span>
          <div style={{ fontSize:13, color:'var(--text)', marginTop:3, fontWeight:500 }}>{gear.rental_company || '—'}</div>
          {(gear.rental_contact || gear.rental_phone || gear.rental_email) && (
            <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}>
              {[gear.rental_contact, gear.rental_phone, gear.rental_email].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}

      {gearList.length > 0 && (
        <div style={{ marginBottom:10 }}>
          <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Gear List</span>
          <div style={{ marginTop:4 }}>
            {gearList.map(g => (
              <div key={g.label} style={{ display:'flex', gap:8, fontSize:12, marginBottom:3 }}>
                <span style={{ color:'var(--muted)', minWidth:120 }}>{g.label}</span>
                <span style={{ color:'var(--text)' }}>{g.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {producerView && hasDelivery && (
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

// ── Producer View ────────────────────────────────────────────────────────────
function ProducerView({ data }) {
  const { project, locations, techSpecs, clientContacts, keyTalent, crewAssignments, schedule, flights, hotelBlocks, rentalCars, deliverables, gear } = data;
  const scheduleRef = useRef(null);
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
          <ShareTable
            cols={['Passenger','Route','Departure','Arrival','Flight','Confirmation']}
            rows={flights.map(f => [
              f.crew_name || f.passenger_name || '—',
              `${f.origin} → ${f.destination}`,
              f.depart_display || fmtDT(f.depart_time),
              f.arrive_display || fmtDT(f.arrive_time),
              [f.airline, f.flight_number].filter(Boolean).join(' ') || '—',
              f.confirmation || '—',
            ])}
          />
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
          <ShareTable cols={['Name','Title','Email','Phone']} rows={clientContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}

      {keyTalent?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Key Talent</div>
          <ShareTable cols={['Name','Role','Notes']} rows={keyTalent.map(t => [t.name, t.role, t.notes||''])} />
        </section>
      )}

      {crewAssignments?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Crew</div>
          <ShareTable cols={['Position','Name','Email','Phone']} rows={crewAssignments.map(a => [a.position.name, a.crewMember ? displayName(a.crewMember)||'TBD' : 'TBD', a.crewMember?.email||'—', a.crewMember?.phone||'—'])} />
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

      <GearSection gear={gear} producerView />

      {/* ── Post-Production ── */}
      {deliverables?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Post-Production — Deliverables</div>
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
        {[...(schedule||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((day, i) => (
          <DaySection key={day.id} day={day} showCalls flights={flights} dayIndex={i} />
        ))}
      </div>
    </div>
  );
}

// ── Crew View ────────────────────────────────────────────────────────────────
function CrewView({ data }) {
  const { project, locations, techSpecs, clientContacts, keyTalent, crewAssignments, schedule, flights, hotelBlocks, rentalCars, deliverables, gear } = data;
  const sortedSchedule = [...(schedule || [])].sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const scheduleRef = useRef(null);
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
          <ShareTable cols={['Name','Title','Email','Phone']} rows={clientContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}

      {keyTalent?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Key Talent</div>
          <ShareTable cols={['Name','Role','Notes']} rows={keyTalent.map(t => [t.name, t.role, t.notes||''])} />
        </section>
      )}

      {crewAssignments?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Crew</div>
          <ShareTable cols={['Position','Name','Email','Phone']} rows={crewAssignments.map(a => [a.position.name, a.crewMember ? shortName(displayName(a.crewMember))||'TBD' : 'TBD', a.crewMember?.email||'—', a.crewMember?.phone||'—'])} />
        </section>
      )}

      {flights?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Flights</div>
          <ShareTable
            cols={['Passenger','Route','Departure','Arrival','Flight','Confirmation']}
            rows={flights.map(f => [
              f.crew_name || f.passenger_name || '—',
              `${f.origin} → ${f.destination}`,
              f.depart_display || fmtDT(f.depart_time),
              f.arrive_display || fmtDT(f.arrive_time),
              [f.airline, f.flight_number].filter(Boolean).join(' ') || '—',
              f.confirmation || '—',
            ])}
          />
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

      <GearSection gear={gear} />

      {deliverables?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Post-Production — Deliverables</div>
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
        {sortedSchedule.map((day, i) => (
          <DaySection key={day.id} day={day} showCalls flights={flights} dayIndex={i} />
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
          <ShareTable cols={['Name','Title','Email','Phone']} rows={clientContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
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

// ── Talent Call Sheet ────────────────────────────────────────────────────────
function TalentView({ data }) {
  const { project, talent_name, locations, techSpecs, clientContacts, keyTalent, productionCrew, schedule } = data;

  return (
    <div className="callsheet">
      {schedule.map((day, i) => (
        <div key={day.id} className="callsheet-day">
          {/* Header */}
          <div className="cs-header">
            <div className="cs-header-main">
              <span className="cs-day-label">SHOOT DAY {day.day_number} OF {day.totalDays}</span>
              <span className="cs-project-name">{project.title}</span>
            </div>
            <div className="cs-header-times">
              {day.call_time && <span><strong>Call:</strong> {fmtTime(day.call_time)}</span>}
              {day.wrap_time && <span><strong>Wrap:</strong> {fmtTime(day.wrap_time)}</span>}
              {day.weather && <span className="cs-weather">{day.weather}</span>}
            </div>
          </div>

          {/* Tech specs line */}
          {techSpecs && (
            <div className="cs-specs-line">
              {[techSpecs.aspect_ratio, techSpecs.resolution, techSpecs.cameras].filter(Boolean).join(' · ')}
            </div>
          )}

          {/* Location Table */}
          {locations.length > 0 && (
            <div className="cs-table-block">
              <div className="cs-table-header">LOCATION INFO</div>
              <table className="cs-table">
                <thead>
                  <tr><th>Location</th><th>Address</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {locations.map(l => (
                    <tr key={l.id}><td>{l.name}</td><td>{l.address}</td><td>{l.notes||''}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Talent table — this talent's call */}
          {keyTalent.length > 0 && (
            <div className="cs-table-block">
              <div className="cs-table-header">TALENT</div>
              <table className="cs-table">
                <thead>
                  <tr><th>Name</th><th>Role</th><th>Call</th></tr>
                </thead>
                <tbody>
                  {keyTalent.map(t => {
                    const callEntry = day.crewCalls.find(c => c.crewAssignment?.crewMember?.name === t.name);
                    return (
                      <tr key={t.id}><td>{t.name}</td><td>{t.role}</td><td>{fmtTime(callEntry?.call_time || day.call_time) || '—'}</td></tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Client Table */}
          {clientContacts.length > 0 && (
            <div className="cs-table-block">
              <div className="cs-table-header">CLIENT</div>
              <table className="cs-table">
                <thead>
                  <tr><th>Title</th><th>Name</th><th>Phone</th><th>Email</th></tr>
                </thead>
                <tbody>
                  {clientContacts.map(c => (
                    <tr key={c.id}><td>{c.title}</td><td>{c.name}</td><td>{c.phone||'—'}</td><td>{c.email||'—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Production contacts */}
          {productionCrew?.length > 0 && (
            <div className="cs-table-block">
              <div className="cs-table-header">PRODUCTION</div>
              <table className="cs-table">
                <thead>
                  <tr><th>Title</th><th>Name</th><th>Phone</th><th>Call</th></tr>
                </thead>
                <tbody>
                  {productionCrew.map(a => {
                    const call = day.crewCalls.find(c => c.crew_assignment_id === a.id);
                    return (
                      <tr key={a.id}>
                        <td>{a.position.name}</td>
                        <td>{a.crewMember ? displayName(a.crewMember) : 'TBD'}</td>
                        <td>{a.crewMember?.phone || '—'}</td>
                        <td>{call?.call_time ? fmtTime(call.call_time) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Schedule table */}
          {day.events.length > 0 && (
            <div className="cs-table-block">
              <div className="cs-table-header">SCHEDULE</div>
              <table className="cs-table">
                <thead>
                  <tr><th>Time</th><th>Event</th><th>Notes</th></tr>
                </thead>
                <tbody>
                  {day.events.map(e => (
                    <tr key={e.id}><td>{fmtTime(e.start_time)}{e.end_time ? ` – ${fmtTime(e.end_time)}` : ''}</td><td>{e.title}</td><td>{e.detail||''}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────
function ShareTable({ cols, rows }) {
  return (
    <table className="share-table">
      <thead>
        <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
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

function flightTime(f, leg) {
  if (leg === 'depart') return f.depart_display || (f.depart_time ? new Date(f.depart_time).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '');
  return f.arrive_display || (f.arrive_time ? new Date(f.arrive_time).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' }) : '');
}

function DaySection({ day, showCalls, flights, dayIndex }) {
  const [open, setOpen] = useState(true);

  const dayStr = day.date ? isoDate(new Date(day.date)) : null;
  const dayMD = dayStr ? dayStr.slice(5) : null; // "MM-DD"
  const flightLegs = (flights || []).flatMap(f => {
    const legs = [];
    const departMatch = f.depart_display
      ? (dayMD && displayMD(f.depart_display) === dayMD)
      : (f.depart_time && isoDate(new Date(f.depart_time)) === dayStr);
    const arriveMatch = f.arrive_display
      ? (dayMD && displayMD(f.arrive_display) === dayMD)
      : (f.arrive_time && isoDate(new Date(f.arrive_time)) === dayStr);
    if (departMatch) legs.push({ ...f, _leg:'depart', _time: flightTime(f,'depart') });
    if (arriveMatch) legs.push({ ...f, _leg:'arrive', _time: flightTime(f,'arrive') });
    return legs;
  });

  const allItems = [
    ...day.events.map(e => ({ _type:'event', _sort: timeToMins(e.start_time), ...e })),
    ...flightLegs.map(f => ({ _type:'flight', _sort: timeToMins(f._time), ...f })),
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
        {allItems.length > 0 && (
          <button onClick={() => setOpen(o => !o)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:11, cursor:'pointer', padding:0 }}>
            {open ? 'Collapse' : `Show (${allItems.length})`}
          </button>
        )}
      </div>

      {(day.call_time || day.wrap_time) && (
        <div style={{ fontSize:11, color:'var(--tan)', marginTop:4 }}>
          {day.call_time && <span>Call: <strong>{fmtTime(day.call_time)}</strong></span>}
          {day.call_time && day.wrap_time && <span style={{ margin:'0 8px', color:'var(--muted)' }}>·</span>}
          {day.wrap_time && <span>Wrap: <strong>{fmtTime(day.wrap_time)}</strong></span>}
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
              {allItems.map((item, i) => item._type === 'flight' ? (
                <div key={`f-${item.id}-${item._leg}`} className="ev">
                  <div className="ev-time">✈ {item._time}</div>
                  <div className="ev-body" style={{ borderLeft:'2px solid var(--orange)' }}>
                    <div className="ev-title">{item._leg === 'depart' ? 'Departure' : 'Arrival'} — {item.crew_name || item.passenger_name}</div>
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
                  <div className={`ev-body${item.is_alert ? ' warn' : ''}`} style={!item.is_alert ? { borderLeft:'2px solid var(--orange)' } : {}}>
                    <div className={`ev-title${item.is_alert ? ' alert' : ''}`}>{item.title}</div>
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
        {view_type === 'crew'     && <CrewView     data={data} />}
        {view_type === 'client'   && <ClientView   data={data} />}
        {view_type === 'talent'   && <TalentView   data={data} />}
      </div>
    </>
  );
}
