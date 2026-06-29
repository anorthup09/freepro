const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const crewSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  initials: z.string().max(3).optional(),
  avatarColor: z.string().optional(),
});

// GET /api/crew
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const members = await prisma.crewMember.findMany({
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
        assignments: { include: { project: { select: { id: true, code: true, title: true, startDate: true, endDate: true } } } },
      },
    });
    if (!member) return res.status(404).json({ error: 'Crew member not found' });
    res.json(member);
  } catch (err) { next(err); }
});

// POST /api/crew
router.post('/', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
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
router.patch('/:id', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = crewSchema.partial().parse(req.body);
    const member = await prisma.crewMember.update({ where: { id: req.params.id }, data });
    res.json(member);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Crew member not found' });
    next(err);
  }
});

// DELETE /api/crew/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.crewMember.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Crew member not found' });
    next(err);
  }
});

module.exports = router;
