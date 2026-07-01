const router = require('express').Router();
const sql = require('../lib/db');
const { geocode, fetchWeatherForDay } = require('../lib/weather');

const KEY_PRODUCTION_POSITIONS = ['Director', 'Executive Producer', 'Field Producer', 'Producer', 'Line Producer'];

// Refresh weather for shoot days that are missing it or stale (>6h old)
async function refreshWeather(project, shootDays) {
  if (!project.city || !project.state || !shootDays.length) return;
  const stale = shootDays.filter(d => {
    if (!d.weather_fetched_at) return true;
    const age = Date.now() - new Date(d.weather_fetched_at).getTime();
    return age > 6 * 60 * 60 * 1000;
  });
  if (!stale.length) return;
  try {
    const { lat, lon } = await geocode(project.city, project.state);
    await Promise.all(stale.map(async day => {
      try {
        const dateStr = new Date(day.date).toISOString().slice(0, 10);
        const w = await fetchWeatherForDay(lat, lon, dateStr);
        await sql`UPDATE shoot_days SET
          weather_high=${w.high}, weather_low=${w.low},
          weather_sunrise=${w.sunrise}, weather_sunset=${w.sunset},
          weather_precip=${w.precip}, weather_condition=${w.condition},
          weather_fetched_at=NOW()
          WHERE id=${day.id}`;
        Object.assign(day, {
          weather_high: w.high, weather_low: w.low,
          weather_sunrise: w.sunrise, weather_sunset: w.sunset,
          weather_precip: w.precip, weather_condition: w.condition,
        });
      } catch(e) { /* leave weather null for this day */ }
    }));
  } catch(e) { /* geocode failed, leave all weather null */ }
}

