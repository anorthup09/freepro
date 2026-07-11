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

// Everything the contractor email needs, autofilled from FreePro/ProFi —
// the frontend shows it for review (all fields editable) before sending.
router.get('/projects/:id/contracts/:cid/email-prefill', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const [c] = await sql`SELECT * FROM contracts WHERE id = ${req.params.cid} AND project_id = ${req.params.id}`;
    if (!c) return res.status(404).json({ error: 'Contract not found' });
    const [proj] = await sql`
      SELECT p.*, cm.email as poc_email,
             COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as poc_name
      FROM projects p LEFT JOIN crew_members cm ON cm.id = p.poc_crew_member_id
      WHERE p.id = ${req.params.id}`;
    const locations = await sql`SELECT name, address FROM locations WHERE project_id = ${req.params.id}`;
    // Travel expense allocation: this shoot's budget travel subtotal split
    // across its budgeted labor headcount — a starting point, editable on review.
    let travelAllowance = null;
    try {
      const [sec] = await sql`SELECT id, budget_id FROM budget_sections WHERE freepro_project_id = ${req.params.id} LIMIT 1`;
      if (sec) {
        const lines = await sql`SELECT qty, unit_cost, is_travel, percent FROM budget_lines WHERE section_id = ${sec.id}`;
        const travel = lines.filter(l => l.is_travel && l.percent == null).reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);
        const heads = lines.filter(l => !l.is_travel && l.percent == null).reduce((s, l) => s + (Number(l.qty) > 0 ? Number(l.qty) : 0), 0);
        if (travel > 0 && heads > 0) travelAllowance = Math.round(travel / heads);
      }
    } catch { /* no linked budget — leave blank */ }
    const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    const laborTotal = (Number(c.day_rate) || 0) * (Number(c.labor_days) || 0);
    const gearTotal = (Number(c.gear_rate) || 0) * (Number(c.gear_days) || 0);
    res.json({
      to: c.contractor_email || '',
      contractorName: c.contractor_name || '',
      position: c.position_name || '',
      scope: c.scope || '',
      projectCode: c.project_code || proj?.code || '',
      projectTitle: c.project_title || proj?.title || '',
      datesText: `${fmtD(c.start_date)}${c.end_date && c.end_date !== c.start_date ? ` through ${fmtD(c.end_date)}` : ''}`
        + (Number(c.day_rate) ? ` — $${Number(c.day_rate).toLocaleString()}/day × ${Number(c.labor_days) || 0} day${Number(c.labor_days) === 1 ? '' : 's'}` : ''),
      dayRate: Number(c.day_rate) || 0, laborDays: Number(c.labor_days) || 0,
      gearRate: Number(c.gear_rate) || 0, gearDays: Number(c.gear_days) || 0,
      quotedTotal: laborTotal + gearTotal,
      travelLocations: locations.map(l => l.name).filter(Boolean).join(', '),
      travelAllowance,
      perDiem: 75,
      invoiceTo: proj?.poc_name ? `${proj.poc_name}${proj.poc_email ? ` — ${proj.poc_email}` : ''}` : '',
    });
  } catch (e) { next(e); }
});

