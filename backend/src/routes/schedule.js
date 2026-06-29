const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const shootDaySchema = z.object({
  dayNumber: z.number().int().positive(),
  date: z.string().datetime(),
  callTime: z.string().optional(),
  wrapTime: z.string().optional(),
  weather: z.string().optional(),
  notes: z.string().optional(),
});

const eventSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().optional(),
  title: z.string().min(1),
  detail: z.string().optional(),
  locationId: z.string().optional(),
  isAlert: z.boolean().optional(),
  alertMessage: z.string().optional(),
  tags: z.array(z.object({
    type: z.enum(['VIDEO','PHOTO','AUDIO','ALL_CREW','TALENT','CUSTOM']),
    label: z.string().optional(),
  })).optional(),
});

// GET /api/projects/:id/schedule
router.get('/:id/schedule', requireAuth, async (req, res, next) => {
  try {
    const days = await prisma.shootDay.findMany({
      where: { projectId: req.params.id },
      orderBy: { dayNumber: 'asc' },
      include: {
        events: {
          orderBy: { startTime: 'asc' },
          include: { tags: true, crewTags: { include: { crewMember: true } }, location: true },
        },
      },
    });
    res.json(days);
  } catch (err) { next(err); }
});

// POST /api/projects/:id/schedule/days
router.post('/:id/schedule/days', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = shootDaySchema.parse(req.body);
    const day = await prisma.shootDay.create({ data: { ...data, projectId: req.params.id } });
    res.status(201).json(day);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Day number already exists for this project' });
    next(err);
  }
});

// PATCH /api/projects/:id/schedule/days/:dayId
router.patch('/:id/schedule/days/:dayId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = shootDaySchema.partial().parse(req.body);
    const day = await prisma.shootDay.update({ where: { id: req.params.dayId }, data });
    res.json(day);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// DELETE /api/projects/:id/schedule/days/:dayId
router.delete('/:id/schedule/days/:dayId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.shootDay.delete({ where: { id: req.params.dayId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// POST /api/projects/:id/schedule/days/:dayId/events
router.post('/:id/schedule/days/:dayId/events', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { tags, ...rest } = eventSchema.parse(req.body);
    const event = await prisma.scheduleEvent.create({
      data: {
        ...rest,
        shootDayId: req.params.dayId,
        tags: tags ? { create: tags } : undefined,
      },
      include: { tags: true, crewTags: { include: { crewMember: true } }, location: true },
    });
    res.status(201).json(event);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// PATCH /api/projects/:id/schedule/events/:eventId
router.patch('/:id/schedule/events/:eventId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { tags, ...rest } = eventSchema.partial().parse(req.body);
    const event = await prisma.scheduleEvent.update({
      where: { id: req.params.eventId },
      data: rest,
      include: { tags: true, crewTags: { include: { crewMember: true } }, location: true },
    });
    res.json(event);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// DELETE /api/projects/:id/schedule/events/:eventId
router.delete('/:id/schedule/events/:eventId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.scheduleEvent.delete({ where: { id: req.params.eventId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// POST /api/projects/:id/schedule/events/:eventId/crew-tags
router.post('/:id/schedule/events/:eventId/crew-tags', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { crewMemberId, note } = req.body;
    const tag = await prisma.eventCrewTag.create({
      data: { eventId: req.params.eventId, crewMemberId, note },
      include: { crewMember: true },
    });
    res.status(201).json(tag);
  } catch (err) { next(err); }
});

module.exports = router;
