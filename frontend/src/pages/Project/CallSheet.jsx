import React, { useEffect, useState } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { api } from '../../api.js';

// A traditional one-page-per-shoot-day call sheet, print-ready.
// Data comes from the project bundle (locations, talent, crew, tech specs) and
// the schedule (per-day call times, weather, crew calls, and the run of show).
const crewName = a => [a.cm_pref_first, a.cm_pref_last].filter(Boolean).join(' ').trim() || a.cm_name || a.name || '';
const fmtLongDate = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
const LOC_LABELS = { PRIMARY_VENUE: 'Shooting Location', CREW_HOTEL: 'Hotel', SECONDARY: 'Location', AIRPORT: 'Airport', OTHER: 'Location' };
// Addresses often lead with the venue name we already show in the row — strip it
// so the address stays tight (e.g. "Manchester Grand Hyatt San Diego, 1, Market…").
const stripName = (addr, name) => {
  if (!addr) return '';
  if (!name) return addr;
  const esc = String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(addr).replace(new RegExp('^\\s*' + esc + '\\s*,?\\s*', 'i'), '').trim() || String(addr);
};

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

function DaySheet({ project, techSpecs, locations, keyTalent, clientContacts, crew, day, dayIndex, dayCount, isFirst, isLast, nameById }) {
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
    <div style={{ maxWidth: 900, margin: '0 auto 26px', paddingTop: isFirst ? 0 : '0.4in', pageBreakAfter: isLast ? 'auto' : 'always' }}>
      {/* ── Header: general info (left) · timing (middle) · weather (right) ── */}
      <div style={{ ...box, borderTop: '3px solid var(--orange)', padding: '11px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--orange)' }}>Shoot Day {dayIndex + 1} of {dayCount}</div>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.12, margin: '1px 0' }}>{project.title}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{project.code}{project.client ? ` · ${project.client}` : ''}</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 2 }}>{fmtLongDate(day.date)}</div>
          {specBits.length > 0 && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3 }}><b style={{ color: 'var(--tan)' }}>Tech Specs:</b> {specBits.join(' · ')}</div>}
        </div>
        <div style={{ flex: '0 0 auto', width: 150 }}>
          {time('Crew Call', day.call_time)}
          {time('Shooting Call', day.shooting_call_time)}
          {time('Lunch', day.lunch_time)}
          {time('Wrap', day.wrap_time)}
        </div>
        {weatherBits.length > 0 && (
          <div style={{ flex: '0 0 auto', width: 138, fontSize: 10, color: 'var(--muted)' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tan)', marginBottom: 2 }}>Weather</div>
            {weatherBits.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
      </div>

      {/* ── Locations (type + arrival + nearest hospital folded under the name) ── */}
      {locations.length > 0 && <>
        <div style={sectionLbl}>Locations</div>
        <SimpleTable
          cols={[
            { key: 'name', label: 'Location', width: '42%', render: l => (
              <div>
                <div style={{ fontWeight: 700 }}>{l.name}</div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginTop: 1 }}>{LOC_LABELS[l.type] || 'Location'}</div>
                {l.arrival_notes && <div style={{ fontSize: 10, marginTop: 3 }}><span style={{ fontWeight: 700 }}>Arrival: </span>{l.arrival_notes}</div>}
                {l.type === 'PRIMARY_VENUE' && l.notes && (
                  <div style={{ fontSize: 10, marginTop: 2 }}>
                    <span style={{ fontWeight: 700 }}>🏥 Nearest Hospital: </span>{String(l.notes).replace(/^Nearest Hospital:\s*/i, '')}
                  </div>
                )}
              </div>
            ) },
            { key: 'address', label: 'Address', render: l => stripName(l.address, l.name) },
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [printScope, setPrintScope] = useState(null); // null | 'all' | a day id

  useEffect(() => {
    Promise.all([api.getProject(id), api.getSchedule(id)])
      .then(([p, d]) => { setProject(p); setDays(d); })
      .catch(e => setErr(e.message));
  }, [id]);

  // ?pdf=1 opens straight into the print dialog for the whole call sheet.
  useEffect(() => {
    if (!isPdf || !project || !days) return;
    const prev = document.title;
    document.title = `${project.code || ''} Call Sheet`.trim();
    const t = setTimeout(() => window.print(), 700);
    return () => { clearTimeout(t); document.title = prev; };
  }, [isPdf, project, days]);

  // Dropdown-triggered print — all days or a single day. printScope filters the
  // rendered pages, then we fire the print dialog and reset once it closes.
  useEffect(() => {
    if (!printScope) return;
    const done = () => setPrintScope(null);
    window.addEventListener('afterprint', done);
    const t = setTimeout(() => window.print(), 150);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printScope]);

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
  // When a single day is chosen from the download menu, render just that page.
  const printSheets = printScope && printScope !== 'all' ? sheetDays.filter(d => d.id === printScope) : sheetDays;

  const menuItem = { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, padding: '9px 14px', cursor: 'pointer', whiteSpace: 'nowrap' };
  const hoverOn = e => { e.currentTarget.style.background = 'var(--bg3)'; };
  const hoverOff = e => { e.currentTarget.style.background = 'none'; };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', gap: 10, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Call Sheet — {project.code} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{project.title}</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(o => !o)} className="btn btn-primary btn-sm">📄 Download PDF ▾</button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, minWidth: 250, boxShadow: '0 10px 28px rgba(0,0,0,0.35)', overflow: 'hidden', maxHeight: 380, overflowY: 'auto' }}>
                  <button style={{ ...menuItem, fontWeight: 700, borderBottom: '1px solid var(--border)' }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                    onClick={() => { setMenuOpen(false); setPrintScope('all'); }}>
                    All days ({sheetDays.length})
                  </button>
                  {sheetDays.map((d, i) => (
                    <button key={d.id} style={menuItem} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                      onClick={() => { setMenuOpen(false); setPrintScope(d.id); }}>
                      Day {i + 1} — {fmtLongDate(d.date)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Link to={`/projects/${id}`} className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Back to Project</Link>
        </div>
      </div>
      <div className="callsheet-print" style={{ padding: '18px 16px 60px' }}>
        {sheetDays.length === 0 && <div className="empty">No shoot days with call times or a schedule yet — fill those in on the Schedule tab.</div>}
        {printSheets.map((day, i) => {
          const origIndex = sheetDays.findIndex(d => d.id === day.id);
          return (
            <DaySheet key={day.id} project={project} techSpecs={project.techSpecs} locations={locations}
              keyTalent={keyTalent} clientContacts={clientContacts} crew={crew}
              day={day} dayIndex={origIndex} dayCount={sheetDays.length}
              isFirst={i === 0} isLast={i === printSheets.length - 1} nameById={nameById} />
          );
        })}
      </div>
    </div>
  );
}
