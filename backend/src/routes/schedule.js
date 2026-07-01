const router = require('express').Router();
const { z } = require('zod');
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

async function getDayFull(dayId) {
  const [day] = await sql`SELECT * FROM shoot_days WHERE id = ${dayId}`;
  if (!day) return null;
  const events = await sql`
    SELECT se.*, json_agg(DISTINCT jsonb_build_object('id',et.id,'type',et.type,'label',et.label)) FILTER (WHERE et.id IS NOT NULL) as tags,
           l.name as location_name, l.address as location_address
    FROM schedule_events se
    LEFT JOIN event_tags et ON et.event_id = se.id
    LEFT JOIN locations l ON l.id = se.location_id
    WHERE se.shoot_day_id = ${dayId}
    GROUP BY se.id, l.name, l.address
    ORDER BY se.start_time`;
  const crewCalls = await sql`
    SELECT cdc.*, ca.slot_number, ca.position_id, p.name as position_name,
           cm.id as cm_id, cm.name as cm_name, cm.phone as cm_phone
    FROM crew_day_calls cdc
    JOIN crew_assignments ca ON ca.id = cdc.crew_assignment_id
    JOIN positions p ON p.id = ca.position_id
    LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
    WHERE cdc.shoot_day_id = ${dayId}
    ORDER BY p.sort_order, ca.slot_number`;
  return {
    ...day,
    events: events.map(e => ({ ...e, tags: e.tags || [], location: e.location_name ? { name: e.location_name, address: e.location_address } : null })),
    crewCalls: crewCalls.map(c => ({
      ...c,
      crewAssignment: { id: c.crew_assignment_id, positionId: c.position_id, slotNumber: c.slot_number, position: { name: c.position_name }, crewMember: c.cm_id ? { id: c.cm_id, name: c.cm_name, phone: c.cm_phone } : null }
    })),
  };
}

// GET /api/projects/:id/schedule
router.get('/:id/schedule', requireAuth, async (req, res, next) => {
  try {
    const days = await sql`SELECT * FROM shoot_days WHERE project_id = ${req.params.id} ORDER BY day_number`;
    const full = await Promise.all(days.map(d => getDayFull(d.id)));
    res.json(full);
  } catch(e){next(e);}
});

// GET single day
router.get('/:id/schedule/days/:dayId', requireAuth, async (req, res, next) => {
  try {
    const day = await getDayFull(req.params.dayId);
    if (!day) return res.status(404).json({ error: 'Day not found' });
    res.json(day);
  } catch(e){next(e);}
});

// POST add day
router.post('/:id/schedule/days', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { dayNumber, date, callTime, wrapTime, weather, notes } = req.body;
    const [day] = await sql`
      INSERT INTO shoot_days (id, project_id, day_number, date, call_time, wrap_time, weather, notes)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${dayNumber}, ${date}, ${callTime||null}, ${wrapTime||null}, ${weather||null}, ${notes||null})
      RETURNING *`;
    res.status(201).json({ ...day, events: [], crewCalls: [] });
  } catch(e){
    if(e.code==='23505') return res.status(409).json({error:'Day number already exists'});
    next(e);
  }
});

