import React, { useEffect, useRef, useState } from 'react';
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
const sectionLbl = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--tan)' };

// ── Column definitions per section ─────────────────────────────────────────────
// Each section owns an ordered list of columns (key + label + default width).
// The render function for each column lives in DaySheet (needs day context), so
// these defs stay data-only and are matched by `key`. Users can hide, reorder,
// and re-width columns; the config is persisted per-project on `callsheet_columns`.
const SECTION_DEFS = {
  locations: { label: 'Locations', cols: [
    { key: 'name', label: 'Location', width: '42%' },
    { key: 'address', label: 'Address', width: '58%' },
  ] },
  talent: { label: 'Talent', cols: [
    { key: 'name', label: 'Name', width: '24%' },
    { key: 'role', label: 'Title / Role', width: '26%' },
    { key: 'call_time', label: 'Call', width: '12%' },
    { key: 'phone', label: 'Phone', width: '18%' },
    { key: 'email', label: 'Email', width: '20%' },
  ] },
  client: { label: 'Client', cols: [
    { key: 'name', label: 'Name', width: '26%' },
    { key: 'title', label: 'Title', width: '28%' },
    { key: 'phone', label: 'Phone', width: '18%' },
    { key: 'email', label: 'Email', width: '28%' },
  ] },
  crew: { label: 'Production Crew', cols: [
    { key: 'position_name', label: 'Title', width: '24%' },
    { key: 'name', label: 'Name', width: '22%' },
    { key: 'call', label: 'Call', width: '10%' },
    { key: 'cm_phone', label: 'Phone', width: '18%' },
    { key: 'cm_email', label: 'Email', width: '26%' },
  ] },
  schedule: { label: 'Schedule', cols: [
    { key: 'time', label: 'Time', width: '16%' },
    { key: 'title', label: 'Event', width: '30%' },
    { key: 'detail', label: 'Notes', width: '34%' },
    { key: 'crew', label: 'Crew', width: '20%' },
  ] },
};

// Merge a saved config against the current defs: keep saved order/width/visibility
// for known columns, drop unknown keys, and append any newly-added defs.
function normalizeCfg(saved) {
  const out = {};
  for (const [sid, def] of Object.entries(SECTION_DEFS)) {
    const savedArr = saved && Array.isArray(saved[sid]) ? saved[sid] : null;
    const byKey = Object.fromEntries(def.cols.map(c => [c.key, c]));
    let list;
    if (savedArr) {
      list = [];
      for (const s of savedArr) {
        const d = byKey[s.key];
        if (!d) continue;
        list.push({ key: d.key, label: d.label, width: s.width || d.width, visible: s.visible !== false });
      }
      for (const d of def.cols) if (!savedArr.some(s => s.key === d.key)) list.push({ key: d.key, label: d.label, width: d.width, visible: true });
    } else {
      list = def.cols.map(d => ({ key: d.key, label: d.label, width: d.width, visible: true }));
    }
    out[sid] = list;
  }
  return out;
}

