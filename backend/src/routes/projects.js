const router = require('express').Router();
const { z } = require('zod');
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

async function getFullProject(id) {
  const [project] = await sql`SELECT * FROM projects WHERE id = ${id}`;
  if (!project) return null;
  const [locations, techSpecs, clientContacts, agencyContacts, keyTalent, crewAssignments, deliverables, hotelBlocks, gear, onlineRentals] = await Promise.all([
    sql`SELECT * FROM locations WHERE project_id = ${id}`,
    sql`SELECT * FROM tech_specs WHERE project_id = ${id}`,
    sql`SELECT * FROM client_contacts WHERE project_id = ${id}`,
    sql`SELECT * FROM agency_contacts WHERE project_id = ${id}`,
    sql`SELECT * FROM key_talent WHERE project_id = ${id}`,
    sql`SELECT ca.*, p.name as position_name, p.sort_order,
               cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.company as cm_company, cm.initials, cm.avatar_color,
               cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last
        FROM crew_assignments ca
        JOIN positions p ON p.id = ca.position_id
        LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
        WHERE ca.project_id = ${id}
        ORDER BY p.sort_order, ca.slot_number`,
    sql`SELECT * FROM deliverables WHERE project_id = ${id} ORDER BY created_at`,
    sql`SELECT hb.*, json_agg(hg.* ORDER BY hg.check_in) FILTER (WHERE hg.id IS NOT NULL) as guests
        FROM hotel_blocks hb
        LEFT JOIN hotel_guests hg ON hg.hotel_block_id = hb.id
        WHERE hb.project_id = ${id}
        GROUP BY hb.id`,
    sql`SELECT pg.*, cm.name as gear_person_name, cm.phone as gear_person_phone, cm.email as gear_person_email
        FROM project_gear pg
        LEFT JOIN crew_members cm ON cm.id = pg.gear_person_id
        WHERE pg.project_id = ${id}`,
    sql`SELECT * FROM online_rentals WHERE project_id = ${id} ORDER BY created_at`,
  ]);
  return {
    ...project,
    locations,
    techSpecs: techSpecs[0] || null,
    clientContacts,
    agencyContacts,
    keyTalent,
    hotelBlocks,
    gear: gear[0] || null,
    onlineRentals,
    crewAssignments: crewAssignments.map(a => ({
      ...a,
      position: { id: a.position_id, name: a.position_name, sortOrder: a.sort_order },
      crewMember: a.cm_id ? { id: a.cm_id, name: a.cm_name, preferredFirstName: a.cm_pref_first, preferredLastName: a.cm_pref_last, email: a.cm_email, phone: a.cm_phone, company: a.cm_company, initials: a.initials, avatarColor: a.avatar_color } : null,
    })),
    deliverables,
  };
}

// GET /api/projects
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const projects = await sql`SELECT * FROM projects ORDER BY start_date DESC`;
    res.json(projects);
  } catch (err) { next(err); }
});

// Auto-advance status based on dates (PLANNING→ACTIVE on start, ACTIVE→WRAPPED day after end)
async function maybeAutoStatus(project) {
  const { id, status, start_date, end_date } = project;
  if (!start_date || !end_date) return project;
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(start_date).toISOString().slice(0, 10);
  const end = new Date(end_date).toISOString().slice(0, 10);
  let next = null;
  if (status === 'PLANNING' && today >= start) next = 'ACTIVE';
  else if (status === 'ACTIVE' && today > end) next = 'WRAPPED';
  if (next) {
    await sql`UPDATE projects SET status = ${next}::project_status WHERE id = ${id}`;
    return { ...project, status: next };
  }
  return project;
}

// GET /api/projects/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    let project = await getFullProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    project = await maybeAutoStatus(project);
    res.json(project);
  } catch (err) { next(err); }
});

// POST /api/projects
router.post('/', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = z.object({ code:z.string(), title:z.string(), subtitle:z.string().optional(), client:z.string(), city:z.string(), state:z.string(), startDate:z.string(), endDate:z.string(), status:z.string().optional(), notes:z.string().optional() }).parse(req.body);
    const [p] = await sql`
      INSERT INTO projects (id, code, title, subtitle, client, city, state, start_date, end_date, status, notes)
      VALUES (gen_random_uuid()::text, ${d.code}, ${d.title}, ${d.subtitle||null}, ${d.client}, ${d.city}, ${d.state}, ${d.startDate}, ${d.endDate}, ${d.status||'PLANNING'}, ${d.notes||null})
      RETURNING *`;
    res.status(201).json(p);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === '23505') return res.status(409).json({ error: 'Project code already exists' });
    next(err);
  }
});

