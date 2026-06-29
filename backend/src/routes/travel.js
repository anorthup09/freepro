const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Hotels ──────────────────────────────────────────────────────────────────
router.get('/:id/travel/hotels', requireAuth, async (req, res, next) => {
  try {
    const hotels = await sql`SELECT * FROM hotel_blocks WHERE project_id = ${req.params.id}`;
    const result = await Promise.all(hotels.map(async h => {
      const guests = await sql`SELECT hg.*, cm.name as crew_name FROM hotel_guests hg LEFT JOIN crew_members cm ON cm.id=hg.crew_member_id WHERE hg.hotel_block_id=${h.id}`;
      return { ...h, guests };
    }));
    res.json(result);
  } catch(e){next(e);}
});

router.post('/:id/travel/hotels', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, address, phone, notes } = req.body;
    const [h] = await sql`INSERT INTO hotel_blocks (id, project_id, name, address, phone, notes) VALUES (gen_random_uuid()::text, ${req.params.id}, ${name}, ${address}, ${phone||null}, ${notes||null}) RETURNING *`;
    res.status(201).json({ ...h, guests: [] });
  } catch(e){next(e);}
});

router.patch('/:id/travel/hotels/:hid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [h] = await sql`UPDATE hotel_blocks SET name=COALESCE(${d.name??null},name), address=COALESCE(${d.address??null},address), phone=COALESCE(${d.phone??null},phone) WHERE id=${req.params.hid} RETURNING *`;
    res.json(h);
  } catch(e){next(e);}
});

router.delete('/:id/travel/hotels/:hid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM hotel_blocks WHERE id = ${req.params.hid}`; res.status(204).end(); } catch(e){next(e);}
});

router.post('/:id/travel/hotels/:hid/guests', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { crewMemberId, guestName, confirmation, checkIn, checkOut } = req.body;
    const [g] = await sql`INSERT INTO hotel_guests (id, hotel_block_id, crew_member_id, guest_name, confirmation, check_in, check_out) VALUES (gen_random_uuid()::text, ${req.params.hid}, ${crewMemberId||null}, ${guestName}, ${confirmation||null}, ${checkIn}, ${checkOut}) RETURNING *`;
    res.status(201).json(g);
  } catch(e){next(e);}
});

router.patch('/:id/travel/guests/:gid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [g] = await sql`UPDATE hotel_guests SET guest_name=COALESCE(${d.guestName??null},guest_name), confirmation=COALESCE(${d.confirmation??null},confirmation), check_in=COALESCE(${d.checkIn??null},check_in), check_out=COALESCE(${d.checkOut??null},check_out) WHERE id=${req.params.gid} RETURNING *`;
    res.json(g);
  } catch(e){next(e);}
});

router.delete('/:id/travel/guests/:gid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM hotel_guests WHERE id = ${req.params.gid}`; res.status(204).end(); } catch(e){next(e);}
});

// ─── Flights ─────────────────────────────────────────────────────────────────
router.get('/:id/travel/flights', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT f.*, cm.name as crew_name FROM flights f LEFT JOIN crew_members cm ON cm.id=f.crew_member_id WHERE f.project_id=${req.params.id} ORDER BY f.depart_time`); } catch(e){next(e);}
});

router.post('/:id/travel/flights', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [f] = await sql`
      INSERT INTO flights (id, project_id, crew_member_id, passenger_name, origin, destination, depart_time, arrive_time, airline, confirmation, is_return)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${d.crewMemberId||null}, ${d.passengerName}, ${d.origin}, ${d.destination}, ${d.departTime}, ${d.arriveTime}, ${d.airline||null}, ${d.confirmation||null}, ${d.isReturn||false})
      RETURNING *`;
    res.status(201).json(f);
  } catch(e){next(e);}
});

router.patch('/:id/travel/flights/:fid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [f] = await sql`UPDATE flights SET passenger_name=COALESCE(${d.passengerName??null},passenger_name), airline=COALESCE(${d.airline??null},airline), confirmation=COALESCE(${d.confirmation??null},confirmation) WHERE id=${req.params.fid} RETURNING *`;
    res.json(f);
  } catch(e){next(e);}
});

router.delete('/:id/travel/flights/:fid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM flights WHERE id = ${req.params.fid}`; res.status(204).end(); } catch(e){next(e);}
});

// ─── Drive Groups ────────────────────────────────────────────────────────────
router.get('/:id/travel/drives', requireAuth, async (req, res, next) => {
  try {
    const drives = await sql`SELECT * FROM drive_groups WHERE project_id = ${req.params.id}`;
    const result = await Promise.all(drives.map(async d => {
      const members = await sql`SELECT * FROM drive_group_members WHERE drive_group_id = ${d.id}`;
      return { ...d, members };
    }));
    res.json(result);
  } catch(e){next(e);}
});

router.post('/:id/travel/drives', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { origin, destination, notes, members=[] } = req.body;
    const [d] = await sql`INSERT INTO drive_groups (id, project_id, origin, destination, notes) VALUES (gen_random_uuid()::text, ${req.params.id}, ${origin}, ${destination}, ${notes||null}) RETURNING *`;
    const mems = await Promise.all(members.map(m => sql`INSERT INTO drive_group_members (id, drive_group_id, name, crew_member_id) VALUES (gen_random_uuid()::text, ${d.id}, ${m.name}, ${m.crewMemberId||null}) RETURNING *`));
    res.status(201).json({ ...d, members: mems.flat() });
  } catch(e){next(e);}
});

router.delete('/:id/travel/drives/:did', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM drive_groups WHERE id = ${req.params.did}`; res.status(204).end(); } catch(e){next(e);}
});

module.exports = router;
