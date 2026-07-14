const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

// ─── Resource libraries (Reports): music resources + video references ───────
const KINDS = ['music', 'video'];
const checkKind = (req, res, next) => KINDS.includes(req.params.kind)
  ? next() : res.status(400).json({ error: 'Unknown resource kind' });

// Shared tag list (both libraries) — grouping tags; additions must be unique.
router.get('/tags', requireAuth, async (req, res, next) => {
  try {
    res.json(await sql`SELECT * FROM resource_tags ORDER BY name`);
  } catch (e) { next(e); }
});

router.post('/tags', requireAuth, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Tag name required' });
    const [dup] = await sql`SELECT id FROM resource_tags WHERE LOWER(name) = LOWER(${name})`;
    if (dup) return res.status(409).json({ error: 'That tag already exists' });
    const [t] = await sql`INSERT INTO resource_tags (name) VALUES (${name}) RETURNING *`;
    res.status(201).json(t);
  } catch (e) { next(e); }
});

router.get('/:kind', requireAuth, checkKind, async (req, res, next) => {
  try {
    res.json(await sql`SELECT * FROM resource_links WHERE kind = ${req.params.kind} ORDER BY category NULLS LAST, title`);
  } catch (e) { next(e); }
});

router.post('/:kind', requireAuth, checkKind, async (req, res, next) => {
  try {
    const { title, url, category, note } = req.body;
    if (!title || !String(title).trim()) return res.status(400).json({ error: 'Title required' });
    const [r] = await sql`
      INSERT INTO resource_links (kind, title, url, category, note, added_by)
      VALUES (${req.params.kind}, ${String(title).trim()}, ${url || null}, ${category || null}, ${note || null}, ${req.user?.name || req.user?.email || null})
      RETURNING *`;
    res.status(201).json(r);
  } catch (e) { next(e); }
});

router.patch('/:kind/:id', requireAuth, checkKind, async (req, res, next) => {
  try {
    const d = req.body;
    const [r] = await sql`
      UPDATE resource_links SET
        title = COALESCE(${d.title ?? null}, title),
        url = ${d.url !== undefined ? (d.url || null) : sql`url`},
        category = ${d.category !== undefined ? (d.category || null) : sql`category`},
        note = ${d.note !== undefined ? (d.note || null) : sql`note`}
      WHERE id = ${req.params.id} AND kind = ${req.params.kind}
      RETURNING *`;
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
  } catch (e) { next(e); }
});

router.delete('/:kind/:id', requireAuth, checkKind, async (req, res, next) => {
  try {
    await sql`DELETE FROM resource_links WHERE id = ${req.params.id} AND kind = ${req.params.kind}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