// PATCH /api/projects/:id
router.patch('/:id', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    await sql`
      UPDATE projects SET
        code = COALESCE(${d.code??null}, code),
        title = COALESCE(${d.title??null}, title),
        client = COALESCE(${d.client??null}, client),
        city = COALESCE(${d.city??null}, city),
        state = COALESCE(${d.state??null}, state),
        start_date = COALESCE(${d.startDate??null}, start_date),
        end_date = COALESCE(${d.endDate??null}, end_date),
        status = COALESCE(${d.status??null}::project_status, status),
        notes = COALESCE(${d.notes??null}, notes),
        poc_crew_member_id = CASE WHEN ${d.pocCrewMemberId !== undefined} THEN ${d.pocCrewMemberId||null} ELSE poc_crew_member_id END,
        share_password = CASE WHEN ${d.sharePassword !== undefined} THEN ${d.sharePassword||null} ELSE share_password END,
        updated_at = NOW()
      WHERE id = ${req.params.id}`;
    res.json(await getFullProject(req.params.id));
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await sql`DELETE FROM projects WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── Locations ───────────────────────────────────────────────────────────────
router.get('/:id/locations', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM locations WHERE project_id = ${req.params.id}`); } catch(e){next(e);}
});
router.post('/:id/locations', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, address, type, emoji, notes } = req.body;
    const [l] = await sql`INSERT INTO locations (id, project_id, name, address, type, emoji, notes) VALUES (gen_random_uuid()::text, ${req.params.id}, ${name}, ${address}, ${type}::location_type, ${emoji||null}, ${notes||null}) RETURNING *`;
    res.status(201).json(l);
  } catch(e){next(e);}
});
router.patch('/:id/locations/:lid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [l] = await sql`UPDATE locations SET name=COALESCE(${d.name??null},name), address=COALESCE(${d.address??null},address), type=COALESCE(${d.type??null}::location_type,type), emoji=COALESCE(${d.emoji??null},emoji), space_map=CASE WHEN ${d.spaceMap!==undefined} THEN ${d.spaceMap||null} ELSE space_map END WHERE id=${req.params.lid} RETURNING *`;
    res.json(l);
  } catch(e){next(e);}
});
router.delete('/:id/locations/:lid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM locations WHERE id = ${req.params.lid}`; res.status(204).end(); } catch(e){next(e);}
});

// ─── Tech Specs ──────────────────────────────────────────────────────────────
router.put('/:id/tech-specs', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [spec] = await sql`
      INSERT INTO tech_specs (id, project_id, aspect_ratio, resolution, quality, cameras, exec_producer, on_site_editor, notes, dit_crew_member_id, frame_rate, broll_frame_rate)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${d.aspectRatio||null}, ${d.resolution||null}, ${d.quality||null}, ${d.cameras||null}, ${d.execProducer||null}, ${d.onSiteEditor||null}, ${d.notes||null}, ${d.ditCrewMemberId||null}, ${d.frameRate||null}, ${d.brollFrameRate||null})
      ON CONFLICT (project_id) DO UPDATE SET
        aspect_ratio = EXCLUDED.aspect_ratio, resolution = EXCLUDED.resolution, quality = EXCLUDED.quality,
        cameras = EXCLUDED.cameras, exec_producer = EXCLUDED.exec_producer, on_site_editor = EXCLUDED.on_site_editor, notes = EXCLUDED.notes,
        dit_crew_member_id = EXCLUDED.dit_crew_member_id, frame_rate = EXCLUDED.frame_rate, broll_frame_rate = EXCLUDED.broll_frame_rate
      RETURNING *`;
    res.json(spec);
  } catch(e){next(e);}
});