// Email the contract + full SOW to the contractor (from info@unbridledmedia.com).
// The body accepts the reviewed/edited values; anything omitted falls back to
// what's on the contract.
router.post('/projects/:id/contracts/:cid/email', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { sendMail, isConfigured } = require('../lib/mailer');
    if (!isConfigured()) return res.status(501).json({ error: 'Email is not configured yet. Add SMTP_HOST, SMTP_USER, and SMTP_PASS to the server environment.' });
    const [c] = await sql`SELECT * FROM contracts WHERE id = ${req.params.cid} AND project_id = ${req.params.id}`;
    if (!c) return res.status(404).json({ error: 'Contract not found' });
    const d = req.body || {};
    const to = String(d.to || c.contractor_email || '').trim();
    if (!to) return res.status(400).json({ error: 'No email address on file for this contractor. Add one in Roster Look-Up.' });
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const link = `${base}/contract/${c.id}`;
    const first = (c.contractor_name || '').split(' ')[0];
    const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
    const laborTotal = (Number(c.day_rate) || 0) * (Number(c.labor_days) || 0);
    const gearTotal = (Number(c.gear_rate) || 0) * (Number(c.gear_days) || 0);
    const quotedTotal = d.quotedTotal !== undefined && d.quotedTotal !== '' ? Number(d.quotedTotal) : laborTotal + gearTotal;
    const datesText = d.datesText || `${c.start_date || ''}${c.end_date && c.end_date !== c.start_date ? ` through ${c.end_date}` : ''}`;
    const perDiem = d.perDiem !== undefined && d.perDiem !== '' ? Number(d.perDiem) : 75;
    const travelAllowance = d.travelAllowance !== undefined && d.travelAllowance !== '' ? Number(d.travelAllowance) : null;
    const rows = [
      ['Project Code', c.project_code],
      ['Contractor', c.contractor_name],
      ['Position / Services', c.position_name],
      ['Travel Locations', d.travelLocations || ''],
      ['Travel & Working Dates', datesText],
      ...(Number(c.day_rate) ? [['Day Rate', `${fmt$(c.day_rate)}/day × ${Number(c.labor_days) || 0} days = ${fmt$(laborTotal)}`]] : []),
      ...(gearTotal ? [['Gear', `${fmt$(c.gear_rate)}/day × ${Number(c.gear_days) || 0} days = ${fmt$(gearTotal)}`]] : []),
      ['Quoted Total for Project', fmt$(quotedTotal)],
      ...(travelAllowance != null ? [['Travel Expense Allowance', `Up to ${fmt$(travelAllowance)}, reimbursable with receipts`]] : []),
      ['Per Diem', `Up to ${fmt$(perDiem)}/day allowable expense reimbursement, with receipts`],
      ...(d.invoiceTo ? [['Send your final invoice to', d.invoiceTo]] : []),
    ];
    const scope = d.scope !== undefined ? d.scope : c.scope;
    const text = [
      `Hi ${first},`, '',
      `Please review and sign your contractor agreement for "${c.project_title}" (${c.project_code}):`, '', link, '',
      ...rows.filter(([, v]) => v).map(([l, v]) => `${l}: ${v}`),
      ...(scope ? ['', `Scope of Work:\n${scope}`] : []),
      ...(d.newVendor ? ['', 'You are a new vendor with Unbridled Media — a vendor packet will follow separately; please complete and return it before invoicing.'] : []),
      '', 'Open the link, review the terms, and type your name to sign.', '', 'Thanks!', 'Unbridled Media',
    ].join('\n');
    const { noticeHtml } = require('../lib/emailTemplates');
    const { automation } = require('../lib/automations');
    const cfg = await automation('contract-send').catch(() => null);
    await sendMail({ identity: 'info', fromAddr: cfg?.from || undefined, to,
      subject: `${c.project_title} — Contractor Agreement`, text,
      html: noticeHtml({ tag: 'Contract', note: 'Contractor agreement & scope of work',
        title: c.project_title, subtitle: c.project_code,
        intro: `Hi ${first} — please review and sign your contractor agreement. Open the link, review the terms, and type your name to sign.`
          + (d.newVendor ? ' You are a new vendor with Unbridled Media — a vendor packet will follow separately; please complete and return it before invoicing.' : ''),
        rows,
        blocks: scope ? [['Scope of Work', scope]] : [],
        button: { label: 'Review & sign', url: link },
        copyLink: { label: 'Signing link', url: link },
        postmark: new Date() }) });
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
    // Producer (project Main POC) hears about the signature (no-op until SMTP)
    if (mailReady()) {
      try {
        const [poc] = await sql`
          SELECT cm.email, COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as n,
                 p.code, p.title
          FROM projects p LEFT JOIN crew_members cm ON cm.id = p.poc_crew_member_id
          WHERE p.id = ${signed.project_id}`;
        const { noticeHtml } = require('../lib/emailTemplates');
        if (poc?.email) sendMail({ identity: 'production',
          to: poc.email,
          subject: `Contract signed — ${signed.contractor_name} (${poc.code})`,
          text: `${signed.contractor_name} signed their ${signed.position_name} deal memo for ${poc.title} (${poc.code}).\n\nSigned as: ${signed.signed_name}\nSigned at: ${new Date().toLocaleString('en-US')}\n\nThe signed contract is on the crew grid in FreePro.`,
          html: noticeHtml({ tag: 'Contract', note: 'Contract signed', color: '#3f9d68',
            title: `${signed.contractor_name} signed ✓`, subtitle: `${poc.title} (${poc.code})`,
            intro: 'The signed contract is on the crew grid in FreePro.',
            rows: [['Position', signed.position_name], ['Signed as', signed.signed_name]],
            postmark: new Date() }),
        }).catch(err => console.error('Contract-signed email failed:', err.message));
      } catch (err) { console.error('Contract-signed lookup failed:', err.message); }
    } else console.log('Contract-signed email skipped (SMTP not configured)');
    res.json(signed);
  } catch (e) { next(e); }
});

module.exports = router;
