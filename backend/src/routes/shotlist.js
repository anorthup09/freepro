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
    const { name, description, sceneType, dayId, estStartTime } = req.body;
    const [{ max_num }] = await sql`SELECT COALESCE(MAX(scene_number), 0) as max_num FROM shot_list_scenes WHERE project_id = ${req.params.id}`;
    const [scene_num] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 as n FROM shot_list_scenes WHERE project_id = ${req.params.id}`;
    const [scene] = await sql`
      INSERT INTO shot_list_scenes (id, project_id, scene_number, name, description, scene_type, sort_order, day_id, est_start_time)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${Number(max_num) + 1}, ${name}, ${description||null}, ${sceneType||'interior'}, ${Number(scene_num.n)}, ${dayId||null}, ${estStartTime||null})
      RETURNING *`;
    res.status(201).json({ ...scene, shots: [] });
  } catch(e) { next(e); }
});

// PATCH /api/projects/:id/shot-list/scenes/:sceneId
router.patch('/:id/shot-list/scenes/:sceneId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, description, sceneType, estStartTime, dayId } = req.body;
    const [scene] = await sql`
      UPDATE shot_list_scenes SET
        name = COALESCE(${name??null}, name),
        description = ${description !== undefined ? (description||null) : sql`description`},
        scene_type = COALESCE(${sceneType??null}, scene_type),
        est_start_time = ${estStartTime !== undefined ? (estStartTime||null) : sql`est_start_time`},
        day_id = ${dayId !== undefined ? (dayId||null) : sql`day_id`}
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
    const { description, distance, movement, priority, estMinutes, status,
            setupMinutes, takesCount, takeMinutes, bufferMinutes } = req.body;
    const [{ n }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 as n FROM shot_list_shots WHERE scene_id = ${req.params.sceneId}`;
    const [shot] = await sql`
      INSERT INTO shot_list_shots (id, scene_id, description, distance, movement, priority, est_minutes, status, sort_order, setup_minutes, takes_count, take_minutes, buffer_minutes)
      VALUES (gen_random_uuid()::text, ${req.params.sceneId}, ${description||null}, ${distance||null}, ${movement||null}, ${priority||'Important'}, ${estMinutes||15}, ${status||'not_captured'}, ${Number(n)}, ${Number(setupMinutes??5)}, ${Number(takesCount??1)}, ${Number(takeMinutes??5)}, ${Number(bufferMinutes??5)})
      RETURNING *`;
    res.status(201).json(shot);
  } catch(e) { next(e); }
});

// PATCH /api/projects/:id/shot-list/shots/:shotId
router.patch('/:id/shot-list/shots/:shotId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { description, distance, movement, priority, estMinutes, status,
            angle, lens, frameRate, coverage, talentTags, specialEquipment, audioNotes,
            setupMinutes, takesCount, takeMinutes, bufferMinutes, sortOrder } = req.body;
    const [shot] = await sql`
      UPDATE shot_list_shots SET
        description = COALESCE(${description??null}, description),
        distance = ${distance !== undefined ? (distance||null) : sql`distance`},
        movement = ${movement !== undefined ? (movement||null) : sql`movement`},
        priority = COALESCE(${priority??null}, priority),
        est_minutes = COALESCE(${estMinutes??null}, est_minutes),
        status = COALESCE(${status??null}, status),
        angle = ${angle !== undefined ? (angle||null) : sql`angle`},
        lens = ${lens !== undefined ? (lens||null) : sql`lens`},
        frame_rate = ${frameRate !== undefined ? (frameRate||null) : sql`frame_rate`},
        coverage = ${coverage !== undefined ? (coverage||null) : sql`coverage`},
        talent_tags = ${talentTags !== undefined ? sql.json(talentTags) : sql`talent_tags`},
        special_equipment = ${specialEquipment !== undefined ? (specialEquipment||null) : sql`special_equipment`},
        audio_notes = ${audioNotes !== undefined ? (audioNotes||null) : sql`audio_notes`},
        setup_minutes = ${setupMinutes !== undefined ? Number(setupMinutes||0) : sql`setup_minutes`},
        takes_count = ${takesCount !== undefined ? Number(takesCount||1) : sql`takes_count`},
        take_minutes = ${takeMinutes !== undefined ? Number(takeMinutes||0) : sql`take_minutes`},
        buffer_minutes = ${bufferMinutes !== undefined ? Number(bufferMinutes??2) : sql`buffer_minutes`},
        sort_order = ${sortOrder !== undefined ? Number(sortOrder) : sql`sort_order`}
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

// GET /api/projects/:id/shot-list/days
router.get('/:id/shot-list/days', requireAuth, async (req, res, next) => {
  try {
    const days = await sql`SELECT * FROM shot_list_days WHERE project_id = ${req.params.id} ORDER BY sort_order, day_number`;
    res.json(days);
  } catch(e) { next(e); }
});

// POST /api/projects/:id/shot-list/days
router.post('/:id/shot-list/days', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { date, callTime, shootingCall, lunchTime, estWrap } = req.body;
    const [{ max_num }] = await sql`SELECT COALESCE(MAX(day_number), 0) as max_num FROM shot_list_days WHERE project_id = ${req.params.id}`;
    const [{ n }] = await sql`SELECT COALESCE(MAX(sort_order), 0) + 1 as n FROM shot_list_days WHERE project_id = ${req.params.id}`;
    const [day] = await sql`
      INSERT INTO shot_list_days (id, project_id, day_number, date, call_time, shooting_call, lunch_time, est_wrap, sort_order)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${Number(max_num)+1}, ${date||null}, ${callTime||null}, ${shootingCall||null}, ${lunchTime||null}, ${estWrap||null}, ${Number(n)})
      RETURNING *`;
    res.status(201).json(day);
  } catch(e) { next(e); }
});

