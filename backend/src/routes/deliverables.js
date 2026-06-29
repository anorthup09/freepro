const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../lib/prisma');
const { requireAuth, requireRole } = require('../middleware/auth');

const deliverableSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['WAITING_ON_ASSETS','IN_PROGRESS','ROUGH_CUT','IN_REVIEW','APPROVED','DELIVERED']).optional(),
  editorName: z.string().optional(),
  aspectRatio: z.string().optional(),
  resolution: z.string().optional(),
  dueDate: z.string().optional(),
  assetRef: z.string().optional(),
  musicRef: z.string().optional(),
  isUrgent: z.boolean().optional(),
  notes: z.string().optional(),
});

// GET /api/projects/:id/deliverables
router.get('/:id/deliverables', requireAuth, async (req, res, next) => {
  try {
    const items = await prisma.deliverable.findMany({
      where: { projectId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json(items);
  } catch (err) { next(err); }
});

// POST /api/projects/:id/deliverables
router.post('/:id/deliverables', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = deliverableSchema.parse(req.body);
    const item = await prisma.deliverable.create({ data: { ...data, projectId: req.params.id } });
    res.status(201).json(item);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// PATCH /api/projects/:id/deliverables/:dId
router.patch('/:id/deliverables/:dId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const data = deliverableSchema.partial().parse(req.body);
    const item = await prisma.deliverable.update({ where: { id: req.params.dId }, data });
    res.json(item);
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// DELETE /api/projects/:id/deliverables/:dId
router.delete('/:id/deliverables/:dId', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await prisma.deliverable.delete({ where: { id: req.params.dId } });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
