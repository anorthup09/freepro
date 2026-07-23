import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { api } from '../../api.js';

// A traditional one-page-per-shoot-day call sheet, print-ready (Save as PDF).
// Data comes from the project bundle (locations, talent, crew, tech specs) and
// the schedule (per-day call times, weather, crew calls, and the run of show).
const crewName = a => [a.cm_pref_first, a.cm_pref_last].filter(Boolean).join(' ').trim() || a.cm_name || a.name || '';
const fmtLongDate = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
const LOC_LABELS = { PRIMARY_VENUE: 'Shooting Location', CREW_HOTEL: 'Hotel', SECONDARY: 'Location', AIRPORT: 'Airport', OTHER: 'Location' };

const box = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8 };
const th = { textAlign: 'left', fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', padding: '5px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { fontSize: 11, padding: '5px 8px', borderBottom: '1px solid rgba(128,128,128,0.18)', verticalAlign: 'top' };
const sectionLbl = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tan)', margin: '14px 0 5px' };

function SimpleTable({ cols, rows }) {
  if (!rows.length) return null;
  return (
    <div style={{ ...box, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{cols.map(c => <th key={c.key} style={{ ...th, width: c.width }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map(c => <td key={c.key} style={td}>{c.render ? c.render(r) : (r[c.key] || '')}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DaySheet({ project, techSpecs, locations, keyTalent, clientContacts, crew, day, dayIndex, dayCount, nameById }) {
  const time = (label, val) => val ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, padding: '2px 0' }}>
      <span style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 9.5, fontWeight: 700 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{val}</span>
    </div>
  ) : null;
  const callFor = a => (day.crewCalls || []).find(c => c.crew_assignment_id === a.id)?.call_time || day.call_time || '';
  const weatherBits = [
    day.weather_condition,
    (day.weather_high != null || day.weather_low != null) ? `High ${day.weather_high ?? '—'}° / Low ${day.weather_low ?? '—'}°` : null,
    day.weather_sunrise ? `Sunrise ${day.weather_sunrise}` : null,
    day.weather_sunset ? `Sunset ${day.weather_sunset}` : null,
  ].filter(Boolean);
  const specBits = [
    techSpecs?.aspect_ratio, techSpecs?.resolution, techSpecs?.frame_rate ? `${techSpecs.frame_rate} fps` : null,
  ].filter(Boolean);
  const events = [...(day.events || [])].sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto 26px', pageBreakAfter: dayIndex < dayCount - 1 ? 'always' : 'auto' }}>
      {/* ── Header ── */}
      <div style={{ ...box, borderTop: '3px solid var(--orange)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 240 }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--orange)' }}>Shoot Day {dayIndex + 1} of {dayCount}</div>
          <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.15, margin: '2px 0' }}>{project.title}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{project.code}{project.client ? ` · ${project.client}` : ''}</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>{fmtLongDate(day.date)}</div>
          {specBits.length > 0 && <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 6 }}><b style={{ color: 'var(--tan)' }}>Tech Specs:</b> {specBits.join(' · ')}</div>}
        </div>
        <div style={{ minWidth: 180 }}>
          {time('Crew Call', day.call_time)}
          {time('Shooting Call', day.shooting_call_time)}
          {time('Lunch', day.lunch_time)}
          {time('Wrap', day.wrap_time)}
        </div>
        {weatherBits.length > 0 && (
          <div style={{ minWidth: 150, fontSize: 10.5, color: 'var(--muted)' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tan)', marginBottom: 3 }}>Weather</div>
            {weatherBits.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
      </div>

      {/* ── Locations (with nearest hospital in notes) ── */}
      {locations.length > 0 && <>
        <div style={sectionLbl}>Locations</div>
        <SimpleTable
          cols={[
            { key: 'name', label: 'Location', width: '26%', render: l => <span style={{ fontWeight: 700 }}>{LOC_LABELS[l.type] ? `${l.name}` : l.name}</span> },
            { key: 'type', label: 'Type', width: '14%', render: l => LOC_LABELS[l.type] || 'Location' },
            { key: 'address', label: 'Address', width: '30%' },
            { key: 'notes', label: 'Notes', render: l => (
              <>
                {l.arrival_notes && <div><span style={{ fontWeight: 700 }}>Arrival: </span>{l.arrival_notes}</div>}
                {l.type === 'PRIMARY_VENUE' && l.notes && (
                  <div style={{ marginTop: l.arrival_notes ? 3 : 0 }}>
                    <span style={{ fontWeight: 700 }}>🏥 Nearest Hospital: </span>{String(l.notes).replace(/^Nearest Hospital:\s*/i, '')}
                  </div>
                )}
              </>
            ) },
          ]}
          rows={locations}
        />
      </>}

      {/* ── Talent ── */}
      {keyTalent.length > 0 && <>
        <div style={sectionLbl}>Talent</div>
        <SimpleTable
          cols={[
            { key: 'name', label: 'Name', width: '24%', render: t => <span style={{ fontWeight: 700 }}>{t.name}</span> },
            { key: 'role', label: 'Title / Role', width: '26%' },
            { key: 'call_time', label: 'Call', width: '12%' },
            { key: 'phone', label: 'Phone', width: '18%' },
            { key: 'email', label: 'Email' },
          ]}
          rows={keyTalent}
        />
      </>}

      {/* ── Client ── */}
      {clientContacts.length > 0 && <>
        <div style={sectionLbl}>Client</div>
        <SimpleTable
          cols={[
            { key: 'name', label: 'Name', width: '26%', render: c => <span style={{ fontWeight: 700 }}>{c.name}</span> },
            { key: 'title', label: 'Title', width: '28%' },
            { key: 'phone', label: 'Phone', width: '18%' },
            { key: 'email', label: 'Email' },
          ]}
          rows={clientContacts}
        />
      </>}

      {/* ── Production Crew ── */}
      {crew.length > 0 && <>
        <div style={sectionLbl}>Production Crew</div>
        <SimpleTable
          cols={[
            { key: 'position_name', label: 'Title', width: '24%' },
            { key: 'name', label: 'Name', width: '22%', render: a => <span style={{ fontWeight: 700 }}>{crewName(a)}</span> },
            { key: 'call', label: 'Call', width: '10%', render: a => callFor(a) },
            { key: 'cm_phone', label: 'Phone', width: '18%' },
            { key: 'cm_email', label: 'Email' },
          ]}
          rows={crew}
        />
      </>}

      {/* ── Run of Show ── */}
      {events.length > 0 && <>
        <div style={sectionLbl}>Schedule</div>
        <SimpleTable
          cols={[
            { key: 'time', label: 'Time', width: '16%', render: e => [e.start_time, e.end_time].filter(Boolean).join(' – ') },
            { key: 'title', label: 'Event', width: '30%', render: e => <span style={{ fontWeight: 700 }}>{e.title}</span> },
            { key: 'detail', label: 'Notes', width: '34%' },
            { key: 'crew', label: 'Crew', render: e => (e.crew_ids || []).map(cid => nameById[cid]).filter(Boolean).join(', ') },
          ]}
          rows={events}
        />
      </>}
    </div>
  );
}

export default function CallSheet() {
  const { id } = useParams();
  const isPdf = new URLSearchParams(useLocation().search).get('pdf') === '1';
  const [project, setProject] = useState(null);
  const [days, setDays] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([api.getProject(id), api.getSchedule(id)])
      .then(([p, d]) => { setProject(p); setDays(d); })
      .catch(e => setErr(e.message));
  }, [id]);

  useEffect(() => {
    if (!isPdf || !project || !days) return;
    const prev = document.title;
    document.title = `${project.code || ''} Call Sheet`.trim();
    const t = setTimeout(() => window.print(), 700);
    return () => { clearTimeout(t); document.title = prev; };
  }, [isPdf, project, days]);

  if (err) return <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}><div className="empty">{err}</div></div>;
  if (!project || !days) return <div style={{ minHeight: '100vh', background: 'var(--bg)' }}><div className="empty">Loading…</div></div>;

  const locations = project.locations || [];
  const keyTalent = project.keyTalent || [];
  const clientContacts = project.clientContacts || [];
  const crew = (project.crewAssignments || []).filter(a => crewName(a));
  const nameById = {};
  for (const a of crew) if (a.cm_id) nameById[a.cm_id] = crewName(a);
  // Only days that actually carry call-sheet content get a page.
  const sheetDays = days.filter(d => d.call_time || d.shooting_call_time || d.wrap_time || (d.events || []).length || (d.crewCalls || []).length);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', gap: 10, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Call Sheet — {project.code} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{project.title}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} className="btn btn-primary btn-sm">📄 Save as PDF</button>
          <Link to={`/projects/${id}`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Back to Project</Link>
        </div>
      </div>
      <div style={{ padding: '18px 16px 60px' }}>
        {sheetDays.length === 0 && <div className="empty">No shoot days with call times or a schedule yet — fill those in on the Schedule tab.</div>}
        {sheetDays.map((day, i) => (
          <DaySheet key={day.id} project={project} techSpecs={project.techSpecs} locations={locations}
            keyTalent={keyTalent} clientContacts={clientContacts} crew={crew}
            day={day} dayIndex={i} dayCount={sheetDays.length} nameById={nameById} />
        ))}
      </div>
    </div>
  );
}
