import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { displayName } from '../utils/displayName.js';
import ShineBorder from '../components/ShineBorder.jsx';
import Clapboard from '../components/Clapboard.jsx';

const isMobileNow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}


// Tap-to-contact links: phones dial, emails open the mail app
const Tel = ({ v }) => v ? <a href={`tel:${String(v).replace(/[^+\d]/g, '')}`} style={{ color:'inherit', textDecoration:'none' }}>{v}</a> : null;
const Mail = ({ v }) => v ? <a href={`mailto:${v}`} style={{ color:'inherit', textDecoration:'none' }}>{v}</a> : null;

function flightStatus(f, now) {
  // Live status from the flight API (refreshed server-side) wins over time math
  const st = (f.status || '').toUpperCase().replace(/[\s_-]/g, '');
  const delayed = st === 'DELAYED';
  if (st.includes('CANCEL')) return { label: 'Cancelled', color: '#ef4444', dot: '#ef4444', cancelled: true };
  if (st === 'DIVERTED') return { label: 'Diverted', color: '#ef4444', dot: '#ef4444', delayed };
  if (st === 'DELAYED') return { label: 'Delayed', color: '#f59e0b', dot: '#f59e0b', delayed };
  if (st === 'ENROUTE' || st === 'DEPARTED' || st === 'APPROACHING') return { label: 'In-Flight', color: '#60a5fa', dot: '#60a5fa', delayed };
  if (st === 'ARRIVED' || st === 'LANDED') return { label: 'Arrived', color: '#22c55e', dot: '#22c55e', delayed };
  if (st === 'BOARDING' || st === 'GATECLOSED') return { label: 'Boarding', color: '#60a5fa', dot: '#60a5fa', delayed };
  if (st === 'CHECKIN' || st === 'EXPECTED' || st === 'SCHEDULED' || st === 'ONTIME') return { label: 'Pre-Flight', color: '#a78bfa', dot: '#a78bfa', delayed };
  // No usable live status — fall back to scheduled-time math
  const depart = f.depart_time ? new Date(f.depart_time) : null;
  const arrive = f.arrive_time ? new Date(f.arrive_time) : null;
  if (!depart || isNaN(depart)) return { label: 'Status Coming Soon', color: 'var(--muted)', dot: null, delayed };
  const todayStr = now.toISOString().slice(0, 10);
  const departStr = depart.toISOString().slice(0, 10);
  if (todayStr < departStr) return { label: 'Status Coming Soon', color: 'var(--muted)', dot: null, delayed };
  if (now < depart) return { label: 'Pre-Flight', color: '#a78bfa', dot: '#a78bfa', delayed };
  if (arrive && !isNaN(arrive) && now < arrive) return { label: 'In-Flight', color: '#60a5fa', dot: '#60a5fa', delayed };
  return { label: 'Arrived', color: '#22c55e', dot: '#22c55e', delayed };
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

const LOCATION_TYPE_LABEL = {
  PRIMARY_VENUE: 'Shoot Location',
  CREW_HOTEL:    'Crew Hotel',
  SECONDARY:     'Secondary Location',
  AIRPORT:       'Airport',
  OTHER:         'Location',
};

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function directionsUrl(from, to) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`;
}

// Module-level caches so geocode/drive-time results persist across re-renders
const _geoCache = new Map();
const _driveCache = new Map();

async function _geocode(address) {
  if (_geoCache.has(address)) return _geoCache.get(address);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, { headers: { 'Accept-Language': 'en' } });
    const d = await r.json();
    const result = d[0] ? { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) } : null;
    _geoCache.set(address, result);
    return result;
  } catch { _geoCache.set(address, null); return null; }
}

async function _driveTime(fromAddr, toAddr) {
  const key = `${fromAddr}||${toAddr}`;
  if (_driveCache.has(key)) return _driveCache.get(key);
  const [c1, c2] = await Promise.all([_geocode(fromAddr), _geocode(toAddr)]);
  if (!c1 || !c2) { _driveCache.set(key, null); return null; }
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=false`);
    const d = await r.json();
    const secs = d.routes?.[0]?.duration;
    if (!secs) { _driveCache.set(key, null); return null; }
    const mins = Math.round(secs / 60);
    const label = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    _driveCache.set(key, label);
    return label;
  } catch { _driveCache.set(key, null); return null; }
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
      const BACKEND = import.meta.env.VITE_API_URL
        || (window.location.hostname === 'localhost' ? 'https://freepro-production.up.railway.app' : '');
      await fetch(`${BACKEND}/api/share/${shareToken}/gear`, {
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
                    {gear.rental_phone && <div><Tel v={gear.rental_phone} /></div>}
                    {gear.rental_email && <div><Mail v={gear.rental_email} /></div>}
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
                Driver: {gear.delivery_driver}{gear.delivery_driver_phone && <> · <Tel v={gear.delivery_driver_phone} /></>}
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

  const allRows = [
    ...crew.map(a => {
      const bookings = bookingMap[a.crewMember.id] || [];
      return { key: a.id, name: displayName(a.crewMember), sub: a.position.name, bookings };
    }),
    ...unlinkedGuests.map((b, i) => ({
      key: `unlinked-${i}`, name: b.guest.guest_name, sub: hotelBlocks.length > 1 ? b.hotel.name : null,
      bookings: [{ guest: b.guest, hotel: b.hotel }],
    })),
  ];

  return (
    <div>
      {(hotelBlocks || []).map(hb => (
        <div key={hb.id} style={{ fontSize:12, color:'var(--tan)', marginBottom:6 }}>
          🏨 <span style={{ fontWeight:600, color:'var(--text)' }}>{hb.name}</span>
          {hb.address && <> · <a href={mapsUrl(hb.address)} target="_blank" rel="noreferrer" style={{ color:'var(--tan)', textDecoration:'underline' }}>{hb.address}</a></>}
          {hb.phone && <> · <Tel v={hb.phone} /></>}
        </div>
      ))}

      <div style={{ marginTop:10, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
        {allRows.map((row, ri) => {
          const hasBooking = row.bookings.length > 0;
          const confirmed = row.bookings.some(b => b.guest.confirmation);
          return (
            <div key={row.key} style={{
              display:'flex', alignItems:'center', gap:12, padding:'8px 12px',
              borderBottom: ri < allRows.length - 1 ? '1px solid var(--border)' : 'none',
              flexWrap:'wrap', opacity: !hasBooking ? 0.45 : 1,
            }}>
              {/* Status dot */}
              <div style={{ fontSize:13, lineHeight:1, color: confirmed ? 'var(--green,#4ade80)' : 'var(--muted)', flexShrink:0 }}>
                {confirmed ? '✓' : hasBooking ? '○' : '—'}
              </div>
              {/* Name + position */}
              <div style={{ minWidth:140, flexShrink:0 }}>
                <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{row.name}</span>
                {row.sub && <span style={{ fontSize:11, color:'var(--muted)', marginLeft:6 }}>{row.sub}</span>}
              </div>
              {/* Bookings inline */}
              <div style={{ flex:1, display:'flex', gap:16, flexWrap:'wrap' }}>
                {row.bookings.length === 0 && (
                  <span style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No booking</span>
                )}
                {row.bookings.map((b, i) => (
                  <span key={i} style={{ fontSize:11, color:'var(--tan)', whiteSpace:'nowrap', display:'flex', gap:6, alignItems:'center' }}>
                    {row.bookings.length > 1 && <span style={{ color:'var(--muted)' }}>{b.hotel.name} · </span>}
                    {fmtDT(b.guest.check_in)} → {fmtDT(b.guest.check_out)}
                    {b.guest.confirmation
                      ? <span style={{ color:'var(--text)', fontWeight:600 }}>#{b.guest.confirmation}</span>
                      : <span style={{ color:'var(--muted)', fontStyle:'italic' }}>No confirmation</span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
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

function FlightStatusPill({ s }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:3 }}>
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        <div style={{ width:7, height:7, borderRadius:'50%', background: s.dot || 'rgba(255,255,255,0.2)', flexShrink:0 }} />
        <span style={{ fontSize:11, fontWeight:600, color: s.color, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.label}</span>
      </div>
      {s.delayed && <span style={{ fontSize:10, fontWeight:600, color:'#f59e0b' }}>(!) Delayed</span>}
    </div>
  );
}

function FlightStatusCell({ f }) {
  const now = useNow();
  const s = flightStatus(f, now);
  return <FlightStatusPill s={s} />;
}

function FlightsTable({ flights }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table className="share-table">
        <thead>
          <tr>
            <th>Passenger</th>
            <th>Route</th>
            <th>Departure</th>
            <th>Arrival</th>
            <th className="hide-mobile">Flight</th>
            <th className="hide-mobile">Confirmation</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {flights.map((f, i) => (
            <tr key={i}>
              <td>{f.crew_name || f.passenger_name || '—'}</td>
              <td>{f.origin} → {f.destination}</td>
              <td className="nowrap">{f.depart_display || fmtDT(f.depart_time)}</td>
              <td className="nowrap">{f.arrive_display || fmtDT(f.arrive_time)}</td>
              <td className="nowrap hide-mobile">{[f.airline, f.flight_number].filter(Boolean).join(' ') || '—'}</td>
              <td className="hide-mobile">{f.confirmation || '—'}</td>
              <td><FlightStatusCell f={f} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Producer View ────────────────────────────────────────────────────────────
function ProducerView({ data, hideGear, onOpenShotList }) {
  const { project, locations, techSpecs, clientContacts, agencyContacts = [], keyTalent, crewAssignments, schedule, flights, hotelBlocks, rentalCars, deliverables, gear, onlineRentals = [], shotList = [], slDays = [], slBreaks = [] } = data;
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
                {project.poc_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}><Tel v={project.poc_phone} /></div>}
                {project.poc_email && <div style={{ fontSize:11, color:'var(--muted)' }}><Mail v={project.poc_email} /></div>}
              </div>
            )}
            {gear?.gear_person_name && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Gear Contact</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{shortName(gear.gear_person_name)}</div>
                {gear.gear_person_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}><Tel v={gear.gear_person_phone} /></div>}
              </div>
            )}
          </div>
        </section>
      )}

      {(() => {
        const dayLogistics = (schedule||[]).filter(d => d.crew_lunch || d.gear_storage || d.gs_audio);
        if (!dayLogistics.length) return null;
        const hasAudio = dayLogistics.some(d => d.gs_audio);
        return (
          <section className="share-section">
            <div className="sec-lbl">Daily Logistics</div>
            <ShareTable
              cols={hasAudio ? ['Day', 'Crew Meal Location', 'Gear Storage', 'Audio Contact'] : ['Day', 'Crew Meal Location', 'Gear Storage']}
              rows={dayLogistics.map(d => hasAudio
                ? [`Day ${d.day_number}`, d.crew_lunch || '—', d.gear_storage || '—', d.gs_audio || '—']
                : [`Day ${d.day_number}`, d.crew_lunch || '—', d.gear_storage || '—']
              )}
            />
          </section>
        );
      })()}

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

      {rentalCars?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Rental Cars</div>
          <ShareTable
            cols={['Vendor','Pick-up','Drop-off','Pick-up Date','Drop-off Date','Confirmation']}
            rows={rentalCars.map(r => [r.vendor, r.pickup_location||'—', r.dropoff_location||'—', fmtDT(r.pickup_date), fmtDT(r.dropoff_date), r.confirmation||'—'])}
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
                  <div className="loc-name">
                    {l.type && <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600 }}>{LOCATION_TYPE_LABEL[l.type] || l.type} — </span>}
                    {l.name}
                  </div>
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
          <ShareTable cols={['Name','Title','Phone','Email']} colClasses={['','','nowrap','']} rows={clientContacts.map(c => [c.name, c.title, (c.phone ? <Tel v={c.phone} /> : '—'), (c.email ? <Mail v={c.email} /> : '—')])} />
        </section>
      )}

      {agencyContacts?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Agency Contacts</div>
          <ShareTable cols={['Name','Title','Phone','Email']} colClasses={['','','nowrap','']} rows={agencyContacts.map(c => [c.name, c.title, (c.phone ? <Tel v={c.phone} /> : '—'), (c.email ? <Mail v={c.email} /> : '—')])} />
        </section>
      )}

      {keyTalent?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Talent</div>
          <ShareTable cols={['Name','Role','Phone','Email','Dietary']} colClasses={['','','nowrap','','']} rows={keyTalent.map(t => [t.name, t.role||'—', (t.phone ? <Tel v={t.phone} /> : '—'), (t.email ? <Mail v={t.email} /> : '—'), t.dietary_restrictions && t.dietary_restrictions !== 'N/A' ? `⚠️ ${t.dietary_restrictions}` : '—'])} />
        </section>
      )}

      {crewAssignments?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Crew</div>
          <ShareTable cols={['Name','Position','Phone','Email','Dietary']} colClasses={['','','nowrap','','']} rows={crewAssignments.map(a => [a.crewMember ? displayName(a.crewMember)||'TBD' : 'TBD', a.position.name, (a.crewMember?.phone ? <Tel v={a.crewMember.phone} /> : '—'), (a.crewMember?.email ? <Mail v={a.crewMember.email} /> : '—'), <DietaryCell key={a.id} value={a.crewMember?.dietaryRestrictions} />])} />
        </section>
      )}

      {!hideGear && <GearSection gear={gear} onlineRentals={onlineRentals} producerView />}

      {/* ── Post-Production ── */}
      {deliverables?.length > 0 && (
        <section className="share-section">
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:12, letterSpacing:'-0.01em' }}>Post-Production — Deliverables</div>
          {gear?.gear_person_name && (
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>
              DIT: <span style={{ color:'var(--text)', fontWeight:500 }}>{gear.gear_person_name}</span>
              {gear.gear_person_phone && <span style={{ marginLeft:8 }}><Tel v={gear.gear_person_phone} /></span>}
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
                style={{ fontSize:11, fontWeight:700, padding:'5px 16px', borderRadius:100, border: tagFilter === tag ? 'none' : '1px solid rgba(255,255,255,0.12)', background: tagFilter === tag ? 'var(--orange)' : 'rgba(255,255,255,0.06)', color: tagFilter === tag ? '#fff' : 'rgba(255,255,255,0.5)', cursor:'pointer', letterSpacing:'.06em', transition:'all 0.15s' }}>
                {tag}
              </button>
            ))}
          </div>
        )}
        {[...(schedule||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).filter(day => {
          if (!tagFilter) return true;
          if (day.events.some(e => (e.tags || []).some(t => t.type === tagFilter || t.type === 'ALL_CREW'))) return true;
          return [day.call_time_tags, day.shooting_call_tags, day.lunch_tags, day.wrap_time_tags]
            .some(tags => Array.isArray(tags) && (tags.includes(tagFilter) || tags.includes('ALL_CREW')));
        }).map((day, i) => (
          <DaySection key={day.id} day={day} showCalls flights={flights} dayIndex={i} tagFilter={tagFilter} cateringDetail="full" shotList={shotList} slDays={slDays} slBreaks={slBreaks} onOpenShotList={onOpenShotList} crewAssignments={crewAssignments} projectCity={[project.city, project.state].filter(Boolean).join(', ')} />
        ))}
      </div>
    </div>
  );
}

