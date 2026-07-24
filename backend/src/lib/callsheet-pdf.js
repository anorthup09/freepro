// Server-side call-sheet PDF — rendered with @react-pdf/renderer (pure Node, no
// headless browser) so the output is clean and identical on every device, with
// none of the browser/OS print header/footer. Mirrors the on-screen CallSheet.
const React = require('react');
const h = React.createElement;

const crewName = a => [a.cm_pref_first, a.cm_pref_last].filter(Boolean).join(' ').trim() || a.cm_name || a.name || '';
const fmtLongDate = d => {
  if (!d) return '';
  const iso = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  const dt = new Date(iso + 'T12:00:00');
  return isNaN(dt) ? '' : dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};
const LOC_LABELS = { PRIMARY_VENUE: 'Shooting Location', CREW_HOTEL: 'Hotel', SECONDARY: 'Location', AIRPORT: 'Airport', OTHER: 'Location' };
const stripName = (addr, name) => {
  if (!addr) return '';
  if (!name) return addr;
  const esc = String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(addr).replace(new RegExp('^\\s*' + esc + '\\s*,?\\s*', 'i'), '').trim() || String(addr);
};

const C = { orange: '#E8500A', text: '#111', muted: '#555', tan: '#333', border: '#c9c9c9', line: '#e2e2e2', headBg: '#f4f4f4', boxBg: '#fafafa' };

