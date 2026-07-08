const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const staff = [requireAuth, requireRole('ADMIN', 'PRODUCER')];

const PREF = "COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name)";

// Same math as ProFi's pipeline rollup (finance.js)
function lineSubtotal(l, sectionLines) {
  if (l.percent != null) {
    const base = sectionLines.filter(x => x.percent == null && !x.is_travel).reduce((s, x) => s + Number(x.qty || 0) * Number(x.unit_cost || 0), 0);
    return Number(l.percent) * base * Number(l.qty || 0);
  }
  return Number(l.qty || 0) * Number(l.unit_cost || 0);
}
function budgetTotal(allLines, mgmtRate) {
  const bySection = {};
  for (const l of allLines) (bySection[l.section_id] ||= []).push(l);
  let nonTravel = 0, travel = 0;
  for (const secLines of Object.values(bySection)) {
    for (const l of secLines) {
      const st = lineSubtotal(l, secLines);
      if (l.is_travel) travel += st; else nonTravel += st;
    }
  }
  const fee = mgmtRate * nonTravel;
  return { total: nonTravel + travel + fee, fee };
}

// GET /project-overview/:pid — everything the cover page needs
router.get('/project-overview/:pid', ...staff, async (req, res, next) => {
  try {
    const [project] = await sql`SELECT id, code, title, client FROM projects WHERE id = ${req.params.pid}`;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [budget] = await sql`SELECT id, status, close_month, mgmt_fee_rate FROM budgets WHERE project_id = ${project.id} AND COALESCE(kind, 'main') = 'main' LIMIT 1`;
    let budgetAmount = null, budgetFee = null;
    if (budget) {
      const lines = await sql`SELECT qty, unit_cost, percent, is_travel, section_id FROM budget_lines WHERE budget_id = ${budget.id}`;
      const { total } = budgetTotal(lines, Number(budget.mgmt_fee_rate ?? 0.15));
      budgetAmount = Math.round(total * 100) / 100;
      // "Est Fee" = billable profit from the VCC: budget total minus vendor costs
      const [vcc] = await sql`SELECT COALESCE(SUM(amount), 0) as total FROM vcc_entries WHERE project_id = ${project.id}`;
      budgetFee = Math.round((total - Number(vcc.total)) * 100) / 100;
    }
    const shoots = await sql`
      SELECT id, code, title, city, state, status, start_date, end_date
      FROM projects WHERE parent_project_id = ${project.id} ORDER BY start_date NULLS LAST, code`;
    const edits = await sql`
      SELECT e.id, e.title, e.status, e.version, e.end_date,
             COALESCE((SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = e.lead_editor_id), e.lead_editor_name) as lead_editor
      FROM edits e
      WHERE e.project_code = ${project.code} OR e.project_code LIKE ${project.code + '-%'}
      ORDER BY e.tracker_sort NULLS LAST, e.end_date NULLS LAST, e.created_at`;
    const callNotes = await sql`
      SELECT * FROM project_call_notes WHERE project_id = ${project.id} ORDER BY call_date DESC NULLS LAST, created_at DESC`;
    const tasks = await sql`
      SELECT t.*, (SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = t.assignee_id) as assignee_name
      FROM project_tasks t WHERE t.project_id = ${project.id}
      ORDER BY t.done, t.due_date NULLS LAST, t.sort, t.created_at`;
    const docs = await sql`
      SELECT id, kind, filename, mime, size, uploaded_by, created_at
      FROM project_docs WHERE project_id = ${project.id} ORDER BY kind, created_at DESC`;
    res.json({ project, budgetStatus: budget?.status || null, budgetAmount, budgetFee, closeMonth: budget?.close_month || null, shoots, edits, callNotes, tasks, docs });
  } catch (e) { next(e); }
});