function SimpleTable({ cols, rows }) {
  if (!rows.length || !cols.length) return null;
  return (
    <div style={{ ...box, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{cols.map(c => <th key={c.key} style={{ ...th, width: c.width }}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => {
            // General-tagged schedule events are neutral info — grayed out.
            const gray = (r.tags || []).some(t => (t && (t.type || t)) === 'GENERAL');
            return (
              <tr key={i} style={gray ? { opacity: 0.5 } : undefined}>{cols.map(c => <td key={c.key} style={td}>{c.render ? c.render(r) : (r[c.key] || '')}</td>)}</tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// The gear popover that edits one section's columns (show/hide, order, width).
function ColumnEditor({ sectionId, list, onChange, onReset, onClose }) {
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = list.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const patch = (i, fields) => onChange(list.map((c, k) => k === i ? { ...c, ...fields } : c));
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', borderBottom: '1px solid rgba(128,128,128,0.15)' };
  const btn = (disabled) => ({ background: 'var(--bg3, var(--bg))', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', width: 24, height: 22, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, fontSize: 12, lineHeight: 1, padding: 0 });
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div style={{ position: 'absolute', left: 0, top: 'calc(100% + 4px)', zIndex: 70, width: 290, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 10px 28px rgba(0,0,0,0.35)', padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tan)' }}>Columns</div>
          <button onClick={onReset} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', textDecoration: 'underline' }}>Reset</button>
        </div>
        {list.map((c, i) => (
          <div key={c.key} style={rowStyle}>
            <input type="checkbox" checked={c.visible} onChange={e => patch(i, { visible: e.target.checked })} style={{ accentColor: 'var(--orange)', cursor: 'pointer' }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: c.visible ? 'var(--text)' : 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
            <input value={c.width || ''} onChange={e => patch(i, { width: e.target.value })} placeholder="auto"
              title="Column width, e.g. 24% or 120px"
              style={{ width: 54, fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text)', padding: '3px 5px', textAlign: 'center' }} />
            <button style={btn(i === 0)} disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button style={btn(i === list.length - 1)} disabled={i === list.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} className="btn btn-primary btn-sm">Done</button>
        </div>
      </div>
    </>
  );
}

// A section tile: gear (top-left) + label, then the table built from the
// effective (visible, ordered) columns for that section.
function Section({ sectionId, list, renderers, rows, onChange, onReset }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const cols = list.filter(c => c.visible).map(c => ({ key: c.key, label: c.label, width: c.width, render: renderers[c.key] }));
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '14px 0 5px' }}>
        <button className="no-print" onClick={() => setOpen(o => !o)} title="Choose columns, order & width"
          style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', width: 24, height: 22, cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0, flexShrink: 0 }}>⚙</button>
        <span style={sectionLbl}>{SECTION_DEFS[sectionId].label}</span>
      </div>
      {open && <ColumnEditor sectionId={sectionId} list={list} onChange={onChange} onReset={onReset} onClose={() => setOpen(false)} />}
      <SimpleTable cols={cols} rows={rows} />
    </div>
  );
}

function DaySheet({ project, techSpecs, locations, keyTalent, clientContacts, crew, day, dayIndex, dayCount, isFirst, isLast, nameById, colCfg, setSectionCfg, resetSection }) {
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
  // Only show locations tagged in THIS day's schedule — its events and its
  // call/shooting/lunch/wrap pins. An airport (or any venue) not referenced by
  // the day is left off that day's sheet.
  const taggedLocIds = new Set([
    ...(day.events || []).map(e => e.location_id),
    day.call_time_location_id, day.shooting_call_location_id, day.lunch_location_id, day.wrap_time_location_id,
  ].filter(Boolean));
  const dayLocations = locations.filter(l => taggedLocIds.has(l.id));

  // Per-column render functions, keyed to SECTION_DEFS keys.
  const renderers = {
    locations: {
      name: l => (
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
      ),
      address: l => stripName(l.address, l.name),
    },
    talent: {
      name: t => <span style={{ fontWeight: 700 }}>{t.name}</span>,
      role: t => t.role || '',
      call_time: t => t.call_time || '',
      phone: t => t.phone || '',
      email: t => t.email || '',
    },
    client: {
      name: c => <span style={{ fontWeight: 700 }}>{c.name}</span>,
      title: c => c.title || '',
      phone: c => c.phone || '',
      email: c => c.email || '',
    },
    crew: {
      position_name: a => a.position_name || '',
      name: a => <span style={{ fontWeight: 700 }}>{crewName(a)}</span>,
      call: a => callFor(a),
      cm_phone: a => a.cm_phone || '',
      cm_email: a => a.cm_email || '',
    },
    schedule: {
      time: e => [e.start_time, e.end_time].filter(Boolean).join(' – '),
      title: e => <span style={{ fontWeight: 700 }}>{e.title}</span>,
      detail: e => e.detail || '',
      crew: e => (e.crew_ids || []).map(cid => nameById[cid]).filter(Boolean).join(', '),
    },
  };

  const section = (sectionId, rows) => (
    <Section sectionId={sectionId} list={colCfg[sectionId]} renderers={renderers[sectionId]} rows={rows}
      onChange={next => setSectionCfg(sectionId, next)} onReset={() => resetSection(sectionId)} />
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto 26px', paddingTop: isFirst ? 0 : '0.4in', pageBreakAfter: isLast ? 'auto' : 'always' }}>
      {/* ── Header: general info (left) · timing (middle) · weather (right) ── */}
      <div style={{ ...box, borderTop: '3px solid var(--orange)', padding: '11px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--orange)', lineHeight: 1.3 }}>Shoot Day {dayIndex + 1} of {dayCount}</div>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{project.title}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.3 }}>{project.code}{project.client ? ` · ${project.client}` : ''}</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, lineHeight: 1.3 }}>{fmtLongDate(day.date)}</div>
          {specBits.length > 0 && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3 }}><b style={{ color: 'var(--tan)' }}>Tech Specs:</b> {specBits.join(' · ')}</div>}
        </div>
        <div style={{ flex: '0 0 auto', width: 150 }}>
          {time('Crew Call', day.call_time)}
          {time('Shooting Call', day.shooting_call_time)}
          {time('Lunch', day.lunch_time)}
          {time('Wrap', day.wrap_time)}
        </div>
        {weatherBits.length > 0 && (
          <div style={{ flex: '0 0 auto', width: 138, fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--tan)', marginBottom: 2 }}>Weather</div>
            {weatherBits.map((w, i) => <div key={i}>{w}</div>)}
          </div>
        )}
      </div>

      {section('locations', dayLocations)}
      {section('talent', keyTalent)}
      {section('client', clientContacts)}
      {section('crew', crew)}
      {section('schedule', events)}
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
  const [downloading, setDownloading] = useState(false);
  const [colCfg, setColCfg] = useState(() => normalizeCfg(null));
  const saveTimer = useRef(null);

  useEffect(() => {
    Promise.all([api.getProject(id), api.getSchedule(id)])
      .then(([p, d]) => { setProject(p); setDays(d); setColCfg(normalizeCfg(p.callsheet_columns)); })
      .catch(e => setErr(e.message));
  }, [id]);

  // ?pdf=1 auto-downloads the full clean PDF, then returns to the project.
  useEffect(() => {
    if (!isPdf || !project || !days) return;
    (async () => {
      try {
        const blob = await api.downloadCallSheet(id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${project.code || 'call-sheet'}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch { /* leave the page up so they can use the dropdown */ }
    })();
  }, [isPdf, project, days]);

  // Persist column config (debounced so width typing doesn't hammer the API).
  function persist(cfg) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.updateProject(id, { callsheetColumns: cfg }).catch(() => {});
    }, 500);
  }
  function setSectionCfg(sectionId, next) {
    setColCfg(prev => { const cfg = { ...prev, [sectionId]: next }; persist(cfg); return cfg; });
  }
  function resetSection(sectionId) {
    setColCfg(prev => {
      const cfg = { ...prev, [sectionId]: SECTION_DEFS[sectionId].cols.map(d => ({ key: d.key, label: d.label, width: d.width, visible: true })) };
      persist(cfg); return cfg;
    });
  }

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

  // Download a clean, server-rendered PDF — all days, or one day when dayId is set.
  async function downloadPdf(dayId) {
    setMenuOpen(false);
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await api.downloadCallSheet(id, dayId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dayLabel = dayId ? `-day${sheetDays.findIndex(d => d.id === dayId) + 1}` : '';
      a.href = url; a.download = `${project.code || 'call-sheet'}${dayLabel}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { alert('Could not generate PDF: ' + e.message); }
    finally { setDownloading(false); }
  }

  const menuItem = { display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text)', fontSize: 12, padding: '9px 14px', cursor: 'pointer', whiteSpace: 'nowrap' };
  const hoverOn = e => { e.currentTarget.style.background = 'var(--bg3)'; };
  const hoverOff = e => { e.currentTarget.style.background = 'none'; };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', gap: 10, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>Call Sheet — {project.code} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{project.title}</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(o => !o)} disabled={downloading} className="btn btn-primary btn-sm">{downloading ? 'Generating…' : '📄 Download PDF ▾'}</button>
            {menuOpen && (
              <>
                <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 50, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, minWidth: 250, boxShadow: '0 10px 28px rgba(0,0,0,0.35)', overflow: 'hidden', maxHeight: 380, overflowY: 'auto' }}>
                  <button style={{ ...menuItem, fontWeight: 700, borderBottom: '1px solid var(--border)' }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                    onClick={() => downloadPdf(null)}>
                    All days ({sheetDays.length})
                  </button>
                  {sheetDays.map((d, i) => (
                    <button key={d.id} style={menuItem} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                      onClick={() => downloadPdf(d.id)}>
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
        {sheetDays.map((day, i) => (
          <DaySheet key={day.id} project={project} techSpecs={project.techSpecs} locations={locations}
            keyTalent={keyTalent} clientContacts={clientContacts} crew={crew}
            day={day} dayIndex={i} dayCount={sheetDays.length}
            isFirst={i === 0} isLast={i === sheetDays.length - 1} nameById={nameById}
            colCfg={colCfg} setSectionCfg={setSectionCfg} resetSection={resetSection} />
        ))}
      </div>
    </div>
  );
}
