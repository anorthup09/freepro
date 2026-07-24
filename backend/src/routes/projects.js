const router = require('express').Router();
const { z } = require('zod');
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { bizToday } = require('../lib/dates');
const { displayCodes, applyDisplayCode } = require('../lib/displayCode');
const { sendCalendarHold, sendCalendarCancel } = require('../lib/ics');
const { syncGearAssignTask } = require('../lib/gearTask');

// Email an Outlook calendar hold to the assigned crew member (fire-and-forget)
async function sendAssignmentHold(assignmentId) {
  try {
    const [a] = await sql`
      SELECT ca.*, p.name as position_name, pr.title as project_title, pr.code as project_code, pr.city, pr.state,
             cm.email as cm_email,
             COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as cm_display
      FROM crew_assignments ca
      JOIN positions p ON p.id = ca.position_id
      JOIN projects pr ON pr.id = ca.project_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
      WHERE ca.id = ${assignmentId}`;
    if (!a || !a.cm_email || !a.start_date) return;
    const codes = await displayCodes([a.project_id]);
    const code = codes[a.project_id] || a.project_code;
    const seq = Number(a.invite_seq || 0);
    const sent = await sendCalendarHold({
      uid: a.id,
      sequence: seq,
      startDate: a.start_date,
      endDate: a.end_date || a.start_date,
      summary: `HOLD — ${code} ${a.project_title} (${a.position_name})`,
      description: `You are assigned as ${a.position_name} on ${a.project_title} (${code}).
Dates: ${String(a.start_date).slice(0, 10)} to ${String(a.end_date || a.start_date).slice(0, 10)}.
Details in FreePro.`,
      location: [a.city, a.state].filter(x => x && x !== '—').join(', ') || undefined,
      attendeeEmail: a.cm_email,
      attendeeName: a.cm_display,
    });
    if (sent) await sql`UPDATE crew_assignments SET invite_seq = ${seq + 1} WHERE id = ${a.id}`;
  } catch (e) { console.error('Calendar hold failed:', e.message); }
}

