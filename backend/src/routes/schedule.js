const router = require('express').Router();
const { z } = require('zod');
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { refreshWeather } = require('../lib/weather');

async function getDayFull(dayId) {
  const [[day], events, crewCalls] = await Promise.all([
    sql`SELECT * FROM shoot_days WHERE id = ${dayId}`,
    sql`SELECT se.*, json_agg(DISTINCT jsonb_build_object('id',et.id,'type',et.type,'label',et.label)) FILTER (WHERE et.id IS NOT NULL) as tags,
           array_remove(array_agg(DISTINCT ec.crew_id), NULL) as crew_ids,
           l.name as location_name, l.address as location_address
    FROM schedule_events se
    LEFT JOIN event_tags et ON et.event_id = se.id
    LEFT JOIN event_crews ec ON ec.event_id = se.id
    LEFT JOIN locations l ON l.id = se.location_id
    WHERE se.shoot_day_id = ${dayId}
    GROUP BY se.id, l.name, l.address
    ORDER BY se.start_time`,
    sql`SELECT cdc.*, ca.slot_number, ca.position_id, p.name as position_name,
           cm.id as cm_id, cm.name as cm_name, cm.phone as cm_phone
    FROM crew_day_calls cdc
    JOIN crew_assignments ca ON ca.id = cdc.crew_assignment_id
    JOIN positions p ON p.id = ca.position_id
    LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
    WHERE cdc.shoot_day_id = ${dayId}
    ORDER BY p.sort_order, ca.slot_number`,
  ]);
  if (!day) return null;
  return {
    ...day,
    events: events.map(e => ({ ...e, tags: e.tags || [], crew_ids: e.crew_ids || [], location: e.location_name ? { name: e.location_name, address: e.location_address } : (e.adhoc_location ? { name: e.adhoc_location, address: e.adhoc_address || null, adhoc: true } : null) })),
    crewCalls: crewCalls.map(c => ({
      ...c,
      crewAssignment: { id: c.crew_assignment_id, positionId: c.position_id, slotNumber: c.slot_number, position: { name: c.position_name }, crewMember: c.cm_id ? { id: c.cm_id, name: c.cm_name, phone: c.cm_phone } : null }
    })),
  };
}

