import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';

function fmt(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Producer View ────────────────────────────────────────────────────────────
function ProducerView({ data }) {
  const { project, locations, techSpecs, clientContacts, keyTalent, crewAssignments, schedule } = data;
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

      {techSpecs && (
        <section className="share-section">
          <div className="sec-lbl">Tech Specs</div>
          <div className="chips">
            {techSpecs.aspect_ratio && <div className="chip"><strong>Ratio</strong>{techSpecs.aspect_ratio}</div>}
            {techSpecs.resolution && <div className="chip"><strong>Resolution</strong>{techSpecs.resolution}</div>}
            {techSpecs.cameras && <div className="chip"><strong>Cameras</strong>{techSpecs.cameras}</div>}
          </div>
        </section>
      )}

      {locations.length > 0 && (
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

      {clientContacts.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Client Contacts</div>
          <ShareTable cols={['Name','Title','Email','Phone']} rows={clientContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}

      {keyTalent.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Key Talent</div>
          <ShareTable cols={['Name','Role','Notes']} rows={keyTalent.map(t => [t.name, t.role, t.notes||''])} />
        </section>
      )}

      {crewAssignments.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Crew</div>
          <ShareTable cols={['Position','Name','Email','Phone']} rows={crewAssignments.map(a => [a.position.name, a.crewMember?.name||'TBD', a.crewMember?.email||'—', a.crewMember?.phone||'—'])} />
        </section>
      )}

      {schedule.map(day => (
        <DaySection key={day.id} day={day} showCalls />
      ))}
    </div>
  );
}

// ── Crew View ────────────────────────────────────────────────────────────────
function CrewView({ data }) {
  const { project, locations, techSpecs, crewAssignments, schedule } = data;
  return (
    <div className="share-view">
      <div className="share-header">
        <div className="proj-code">{project.code}</div>
        <div className="proj-title">{project.title}</div>
        <div className="proj-meta" style={{ marginTop: 6 }}>
          <span className="meta">{project.city}, {project.state}</span>
          <span className="meta">{fmt(project.start_date)} – {fmt(project.end_date)}</span>
        </div>
      </div>
      {techSpecs && (
        <section className="share-section">
          <div className="sec-lbl">Tech Specs</div>
          <div className="chips">
            {techSpecs.aspect_ratio && <div className="chip"><strong>Ratio</strong>{techSpecs.aspect_ratio}</div>}
            {techSpecs.resolution && <div className="chip"><strong>Resolution</strong>{techSpecs.resolution}</div>}
            {techSpecs.cameras && <div className="chip"><strong>Cameras</strong>{techSpecs.cameras}</div>}
          </div>
        </section>
      )}
      {locations.length > 0 && (
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
      {crewAssignments?.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Crew</div>
          <ShareTable cols={['Position','Name','Phone']} rows={crewAssignments.map(a => [a.position.name, a.crewMember?.name||'TBD', a.crewMember?.phone||'—'])} />
        </section>
      )}
      {schedule.map(day => (
        <DaySection key={day.id} day={day} showCalls />
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
      {locations.length > 0 && (
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
      {clientContacts.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Client Contacts</div>
          <ShareTable cols={['Name','Title','Email','Phone']} rows={clientContacts.map(c => [c.name, c.title, c.email||'—', c.phone||'—'])} />
        </section>
      )}
      {keyTalent.length > 0 && (
        <section className="share-section">
          <div className="sec-lbl">Key Talent</div>
          <ShareTable cols={['Name','Role']} rows={keyTalent.map(t => [t.name, t.role])} />
        </section>
      )}
      {schedule.map(day => (
        <DaySection key={day.id} day={day} showCalls={false} />
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

function DaySection({ day, showCalls }) {
  return (
    <section className="share-section">
      <div className="sec-lbl">Day {day.day_number} — {new Date(day.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}</div>
      {day.events.length > 0 && (
        <div className="tl" style={{ marginBottom: 10 }}>
          {day.events.map(e => (
            <div key={e.id} className="ev">
              <div className="ev-time">{e.start_time}{e.end_time ? ` – ${e.end_time}` : ''}</div>
              <div className={`ev-body${e.is_alert ? ' warn' : ''}`}>
                <div className={`ev-title${e.is_alert ? ' alert' : ''}`}>{e.title}</div>
                {e.detail && <div className="ev-detail">{e.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showCalls && day.crewCalls.length > 0 && (
        <ShareTable
          cols={['Position','Name','Call','Wrap']}
          rows={day.crewCalls.map(c => [c.crewAssignment.position.name, c.crewAssignment.crewMember?.name||'TBD', c.call_time||'—', c.wrap_time||'—'])}
        />
      )}
    </section>
  );
}

// ── Main Share Page ──────────────────────────────────────────────────────────
export default function Share() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getPublicShare(token).then(d => {
      if (d.error) setError(d.error);
      else setData(d);
    }).catch(() => setError('Failed to load share'));
  }, [token]);

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
        <div className="logo">Free<em>-Pro</em></div>
        <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>
          {view_type === 'talent' ? `${data.talent_name} — Talent` : `${view_type.charAt(0).toUpperCase() + view_type.slice(1)} View`}
        </div>
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
