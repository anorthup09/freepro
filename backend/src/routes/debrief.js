const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

// Project debriefs — Start / Stop / Continue / Note, authored + dated, compiled
// over a project's life and rolled up by client across years for the report.
const KINDS = ['start', 'stop', 'continue', 'note'];

// GET /api/projects/:id/debrief — entries for one project
router.get('/projects/:id/debrief', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT id, project_id, kind, text, author_name, author_email, created_at
      FROM project_debriefs WHERE project_id = ${req.params.id}
      ORDER BY created_at DESC`;
    res.json(rows);
  } catch (e) { next(e); }
});

// POST /api/projects/:id/debrief — add an entry (author from the session)
router.post('/projects/:id/debrief', requireAuth, async (req, res, next) => {
  try {
    const { kind, text } = req.body || {};
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Invalid debrief type' });
    if (!text?.trim()) return res.status(400).json({ error: 'Text is required' });
    const [row] = await sql`
      INSERT INTO project_debriefs (project_id, kind, text, author_name, author_email)
      VALUES (${req.params.id}, ${kind}, ${text.trim()}, ${req.user.name || req.user.email}, ${(req.user.email || '').toLowerCase()})
      RETURNING id, project_id, kind, text, author_name, author_email, created_at`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// PATCH /api/debrief/:entryId — edit text/kind
router.patch('/debrief/:entryId', requireAuth, async (req, res, next) => {
  try {
    const d = req.body || {};
    if (d.kind !== undefined && !KINDS.includes(d.kind)) return res.status(400).json({ error: 'Invalid debrief type' });
    const [row] = await sql`
      UPDATE project_debriefs SET
        text = ${d.text !== undefined ? d.text : sql`text`},
        kind = ${d.kind !== undefined ? d.kind : sql`kind`}
      WHERE id = ${req.params.entryId}
      RETURNING id, project_id, kind, text, author_name, author_email, created_at`;
    if (!row) return res.status(404).json({ error: 'Entry not found' });
    res.json(row);
  } catch (e) { next(e); }
});

// DELETE /api/debrief/:entryId
router.delete('/debrief/:entryId', requireAuth, async (req, res, next) => {
  try {
    await sql`DELETE FROM project_debriefs WHERE id = ${req.params.entryId}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

// GET /api/debrief/report — every debrief grouped by client, then project (year).
router.get('/debrief/report', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT d.id, d.project_id, d.kind, d.text, d.author_name, d.created_at,
             p.code, p.title, p.client, p.start_date, p.created_at as project_created
      FROM project_debriefs d
      JOIN projects p ON p.id = d.project_id
      ORDER BY d.created_at`;
    // Group: client -> project -> entries
    const clients = new Map();
    for (const r of rows) {
      const client = r.client || 'Unassigned';
      if (!clients.has(client)) clients.set(client, new Map());
      const projs = clients.get(client);
      if (!projs.has(r.project_id)) {
        const when = r.start_date || r.project_created;
        projs.set(r.project_id, {
          id: r.project_id, code: r.code, title: r.title,
          year: when ? new Date(when).getFullYear() : null,
          entries: [],
        });
      }
      projs.get(r.project_id).entries.push({
        id: r.id, kind: r.kind, text: r.text, author_name: r.author_name, created_at: r.created_at,
      });
    }
    const report = [...clients.entries()]
      .map(([client, projs]) => ({
        client,
        count: [...projs.values()].reduce((a, p) => a + p.entries.length, 0),
        projects: [...projs.values()].sort((a, b) => (b.year || 0) - (a.year || 0) || String(b.code).localeCompare(String(a.code))),
      }))
      .sort((a, b) => a.client.localeCompare(b.client));
    res.json(report);
  } catch (e) { next(e); }
});

module.exports = router;