// ─── Client Contacts ─────────────────────────────────────────────────────────
router.get('/:id/contacts', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM client_contacts WHERE project_id = ${req.params.id}`); } catch(e){next(e);}
});
router.post('/:id/contacts', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, title, email, phone } = req.body;
    const [c] = await sql`INSERT INTO client_contacts (id, project_id, name, title, email, phone) VALUES (gen_random_uuid()::text, ${req.params.id}, ${name}, ${title}, ${email||null}, ${phone||null}) RETURNING *`;
    res.status(201).json(c);
  } catch(e){next(e);}
});
router.patch('/:id/contacts/:cid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [c] = await sql`UPDATE client_contacts SET name=COALESCE(${d.name??null},name), title=COALESCE(${d.title??null},title), email=COALESCE(${d.email??null},email), phone=COALESCE(${d.phone??null},phone) WHERE id=${req.params.cid} RETURNING *`;
    res.json(c);
  } catch(e){next(e);}
});
router.delete('/:id/contacts/:cid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM client_contacts WHERE id = ${req.params.cid}`; res.status(204).end(); } catch(e){next(e);}
});

// ─── Key Talent ──────────────────────────────────────────────────────────────
router.get('/:id/talent', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM key_talent WHERE project_id = ${req.params.id}`); } catch(e){next(e);}
});
router.post('/:id/talent', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, role, notes, phone, email, dietaryRestrictions, callTime, videoTitle, wardrobeNotes, arrivalNotes } = req.body;
    const [t] = await sql`INSERT INTO key_talent (id, project_id, name, role, notes, phone, email, dietary_restrictions, call_time, video_title, wardrobe_notes, arrival_notes) VALUES (gen_random_uuid()::text, ${req.params.id}, ${name}, ${role||null}, ${notes||null}, ${phone||null}, ${email||null}, ${dietaryRestrictions||null}, ${callTime||null}, ${videoTitle||null}, ${wardrobeNotes||null}, ${arrivalNotes||null}) RETURNING *`;
    // Auto-create a share token for this talent
    await sql`INSERT INTO project_shares (id, project_id, token, view_type, talent_name) VALUES (gen_random_uuid()::text, ${req.params.id}, gen_random_uuid()::text, 'talent', ${name})`;
    res.status(201).json(t);
  } catch(e){next(e);}
});
router.patch('/:id/talent/:tid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [t] = await sql`UPDATE key_talent SET name=COALESCE(${d.name??null},name), role=COALESCE(${d.role??null},role), phone=${d.phone!==undefined?(d.phone||null):sql`phone`}, email=${d.email!==undefined?(d.email||null):sql`email`}, notes=${d.notes!==undefined?(d.notes||null):sql`notes`}, dietary_restrictions=${d.dietaryRestrictions!==undefined?(d.dietaryRestrictions||null):sql`dietary_restrictions`}, call_time=${d.callTime!==undefined?(d.callTime||null):sql`call_time`}, wardrobe_notes=${d.wardrobeNotes!==undefined?(d.wardrobeNotes||null):sql`wardrobe_notes`}, arrival_notes=${d.arrivalNotes!==undefined?(d.arrivalNotes||null):sql`arrival_notes`}, video_title=${d.videoTitle!==undefined?(d.videoTitle||null):sql`video_title`} WHERE id=${req.params.tid} RETURNING *`;
    res.json(t);
  } catch(e){next(e);}
});
router.delete('/:id/talent/:tid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const [t] = await sql`SELECT name FROM key_talent WHERE id = ${req.params.tid}`;
    if (t) await sql`DELETE FROM project_shares WHERE project_id = ${req.params.id} AND view_type = 'talent' AND talent_name = ${t.name}`;
    await sql`DELETE FROM key_talent WHERE id = ${req.params.tid}`;
    res.status(204).end();
  } catch(e){next(e);}
});

// ─── Talent Day Calls ────────────────────────────────────────────────────────
router.get('/:id/talent/:tid/day-calls', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM talent_day_calls WHERE talent_id = ${req.params.tid} ORDER BY shoot_day_id`); } catch(e){next(e);}
});
router.put('/:id/talent/:tid/day-calls', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const calls = req.body; // [{ shootDayId, callTime }]
    await sql`DELETE FROM talent_day_calls WHERE talent_id = ${req.params.tid}`;
    if (calls.length) {
      await Promise.all(calls.map(c => sql`
        INSERT INTO talent_day_calls (id, talent_id, shoot_day_id, call_time)
        VALUES (gen_random_uuid()::text, ${req.params.tid}, ${c.shootDayId}, ${c.callTime||null})
        ON CONFLICT (talent_id, shoot_day_id) DO UPDATE SET call_time = EXCLUDED.call_time`));
    }
    res.json(await sql`SELECT * FROM talent_day_calls WHERE talent_id = ${req.params.tid} ORDER BY shoot_day_id`);
  } catch(e){next(e);}
});