// PATCH /api/projects/:id/shot-list/days/:dayId
router.patch('/:id/shot-list/days/:dayId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { date, callTime, shootingCall, lunchTime, estWrap } = req.body;
    const [day] = await sql`
      UPDATE shot_list_days SET
        date = ${date !== undefined ? (date||null) : sql`date`},
        call_time = ${callTime !== undefined ? (callTime||null) : sql`call_time`},
        shooting_call = ${shootingCall !== undefined ? (shootingCall||null) : sql`shooting_call`},
        lunch_time = ${lunchTime !== undefined ? (lunchTime||null) : sql`lunch_time`},
        est_wrap = ${estWrap !== undefined ? (estWrap||null) : sql`est_wrap`}
      WHERE id = ${req.params.dayId} RETURNING *`;
    if (!day) return res.status(404).json({ error: 'Shot list day not found — please refresh the page and try again.' });
    res.json(day);
  } catch(e) { next(e); }
});

// DELETE /api/projects/:id/shot-list/days/:dayId
router.delete('/:id/shot-list/days/:dayId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`UPDATE shot_list_scenes SET day_id = NULL WHERE day_id = ${req.params.dayId}`;
    await sql`DELETE FROM shot_list_days WHERE id = ${req.params.dayId}`;
    res.json({ ok: true });
  } catch(e) { next(e); }
});

// GET /api/projects/:id/shot-list/breaks
router.get('/:id/shot-list/breaks', requireAuth, async (req, res, next) => {
  try {
    const breaks = await sql`SELECT * FROM shot_list_breaks WHERE project_id = ${req.params.id} ORDER BY sort_order, created_at`;
    res.json(breaks);
  } catch(e) { next(e); }
});

// POST /api/projects/:id/shot-list/breaks
router.post('/:id/shot-list/breaks', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { dayId, startTime, endTime } = req.body;
    const [b] = await sql`
      INSERT INTO shot_list_breaks (project_id, day_id, start_time, end_time)
      VALUES (${req.params.id}, ${dayId||null}, ${startTime||null}, ${endTime||null})
      RETURNING *
    `;
    res.json(b);
  } catch(e) { next(e); }
});

// PATCH /api/projects/:id/shot-list/breaks/:breakId
router.patch('/:id/shot-list/breaks/:breakId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { dayId, startTime, endTime } = req.body;
    const [b] = await sql`
      UPDATE shot_list_breaks SET
        day_id = ${dayId !== undefined ? (dayId||null) : sql`day_id`},
        start_time = ${startTime !== undefined ? (startTime||null) : sql`start_time`},
        end_time = ${endTime !== undefined ? (endTime||null) : sql`end_time`}
      WHERE id = ${req.params.breakId} AND project_id = ${req.params.id}
      RETURNING *
    `;
    res.json(b);
  } catch(e) { next(e); }
});

// DELETE /api/projects/:id/shot-list/breaks/:breakId
router.delete('/:id/shot-list/breaks/:breakId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`DELETE FROM shot_list_breaks WHERE id = ${req.params.breakId} AND project_id = ${req.params.id}`;
    res.json({ ok: true });
  } catch(e) { next(e); }
});

module.exports = router;
