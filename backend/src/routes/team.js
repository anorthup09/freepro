const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');
const { noticeHtml } = require('../lib/emailTemplates');
const { bizToday } = require('../lib/dates');

const PREF = "COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name)";
const STATUSES = ['REVIEW', 'APPROVED', 'CLOSED'];

const LIST = () => sql`
  SELECT p.*,
    (SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = p.member_id) as member_name,
    (SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = p.manager_id) as manager_name,
    (SELECT cm.email FROM crew_members cm WHERE cm.id = p.manager_id) as manager_email
  FROM pto_requests p
  ORDER BY p.start_date NULLS LAST, p.created_at`;

// GET /api/team/pto — list (requests whose end date has passed auto-close)
router.get('/pto', requireAuth, async (req, res, next) => {
  try {
    // Auto-close in the business timezone (UTC CURRENT_DATE closed PTO a day early),
    // and reopen anything the old UTC logic closed prematurely.
    await sql`UPDATE pto_requests SET status = 'CLOSED' WHERE end_date < ${bizToday()} AND status != 'CLOSED'`;
    await sql`UPDATE pto_requests SET status = 'APPROVED' WHERE end_date >= ${bizToday()} AND status = 'CLOSED'`;
    res.json(await LIST());
  } catch (e) { next(e); }
});