// ─── Shares ──────────────────────────────────────────────────────────────────
router.get('/:id/shares', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM project_shares WHERE project_id = ${req.params.id} ORDER BY created_at`); } catch(e){next(e);}
});
router.post('/:id/shares', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { viewType, talentName } = req.body;
    const [s] = await sql`INSERT INTO project_shares (id, project_id, token, view_type, talent_name) VALUES (gen_random_uuid()::text, ${req.params.id}, gen_random_uuid()::text, ${viewType}, ${talentName||null}) RETURNING *`;
    res.status(201).json(s);
  } catch(e){next(e);}
});
router.delete('/:id/shares/:sid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM project_shares WHERE id = ${req.params.sid}`; res.status(204).end(); } catch(e){next(e);}
});

// ─── Crew Assignments ────────────────────────────────────────────────────────
router.get('/:id/crew', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT ca.*, p.name as position_name, p.sort_order,
             cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.company as cm_company, cm.initials, cm.avatar_color,
             cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last, cm.dietary_restrictions as cm_dietary
      FROM crew_assignments ca
      JOIN positions p ON p.id = ca.position_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
      WHERE ca.project_id = ${req.params.id}
      ORDER BY p.sort_order, ca.slot_number`;
    res.json(rows.map(a => ({
      ...a,
      position: { id: a.position_id, name: a.position_name, sortOrder: a.sort_order },
      crewMember: a.cm_id ? { id: a.cm_id, name: a.cm_name, preferredFirstName: a.cm_pref_first, preferredLastName: a.cm_pref_last, email: a.cm_email, phone: a.cm_phone, company: a.cm_company, initials: a.initials, avatarColor: a.avatar_color, dietaryRestrictions: a.cm_dietary } : null,
    })));
  } catch(e){next(e);}
});
router.post('/:id/crew', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { positionId, crewMemberId, slotNumber=1, notes, startDate, endDate } = req.body;
    const [a] = await sql`
      INSERT INTO crew_assignments (id, project_id, position_id, crew_member_id, slot_number, notes, start_date, end_date)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${positionId}, ${crewMemberId||null}, ${slotNumber}, ${notes||null}, ${startDate||null}, ${endDate||null})
      RETURNING *`;
    const [full] = await sql`
      SELECT ca.*, p.name as position_name, cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.initials, cm.avatar_color, cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last, cm.dietary_restrictions as cm_dietary
      FROM crew_assignments ca JOIN positions p ON p.id=ca.position_id LEFT JOIN crew_members cm ON cm.id=ca.crew_member_id
      WHERE ca.id = ${a.id}`;
    res.status(201).json({ ...full, position:{id:full.position_id,name:full.position_name}, crewMember: full.cm_id?{id:full.cm_id,name:full.cm_name,preferredFirstName:full.cm_pref_first,preferredLastName:full.cm_pref_last,email:full.cm_email,phone:full.cm_phone,initials:full.initials,avatarColor:full.avatar_color,dietaryRestrictions:full.cm_dietary}:null });
  } catch(e){
    if(e.code==='23505') return res.status(409).json({error:'That position slot already exists on this project'});
    next(e);
  }
});
router.patch('/:id/crew/:aid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { crewMemberId, notes, startDate, endDate } = req.body;
    await sql`
      UPDATE crew_assignments SET
        crew_member_id = CASE WHEN ${crewMemberId !== undefined} THEN ${crewMemberId||null} ELSE crew_member_id END,
        notes = COALESCE(${notes??null}, notes),
        start_date = ${startDate !== undefined ? (startDate||null) : sql`start_date`},
        end_date = ${endDate !== undefined ? (endDate||null) : sql`end_date`}
      WHERE id = ${req.params.aid}`;
    const [full] = await sql`
      SELECT ca.*, p.name as position_name, cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.initials, cm.avatar_color, cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last, cm.dietary_restrictions as cm_dietary
      FROM crew_assignments ca JOIN positions p ON p.id=ca.position_id LEFT JOIN crew_members cm ON cm.id=ca.crew_member_id
      WHERE ca.id = ${req.params.aid}`;
    res.json({ ...full, position:{id:full.position_id,name:full.position_name}, crewMember: full.cm_id?{id:full.cm_id,name:full.cm_name,preferredFirstName:full.cm_pref_first,preferredLastName:full.cm_pref_last,email:full.cm_email,phone:full.cm_phone,initials:full.initials,avatarColor:full.avatar_color,dietaryRestrictions:full.cm_dietary}:null });
  } catch(e){next(e);}
});
router.delete('/:id/crew/:aid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM crew_assignments WHERE id = ${req.params.aid}`; res.status(204).end(); } catch(e){next(e);}
});

