const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Hotels ──────────────────────────────────────────────────────────────────

const hotelBlockSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

const hotelGuestSchema = z.object({
  crewMemberId: z.string().optional(),
  guestName: z.string().min(1),
  confirmation: z.string().optional(),
  checkIn: z.string().datetime(),
  checkOut: z.string().datetime(),
});

// GET /api/projects/:id/travel/hotels
router.get('/:id/travel/hotels', requireAuth, async (req, res, next) => {
  try {
    const hotels = await prisma.hotelBlock.findMany({
      where: { projectId: req.params.id },
      include: { guests: { include: { crewMember: true } } },
    });
    res.json(hotels);
  } catch (err) { next(err); }
});

router.post('/:id/travel/hotels', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = hotelBlockSchema.parse(req.body);
    const hotel = await prisma.hotelBlock.create({
      data: { ...data, projectId: req.params.id },
      include: { guests: true },
    });
    res.status(201).json(hotel);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.patch('/:id/travel/hotels/:hId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = hotelBlockSchema.partial().parse(req.body);
    res.json(await prisma.hotelBlock.update({ where: { id: req.params.hId }, data }));
  } catch (err) { next(err); }
});

router.delete('/:id/travel/hotels/:hId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.hotelBlock.delete({ where: { id: req.params.hId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

router.post('/:id/travel/hotels/:hId/guests', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = hotelGuestSchema.parse(req.body);
    const guest = await prisma.hotelGuest.create({
      data: { ...data, hotelBlockId: req.params.hId },
      include: { crewMember: true },
    });
    res.status(201).json(guest);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.patch('/:id/travel/guests/:gId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = hotelGuestSchema.partial().parse(req.body);
    res.json(await prisma.hotelGuest.update({ where: { id: req.params.gId }, data }));
  } catch (err) { next(err); }
});

router.delete('/:id/travel/guests/:gId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.hotelGuest.delete({ where: { id: req.params.gId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── Flights ─────────────────────────────────────────────────────────────────

const flightSchema = z.object({
  crewMemberId: z.string().optional(),
  passengerName: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  departTime: z.string().datetime(),
  arriveTime: z.string().datetime(),
  airline: z.string().optional(),
  confirmation: z.string().optional(),
  isReturn: z.boolean().optional(),
});

router.get('/:id/travel/flights', requireAuth, async (req, res, next) => {
  try {
    const flights = await prisma.flight.findMany({
      where: { projectId: req.params.id },
      orderBy: { departTime: 'asc' },
      include: { crewMember: true },
    });
    res.json(flights);
  } catch (err) { next(err); }
});

router.post('/:id/travel/flights', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = flightSchema.parse(req.body);
    const flight = await prisma.flight.create({
      data: { ...data, projectId: req.params.id },
      include: { crewMember: true },
    });
    res.status(201).json(flight);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.patch('/:id/travel/flights/:fId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = flightSchema.partial().parse(req.body);
    res.json(await prisma.flight.update({ where: { id: req.params.fId }, data }));
  } catch (err) { next(err); }
});

router.delete('/:id/travel/flights/:fId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.flight.delete({ where: { id: req.params.fId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── Drive Groups ────────────────────────────────────────────────────────────

const driveGroupSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  departTime: z.string().datetime().optional(),
  arriveTime: z.string().datetime().optional(),
  notes: z.string().optional(),
  members: z.array(z.object({
    crewMemberId: z.string().optional(),
    name: z.string().min(1),
  })).optional(),
});

router.get('/:id/travel/drives', requireAuth, async (req, res, next) => {
  try {
    const drives = await prisma.driveGroup.findMany({
      where: { projectId: req.params.id },
      include: { members: { include: { crewMember: true } } },
    });
    res.json(drives);
  } catch (err) { next(err); }
});

router.post('/:id/travel/drives', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { members, ...rest } = driveGroupSchema.parse(req.body);
    const drive = await prisma.driveGroup.create({
      data: {
        ...rest,
        projectId: req.params.id,
        members: members ? { create: members } : undefined,
      },
      include: { members: { include: { crewMember: true } } },
    });
    res.status(201).json(drive);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.delete('/:id/travel/drives/:dId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.driveGroup.delete({ where: { id: req.params.dId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
