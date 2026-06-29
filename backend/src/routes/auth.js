const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const registerSchema = z.object({ name: z.string().min(1), email: z.string().email(), password: z.string().min(8) });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function makeToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length) return res.status(409).json({ error: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 12);
    const [user] = await sql`INSERT INTO users (id, name, email, password) VALUES (gen_random_uuid()::text, ${name}, ${email}, ${hashed}) RETURNING id, name, email, role`;
    res.status(201).json({ token: makeToken(user), user });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const [user] = await sql`SELECT * FROM users WHERE email = ${email}`;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [user] = await sql`SELECT id, name, email, role, created_at FROM users WHERE id = ${req.user.id}`;
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
