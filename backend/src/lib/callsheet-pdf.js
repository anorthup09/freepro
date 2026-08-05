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
const fmt12 = t => {
  if (!t) return '';
  if (/am|pm/i.test(String(t))) return String(t);
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
};
const mapsUrl = a => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(a || '');
const LOC_LABELS = { PRIMARY_VENUE: 'Shooting Location', CREW_HOTEL: 'Hotel', SECONDARY: 'Location', AIRPORT: 'Airport', OTHER: 'Location' };
const stripName = (addr, name) => {
  if (!addr) return '';
  if (!name) return addr;
  const esc = String(name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(addr).replace(new RegExp('^\\s*' + esc + '\\s*,?\\s*', 'i'), '').trim() || String(addr);
};

const C = { orange: '#E8500A', text: '#111', muted: '#555', tan: '#333', border: '#c9c9c9', line: '#e2e2e2', headBg: '#f4f4f4', boxBg: '#fafafa' };

async function renderCallSheet({ project, allDays, renderDays, talent = null }) {
  const { Document, Page, Text, View, Link, StyleSheet, renderToBuffer } = await import('@react-pdf/renderer');

  const st = StyleSheet.create({
    page: { paddingVertical: 30, paddingHorizontal: 34, fontFamily: 'Helvetica', fontSize: 9, color: C.text, lineHeight: 1.3 },
    header: { borderWidth: 1, borderColor: C.border, borderTopWidth: 3, borderTopColor: C.orange, borderRadius: 6, backgroundColor: C.boxBg, padding: 11, flexDirection: 'row', justifyContent: 'space-between' },
    hLeft: { flexGrow: 1, flexShrink: 1, paddingRight: 14 },
    hMid: { width: 150, flexShrink: 0, paddingRight: 16 },
    hRight: { width: 130, flexShrink: 0 },
    dayTag: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.orange, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 1.2, marginBottom: 3 },
    title: { fontSize: 15, fontFamily: 'Helvetica-Bold', lineHeight: 1.2, marginBottom: 3 },
    sub: { fontSize: 9, color: C.muted, lineHeight: 1.2, marginBottom: 3 },
    date: { fontSize: 10, fontFamily: 'Helvetica-Bold', lineHeight: 1.2 },
    specs: { fontSize: 8, color: C.muted, lineHeight: 1.2, marginTop: 4 },
    talentCallLbl: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
    talentCallVal: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.text, textAlign: 'center', marginTop: 2 },
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
    timeCell: { fontSize: 8.5, fontVariantNumeric: 'tabular-nums' },
    // Smaller cells for the schedule so the extra Location column fits.
    schedTh: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.3, paddingVertical: 3, paddingHorizontal: 5 },
    schedTd: { fontSize: 7.5, paddingVertical: 3, paddingHorizontal: 5 },
    schedTime: { fontSize: 7, fontVariantNumeric: 'tabular-nums' },
    locLink: { fontSize: 7.5, color: C.orange, textDecoration: 'underline' },
    schedNote: { fontSize: 7, marginTop: 1.5 },
    infoTiles: { flexDirection: 'row', gap: 8, marginTop: 8 },
    infoTile: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 8, backgroundColor: C.boxBg },
    infoTileLbl: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    infoTileBody: { fontSize: 8.5, color: C.text, lineHeight: 1.35 },
    strong: { fontFamily: 'Helvetica-Bold' },
    tiny: { fontSize: 7.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 1, fontFamily: 'Helvetica-Bold' },
    noteLine: { fontSize: 8.5, marginTop: 2 },
  });

  const Table = (cols, rows, keyPrefix, opts = {}) => h(View, { style: st.table },
    h(View, { style: st.thRow }, cols.map((c, i) => h(Text, { key: 'th' + i, style: [opts.th || st.th, { width: c.width }] }, c.label))),
    rows.map((r, ri) => h(View, { key: keyPrefix + ri, wrap: false, style: [st.tr, ri === rows.length - 1 ? { borderBottomWidth: 0 } : {}] },
      // General-tagged schedule events are neutral info — grayed out.
      cols.map((c, ci) => h(View, { key: ci, style: [opts.td || st.td, { width: c.width }, r.general ? { color: '#999' } : null] }, c.render(r)))
    ))
  );

  // Sections don't page-break as a block by default; allowWrap lets a long table
  // (the schedule) start right under the previous section and flow across pages.
  const Section = (label, node, allowWrap) => h(View, allowWrap ? {} : { wrap: false }, h(Text, { style: st.sectionLbl }, label), node);

  // Apply the project's saved call-sheet column config (visibility, order, width)
  // to a section's default column list. Config shape: { [sectionId]: [{key,width,visible}] }.
  const cfg = project.callsheet_columns && typeof project.callsheet_columns === 'object' ? project.callsheet_columns : null;
  const applyCfg = (sectionId, cols) => {
    const saved = cfg && Array.isArray(cfg[sectionId]) ? cfg[sectionId] : null;
    if (!saved) return cols;
    const byKey = Object.fromEntries(cols.map(c => [c.key, c]));
    const out = [];
    for (const s of saved) {
      const c = byKey[s.key];
      if (!c || s.visible === false) continue;
      out.push({ ...c, width: s.width || c.width });
    }
    for (const c of cols) if (!saved.some(s => s.key === c.key)) out.push(c);
    return out;
  };

  const DayPage = (day, key) => {
    const dayIndex = allDays.findIndex(d => d.id === day.id);
    const dayCount = allDays.length;
    // Talent sheets show only schedule items the talent is explicitly tagged in
    // (matches the talent share view — general/untagged items are excluded),
    // plus a "Talent Call" row at the talent's call time.
    const events = (() => {
      const list = [...(day.events || [])].filter(e => !talent || (e.audience || []).includes(talent.name));
      if (talent) {
        const ct = talent.callByDay?.[day.id] || day.call_time || '';
        if (ct) list.push({ id: '__talentcall', start_time: ct, end_time: null, title: 'Talent Call', detail: talent.callLocByDay?.[day.id] || '', crew_ids: [], audience: [talent.name] });
      }
      // Tie-breaker: at the same time, call-time items sort above everything else.
      const callRank = e => (e.id === '__talentcall' || e.is_shooting_call || /(^|\s)call\b/i.test(e.title || '')) ? 0 : 1;
      return list.sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')) || (callRank(a) - callRank(b)));
    })();
    const taggedLocIds = new Set([
      ...(day.events || []).map(e => e.location_id),
      day.call_time_location_id, day.shooting_call_location_id, day.lunch_location_id, day.wrap_time_location_id,
    ].filter(Boolean));
    // Talent sheets: if the talent's day-call selected specific shoot locations,
    // show only those; otherwise fall back to the day's tagged locations.
    const talentLocIds = talent ? (talent.locIdsByDay?.[day.id] || []) : [];
    const dayLocations = (talent && talentLocIds.length
        ? (project.locations || []).filter(l => talentLocIds.includes(l.id))
        : (project.locations || []).filter(l => taggedLocIds.has(l.id)))
      .filter(l => !talent || l.type !== 'CREW_HOTEL'); // talent sheets omit hotel info
    // Room/space per location, gathered from this day's (talent-filtered) events.
    const roomsByLoc = {};
    for (const e of events) if (e.location_id && e.room_space) (roomsByLoc[e.location_id] ||= new Set()).add(e.room_space);
    // Talent call sheet: only the selected talent in the Talent table, and only
    // the Field Producer in the Production Crew table (client stays in its section).
    const keyTalent = talent ? [talent] : (day.talent || project.keyTalent || []);
    const clientContacts = project.clientContacts || [];
    const crew = (project.crewAssignments || []).filter(a => crewName(a))
      .filter(a => !talent || /field producer/i.test(a.position_name || ''));
    const talentCall = talent ? fmt12(talent.callByDay?.[day.id] || day.call_time || '') : null;
    const nameById = {};
    for (const a of crew) if (a.cm_id) nameById[a.cm_id] = crewName(a);
    // Crew members that can be tagged to an event (by name, via the event audience).
    const crewNameSet = new Set((project.crewAssignments || []).map(a => crewName(a)).filter(Boolean));
    const taggedCrew = e => (e.audience || []).filter(n => crewNameSet.has(n)).join(', ');
    // Time range as one non-breaking token so the Time column never wraps.
    const NBSP = String.fromCharCode(160);
    const schedTime = e => [e.start_time, e.end_time].filter(Boolean).map(x => fmt12(x)).join(NBSP + String.fromCharCode(8211) + NBSP).replace(/ /g, NBSP);
    const callFor = a => (day.crewCalls || []).find(c => c.crew_assignment_id === a.id)?.call_time || day.call_time || '';
    const specBits = [project.techSpecs?.aspect_ratio, project.techSpecs?.resolution, project.techSpecs?.frame_rate ? `${project.techSpecs.frame_rate} fps` : null].filter(Boolean);
    const wxBits = [
      day.weather_condition,
      (day.weather_high != null || day.weather_low != null) ? `High ${day.weather_high ?? '-'}° / Low ${day.weather_low ?? '-'}°` : null,
      day.weather_sunrise ? `Sunrise ${day.weather_sunrise}` : null,
      day.weather_sunset ? `Sunset ${day.weather_sunset}` : null,
    ].filter(Boolean);
    const timeRow = (lbl, val) => val ? h(View, { style: st.timeRow }, h(Text, { style: st.timeLbl }, lbl), h(Text, { style: st.timeVal }, fmt12(val))) : null;

    return h(Page, { key, size: 'LETTER', style: st.page },
      // Header
      h(View, { style: st.header },
        h(View, { style: st.hLeft },
          h(Text, { style: st.dayTag }, `Shoot Day ${dayIndex + 1} of ${dayCount}`),
          h(Text, { style: st.title }, project.title || ''),
          h(Text, { style: st.sub }, talent ? (project.client || '') : `${project.code || ''}${project.client ? ' · ' + project.client : ''}`),
          h(Text, { style: st.date }, fmtLongDate(day.date)),
          specBits.length ? h(Text, { style: st.specs }, h(Text, { style: { color: C.tan, fontFamily: 'Helvetica-Bold' } }, 'Tech Specs: '), specBits.join(' · ')) : null,
        ),
        talent
          ? h(View, { style: [st.hMid, { justifyContent: 'center' }] },
              h(Text, { style: st.talentCallLbl }, 'Talent Call Time'),
              h(Text, { style: st.talentCallVal }, talentCall || 'TBD'),
            )
          : h(View, { style: st.hMid },
              timeRow('Crew Call', day.call_time), timeRow('Shooting Call', day.shooting_call_time),
              timeRow('Lunch', day.lunch_time), timeRow('Wrap', day.wrap_time),
            ),
        wxBits.length ? h(View, { style: st.hRight },
          h(Text, { style: st.wxHead }, 'Weather'),
          wxBits.map((w, i) => h(Text, { key: i, style: st.wx }, w)),
        ) : h(View, { style: st.hRight }),
      ),
      // Talent sheets: wardrobe & arrival info tiles across the top
      (talent && (talent.wardrobe || talent.arrival)) ? h(View, { style: st.infoTiles },
        talent.wardrobe ? h(View, { style: st.infoTile },
          h(Text, { style: st.infoTileLbl }, 'Wardrobe'),
          h(Text, { style: st.infoTileBody }, talent.wardrobe),
        ) : null,
        talent.arrival ? h(View, { style: st.infoTile },
          h(Text, { style: st.infoTileLbl }, 'Arrival'),
          h(Text, { style: st.infoTileBody }, talent.arrival),
        ) : null,
      ) : null,
      // Locations (only those tagged in this day's schedule)
      dayLocations.length ? Section('Locations', Table(applyCfg('locations', [
        { key: 'name', label: 'Location', width: '42%', render: l => h(View, null,
          h(Text, { style: st.strong }, l.name || ''),
          h(Text, { style: st.tiny }, LOC_LABELS[l.type] || 'Location'),
          (talent && roomsByLoc[l.id]) ? h(Text, { style: st.noteLine }, h(Text, { style: st.strong }, 'Room/Space: '), [...roomsByLoc[l.id]].join(', ')) : null,
          l.arrival_notes ? h(Text, { style: st.noteLine }, h(Text, { style: st.strong }, 'Arrival: '), l.arrival_notes) : null,
          (!talent && l.type === 'PRIMARY_VENUE' && l.notes) ? h(Text, { style: st.noteLine }, h(Text, { style: st.strong }, 'Nearest Hospital: '), String(l.notes).replace(/^Nearest Hospital:\s*/i, '')) : null,
        ) },
        { key: 'address', label: 'Address', width: '58%', render: l => h(Text, null, stripName(l.address, l.name)) },
      ]), dayLocations, 'loc')) : null,
      // Talent — talent sheets drop the Call column (it's the big header) and
      // give email room; the crew sheet keeps the full, configurable set.
      keyTalent.length ? Section('Talent', Table(
        talent
          ? [
              { key: 'name', label: 'Name', width: '20%', render: t => h(Text, { style: st.strong }, t.name || '') },
              { key: 'role', label: 'Title / Role', width: '20%', render: t => h(Text, null, t.role || '') },
              { key: 'phone', label: 'Phone', width: '22%', render: t => h(Text, null, t.phone || '') },
              { key: 'email', label: 'Email', width: '38%', render: t => h(Text, null, t.email || '') },
            ]
          : applyCfg('talent', [
              { key: 'name', label: 'Name', width: '24%', render: t => h(Text, { style: st.strong }, t.name || '') },
              { key: 'role', label: 'Title / Role', width: '26%', render: t => h(Text, null, t.role || '') },
              { key: 'call_time', label: 'Call', width: '12%', render: t => h(Text, null, fmt12(t.call_time || '')) },
              { key: 'phone', label: 'Phone', width: '18%', render: t => h(Text, null, t.phone || '') },
              { key: 'email', label: 'Email', width: '20%', render: t => h(Text, null, t.email || '') },
            ]),
        keyTalent, 'tal')) : null,
      // Client
      clientContacts.length ? Section('Client', Table(applyCfg('client', [
        { key: 'name', label: 'Name', width: '26%', render: c => h(Text, { style: st.strong }, c.name || '') },
        { key: 'title', label: 'Title', width: '28%', render: c => h(Text, null, c.title || '') },
        { key: 'phone', label: 'Phone', width: '18%', render: c => h(Text, null, c.phone || '') },
        { key: 'email', label: 'Email', width: '28%', render: c => h(Text, null, c.email || '') },
      ]), clientContacts, 'cli')) : null,
      // Production Crew
      crew.length ? Section('Production Crew', Table(applyCfg('crew', [
        { key: 'position_name', label: 'Title', width: '24%', render: a => h(Text, null, a.position_name || '') },
        { key: 'name', label: 'Name', width: '22%', render: a => h(Text, { style: st.strong }, crewName(a)) },
        { key: 'call', label: 'Call', width: '10%', render: a => h(Text, null, fmt12(callFor(a))) },
        { key: 'cm_phone', label: 'Phone', width: '18%', render: a => h(Text, null, a.cm_phone || '') },
        { key: 'cm_email', label: 'Email', width: '26%', render: a => h(Text, null, a.cm_email || '') },
      ]), crew, 'crw')) : null,
      // Schedule — flows right under Crew (no forced page break); smaller text to
      // fit the extra Location column, whose name links to the address.
      events.length ? Section('Schedule', Table(
        talent
          ? [
              { key: 'time', label: 'Time', width: '20%', render: e => h(Text, { style: st.schedTime }, schedTime(e)) },
              { key: 'title', label: 'Event', width: '22%', render: e => h(Text, { style: st.strong }, e.title || '') },
              { key: 'location', label: 'Location', width: '20%', render: e => e.location_name ? h(Link, { style: st.locLink, src: mapsUrl(e.location_address || e.location_name) }, e.location_name) : h(Text, null, '') },
              { key: 'detail', label: 'Notes', width: '38%', render: e => h(Text, null, e.detail || '') },
            ]
          : [
              { key: 'time', label: 'Time', width: '16%', render: e => h(Text, { style: st.schedTime }, schedTime(e)) },
              { key: 'title', label: 'Event', width: '22%', render: e => h(Text, { style: st.strong }, e.title || '') },
              { key: 'location', label: 'Location', width: '20%', render: e => e.location_name ? h(Link, { style: st.locLink, src: mapsUrl(e.location_address || e.location_name) }, e.location_name) : h(Text, null, '') },
              { key: 'detail', label: 'Notes', width: '24%', render: e => h(View, null,
                e.detail ? h(Text, null, e.detail) : null,
                e.room_space ? h(Text, { style: st.schedNote }, h(Text, { style: st.strong }, 'Room/Space: '), e.room_space) : null,
              ) },
              { key: 'crew', label: 'Crew', width: '18%', render: e => h(Text, null, taggedCrew(e)) },
            ],
        events, 'sch', { th: st.schedTh, td: st.schedTd }), true) : null,
    );
  };

  const doc = h(Document, { title: `${project.code || ''} Call Sheet`.trim(), author: 'Unbridled Media' },
    renderDays.map((d, i) => DayPage(d, 'p' + i)));
  return renderToBuffer(doc);
}

module.exports = { renderCallSheet };