// ─── Agency Contacts ─────────────────────────────────────────────────────────
router.post('/:id/agency-contacts', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, title, email, phone } = req.body;
    const [c] = await sql`INSERT INTO agency_contacts (id, project_id, name, title, email, phone) VALUES (gen_random_uuid()::text, ${req.params.id}, ${name}, ${title}, ${email||null}, ${phone||null}) RETURNING *`;
    res.status(201).json(c);
  } catch(e){next(e);}
});
router.patch('/:id/agency-contacts/:cid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [c] = await sql`UPDATE agency_contacts SET name=${d.name}, title=${d.title}, email=${d.email||null}, phone=${d.phone||null} WHERE id=${req.params.cid} RETURNING *`;
    res.json(c);
  } catch(e){next(e);}
});
router.delete('/:id/agency-contacts/:cid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM agency_contacts WHERE id = ${req.params.cid}`; res.status(204).end(); } catch(e){next(e);}
});

// ─── Gear ────────────────────────────────────────────────────────────────────
router.put('/:id/gear', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [g] = await sql`
      INSERT INTO project_gear (id, project_id, gear_person_id, internal_request_submitted,
        rental_company, rental_contact, rental_phone, rental_email,
        coi_received, rental_agreement_received, cc_auth_received,
        delivery_datetime, pickup_datetime, delivery_driver, delivery_driver_phone,
        camera_gear, grip_gear, electric_gear, audio_gear, media_management_gear, editing_gear, storage_location, rental_cost)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${d.gearPersonId||null}, ${d.internalRequestSubmitted||false},
        ${d.rentalCompany||null}, ${d.rentalContact||null}, ${d.rentalPhone||null}, ${d.rentalEmail||null},
        ${d.coiReceived||false}, ${d.rentalAgreementReceived||false}, ${d.ccAuthReceived||false},
        ${d.deliveryDatetime||null}, ${d.pickupDatetime||null}, ${d.deliveryDriver||null}, ${d.deliveryDriverPhone||null},
        ${d.cameraGear||null}, ${d.gripGear||null}, ${d.electricGear||null}, ${d.audioGear||null}, ${d.mediaManagementGear||null}, ${d.editingGear||null}, ${d.storageLocation||null}, ${d.rentalCost||null})
      ON CONFLICT (project_id) DO UPDATE SET
        gear_person_id = EXCLUDED.gear_person_id,
        internal_request_submitted = EXCLUDED.internal_request_submitted,
        rental_company = EXCLUDED.rental_company, rental_contact = EXCLUDED.rental_contact,
        rental_phone = EXCLUDED.rental_phone, rental_email = EXCLUDED.rental_email,
        coi_received = EXCLUDED.coi_received, rental_agreement_received = EXCLUDED.rental_agreement_received,
        cc_auth_received = EXCLUDED.cc_auth_received, delivery_datetime = EXCLUDED.delivery_datetime,
        pickup_datetime = EXCLUDED.pickup_datetime, delivery_driver = EXCLUDED.delivery_driver,
        delivery_driver_phone = EXCLUDED.delivery_driver_phone,
        camera_gear = EXCLUDED.camera_gear, grip_gear = EXCLUDED.grip_gear, electric_gear = EXCLUDED.electric_gear,
        audio_gear = EXCLUDED.audio_gear, media_management_gear = EXCLUDED.media_management_gear,
        editing_gear = EXCLUDED.editing_gear, storage_location = EXCLUDED.storage_location,
        rental_cost = EXCLUDED.rental_cost
      RETURNING *`;
    const [cm] = g.gear_person_id ? await sql`SELECT name, phone, email FROM crew_members WHERE id = ${g.gear_person_id}` : [null];
    res.json({ ...g, gear_person_name: cm?.name || null, gear_person_phone: cm?.phone || null, gear_person_email: cm?.email || null });
  } catch(e){next(e);}
});

