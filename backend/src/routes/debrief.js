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

// GET /api/debrief/report — auto-populated with every client; each expands to
// its programs, then projects (by year), then Start/Stop/Continue/Notes.
router.get('/debrief/report', requireAuth, async (req, res, next) => {
  try {
    // All clients come from the full project roster (not just those with debriefs).
    const projects = await sql`
      SELECT id, code, title, client, program, start_date, created_at
      FROM projects WHERE COALESCE(NULLIF(TRIM(client), ''), '') <> ''`;
    const entries = await sql`
      SELECT id, project_id, kind, text, author_name, created_at
      FROM project_debriefs ORDER BY created_at`;
    const byProject = new Map();
    for (const e of entries) {
      if (!byProject.has(e.project_id)) byProject.set(e.project_id, []);
      byProject.get(e.project_id).push({ id: e.id, kind: e.kind, text: e.text, author_name: e.author_name, created_at: e.created_at });
    }
    // client -> list of projects that carry debriefs
    const clients = new Map();
    for (const p of projects) {
      const client = p.client.trim();
      if (!clients.has(client)) clients.set(client, []);
      const es = byProject.get(p.id) || [];
      if (!es.length) continue;                      // list only projects with debriefs under a client
      const when = p.start_date || p.created_at;
      clients.get(client).push({
        id: p.id, code: p.code, title: p.title, program: p.program || null,
        year: when ? new Date(when).getFullYear() : null, entries: es,
      });
    }
    const report = [...clients.entries()].map(([client, projs]) => {
      // Group each client's projects by program (untagged under null).
      const programs = new Map();
      for (const pr of projs) { const key = pr.program || ''; if (!programs.has(key)) programs.set(key, []); programs.get(key).push(pr); }
      return {
        client,
        count: projs.reduce((a, p) => a + p.entries.length, 0),
        programs: [...programs.entries()]
          .map(([program, ps]) => ({ program: program || null, projects: ps.sort((a, b) => (b.year || 0) - (a.year || 0) || String(b.code).localeCompare(String(a.code))) }))
          .sort((a, b) => (a.program ? 0 : 1) - (b.program ? 0 : 1) || String(a.program || '').localeCompare(String(b.program || ''))),
      };
    }).sort((a, b) => b.count - a.count || a.client.localeCompare(b.client));
    res.json(report);
  } catch (e) { next(e); }
});

module.exports = router;