async function renderCallSheet({ project, allDays, renderDays }) {
  const { Document, Page, Text, View, StyleSheet, renderToBuffer } = await import('@react-pdf/renderer');

  const st = StyleSheet.create({
    page: { paddingVertical: 30, paddingHorizontal: 34, fontFamily: 'Helvetica', fontSize: 9, color: C.text, lineHeight: 1.3 },
    header: { borderWidth: 1, borderColor: C.border, borderTopWidth: 3, borderTopColor: C.orange, borderRadius: 6, backgroundColor: C.boxBg, padding: 11, flexDirection: 'row', justifyContent: 'space-between' },
    hLeft: { flexGrow: 1, flexShrink: 1, paddingRight: 14 },
    hMid: { width: 150, flexShrink: 0, paddingRight: 16 },
    hRight: { width: 130, flexShrink: 0 },
    dayTag: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.orange, letterSpacing: 1, textTransform: 'uppercase' },
    title: { fontSize: 15, fontFamily: 'Helvetica-Bold', marginTop: 1 },
    sub: { fontSize: 9, color: C.muted, marginTop: 1 },
    date: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 3 },
    specs: { fontSize: 8, color: C.muted, marginTop: 3 },
    timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 },
    timeLbl: { fontSize: 8, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: 'Helvetica-Bold' },
    timeVal: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
    wxHead: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.tan, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2, textAlign: 'right' },
    wx: { fontSize: 9, color: C.muted, textAlign: 'right' },
    sectionLbl: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.tan, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 13, marginBottom: 4 },
    table: { borderWidth: 1, borderColor: C.border, borderRadius: 4 },
    thRow: { flexDirection: 'row', backgroundColor: C.headBg, borderBottomWidth: 1, borderBottomColor: C.border },
    th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, paddingVertical: 4, paddingHorizontal: 7 },
    tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: C.line },
    td: { fontSize: 9, paddingVertical: 4, paddingHorizontal: 7 },
    strong: { fontFamily: 'Helvetica-Bold' },
    tiny: { fontSize: 7.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1, fontFamily: 'Helvetica-Bold' },
    noteLine: { fontSize: 8.5, marginTop: 2 },
  });

  const Table = (cols, rows, keyPrefix) => h(View, { style: st.table },
    h(View, { style: st.thRow }, cols.map((c, i) => h(Text, { key: 'th' + i, style: [st.th, { width: c.width }] }, c.label))),
    rows.map((r, ri) => h(View, { key: keyPrefix + ri, style: [st.tr, ri === rows.length - 1 ? { borderBottomWidth: 0 } : {}] },
      cols.map((c, ci) => h(View, { key: ci, style: [st.td, { width: c.width }] }, c.render(r)))
    ))
  );

  const Section = (label, node) => h(View, { wrap: false }, h(Text, { style: st.sectionLbl }, label), node);

  const DayPage = (day, key) => {
    const dayIndex = allDays.findIndex(d => d.id === day.id);
    const dayCount = allDays.length;
    const events = [...(day.events || [])].sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
    const taggedLocIds = new Set([
      ...(day.events || []).map(e => e.location_id),
      day.call_time_location_id, day.shooting_call_location_id, day.lunch_location_id, day.wrap_time_location_id,
    ].filter(Boolean));
    const dayLocations = (project.locations || []).filter(l => taggedLocIds.has(l.id));
    const keyTalent = project.keyTalent || [];
    const clientContacts = project.clientContacts || [];
    const crew = (project.crewAssignments || []).filter(a => crewName(a));
    const nameById = {};
    for (const a of crew) if (a.cm_id) nameById[a.cm_id] = crewName(a);
    const callFor = a => (day.crewCalls || []).find(c => c.crew_assignment_id === a.id)?.call_time || day.call_time || '';
    const specBits = [project.techSpecs?.aspect_ratio, project.techSpecs?.resolution, project.techSpecs?.frame_rate ? `${project.techSpecs.frame_rate} fps` : null].filter(Boolean);
    const wxBits = [
      day.weather_condition,
      (day.weather_high != null || day.weather_low != null) ? `High ${day.weather_high ?? '-'}° / Low ${day.weather_low ?? '-'}°` : null,
      day.weather_sunrise ? `Sunrise ${day.weather_sunrise}` : null,
      day.weather_sunset ? `Sunset ${day.weather_sunset}` : null,
    ].filter(Boolean);
    const timeRow = (lbl, val) => val ? h(View, { style: st.timeRow }, h(Text, { style: st.timeLbl }, lbl), h(Text, { style: st.timeVal }, val)) : null;

    return h(Page, { key, size: 'LETTER', style: st.page },
      // Header
      h(View, { style: st.header },
        h(View, { style: st.hLeft },
          h(Text, { style: st.dayTag }, `Shoot Day ${dayIndex + 1} of ${dayCount}`),
          h(Text, { style: st.title }, project.title || ''),
          h(Text, { style: st.sub }, `${project.code || ''}${project.client ? ' · ' + project.client : ''}`),
          h(Text, { style: st.date }, fmtLongDate(day.date)),
          specBits.length ? h(Text, { style: st.specs }, h(Text, { style: { color: C.tan, fontFamily: 'Helvetica-Bold' } }, 'Tech Specs: '), specBits.join(' · ')) : null,
        ),
        h(View, { style: st.hMid },
          timeRow('Crew Call', day.call_time), timeRow('Shooting Call', day.shooting_call_time),
          timeRow('Lunch', day.lunch_time), timeRow('Wrap', day.wrap_time),
        ),
        wxBits.length ? h(View, { style: st.hRight },
          h(Text, { style: st.wxHead }, 'Weather'),
          wxBits.map((w, i) => h(Text, { key: i, style: st.wx }, w)),
        ) : h(View, { style: st.hRight }),
      ),
      // Locations (only those tagged in this day's schedule)
      dayLocations.length ? Section('Locations', Table([
        { label: 'Location', width: '42%', render: l => h(View, null,
          h(Text, { style: st.strong }, l.name || ''),
          h(Text, { style: st.tiny }, LOC_LABELS[l.type] || 'Location'),
          l.arrival_notes ? h(Text, { style: st.noteLine }, h(Text, { style: st.strong }, 'Arrival: '), l.arrival_notes) : null,
          (l.type === 'PRIMARY_VENUE' && l.notes) ? h(Text, { style: st.noteLine }, h(Text, { style: st.strong }, 'Nearest Hospital: '), String(l.notes).replace(/^Nearest Hospital:\s*/i, '')) : null,
        ) },
        { label: 'Address', width: '58%', render: l => h(Text, null, stripName(l.address, l.name)) },
      ], dayLocations, 'loc')) : null,
      // Talent
      keyTalent.length ? Section('Talent', Table([
        { label: 'Name', width: '24%', render: t => h(Text, { style: st.strong }, t.name || '') },
        { label: 'Title / Role', width: '26%', render: t => h(Text, null, t.role || '') },
        { label: 'Call', width: '12%', render: t => h(Text, null, t.call_time || '') },
        { label: 'Phone', width: '18%', render: t => h(Text, null, t.phone || '') },
        { label: 'Email', width: '20%', render: t => h(Text, null, t.email || '') },
      ], keyTalent, 'tal')) : null,
      // Client
      clientContacts.length ? Section('Client', Table([
        { label: 'Name', width: '26%', render: c => h(Text, { style: st.strong }, c.name || '') },
        { label: 'Title', width: '28%', render: c => h(Text, null, c.title || '') },
        { label: 'Phone', width: '18%', render: c => h(Text, null, c.phone || '') },
        { label: 'Email', width: '28%', render: c => h(Text, null, c.email || '') },
      ], clientContacts, 'cli')) : null,
      // Production Crew
      crew.length ? Section('Production Crew', Table([
        { label: 'Title', width: '24%', render: a => h(Text, null, a.position_name || '') },
        { label: 'Name', width: '22%', render: a => h(Text, { style: st.strong }, crewName(a)) },
        { label: 'Call', width: '10%', render: a => h(Text, null, callFor(a)) },
        { label: 'Phone', width: '18%', render: a => h(Text, null, a.cm_phone || '') },
        { label: 'Email', width: '26%', render: a => h(Text, null, a.cm_email || '') },
      ], crew, 'crw')) : null,
      // Schedule
      events.length ? Section('Schedule', Table([
        { label: 'Time', width: '16%', render: e => h(Text, null, [e.start_time, e.end_time].filter(Boolean).join(' – ')) },
        { label: 'Event', width: '30%', render: e => h(Text, { style: st.strong }, e.title || '') },
        { label: 'Notes', width: '34%', render: e => h(Text, null, e.detail || '') },
        { label: 'Crew', width: '20%', render: e => h(Text, null, (e.crew_ids || []).map(cid => nameById[cid]).filter(Boolean).join(', ')) },
      ], events, 'sch')) : null,
    );
  };

  const doc = h(Document, { title: `${project.code || ''} Call Sheet`.trim(), author: 'Unbridled Media' },
    renderDays.map((d, i) => DayPage(d, 'p' + i)));
  return renderToBuffer(doc);
}

module.exports = { renderCallSheet };