async function getFullProject(id) {
  const [project] = await sql`SELECT * FROM projects WHERE id = ${id}`;
  if (!project) return null;
  await applyDisplayCode(project);
  const [locations, techSpecs, clientContacts, agencyContacts, keyTalent, crewAssignments, deliverables, hotelBlocks, gear, onlineRentals] = await Promise.all([
    sql`SELECT * FROM locations WHERE project_id = ${id}`,
    sql`SELECT * FROM tech_specs WHERE project_id = ${id}`,
    sql`SELECT * FROM client_contacts WHERE project_id = ${id}`,
    sql`SELECT * FROM agency_contacts WHERE project_id = ${id}`,
    sql`SELECT * FROM key_talent WHERE project_id = ${id}`,
    sql`SELECT ca.*, p.name as position_name, p.sort_order,
               cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.company as cm_company, cm.initials, cm.avatar_color,
               cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last, cm.travel_local as cm_travel_local
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
    sql`SELECT pg.*, COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as gear_person_name, cm.phone as gear_person_phone, cm.email as gear_person_email
        FROM project_gear pg
        LEFT JOIN crew_members cm ON cm.id = pg.gear_person_id
        WHERE pg.project_id = ${id}`,
    sql`SELECT * FROM online_rentals WHERE project_id = ${id} ORDER BY created_at`,
  ]);
  // Shoot name for the Overview header — the Shoot Description (subtitle) or Trip
  // from the budget's Production Costs section this tile is linked to.
  const [shootSec] = await sql`
    SELECT subtitle, trip FROM budget_sections
    WHERE freepro_project_id = ${id} AND kind = 'shoot'
    ORDER BY sort LIMIT 1`;
  // "Shoot: [Trip] - [Description]" — Trip name first, then the Shoot Description
  const trip = (shootSec?.trip || '').trim();
  const desc = (shootSec?.subtitle || '').trim();
  const shootName = [trip, desc].filter(Boolean).join(' - ') || (project.subtitle || '').trim() || null;
  // Named crews (units) + which crews each assignment belongs to
  const crews = await sql`SELECT * FROM project_crews WHERE project_id = ${id} ORDER BY sort, created_at`;
  const assignmentCrews = await sql`
    SELECT cac.assignment_id, cac.crew_id FROM crew_assignment_crews cac
    JOIN crew_assignments ca ON ca.id = cac.assignment_id WHERE ca.project_id = ${id}`;
  const crewIdsByAssignment = {};
  for (const r of assignmentCrews) (crewIdsByAssignment[r.assignment_id] ||= []).push(r.crew_id);
  return {
    ...project,
    shoot_name: shootName,
    locations,
    techSpecs: techSpecs[0] || null,
    clientContacts,
    agencyContacts,
    keyTalent,
    hotelBlocks,
    gear: gear[0] || null,
    onlineRentals,
    crews,
    crewAssignments: crewAssignments.map(a => ({
      ...a,
      crew_ids: crewIdsByAssignment[a.id] || [],
      position: { id: a.position_id, name: a.position_name, sortOrder: a.sort_order },
      crewMember: a.cm_id ? { id: a.cm_id, name: a.cm_name, preferredFirstName: a.cm_pref_first, preferredLastName: a.cm_pref_last, email: a.cm_email, phone: a.cm_phone, company: a.cm_company, initials: a.initials, avatarColor: a.avatar_color, travelLocal: a.cm_travel_local } : null,
    })),
    deliverables,
  };
}

// GET /api/projects
router.get('/', requireAuth, async (req, res, next) => {
  try {
    // has_production: a project belongs in FreePro only when its budget has a
    // Production (shoot) section. Post-only projects have a main budget with no
    // shoot section — those are excluded. Projects with no main budget at all
    // (created directly in FreePro, or child shoot tiles) always count as production.
    const projects = await sql`
      SELECT p.*,
        (NOT EXISTS (SELECT 1 FROM budgets b WHERE b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main')
         OR EXISTS (SELECT 1 FROM budgets b JOIN budget_sections bs ON bs.budget_id = b.id
                    WHERE b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main' AND bs.kind = 'shoot')
        ) AS has_production
      FROM projects p ORDER BY p.start_date DESC`;
    const codes = await displayCodes(projects.map(p => p.id));
    res.json(projects.map(p => codes[p.id] ? { ...p, code: codes[p.id] } : p));
  } catch (err) { next(err); }
});

// Auto-advance status based on dates (PLANNING→ACTIVE on start, ACTIVE→WRAPPED day after end)
async function maybeAutoStatus(project) {
  const { id, status, start_date, end_date } = project;
  if (!start_date || !end_date) return project;
  const today = bizToday();
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

// GET /api/projects/crew-calendar — Unbridled employees' shoot assignments
router.get('/crew-calendar', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT ca.id, ca.start_date, ca.end_date, ca.crew_member_id,
             COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as member_name,
             p.name as position_name, pr.id as project_id, pr.title as project_title, pr.code as project_code, pr.status as project_status
      FROM crew_assignments ca
      JOIN crew_members cm ON cm.id = ca.crew_member_id
      JOIN positions p ON p.id = ca.position_id
      JOIN projects pr ON pr.id = ca.project_id
      WHERE cm.company ILIKE '%unbridled%'
        AND ca.start_date IS NOT NULL
        AND pr.status != 'ARCHIVED'
      ORDER BY member_name, ca.start_date`;
    const codes = await displayCodes([...new Set(rows.map(r => r.project_id))]);
    const shootRows = rows.map(r => ({ ...(codes[r.project_id] ? { ...r, project_code: codes[r.project_id] } : r), kind: 'shoot' }));
    // AvocadoPost edits appear alongside shoots
    const editRows = await sql`
      SELECT e.id, e.start_date, e.end_date, e.lead_editor_id as crew_member_id,
             COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as member_name,
             'Edit' as position_name, e.id as project_id, e.title as project_title,
             COALESCE(e.project_code, 'EDIT') as project_code, 'EDIT' as project_status
      FROM edits e JOIN crew_members cm ON cm.id = e.lead_editor_id
      WHERE cm.company ILIKE '%unbridled%' AND e.start_date IS NOT NULL AND e.status != 'CLOSED'
      ORDER BY member_name, e.start_date`;
    // Editor-task milestones show as runners from the previous milestone to the
    // task's date (e.g. Client v1 Feedback 7/6 → Client v2 Due 7/8 spans 7/6–7/8)
    const EDITOR_TASKS = { icr_v1_due: 'ICR v1 Due', client_v1_due: 'Client v1 Due', client_v2_due: 'Client v2 Due', client_v3_due: 'Client v3 Due', color_audio_send: 'Send to Color & Audio', final_comp: 'Final Comp Complete' };
    const MS_ORDER = ['scripting_start', 'scripting_end', 'icr_v1_due', 'icr_feedback', 'client_v1_due', 'client_v1_feedback', 'client_v2_due', 'client_v2_feedback', 'client_v3_due', 'client_v3_feedback', 'color_audio_send', 'color_audio_complete', 'final_comp', 'final_delivery'];
    const msEdits = await sql`
      SELECT e.id, e.title, e.milestones, e.milestone_assignees, e.lead_editor_id,
             e.color_assignee, e.audio_assignee,
             COALESCE(e.project_code, 'EDIT') as project_code
      FROM edits e
      WHERE e.status != 'CLOSED' AND e.milestones IS NOT NULL
        AND (e.lead_editor_id IS NOT NULL OR e.milestone_assignees != '{}'::jsonb
             OR e.color_assignee LIKE 'crew:%' OR e.audio_assignee LIKE 'crew:%')`;
    const parseJ = v => typeof v === 'string' ? JSON.parse(v || '{}') : (v || {});
    const crewFromCA = v => (typeof v === 'string' && v.startsWith('crew:')) ? v.slice(5) : null;
    const memberIds = new Set();
    for (const e of msEdits) {
      if (e.lead_editor_id) memberIds.add(e.lead_editor_id);
      for (const v of Object.values(parseJ(e.milestone_assignees))) if (v) memberIds.add(v);
      for (const c of [crewFromCA(e.color_assignee), crewFromCA(e.audio_assignee)]) if (c) memberIds.add(c);
    }
    const memberRows = memberIds.size ? await sql`
      SELECT id, COALESCE(NULLIF(TRIM(CONCAT(preferred_first_name, ' ', preferred_last_name)), ''), name) as n
      FROM crew_members WHERE id = ANY(${[...memberIds]}) AND company ILIKE '%unbridled%'` : [];
    const memberName = Object.fromEntries(memberRows.map(m => [m.id, m.n]));
    const milestoneRows = [];
    for (const e of msEdits) {
      const ms = parseJ(e.milestones);
      const assignees = parseJ(e.milestone_assignees);
      for (const [k, label] of Object.entries(EDITOR_TASKS)) {
        if (!ms[k]) continue;
        const who = assignees[k] || e.lead_editor_id;
        if (!who || !memberName[who]) continue;
        // runner starts at the closest earlier filled milestone
        let start = ms[k];
        for (const pk of MS_ORDER) {
          if (pk === k) break;
          if (ms[pk] && ms[pk] <= ms[k] && (start === ms[k] || ms[pk] > start)) start = ms[pk];
        }
        milestoneRows.push({
          id: `${e.id}-${k}`, kind: 'edit', start_date: start, end_date: ms[k],
          member_name: memberName[who], position_name: label,
          project_id: e.id, project_title: e.title, project_code: e.project_code, project_status: 'EDIT',
        });
      }
      // Internal Color / Audio owners covering the "Color & Audio Complete"
      // milestone get their own hold, spanning from Send to Color & Audio (or the
      // closest earlier filled milestone) to the completion date. Contractors are
      // external, so only crew:<id> owners feed the Crew Calendar.
      const caEnd = ms['color_audio_complete'];
      if (caEnd) {
        let caStart = caEnd;
        for (const pk of MS_ORDER) {
          if (pk === 'color_audio_complete') break;
          if (ms[pk] && ms[pk] <= caEnd && (caStart === caEnd || ms[pk] > caStart)) caStart = ms[pk];
        }
        for (const [field, label] of [['color_assignee', 'Color'], ['audio_assignee', 'Audio']]) {
          const cid = crewFromCA(e[field]);
          if (!cid || !memberName[cid]) continue;
          milestoneRows.push({
            id: `${e.id}-${field}`, kind: 'edit', start_date: caStart, end_date: caEnd,
            member_name: memberName[cid], position_name: label,
            project_id: e.id, project_title: e.title, project_code: e.project_code, project_status: 'EDIT',
          });
        }
      }
    }
    // PTO / OOO requests block out the calendar too
    const ptoRows = await sql`
      SELECT p.id, p.start_date, p.end_date, p.member_id as crew_member_id,
             COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as member_name,
             p.pto_type as position_name, p.id as project_id, p.title as project_title,
             p.pto_type as project_code, p.status as project_status
      FROM pto_requests p JOIN crew_members cm ON cm.id = p.member_id
      WHERE p.status != 'CLOSED' AND p.start_date IS NOT NULL`;
    res.json([
      ...shootRows,
      ...editRows.map(r => ({ ...r, kind: 'edit' })),
      ...milestoneRows,
      ...ptoRows.map(r => ({ ...r, kind: 'pto', position_name: r.project_status === 'REVIEW' ? `${r.position_name} (pending)` : r.position_name })),
    ]);
  } catch (err) { next(err); }
});

// GET /api/projects/logos?q= — distinct client logos from past projects
router.get('/logos', requireAuth, async (req, res, next) => {
  try {
    const q = `%${(req.query.q || '').trim()}%`;
    const rows = await sql`
      SELECT DISTINCT ON (client) client, client_logo
      FROM projects
      WHERE client_logo IS NOT NULL AND client ILIKE ${q}
      ORDER BY client, updated_at DESC NULLS LAST
      LIMIT 12`;
    res.json(rows);
  } catch (err) { next(err); }
});

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
    const d = z.object({ code:z.string(), title:z.string(), subtitle:z.string().optional(), client:z.string(), city:z.string(), state:z.string(), startDate:z.string().optional(), endDate:z.string().optional(), status:z.string().optional(), notes:z.string().optional(), includePhoto:z.boolean().optional(), clientLogo:z.string().nullable().optional() }).parse(req.body);
    const [p] = await sql`
      INSERT INTO projects (id, code, title, subtitle, client, city, state, start_date, end_date, status, notes, include_photo, client_logo)
      VALUES (gen_random_uuid()::text, ${d.code}, ${d.title}, ${d.subtitle||null}, ${d.client}, ${d.city}, ${d.state}, ${d.startDate||null}, ${d.endDate||null}, ${d.status||'PLANNING'}, ${d.notes||null}, ${d.includePhoto !== false}, ${d.clientLogo||null})
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
    // Clients often echo back the displayed code, which can be the ProFi
    // shoot-code override (e.g. 02.X-01) rather than the stored code —
    // writing that collides with the tile that owns it. Treat as unchanged.
    if (d.code) {
      const codes = await displayCodes([req.params.id]);
      if (d.code === codes[req.params.id]) d.code = undefined;
    }
    const [before] = await sql`SELECT code, title FROM projects WHERE id = ${req.params.id}`;
    await sql`
      UPDATE projects SET
        code = COALESCE(${d.code??null}, code),
        title = COALESCE(${d.title??null}, title),
        client = COALESCE(${d.client??null}, client),
        city = COALESCE(${d.city??null}, city),
        state = COALESCE(${d.state??null}, state),
        start_date = CASE WHEN ${d.startDate !== undefined} THEN ${d.startDate||null} ELSE start_date END,
        end_date = CASE WHEN ${d.endDate !== undefined} THEN ${d.endDate||null} ELSE end_date END,
        status = COALESCE(${d.status??null}::project_status, status),
        notes = COALESCE(${d.notes??null}, notes),
        poc_crew_member_id = CASE WHEN ${d.pocCrewMemberId !== undefined} THEN ${d.pocCrewMemberId||null} ELSE poc_crew_member_id END,
        share_password = CASE WHEN ${d.sharePassword !== undefined} THEN ${d.sharePassword||null} ELSE share_password END,
        show_shot_list = CASE WHEN ${d.showShotList !== undefined} THEN ${d.showShotList===true} ELSE show_shot_list END,
        show_scripts = CASE WHEN ${d.showScripts !== undefined} THEN ${d.showScripts===true} ELSE show_scripts END,
        client_logo = CASE WHEN ${d.clientLogo !== undefined} THEN ${d.clientLogo||null} ELSE client_logo END,
        include_photo = CASE WHEN ${d.includePhoto !== undefined} THEN ${d.includePhoto !== false} ELSE include_photo END,
        updated_at = NOW()
      WHERE id = ${req.params.id}`;
    // Mirror a project rename everywhere the old name was inherited:
    // shoot tiles created from this budget and the Avo project page
    if (before && d.title && d.title !== before.title) {
      await sql`UPDATE projects SET title = ${d.title}, updated_at = NOW()
        WHERE parent_project_id = ${req.params.id} AND title = ${before.title}`;
      await sql`UPDATE avo_project_pages SET title = ${d.title}
        WHERE code = ${before.code} AND (title = ${before.title} OR title IS NULL OR title = '')`;
    }
    res.json(await getFullProject(req.params.id));
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    // Clear any finance-side shoot link so a budget section doesn't keep
    // pointing at a deleted shoot (freepro_project_id has no FK constraint).
    await sql`UPDATE budget_sections SET freepro_project_id = NULL WHERE freepro_project_id = ${req.params.id}`;
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
    const { name, address, type, emoji, notes, arrivalNotes, spaceMap } = req.body;
    const [l] = await sql`INSERT INTO locations (id, project_id, name, address, type, emoji, notes, arrival_notes, space_map) VALUES (gen_random_uuid()::text, ${req.params.id}, ${name}, ${address}, ${type}::location_type, ${emoji||null}, ${notes||null}, ${arrivalNotes||null}, ${spaceMap||null}) RETURNING *`;
    res.status(201).json(l);
  } catch(e){next(e);}
});
router.patch('/:id/locations/:lid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [l] = await sql`UPDATE locations SET name=COALESCE(${d.name??null},name), address=COALESCE(${d.address??null},address), type=COALESCE(${d.type??null}::location_type,type), emoji=COALESCE(${d.emoji??null},emoji), notes=CASE WHEN ${d.notes!==undefined} THEN ${d.notes||null} ELSE notes END, arrival_notes=CASE WHEN ${d.arrivalNotes!==undefined} THEN ${d.arrivalNotes||null} ELSE arrival_notes END, space_map=CASE WHEN ${d.spaceMap!==undefined} THEN ${d.spaceMap||null} ELSE space_map END WHERE id=${req.params.lid} RETURNING *`;
    res.json(l);
  } catch(e){next(e);}
});
// Auto-source the nearest hospital (ER preferred) for a location and store it in
// its notes. Used for shooting locations so the call sheet has an ER reference.
router.post('/:id/locations/:lid/nearest-hospital', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { nearestHospital } = require('../lib/hospital');
    const [loc] = await sql`SELECT * FROM locations WHERE id=${req.params.lid} AND project_id=${req.params.id}`;
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    const h = await nearestHospital(loc.address);
    if (!h) return res.json(loc);   // couldn't source — leave notes as-is
    const note = `Nearest Hospital: ${h.name}${h.address ? ' — ' + h.address : ''}`;
    const [updated] = await sql`UPDATE locations SET notes=${note} WHERE id=${loc.id} RETURNING *`;
    res.json(updated);
  } catch(e){next(e);}
});
// Ranked list of nearby major hospitals (with driving distance + a map) for the
// picker on shooting locations. The user chooses which one to save.
router.get('/:id/locations/:lid/hospital-options', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { hospitalOptions } = require('../lib/hospital');
    const [loc] = await sql`SELECT * FROM locations WHERE id=${req.params.lid} AND project_id=${req.params.id}`;
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    if (!loc.address) return res.json({ origin: null, options: [], mapDataUrl: null });
    res.json(await hospitalOptions(loc.address));
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
    const { name, role, notes, phone, email, dietaryRestrictions, callTime, videoTitle, wardrobeNotes, arrivalNotes, travelLocal } = req.body;
    const [t] = await sql`INSERT INTO key_talent (id, project_id, name, role, notes, phone, email, dietary_restrictions, call_time, video_title, wardrobe_notes, arrival_notes, travel_local) VALUES (gen_random_uuid()::text, ${req.params.id}, ${name}, ${role||null}, ${notes||null}, ${phone||null}, ${email||null}, ${dietaryRestrictions||null}, ${callTime||null}, ${videoTitle||null}, ${wardrobeNotes||null}, ${arrivalNotes||null}, ${travelLocal||'TRAVEL'}) RETURNING *`;
    // Auto-create a share token for this talent
    await sql`INSERT INTO project_shares (id, project_id, token, view_type, talent_name) VALUES (gen_random_uuid()::text, ${req.params.id}, gen_random_uuid()::text, 'talent', ${name})`;
    res.status(201).json(t);
  } catch(e){next(e);}
});
router.patch('/:id/talent/:tid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [t] = await sql`UPDATE key_talent SET name=COALESCE(${d.name??null},name), role=COALESCE(${d.role??null},role), phone=${d.phone!==undefined?(d.phone||null):sql`phone`}, email=${d.email!==undefined?(d.email||null):sql`email`}, notes=${d.notes!==undefined?(d.notes||null):sql`notes`}, dietary_restrictions=${d.dietaryRestrictions!==undefined?(d.dietaryRestrictions||null):sql`dietary_restrictions`}, call_time=${d.callTime!==undefined?(d.callTime||null):sql`call_time`}, wardrobe_notes=${d.wardrobeNotes!==undefined?(d.wardrobeNotes||null):sql`wardrobe_notes`}, arrival_notes=${d.arrivalNotes!==undefined?(d.arrivalNotes||null):sql`arrival_notes`}, video_title=${d.videoTitle!==undefined?(d.videoTitle||null):sql`video_title`}, travel_local=${d.travelLocal!==undefined?(d.travelLocal||'TRAVEL'):sql`travel_local`} WHERE id=${req.params.tid} RETURNING *`;
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
// All talent call times across the project, for the schedule's day view
router.get('/:id/talent-day-calls', requireAuth, async (req, res, next) => {
  try {
    res.json(await sql`
      SELECT tdc.shoot_day_id, tdc.call_time, tdc.call_location, kt.name, kt.role
      FROM talent_day_calls tdc
      JOIN key_talent kt ON kt.id = tdc.talent_id
      WHERE kt.project_id = ${req.params.id} AND tdc.call_time IS NOT NULL
      ORDER BY tdc.call_time`);
  } catch(e){next(e);}
});
router.get('/:id/talent/:tid/day-calls', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM talent_day_calls WHERE talent_id = ${req.params.tid} ORDER BY shoot_day_id`); } catch(e){next(e);}
});
router.put('/:id/talent/:tid/day-calls', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const calls = req.body; // [{ shootDayId, callTime, callLocation }]
    await sql`DELETE FROM talent_day_calls WHERE talent_id = ${req.params.tid}`;
    if (calls.length) {
      await Promise.all(calls.map(c => sql`
        INSERT INTO talent_day_calls (id, talent_id, shoot_day_id, call_time, call_location)
        VALUES (gen_random_uuid()::text, ${req.params.tid}, ${c.shootDayId}, ${c.callTime||null}, ${c.callLocation||null})
        ON CONFLICT (talent_id, shoot_day_id) DO UPDATE SET call_time = EXCLUDED.call_time, call_location = EXCLUDED.call_location`));
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
    const { viewType, talentName, crewGroupId } = req.body;
    // Per-crew links are reused, not multiplied — one link per crew per project
    if (crewGroupId) {
      const [existing] = await sql`SELECT * FROM project_shares WHERE project_id = ${req.params.id} AND view_type = ${viewType} AND crew_group_id = ${crewGroupId}`;
      if (existing) return res.json(existing);
    }
    const [s] = await sql`INSERT INTO project_shares (id, project_id, token, view_type, talent_name, crew_group_id) VALUES (gen_random_uuid()::text, ${req.params.id}, gen_random_uuid()::text, ${viewType}, ${talentName||null}, ${crewGroupId||null}) RETURNING *`;
    res.status(201).json(s);
  } catch(e){next(e);}
});
router.delete('/:id/shares/:sid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM project_shares WHERE id = ${req.params.sid}`; res.status(204).end(); } catch(e){next(e);}
});