// PATCH day
router.patch('/:id/schedule/days/:dayId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    // Auto-tag time fields with VIDEO+PHOTO if they're being set for the first time (no existing tags)
    const AUTO_TAGS = ['VIDEO', 'PHOTO'];
    const timeTagMap = [
      { timeField: 'callTime',         tagsField: 'callTimeTags',        dbTagsCol: 'call_time_tags' },
      { timeField: 'shootingCallTime', tagsField: 'shootingCallTags',    dbTagsCol: 'shooting_call_tags' },
      { timeField: 'lunchTime',        tagsField: 'lunchTags',           dbTagsCol: 'lunch_tags' },
      { timeField: 'wrapTime',         tagsField: 'wrapTimeTags',        dbTagsCol: 'wrap_time_tags' },
    ];
    if (timeTagMap.some(m => d[m.timeField] !== undefined && d[m.timeField])) {
      const [current] = await sql`SELECT call_time_tags,shooting_call_tags,lunch_tags,wrap_time_tags FROM shoot_days WHERE id=${req.params.dayId}`;
      if (current) {
        for (const { timeField, tagsField, dbTagsCol } of timeTagMap) {
          if (d[timeField] !== undefined && d[timeField] && d[tagsField] === undefined) {
            const existing = current[dbTagsCol] || [];
            if (existing.length === 0) d[tagsField] = AUTO_TAGS;
          }
        }
      }
    }

    const [day] = await sql`
      UPDATE shoot_days SET
        call_time=COALESCE(${d.callTime??null},call_time), wrap_time=COALESCE(${d.wrapTime??null},wrap_time),
        shooting_call_time=${d.shootingCallTime !== undefined ? (d.shootingCallTime||null) : sql`shooting_call_time`},
        lunch_time=${d.lunchTime !== undefined ? (d.lunchTime||null) : sql`lunch_time`},
        call_time_notes=${d.callTimeNotes !== undefined ? (d.callTimeNotes||null) : sql`call_time_notes`},
        call_time_tags=${d.callTimeTags !== undefined ? sql.array(d.callTimeTags) : sql`call_time_tags`},
        shooting_call_notes=${d.shootingCallNotes !== undefined ? (d.shootingCallNotes||null) : sql`shooting_call_notes`},
        shooting_call_tags=${d.shootingCallTags !== undefined ? sql.array(d.shootingCallTags) : sql`shooting_call_tags`},
        lunch_notes=${d.lunchNotes !== undefined ? (d.lunchNotes||null) : sql`lunch_notes`},
        lunch_tags=${d.lunchTags !== undefined ? sql.array(d.lunchTags) : sql`lunch_tags`},
        wrap_time_notes=${d.wrapTimeNotes !== undefined ? (d.wrapTimeNotes||null) : sql`wrap_time_notes`},
        wrap_time_tags=${d.wrapTimeTags !== undefined ? sql.array(d.wrapTimeTags) : sql`wrap_time_tags`},
        weather=COALESCE(${d.weather??null},weather), notes=COALESCE(${d.notes??null},notes),
        crew_lunch=${d.crewLunch !== undefined ? (d.crewLunch||null) : sql`crew_lunch`},
        gear_storage=${d.gearStorage !== undefined ? (d.gearStorage||null) : sql`gear_storage`},
        gs_audio=${d.gsAudio !== undefined ? (d.gsAudio||null) : sql`gs_audio`}
      WHERE id=${req.params.dayId} RETURNING *`;
    res.json(day);
  } catch(e){next(e);}
});

// DELETE day
router.delete('/:id/schedule/days/:dayId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM shoot_days WHERE id = ${req.params.dayId}`; res.status(204).end(); } catch(e){next(e);}
});

// POST event
router.post('/:id/schedule/days/:dayId/events', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { startTime, endTime, title, detail, locationId, isAlert, alertMessage, isFilming, isShootingCall, isLunch, tags=[], audience=[] } = req.body;
    const [ev] = await sql`
      INSERT INTO schedule_events (id, shoot_day_id, start_time, end_time, title, detail, location_id, is_alert, alert_message, is_filming, is_shooting_call, is_lunch, audience)
      VALUES (gen_random_uuid()::text, ${req.params.dayId}, ${startTime}, ${endTime||null}, ${title}, ${detail||null}, ${locationId||null}, ${isAlert||false}, ${alertMessage||null}, ${isFilming||false}, ${isShootingCall||false}, ${isLunch||false}, ${sql.array(audience)})
      RETURNING *`;
    if (tags.length) {
      await Promise.all(tags.map(t => sql`INSERT INTO event_tags (id, event_id, type, label) VALUES (gen_random_uuid()::text, ${ev.id}, ${t.type}::event_tag_type, ${t.label||null})`));
    }
    const [loc] = ev.location_id ? await sql`SELECT id, name, address FROM locations WHERE id = ${ev.location_id}` : [null];
    res.status(201).json({ ...ev, tags, location: loc ? { name: loc.name, address: loc.address } : null });
  } catch(e){next(e);}
});

