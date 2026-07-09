const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');
const { displayCodes } = require('../lib/displayCode');

const GEAR_REQUEST_TO = 'mvitro@unbridledmedia.com';

// Build a human-readable change report between an old and a new gear request.
// List fields (camera/lights/grip/other/crew/drives) diff item-by-item —
// showing what's new (+) and what's been removed (-). Scalars show old → new.
function amendmentReport(oldR, newR, author) {
  const clean = x => x.trim();
  const keep = x => x && !/^[—–-]+$/.test(x); // drop empty + placeholder dashes
  const splitLines = s => String(s || '').split(/\r?\n/).map(clean).filter(keep);
  const splitCommas = s => String(s || '').split(',').map(clean).filter(keep);
  const isoDate = d => { if (!d) return ''; const dt = new Date(d); return isNaN(dt) ? String(d).slice(0, 10) : dt.toISOString().slice(0, 10); };
  const listFields = [
    ['Crew traveling with gear', splitCommas(oldR.crew), splitCommas(newR.crew)],
    ['Camera gear', splitLines(oldR.camera), splitLines(newR.camera)],
    ['Lights', splitLines(oldR.lights), splitLines(newR.lights)],
    ['Grip', splitLines(oldR.grip), splitLines(newR.grip)],
    ['Other', splitLines(oldR.other), splitLines(newR.other)],
    ['Media drives', splitCommas(oldR.drives), splitCommas(newR.drives)],
  ];
  const scalars = [
    ['Check-Out', isoDate(oldR.check_out), newR.checkOut],
    ['Check-In', isoDate(oldR.check_in), newR.checkIn],
    ['How gear is moving', oldR.moving, newR.moving],
    ['Drive size', oldR.drive_size, newR.driveSize],
    ['Drive quantity', oldR.drive_qty, newR.driveQty],
    ['Special instructions', oldR.notes, newR.notes],
  ];

  const sections = [];
  for (const [label, oldList, newList] of listFields) {
    const added = newList.filter(x => !oldList.some(o => o.toLowerCase() === x.toLowerCase()));
    const removed = oldList.filter(x => !newList.some(n => n.toLowerCase() === x.toLowerCase()));
    if (!added.length && !removed.length) continue;
    const lines = [...added.map(x => `+ ${x}`), ...removed.map(x => `- ${x}`)];
    sections.push(`${label}:\n${lines.map(l => '  ' + l).join('\n')}`);
  }
  for (const [label, oldV, newV] of scalars) {
    const o = (oldV || '').toString().trim(); const n = (newV || '').toString().trim();
    if (o === n) continue;
    sections.push(`${label}: ${o || '—'} → ${n || '—'}`);
  }

  const header = `Gear request amended${author ? ` by ${author}` : ''}.`;
  if (!sections.length) return `${header}\nNo changes to the gear list.`;
  return `${header}\n\n${sections.join('\n\n')}`;
}

// All gear requests (gear management view)
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT g.*, p.code, p.title, p.client
      FROM gear_requests g JOIN projects p ON p.id = g.project_id
      ORDER BY g.created_at DESC`;
    const codes = await displayCodes(rows.map(r => r.project_id));
    res.json(rows.map(r => codes[r.project_id] ? { ...r, code: codes[r.project_id] } : r));
  } catch (e) { next(e); }
});

// Gear Management overview — one row per production shoot, sorted by start date.
// A shoot is a production project: it has a budget shoot section, or it's a
// FreePro production project with no main budget (excludes post-only projects).
router.get('/overview', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT p.id, p.code, p.title, p.subtitle, p.start_date, p.end_date, p.status,
             COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) AS person_responsible,
             g.id AS request_id, g.moving AS form_of_travel
      FROM projects p
      LEFT JOIN project_gear pg ON pg.project_id = p.id
      LEFT JOIN crew_members cm ON cm.id = pg.gear_person_id
      LEFT JOIN gear_requests g ON g.project_id = p.id
      WHERE p.status != 'ARCHIVED'
        AND (NOT EXISTS (SELECT 1 FROM budgets b WHERE b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main')
             OR EXISTS (SELECT 1 FROM budgets b JOIN budget_sections bs ON bs.budget_id = b.id
                        WHERE b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main' AND bs.kind = 'shoot'))
      ORDER BY p.start_date NULLS LAST, p.code`;
    const codes = await displayCodes(rows.map(r => r.id));
    res.json(rows.map(r => ({ ...r, code: codes[r.id] || r.code, hasRequest: !!r.request_id })));
  } catch (e) { next(e); }
});

// Activity feed for one shoot's gear (comments + events)
router.get('/project/:pid/activity', requireAuth, async (req, res, next) => {
  try {
    res.json(await sql`SELECT * FROM gear_activity WHERE project_id = ${req.params.pid} ORDER BY created_at`);
  } catch (e) { next(e); }
});

