const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Admin-managed, password-protected read-only Hub preview link. The link mints a
// short-lived guest JWT with role PRODUCER + readOnly, so the whole app renders
// as a producer would see it but every write is blocked server-side.

// GET current preview link config (admin only)
router.get('/config', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const [row] = await sql`SELECT token, password, role, created_at FROM hub_shares ORDER BY created_at DESC LIMIT 1`;
    res.json(row || null);
  } catch (e) { next(e); }
});

// Create or rotate the preview link (admin only)
router.post('/rotate', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const password = (req.body?.password || '').trim() || null;
    const token = crypto.randomBytes(9).toString('base64url');
    // Keep a single active link — clear old rows, insert the new one.
    await sql`DELETE FROM hub_shares`;
    const [row] = await sql`
      INSERT INTO hub_shares (token, password, role, created_by)
      VALUES (${token}, ${password}, 'PRODUCER', ${req.user.email || req.user.id})
      RETURNING token, password, role, created_at`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// Disable the preview link (admin only)
router.delete('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    await sql`DELETE FROM hub_shares`;
    res.status(204).end();
  } catch (e) { next(e); }
});

// Public: exchange a valid token (+ password) for a read-only guest session.
router.post('/authenticate', async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ error: 'Missing link token' });
    const [row] = await sql`SELECT token, password, role FROM hub_shares WHERE token = ${token}`;
    if (!row) return res.status(404).json({ error: 'This preview link is no longer active' });
    if (row.password && String(password || '') !== row.password) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
    const guest = jwt.sign(
      { id: 'hub-guest', email: 'preview@unbridledmedia.com', name: 'Producer Preview', role: row.role || 'PRODUCER', guest: true, readOnly: true },
      process.env.JWT_SECRET,
      { expiresIn: '2d' },
    );
    res.json({ token: guest, user: { id: 'hub-guest', name: 'Producer Preview', email: 'preview@unbridledmedia.com', role: row.role || 'PRODUCER', guest: true, readOnly: true } });
  } catch (e) { next(e); }
});

module.exports = router;
