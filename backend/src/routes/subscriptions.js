const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

// Subscriptions register — post-pro tools/logins. Passwords are never stored;
// only type, name, website, and login handle. Types persist for the picker.

async function typeList() {
  const rows = await sql`SELECT name FROM subscription_types ORDER BY LOWER(name)`;
  return rows.map(r => r.name);
}
async function saveType(t) {
  const name = (t || '').trim();
  if (name) await sql`INSERT INTO subscription_types (name) VALUES (${name}) ON CONFLICT (name) DO NOTHING`;
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const items = await sql`
      SELECT id, type, name, website, login_name, created_at
      FROM subscriptions ORDER BY LOWER(COALESCE(type, '~')), LOWER(name)`;
    res.json({ items, types: await typeList() });
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { type, name, website, loginName } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const t = (type || '').trim() || null;
    await saveType(t);
    const [item] = await sql`
      INSERT INTO subscriptions (type, name, website, login_name, created_by)
      VALUES (${t}, ${name.trim()}, ${website?.trim() || null}, ${loginName?.trim() || null}, ${req.user.name || req.user.email})
      RETURNING id, type, name, website, login_name, created_at`;
    res.status(201).json({ item, types: await typeList() });
  } catch (e) { next(e); }
});

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const d = req.body || {};
    if (d.type !== undefined) await saveType(d.type);
    const [item] = await sql`
      UPDATE subscriptions SET
        type = ${d.type !== undefined ? ((d.type || '').trim() || null) : sql`type`},
        name = ${d.name !== undefined ? d.name : sql`name`},
        website = ${d.website !== undefined ? (d.website || null) : sql`website`},
        login_name = ${d.loginName !== undefined ? (d.loginName || null) : sql`login_name`}
      WHERE id = ${req.params.id}
      RETURNING id, type, name, website, login_name, created_at`;
    if (!item) return res.status(404).json({ error: 'Subscription not found' });
    res.json({ item, types: await typeList() });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await sql`DELETE FROM subscriptions WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
