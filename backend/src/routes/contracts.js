const express = require('express');
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Create (or regenerate) a contract for a crew assignment, snapshotting current terms
router.post('/projects/:id/crew/:aid/contract', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const [a] = await sql`
      SELECT ca.*, p.name as position_name, cm.name as cm_name, cm.email as cm_email,
             cm.preferred_first_name, cm.preferred_last_name,
             pr.title as project_title, pr.code as project_code, pr.start_date as pr_start, pr.end_date as pr_end
      FROM crew_assignments ca
      JOIN positions p ON p.id = ca.position_id
      JOIN projects pr ON pr.id = ca.project_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
      WHERE ca.id = ${req.params.aid} AND ca.project_id = ${req.params.id}`;
    if (!a) return res.status(404).json({ error: 'Assignment not found' });
    if (!a.crew_member_id) return res.status(400).json({ error: 'Assign a crew member first' });
    // Drop any previous unsigned contract for this assignment (signed ones are kept for history)
    await sql`DELETE FROM contracts WHERE crew_assignment_id = ${a.id} AND signed_at IS NULL`;
    const name = [a.preferred_first_name, a.preferred_last_name].filter(Boolean).join(' ') || a.cm_name;
    const [c] = await sql`
      INSERT INTO contracts (project_id, crew_assignment_id, contractor_name, contractor_email, position_name,
        project_title, project_code, start_date, end_date, day_rate, labor_days, gear_rate, gear_days, scope)
      VALUES (${req.params.id}, ${a.id}, ${name}, ${a.cm_email || null}, ${a.position_name},
        ${a.project_title}, ${a.project_code}, ${a.start_date || (a.pr_start ? new Date(a.pr_start).toISOString().slice(0,10) : null)},
        ${a.end_date || (a.pr_end ? new Date(a.pr_end).toISOString().slice(0,10) : null)},
        ${a.day_rate}, ${a.labor_days}, ${a.gear_cost}, ${a.gear_days}, ${req.body.scope || null})
      RETURNING *`;
    res.status(201).json(c);
  } catch (e) { next(e); }
});

// List contracts for a project (backend status pills)
router.get('/projects/:id/contracts', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT * FROM contracts WHERE project_id = ${req.params.id} ORDER BY created_at DESC`;
    res.json(rows);
  } catch (e) { next(e); }
});

// Email a contract link to the contractor from the configured mailbox
router.post('/projects/:id/contracts/:cid/email', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { sendMail, isConfigured } = require('../lib/mailer');
    if (!isConfigured()) return res.status(501).json({ error: 'Email is not configured yet. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to the server environment.' });
    const [c] = await sql`SELECT * FROM contracts WHERE id = ${req.params.cid} AND project_id = ${req.params.id}`;
    if (!c) return res.status(404).json({ error: 'Contract not found' });
    const to = String(req.body.to || c.contractor_email || '').trim();
    if (!to) return res.status(400).json({ error: 'No email address on file for this contractor. Add one in Roster Look-Up.' });
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const link = `${base}/contract/${c.id}`;
    const first = (c.contractor_name || '').split(' ')[0];
    const laborTotal = (Number(c.day_rate)||0) * (Number(c.labor_days)||0);
    const gearTotal = (Number(c.gear_rate)||0) * (Number(c.gear_days)||0);
    const fmt$ = n => '$' + Number(n||0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const text = `Hi ${first},\n\nPlease review and sign your contractor agreement for "${c.project_title}" (${c.project_code}):\n\n${link}\n\nPosition: ${c.position_name}\nLabor: ${fmt$(c.day_rate)}/day x ${Number(c.labor_days)||0} days = ${fmt$(laborTotal)}${gearTotal ? `\nGear: ${fmt$(c.gear_rate)}/day x ${Number(c.gear_days)||0} days = ${fmt$(gearTotal)}` : ''}\nTotal: ${fmt$(laborTotal + gearTotal)}\n\nOpen the link, review the terms, and type your name to sign.\n\nThanks!\nUnbridled Media`;
    await sendMail({ to, subject: `${c.project_title} — Contractor Agreement`, text });
    await sql`UPDATE contracts SET status = 'SENT' WHERE id = ${c.id}`;
    res.json({ ok: true, to });
  } catch (e) {
    if (e.status === 501) return res.status(501).json({ error: e.message });
    next(e);
  }
});

// Public: view a contract by token
router.get('/contract/:token', async (req, res, next) => {
  try {
    const [c] = await sql`SELECT * FROM contracts WHERE id = ${req.params.token}`;
    if (!c) return res.status(404).json({ error: 'Contract not found' });
    res.json(c);
  } catch (e) { next(e); }
});

// Public: sign a contract
router.post('/contract/:token/sign', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Please type your full name to sign' });
    const [c] = await sql`SELECT * FROM contracts WHERE id = ${req.params.token}`;
    if (!c) return res.status(404).json({ error: 'Contract not found' });
    if (c.signed_at) return res.status(409).json({ error: 'This contract has already been signed' });
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const [signed] = await sql`
      UPDATE contracts SET status = 'SIGNED', signed_name = ${name}, signed_at = NOW(), signed_ip = ${ip}
      WHERE id = ${req.params.token}
      RETURNING *`;
    res.json(signed);
  } catch (e) { next(e); }
});

module.exports = router;