// ── Crew View ────────────────────────────────────────────────────────────────
function CrewView({ data, shareToken, hideGear, onOpenShotList }) {
  const { project, locations, techSpecs, clientContacts, agencyContacts = [], keyTalent, crewAssignments, schedule, flights, hotelBlocks, rentalCars, deliverables, gear, onlineRentals = [], shotList = [], slDays = [], slBreaks = [] } = data;
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
                {project.poc_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}><Tel v={project.poc_phone} /></div>}
                {project.poc_email && <div style={{ fontSize:11, color:'var(--muted)' }}><Mail v={project.poc_email} /></div>}
              </div>
            )}
            {gear?.gear_person_name && (
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:1, minWidth:180 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Gear Contact</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{shortName(gear.gear_person_name)}</div>
                {gear.gear_person_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}><Tel v={gear.gear_person_phone} /></div>}
              </div>
            )}
          </div>
        </section>
      )}

      {(() => {
        const dayLogistics = (sortedSchedule||[]).filter(d => d.crew_lunch || d.gear_storage || d.gs_audio);
        if (!dayLogistics.length) return null;
        const hasAudio = dayLogistics.some(d => d.gs_audio);
        return (
          <section className="share-section">
            <div className="sec-lbl">Daily Logistics</div>
            <ShareTable
              cols={hasAudio ? ['Day', 'Crew Meal Location', 'Gear Storage', 'Audio Contact'] : ['Day', 'Crew Meal Location', 'Gear Storage']}
              rows={dayLogistics.map(d => hasAudio
                ? [`Day ${d.day_number}`, d.crew_lunch || '—', d.gear_storage || '—', d.gs_audio || '—']
                : [`Day ${d.day_number}`, d.crew_lunch || '—', d.gear_storage || '—']
              )}
            />
          </section>
        );
      })()}


      {hotelBlocks?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Hotel Accommodations</div>
          <HotelRoster hotelBlocks={hotelBlocks} crewAssignments={crewAssignments} />
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

      {locations?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Locations</div>
          <div className="loc-grid">
            {locations.map(l => (
              <div key={l.id} className="loc">
                <div className="loc-ico">{l.emoji || '📍'}</div>
                <div>
                  <div className="loc-name">
                    {l.type && <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600 }}>{LOCATION_TYPE_LABEL[l.type] || l.type} — </span>}
                    {l.name}
                  </div>
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
          <ShareTable cols={['Name','Title','Phone','Email']} colClasses={['','','nowrap','']} rows={clientContacts.map(c => [c.name, c.title, (c.phone ? <Tel v={c.phone} /> : '—'), (c.email ? <Mail v={c.email} /> : '—')])} />
        </section>
      )}

      {agencyContacts?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Agency Contacts</div>
          <ShareTable cols={['Name','Title','Phone','Email']} colClasses={['','','nowrap','']} rows={agencyContacts.map(c => [c.name, c.title, (c.phone ? <Tel v={c.phone} /> : '—'), (c.email ? <Mail v={c.email} /> : '—')])} />
        </section>
      )}

      {keyTalent?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Talent</div>
          <ShareTable cols={['Name','Role','Phone','Email','Dietary']} colClasses={['','','nowrap','','']} rows={keyTalent.map(t => [t.name, t.role||'—', (t.phone ? <Tel v={t.phone} /> : '—'), (t.email ? <Mail v={t.email} /> : '—'), t.dietary_restrictions && t.dietary_restrictions !== 'N/A' ? `⚠️ ${t.dietary_restrictions}` : '—'])} />
        </section>
      )}

      {crewAssignments?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Crew</div>
          <ShareTable cols={['Name','Position','Phone','Email','Dietary']} colClasses={['','','nowrap','','']} rows={crewAssignments.map(a => [a.crewMember ? shortName(displayName(a.crewMember))||'TBD' : 'TBD', a.position.name, (a.crewMember?.phone ? <Tel v={a.crewMember.phone} /> : '—'), (a.crewMember?.email ? <Mail v={a.crewMember.email} /> : '—'), <DietaryCell key={a.id} value={a.crewMember?.dietaryRestrictions} />])} />
        </section>
      )}

      {!hideGear && <GearSection gear={gear} onlineRentals={onlineRentals} shareToken={shareToken} />}

      {deliverables?.length > 0 && (
        <section className="share-section">
          <div style={{ fontSize:16, fontWeight:700, color:'var(--text)', marginBottom:12, letterSpacing:'-0.01em' }}>Post-Production — Deliverables</div>
          {gear?.gear_person_name && (
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:8 }}>
              DIT: <span style={{ color:'var(--text)', fontWeight:500 }}>{gear.gear_person_name}</span>
              {gear.gear_person_phone && <span style={{ marginLeft:8 }}><Tel v={gear.gear_person_phone} /></span>}
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
                style={{ fontSize:11, fontWeight:700, padding:'5px 16px', borderRadius:100, border: tagFilter === tag ? 'none' : '1px solid rgba(255,255,255,0.12)', background: tagFilter === tag ? 'var(--orange)' : 'rgba(255,255,255,0.06)', color: tagFilter === tag ? '#fff' : 'rgba(255,255,255,0.5)', cursor:'pointer', letterSpacing:'.06em', transition:'all 0.15s' }}>
                {tag}
              </button>
            ))}
          </div>
        )}
        {sortedSchedule.filter(day => {
          if (!tagFilter) return true;
          if (day.events.some(e => (e.tags || []).some(t => t.type === tagFilter || t.type === 'ALL_CREW'))) return true;
          return [day.call_time_tags, day.shooting_call_tags, day.lunch_tags, day.wrap_time_tags]
            .some(tags => Array.isArray(tags) && (tags.includes(tagFilter) || tags.includes('ALL_CREW')));
        }).map((day, i) => (
          <DaySection key={day.id} day={day} showCalls flights={flights} dayIndex={i} tagFilter={tagFilter} cateringDetail="name" shotList={shotList} slDays={slDays} slBreaks={slBreaks} onOpenShotList={onOpenShotList} crewAssignments={crewAssignments} projectCity={[project.city, project.state].filter(Boolean).join(', ')} />
        ))}
      </div>
    </div>
  );
}