router.post('/project/:pid/activity', requireAuth, async (req, res, next) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Comment required' });
    const author = req.user?.name || req.user?.email || null;
    const [row] = await sql`INSERT INTO gear_activity (project_id, kind, body, author)
      VALUES (${req.params.pid}, 'comment', ${body}, ${author}) RETURNING *`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// Projects that don't have a gear request yet (dropdown of unused codes)
router.get('/available-projects', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT p.id, p.code, p.title, p.client
      FROM projects p
      WHERE p.status != 'ARCHIVED'
        AND NOT EXISTS (SELECT 1 FROM gear_requests g WHERE g.project_id = p.id)
      ORDER BY p.code`;
    const codes = await displayCodes(rows.map(r => r.id));
    res.json(rows.map(r => codes[r.id] ? { ...r, code: codes[r.id] } : r));
  } catch (e) { next(e); }
});

// The gear request for one project (or 404)
router.get('/project/:pid', requireAuth, async (req, res, next) => {
  try {
    const [row] = await sql`
      SELECT g.*, p.code, p.title, p.client
      FROM gear_requests g JOIN projects p ON p.id = g.project_id
      WHERE g.project_id = ${req.params.pid}`;
    if (!row) return res.status(404).json({ error: 'No gear request yet' });
    res.json(row);
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const d = req.body || {};
    if (!d.projectId || !d.name || !d.crew || !d.checkOut || !d.checkIn || !d.moving || !(d.drives || []).length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const [existing] = await sql`SELECT id FROM gear_requests WHERE project_id = ${d.projectId}`;
    if (existing) return res.status(409).json({ error: 'A gear request already exists for that project' });
    const [row] = await sql`
      INSERT INTO gear_requests (project_id, name, crew, check_out, check_in, moving, camera, lights, grip, other, drives, drive_size, drive_qty, notes, submitted_by)
      VALUES (${d.projectId}, ${d.name}, ${d.crew}, ${d.checkOut}, ${d.checkIn}, ${d.moving}, ${d.camera || null}, ${d.lights || null}, ${d.grip || null}, ${d.other || null},
              ${(d.drives || []).join(', ')}, ${d.driveSize || null}, ${d.driveQty || null}, ${d.notes || null}, ${req.user?.email || null})
      RETURNING *`;
    await sql`INSERT INTO gear_activity (project_id, kind, body, author)
      VALUES (${d.projectId}, 'event', ${'Gear request submitted'}, ${d.name || req.user?.email || null})`.catch(() => {});
    const [proj] = await sql`SELECT code, title, client FROM projects WHERE id = ${d.projectId}`;
    const codes = await displayCodes([d.projectId]);
    const code = codes[d.projectId] || proj?.code || '';
    const lines = [
      `Project: ${code} — ${proj?.title || ''} (${proj?.client || ''})`,
      `Submitted by: ${d.name} (${req.user?.email || 'unknown'})`,
      `Traveling with gear: ${d.crew}`,
      `Check-Out: ${d.checkOut}`,
      `Check-In: ${d.checkIn}`,
      `How is this gear moving: ${d.moving}`,
      '',
      `Camera gear & accessories:\n${d.camera || '—'}`,
      '',
      `Lights & light peripherals:\n${d.lights || '—'}`,
      '',
      `Grip:\n${d.grip || '—'}`,
      '',
      `Other:\n${d.other || '—'}`,
      '',
      `Media drives: ${(d.drives || []).join(', ')}`,
      `Drive size: ${d.driveSize || '—'}    How many: ${d.driveQty || '—'}`,
      '',
      `Special instructions:\n${d.notes || '—'}`,
    ].join('\n');
    sendMail({
      to: GEAR_REQUEST_TO,
      subject: `Gear Request — ${code} ${proj?.title || ''}`,
      text: lines,
    }).catch(err => console.error('Gear request email failed:', err.message));
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// Amend an existing (locked) gear request. Diffs the submitted values against the
// stored ones, posts a change report to the activity feed, then saves the update.
router.post('/project/:pid/amend', requireAuth, async (req, res, next) => {
  try {
    const pid = req.params.pid;
    const d = req.body || {};
    if (!d.name || !d.crew || !d.checkOut || !d.checkIn || !d.moving || !(d.drives || []).length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const [oldR] = await sql`SELECT * FROM gear_requests WHERE project_id = ${pid}`;
    if (!oldR) return res.status(404).json({ error: 'No gear request to amend' });

    const report = amendmentReport(oldR, d, d.name || req.user?.name || req.user?.email);
    const [row] = await sql`
      UPDATE gear_requests SET
        name = ${d.name}, crew = ${d.crew}, check_out = ${d.checkOut}, check_in = ${d.checkIn}, moving = ${d.moving},
        camera = ${d.camera || null}, lights = ${d.lights || null}, grip = ${d.grip || null}, other = ${d.other || null},
        drives = ${(d.drives || []).join(', ')}, drive_size = ${d.driveSize || null}, drive_qty = ${d.driveQty || null},
        notes = ${d.notes || null}, submitted_by = ${req.user?.email || null}
      WHERE project_id = ${pid} RETURNING *`;

    // The change report lands in the activity feed for this shoot's gear dashboard.
    // TODO(email): tag Mason Vitro and email him the amendment — see EMAIL_TODO.md.
    await sql`INSERT INTO gear_activity (project_id, kind, body, author)
      VALUES (${pid}, 'event', ${report}, ${d.name || req.user?.email || null})`.catch(() => {});

    res.json(row);
  } catch (e) { next(e); }
});

module.exports = router;