// ─── Crew Assignments ────────────────────────────────────────────────────────

// Core positions every project must staff — they feed the clapboard slate
const CORE_POSITIONS = ['Field Producer', 'Director', 'Camera Operator'];
async function ensureCoreCrewSlots(projectId) {
  for (const name of CORE_POSITIONS) {
    let [pos] = await sql`SELECT id FROM positions WHERE lower(name) = ${name.toLowerCase()} LIMIT 1`;
    if (!pos) {
      const [{ max_sort }] = await sql`SELECT COALESCE(MAX(sort_order), 0) as max_sort FROM positions`;
      [pos] = await sql`INSERT INTO positions (id, name, sort_order) VALUES (gen_random_uuid()::text, ${name}, ${Number(max_sort) + 1}) RETURNING id`;
    }
    const [existing] = await sql`SELECT id FROM crew_assignments WHERE project_id = ${projectId} AND position_id = ${pos.id} LIMIT 1`;
    if (!existing) {
      await sql`INSERT INTO crew_assignments (id, project_id, position_id, slot_number) VALUES (gen_random_uuid()::text, ${projectId}, ${pos.id}, 1)`;
    }
  }
}

router.get('/:id/crew', requireAuth, async (req, res, next) => {
  try {
    await ensureCoreCrewSlots(req.params.id).catch(e => console.error('core crew slots failed:', e.message));
    const rows = await sql`
      SELECT ca.*, p.name as position_name, p.sort_order,
             cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.company as cm_company, cm.initials, cm.avatar_color,
             cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last, cm.dietary_restrictions as cm_dietary, cm.travel_local as cm_travel_local
      FROM crew_assignments ca
      JOIN positions p ON p.id = ca.position_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
      WHERE ca.project_id = ${req.params.id}
      ORDER BY p.sort_order, ca.slot_number`;
    const acRows = await sql`
      SELECT cac.assignment_id, cac.crew_id FROM crew_assignment_crews cac
      JOIN crew_assignments ca ON ca.id = cac.assignment_id WHERE ca.project_id = ${req.params.id}`;
    const crewIdsByA = {};
    for (const r of acRows) (crewIdsByA[r.assignment_id] ||= []).push(r.crew_id);
    res.json(rows.map(a => ({
      ...a,
      crew_ids: crewIdsByA[a.id] || [],
      position: { id: a.position_id, name: a.position_name, sortOrder: a.sort_order },
      crewMember: a.cm_id ? { id: a.cm_id, name: a.cm_name, preferredFirstName: a.cm_pref_first, preferredLastName: a.cm_pref_last, email: a.cm_email, phone: a.cm_phone, company: a.cm_company, initials: a.initials, avatarColor: a.avatar_color, dietaryRestrictions: a.cm_dietary, travelLocal: a.cm_travel_local } : null,
    })));
  } catch(e){next(e);}
});
router.post('/:id/crew', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { positionId, crewMemberId, slotNumber=1, notes, startDate, endDate, isContractor, dayRate, laborDays, gearCost, gearDays } = req.body;
    const [a] = await sql`
      INSERT INTO crew_assignments (id, project_id, position_id, crew_member_id, slot_number, notes, start_date, end_date, is_contractor, day_rate, labor_days, gear_cost, gear_days)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${positionId}, ${crewMemberId||null}, ${slotNumber}, ${notes||null}, ${startDate||null}, ${endDate||null}, ${isContractor === true}, ${dayRate ?? null}, ${laborDays ?? null}, ${gearCost ?? null}, ${gearDays ?? null})
      RETURNING *`;
    const [full] = await sql`
      SELECT ca.*, p.name as position_name, cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.initials, cm.avatar_color, cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last, cm.dietary_restrictions as cm_dietary, cm.travel_local as cm_travel_local
      FROM crew_assignments ca JOIN positions p ON p.id=ca.position_id LEFT JOIN crew_members cm ON cm.id=ca.crew_member_id
      WHERE ca.id = ${a.id}`;
    if (crewMemberId && startDate) sendAssignmentHold(a.id);
    res.status(201).json({ ...full, position:{id:full.position_id,name:full.position_name}, crewMember: full.cm_id?{id:full.cm_id,name:full.cm_name,preferredFirstName:full.cm_pref_first,preferredLastName:full.cm_pref_last,email:full.cm_email,phone:full.cm_phone,initials:full.initials,avatarColor:full.avatar_color,dietaryRestrictions:full.cm_dietary}:null });
  } catch(e){
    if(e.code==='23505') return res.status(409).json({error:'That position slot already exists on this project'});
    next(e);
  }
});
// Cancel an assignment's Outlook hold (fire-and-forget; no-op until SMTP)
async function cancelAssignmentHold(a, proj) {
  try {
    if (!a?.cm_email || !a.start_date || !Number(a.invite_seq || 0)) return;   // never sent a hold
    await sendCalendarCancel({
      uid: a.id, sequence: Number(a.invite_seq || 0) + 1,
      startDate: a.start_date, endDate: a.end_date || a.start_date,
      summary: `HOLD — ${proj?.code || ''} ${proj?.title || ''} (${a.position_name || 'Crew'})`.trim(),
      attendeeEmail: a.cm_email, attendeeName: a.cm_display,
    });
  } catch (e) { console.error('Calendar cancel failed:', e.message); }
}

