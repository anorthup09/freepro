const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /api/projects/:id/shot-list
router.get('/:id/shot-list', requireAuth, async (req, res, next) => {
  try {
    const scenes = await sql`
      SELECT * FROM shot_list_scenes WHERE project_id = ${req.params.id} ORDER BY sort_order, scene_number`;
    const shots = scenes.length
      ? await sql`SELECT * FROM shot_list_shots WHERE scene_id = ANY(${sql.array(scenes.map(s => s.id))}) ORDER BY sort_order, created_at`
      : [];
    const shotsById = {};
    shots.forEach(sh => { (shotsById[sh.scene_id] = shotsById[sh.scene_id] || []).push(sh); });
    res.json(scenes.map(s => ({ ...s, shots: shotsById[s.id] || [] })));
  } catch(e) { next(e); }
});

// POST /api/projects/:id/shot-list/scenes
router.post('/:id/shot-list/scenes', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, description, sceneType } = req.body;
    const [{ max_num }] = await sql`SELECT COALESCE(MAX(scene_number), 0) as max_num FROM shot_list_scenes WHERE project_id = ${req.params.id}`;
    const [scene_num] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 as n FROM shot_list_scenes WHERE project_id = ${req.params.id}`;
    const [scene] = await sql`
      INSERT INTO shot_list_scenes (id, project_id, scene_number, name, description, scene_type, sort_order)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${Number(max_num) + 1}, ${name}, ${description||null}, ${sceneType||'interior'}, ${Number(scene_num.n)})
      RETURNING *`;
    res.status(201).json({ ...scene, shots: [] });
  } catch(e) { next(e); }
});

// PATCH /api/projects/:id/shot-list/scenes/:sceneId
router.patch('/:id/shot-list/scenes/:sceneId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, description, sceneType, estStartTime } = req.body;
    const [scene] = await sql`
      UPDATE shot_list_scenes SET
        name = COALESCE(${name??null}, name),
        description = ${description !== undefined ? (description||null) : sql`description`},
        scene_type = COALESCE(${sceneType??null}, scene_type),
        est_start_time = ${estStartTime !== undefined ? (estStartTime||null) : sql`est_start_time`}
      WHERE id = ${req.params.sceneId} RETURNING *`;
    res.json(scene);
  } catch(e) { next(e); }
});

// DELETE /api/projects/:id/shot-list/scenes/:sceneId
router.delete('/:id/shot-list/scenes/:sceneId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`DELETE FROM shot_list_scenes WHERE id = ${req.params.sceneId}`;
    res.json({ ok: true });
  } catch(e) { next(e); }
});

// POST /api/projects/:id/shot-list/scenes/:sceneId/shots
router.post('/:id/shot-list/scenes/:sceneId/shots', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { description, distance, movement, priority, estMinutes, status } = req.body;
    const [{ n }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 as n FROM shot_list_shots WHERE scene_id = ${req.params.sceneId}`;
    const [shot] = await sql`
      INSERT INTO shot_list_shots (id, scene_id, description, distance, movement, priority, est_minutes, status, sort_order)
      VALUES (gen_random_uuid()::text, ${req.params.sceneId}, ${description||null}, ${distance||null}, ${movement||null}, ${priority||'Important'}, ${estMinutes||9}, ${status||'not_captured'}, ${Number(n)})
      RETURNING *`;
    res.status(201).json(shot);
  } catch(e) { next(e); }
});

// PATCH /api/projects/:id/shot-list/shots/:shotId
router.patch('/:id/shot-list/shots/:shotId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { description, distance, movement, priority, estMinutes, status } = req.body;
    const [shot] = await sql`
      UPDATE shot_list_shots SET
        description = COALESCE(${description??null}, description),
        distance = ${distance !== undefined ? (distance||null) : sql`distance`},
        movement = ${movement !== undefined ? (movement||null) : sql`movement`},
        priority = COALESCE(${priority??null}, priority),
        est_minutes = COALESCE(${estMinutes??null}, est_minutes),
        status = COALESCE(${status??null}, status)
      WHERE id = ${req.params.shotId} RETURNING *`;
    res.json(shot);
  } catch(e) { next(e); }
});

// DELETE /api/projects/:id/shot-list/shots/:shotId
router.delete('/:id/shot-list/shots/:shotId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`DELETE FROM shot_list_shots WHERE id = ${req.params.shotId}`;
    res.json({ ok: true });
  } catch(e) { next(e); }
});

module.exports = router;
