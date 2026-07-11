const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
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
    const [user] = await sql`INSERT INTO users (id, name, email, password, role) VALUES (gen_random_uuid()::text, ${name}, ${email}, ${hashed}, 'PENDING'::user_role) RETURNING id, name, email, role`;
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
    if (user.mfa_enabled) {
      const mfaToken = jwt.sign({ id: user.id, stage: 'mfa' }, process.env.JWT_SECRET, { expiresIn: '5m' });
      return res.json({ mfaRequired: true, mfaToken });
    }
    res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, mfa_enabled: user.mfa_enabled === true, mfa_required: user.mfa_required === true } });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: err.errors });
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [user] = await sql`SELECT id, name, email, role, created_at, mfa_enabled, mfa_required FROM users WHERE id = ${req.user.id}`;
    // If the role changed since this token was issued (e.g. PENDING → ADMIN),
    // hand back a fresh token so the session picks up the new access.
    if (user && user.role !== req.user.role) return res.json({ ...user, refreshedToken: makeToken(user) });
    res.json(user);
  } catch (err) { next(err); }
});

// ── MFA (TOTP — works with Microsoft/Google Authenticator, 1Password, etc.) ──

// Complete a login that requires MFA
// Forgot password: always answers the same way so emails can't be probed.
// The reset email goes out via the shared mailer (dormant until SMTP is set).
router.post('/forgot-password', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required' });
    const [user] = await sql`SELECT id, name, email FROM users WHERE LOWER(email) = ${email}`;
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await sql`INSERT INTO password_resets (user_id, token, expires_at) VALUES (${user.id}, ${token}, NOW() + INTERVAL '1 hour')`;
      const { sendMail } = require('../lib/mailer');
      const base = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
      const { noticeHtml } = require('../lib/emailTemplates');
      sendMail({ identity: 'noreply',
        to: user.email,
        subject: 'Reset your password — Unbridled Operating Platform',
        text: `Hi ${user.name},\n\nSomeone (hopefully you) asked to reset your password.\n\nReset it here (link expires in 1 hour):\n${base}/reset-password/${token}\n\nIf you didn't request this, you can ignore this email — your password is unchanged.`,
        html: noticeHtml({ tag: 'Account', note: 'Password reset',
          title: 'Reset your password', subtitle: 'Unbridled Operating Platform',
          intro: `Hi ${user.name} — someone (hopefully you) asked to reset your password. The link below expires in 1 hour. If you didn't request this, ignore this email — your password is unchanged.`,
          button: { label: 'Reset password', url: `${base}/reset-password/${token}` },
          postmark: new Date() }),
      }).catch(err => console.error('Password reset email failed:', err.message));
    }
    res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' });
  } catch (err) { next(err); }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || String(password).length < 8) {
      return res.status(400).json({ error: 'A reset token and a password of at least 8 characters are required' });
    }
    const [r] = await sql`SELECT * FROM password_resets WHERE token = ${token} AND used_at IS NULL AND expires_at > NOW()`;
    if (!r) return res.status(400).json({ error: 'This reset link is invalid or has expired — request a new one.' });
    const hashed = await bcrypt.hash(password, 12);
    await sql`UPDATE users SET password = ${hashed}, updated_at = NOW() WHERE id = ${r.user_id}`;
    await sql`UPDATE password_resets SET used_at = NOW() WHERE id = ${r.id}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/mfa/verify', async (req, res, next) => {
  try {
    const { mfaToken, code } = req.body;
    let payload;
    try { payload = jwt.verify(mfaToken, process.env.JWT_SECRET); } catch { return res.status(401).json({ error: 'Session expired — sign in again' }); }
    if (payload.stage !== 'mfa') return res.status(401).json({ error: 'Invalid session' });
    const [user] = await sql`SELECT * FROM users WHERE id = ${payload.id}`;
    if (!user || !user.mfa_enabled) return res.status(401).json({ error: 'Invalid session' });
    const clean = String(code || '').replace(/[^a-zA-Z0-9]/g, '');
    let ok = authenticator.check(clean, user.mfa_secret);
    if (!ok && user.mfa_recovery) {
      // recovery code fallback: compare against stored hashes, burn on use
      const hashes = JSON.parse(user.mfa_recovery);
      for (let i = 0; i < hashes.length; i++) {
        if (await bcrypt.compare(clean.toUpperCase(), hashes[i])) {
          hashes.splice(i, 1);
          await sql`UPDATE users SET mfa_recovery = ${JSON.stringify(hashes)} WHERE id = ${user.id}`;
          ok = true;
          break;
        }
      }
    }
    if (!ok) return res.status(401).json({ error: 'That code didn\'t match — try the current code in your authenticator app' });
    res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role, mfa_enabled: true, mfa_required: user.mfa_required === true } });
  } catch (err) { next(err); }
});

// Begin setup: generate a secret + QR + recovery codes (not enabled until confirmed)
router.post('/mfa/setup', requireAuth, async (req, res, next) => {
  try {
    const [user] = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    if (user.mfa_enabled) return res.status(409).json({ error: 'MFA is already enabled' });
    const secret = authenticator.generateSecret();
    const recovery = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
    const hashes = await Promise.all(recovery.map(c => bcrypt.hash(c, 10)));
    await sql`UPDATE users SET mfa_secret = ${secret}, mfa_recovery = ${JSON.stringify(hashes)} WHERE id = ${user.id}`;
    const otpauth = authenticator.keyuri(user.email, 'Unbridled Media Platform', secret);
    const qr = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });
    res.json({ qr, secret, recovery });
  } catch (err) { next(err); }
});

// Confirm setup with a live code from the app
router.post('/mfa/enable', requireAuth, async (req, res, next) => {
  try {
    const [user] = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    if (!user.mfa_secret) return res.status(400).json({ error: 'Start setup first' });
    const ok = authenticator.check(String(req.body.code || '').replace(/\D/g, ''), user.mfa_secret);
    if (!ok) return res.status(401).json({ error: 'That code didn\'t match — scan the QR again and enter the current code' });
    await sql`UPDATE users SET mfa_enabled = TRUE WHERE id = ${user.id}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Turn MFA off (requires a current code)
router.post('/mfa/disable', requireAuth, async (req, res, next) => {
  try {
    const [user] = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    if (!user.mfa_enabled) return res.status(400).json({ error: 'MFA is not enabled' });
    const ok = authenticator.check(String(req.body.code || '').replace(/\D/g, ''), user.mfa_secret);
    if (!ok) return res.status(401).json({ error: 'That code didn\'t match' });
    await sql`UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, mfa_recovery = NULL WHERE id = ${user.id}`;
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
