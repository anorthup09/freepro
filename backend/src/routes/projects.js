const router = require('express').Router();
const { z } = require('zod');
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

async function getFullProject(id) {
  const [project] = await sql`SELECT * FROM projects WHERE id = ${id}`;
  if (!project) return null;
  const [locations, techSpecs, clientContacts, agencyContacts, keyTalent, crewAssignments, deliverables, hotelBlocks, gear] = await Promise.all([
    sql`SELECT * FROM locations WHERE project_id = ${id}`,
    sql`SELECT * FROM tech_specs WHERE project_id = ${id}`,
    sql`SELECT * FROM client_contacts WHERE project_id = ${id}`,
    sql`SELECT * FROM agency_contacts WHERE project_id = ${id}`,
    sql`SELECT * FROM key_talent WHERE project_id = ${id}`,
    sql`SELECT ca.*, p.name as position_name, p.sort_order,
               cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.company as cm_company, cm.initials, cm.avatar_color
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
    crewAssignments: crewAssignments.map(a => ({
      ...a,
      position: { id: a.position_id, name: a.position_name, sortOrder: a.sort_order },
      crewMember: a.cm_id ? { id: a.cm_id, name: a.cm_name, email: a.cm_email, phone: a.cm_phone, company: a.cm_company, initials: a.initials, avatarColor: a.avatar_color } : null,
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

// GET /api/projects/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const project = await getFullProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
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
    const [l] = await sql`UPDATE locations SET name=COALESCE(${d.name??null},name), address=COALESCE(${d.address??null},address), type=COALESCE(${d.type??null}::location_type,type), emoji=COALESCE(${d.emoji??null},emoji) WHERE id=${req.params.lid} RETURNING *`;
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
      INSERT INTO tech_specs (id, project_id, aspect_ratio, resolution, frame_rate, quality, cameras, exec_producer, on_site_editor, notes, dit_crew_member_id)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${d.aspectRatio||null}, ${d.resolution||null}, ${d.frameRate||null}, ${d.quality||null}, ${d.cameras||null}, ${d.execProducer||null}, ${d.onSiteEditor||null}, ${d.notes||null}, ${d.ditCrewMemberId||null})
      ON CONFLICT (project_id) DO UPDATE SET
        aspect_ratio = EXCLUDED.aspect_ratio, resolution = EXCLUDED.resolution, frame_rate = EXCLUDED.frame_rate, quality = EXCLUDED.quality,
        cameras = EXCLUDED.cameras, exec_producer = EXCLUDED.exec_producer, on_site_editor = EXCLUDED.on_site_editor, notes = EXCLUDED.notes,
        dit_crew_member_id = EXCLUDED.dit_crew_member_id
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
    const { name, role, notes } = req.body;
    const [t] = await sql`INSERT INTO key_talent (id, project_id, name, role, notes) VALUES (gen_random_uuid()::text, ${req.params.id}, ${name}, ${role}, ${notes||null}) RETURNING *`;
    // Auto-create a share token for this talent
    await sql`INSERT INTO project_shares (id, project_id, token, view_type, talent_name) VALUES (gen_random_uuid()::text, ${req.params.id}, gen_random_uuid()::text, 'talent', ${name})`;
    res.status(201).json(t);
  } catch(e){next(e);}
});
router.patch('/:id/talent/:tid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [t] = await sql`UPDATE key_talent SET name=COALESCE(${d.name??null},name), role=COALESCE(${d.role??null},role) WHERE id=${req.params.tid} RETURNING *`;
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
             cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.company as cm_company, cm.initials, cm.avatar_color
      FROM crew_assignments ca
      JOIN positions p ON p.id = ca.position_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
      WHERE ca.project_id = ${req.params.id}
      ORDER BY p.sort_order, ca.slot_number`;
    res.json(rows.map(a => ({
      ...a,
      position: { id: a.position_id, name: a.position_name, sortOrder: a.sort_order },
      crewMember: a.cm_id ? { id: a.cm_id, name: a.cm_name, email: a.cm_email, phone: a.cm_phone, company: a.cm_company, initials: a.initials, avatarColor: a.avatar_color } : null,
    })));
  } catch(e){next(e);}
});
router.post('/:id/crew', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { positionId, crewMemberId, slotNumber=1, notes } = req.body;
    const [a] = await sql`
      INSERT INTO crew_assignments (id, project_id, position_id, crew_member_id, slot_number, notes)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${positionId}, ${crewMemberId||null}, ${slotNumber}, ${notes||null})
      RETURNING *`;
    const [full] = await sql`
      SELECT ca.*, p.name as position_name, cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.initials, cm.avatar_color
      FROM crew_assignments ca JOIN positions p ON p.id=ca.position_id LEFT JOIN crew_members cm ON cm.id=ca.crew_member_id
      WHERE ca.id = ${a.id}`;
    res.status(201).json({ ...full, position:{id:full.position_id,name:full.position_name}, crewMember: full.cm_id?{id:full.cm_id,name:full.cm_name,email:full.cm_email,phone:full.cm_phone,initials:full.initials,avatarColor:full.avatar_color}:null });
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
      SELECT ca.*, p.name as position_name, cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.initials, cm.avatar_color
      FROM crew_assignments ca JOIN positions p ON p.id=ca.position_id LEFT JOIN crew_members cm ON cm.id=ca.crew_member_id
      WHERE ca.id = ${req.params.aid}`;
    res.json({ ...full, position:{id:full.position_id,name:full.position_name}, crewMember: full.cm_id?{id:full.cm_id,name:full.cm_name,email:full.cm_email,phone:full.cm_phone,initials:full.initials,avatarColor:full.avatar_color}:null });
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
        camera_gear, grip_gear, electric_gear, audio_gear, media_management_gear, editing_gear, storage_location)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${d.gearPersonId||null}, ${d.internalRequestSubmitted||false},
        ${d.rentalCompany||null}, ${d.rentalContact||null}, ${d.rentalPhone||null}, ${d.rentalEmail||null},
        ${d.coiReceived||false}, ${d.rentalAgreementReceived||false}, ${d.ccAuthReceived||false},
        ${d.deliveryDatetime||null}, ${d.pickupDatetime||null}, ${d.deliveryDriver||null}, ${d.deliveryDriverPhone||null},
        ${d.cameraGear||null}, ${d.gripGear||null}, ${d.electricGear||null}, ${d.audioGear||null}, ${d.mediaManagementGear||null}, ${d.editingGear||null}, ${d.storageLocation||null})
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
        editing_gear = EXCLUDED.editing_gear, storage_location = EXCLUDED.storage_location
      RETURNING *`;
    const [cm] = g.gear_person_id ? await sql`SELECT name, phone, email FROM crew_members WHERE id = ${g.gear_person_id}` : [null];
    res.json({ ...g, gear_person_name: cm?.name || null, gear_person_phone: cm?.phone || null, gear_person_email: cm?.email || null });
  } catch(e){next(e);}
});

module.exports = router;