// GET /share/:token — public, no auth
router.get('/:token', async (req, res, next) => {
  try {
    const [share] = await sql`SELECT * FROM project_shares WHERE token = ${req.params.token}`;
    if (!share) return res.status(404).json({ error: 'Share not found' });

    const projectId = share.project_id;
    const viewType = share.view_type;
    const talentName = share.talent_name;

    // Load project base info
    const [project] = await sql`
      SELECT p.id, p.code, p.title, p.subtitle, p.client, p.city, p.state, p.start_date, p.end_date, p.status, p.notes,
             cm.name as poc_name, cm.phone as poc_phone, cm.email as poc_email
      FROM projects p
      LEFT JOIN crew_members cm ON cm.id = p.poc_crew_member_id
      WHERE p.id = ${projectId}`;
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [locations, techSpecs, clientContacts, keyTalent] = await Promise.all([
      sql`SELECT * FROM locations WHERE project_id = ${projectId}`,
      sql`SELECT * FROM tech_specs WHERE project_id = ${projectId}`,
      sql`SELECT * FROM client_contacts WHERE project_id = ${projectId}`,
      sql`SELECT * FROM key_talent WHERE project_id = ${projectId}`,
    ]);

    const crewAssignments = await sql`
      SELECT ca.*, p.name as position_name, p.sort_order,
             cm.id as cm_id, cm.name as cm_name, cm.email as cm_email, cm.phone as cm_phone, cm.company as cm_company, cm.initials, cm.avatar_color, cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last
      FROM crew_assignments ca
      JOIN positions p ON p.id = ca.position_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
      WHERE ca.project_id = ${projectId}
      ORDER BY p.sort_order, ca.slot_number`;

    const mappedCrew = crewAssignments.map(a => ({
      ...a,
      position: { id: a.position_id, name: a.position_name, sortOrder: a.sort_order },
      crewMember: a.cm_id ? { id: a.cm_id, name: a.cm_name, preferredFirstName: a.cm_pref_first, preferredLastName: a.cm_pref_last, email: a.cm_email, phone: a.cm_phone, company: a.cm_company, initials: a.initials, avatarColor: a.avatar_color } : null,
    }));

    // Load schedule
    const shootDays = await sql`SELECT * FROM shoot_days WHERE project_id = ${projectId} ORDER BY day_number`;
    const totalDays = shootDays.length;

    // Fire-and-forget weather refresh (mutates shootDays rows in place)
    await refreshWeather(project, shootDays);

    const daysWithData = await Promise.all(shootDays.map(async day => {
      const events = await sql`
        SELECT se.*, l.name as location_name, l.address as location_address
        FROM schedule_events se
        LEFT JOIN locations l ON l.id = se.location_id
        WHERE se.shoot_day_id = ${day.id}
        ORDER BY se.start_time`;

      const crewCalls = await sql`
        SELECT cdc.*, ca.slot_number, ca.position_id, p.name as position_name,
               cm.id as cm_id, cm.name as cm_name, cm.phone as cm_phone, cm.preferred_first_name as cm_pref_first, cm.preferred_last_name as cm_pref_last
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
          crewAssignment: { id: c.crew_assignment_id, positionId: c.position_id, slotNumber: c.slot_number, position: { name: c.position_name }, crewMember: c.cm_id ? { id: c.cm_id, name: c.cm_name, preferredFirstName: c.cm_pref_first, preferredLastName: c.cm_pref_last, phone: c.cm_phone } : null }
        })),
      };
    }));

    let responseData = { view_type: viewType, talent_name: talentName, project };

    if (viewType === 'producer') {
      const safe = async (q) => { try { return await q; } catch(e) { console.error('share query failed:', e.message); return []; } };
      const [flights, hotelBlocks, rentalCars, deliverables, gear, onlineRentals] = await Promise.all([
        safe(sql`SELECT id, passenger_name, origin, destination, depart_time, arrive_time, depart_display, arrive_display, airline, flight_number, confirmation, is_return,
                   COALESCE(NULLIF(TRIM(COALESCE(cm.preferred_first_name,'') || ' ' || COALESCE(cm.preferred_last_name,'')), ''), cm.name) as crew_name
            FROM flights f LEFT JOIN crew_members cm ON cm.id = f.crew_member_id
            WHERE f.project_id = ${projectId} ORDER BY f.depart_time`),
        safe(sql`SELECT hb.id, hb.name, hb.address, hb.phone,
                   json_agg(json_build_object('id',hg.id,'guest_name',hg.guest_name,'crew_member_id',hg.crew_member_id,'check_in',hg.check_in,'check_out',hg.check_out,'confirmation',hg.confirmation) ORDER BY hg.check_in) FILTER (WHERE hg.id IS NOT NULL) as guests
            FROM hotel_blocks hb LEFT JOIN hotel_guests hg ON hg.hotel_block_id = hb.id
            WHERE hb.project_id = ${projectId} GROUP BY hb.id, hb.name, hb.address, hb.phone`),
        safe(sql`SELECT id, vendor, pickup_location, dropoff_location, pickup_date, dropoff_date, confirmation, notes FROM rental_cars WHERE project_id = ${projectId}`),
        safe(sql`SELECT id, title, description, status, editor_name, aspect_ratio, resolution, due_date, is_urgent FROM deliverables WHERE project_id = ${projectId} ORDER BY created_at`),
        safe(sql`SELECT pg.*, cm.name as gear_person_name, cm.phone as gear_person_phone FROM project_gear pg LEFT JOIN crew_members cm ON cm.id = pg.gear_person_id WHERE pg.project_id = ${projectId}`),
        safe(sql`SELECT id, renter_name, confirmation, tracking_number, notes FROM online_rentals WHERE project_id = ${projectId} ORDER BY created_at`),
      ]);
      responseData = {
        ...responseData,
        locations,
        techSpecs: techSpecs[0] || null,
        clientContacts,
        keyTalent,
        crewAssignments: mappedCrew,
        schedule: daysWithData,
        flights,
        hotelBlocks,
        rentalCars,
        deliverables,
        gear: gear[0] || null,
        onlineRentals,
      };
    } else if (viewType === 'crew') {
      const filteredDays = daysWithData.map(day => ({
        ...day,
        events: day.events.filter(e => !e.audience || e.audience.length === 0 || e.audience.includes('crew')),
        crewCalls: day.crewCalls.filter(c => !c.audience || c.audience.length === 0 || c.audience.includes('crew')),
      }));
      const safe2 = async (q) => { try { return await q; } catch(e) { console.error('share query failed:', e.message); return []; } };
      const [crewFlights, crewHotels, crewCars, crewDeliverables, crewGear, crewOnlineRentals] = await Promise.all([
        safe2(sql`SELECT id, passenger_name, origin, destination, depart_time, arrive_time, depart_display, arrive_display, airline, flight_number, confirmation, is_return,
                   COALESCE(NULLIF(TRIM(COALESCE(cm.preferred_first_name,'') || ' ' || COALESCE(cm.preferred_last_name,'')), ''), cm.name) as crew_name
            FROM flights f LEFT JOIN crew_members cm ON cm.id = f.crew_member_id
            WHERE f.project_id = ${projectId} ORDER BY f.depart_time`),
        safe2(sql`SELECT hb.id, hb.name, hb.address, hb.phone,
                   json_agg(json_build_object('id',hg.id,'guest_name',hg.guest_name,'crew_member_id',hg.crew_member_id,'check_in',hg.check_in,'check_out',hg.check_out,'confirmation',hg.confirmation) ORDER BY hg.check_in) FILTER (WHERE hg.id IS NOT NULL) as guests
            FROM hotel_blocks hb LEFT JOIN hotel_guests hg ON hg.hotel_block_id = hb.id
            WHERE hb.project_id = ${projectId} GROUP BY hb.id, hb.name, hb.address, hb.phone`),
        safe2(sql`SELECT id, vendor, pickup_location, dropoff_location, pickup_date, dropoff_date, confirmation, notes FROM rental_cars WHERE project_id = ${projectId}`),
        safe2(sql`SELECT id, title, description, status, editor_name, aspect_ratio, resolution, due_date, is_urgent FROM deliverables WHERE project_id = ${projectId} ORDER BY created_at`),
        safe2(sql`SELECT pg.*, cm.name as gear_person_name, cm.phone as gear_person_phone FROM project_gear pg LEFT JOIN crew_members cm ON cm.id = pg.gear_person_id WHERE pg.project_id = ${projectId}`),
        safe2(sql`SELECT id, renter_name, confirmation, tracking_number, notes FROM online_rentals WHERE project_id = ${projectId} ORDER BY created_at`),
      ]);
      responseData = {
        ...responseData,
        locations,
        techSpecs: techSpecs[0] || null,
        clientContacts,
        keyTalent,
        crewAssignments: mappedCrew,
        schedule: filteredDays,
        flights: crewFlights,
        hotelBlocks: crewHotels,
        rentalCars: crewCars,
        deliverables: crewDeliverables,
        gear: crewGear[0] || null,
        onlineRentals: crewOnlineRentals,
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

// PATCH /share/:token/gear — crew-safe gear list update (no auth, token scoped)
router.patch('/:token/gear', async (req, res, next) => {
  try {
    const [share] = await sql`SELECT * FROM project_shares WHERE token = ${req.params.token}`;
    if (!share) return res.status(404).json({ error: 'Share not found' });
    if (share.view_type !== 'crew' && share.view_type !== 'producer') return res.status(403).json({ error: 'Not allowed' });

    const { camera_gear, grip_gear, electric_gear, audio_gear, media_management_gear, editing_gear } = req.body;
    const [gear] = await sql`
      INSERT INTO project_gear (project_id, camera_gear, grip_gear, electric_gear, audio_gear, media_management_gear, editing_gear)
      VALUES (${share.project_id}, ${camera_gear||null}, ${grip_gear||null}, ${electric_gear||null}, ${audio_gear||null}, ${media_management_gear||null}, ${editing_gear||null})
      ON CONFLICT (project_id) DO UPDATE SET
        camera_gear = EXCLUDED.camera_gear,
        grip_gear = EXCLUDED.grip_gear,
        electric_gear = EXCLUDED.electric_gear,
        audio_gear = EXCLUDED.audio_gear,
        media_management_gear = EXCLUDED.media_management_gear,
        editing_gear = EXCLUDED.editing_gear
      RETURNING *`;
    res.json(gear);
  } catch(e){ next(e); }
});

module.exports = router;
