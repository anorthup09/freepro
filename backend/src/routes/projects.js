const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const projectSchema = z.object({
  code: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  client: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  status: z.enum(['PLANNING','ACTIVE','WRAPPED','DELIVERED','ARCHIVED']).optional(),
  notes: z.string().optional(),
});

const include = {
  locations: true,
  techSpecs: true,
  clientContacts: true,
  keyTalent: true,
  crewAssignments: { include: { crewMember: true } },
  deliverables: true,
};

// GET /api/projects
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { crewAssignments: true, deliverables: true, shootDays: true } } },
    });
    res.json(projects);
  } catch (err) { next(err); }
});

// GET /api/projects/:id
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include,
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) { next(err); }
});

// POST /api/projects
router.post('/', requireAuth, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const data = projectSchema.parse(req.body);
    const project = await prisma.project.create({ data, include });
    res.status(201).json(project);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Project code already exists' });
    next(err);
  }
});

// PATCH /api/projects/:id
router.patch('/:id', requireAuth, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const data = projectSchema.partial().parse(req.body);
    const project = await prisma.project.update({ where: { id: req.params.id }, data, include });
    res.json(project);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === 'P2025') return res.status(404).json({ error: 'Project not found' });
    next(err);
  }
});

// DELETE /api/projects/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Project not found' });
    next(err);
  }
});

// ─── Nested: Locations ───────────────────────────────────────────────────────

const locationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  type: z.enum(['PRIMARY_VENUE','CREW_HOTEL','SECONDARY','AIRPORT','OTHER']),
  emoji: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/:id/locations', requireAuth, async (req, res, next) => {
  try {
    const locations = await prisma.location.findMany({ where: { projectId: req.params.id } });
    res.json(locations);
  } catch (err) { next(err); }
});

router.post('/:id/locations', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = locationSchema.parse(req.body);
    const loc = await prisma.location.create({ data: { ...data, projectId: req.params.id } });
    res.status(201).json(loc);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.patch('/:id/locations/:locId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = locationSchema.partial().parse(req.body);
    const loc = await prisma.location.update({ where: { id: req.params.locId }, data });
    res.json(loc);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.delete('/:id/locations/:locId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.location.delete({ where: { id: req.params.locId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── Nested: Tech Specs ──────────────────────────────────────────────────────

const techSpecSchema = z.object({
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  quality: z.string().optional(),
  cameras: z.string().optional(),
  execProducer: z.string().optional(),
  onSiteEditor: z.string().optional(),
  notes: z.string().optional(),
});

router.put('/:id/tech-specs', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = techSpecSchema.parse(req.body);
    const spec = await prisma.techSpec.upsert({
      where: { projectId: req.params.id },
      update: data,
      create: { ...data, projectId: req.params.id },
    });
    res.json(spec);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── Nested: Client Contacts ─────────────────────────────────────────────────

const contactSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

router.get('/:id/contacts', requireAuth, async (req, res, next) => {
  try {
    res.json(await prisma.clientContact.findMany({ where: { projectId: req.params.id } }));
  } catch (err) { next(err); }
});

router.post('/:id/contacts', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = contactSchema.parse(req.body);
    const contact = await prisma.clientContact.create({ data: { ...data, projectId: req.params.id } });
    res.status(201).json(contact);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.patch('/:id/contacts/:cId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = contactSchema.partial().parse(req.body);
    res.json(await prisma.clientContact.update({ where: { id: req.params.cId }, data }));
  } catch (err) { next(err); }
});

router.delete('/:id/contacts/:cId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.clientContact.delete({ where: { id: req.params.cId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── Nested: Key Talent ──────────────────────────────────────────────────────

const talentSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  notes: z.string().optional(),
});

router.get('/:id/talent', requireAuth, async (req, res, next) => {
  try {
    res.json(await prisma.keyTalent.findMany({ where: { projectId: req.params.id } }));
  } catch (err) { next(err); }
});

router.post('/:id/talent', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = talentSchema.parse(req.body);
    res.status(201).json(await prisma.keyTalent.create({ data: { ...data, projectId: req.params.id } }));
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.patch('/:id/talent/:tId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = talentSchema.partial().parse(req.body);
    res.json(await prisma.keyTalent.update({ where: { id: req.params.tId }, data }));
  } catch (err) { next(err); }
});

router.delete('/:id/talent/:tId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.keyTalent.delete({ where: { id: req.params.tId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ─── Nested: Crew Assignments ────────────────────────────────────────────────

const assignmentSchema = z.object({
  crewMemberId: z.string().min(1),
  callTime: z.string().optional(),
  daysActive: z.string().optional(),
  notes: z.string().optional(),
});

router.get('/:id/crew', requireAuth, async (req, res, next) => {
  try {
    res.json(await prisma.crewAssignment.findMany({
      where: { projectId: req.params.id },
      include: { crewMember: true },
    }));
  } catch (err) { next(err); }
});

router.post('/:id/crew', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = assignmentSchema.parse(req.body);
    const assignment = await prisma.crewAssignment.create({
      data: { ...data, projectId: req.params.id },
      include: { crewMember: true },
    });
    res.status(201).json(assignment);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    if (err.code === 'P2002') return res.status(409).json({ error: 'Crew member already assigned' });
    next(err);
  }
});

router.patch('/:id/crew/:aId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = assignmentSchema.omit({ crewMemberId: true }).partial().parse(req.body);
    res.json(await prisma.crewAssignment.update({ where: { id: req.params.aId }, data, include: { crewMember: true } }));
  } catch (err) { next(err); }
});

router.delete('/:id/crew/:aId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.crewAssignment.delete({ where: { id: req.params.aId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
