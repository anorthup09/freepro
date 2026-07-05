const router = require('express').Router();
const { z } = require('zod');
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Positions ───────────────────────────────────────────────────────────────

router.get('/positions', requireAuth, async (req, res, next) => {
  try {
    res.json(await sql`SELECT * FROM positions WHERE is_active = TRUE ORDER BY sort_order`);
  } catch (err) { next(err); }
});

router.post('/positions', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, sortOrder = 0 } = z.object({ name: z.string().min(1), sortOrder: z.number().optional() }).parse(req.body);
    const [p] = await sql`INSERT INTO positions (id, name, sort_order) VALUES (gen_random_uuid()::text, ${name}, ${sortOrder}) RETURNING *`;
    res.status(201).json(p);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === '23505') return res.status(409).json({ error: 'Position already exists' });
    next(err);
  }
});

router.patch('/positions/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, sortOrder, isActive } = req.body;
    const [p] = await sql`
      UPDATE positions SET
        name = COALESCE(${name ?? null}, name),
        sort_order = COALESCE(${sortOrder ?? null}, sort_order),
        is_active = COALESCE(${isActive ?? null}, is_active)
      WHERE id = ${req.params.id} RETURNING *`;
    res.json(p);
  } catch (err) { next(err); }
});

// ─── Crew Members ─────────────────────────────────────────────────────────────

const crewSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional().nullable(),
  initials: z.string().max(3).optional(),
  avatarColor: z.string().optional(),
  isActive: z.boolean().optional(),
  homeAirport: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  passportNumber: z.string().optional().nullable(),
  passportExpiry: z.string().optional().nullable(),
  knownTravelerNumber: z.string().optional().nullable(),
  seatPreference: z.string().optional().nullable(),
  emergencyContact: z.string().optional().nullable(),
  emergencyPhone: z.string().optional().nullable(),
  preferredFirstName: z.string().optional().nullable(),
  preferredLastName: z.string().optional().nullable(),
  dietaryRestrictions: z.string().optional().nullable(),
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await sql`SELECT * FROM crew_members WHERE is_active = TRUE ORDER BY name`);
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const [member] = await sql`SELECT * FROM crew_members WHERE id = ${req.params.id}`;
    if (!member) return res.status(404).json({ error: 'Crew member not found' });
    const assignments = await sql`
      SELECT ca.*, p.name as position_name, pr.id as project_id, pr.code, pr.title, pr.start_date, pr.end_date
      FROM crew_assignments ca
      JOIN positions p ON p.id = ca.position_id
      JOIN projects pr ON pr.id = ca.project_id
      WHERE ca.crew_member_id = ${req.params.id}
      ORDER BY pr.start_date DESC NULLS LAST`;
    res.json({ ...member, assignments });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const data = crewSchema.parse(req.body);
    const [m] = await sql`
      INSERT INTO crew_members (id, name, email, phone, company, initials, avatar_color)
      VALUES (gen_random_uuid()::text, ${data.name}, ${data.email||null}, ${data.phone||null}, ${data.company||null}, ${data.initials||null}, ${data.avatarColor||null})
      RETURNING *`;
    res.status(201).json(m);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.patch('/:id', requireAuth, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const data = crewSchema.partial().parse(req.body);
    const [m] = await sql`
      UPDATE crew_members SET
        name = COALESCE(${data.name ?? null}, name),
        email = COALESCE(${data.email ?? null}, email),
        phone = COALESCE(${data.phone ?? null}, phone),
        company = COALESCE(${data.company ?? null}, company),
        is_active = COALESCE(${data.isActive ?? null}, is_active),
        home_airport = ${data.homeAirport !== undefined ? (data.homeAirport||null) : sql`home_airport`},
        notes = ${data.notes !== undefined ? (data.notes||null) : sql`notes`},
        date_of_birth = ${data.dateOfBirth !== undefined ? (data.dateOfBirth||null) : sql`date_of_birth`},
        passport_number = ${data.passportNumber !== undefined ? (data.passportNumber||null) : sql`passport_number`},
        passport_expiry = ${data.passportExpiry !== undefined ? (data.passportExpiry||null) : sql`passport_expiry`},
        known_traveler_number = ${data.knownTravelerNumber !== undefined ? (data.knownTravelerNumber||null) : sql`known_traveler_number`},
        seat_preference = ${data.seatPreference !== undefined ? (data.seatPreference||null) : sql`seat_preference`},
        emergency_contact = ${data.emergencyContact !== undefined ? (data.emergencyContact||null) : sql`emergency_contact`},
        emergency_phone = ${data.emergencyPhone !== undefined ? (data.emergencyPhone||null) : sql`emergency_phone`},
        preferred_first_name = ${data.preferredFirstName !== undefined ? (data.preferredFirstName||null) : sql`preferred_first_name`},
        preferred_last_name = ${data.preferredLastName !== undefined ? (data.preferredLastName||null) : sql`preferred_last_name`},
        dietary_restrictions = ${data.dietaryRestrictions !== undefined ? (data.dietaryRestrictions||null) : sql`dietary_restrictions`},
        updated_at = NOW()
      WHERE id = ${req.params.id} RETURNING *`;
    res.json(m);
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await sql`UPDATE crew_members SET is_active = FALSE WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
