const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const staff = [requireAuth, requireRole('ADMIN', 'PRODUCER')];

const PREF = "COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name)";

// GET /project-overview/:pid — everything the cover page needs
router.get('/project-overview/:pid', ...staff, async (req, res, next) => {
  try {
    const [project] = await sql`SELECT id, code, title, client FROM projects WHERE id = ${req.params.pid}`;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [budget] = await sql`SELECT status, close_month FROM budgets WHERE project_id = ${project.id} AND COALESCE(kind, 'main') = 'main' LIMIT 1`;
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
    res.json({ project, budgetStatus: budget?.status || null, closeMonth: budget?.close_month || null, shoots, edits, callNotes, tasks });
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

module.exports = router;