// GET /api/team/pto/report — days off per person, split PTO vs OOO.
// Counts weekdays (Mon–Fri) in each request's date range. WFH and STL/DEN Only
// are working arrangements, not time off, so they're excluded. Comp and Other
// OOO roll into OOO. Pending (REVIEW) requests are excluded.
function weekdaysBetween(start, end) {
  const s = new Date(String(start).slice(0, 10) + 'T12:00:00');
  const e = new Date(String(end).slice(0, 10) + 'T12:00:00');
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  let n = 0;
  for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) n++;
  }
  return n;
}
// Not counted as team members on the days-off report.
const DAYSOFF_EXCLUDE = ['anna parnigoni', 'brandon emery', 'allison boon', 'ariel lynch'];
router.get('/pto/report', requireAuth, async (req, res, next) => {
  try {
    await sql`UPDATE pto_requests SET status = 'CLOSED' WHERE end_date < ${bizToday()} AND status != 'CLOSED'`;
    await sql`UPDATE pto_requests SET status = 'APPROVED' WHERE end_date >= ${bizToday()} AND status = 'CLOSED'`;
    // Seed every Unbridled team member at zero so the full roster always shows.
    const roster = await sql`SELECT id, ${sql.unsafe(PREF)} as name FROM crew_members cm WHERE company ILIKE '%unbridled%'`;
    const byId = new Map();
    for (const m of roster) {
      if (DAYSOFF_EXCLUDE.includes((m.name || '').trim().toLowerCase())) continue;
      byId.set(m.id, { name: m.name, pto: 0, ooo: 0 });
    }
    const rows = await sql`SELECT member_id, pto_type, start_date, end_date, status FROM pto_requests`;
    for (const r of rows) {
      if (r.status === 'REVIEW') continue;                       // pending — not counted
      const type = r.pto_type;
      let bucket = null;
      if (type === 'PTO') bucket = 'pto';
      else if (type === 'Comp' || type === 'Other OOO') bucket = 'ooo';
      else continue;                                             // WFH / STL/DEN Only = working
      const cur = byId.get(r.member_id);
      if (!cur) continue;                                        // excluded or non-Unbridled
      const days = weekdaysBetween(r.start_date, r.end_date);
      if (!days) continue;
      cur[bucket] += days;
    }
    const report = [...byId.values()]
      .map(x => ({ ...x, total: x.pto + x.ooo }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    res.json(report);
  } catch (e) { next(e); }
});

// POST /api/team/pto — submit the request form
router.post('/pto', requireAuth, async (req, res, next) => {
  try {
    const d = req.body;
    if (!d.title || !d.memberId || !d.startDate || !d.endDate) {
      return res.status(400).json({ error: 'Requester, title, start and end dates are required' });
    }
    const [row] = await sql`
      INSERT INTO pto_requests (member_id, title, pto_type, start_date, end_date, on_shoots, comp_notes, manager_id, notify)
      VALUES (${d.memberId}, ${d.title}, ${d.ptoType || 'PTO'}, ${d.startDate}, ${d.endDate},
        ${d.onShoots || null}, ${d.compNotes || null}, ${d.managerId || null}, ${d.notify || null})
      RETURNING id`;
    const [full] = await sql`
      SELECT p.*,
        (SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = p.member_id) as member_name,
        (SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = p.manager_id) as manager_name,
        (SELECT cm.email FROM crew_members cm WHERE cm.id = p.manager_id) as manager_email
      FROM pto_requests p WHERE p.id = ${row.id}`;
    // The extra people listed on the request get an FYI (names resolved to roster emails)
    if (d.notify) {
      try {
        const names = String(d.notify).split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
        if (names.length) {
          const roster = await sql`SELECT name, preferred_first_name, preferred_last_name, email FROM crew_members WHERE email IS NOT NULL`;
          const emails = roster.filter(m => {
            const disp = ([m.preferred_first_name, m.preferred_last_name].filter(Boolean).join(' ').trim() || m.name || '').toLowerCase();
            return names.includes(disp) || names.includes((m.name || '').toLowerCase());
          }).map(m => m.email);
          if (emails.length) sendMail({ identity: 'team',
            to: emails.join(', '),
            subject: `FYI: PTO Request — ${full.title}`,
            text: `${full.member_name} submitted a PTO/OOO request and listed you to be notified.\n\nType: ${full.pto_type}\nDates: ${String(full.start_date).slice(0, 10)} to ${String(full.end_date).slice(0, 10)}\n\nDetails in Team Management on the Unbridled hub.`,
            html: noticeHtml({ tag: 'Team', note: 'PTO / OOO — FYI', color: '#4a7fb5',
              title: full.title, subtitle: full.member_name,
              intro: `${full.member_name} submitted a PTO/OOO request and listed you to be notified. Details are in Team Management on the Unbridled hub.`,
              rows: [['Type', full.pto_type], ['Dates', `${String(full.start_date).slice(0, 10)} to ${String(full.end_date).slice(0, 10)}`]],
              postmark: new Date() }),
          }).catch(err => console.error('PTO notify email failed:', err.message));
        }
      } catch (err) { console.error('PTO notify resolution failed:', err.message); }
    }
    // Manager gets an approval-request email (no-op until SMTP is configured)
    if (full.manager_email) {
      sendMail({ identity: 'team',
        to: full.manager_email,
        subject: `PTO Request — ${full.title}`,
        text: `${full.member_name} submitted a PTO/OOO request that needs your review.\n\nRequest: ${full.title}\nType: ${full.pto_type}\nDates: ${String(full.start_date).slice(0, 10)} to ${String(full.end_date).slice(0, 10)}\n${full.on_shoots ? `Assigned to shoots/travel in that window: ${full.on_shoots}\n` : ''}${full.comp_notes ? `Comp reference: ${full.comp_notes}\n` : ''}\nApprove it in Team Management on the Unbridled hub.`,
        html: noticeHtml({ tag: 'Team', note: 'PTO / OOO — needs your review',
          title: full.title, subtitle: full.member_name,
          intro: `${full.member_name} submitted a PTO/OOO request that needs your review. Approve it in Team Management on the Unbridled hub.`,
          rows: [['Type', full.pto_type], ['Dates', `${String(full.start_date).slice(0, 10)} to ${String(full.end_date).slice(0, 10)}`],
                 ['Shoots/travel in that window', full.on_shoots || ''], ['Comp reference', full.comp_notes || '']],
          postmark: new Date() }),
      }).catch(err => console.error('PTO email failed:', err.message));
    }
    res.status(201).json(full);
  } catch (e) { next(e); }
});

// PATCH /api/team/pto/:id — approve / edit / move status
router.patch('/pto/:id', requireAuth, async (req, res, next) => {
  try {
    const d = req.body;
    const status = d.approved === true ? 'APPROVED' : d.approved === false ? 'REVIEW' : (STATUSES.includes(d.status) ? d.status : undefined);
    const wasApproving = d.approved === true;
    const [row] = await sql`
      UPDATE pto_requests SET
        title = ${d.title !== undefined ? d.title : sql`title`},
        pto_type = ${d.ptoType !== undefined ? d.ptoType : sql`pto_type`},
        start_date = ${d.startDate !== undefined ? (d.startDate || null) : sql`start_date`},
        end_date = ${d.endDate !== undefined ? (d.endDate || null) : sql`end_date`},
        comp_notes = ${d.compNotes !== undefined ? (d.compNotes || null) : sql`comp_notes`},
        manager_id = ${d.managerId !== undefined ? (d.managerId || null) : sql`manager_id`},
        status = ${status !== undefined ? status : sql`status`}
      WHERE id = ${req.params.id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Request not found' });
    if (wasApproving) {
      try {
        const [who] = await sql`SELECT ${sql.unsafe(PREF)} as n, cm.email FROM crew_members cm WHERE cm.id = ${row.member_id}`;
        if (who?.email) sendMail({ identity: 'team',
          to: who.email,
          subject: `Approved — ${row.title}`,
          text: `Your PTO/OOO request was approved.\n\nRequest: ${row.title}\nDates: ${String(row.start_date).slice(0, 10)} to ${String(row.end_date).slice(0, 10)}\n\nEnjoy!`,
          html: noticeHtml({ tag: 'Team', note: 'PTO / OOO approved', color: '#3f9d68',
            title: `${row.title} — Approved ✓`,
            intro: 'Your PTO/OOO request was approved. Enjoy!',
            rows: [['Dates', `${String(row.start_date).slice(0, 10)} to ${String(row.end_date).slice(0, 10)}`]],
            postmark: new Date() }),
        }).catch(err => console.error('PTO approval email failed:', err.message));
      } catch (err) { console.error('PTO approval lookup failed:', err.message); }
    }
    const all = await LIST();
    res.json(all.find(r => r.id === row.id));
  } catch (e) { next(e); }
});

router.delete('/pto/:id', requireAuth, async (req, res, next) => {
  try {
    await sql`DELETE FROM pto_requests WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Misc. work events (golf tournaments, retreats, office visits, …) ──────────
// Tagged people are crew_member ids; the calendar resolves them to names.
const asIdArray = v => Array.isArray(v) ? v.filter(Boolean).map(String) : [];

async function eventsList() {
  const rows = await sql`SELECT id, name, start_date, end_date, location, people, created_at FROM misc_events ORDER BY start_date NULLS LAST, created_at`;
  const ids = [...new Set(rows.flatMap(r => asIdArray(r.people)))];
  const names = ids.length
    ? Object.fromEntries((await sql`SELECT id, ${sql.unsafe(PREF)} as n FROM crew_members cm WHERE id = ANY(${ids})`).map(m => [m.id, m.n]))
    : {};
  return rows.map(r => ({ ...r, people: asIdArray(r.people), peopleNames: asIdArray(r.people).map(id => names[id]).filter(Boolean) }));
}

router.get('/events', requireAuth, async (req, res, next) => {
  try { res.json(await eventsList()); } catch (e) { next(e); }
});

router.post('/events', requireAuth, async (req, res, next) => {
  try {
    const { name, startDate, endDate, location, people } = req.body || {};
    if (!name?.trim() || !startDate || !endDate) {
      return res.status(400).json({ error: 'Event name, start date, and end date are required' });
    }
    const [row] = await sql`
      INSERT INTO misc_events (name, start_date, end_date, location, people, created_by)
      VALUES (${name.trim()}, ${startDate}, ${endDate}, ${location || null}, ${JSON.stringify(asIdArray(people))}, ${req.user.name || req.user.email})
      RETURNING id`;
    const all = await eventsList();
    res.status(201).json(all.find(r => r.id === row.id));
  } catch (e) { next(e); }
});

router.patch('/events/:id', requireAuth, async (req, res, next) => {
  try {
    const d = req.body || {};
    const [row] = await sql`
      UPDATE misc_events SET
        name = ${d.name !== undefined ? d.name : sql`name`},
        start_date = ${d.startDate !== undefined ? d.startDate : sql`start_date`},
        end_date = ${d.endDate !== undefined ? d.endDate : sql`end_date`},
        location = ${d.location !== undefined ? d.location : sql`location`},
        people = ${d.people !== undefined ? JSON.stringify(asIdArray(d.people)) : sql`people`}
      WHERE id = ${req.params.id} RETURNING id`;
    if (!row) return res.status(404).json({ error: 'Event not found' });
    const all = await eventsList();
    res.json(all.find(r => r.id === row.id));
  } catch (e) { next(e); }
});

router.delete('/events/:id', requireAuth, async (req, res, next) => {
  try {
    await sql`DELETE FROM misc_events WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