// ── Client call notes ──
router.post('/project-overview/:pid/call-notes', ...staff, async (req, res, next) => {
  try {
    const [n] = await sql`
      INSERT INTO project_call_notes (project_id, call_date, note, created_by)
      VALUES (${req.params.pid}, ${req.body.callDate || new Date().toISOString().slice(0, 10)}, ${req.body.note || ''}, ${req.user.name || req.user.email})
      RETURNING *`;
    res.status(201).json(n);
  } catch (e) { next(e); }
});
router.patch('/call-notes/:id', ...staff, async (req, res, next) => {
  try {
    const [n] = await sql`UPDATE project_call_notes SET
        call_date = ${req.body.callDate !== undefined ? (req.body.callDate || null) : sql`call_date`},
        note = ${req.body.note !== undefined ? req.body.note : sql`note`}
      WHERE id = ${req.params.id} RETURNING *`;
    if (!n) return res.status(404).json({ error: 'Note not found' });
    res.json(n);
  } catch (e) { next(e); }
});
router.delete('/call-notes/:id', ...staff, async (req, res, next) => {
  try {
    await sql`DELETE FROM project_call_notes WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── One-off project tasks ──
router.post('/project-overview/:pid/tasks', ...staff, async (req, res, next) => {
  try {
    const [t] = await sql`
      INSERT INTO project_tasks (project_id, text, created_by)
      VALUES (${req.params.pid}, ${req.body.text || ''}, ${req.user.name || req.user.email})
      RETURNING *, NULL as assignee_name`;
    res.status(201).json(t);
  } catch (e) { next(e); }
});
// Any signed-in user can update a task (crew check them off from the hub dashboard)
router.patch('/project-tasks/:id', requireAuth, async (req, res, next) => {
  try {
    const b = req.body;
    const [t] = await sql`UPDATE project_tasks SET
        text = ${b.text !== undefined ? b.text : sql`text`},
        assignee_id = ${b.assigneeId !== undefined ? (b.assigneeId || null) : sql`assignee_id`},
        due_date = ${b.dueDate !== undefined ? (b.dueDate || null) : sql`due_date`},
        done = ${b.done !== undefined ? b.done === true : sql`done`},
        notes = ${b.notes !== undefined ? (b.notes || null) : sql`notes`},
        sort = ${b.sort !== undefined ? (Number(b.sort) || 0) : sql`sort`}
      WHERE id = ${req.params.id} RETURNING *`;
    if (!t) return res.status(404).json({ error: 'Task not found' });
    const [named] = await sql`
      SELECT t.*, (SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = t.assignee_id) as assignee_name
      FROM project_tasks t WHERE t.id = ${t.id}`;
    res.json(named);
  } catch (e) { next(e); }
});
router.delete('/project-tasks/:id', ...staff, async (req, res, next) => {
  try {
    await sql`DELETE FROM project_tasks WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Project documents (creative briefs, VPPs) ──
router.post('/project-overview/:pid/docs', ...staff, async (req, res, next) => {
  try {
    const { filename, mime, fileBase64, kind } = req.body;
    if (!filename || !fileBase64) return res.status(400).json({ error: 'filename and file required' });
    const buf = Buffer.from(fileBase64, 'base64');
    if (buf.length > 25 * 1024 * 1024) return res.status(400).json({ error: 'File too large (25MB max)' });
    const [d] = await sql`
      INSERT INTO project_docs (project_id, kind, filename, mime, size, data, uploaded_by)
      VALUES (${req.params.pid}, ${['vpp', 'extra'].includes(kind) ? kind : 'brief'}, ${filename}, ${mime || null}, ${buf.length}, ${buf}, ${req.user.name || req.user.email})
      RETURNING id, kind, filename, mime, size, uploaded_by, created_at`;
    res.status(201).json(d);
  } catch (e) { next(e); }
});
router.get('/project-overview/:pid/docs', ...staff, async (req, res, next) => {
  try {
    const kind = req.query.kind;
    res.json(await sql`
      SELECT id, kind, filename, mime, size, uploaded_by, created_at FROM project_docs
      WHERE project_id = ${req.params.pid} AND (${kind || null}::text IS NULL OR kind = ${kind || null})
      ORDER BY created_at DESC`);
  } catch (e) { next(e); }
});
router.get('/project-docs/:id/file', requireAuth, async (req, res, next) => {
  try {
    const [f] = await sql`SELECT filename, mime, data FROM project_docs WHERE id = ${req.params.id}`;
    if (!f) return res.status(404).json({ error: 'Document not found' });
    res.setHeader('Content-Type', f.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${req.query.inline ? 'inline' : 'attachment'}; filename="${f.filename.replace(/"/g, '')}"`);
    res.send(f.data);
  } catch (e) { next(e); }
});
router.delete('/project-docs/:id', ...staff, async (req, res, next) => {
  try {
    await sql`DELETE FROM project_docs WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