// PATCH event
router.patch('/:id/schedule/events/:eventId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [ev] = await sql`
      UPDATE schedule_events SET
        title=COALESCE(${d.title??null},title), detail=COALESCE(${d.detail??null},detail),
        start_time=COALESCE(${d.startTime??null},start_time), end_time=COALESCE(${d.endTime??null},end_time),
        is_alert=COALESCE(${d.isAlert??null},is_alert),
        is_filming=COALESCE(${d.isFilming??null},is_filming),
        is_shooting_call=COALESCE(${d.isShootingCall??null},is_shooting_call),
        is_lunch=COALESCE(${d.isLunch??null},is_lunch),
        location_id=${d.locationId !== undefined ? (d.locationId || null) : sql`location_id`},
        audience=COALESCE(${d.audience!=null?sql.array(d.audience):null},audience)
      WHERE id=${req.params.eventId} RETURNING *`;
    if (d.tags !== undefined) {
      await sql`DELETE FROM event_tags WHERE event_id = ${req.params.eventId}`;
      if (d.tags.length) {
        await Promise.all(d.tags.map(t => sql`INSERT INTO event_tags (id, event_id, type, label) VALUES (gen_random_uuid()::text, ${req.params.eventId}, ${t.type}::event_tag_type, ${t.label||null})`));
      }
    }
    const tags = await sql`SELECT * FROM event_tags WHERE event_id = ${req.params.eventId}`;
    const [loc] = ev.location_id ? await sql`SELECT id, name, address FROM locations WHERE id = ${ev.location_id}` : [null];
    res.json({ ...ev, tags, location: loc ? { name: loc.name, address: loc.address } : null });
  } catch(e){next(e);}
});

// DELETE event
router.delete('/:id/schedule/events/:eventId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM schedule_events WHERE id = ${req.params.eventId}`; res.status(204).end(); } catch(e){next(e);}
});

// PUT crew calls for a day (bulk upsert)
router.put('/:id/schedule/days/:dayId/calls', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const calls = req.body;
    const results = await Promise.all(calls.map(({ crewAssignmentId, callTime, wrapTime, locationNote, notes, audience=[] }) =>
      sql`INSERT INTO crew_day_calls (id, crew_assignment_id, shoot_day_id, call_time, wrap_time, location_note, notes, audience)
          VALUES (gen_random_uuid()::text, ${crewAssignmentId}, ${req.params.dayId}, ${callTime||null}, ${wrapTime||null}, ${locationNote||null}, ${notes||null}, ${sql.array(audience)})
          ON CONFLICT (crew_assignment_id, shoot_day_id) DO UPDATE SET
            call_time=EXCLUDED.call_time, wrap_time=EXCLUDED.wrap_time, location_note=EXCLUDED.location_note, notes=EXCLUDED.notes, audience=EXCLUDED.audience
          RETURNING *`
    ));
    res.json(results.flat());
  } catch(e){next(e);}
});

// PATCH single crew call
router.patch('/:id/schedule/calls/:callId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [call] = await sql`
      UPDATE crew_day_calls SET
        call_time=COALESCE(${d.callTime??null},call_time), wrap_time=COALESCE(${d.wrapTime??null},wrap_time),
        location_note=COALESCE(${d.locationNote??null},location_note), notes=COALESCE(${d.notes??null},notes),
        audience=COALESCE(${d.audience!=null?sql.array(d.audience):null},audience)
      WHERE id=${req.params.callId}`;

    // Return with crew info
    const [full] = await sql`
      SELECT cdc.*, p.name as position_name, ca.slot_number, cm.id as cm_id, cm.name as cm_name
      FROM crew_day_calls cdc
      JOIN crew_assignments ca ON ca.id=cdc.crew_assignment_id
      JOIN positions p ON p.id=ca.position_id
      LEFT JOIN crew_members cm ON cm.id=ca.crew_member_id
      WHERE cdc.id=${req.params.callId}`;
    res.json({ ...full, crewAssignment: { position: { name: full.position_name }, slotNumber: full.slot_number, crewMember: full.cm_id?{id:full.cm_id,name:full.cm_name}:null }});
  } catch(e){next(e);}
});

module.exports = router;