// ── Questions View ────────────────────────────────────────────────────────────
function QuestionsView({ shareToken, pw, canAnswer, project }) {
  // Once day 1 arrives (America/Chicago), new questions are closed
  const projectStarted = (() => {
    if (!project?.start_date) return false;
    const today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }) + 'T12:00:00');
    return new Date(project.start_date.slice(0, 10) + 'T12:00:00') <= today;
  })();
  const [questions, setQuestions] = useState([]);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answeringId, setAnsweringId] = useState(null);
  const [answerInput, setAnswerInput] = useState('');
  const [answeringSubmitting, setAnsweringSubmitting] = useState(false);
  const [animatingId, setAnimatingId] = useState(null);

  useEffect(() => {
    api.getShareQuestions(shareToken, pw).then(setQuestions).catch(() => {});
  }, [shareToken]);

  async function submitQuestion(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      const q = await api.createShareQuestion(shareToken, pw, input.trim());
      setQuestions(prev => [...prev, q]);
      setInput('');
    } catch(err) { alert(err.message); }
    finally { setSubmitting(false); }
  }

  async function submitAnswer(qid) {
    if (!answerInput.trim()) return;
    setAnsweringSubmitting(true);
    try {
      const updated = await api.answerShareQuestion(shareToken, pw, qid, answerInput.trim());
      setAnimatingId(qid);
      setTimeout(() => {
        setQuestions(prev => prev.map(q => q.id === qid ? updated : q));
        setAnimatingId(null);
        setAnsweringId(null);
        setAnswerInput('');
      }, 500);
    } catch(err) { alert(err.message); }
    finally { setAnsweringSubmitting(false); }
  }

  const unanswered = questions.filter(q => !q.answer);
  const answered = questions.filter(q => q.answer);

  return (
    <div className="share-view">
      <div className="share-header" style={{ paddingBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:700, letterSpacing:'-0.01em' }}>Questions</div>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>
          {canAnswer ? 'Ask a question or answer open ones below.' : 'Submit a question and check back for answers.'}
        </div>
      </div>

      {projectStarted ? (
        <div style={{ border:'1.5px solid rgba(239,68,68,0.7)', borderRadius:8, padding:'14px 16px', marginBottom:28, background:'var(--bg2)' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#ef4444' }}>
            Project has Started, question feature has been disabled. Please reach out to the Field Producer for any questions.
          </div>
          {(project?.poc_name || project?.poc_phone) && (
            <div style={{ fontSize:13, color:'var(--text)', marginTop:8 }}>
              {project.poc_name && <span style={{ fontWeight:600 }}>{project.poc_name}</span>}
              {project.poc_name && project.poc_phone && ' · '}
              {project.poc_phone && <a href={`tel:${project.poc_phone}`} style={{ color:'var(--orange)' }}>{project.poc_phone}</a>}
            </div>
          )}
        </div>
      ) : (
      <form onSubmit={submitQuestion} style={{ display:'flex', gap:10, marginBottom:28, alignItems:'flex-start' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuestion(e); } }}
          placeholder="Type a question…"
          rows={2}
          style={{ flex:1, resize:'vertical', fontFamily:'inherit', fontSize:13 }}
        />
        <button className="btn btn-primary" type="submit" disabled={submitting || !input.trim()} style={{ flexShrink:0, alignSelf:'flex-end' }}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)', marginBottom:10 }}>Unanswered ({unanswered.length})</div>
          {unanswered.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No open questions.</div>}
          {unanswered.map(q => (
            <div key={q.id} style={{ border:'1.5px solid rgba(239,68,68,0.5)', borderRadius:8, padding:'12px 14px', marginBottom:10, background:'var(--bg2)', opacity: animatingId === q.id ? 0 : 1, transform: animatingId === q.id ? 'translateX(40px)' : 'none', transition: animatingId === q.id ? 'opacity 0.4s, transform 0.4s' : 'none' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', flexShrink:0, marginTop:4 }} />
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:'var(--text)', marginBottom: answeringId === q.id ? 10 : 0 }}>{q.question}</div>
                  {canAnswer && answeringId === q.id ? (
                    <div>
                      <textarea value={answerInput} onChange={e => setAnswerInput(e.target.value)} placeholder="Type your answer…" rows={3} autoFocus style={{ width:'100%', boxSizing:'border-box', fontFamily:'inherit', fontSize:12, resize:'vertical', marginBottom:8 }} />
                      <div style={{ display:'flex', gap:8 }}>
                        <button className="btn btn-sm" disabled={answeringSubmitting || !answerInput.trim()} onClick={() => submitAnswer(q.id)} style={{ background:'#22c55e', color:'#fff', border:'none', fontWeight:600 }}>
                          {answeringSubmitting ? 'Saving…' : 'Submit Answer'}
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setAnsweringId(null); setAnswerInput(''); }}>Cancel</button>
                      </div>
                    </div>
                  ) : canAnswer ? (
                    <button className="btn btn-ghost btn-sm" style={{ marginTop:6, fontSize:11 }} onClick={() => { setAnsweringId(q.id); setAnswerInput(''); }}>Answer</button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)', marginBottom:10 }}>Answered ({answered.length})</div>
          {answered.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No answered questions yet.</div>}
          {answered.map(q => (
            <div key={q.id} style={{ border:'1.5px solid rgba(34,197,94,0.5)', borderRadius:8, padding:'12px 14px', marginBottom:10, background:'var(--bg2)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <div style={{ color:'#22c55e', fontSize:14, flexShrink:0, marginTop:1 }}>✓</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:6 }}>{q.question}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5 }}>{q.answer}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Shot List Full View (share) ───────────────────────────────────────────────
const SL_MOVEMENTS = ['Static', 'Pan', 'Tilt', 'Dolly', 'Handheld', 'Crane', 'Zoom', 'Gimbal'];
const SL_COVERAGES = ['Interview', 'B-Roll'];
const SL_SCENE_STYLES = {
  interior: { bg:'rgba(96,165,250,0.12)', border:'rgba(96,165,250,0.4)', badge:'rgba(96,165,250,0.18)', badgeText:'#60a5fa', label:'INT.' },
  exterior: { bg:'rgba(74,222,128,0.10)', border:'rgba(74,222,128,0.4)', badge:'rgba(74,222,128,0.15)', badgeText:'#4ade80', label:'EXT.' },
};
function slLabel(sceneNum, idx) { return `${sceneNum}${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[idx]||idx}`; }
function slCalcWrap(startTime, shots) {
  if (!startTime) return null;
  const m = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let [,h,min,mer] = m; h=parseInt(h); min=parseInt(min);
  if (mer.toUpperCase()==='PM'&&h!==12) h+=12;
  if (mer.toUpperCase()==='AM'&&h===12) h=0;
  const total = h*60+min + shots.reduce((s,sh)=>s+(sh.est_minutes||0),0);
  const eh=Math.floor(total/60)%24, em=total%60;
  return `${eh%12||12}:${String(em).padStart(2,'0')} ${eh>=12?'PM':'AM'}`;
}

function slShotEstStart(sceneStartTime, shots, idx) {
  if (!sceneStartTime) return null;
  const offset = (shots || []).slice(0, idx).reduce((s, sh) => s + (sh.setup_minutes ?? 5) + ((sh.takes_count ?? 1) * (sh.take_minutes ?? 5)) + (sh.buffer_minutes ?? 5), 0);
  return slAddMins(sceneStartTime, offset);
}

function SlShotRow({ shot, index, sceneNum, shareToken, onUpdate, accentColor, allExpanded, talent, sceneStartTime, allShots }) {
  const captured = shot.status === 'captured';
  const [desc, setDesc] = useState(shot.description || '');
  const [movement, setMovement] = useState(shot.movement || '');
  const [open, setOpen] = useState(false);
  const [talentOpen, setTalentOpen] = useState(false);
  const talentRef = useRef(null);
  const isOpen = allExpanded || open;
  const displayMinutes = (shot.setup_minutes??5) + ((shot.takes_count??1)*(shot.take_minutes??5)) + (shot.buffer_minutes??5);

  const [detail, setDetail] = useState({
    angle: shot.angle||'', lens: shot.lens||'', frameRate: shot.frame_rate||'',
    coverage: shot.coverage||'', talentTags: shot.talent_tags||[],
    specialEquipment: shot.special_equipment||'', audioNotes: shot.audio_notes||'',
    setupMinutes: shot.setup_minutes??5, takesCount: shot.takes_count??1,
    takeMinutes: shot.take_minutes??5, bufferMinutes: shot.buffer_minutes??5,
  });
  const [detailSaving, setDetailSaving] = useState(false);
  const totalTime = Number(detail.setupMinutes||0)+(Number(detail.takesCount||0)*Number(detail.takeMinutes||0))+Number(detail.bufferMinutes||0);

  useEffect(() => { setDesc(shot.description||''); }, [shot.description]);
  useEffect(() => { setMovement(shot.movement||''); }, [shot.movement]);
  useEffect(() => {
    setDetail({ angle:shot.angle||'', lens:shot.lens||'', frameRate:shot.frame_rate||'',
      coverage:shot.coverage||'', talentTags:shot.talent_tags||[],
      specialEquipment:shot.special_equipment||'', audioNotes:shot.audio_notes||'',
      setupMinutes:shot.setup_minutes??5, takesCount:shot.takes_count??1,
      takeMinutes:shot.take_minutes??5, bufferMinutes:shot.buffer_minutes??5 });
  }, [shot.id]);

  useEffect(() => {
    function h(e) { if (talentRef.current && !talentRef.current.contains(e.target)) setTalentOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  async function save(field, value) {
    try { const u = await api.updateShareShot(shareToken, shot.id, {[field]: value??null}); onUpdate(u); } catch {}
  }
  async function toggleCapture() {
    const status = captured ? 'not_captured' : 'captured';
    try { const u = await api.updateShareShot(shareToken, shot.id, {status}); onUpdate(u); } catch {}
  }
  async function saveDetail() {
    setDetailSaving(true);
    try {
      const u = await api.updateShareShot(shareToken, shot.id, {...detail, estMinutes: totalTime||null});
      onUpdate(u); setOpen(false);
    } catch(e) { alert(e.message); }
    setDetailSaving(false);
  }
  function toggleTalent(name) {
    setDetail(f => ({ ...f, talentTags: f.talentTags.includes(name) ? f.talentTags.filter(t=>t!==name) : [...f.talentTags, name] }));
  }

  const detailBody = (
    <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px 14px', marginBottom:12 }} className="sl-detail-grid">
              <div className="field sl-detail-move" style={{ margin:0 }}>
                <label style={{ fontSize:10 }}>Movement</label>
                <select value={movement} onChange={e=>{setMovement(e.target.value); save('movement',e.target.value);}}>
                  <option value="">— Movement —</option>
                  {SL_MOVEMENTS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {[['Angle','angle','e.g. Eye level'],['Lens','lens','e.g. 85mm'],['Frame Rate','frameRate','e.g. 24fps']].map(([lbl,key,ph])=>(
                <div key={key} className="field" style={{ margin:0 }}>
                  <label style={{ fontSize:10 }}>{lbl}</label>
                  <input value={detail[key]} onChange={e=>setDetail(f=>({...f,[key]:e.target.value}))} placeholder={ph} />
                </div>
              ))}
              <div className="field" style={{ margin:0 }}>
                <label style={{ fontSize:10 }}>Coverage</label>
                <select value={detail.coverage} onChange={e=>setDetail(f=>({...f,coverage:e.target.value}))}>
                  <option value="">— Select —</option>
                  {SL_COVERAGES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin:0, gridColumn:'span 2' }}>
                <label style={{ fontSize:10 }}>Special Equipment</label>
                <input value={detail.specialEquipment} onChange={e=>setDetail(f=>({...f,specialEquipment:e.target.value}))} placeholder="e.g. Gimbal, Drone" />
              </div>
              <div className="field" style={{ margin:0, gridColumn:'span 2' }}>
                <label style={{ fontSize:10 }}>Audio</label>
                <input value={detail.audioNotes} onChange={e=>setDetail(f=>({...f,audioNotes:e.target.value}))} placeholder="e.g. Lav mic, Boom" />
              </div>
            </div>
            {talent.length > 0 && (
              <div className="field" style={{ margin:'0 0 12px' }}>
                <label style={{ fontSize:10 }}>Talent</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                  {talent.map(t=>{
                    const active=detail.talentTags.includes(t.name);
                    return <button key={t.name} type="button" onClick={()=>toggleTalent(t.name)} style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active?'var(--orange)':'var(--border)'}`, background: active?'rgba(251,146,60,0.15)':'var(--bg2)', color: active?'var(--orange)':'var(--muted)' }}>{t.name}</button>;
                  })}
                </div>
              </div>
            )}
            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Timing Breakdown</div>
              <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                {[['Setup','setupMinutes'],['Buffer','bufferMinutes']].map(([lbl,key])=>(
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:11, color:'var(--muted)' }}>{lbl}</span>
                    <input type="number" min="0" value={detail[key]} onChange={e=>setDetail(f=>({...f,[key]:e.target.value}))} style={{ width:48, textAlign:'center' }} />
                    <span style={{ fontSize:11, color:'var(--muted)' }}>min</span>
                  </div>
                ))}
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Takes</span>
                  <input type="number" min="1" value={detail.takesCount} onChange={e=>setDetail(f=>({...f,takesCount:e.target.value}))} style={{ width:48, textAlign:'center' }} />
                  <span style={{ fontSize:11, color:'var(--muted)' }}>×</span>
                  <input type="number" min="0" value={detail.takeMinutes} onChange={e=>setDetail(f=>({...f,takeMinutes:e.target.value}))} style={{ width:48, textAlign:'center' }} />
                  <span style={{ fontSize:11, color:'var(--muted)' }}>min</span>
                </div>
                <div style={{ marginLeft:'auto', display:'flex', alignItems:'baseline', gap:5 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Total</span>
                  <span style={{ fontSize:18, fontWeight:800, color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>{totalTime}</span>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>min</span>
                </div>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveDetail} disabled={detailSaving}>{detailSaving?'Saving…':'Save Details'}</button>
              <button className="btn btn-ghost btn-sm" onClick={()=>setOpen(false)}>Close</button>
            </div>
    </>
  );

  const mobileModal = isOpen && isMobileNow();

  return (
    <>
      <tr onClick={() => { if (isMobileNow()) setOpen(true); }}
        style={{ borderBottom: isOpen && !mobileModal ? 'none' : '1px solid var(--border)', background: captured ? 'rgba(15,15,12,0.6)' : 'transparent', outline: captured ? 'none' : `1px solid ${accentColor}55`, outlineOffset:'-1px', opacity: captured ? 0.4 : 1, transition:'background 0.15s, opacity 0.2s' }}>
        <td style={{ padding:'10px 8px 10px 14px', width:28 }} onClick={e => e.stopPropagation()}>
          <div onClick={toggleCapture} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${captured?'#4ade80':accentColor}`, background: captured?'#4ade80':'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
            {captured && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </td>
        <td style={{ padding:'10px 6px', fontSize:13, fontWeight:700, color: captured?'var(--muted)':accentColor, width:40, whiteSpace:'nowrap' }}>{slLabel(sceneNum, index)}</td>
        <td style={{ padding:'10px 4px', width:20 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => setOpen(o=>!o)} style={{ background:'none', border:'none', color: isOpen?accentColor:'var(--muted)', cursor:'pointer', fontSize:11, padding:0, lineHeight:1, opacity: isOpen?1:0.5 }}>{isOpen?'▼':'▶'}</button>
        </td>
        <td style={{ padding:'6px 8px' }} onClick={e => e.stopPropagation()}>
          <input value={desc} onChange={e=>setDesc(e.target.value)} onBlur={()=>{if(desc!==(shot.description||'')) save('description',desc);}}
            placeholder="Shot description…" style={{ width:'100%', background:'transparent', border:'none', outline:'none', color: captured?'var(--muted)':'var(--text)', fontSize:13, fontFamily:'inherit', padding:0 }} />
        </td>
        <td className="sl-col-hide" style={{ padding:'6px 8px', width:130 }}>
          <select value={movement} onChange={e=>{setMovement(e.target.value); save('movement',e.target.value);}}
            style={{ background:'transparent', border:'none', outline:'none', color: movement?(captured?'var(--muted)':'var(--text)'):'var(--muted)', fontSize:13, fontFamily:'inherit', cursor:'pointer', padding:0, width:'100%' }}>
            <option value="">— Movement —</option>
            {SL_MOVEMENTS.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </td>
        <td className="sl-col-hide" style={{ padding:'6px 8px', width:80 }} ref={talentRef}>
          {(shot.talent_tags||[]).length > 0 ? (
            <div style={{ position:'relative' }}>
              <button onClick={()=>setTalentOpen(o=>!o)} style={{ background: talentOpen?`${accentColor}22`:'transparent', border:`1px solid ${accentColor}55`, borderRadius:100, padding:'2px 8px', fontSize:11, fontWeight:700, color: captured?'var(--muted)':accentColor, cursor:'pointer', lineHeight:'16px', whiteSpace:'nowrap' }}>
                {shot.talent_tags.length} talent
              </button>
              {talentOpen && (
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:200, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.4)', padding:'8px 12px', minWidth:120, whiteSpace:'nowrap' }}>
                  {shot.talent_tags.map(name=><div key={name} style={{ fontSize:12, color:'var(--text)', padding:'3px 0', borderBottom:'1px solid var(--border)' }}>{name}</div>)}
                </div>
              )}
            </div>
          ) : <span style={{ fontSize:12, color:'var(--muted)', opacity:0.4 }}>—</span>}
        </td>
        <td style={{ padding:'6px 8px', width:60 }}>
          <span style={{ fontSize:13, color: captured?'var(--muted)':'var(--text)', fontVariantNumeric:'tabular-nums' }}>{displayMinutes}<span style={{ fontSize:10, color:'var(--muted)', marginLeft:2 }}>m</span></span>
        </td>
        <td style={{ padding:'6px 8px', width:72 }}>
          {(() => {
            const t = slShotEstStart(sceneStartTime, allShots, index);
            return t ? <span style={{ fontSize:12, color:'var(--muted)', fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{t}</span> : <span style={{ color:'var(--muted)', opacity:0.3, fontSize:12 }}>—</span>;
          })()}
        </td>
      </tr>
      {isOpen && !mobileModal && (
        <tr style={{ borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,0.025)' }}>
          <td colSpan={8} className="sl-detail-cell" style={{ padding:'12px 14px 16px 60px' }}>
            {detailBody}
          </td>
        </tr>
      )}
      {mobileModal && createPortal(
        <div className="modal-bg" onClick={() => setOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-title">Shot {slLabel(sceneNum, index)}{desc ? ` — ${desc}` : ''}</div>
            {detailBody}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function SlSceneBlock({ scene, shareToken, talent, onShotUpdate, onStartTimeChange }) {
  const st = SL_SCENE_STYLES[scene.scene_type] || SL_SCENE_STYLES.interior;
  const startTime = scene.est_start_time || '';
  const [allExpanded, setAllExpanded] = useState(false);
  const wrapTime = slCalcWrap(startTime, scene.shots||[]);

  return (
    <div style={{ background:'var(--bg2)', border:`1px solid ${st.border}`, borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      <div className="sl-scene-head" style={{ padding:'12px 20px', background:st.bg, borderBottom:`1px solid ${st.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <span style={{ fontSize:10, fontWeight:800, color:st.badgeText, textTransform:'uppercase', letterSpacing:'.1em', background:st.badge, border:`1px solid ${st.border}`, borderRadius:4, padding:'2px 8px', whiteSpace:'nowrap' }}>
            {st.label} · Scene {scene.scene_number}
          </span>
          <span style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>{scene.name}</span>
          {scene.description && <span style={{ fontSize:12, color:'var(--muted)' }}>· {scene.description}</span>}
          <span className="m-hide" style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{(scene.shots||[]).length} shot{(scene.shots||[]).length!==1?'s':''}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span className="m-only" style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{(scene.shots||[]).length} shot{(scene.shots||[]).length!==1?'s':''}</span>
          {startTime && (
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', whiteSpace:'nowrap' }}>Est. Start</span>
              <span style={{ fontSize:13, fontWeight:700, color:st.badgeText, fontVariantNumeric:'tabular-nums' }}>{startTime}</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
      <table className="sl-shot-table" style={{ width:'100%', minWidth:480, borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border)' }}>
            <th style={{ width:28 }} />
            <th style={{ padding:'8px 6px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:40 }}>Shot</th>
            <th style={{ width:20 }} />
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left' }}>Description</th>
            <th className="sl-col-hide" style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:130 }}>Movement</th>
            <th className="sl-col-hide" style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:80 }}>Talent</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:60 }}>Time</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:92 }}>Est. Start Time</th>
          </tr>
        </thead>
        <tbody>
          {(scene.shots||[]).map((shot,i)=>(
            <SlShotRow key={shot.id} shot={shot} index={i} sceneNum={scene.scene_number}
              shareToken={shareToken} onUpdate={onShotUpdate}
              accentColor={st.badgeText} allExpanded={allExpanded} talent={talent}
              sceneStartTime={startTime} allShots={scene.shots} />
          ))}
        </tbody>
      </table>
      </div>
      <div className="sl-scene-foot" style={{ padding:'10px 20px', background:st.bg, borderTop:`1px solid ${st.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={()=>setAllExpanded(e=>!e)} style={{ background:'none', border:'none', fontSize:11, fontWeight:700, color:st.badgeText, cursor:'pointer', padding:0, textTransform:'uppercase', letterSpacing:'.08em', opacity:0.8, display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:12 }}>{allExpanded?'▲':'▼'}</span>
          {allExpanded?'Collapse All':'Expand All Shots'}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, fontWeight:700, color:st.badgeText, textTransform:'uppercase', letterSpacing:'.08em', opacity:0.7 }}>Est. Scene Wrap:</span>
          <span style={{ fontSize:13, fontWeight:800, color:st.badgeText, fontVariantNumeric:'tabular-nums' }}>{wrapTime||(startTime?'Invalid time':'—')}</span>
        </div>
      </div>
    </div>
  );
}

function SlLiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(()=>{ const id=setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(id); },[]);
  const fmt = time.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true});
  return (
    <div style={{ position:'sticky', top:48, zIndex:80, backdropFilter:'blur(20px) saturate(160%)', WebkitBackdropFilter:'blur(20px) saturate(160%)', background:'rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.08)', borderTop:'1px solid rgba(255,255,255,0.06)', boxShadow:'0 4px 20px rgba(0,0,0,0.3)', padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:14, marginLeft:-20, marginRight:-20 }}>
      <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.18em' }}>Current Time</span>
      <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)' }}>·</span>
      <span style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.85)', letterSpacing:'.06em', fontVariantNumeric:'tabular-nums' }}>{fmt}</span>
    </div>
  );
}

function slFmt12(t) {
  if (!t) return null;
  const m24 = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (m24) {
    let h = parseInt(m24[1], 10), mn = parseInt(m24[2], 10);
    const mer = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
    return `${h}:${String(mn).padStart(2,'0')} ${mer}`;
  }
  return t;
}

function slAddMins(time12, mins) {
  if (!time12 || mins == null) return time12;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time12);
  if (!m) return time12;
  let h = parseInt(m[1]), mn = parseInt(m[2]);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
  const total = h * 60 + mn + mins;
  const eh = Math.floor(total / 60) % 24, em = total % 60;
  return `${eh % 12 || 12}:${String(em).padStart(2,'0')} ${eh >= 12 ? 'PM' : 'AM'}`;
}

function slSceneDuration(shots) {
  return (shots || []).reduce((s, sh) => s + (sh.setup_minutes ?? 5) + ((sh.takes_count ?? 1) * (sh.take_minutes ?? 5)) + (sh.buffer_minutes ?? 5), 0);
}

function slBreakDuration(brk) {
  const toMins = (t) => {
    if (!t) return null;
    const m12 = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(t);
    if (m12) { let h = parseInt(m12[1]); if (m12[3].toUpperCase()==='PM'&&h!==12) h+=12; if (m12[3].toUpperCase()==='AM'&&h===12) h=0; return h*60+parseInt(m12[2]); }
    const m24 = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (m24) return parseInt(m24[1])*60+parseInt(m24[2]);
    return null;
  };
  const s = toMins(brk.start_time), e = toMins(brk.end_time);
  if (s == null || e == null) return 0;
  return Math.max(0, e - s);
}

function SlDayHeader({ day }) {
  // date is free text, but some rows carry raw ISO timestamps — format those
  const isoM = day.date ? /^(\d{4})-(\d{2})-(\d{2})/.exec(day.date) : null;
  const dateStr = isoM
    ? new Date(`${isoM[1]}-${isoM[2]}-${isoM[3]}T12:00:00`).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' }).toUpperCase()
    : (day.date || null);
  const tiles = [
    { label:'Call Time', val: slFmt12(day.call_time) },
    { label:'Shooting Call', val: slFmt12(day.shooting_call) },
    { label:'Lunch', val: slFmt12(day.lunch_time) },
    { label:'Est. Wrap', val: slFmt12(day.est_wrap) },
  ];
  return (
    <div style={{ marginBottom:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'10px 16px', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <div style={{ fontSize:13, fontWeight:800, color:'var(--text)', letterSpacing:'.04em' }}>DAY {day.day_number}</div>
        {dateStr && (
          <span style={{ fontSize:11, fontWeight:700, color:'var(--text)', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:6, padding:'4px 8px' }}>
            {dateStr}
          </span>
        )}
      </div>
      <div style={{ padding:'0 16px 10px' }}>
        <ShineBorder radius={10}>
          <div className="sl-day-tiles" style={{ background:'rgba(10,10,8,0.92)', borderRadius:8, display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', overflow:'hidden' }}>
            {tiles.map((t, i) => (
              <div key={t.label} style={{ padding:'3px 12px 4px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none', textAlign:'center' }}>
                <div style={{ fontSize:8, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em' }}>{t.label}</div>
                <div style={{ fontSize:12, fontWeight:800, color: t.val ? 'var(--text)' : 'rgba(255,255,255,0.2)', fontVariantNumeric:'tabular-nums', lineHeight:1.2 }}>{t.val || '—'}</div>
              </div>
            ))}
          </div>
        </ShineBorder>
      </div>
    </div>
  );
}

function SlBreakCard({ brk }) {
  return (
    <div style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.3)', borderRadius:10, padding:'12px 20px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
      <span style={{ fontSize:18 }}>☕</span>
      <div>
        <div style={{ fontSize:11, fontWeight:800, color:'#fbbf24', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:2 }}>Break</div>
        {(brk.start_time || brk.end_time) && (
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>
            {slFmt12(brk.start_time) || brk.start_time}
            {brk.start_time && brk.end_time && ' → '}
            {slFmt12(brk.end_time) || brk.end_time}
          </div>
        )}
      </div>
    </div>
  );
}

function ShotListShareView({ scenes: initialScenes, days: initialDays = [], breaks: initialBreaks = [], shareToken, talent }) {
  const [scenes, setScenes] = useState(initialScenes);

  function handleShotUpdate(updated) {
    setScenes(prev => prev.map(s => ({ ...s, shots:(s.shots||[]).map(sh => sh.id===updated.id ? updated : sh) })));
  }

  const totalShots = scenes.reduce((s,sc)=>s+(sc.shots||[]).length,0);
  const totalMinutes = scenes.reduce((s,sc)=>s+slSceneDuration(sc.shots),0);
  const capturedShots = scenes.reduce((s,sc)=>s+(sc.shots||[]).filter(sh=>sh.status==='captured').length,0);

  // Build day groups with scenes and breaks interleaved, times cascaded
  const unassignedScenes = scenes.filter(s => !s.day_id);
  // Days flagged hidden (and holding no scenes) stay off the public views
  const visibleDays = initialDays.filter(d => !(d.hide_public && !scenes.some(s => s.day_id === d.id)));
  const dayGroups = visibleDays.map(day => {
    const dayScenes = scenes.filter(s => s.day_id === day.id).sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const dayBreaks = initialBreaks.filter(b => b.day_id === day.id);
    // Cascade times: start from day's shooting_call
    let cursor = slFmt12(day.shooting_call) || (dayScenes[0]?.est_start_time ?? null);
    const items = [];
    for (let i = 0; i < dayScenes.length; i++) {
      const scene = { ...dayScenes[i], est_start_time: cursor };
      const wrap = cursor ? slAddMins(cursor, slSceneDuration(scene.shots)) : null;
      items.push({ type: 'scene', scene, wrap });
      // Find breaks that follow this scene (by sort_order proximity or start_time)
      const nextSceneSortOrder = dayScenes[i+1]?.sort_order ?? Infinity;
      const sceneBreaks = dayBreaks.filter(b => {
        const bMins = timeToMins(b.start_time);
        const wrapMins = wrap ? timeToMins(wrap) : Infinity;
        return bMins >= (cursor ? timeToMins(cursor) : 0) && bMins < (nextSceneSortOrder < Infinity ? timeToMins(dayScenes[i+1]?.est_start_time ?? '23:59 PM') : Infinity)
          || (i === dayScenes.length - 1 && !items.some(x => x.type === 'break' && x.brk.id === b.id));
      }).filter(b => !items.some(x => x.type === 'break' && x.brk.id === b.id));
      for (const brk of sceneBreaks) {
        const brkWithTime = { ...brk, start_time: wrap };
        items.push({ type: 'break', brk: brkWithTime });
        cursor = slFmt12(brk.end_time) || slAddMins(wrap, slBreakDuration(brk));
      }
      if (sceneBreaks.length === 0) cursor = wrap;
    }
    return { day, items };
  });

  return (
    <div>
      {scenes.length === 0 && <div className="empty">No scenes added yet.</div>}

      {dayGroups.map(({ day, items }, di) => (
        <div key={day.id}>
          {di > 0 && <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'20px 0' }} />}
          <SlDayHeader day={day} />
          {items.map((item, ii) =>
            item.type === 'scene' ? (
              <SlSceneBlock key={item.scene.id} scene={item.scene} shareToken={shareToken} talent={talent}
                onShotUpdate={handleShotUpdate} onStartTimeChange={() => {}} />
            ) : (
              <SlBreakCard key={item.brk.id + '-' + ii} brk={item.brk} />
            )
          )}
        </div>
      ))}

      {unassignedScenes.length > 0 && (
        <div>
          {dayGroups.length > 0 && <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'20px 0' }} />}
          {unassignedScenes.map(scene => (
            <SlSceneBlock key={scene.id} scene={scene} shareToken={shareToken} talent={talent}
              onShotUpdate={handleShotUpdate} onStartTimeChange={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Client View ──────────────────────────────────────────────────────────────
function ClientView({ data, onOpenShotList }) {
  const { project, locations, clientContacts, keyTalent, schedule, shotList = [], slDays = [], slBreaks = [] } = data;
  return (
    <div className="share-view">
      <div className="share-header">
        <div className="proj-code">{project.code}</div>
        <div className="proj-title">{project.title}</div>
        <div className="proj-meta" style={{ marginTop: 6 }}>
          <span className="meta">{project.client}</span>
          <span className="meta">{fmt(project.start_date)} – {fmt(project.end_date)}</span>
        </div>
      </div>
      {project.poc_name && (
        <section className="share-section">
          <div className="sec-lbl">Key Contact</div>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 18px', maxWidth:340 }}>
            <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600, marginBottom:4 }}>Main POC</div>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>{project.poc_name}</div>
            {project.poc_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}><Tel v={project.poc_phone} /></div>}
            {project.poc_email && <div style={{ fontSize:11, color:'var(--muted)' }}><Mail v={project.poc_email} /></div>}
          </div>
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
                  <div className="loc-name">
                    {l.type && <span style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600 }}>{LOCATION_TYPE_LABEL[l.type] || l.type} — </span>}
                    {l.name}
                  </div>
                  {l.address
                    ? <a href={mapsUrl(l.address)} target="_blank" rel="noreferrer" className="loc-addr" style={{ color:'var(--tan)', textDecoration:'underline', display:'block' }}>{l.address}</a>
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
          <ShareTable cols={['Name','Title','Phone','Email']} colClasses={['','','nowrap','']} rows={clientContacts.map(c => [c.name, c.title, (c.phone ? <Tel v={c.phone} /> : '—'), (c.email ? <Mail v={c.email} /> : '—')])} />
        </section>
      )}
      {keyTalent?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Talent</div>
          <ShareTable cols={['Name','Role','Phone','Email']} colClasses={['','','nowrap','']} rows={keyTalent.map(t => [t.name, t.role||'—', (t.phone ? <Tel v={t.phone} /> : '—'), (t.email ? <Mail v={t.email} /> : '—')])} />
        </section>
      )}
      {[...(schedule||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((day, i) => (
        <DaySection key={day.id} day={day} showCalls={false} dayIndex={i} cateringDetail="name" shotList={shotList} slDays={slDays} slBreaks={slBreaks} onOpenShotList={onOpenShotList} />
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
    events: day.events.filter(e => (e.audience || []).includes(talent_name)),
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
              <span className="meta">{fmt(project.start_date)} – {fmt(project.end_date)}</span>
            </div>
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
                  {project.poc_phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:2 }}><Tel v={project.poc_phone} /></div>}
                  {project.poc_email && <div style={{ fontSize:11, color:'var(--muted)', overflowWrap:'anywhere' }}><Mail v={project.poc_email} /></div>}
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
                {c.phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:3 }}><Tel v={c.phone} /></div>}
                {c.email && <div style={{ fontSize:11, color:'var(--muted)', overflowWrap:'anywhere' }}><Mail v={c.email} /></div>}
              </div>
            ))}
            {(productionCrew || []).map(a => (
              <div key={a.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', flex:'1 1 0', minWidth:0 }}>
                <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:2 }}>{a.position.name}</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{a.crewMember ? shortName(displayName(a.crewMember)) || 'TBD' : 'TBD'}</div>
                {a.crewMember?.phone && <div style={{ fontSize:12, color:'var(--tan)', marginTop:3 }}><Tel v={a.crewMember.phone} /></div>}
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
    <div className="share-table-wrap">
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
    </div>
  );
}

const SL_SCENE_STYLES_SHARE = {
  interior: { bg:'rgba(96,165,250,0.10)', border:'rgba(96,165,250,0.35)', badge:'rgba(96,165,250,0.18)', color:'#60a5fa', label:'INT.' },
  exterior: { bg:'rgba(74,222,128,0.08)', border:'rgba(74,222,128,0.35)', badge:'rgba(74,222,128,0.14)', color:'#4ade80', label:'EXT.' },
};

function slCalcWrapShare(startTime, shots) {
  if (!startTime) return null;
  const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let [, h, m, mer] = match;
  h = parseInt(h); m = parseInt(m);
  if (mer.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (mer.toUpperCase() === 'AM' && h === 12) h = 0;
  const total = h * 60 + m + (shots || []).reduce((s, sh) => s + (sh.est_minutes || 0), 0);
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${endH % 12 || 12}:${String(endM).padStart(2, '0')} ${endH >= 12 ? 'PM' : 'AM'}`;
}

const _SL_MO = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function slDateToISOShare(str) {
  if (!str) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = str.match(/\w+,\s+(\w+)\s+(\d+),\s+(\d{4})/);
  if (!m) return null;
  const mi = _SL_MO.indexOf(m[1].toLowerCase()) + 1;
  if (!mi) return null;
  return `${m[3]}-${String(mi).padStart(2,'0')}-${String(parseInt(m[2])).padStart(2,'0')}`;
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
  if (!value || value === 'N/A') return <span>—</span>;
  return <span style={{ fontSize:12 }}>⚠️ {value}</span>;
}

const MEAL_META = {
  BREAKFAST: { emoji:'🍳', label:'Breakfast', color:'#fbbf24' },
  LUNCH:     { emoji:'🥗', label:'Lunch',     color:'#4ade80' },
  DINNER:    { emoji:'🍽️', label:'Dinner',    color:'#f87171' },
};

function CateringBadge({ catering, detail }) {
  if (!catering || catering.length === 0) return null;
  const ordered = ['BREAKFAST','LUNCH','DINNER'].map(mt => catering.find(c => c.meal_type === mt)).filter(Boolean);
  if (!ordered.length) return null;
  return (
    <div style={{ textAlign:'right', fontSize:11 }}>
      {ordered.map(c => {
        const mm = MEAL_META[c.meal_type] || {};
        return (
          <div key={c.meal_type} style={{ marginBottom:3 }}>
            {detail === 'full' ? (
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700, color: mm.color, fontSize:10, textTransform:'uppercase', letterSpacing:'.06em' }}>{mm.emoji} {mm.label}</div>
                <div style={{ fontWeight:600, color:'var(--text)', fontSize:12 }}>{c.name}</div>
                {c.address && <div style={{ color:'var(--muted)', fontSize:10 }}>{c.address}</div>}
                {c.order_number && <div style={{ color:'var(--muted)', fontSize:10 }}>Order #{c.order_number}</div>}
                {c.delivery_time && <div style={{ color: mm.color, fontSize:10 }}>🚚 {fmtTime(c.delivery_time)}</div>}
              </div>
            ) : (
              <span style={{ color:'var(--muted)', fontSize:11 }}>{mm.emoji} <span style={{ color:'var(--text)', fontWeight:500 }}>{c.name}</span></span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DaySection({ day, showCalls, flights, dayIndex, talentCallTime, hideCallWrap, tagFilter, cateringDetail, shotList, slDays, slBreaks, onOpenShotList, crewAssignments, projectCity }) {
  const [clapEvent, setClapEvent] = useState(null);
  const crewByPosition = (posName) => {
    const a = (crewAssignments || []).find(x => (x.position?.name || '').toLowerCase() === posName && x.crewMember);
    return a ? displayName(a.crewMember) : '';
  };
  const [open, setOpen] = useState(true);
  const now = useNow();
  const [driveTimes, setDriveTimes] = useState({});

  const filteredDay = tagFilter
    ? { ...day, events: day.events.filter(e => (e.tags || []).some(t => t.type === tagFilter || t.type === 'ALL_CREW')) }
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
  const lunchCateringRaw = (day.catering || []).find(c => c.meal_type === 'LUNCH');
  const lunchCatering = lunchCateringRaw && (lunchCateringRaw.name || lunchCateringRaw.address || lunchCateringRaw.delivery_time) ? lunchCateringRaw : null;
  const syntheticDayItems = tagFilter ? [] : [
    day.call_time          && { _type:'synthetic', _key:'ct',  _sort: timeToMins(day.call_time),           startTime: day.call_time,          title:'General Call Time', notes: day.call_time_notes,      tags: day.call_time_tags },
    day.shooting_call_time && { _type:'synthetic', _key:'sct', _sort: timeToMins(day.shooting_call_time),  startTime: day.shooting_call_time, title:'Shooting Call',     notes: day.shooting_call_notes,  tags: day.shooting_call_tags },
    day.lunch_time         && { _type:'synthetic', _key:'lt',  _sort: timeToMins(day.lunch_time),          startTime: day.lunch_time,         title:'Lunch',             notes: day.lunch_notes,          tags: day.lunch_tags },
    day.wrap_time          && { _type:'synthetic', _key:'wt',  _sort: timeToMins(day.wrap_time),           startTime: day.wrap_time,          title:'Est. Wrap',         notes: day.wrap_time_notes,      tags: day.wrap_time_tags },
  ].filter(Boolean);

  const cateringItems = tagFilter ? [] : (day.catering || [])
    .filter(c => c.meal_type !== 'LUNCH' && (c.name || c.address || c.delivery_time))
    .map(c => ({ _type:'catering', _sort: timeToMins(c.delivery_time) || 9997, _key:`cat-${c.id}`, ...c }));

  // Shot list scene tiles
  const dayISO = dayStr; // "YYYY-MM-DD"
  const matchingSlDayIds = new Set(
    (slDays || []).filter(sd => slDateToISOShare(sd.date) === dayISO).map(sd => sd.id)
  );
  const hasMatchingSlDay = matchingSlDayIds.size > 0;
  const sceneItems = tagFilter ? [] : (shotList || [])
    .filter(s => {
      if (!s.est_start_time) return false;
      if (hasMatchingSlDay) return matchingSlDayIds.has(s.day_id);
      return true; // no date configured — show all scenes
    })
    .map(s => ({ _type:'scene', _sort: timeToMins(s.est_start_time), _key:`scene-${s.id}`, ...s }));

  // Shot list breaks stay on the shot list page — they're a timing tool, not
  // a schedule item
  const breakItems = [];

  const allItems = [
    ...syntheticDayItems,
    ...cateringItems,
    ...filteredDay.events.map(e => ({ _type:'event', _sort: timeToMins(e.start_time), ...e })),
    ...(tagFilter ? [] : flightLegs.map(f => ({ _type:'flight', _sort: timeToMins(f._time), ...f }))),
    ...sceneItems,
    ...breakItems,
  ].sort((a, b) => a._sort - b._sort);

  // Compute driving times between consecutive events with different locations
  useEffect(() => {
    const locItems = allItems.filter(i => i._type === 'event' && i.location?.address);
    const pairs = [];
    for (let i = 1; i < locItems.length; i++) {
      const from = locItems[i-1].location.address;
      const to   = locItems[i].location.address;
      if (from !== to) pairs.push({ key: `${from}||${to}`, from, to });
    }
    if (!pairs.length) return;
    let cancelled = false;
    (async () => {
      for (const { key, from, to } of pairs) {
        if (cancelled) break;
        if (_driveCache.has(key)) {
          setDriveTimes(dt => ({ ...dt, [key]: _driveCache.get(key) }));
        } else {
          const t = await _driveTime(from, to);
          if (!cancelled) setDriveTimes(dt => ({ ...dt, [key]: t }));
          await new Promise(r => setTimeout(r, 200)); // gentle rate limiting
        }
      }
    })();
    return () => { cancelled = true; };
  }, [day.id, allItems.length]);

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
              {allItems.map((item, i) => item._type === 'catering' ? (() => {
                const mm = MEAL_META[item.meal_type] || MEAL_META.BREAKFAST;
                return (
                  <div key={item._key} className="ev">
                    <div className="ev-time" style={{ color: mm.color }}>{item.delivery_time ? fmtTime(item.delivery_time) : '—'}</div>
                    <div className="ev-body" style={{ borderLeft:`2px solid ${mm.color}`, background: `${mm.color}14` }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div className="ev-title" style={{ color: mm.color }}>{mm.emoji} {mm.label}</div>
                        {cateringDetail && (
                          <div style={{ textAlign:'right' }}>
                            {item.name && <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{item.name}</div>}
                            {cateringDetail === 'full' && item.address && <div style={{ fontSize:10, color:'var(--muted)' }}>{item.address}</div>}
                            {cateringDetail === 'full' && item.order_number && <div style={{ fontSize:10, color:'var(--muted)' }}>Order #{item.order_number}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })() : item._type === 'synthetic' ? (() => {
                const sm = SYNTHETIC_META_SHARE[item._key];
                const itemTags = Array.isArray(item.tags) ? item.tags : [];
                const isLunch = item._key === 'lt';
                return (
                  <div key={item._key} className="ev">
                    <div className="ev-time" style={{ color: sm.color }}>{fmtTime(item.startTime)}</div>
                    <div className="ev-body" style={{ borderLeft:`2px solid ${sm.color}`, background: sm.bg }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                        <div style={{ flex:1 }}>
                          <div className="ev-title" style={{ color: sm.color }}>{item.title}</div>
                          {item.notes && <div className="ev-detail">{item.notes}</div>}
                          {itemTags.length > 0 && (
                            <div className="ev-tags" style={{ marginTop:4 }}>
                              {itemTags.map(t => <span key={t} className={`etag ${t === 'VIDEO' ? 'etag-video' : 'etag-photo'}`}>{t === 'VIDEO' ? '🎬 Video' : '📷 Photo'}</span>)}
                            </div>
                          )}
                        </div>
                        {isLunch && lunchCatering && cateringDetail && (
                          <div style={{ textAlign:'right', marginLeft:8, flexShrink:0 }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{lunchCatering.name}</div>
                            {cateringDetail === 'full' && lunchCatering.address && <div style={{ fontSize:10, color:'var(--muted)' }}>{lunchCatering.address}</div>}
                            {cateringDetail === 'full' && lunchCatering.order_number && <div style={{ fontSize:10, color:'var(--muted)' }}>Order #{lunchCatering.order_number}</div>}
                            {cateringDetail === 'full' && lunchCatering.delivery_time && <div style={{ fontSize:10, color:'#4ade80' }}>🚚 {fmtTime(lunchCatering.delivery_time)}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })() : item._type === 'slbreak' ? (() => {
                return (
                  <div key={item._key} className="ev">
                    <div className="ev-time" style={{ color:'#fbbf24' }}>{item.start_time ? fmtTime(item.start_time) : '—'}</div>
                    <div className="ev-body" style={{ borderLeft:'2px solid #fbbf24', background:'rgba(251,191,36,0.07)' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                        <div className="ev-title" style={{ color:'#fbbf24' }}>☕ Break</div>
                        {item.end_time && <div style={{ fontSize:11, color:'var(--muted)', fontVariantNumeric:'tabular-nums' }}>Until {fmtTime(item.end_time)}</div>}
                      </div>
                    </div>
                  </div>
                );
              })() : item._type === 'scene' ? (() => {
                const st = SL_SCENE_STYLES_SHARE[item.scene_type] || SL_SCENE_STYLES_SHARE.interior;
                const wrapTime = slCalcWrapShare(item.est_start_time, item.shots || []);
                return (
                  <div key={item._key} className="ev" style={onOpenShotList ? { cursor:'pointer' } : undefined} onClick={() => onOpenShotList?.()}>
                    <div className="ev-time" style={{ color: st.color }}>{item.est_start_time}</div>
                    <div className="ev-body" style={{ borderLeft:`2px solid ${st.border}`, background: st.bg, padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1, flexWrap:'wrap' }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:8, minWidth:0 }}>
                            <span style={{ fontSize:10, fontWeight:800, color: st.color, background: st.badge, border:`1px solid ${st.border}`, borderRadius:4, padding:'2px 7px', whiteSpace:'nowrap', letterSpacing:'.08em', flexShrink:0 }}>
                              {st.label} · Scene {item.scene_number}
                            </span>
                            <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{item.name}</span>
                          </span>
                          {item.description && <span style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>· {item.description}</span>}
                          <span style={{ fontSize:11, fontWeight:600, color: st.color, background: st.badge, border:`1px solid ${st.border}`, borderRadius:100, padding:'1px 8px', whiteSpace:'nowrap', flexShrink:0 }}>
                            {(item.shots||[]).length} shots
                          </span>
                        </div>
                        <div style={{ textAlign:'right', flexShrink:0 }}>
                          {wrapTime && (
                            <>
                              <div style={{ fontSize:9, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em' }}>Est. Wrap</div>
                              <div style={{ fontSize:13, fontWeight:800, color: st.color, fontVariantNumeric:'tabular-nums' }}>{wrapTime}</div>
                            </>
                          )}
                          {onOpenShotList && <div style={{ fontSize:10, color: st.color, opacity:0.6, whiteSpace:'nowrap', marginTop:2 }}>→ Shot List</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })() : item._type === 'flight' ? (() => {
                const fs = flightStatus(item, now);
                const adjustedArrival = item._leg === 'arrive' ? (item.arrive_display || null) : null;
                return (
                  <div key={`f-${item.id}-${item._leg}`} className="ev">
                    <div className="ev-time">✈ {item._time}</div>
                    <div className="ev-body" style={{ borderLeft:`2px solid ${fs.alert ? fs.color : 'var(--orange)'}`, ...(fs.alert ? { background: `${fs.color}11` } : {}) }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {fs.alert && <span style={{ fontSize:14 }}>❗</span>}
                        <div className="ev-title" style={fs.alert ? { color: fs.color } : {}}>
                          {item._leg === 'depart' ? 'Departure' : 'Arrival'} — {item.crew_name || item.passenger_name}
                        </div>
                      </div>
                      <div className="ev-detail">
                        {item.origin} → {item.destination}
                        {(item.airline || item.flight_number) && <span style={{ color:'var(--muted)', marginLeft:8 }}>{[item.airline, item.flight_number].filter(Boolean).join(' ')}</span>}
                        {item.confirmation && <span style={{ color:'var(--muted)', marginLeft:8 }}>#{item.confirmation}</span>}
                        {adjustedArrival && <span style={{ color:'var(--muted)', marginLeft:8 }}>Arrives: {adjustedArrival}</span>}
                      </div>
                      {item._leg === 'depart' && !fs.cancelled && (
                        <div style={{ display:'inline-block', background:'rgba(0,0,0,0.25)', borderRadius:12, padding:'4px 12px', marginTop:6 }}>
                          <FlightStatusPill s={fs} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (() => {
                const loc = item.location;
                const prevLocItem = allItems.slice(0, i).reverse().find(x => x._type === 'event' && x.location?.address);
                const prevAddr = prevLocItem?.location?.address;
                const thisAddr = loc?.address;
                const driveKey = prevAddr && thisAddr && prevAddr !== thisAddr ? `${prevAddr}||${thisAddr}` : null;
                const driveTime = driveKey ? driveTimes[driveKey] : null;
                return (
                  <div key={item.id || i} className="ev">
                    <div className="ev-time">{fmtTime(item.start_time)}{item.end_time ? ` – ${fmtTime(item.end_time)}` : ''}</div>
                    <div className={`ev-body${item.is_alert ? ' warn' : ''}`} style={!item.is_alert ? { borderLeft:'2px solid var(--orange)', ...(item.is_filming ? { background:'linear-gradient(90deg, rgba(255,140,0,0.12) 0%, transparent 100%)', borderRadius:'0 6px 6px 0' } : {}) } : {}}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div className={`ev-title${item.is_alert ? ' alert' : ''}`} style={item.is_filming ? { color:'var(--orange)' } : {}}>{item.is_filming ? '🎬 ' : ''}{item.title}</div>
                          {item.detail && <div className="ev-detail">{item.detail}</div>}
                          {item.room_space && (
                            <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginTop:2 }}>
                              <span style={{ fontWeight:400, color:'var(--muted)', fontSize:11 }}>Room/Space: </span>{item.room_space}
                            </div>
                          )}
                        </div>
                        {loc && (
                          <div style={{ flexShrink:0, textAlign:'right', fontSize:11, color:'var(--muted)', maxWidth:160 }}>
                            <div style={{ fontWeight:600, color:'var(--text)', marginBottom:1 }}>{loc.name}</div>
                            <a href={directionsUrl('', loc.address)} target="_blank" rel="noopener noreferrer"
                               style={{ color:'#4a9eff', textDecoration:'none', fontSize:10, display:'block', marginBottom:driveTime ? 2 : 0 }}
                               onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`,'_blank'); e.preventDefault(); }}>
                              {loc.address}
                            </a>
                            {driveTime && (
                              <a href={directionsUrl(prevAddr, thisAddr)} target="_blank" rel="noopener noreferrer"
                                 style={{ color:'var(--muted)', textDecoration:'none', fontSize:10 }}>
                                🚗 {driveTime} from prev
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      {item.is_filming && crewAssignments && (
                        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
                          <button onClick={e => { e.stopPropagation(); setClapEvent(item); }}
                            style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,140,0,0.12)', border:'1px solid rgba(255,140,0,0.4)', borderRadius:6, padding:'2px 9px', fontSize:10, fontWeight:700, color:'var(--orange)', cursor:'pointer', letterSpacing:'.05em', textTransform:'uppercase' }}>
                            🎬 Slate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })())}
            </div>
          )}
          {clapEvent && (
        <Clapboard
          title={clapEvent.title}
          location={day.weather_location_name || projectCity || ''}
          date={day.date ? new Date(day.date).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }) : ''}
          fieldProducer={crewByPosition('field producer')}
          director={crewByPosition('director')}
          camera={crewByPosition('camera operator')}
          onClose={() => setClapEvent(null)}
        />
      )}
    </section>
  );
}

// ── Liquid Glass Sticky Header ───────────────────────────────────────────────
function GlassHeader({ project, showTime, clientMode, crewMode }) {
  const [navH, setNavH] = React.useState(64);
  const [visible, setVisible] = React.useState(false);
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const nav = document.querySelector('nav.nav');
    if (!nav) return;
    const ro = new ResizeObserver(() => setNavH(nav.getBoundingClientRect().height));
    ro.observe(nav);
    setNavH(nav.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  // Only pin once the hero title has scrolled out of view — otherwise the
  // bar doubles the title right on top of it
  React.useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 140);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: navH,
      left: 0,
      right: 0,
      zIndex: 90,
      pointerEvents: visible ? 'auto' : 'none',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(-8px)',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      backdropFilter: 'blur(5px) saturate(140%)',
      WebkitBackdropFilter: 'blur(5px) saturate(140%)',
      background: 'rgba(10,10,8,0.18)',
      maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
      padding: '12px 24px 22px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 20,
    }}>
      <div style={{ flexShrink:0 }}>
        {clientMode ? (
          project.client_logo
            ? <img src={project.client_logo} alt={project.client} style={{ height:28, maxWidth:140, objectFit:'contain', display:'block' }} />
            : <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.8)', letterSpacing:'0.02em' }}>{project.client}</div>
        ) : (
          <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:'0.14em', fontWeight:700 }}>{project.code}</div>
        )}
        {crewMode && (
          project.client_logo
            ? <img src={project.client_logo} alt={project.client} style={{ height:24, maxWidth:120, objectFit:'contain', display:'block', marginTop:3 }} />
            : <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.8)', letterSpacing:'0.02em', marginTop:2 }}>{project.client}</div>
        )}
        {showTime && (
          <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.8)', fontVariantNumeric:'tabular-nums', letterSpacing:'0.04em', marginTop:2 }}>
            {now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', second:'2-digit' })}
          </div>
        )}
      </div>
      <div style={{ textAlign:'right', marginLeft:'auto' }}>
        <div style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:18, letterSpacing:'-0.3px', color:'#fff', lineHeight:1 }}>{project.title}</div>
        {(clientMode || crewMode) && (
          <div style={{ fontFamily:"'DM Sans', sans-serif", fontSize:11, fontWeight:500, color:'rgba(255,255,255,0.75)', marginTop:4, letterSpacing:'0.01em' }}>
            {fmt(project.start_date)} – {fmt(project.end_date)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scripts View ─────────────────────────────────────────────────────────────
function ScriptsShareView({ scripts, shareToken, pw }) {
  const base = `${window.location.origin}/api/share/${shareToken}`;
  return (
    <div className="share-view">
      <div className="share-header" style={{ paddingBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:700, letterSpacing:'-0.01em' }}>Scripts</div>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Tap a script to view or download it.</div>
      </div>
      {(scripts || []).map(sc => (
        <a key={sc.id}
          href={`${base}/scripts/${sc.id}/file${pw ? `?pw=${encodeURIComponent(pw)}` : ''}`}
          target="_blank" rel="noreferrer"
          style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:10, textDecoration:'none', color:'var(--text)' }}>
          <span style={{ fontSize:20 }}>📄</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700 }}>{sc.name}</div>
            {sc.file_name && <div style={{ fontSize:11, color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sc.file_name}</div>}
          </div>
          <span style={{ marginLeft:'auto', color:'var(--muted)', fontSize:14 }}>›</span>
        </a>
      ))}
      {(!scripts || scripts.length === 0) && <div className="empty">No scripts uploaded yet.</div>}
    </div>
  );
}

// ── Main Share Page ──────────────────────────────────────────────────────────
export default function Share() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const isPdf = searchParams.get('pdf') === '1';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const initialPage = searchParams.get('tab') || 'callsheet';
  const [sharePage, setSharePage] = useState(initialPage);
  const [resolvedPw, setResolvedPw] = useState(null);

  async function fetchShare(pw) {
    try {
      const d = await api.getPublicShare(token, pw || undefined);
      if (d._status === 401 && d.passwordRequired) {
        setPasswordRequired(true);
        if (pw) setPwError('Incorrect password. Please try again.');
      } else if (d.error) {
        setError(d.error);
      } else {
        setPasswordRequired(false);
        setPwError('');
        setData(d);
        if (pw) setResolvedPw(pw);
      }
    } catch { setError('Failed to load share'); }
  }

  useEffect(() => { fetchShare(null); }, [token]);

  useEffect(() => {
    if (isPdf && data) {
      setTimeout(() => window.print(), 400);
    }
  }, [isPdf, data]);

  async function submitPassword(e) {
    e.preventDefault();
    setPwLoading(true);
    await fetchShare(pwInput);
    setPwLoading(false);
  }

  if (passwordRequired && !data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)', color:'var(--text)', padding:16 }}>
      <div style={{ background:'rgba(232,80,10,0.80)', border:'1px solid rgba(255,255,255,0.35)', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.25), inset -1px 0 0 rgba(0,0,0,0.4), 0 3px 10px rgba(0,0,0,0.5)', borderRadius:12, padding:'36px 40px', width:'100%', maxWidth:320, textAlign:'center' }}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, marginBottom:20 }}>
          <div className="logo" style={{ justifyContent:'center', color:'#fff' }}>Free<em style={{ color:'#fff' }}>Pro</em></div>
          <span style={{ fontSize:9, color:'rgba(255,255,255,0.6)', letterSpacing:'0.06em' }}>Powered by Unbridled Media</span>
        </div>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:6, color:'#fff' }}>Password Required</div>
        <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginBottom:20 }}>This view is password protected.</div>
        <form onSubmit={submitPassword}>
          <input
            type="password"
            value={pwInput}
            onChange={e => { setPwInput(e.target.value.replace(/[^a-zA-Z0-9]/g, '')); setPwError(''); }}
            placeholder="Enter password"
            autoFocus
            style={{ width:'100%', boxSizing:'border-box', marginBottom:10, textAlign:'center', letterSpacing:'0.1em' }}
          />
          {pwError && <div style={{ fontSize:12, color:'#ef4444', marginBottom:8 }}>{pwError}</div>}
          <button className="btn btn-primary" style={{ width:'100%' }} disabled={pwLoading}>
            {pwLoading ? 'Checking…' : 'View'}
          </button>
        </form>
      </div>
    </div>
  );

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

  const hasQuestions = view_type === 'producer' || view_type === 'crew';
  const hasGearTab = view_type === 'producer' || view_type === 'crew';
  const hasShotList = (view_type === 'producer' || view_type === 'crew' || view_type === 'client') && !!data.project.show_shot_list;
  const hasScripts = (view_type === 'producer' || view_type === 'crew' || view_type === 'client') && !!data.project.show_scripts && (data.scripts || []).length > 0;

  return (
    <>
      {(view_type === 'producer' || view_type === 'crew' || view_type === 'client' || view_type === 'talent') && (
        <GlassHeader project={data.project} showTime={sharePage === 'shot-list'} clientMode={view_type === 'client'} crewMode={view_type === 'crew' || view_type === 'talent'} />
      )}
      <nav className="nav" style={{ justifyContent:'space-between', flexWrap:'wrap', rowGap:6 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <div className="logo">Free<em>Pro</em></div>
          <span style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.06em', paddingLeft:1 }}>Powered by Unbridled Media</span>
        </div>
        {(view_type === 'producer' || view_type === 'crew' || view_type === 'client') && (
          <span style={{ marginLeft:'auto', fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:600 }}>
            {view_type === 'producer' ? 'Producer View' : view_type === 'crew' ? 'Crew View' : 'Client View'}
          </span>
        )}
        {(hasQuestions || ((hasShotList || hasScripts) && view_type === 'client')) ? (
          <div className="tabs" style={{ flexBasis:'100%', display:'flex', alignItems:'center' }}>
            <button className={`tab${sharePage === 'callsheet' ? ' on' : ''}`} onClick={() => setSharePage('callsheet')}>Call Sheet</button>
            {hasGearTab && <button className={`tab${sharePage === 'gear' ? ' on' : ''}`} onClick={() => setSharePage('gear')}>Gear</button>}
            {hasShotList && <button className={`tab${sharePage === 'shot-list' ? ' on' : ''}`} onClick={() => setSharePage('shot-list')}>Shot List</button>}
            {hasScripts && <button className={`tab${sharePage === 'scripts' ? ' on' : ''}`} onClick={() => setSharePage('scripts')}>Script</button>}
            {hasQuestions && <button className={`tab${sharePage === 'questions' ? ' on' : ''}`} onClick={() => setSharePage('questions')}>Questions</button>}
            <button
              onClick={() => window.print()}
              style={{ marginLeft:'auto', background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--tan)', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}
            >PDF</button>
          </div>
        ) : (
          <>
            {view_type === 'talent' && (
              <div style={{ fontSize:11, color:'#fff', textTransform:'uppercase', letterSpacing:'.08em', border:'1px solid rgba(255,255,255,0.6)', borderRadius:6, padding:'4px 10px' }}>
                {data.talent_name} — Talent
              </div>
            )}
            <button
              onClick={() => window.print()}
              style={{ background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--tan)', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}
            >PDF</button>
          </>
        )}
      </nav>
      <div className="wrap">
        {hasQuestions && sharePage === 'questions' ? (
          <QuestionsView shareToken={token} pw={resolvedPw} canAnswer={view_type === 'producer'} project={data.project} />
        ) : hasScripts && sharePage === 'scripts' ? (
          <ScriptsShareView scripts={data.scripts} shareToken={token} pw={resolvedPw} />
        ) : hasGearTab && sharePage === 'gear' ? (
          <GearSection
            gear={data.gear}
            onlineRentals={data.onlineRentals || []}
            producerView={view_type === 'producer'}
            shareToken={token}
          />
        ) : hasShotList && sharePage === 'shot-list' ? (
          <ShotListShareView scenes={data.shotList || []} days={data.slDays || []} breaks={data.slBreaks || []} shareToken={token} talent={[...(data.keyTalent||[]), ...(data.crewAssignments||[]).filter(a=>a.crewMember).map(a=>({name: a.crewMember.first_name ? `${a.crewMember.first_name} ${a.crewMember.last_name||''}`.trim() : a.crewMember.name || ''}))] .filter(t=>t.name)} />
        ) : (
          <>
            {view_type === 'producer' && <ProducerView data={data} hideGear onOpenShotList={data.project.show_shot_list ? () => setSharePage('shot-list') : null} />}
            {view_type === 'crew'     && <CrewView     data={data} shareToken={token} hideGear onOpenShotList={data.project.show_shot_list ? () => setSharePage('shot-list') : null} />}
            {view_type === 'client'   && <ClientView   data={data} onOpenShotList={data.project.show_shot_list ? () => setSharePage('shot-list') : null} />}
            {view_type === 'talent'   && <TalentView   data={data} />}
          </>
        )}
      </div>
    </>
  );
}