// Ensure shoot_days rows exist for every date in the project's start–end range,
// numbered 1..N in date order. Days already present (matched by calendar date)
// are kept along with their events; days outside the range are kept too.
async function syncDaysToProjectRange(projectId) {
  const [project] = await sql`SELECT start_date, end_date FROM projects WHERE id = ${projectId}`;
  if (!project?.start_date || !project?.end_date) return;
  // Serialize per-project inside ONE transaction: a transaction-scoped
  // advisory lock stays on a single pooled connection and auto-releases on
  // commit/rollback. (A session-scoped pg_advisory_lock here got stranded on
  // pooled connections — the unlock could run on a different connection —
  // and permanently blocked schedule loads for the affected project.)
  await sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${'daysync:' + projectId}))`;
    await doSync(tx, projectId, project);
  });
}

async function doSync(sql, projectId, project) {
  const existing = await sql`SELECT id, day_number, date FROM shoot_days WHERE project_id = ${projectId} ORDER BY date`;
  const have = new Set(existing.map(d => new Date(d.date).toISOString().slice(0, 10)));

  const startISO = new Date(project.start_date).toISOString().slice(0, 10);
  const endISO = new Date(project.end_date).toISOString().slice(0, 10);
  const missing = [];
  const wanted = new Set();
  let cur = new Date(startISO + 'T12:00:00Z');
  const end = new Date(endISO + 'T12:00:00Z');
  for (let i = 0; cur <= end && i < 60; i++, cur = new Date(cur.getTime() + 86400000)) {
    const iso = cur.toISOString().slice(0, 10);
    wanted.add(iso);
    if (!have.has(iso)) missing.push(iso);
  }

  // Drop out-of-range days that carry no content (days with events/calls/catering are kept)
  const outOfRange = existing.filter(d => !wanted.has(new Date(d.date).toISOString().slice(0, 10)));
  let deleted = 0;
  if (outOfRange.length) {
    const ids = outOfRange.map(d => d.id);
    const used = await sql`
      SELECT shoot_day_id AS id FROM schedule_events WHERE shoot_day_id = ANY(${sql.array(ids)})
      UNION SELECT shoot_day_id FROM crew_day_calls WHERE shoot_day_id = ANY(${sql.array(ids)})
      UNION SELECT shoot_day_id FROM catering_orders WHERE shoot_day_id = ANY(${sql.array(ids)})`;
    const usedSet = new Set(used.map(u => u.id));
    const deletable = ids.filter(id => !usedSet.has(id));
    if (deletable.length) {
      await sql`DELETE FROM shoot_days WHERE id = ANY(${sql.array(deletable)})`;
      deleted = deletable.length;
    }
  }

  const numberedByDate = existing.every((d, i) => Number(d.day_number) === i + 1);
  if (missing.length === 0 && deleted === 0 && numberedByDate) return;
  console.log(`day sync ${projectId}: +${missing.length} inserted, -${deleted} deleted, renumbering ${existing.length} existing`);

  for (let i = 0; i < missing.length; i++) {
    await sql`
      INSERT INTO shoot_days (id, project_id, day_number, date)
      VALUES (gen_random_uuid()::text, ${projectId}, ${20000 + i}, ${missing[i] + 'T12:00:00Z'})
      ON CONFLICT DO NOTHING`;
  }
  // Renumber 1..N by date (two steps to dodge the unique constraint)
  await sql`UPDATE shoot_days SET day_number = day_number + 10000 WHERE project_id = ${projectId} AND day_number < 10000`;
  await sql`
    UPDATE shoot_days sd SET day_number = t.rn
    FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY date, id) AS rn FROM shoot_days WHERE project_id = ${projectId}) t
    WHERE sd.id = t.id`;
}

// GET /api/projects/:id/schedule — fetch all days in 3 parallel bulk queries instead of N×3
router.get('/:id/schedule', requireAuth, async (req, res, next) => {
  try {
    await syncDaysToProjectRange(req.params.id).catch(e => console.error('day sync failed:', e.message));
    const days = await sql`SELECT * FROM shoot_days WHERE project_id = ${req.params.id} ORDER BY day_number`;
    // Server-side weather refresh in the background — never blocks the response;
    // fetched weather lands in the DB and shows on the next load (the browser
    // also fetches weather client-side for immediate display)
    sql`SELECT city, state FROM projects WHERE id = ${req.params.id}`
      .then(([proj]) => proj && refreshWeather(proj, days))
      .catch(e => console.error('background weather refresh failed:', e.message));
    if (days.length === 0) return res.json([]);
    const dayIds = days.map(d => d.id);

    const [events, crewCalls, catering] = await Promise.all([
      sql`SELECT se.*, json_agg(DISTINCT jsonb_build_object('id',et.id,'type',et.type,'label',et.label)) FILTER (WHERE et.id IS NOT NULL) as tags,
             array_remove(array_agg(DISTINCT ec.crew_id), NULL) as crew_ids,
             l.name as location_name, l.address as location_address
          FROM schedule_events se
          LEFT JOIN event_tags et ON et.event_id = se.id
          LEFT JOIN event_crews ec ON ec.event_id = se.id
          LEFT JOIN locations l ON l.id = se.location_id
          WHERE se.shoot_day_id = ANY(${sql.array(dayIds)})
          GROUP BY se.id, l.name, l.address
          ORDER BY se.start_time`,
      sql`SELECT cdc.*, ca.slot_number, ca.position_id, p.name as position_name,
             cm.id as cm_id, cm.name as cm_name, cm.phone as cm_phone
          FROM crew_day_calls cdc
          JOIN crew_assignments ca ON ca.id = cdc.crew_assignment_id
          JOIN positions p ON p.id = ca.position_id
          LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
          WHERE cdc.shoot_day_id = ANY(${sql.array(dayIds)})
          ORDER BY p.sort_order, ca.slot_number`,
      sql`SELECT * FROM catering_orders WHERE shoot_day_id = ANY(${sql.array(dayIds)}) ORDER BY meal_type`,
    ]);

    const eventsByDay = {};
    const callsByDay = {};
    const cateringByDay = {};
    for (const e of events) {
      (eventsByDay[e.shoot_day_id] ||= []).push({ ...e, tags: e.tags || [], crew_ids: e.crew_ids || [], location: e.location_name ? { name: e.location_name, address: e.location_address } : (e.adhoc_location ? { name: e.adhoc_location, address: e.adhoc_address || null, adhoc: true } : null) });
    }
    for (const c of crewCalls) {
      (callsByDay[c.shoot_day_id] ||= []).push({ ...c, crewAssignment: { id: c.crew_assignment_id, positionId: c.position_id, slotNumber: c.slot_number, position: { name: c.position_name }, crewMember: c.cm_id ? { id: c.cm_id, name: c.cm_name, phone: c.cm_phone } : null } });
    }
    for (const c of catering) {
      (cateringByDay[c.shoot_day_id] ||= []).push(c);
    }

    res.json(days.map(d => ({ ...d, events: eventsByDay[d.id] || [], crewCalls: callsByDay[d.id] || [], catering: cateringByDay[d.id] || [] })));
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
        lunch_end_time=${d.lunchEndTime !== undefined ? (d.lunchEndTime||null) : sql`lunch_end_time`},
        call_time_notes=${d.callTimeNotes !== undefined ? (d.callTimeNotes||null) : sql`call_time_notes`},
        call_time_tags=${d.callTimeTags !== undefined ? sql.array(d.callTimeTags) : sql`call_time_tags`},
        shooting_call_notes=${d.shootingCallNotes !== undefined ? (d.shootingCallNotes||null) : sql`shooting_call_notes`},
        shooting_call_tags=${d.shootingCallTags !== undefined ? sql.array(d.shootingCallTags) : sql`shooting_call_tags`},
        lunch_notes=${d.lunchNotes !== undefined ? (d.lunchNotes||null) : sql`lunch_notes`},
        lunch_tags=${d.lunchTags !== undefined ? sql.array(d.lunchTags) : sql`lunch_tags`},
        wrap_time_notes=${d.wrapTimeNotes !== undefined ? (d.wrapTimeNotes||null) : sql`wrap_time_notes`},
        wrap_time_tags=${d.wrapTimeTags !== undefined ? sql.array(d.wrapTimeTags) : sql`wrap_time_tags`},
        weather=COALESCE(${d.weather??null},weather), notes=COALESCE(${d.notes??null},notes),
        day_type=${d.dayType !== undefined ? (d.dayType||null) : sql`day_type`},
        crew_lunch=${d.crewLunch !== undefined ? (d.crewLunch||null) : sql`crew_lunch`},
        gear_storage=${d.gearStorage !== undefined ? (d.gearStorage||null) : sql`gear_storage`},
        gs_audio=${d.gsAudio !== undefined ? (d.gsAudio||null) : sql`gs_audio`},
        crew_overrides=${d.crewOverrides !== undefined ? sql.json(d.crewOverrides || {}) : sql`crew_overrides`},
        call_time_location_id=${d.callTimeLocationId !== undefined ? (d.callTimeLocationId||null) : sql`call_time_location_id`},
        shooting_call_location_id=${d.shootingCallLocationId !== undefined ? (d.shootingCallLocationId||null) : sql`shooting_call_location_id`},
        lunch_location_id=${d.lunchLocationId !== undefined ? (d.lunchLocationId||null) : sql`lunch_location_id`},
        wrap_time_location_id=${d.wrapTimeLocationId !== undefined ? (d.wrapTimeLocationId||null) : sql`wrap_time_location_id`},
        weather_location_name=${d.weatherLocationName !== undefined ? (d.weatherLocationName||null) : sql`weather_location_name`},
        weather_lat=${d.weatherLat !== undefined ? (d.weatherLat ?? null) : sql`weather_lat`},
        weather_lon=${d.weatherLon !== undefined ? (d.weatherLon ?? null) : sql`weather_lon`},
        weather_fetched_at=${d.weatherLat !== undefined || d.weatherLon !== undefined ? null : sql`weather_fetched_at`}
      WHERE id=${req.params.dayId} RETURNING *`;
    if (!day) {
      console.error('day patch: not found. requested:', req.params.dayId, 'project:', req.params.id);
      return res.status(404).json({ error: 'Shoot day not found — the schedule will refresh, please try again.' });
    }
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
    const { startTime, endTime, title, detail, roomSpace, locationId, adhocLocation, adhocAddress, isAlert, alertMessage, isFilming, isShootingCall, isLunch, tags=[], audience=[], crewIds=[] } = req.body;
    const [dayExists] = await sql`SELECT id FROM shoot_days WHERE id = ${req.params.dayId}`;
    if (!dayExists) {
      const existing = await sql`SELECT id, day_number FROM shoot_days WHERE project_id = ${req.params.id}`;
      console.error('event create: day not found. requested:', req.params.dayId, 'project:', req.params.id, 'existing days:', JSON.stringify(existing.map(d => ({ id: d.id, n: d.day_number }))));
      return res.status(404).json({ error: 'Shoot day not found — the schedule will refresh, please try again.' });
    }
    const [ev] = await sql`
      INSERT INTO schedule_events (id, shoot_day_id, start_time, end_time, title, detail, room_space, location_id, adhoc_location, adhoc_address, is_alert, alert_message, is_filming, is_shooting_call, is_lunch, audience)
      VALUES (gen_random_uuid()::text, ${req.params.dayId}, ${startTime}, ${endTime||null}, ${title}, ${detail||null}, ${roomSpace||null}, ${locationId||null}, ${locationId ? null : (adhocLocation||null)}, ${locationId ? null : (adhocAddress||null)}, ${isAlert||false}, ${alertMessage||null}, ${isFilming||false}, ${isShootingCall||false}, ${isLunch||false}, ${sql.array(audience)})
      RETURNING *`;
    if (tags.length) {
      await Promise.all(tags.map(t => sql`INSERT INTO event_tags (id, event_id, type, label) VALUES (gen_random_uuid()::text, ${ev.id}, ${t.type}::event_tag_type, ${t.label||null})`));
    }
    if (crewIds.length) {
      await Promise.all(crewIds.map(cid => sql`INSERT INTO event_crews (event_id, crew_id) VALUES (${ev.id}, ${cid}) ON CONFLICT DO NOTHING`));
    }
    const [loc] = ev.location_id ? await sql`SELECT id, name, address FROM locations WHERE id = ${ev.location_id}` : [null];
    res.status(201).json({ ...ev, tags, crew_ids: crewIds, location: loc ? { name: loc.name, address: loc.address } : (ev.adhoc_location ? { name: ev.adhoc_location, address: ev.adhoc_address || null, adhoc: true } : null) });
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
        room_space=${d.roomSpace !== undefined ? (d.roomSpace || null) : sql`room_space`},
        location_id=${d.locationId !== undefined ? (d.locationId || null) : sql`location_id`},
        adhoc_location=${d.adhocLocation !== undefined || d.locationId ? ((d.locationId ? null : d.adhocLocation) || null) : sql`adhoc_location`},
        adhoc_address=${d.adhocAddress !== undefined || d.locationId ? ((d.locationId ? null : d.adhocAddress) || null) : sql`adhoc_address`},
        audience=COALESCE(${d.audience!=null?sql.array(d.audience):null},audience)
      WHERE id=${req.params.eventId} RETURNING *`;
    if (d.tags !== undefined) {
      await sql`DELETE FROM event_tags WHERE event_id = ${req.params.eventId}`;
      if (d.tags.length) {
        await Promise.all(d.tags.map(t => sql`INSERT INTO event_tags (id, event_id, type, label) VALUES (gen_random_uuid()::text, ${req.params.eventId}, ${t.type}::event_tag_type, ${t.label||null})`));
      }
    }
    if (d.crewIds !== undefined) {
      await sql`DELETE FROM event_crews WHERE event_id = ${req.params.eventId}`;
      for (const cid of (d.crewIds || [])) {
        await sql`INSERT INTO event_crews (event_id, crew_id) VALUES (${req.params.eventId}, ${cid}) ON CONFLICT DO NOTHING`;
      }
    }
    const tags = await sql`SELECT * FROM event_tags WHERE event_id = ${req.params.eventId}`;
    const crewRows = await sql`SELECT crew_id FROM event_crews WHERE event_id = ${req.params.eventId}`;
    const [loc] = ev.location_id ? await sql`SELECT id, name, address FROM locations WHERE id = ${ev.location_id}` : [null];
    res.json({ ...ev, tags, crew_ids: crewRows.map(r => r.crew_id), location: loc ? { name: loc.name, address: loc.address } : null });
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

// POST (upsert) catering — mealTypes is array, same caterer info saved for each
router.post('/:id/schedule/days/:dayId/catering', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { mealTypes = [], name, address, orderNumber, deliveryTime, deleteMealTypes = [] } = req.body;
    const isDelivery = req.body.isDelivery !== false;
    if (deleteMealTypes.length) {
      await sql`DELETE FROM catering_orders WHERE shoot_day_id = ${req.params.dayId} AND meal_type = ANY(${sql.array(deleteMealTypes)})`;
    }
    const results = [];
    for (const mealType of mealTypes) {
      const [row] = await sql`
        INSERT INTO catering_orders (id, shoot_day_id, meal_type, name, address, order_number, delivery_time, is_delivery)
        VALUES (gen_random_uuid()::text, ${req.params.dayId}, ${mealType}, ${name||null}, ${address||null}, ${orderNumber||null}, ${deliveryTime||null}, ${isDelivery})
        ON CONFLICT (shoot_day_id, meal_type) DO UPDATE SET
          name=${name||null}, address=${address||null}, order_number=${orderNumber||null}, delivery_time=${deliveryTime||null}, is_delivery=${isDelivery}
        RETURNING *`;
      results.push(row);
    }
    res.json(results);
  } catch(e){next(e);}
});

module.exports = router;