router.patch('/:id/crew/:aid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { crewMemberId, notes, startDate, endDate, isContractor, dayRate, laborDays, gearCost, gearDays, crewIds } = req.body;
    // Unassigning someone cancels the Outlook hold they were sent
    if (crewMemberId !== undefined && !crewMemberId) {
      const [prev] = await sql`
        SELECT ca.id, ca.start_date, ca.end_date, ca.invite_seq, p.name as position_name, cm.email as cm_email,
               COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as cm_display
        FROM crew_assignments ca JOIN positions p ON p.id = ca.position_id
        LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id WHERE ca.id = ${req.params.aid}`;
      const [proj] = await sql`SELECT code, title FROM projects WHERE id = ${req.params.id}`;
      if (prev?.cm_email) cancelAssignmentHold(prev, proj);
    }
    if (crewIds !== undefined) {
      await sql`DELETE FROM crew_assignment_crews WHERE assignment_id = ${req.params.aid}`;
      for (const cid of (crewIds || [])) {
        await sql`INSERT INTO crew_assignment_crews (assignment_id, crew_id) VALUES (${req.params.aid}, ${cid}) ON CONFLICT DO NOTHING`;
      }
    }
    await sql`
      UPDATE crew_assignments SET
        crew_member_id = CASE WHEN ${crewMemberId !== undefined} THEN ${crewMemberId||null} ELSE crew_member_id END,
        notes = COALESCE(${notes??null}, notes),
        start_date = ${startDate !== undefined ? (startDate||null) : sql`start_date`},
        end_date = ${endDate !== undefined ? (endDate||null) : sql`end_date`},
        is_contractor = CASE WHEN ${isContractor !== undefined} THEN ${isContractor === true} ELSE is_contractor END,
        day_rate = ${dayRate !== undefined ? (dayRate === '' || dayRate === null ? null : dayRate) : sql`day_rate`},
        labor_days = ${laborDays !== undefined ? (laborDays === '' || laborDays === null ? null : laborDays) : sql`labor_days`},
        gear_cost = ${gearCost !== undefined ? (gearCost === '' || gearCost === null ? null : gearCost) : sql`gear_cost`},
        gear_days = ${gearDays !== undefined ? (gearDays === '' || gearDays === null ? null : gearDays) : sql`gear_days`}
      WHERE id = ${req.params.aid}`;
    const [full] = await sql`
      SELECT ca.*, p.name as position_name, cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.initials, cm.avatar_color, cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last, cm.dietary_restrictions as cm_dietary, cm.travel_local as cm_travel_local
      FROM crew_assignments ca JOIN positions p ON p.id=ca.position_id LEFT JOIN crew_members cm ON cm.id=ca.crew_member_id
      WHERE ca.id = ${req.params.aid}`;
    if ((crewMemberId !== undefined || startDate !== undefined || endDate !== undefined) && full.cm_id && full.start_date) {
      sendAssignmentHold(req.params.aid);
    }
    const crewRows = await sql`SELECT crew_id FROM crew_assignment_crews WHERE assignment_id = ${req.params.aid}`;
    res.json({ ...full, crew_ids: crewRows.map(r => r.crew_id), position:{id:full.position_id,name:full.position_name}, crewMember: full.cm_id?{id:full.cm_id,name:full.cm_name,preferredFirstName:full.cm_pref_first,preferredLastName:full.cm_pref_last,email:full.cm_email,phone:full.cm_phone,initials:full.initials,avatarColor:full.avatar_color,dietaryRestrictions:full.cm_dietary}:null });
  } catch(e){next(e);}
});
router.delete('/:id/crew/:aid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const [prev] = await sql`
      SELECT ca.id, ca.start_date, ca.end_date, ca.invite_seq, p.name as position_name, cm.email as cm_email,
             COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as cm_display
      FROM crew_assignments ca JOIN positions p ON p.id = ca.position_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id WHERE ca.id = ${req.params.aid}`;
    const [proj] = await sql`SELECT code, title FROM projects WHERE id = ${req.params.id}`;
    await sql`DELETE FROM crew_assignments WHERE id = ${req.params.aid}`;
    if (prev?.cm_email) cancelAssignmentHold(prev, proj);
    res.status(204).end();
  } catch(e){next(e);}
});

// ─── Named crews (units) — Recap Crew, Interview Crew, … ────────────────────
router.post('/:id/crews', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Crew name required' });
    const [{ n }] = await sql`SELECT COUNT(*) as n FROM project_crews WHERE project_id = ${req.params.id}`;
    const [c] = await sql`INSERT INTO project_crews (project_id, name, color, sort)
      VALUES (${req.params.id}, ${name}, ${req.body.color || null}, ${Number(n)}) RETURNING *`;
    res.status(201).json(c);
  } catch(e){next(e);}
});
router.patch('/:id/crews/:cid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [c] = await sql`UPDATE project_crews SET
        name = COALESCE(${d.name ? String(d.name).trim() : null}, name),
        color = ${d.color !== undefined ? (d.color || null) : sql`color`}
      WHERE id = ${req.params.cid} RETURNING *`;
    res.json(c);
  } catch(e){next(e);}
});
router.delete('/:id/crews/:cid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM project_crews WHERE id = ${req.params.cid}`; res.status(204).end(); } catch(e){next(e);}
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
router.put('/:id/gear', requireAuth, requireRole('ADMIN','PRODUCER','AGENCY'), async (req, res, next) => {
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
router.post('/:id/online-rentals', requireAuth, requireRole('ADMIN','PRODUCER','AGENCY'), async (req, res, next) => {
  try {
    const { renterName, confirmation, trackingNumber, cost, notes } = req.body;
    const [r] = await sql`
      INSERT INTO online_rentals (id, project_id, renter_name, confirmation, tracking_number, cost, notes)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${renterName||null}, ${confirmation||null}, ${trackingNumber||null}, ${cost||null}, ${notes||null})
      RETURNING *`;
    res.status(201).json(r);
  } catch(e){next(e);}
});

router.patch('/:id/online-rentals/:rid', requireAuth, requireRole('ADMIN','PRODUCER','AGENCY'), async (req, res, next) => {
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

router.delete('/:id/online-rentals/:rid', requireAuth, requireRole('ADMIN','PRODUCER','AGENCY'), async (req, res, next) => {
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

router.post('/:id/gear-items', requireAuth, requireRole('ADMIN','PRODUCER','AGENCY'), async (req, res, next) => {
  try {
    const { category, item, source, notes, sortOrder, qty, contractorName } = req.body;
    const [row] = await sql`
      INSERT INTO gear_items (id, project_id, category, item, source, notes, sort_order, qty, contractor_name)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${category||'other'}, ${item}, ${source||'internal'}, ${notes||null}, ${sortOrder||0}, ${Number(qty)||1}, ${contractorName||null})
      RETURNING *`;
    await syncGearAssignTask(req.params.id);
    res.status(201).json(row);
  } catch(e){next(e);}
});

router.patch('/:id/gear-items/:itemId', requireAuth, requireRole('ADMIN','PRODUCER','AGENCY'), async (req, res, next) => {
  try {
    const d = req.body;
    const [row] = await sql`
      UPDATE gear_items SET
        category = COALESCE(${d.category??null}, category),
        item     = COALESCE(${d.item??null}, item),
        source   = COALESCE(${d.source??null}, source),
        qty      = COALESCE(${d.qty !== undefined ? Number(d.qty) || 1 : null}, qty),
        contractor_name = ${d.contractorName !== undefined ? (d.contractorName||null) : sql`contractor_name`},
        notes    = ${d.notes !== undefined ? (d.notes||null) : sql`notes`}
      WHERE id = ${req.params.itemId} AND project_id = ${req.params.id}
      RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Not found' });
    await syncGearAssignTask(req.params.id);
    res.json(row);
  } catch(e){next(e);}
});

router.delete('/:id/gear-items/:itemId', requireAuth, requireRole('ADMIN','PRODUCER','AGENCY'), async (req, res, next) => {
  try {
    await sql`DELETE FROM gear_items WHERE id = ${req.params.itemId} AND project_id = ${req.params.id}`;
    await syncGearAssignTask(req.params.id);
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

// AI-drafted call sheet email: high-level synopsis of the shoot
router.post('/:id/call-sheet-email-draft', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const [p] = await sql`
      SELECT p.*, COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as poc_name
      FROM projects p LEFT JOIN crew_members cm ON cm.id = p.poc_crew_member_id
      WHERE p.id = ${req.params.id}`;
    if (!p) return res.status(404).json({ error: 'Project not found' });
    const locations = await sql`SELECT name, address, type FROM locations WHERE project_id = ${p.id}`;
    // Crew call sheet share link (created on demand) — included in the email
    let [share] = await sql`SELECT token FROM project_shares WHERE project_id = ${p.id} AND view_type = 'crew' AND talent_name IS NULL AND crew_group_id IS NULL LIMIT 1`;
    if (!share) [share] = await sql`INSERT INTO project_shares (id, project_id, token, view_type) VALUES (gen_random_uuid()::text, ${p.id}, gen_random_uuid()::text, 'crew') RETURNING token`;
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const shareUrl = `${proto}://${req.get('host')}/share/${share.token}`;
    const days = await sql`SELECT date as day_date, day_type FROM shoot_days WHERE project_id = ${p.id} ORDER BY date`;
    const fmt = d => d ? new Date(d).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', timeZone:'UTC' }) : '';
    const dateRange = p.start_date ? `${fmt(p.start_date)}${p.end_date && fmt(p.end_date) !== fmt(p.start_date) ? ' through ' + fmt(p.end_date) : ''}` : 'TBD';
    const venue = locations.find(l => l.type === 'PRIMARY_VENUE');
    const length = ['short', 'medium', 'long'].includes(req.body.length) ? req.body.length : 'medium';
    const subject = `Call Sheet/Production Schedule — ${p.title}${p.start_date ? ' · ' + fmt(p.start_date) : ''}`;
    const sign = p.poc_name || 'The Unbridled Media Team';
    const dayList = days.map(d => `• ${fmt(d.day_date)}${d.day_type ? ' — ' + String(d.day_type).replace(/_/g, ' ').toLowerCase() : ''}`).join('\n');
    const locList = locations.map(l => `• ${l.name}${l.address ? ' — ' + l.address : ''}`).join('\n');
    const venueLine = venue ? `${venue.name}${venue.address ? ' — ' + venue.address : ''}` : `${p.city || ''}${p.state ? ', ' + p.state : ''}`.trim();
    // Length-aware fallback (also used when no AI key / the AI call fails) so the
    // three lengths always differ and reflect the shoot's dates/schedule/locations.
    const fallbackBody = length === 'short'
      ? `Hi [Name],\n\nHere's the call sheet for ${p.title}:\n${shareUrl}\n\n${dateRange}${venue ? ' · ' + venue.name : ''}. Please review your call times.\n\nThanks,\n${sign}`
      : length === 'long'
        ? `Hi [Name],\n\nHere is the full call sheet and production schedule for ${p.title} (${p.code}):\n${shareUrl}\n\nWe're shooting ${dateRange}${p.client ? ' for ' + p.client : ''}. Please open the link for call times, crew, and full details.\n\nSchedule:\n${dayList || '• See the call sheet for the day-by-day schedule.'}\n\nLocations:\n${locList || (venueLine ? '• ' + venueLine : '• See the call sheet.')}\n\nPlease confirm your call times and reply here with any questions.\n\nThanks,\n${sign}`
        : `Hi [Name],\n\nHere is the call sheet for ${p.title} (${p.code}):\n${shareUrl}\n\nWe're shooting ${dateRange}${venue ? ' at ' + venue.name + (venue.address ? ' (' + venue.address + ')' : '') : ''}. Please review your call times, location details, and schedule in the link above.\n\nReply here with any questions.\n\nThanks,\n${sign}`;
    const fallback = { subject, body: fallbackBody };
    if (!process.env.ANTHROPIC_API_KEY) return res.json(fallback);
    try {
      const context = {
        title: p.title, code: p.code, client: p.client, city: p.city, state: p.state,
        dates: dateRange, notes: p.notes || null, poc: p.poc_name || null, callSheetLink: shareUrl,
        locations: locations.map(l => ({ name: l.name, address: l.address, type: l.type })),
        scheduleDays: days.map(d => ({ date: new Date(d.day_date).toISOString().slice(0,10), type: d.day_type, callTime: d.call_time, wrapTime: d.wrap_time, notes: d.notes })),
      };
      const LENGTH_SPEC = {
        short: 'Keep it very short: greeting, one sentence with the link, one sentence on when/where, sign-off. No day-by-day detail.',
        medium: 'Medium length: greeting, link, a 2-3 sentence synopsis of the shoot (what/when/where), a reminder to check call times, sign-off.',
        long: 'Longer and more detailed: greeting, link, a synopsis paragraph, then a short day-by-day rundown (date, day type, call time when available), the key locations with addresses, and a closing reminder to confirm call times and reply with questions.',
      };
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001', max_tokens: 1000,
          messages: [{ role: 'user', content:
            `Draft a professional call sheet email for a video production shoot. It goes to the crew/client/talent along with a link to the interactive call sheet. The subject line must start with "Call Sheet/Production Schedule". Open the body with exactly "Hi [Name]," on its own line — the [Name] placeholder is replaced per recipient. The body MUST include the call sheet link (callSheetLink) verbatim on its own line early in the email. ${LENGTH_SPEC[length]} End with a sign-off from the point of contact. No subject placeholders or brackets — write final copy. Shoot data: ${JSON.stringify(context)}. Reply with ONLY JSON: {"subject": "...", "body": "..."} (body uses \\n newlines, plain text).` }],
        }),
      });
      const j = await r.json();
      const parsed = JSON.parse((j.content?.[0]?.text || '').match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (parsed.subject && parsed.body) return res.json(parsed);
      return res.json(fallback);
    } catch (e2) {
      console.error('call sheet email draft AI failed:', e2.message);
      return res.json(fallback);
    }
  } catch (e) { next(e); }
});

module.exports = router;
