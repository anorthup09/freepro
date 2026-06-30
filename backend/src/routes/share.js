const router = require('express').Router();
const sql = require('../lib/db');

const KEY_PRODUCTION_POSITIONS = ['Director', 'Executive Producer', 'Field Producer', 'Producer', 'Line Producer'];

// GET /share/:token — public, no auth
router.get('/:token', async (req, res, next) => {
  try {
    const [share] = await sql`SELECT * FROM project_shares WHERE token = ${req.params.token}`;
    if (!share) return res.status(404).json({ error: 'Share not found' });

    const projectId = share.project_id;
    const viewType = share.view_type;
    const talentName = share.talent_name;

    // Load project base info
    const [project] = await sql`SELECT id, code, title, subtitle, client, city, state, start_date, end_date, status, notes FROM projects WHERE id = ${projectId}`;
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [locations, techSpecs, clientContacts, keyTalent] = await Promise.all([
      sql`SELECT * FROM locations WHERE project_id = ${projectId}`,
      sql`SELECT * FROM tech_specs WHERE project_id = ${projectId}`,
      sql`SELECT * FROM client_contacts WHERE project_id = ${projectId}`,
      sql`SELECT * FROM key_talent WHERE project_id = ${projectId}`,
    ]);

    const crewAssignments = await sql`
      SELECT ca.*, p.name as position_name, p.sort_order,
             cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.company as cm_company, cm.initials, cm.avatar_color
      FROM crew_assignments ca
      JOIN positions p ON p.id = ca.position_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
      WHERE ca.project_id = ${projectId}
      ORDER BY p.sort_order, ca.slot_number`;

    const mappedCrew = crewAssignments.map(a => ({
      ...a,
      position: { id: a.position_id, name: a.position_name, sortOrder: a.sort_order },
      crewMember: a.cm_id ? { id: a.cm_id, name: a.cm_name, email: a.cm_email, phone: a.cm_phone, company: a.cm_company, initials: a.initials, avatarColor: a.avatar_color } : null,
    }));

    // Load schedule
    const shootDays = await sql`SELECT * FROM shoot_days WHERE project_id = ${projectId} ORDER BY day_number`;
    const totalDays = shootDays.length;

    const daysWithData = await Promise.all(shootDays.map(async day => {
      const events = await sql`
        SELECT se.*, l.name as location_name, l.address as location_address
        FROM schedule_events se
        LEFT JOIN locations l ON l.id = se.location_id
        WHERE se.shoot_day_id = ${day.id}
        ORDER BY se.start_time`;

      const crewCalls = await sql`
        SELECT cdc.*, ca.slot_number, ca.position_id, p.name as position_name,
               cm.id as cm_id, cm.name as cm_name, cm.phone as cm_phone
        FROM crew_day_calls cdc
        JOIN crew_assignments ca ON ca.id = cdc.crew_assignment_id
        JOIN positions p ON p.id = ca.position_id
        LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
        WHERE cdc.shoot_day_id = ${day.id}
        ORDER BY p.sort_order, ca.slot_number`;

      return {
        ...day,
        totalDays,
        events: events.map(e => ({ ...e, location: e.location_name ? { name: e.location_name, address: e.location_address } : null })),
        crewCalls: crewCalls.map(c => ({
          ...c,
          crewAssignment: { id: c.crew_assignment_id, positionId: c.position_id, slotNumber: c.slot_number, position: { name: c.position_name }, crewMember: c.cm_id ? { id: c.cm_id, name: c.cm_name, phone: c.cm_phone } : null }
        })),
      };
    }));

    let responseData = { view_type: viewType, talent_name: talentName, project };

    if (viewType === 'producer') {
      responseData = {
        ...responseData,
        locations,
        techSpecs: techSpecs[0] || null,
        clientContacts,
        keyTalent,
        crewAssignments: mappedCrew,
        schedule: daysWithData,
      };
    } else if (viewType === 'crew') {
      const filteredDays = daysWithData.map(day => ({
        ...day,
        events: day.events.filter(e => !e.audience || e.audience.length === 0 || e.audience.includes('crew')),
        crewCalls: day.crewCalls.filter(c => !c.audience || c.audience.length === 0 || c.audience.includes('crew')),
      }));
      responseData = {
        ...responseData,
        locations,
        techSpecs: techSpecs[0] || null,
        crewAssignments: mappedCrew,
        schedule: filteredDays,
      };
    } else if (viewType === 'client') {
      const filteredDays = daysWithData.map(day => ({
        ...day,
        events: day.events.filter(e => !e.audience || e.audience.length === 0 || e.audience.includes('client')),
        crewCalls: [],
      }));
      responseData = {
        ...responseData,
        locations,
        clientContacts,
        keyTalent,
        schedule: filteredDays,
      };
    } else if (viewType === 'talent') {
      const filteredDays = daysWithData.map(day => ({
        ...day,
        events: day.events.filter(e => !e.audience || e.audience.length === 0 || e.audience.includes(talentName) || e.audience.includes('talent')),
        crewCalls: day.crewCalls.filter(c => !c.audience || c.audience.length === 0 || c.audience.includes(talentName) || c.audience.includes('talent')),
      }));
      const productionCrew = mappedCrew.filter(a => KEY_PRODUCTION_POSITIONS.includes(a.position_name));
      responseData = {
        ...responseData,
        locations,
        techSpecs: techSpecs[0] || null,
        clientContacts,
        keyTalent,
        productionCrew,
        schedule: filteredDays,
      };
    }

    res.json(responseData);
  } catch(e){ next(e); }
});

module.exports = router;