// ─── Online Rentals ──────────────────────────────────────────────────────────
router.post('/:id/online-rentals', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { renterName, confirmation, trackingNumber, cost, notes } = req.body;
    const [r] = await sql`
      INSERT INTO online_rentals (id, project_id, renter_name, confirmation, tracking_number, cost, notes)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${renterName||null}, ${confirmation||null}, ${trackingNumber||null}, ${cost||null}, ${notes||null})
      RETURNING *`;
    res.status(201).json(r);
  } catch(e){next(e);}
});

router.patch('/:id/online-rentals/:rid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { renterName, confirmation, trackingNumber, cost, notes } = req.body;
    const [r] = await sql`
      UPDATE online_rentals SET
        renter_name = ${renterName !== undefined ? (renterName||null) : sql`renter_name`},
        confirmation = ${confirmation !== undefined ? (confirmation||null) : sql`confirmation`},
        tracking_number = ${trackingNumber !== undefined ? (trackingNumber||null) : sql`tracking_number`},
        cost = ${cost !== undefined ? (cost||null) : sql`cost`},
        notes = ${notes !== undefined ? (notes||null) : sql`notes`}
      WHERE id = ${req.params.rid} AND project_id = ${req.params.id}
      RETURNING *`;
    res.json(r);
  } catch(e){next(e);}
});

router.delete('/:id/online-rentals/:rid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`DELETE FROM online_rentals WHERE id = ${req.params.rid} AND project_id = ${req.params.id}`;
    res.status(204).end();
  } catch(e){next(e);}
});

// ── Gear Items ────────────────────────────────────────────────────────────────
router.get('/:id/gear-items', requireAuth, async (req, res, next) => {
  try {
    const items = await sql`SELECT * FROM gear_items WHERE project_id = ${req.params.id} ORDER BY sort_order, created_at`;
    res.json(items);
  } catch(e){next(e);}
});

router.post('/:id/gear-items', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { category, item, source, notes, sortOrder } = req.body;
    const [row] = await sql`
      INSERT INTO gear_items (id, project_id, category, item, source, notes, sort_order)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${category||'other'}, ${item}, ${source||'internal'}, ${notes||null}, ${sortOrder||0})
      RETURNING *`;
    res.status(201).json(row);
  } catch(e){next(e);}
});

router.patch('/:id/gear-items/:itemId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [row] = await sql`
      UPDATE gear_items SET
        category = COALESCE(${d.category??null}, category),
        item     = COALESCE(${d.item??null}, item),
        source   = COALESCE(${d.source??null}, source),
        notes    = ${d.notes !== undefined ? (d.notes||null) : sql`notes`}
      WHERE id = ${req.params.itemId} AND project_id = ${req.params.id}
      RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch(e){next(e);}
});

router.delete('/:id/gear-items/:itemId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`DELETE FROM gear_items WHERE id = ${req.params.itemId} AND project_id = ${req.params.id}`;
    res.status(204).end();
  } catch(e){next(e);}
});

// Questions
router.get('/:id/questions', requireAuth, async (req, res, next) => {
  try {
    const questions = await sql`SELECT * FROM project_questions WHERE project_id = ${req.params.id} ORDER BY asked_at ASC`;
    res.json(questions);
  } catch(e){next(e);}
});

router.post('/:id/questions', requireAuth, async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: 'Question is required' });
    const [q] = await sql`INSERT INTO project_questions (project_id, question) VALUES (${req.params.id}, ${question.trim()}) RETURNING *`;
    res.status(201).json(q);
  } catch(e){next(e);}
});

router.patch('/:id/questions/:qid', requireAuth, async (req, res, next) => {
  try {
    const { answer } = req.body;
    const [q] = await sql`UPDATE project_questions SET answer = ${answer?.trim() || null}, answered_at = ${answer?.trim() ? sql`NOW()` : null} WHERE id = ${req.params.qid} AND project_id = ${req.params.id} RETURNING *`;
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json(q);
  } catch(e){next(e);}
});

router.delete('/:id/questions/:qid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`DELETE FROM project_questions WHERE id = ${req.params.qid} AND project_id = ${req.params.id}`;
    res.status(204).end();
  } catch(e){next(e);}
});

module.exports = router;
