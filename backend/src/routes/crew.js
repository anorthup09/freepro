const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Positions (master list) ─────────────────────────────────────────────────

// GET /api/crew/positions
router.get('/positions', requireAuth, async (req, res, next) => {
  try {
    const positions = await prisma.position.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    res.json(positions);
  } catch (err) { next(err); }
});

// POST /api/crew/positions
router.post('/positions', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { name, sortOrder } = z.object({ name: z.string().min(1), sortOrder: z.number().optional() }).parse(req.body);
    const position = await prisma.position.create({ data: { name, sortOrder: sortOrder ?? 0 } });
    res.status(201).json(position);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Position already exists' });
    next(err);
  }
});

// PATCH /api/crew/positions/:id
router.patch('/positions/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const data = z.object({ name: z.string().optional(), sortOrder: z.number().optional(), isActive: z.boolean().optional() }).parse(req.body);
    res.json(await prisma.position.update({ where: { id: req.params.id }, data }));
  } catch (err) { next(err); }
});

// ─── Crew Members (global roster) ────────────────────────────────────────────

const crewSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  initials: z.string().max(3).optional(),
  avatarColor: z.string().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/crew
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const members = await prisma.crewMember.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { assignments: true } } },
    });
    res.json(members);
  } catch (err) { next(err); }
});

// GET /api/crew/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const member = await prisma.crewMember.findUnique({
      where: { id: req.params.id },
      include: {
        assignments: {
          include: {
            position: true,
            project: { select: { id: true, code: true, title: true, startDate: true, endDate: true } },
          },
        },
      },
    });
    if (!member) return res.status(404).json({ error: 'Crew member not found' });
    res.json(member);
  } catch (err) { next(err); }
});

// POST /api/crew
router.post('/', requireAuth, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const data = crewSchema.parse(req.body);
    const member = await prisma.crewMember.create({ data });
    res.status(201).json(member);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// PATCH /api/crew/:id
router.patch('/:id', requireAuth, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const data = crewSchema.partial().parse(req.body);
    res.json(await prisma.crewMember.update({ where: { id: req.params.id }, data }));
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Crew member not found' });
    next(err);
  }
});

// DELETE /api/crew/:id  (soft delete — sets isActive false)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.crewMember.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Crew member not found' });
    next(err);
  }
});

module.exports = router;
