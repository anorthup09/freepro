const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

// Testing feedback & feature requests — the one running list
router.get('/', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM feedback_items ORDER BY done, created_at DESC`); } catch (e) { next(e); }
});
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Text required' });
    const attachment = req.body.attachment || null;
    const [i] = await sql`INSERT INTO feedback_items (text, created_by, attachment) VALUES (${text}, ${req.user.name || req.user.email}, ${attachment}) RETURNING *`;
    res.status(201).json(i);
  } catch (e) { next(e); }
});
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const [i] = await sql`UPDATE feedback_items SET
        text = ${req.body.text !== undefined ? String(req.body.text) : sql`text`},
        done = ${req.body.done !== undefined ? req.body.done === true : sql`done`}
      WHERE id = ${req.params.id} RETURNING *`;
    if (!i) return res.status(404).json({ error: 'Not found' });
    res.json(i);
  } catch (e) { next(e); }
});
// Threaded answers under a feedback item
router.post('/:id/replies', requireAuth, async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Text required' });
    const reply = { text, by: req.user.name || req.user.email, at: new Date().toISOString() };
    const [i] = await sql`
      UPDATE feedback_items SET replies = COALESCE(replies, '[]'::jsonb) || ${sql.json(reply)}
      WHERE id = ${req.params.id} RETURNING *`;
    if (!i) return res.status(404).json({ error: 'Not found' });
    res.json(i);
  } catch (e) { next(e); }
});

// Edit an answer (author or admin only)
router.patch('/:id/replies/:idx', requireAuth, async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Text required' });
    const [item] = await sql`SELECT replies FROM feedback_items WHERE id = ${req.params.id}`;
    if (!item) return res.status(404).json({ error: 'Not found' });
    const replies = Array.isArray(item.replies) ? item.replies : JSON.parse(item.replies || '[]');
    const idx = Number(req.params.idx);
    if (!replies[idx]) return res.status(404).json({ error: 'Reply not found' });
    const me = req.user.name || req.user.email;
    if (replies[idx].by !== me && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only the author can edit this answer' });
    }
    replies[idx] = { ...replies[idx], text, edited_at: new Date().toISOString() };
    const [i] = await sql`UPDATE feedback_items SET replies = ${sql.json(replies)} WHERE id = ${req.params.id} RETURNING *`;
    res.json(i);
  } catch (e) { next(e); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try { await sql`DELETE FROM feedback_items WHERE id = ${req.params.id}`; res.status(204).end(); } catch (e) { next(e); }
});

module.exports = router;
