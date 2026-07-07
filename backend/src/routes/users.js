const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const ROLES = ['ADMIN', 'PRODUCER', 'CREW', 'CLIENT', 'PENDING'];

router.get('/', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    res.json(await sql`SELECT id, name, email, role, created_at FROM users ORDER BY created_at`);
  } catch (e) { next(e); }
});

router.patch('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (req.params.id === req.user.id && role !== 'ADMIN') {
      return res.status(400).json({ error: "You can't remove your own admin access" });
    }
    const [u] = await sql`UPDATE users SET role = ${role}::user_role WHERE id = ${req.params.id} RETURNING id, name, email, role`;
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json(u);
  } catch (e) { next(e); }
});

// Admin sets a new password for a user. Old passwords are bcrypt-hashed and
// can never be read back — this overwrites the hash without revealing anything.
router.patch('/:id/password', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password, 12);
    const [u] = await sql`UPDATE users SET password = ${hashed}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING id, name, email`;
    if (!u) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account" });
    await sql`DELETE FROM users WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
