const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

// Per-user favorited reports on the Reports & Resources page.
async function list(userId) {
  const rows = await sql`SELECT report_to FROM report_favorites WHERE user_id = ${userId} ORDER BY created_at`;
  return rows.map(r => r.report_to);
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json(await list(req.user.id));
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const to = (req.body?.to || '').trim();
    if (!to) return res.status(400).json({ error: 'Missing report' });
    // Guests (Hub preview) have a token but no users row — skip persistence.
    const [u] = await sql`SELECT id FROM users WHERE id = ${req.user.id}`;
    if (!u) return res.json([]);
    await sql`INSERT INTO report_favorites (user_id, report_to) VALUES (${req.user.id}, ${to}) ON CONFLICT DO NOTHING`;
    res.json(await list(req.user.id));
  } catch (e) { next(e); }
});

router.delete('/', requireAuth, async (req, res, next) => {
  try {
    const to = (req.body?.to || req.query?.to || '').trim();
    if (!to) return res.status(400).json({ error: 'Missing report' });
    await sql`DELETE FROM report_favorites WHERE user_id = ${req.user.id} AND report_to = ${to}`;
    res.json(await list(req.user.id));
  } catch (e) { next(e); }
});

module.exports = router;
