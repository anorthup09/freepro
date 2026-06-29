const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/:id/deliverables', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM deliverables WHERE project_id = ${req.params.id} ORDER BY created_at`); } catch(e){next(e);}
});

router.post('/:id/deliverables', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [item] = await sql`
      INSERT INTO deliverables (id, project_id, title, description, editor_name, aspect_ratio, resolution, due_date, asset_ref, music_ref, is_urgent, notes)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${d.title}, ${d.description||null}, ${d.editorName||null}, ${d.aspectRatio||null}, ${d.resolution||null}, ${d.dueDate||null}, ${d.assetRef||null}, ${d.musicRef||null}, ${d.isUrgent||false}, ${d.notes||null})
      RETURNING *`;
    res.status(201).json(item);
  } catch(e){next(e);}
});

router.patch('/:id/deliverables/:did', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [item] = await sql`
      UPDATE deliverables SET
        title=COALESCE(${d.title??null},title), description=COALESCE(${d.description??null},description),
        status=COALESCE(${d.status??null}::deliverable_status,status), editor_name=COALESCE(${d.editorName??null},editor_name),
        aspect_ratio=COALESCE(${d.aspectRatio??null},aspect_ratio), resolution=COALESCE(${d.resolution??null},resolution),
        due_date=COALESCE(${d.dueDate??null},due_date), music_ref=COALESCE(${d.musicRef??null},music_ref),
        is_urgent=COALESCE(${d.isUrgent??null},is_urgent)
      WHERE id=${req.params.did} RETURNING *`;
    res.json(item);
  } catch(e){next(e);}
});

router.delete('/:id/deliverables/:did', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM deliverables WHERE id = ${req.params.did}`; res.status(204).end(); } catch(e){next(e);}
});

module.exports = router;
