import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

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

function mapsUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
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
          {hotelBlocks.map(hb => (
            <div key={hb.id} style={{ marginBottom:12 }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>
                🏨 {hb.name}
                {hb.address && <> — <a href={mapsUrl(hb.address)} target="_blank" rel="noreferrer" style={{ color:'var(--tan)', textDecoration:'underline', fontWeight:400, fontSize:12 }}>{hb.address}</a></>}
                {hb.phone ? <span style={{ color:'var(--muted)', fontWeight:400, fontSize:12 }}> · {hb.phone}</span> : ''}
              </div>
              {hb.guests?.length > 0 && (
                <ShareTable
                  cols={['Guest','Check-in','Check-out','Confirmation']}
                  rows={hb.guests.map(g => [g.guest_name, fmtDT(g.check_in), fmtDT(g.check_out), g.confirmation || '—'])}
                />
              )}
            </div>
          ))}
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
          <ShareTable cols={['Position','Name','Email','Phone']} rows={crewAssignments.map(a => [a.position.name, a.crewMember?.name||'TBD', a.crewMember?.email||'—', a.crewMember?.phone||'—'])} />
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
      {[...(schedule||[])].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((day, i) => (
        <DaySection key={day.id} day={day} showCalls flights={flights} dayIndex={i} />
      ))}
    </div>
  );
}

// ── Crew View ────────────────────────────────────────────────────────────────
function CrewView({ data }) {
  const { project, locations, techSpecs, clientContacts, keyTalent, crewAssignments, schedule, flights, hotelBlocks, rentalCars, deliverables, gear } = data;
  const sortedSchedule = [...(schedule || [])].sort((a,b) => (a.date||'').localeCompare(b.date||''));
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
          {hotelBlocks.map(hb => (
            <div key={hb.id} style={{ marginBottom:12 }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:4 }}>
                🏨 {hb.name}
                {hb.address && <> — <a href={mapsUrl(hb.address)} target="_blank" rel="noreferrer" style={{ color:'var(--tan)', textDecoration:'underline', fontWeight:400, fontSize:12 }}>{hb.address}</a></>}
                {hb.phone ? <span style={{ color:'var(--muted)', fontWeight:400, fontSize:12 }}> · {hb.phone}</span> : ''}
              </div>
              {hb.guests?.length > 0 && (
                <ShareTable
                  cols={['Guest','Check-in','Check-out','Confirmation']}
                  rows={hb.guests.map(g => [shortName(g.guest_name), fmtDT(g.check_in), fmtDT(g.check_out), g.confirmation || '—'])}
                />
              )}
            </div>
          ))}
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
          <ShareTable cols={['Position','Name','Email','Phone']} rows={crewAssignments.map(a => [a.position.name, shortName(a.crewMember?.name)||'TBD', a.crewMember?.email||'—', a.crewMember?.phone||'—'])} />
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

      {sortedSchedule.map((day, i) => (
        <DaySection key={day.id} day={day} showCalls flights={flights} dayIndex={i} />
      ))}
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
              {day.call_time && <span><strong>Call:</strong> {day.call_time}</span>}
              {day.wrap_time && <span><strong>Wrap:</strong> {day.wrap_time}</span>}
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
                      <tr key={t.id}><td>{t.name}</td><td>{t.role}</td><td>{callEntry?.call_time || day.call_time || '—'}</td></tr>
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
                        <td>{a.crewMember?.name || 'TBD'}</td>
                        <td>{a.crewMember?.phone || '—'}</td>
                        <td>{call?.call_time || '—'}</td>
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
                    <tr key={e.id}><td>{e.start_time}{e.end_time ? ` – ${e.end_time}` : ''}</td><td>{e.title}</td><td>{e.detail||''}</td></tr>
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

  return (
    <section className="share-section">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="sec-lbl" style={{ margin:0 }}>Day {dayIndex != null ? dayIndex + 1 : day.day_number} — {new Date(day.date.slice ? day.date.slice(0,10) + 'T12:00:00' : day.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</div>
        {allItems.length > 0 && (
          <button onClick={() => setOpen(o => !o)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:11, cursor:'pointer', padding:0 }}>
            {open ? 'Collapse' : `Show (${allItems.length})`}
          </button>
        )}
      </div>

      {(day.call_time || day.wrap_time) && (
        <div style={{ fontSize:11, color:'var(--tan)', marginTop:4 }}>
          {day.call_time && <span>Call: <strong>{day.call_time}</strong></span>}
          {day.call_time && day.wrap_time && <span style={{ margin:'0 8px', color:'var(--muted)' }}>·</span>}
          {day.wrap_time && <span>Wrap: <strong>{day.wrap_time}</strong></span>}
        </div>
      )}

      {showCalls && day.crewCalls?.length > 0 && (
        <div style={{ marginTop:8 }}>
          <ShareTable
            cols={['Position','Name','Call','Wrap']}
            rows={day.crewCalls.map(c => [c.crewAssignment.position.name, c.crewAssignment.crewMember?.name||'TBD', c.call_time||'—', c.wrap_time||'—'])}
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
                  <div className="ev-time">{item.start_time}{item.end_time ? ` – ${item.end_time}` : ''}</div>
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
