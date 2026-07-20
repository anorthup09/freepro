const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isConfigured } = require('../lib/mailer');
const { listAutomations, automation, DEFS } = require('../lib/automations');
const { harbingerHtml, noticeHtml } = require('../lib/emailTemplates');

const admin = [requireAuth, requireRole('ADMIN')];

router.get('/automations', ...admin, async (req, res, next) => {
  try { res.json({ configured: isConfigured(), automations: await listAutomations() }); } catch (e) { next(e); }
});

router.patch('/automations/:key', ...admin, async (req, res, next) => {
  try {
    if (!DEFS.find(d => d.key === req.params.key)) return res.status(404).json({ error: 'Unknown automation' });
    const { fromAddr, toAddrs, ccAddrs } = req.body;
    await sql`
      INSERT INTO mail_automations (key, from_addr, to_addrs, cc_addrs, updated_at)
      VALUES (${req.params.key}, ${fromAddr || null}, ${toAddrs || null}, ${ccAddrs || null}, NOW())
      ON CONFLICT (key) DO UPDATE SET from_addr = ${fromAddr || null}, to_addrs = ${toAddrs || null}, cc_addrs = ${ccAddrs || null}, updated_at = NOW()`;
    res.json(await automation(req.params.key));
  } catch (e) { next(e); }
});

// Outbox — a record of every email the automations generate. While Outlook
// isn't connected, entries land as drafts; once it is, they're sent live and
// logged as sent/failed. Only drafts can be deleted.
router.get('/outbox', ...admin, async (req, res, next) => {
  try {
    const status = req.query.status;
    const valid = ['draft', 'sent', 'failed'];
    const rows = status && valid.includes(status)
      ? await sql`
          SELECT id, automation_key, identity, from_addr, to_addrs, cc_addrs, subject, status, error, sent_at, created_at
          FROM mail_outbox WHERE status = ${status} ORDER BY created_at DESC LIMIT 500`
      : await sql`
          SELECT id, automation_key, identity, from_addr, to_addrs, cc_addrs, subject, status, error, sent_at, created_at
          FROM mail_outbox ORDER BY created_at DESC LIMIT 500`;
    const [counts] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'draft')  AS draft,
        COUNT(*) FILTER (WHERE status = 'sent')   AS sent,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed
      FROM mail_outbox`;
    res.json({ entries: rows, counts });
  } catch (e) { next(e); }
});

// Full entry incl. rendered body — for the preview pane
router.get('/outbox/:id', ...admin, async (req, res, next) => {
  try {
    const [row] = await sql`SELECT * FROM mail_outbox WHERE id = ${req.params.id}`;
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (e) { next(e); }
});

// Delete a draft (only). Sent/failed history is kept.
router.delete('/outbox/:id', ...admin, async (req, res, next) => {
  try {
    const [row] = await sql`SELECT status FROM mail_outbox WHERE id = ${req.params.id}`;
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.status !== 'draft') return res.status(400).json({ error: 'Only drafts can be deleted' });
    await sql`DELETE FROM mail_outbox WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// What the email looks like — sample render per automation
router.get('/automations/:key/preview', ...admin, async (req, res, next) => {
  try {
    const key = req.params.key;
    if (key === 'harbinger') {
      const html = harbingerHtml({
        project: { code: '02.LPL16926', title: 'LPL Focus 2026 — Social Media', client: 'LPL Financial' },
        d: {
          email: 'anorthup@unbridledmedia.com', proposedCode: '02.LPL16926', projectName: 'LPL Focus 2026 — Social Media',
          sow: 'On-site shoot with multiple social video deliverables across the Focus 2026 conference.',
          clientCompany: 'LPL Financial', primaryContactName: 'Ashley Robertson', primaryContactEmail: 'arobertson@lpl.com',
          mailingAddress: '1115 Grant St, Denver, CO 80203', clientContacts: 'Bobby Remis — Events Lead',
          mediaRevenue: '36555', budgetOwner: 'Alex Northup', budgetSummary: 'Production + post across 6 social cutdowns.',
          kickoffDate: 'Jul 15, 2026', productionDates: 'Aug 4–8, 2026', finalDelivery: 'Aug 31, 2026', closeMonth: 'September 2026',
          shootingLocations: 'Denver, CO', budgetedPositions: 'DP/Cam Op, Field Producer, Audio Engineer',
          gearScope: 'Two-camera interview package + b-roll kit', preferredPm: 'Kelly Hueseman', preferredEditors: 'Joe Seebeck',
          notes: 'Client wants vertical-first deliverables.',
        },
        appUrl: 'https://freepro-production.up.railway.app',
      });
      return res.json({ kind: 'html', subject: 'HARBINGER ALERT: [02.LPL16926: LPL Focus 2026 — Social Media]', html });
    }
    // Every other automation previews with the shared branded design
    const pm = new Date();
    const samples = {
      'client-invoice': { subject: 'Invoice — 02.LPL16926 LPL Focus 2026 (Deposit)',
        html: noticeHtml({ tag: 'Invoice', note: 'Deposit', title: 'LPL Focus 2026 — Social Media', subtitle: '02.LPL16926',
          intro: 'Please find the deposit for LPL Focus 2026. A formal invoice document follows from our accounting team — reply to this email with any questions.',
          rows: [['Deposit', '$18,000.00']], postmark: pm }) },
      'invoice-request': { subject: 'Invoice Request — 02.LPL16926 LPL Focus 2026 (Deposit 2)',
        html: noticeHtml({ tag: 'Invoice Request', note: 'Deposit 2', title: 'LPL Focus 2026 — Social Media', subtitle: '02.LPL16926',
          intro: 'Alex Northup requested a client invoice — details below.',
          rows: [['Deposit #', '2'], ['Amount', '$18,000.00'], ['Send To', 'Ashley Robertson — arobertson@lpl.com'],
            ['CC', 'bremis@lpl.com'], ['Description', 'Deposit 2 — production'], ['Requested By', 'Alex Northup']],
          postmark: pm, color: '#5ABF80' }) },
      'gear-request': { subject: 'Gear Request — 02.LPL16926-01 LPL Focus 2026',
        html: noticeHtml({ tag: 'Gear Request', note: 'New gear request', title: '02.LPL16926-01 — LPL Focus 2026', subtitle: 'LPL Financial',
          rows: [['Submitted by', 'Fred Munoz'], ['Check-Out', '8/3'], ['Check-In', '8/9'], ['Media drives', '2TB × 3']],
          blocks: [['Camera gear & accessories', 'FX6 x2 + interview package'], ['Lights & peripherals', 'Aputure kit']], postmark: pm }) },
      'gear-amend': { subject: 'Gear request amended — 02.LPL16926-01',
        html: noticeHtml({ tag: 'Gear Request', note: 'Request amended', color: '#b8930f', title: '02.LPL16926-01 — LPL Focus 2026',
          intro: 'The locked gear request was amended by Fred Munoz.',
          blocks: [['Change report', 'Check out: 8/3 → 8/2\nCamera: FX6 x2 → FX6 x2 + FX3']], postmark: pm }) },
      'calendar-holds': { subject: 'HOLD — 02.LPL16926-01 LPL Focus (DP/Cam Op)',
        html: noticeHtml({ tag: 'Calendar Hold', note: 'Assignment hold', title: 'HOLD — 02.LPL16926-01 LPL Focus (DP/Cam Op)',
          intro: 'You are assigned as DP/Cam Op on LPL Focus 2026. An Outlook meeting request is attached — accept it to hold the dates.',
          rows: [['Dates', '2026-08-04 to 2026-08-08']], postmark: pm }) },
      'contract-send': { subject: 'LPL Focus 2026 — Contractor Agreement',
        html: noticeHtml({ tag: 'Contract', note: 'Contractor agreement & scope of work', title: 'LPL Focus 2026', subtitle: '02.LPL16926',
          intro: 'Hi Fred — please review and sign your contractor agreement. Open the link, review the terms, and type your name to sign.',
          rows: [['Project Code', '02.LPL16926'], ['Contractor', 'Fred Munoz'], ['Position / Services', 'DP/Cam Op'],
                 ['Travel Locations', 'Denver, CO'], ['Travel & Working Dates', 'Aug 4 through Aug 8, 2026 — $850/day × 5 days'],
                 ['Day Rate', '$850/day × 5 days = $4,250'], ['Quoted Total for Project', '$4,250'],
                 ['Travel Expense Allowance', 'Up to $600, reimbursable with receipts'],
                 ['Per Diem', 'Up to $75/day allowable expense reimbursement, with receipts'],
                 ['Send your final invoice to', 'Kelly Hueseman — khueseman@unbridledmedia.com']],
          blocks: [['Scope of Work', 'Provide DP/Cam Op services for "LPL Focus 2026" (02.LPL16926), Aug 4 through Aug 8, 2026. Rates listed cover all services and equipment described.']],
          button: { label: 'Review & sign', url: 'https://freepro-production.up.railway.app/contract/…' },
          copyLink: { label: 'Signing link', url: 'https://freepro-production.up.railway.app/contract/…' }, postmark: pm }) },
      'contract-signed': { subject: 'Contract signed — Fred Munoz (02.LPL16926)',
        html: noticeHtml({ tag: 'Contract', note: 'Contract signed', color: '#3f9d68', title: 'Fred Munoz signed ✓', subtitle: 'LPL Focus 2026 (02.LPL16926)',
          intro: 'The signed contract is on the crew grid in FreePro.',
          rows: [['Position', 'DP/Cam Op'], ['Signed as', 'Fred Munoz']], postmark: pm }) },
      'crew-question': { subject: 'New question on 02.LPL16926 — LPL Focus 2026',
        html: noticeHtml({ tag: 'Call Sheet', note: 'New crew question', title: 'LPL Focus 2026', subtitle: '02.LPL16926',
          intro: 'Hi Kelly — a new question was submitted on the Crew View:',
          blocks: [['Question', 'What time is load-in on Day 2?']],
          button: { label: 'View & answer', url: 'https://freepro-production.up.railway.app/share/…' }, postmark: pm }) },
      'pto': { subject: 'PTO Request — Fred Munoz - PTO',
        html: noticeHtml({ tag: 'Team', note: 'PTO / OOO — needs your review', title: 'Fred Munoz - PTO', subtitle: 'Fred Munoz',
          intro: 'Fred Munoz submitted a PTO/OOO request that needs your review. Approve it in Team Management on the Unbridled hub.',
          rows: [['Type', 'PTO'], ['Dates', '2026-08-12 to 2026-08-15']], postmark: pm }) },
      'avo-approval': { subject: 'Ready For Review — Show Opener V2',
        html: noticeHtml({ tag: 'AvocadoPost', note: 'Ready for review', title: 'Show Opener — V2', subtitle: '02.LPL16926',
          intro: 'V2 is ready for review from Joe Seebeck.',
          rows: [['Video', 'Show Opener'], ['Version', 'V2'], ['From', 'Joe Seebeck'], ['Lead Editor', 'Joe Seebeck']],
          copyLink: { label: 'Review link — quick copy', url: 'https://f.io/review/…' },
          button: { label: 'Open review', url: 'https://f.io/review/…' }, postmark: pm }) },
      'password-reset': { subject: 'Reset your password — Unbridled Operating Platform',
        html: noticeHtml({ tag: 'Account', note: 'Password reset', title: 'Reset your password', subtitle: 'Unbridled Operating Platform',
          intro: 'Someone (hopefully you) asked to reset your password. The link below expires in 1 hour.',
          button: { label: 'Reset password', url: 'https://freepro-production.up.railway.app/reset-password/…' }, postmark: pm }) },
    };
    const s = samples[key];
    if (!s) return res.status(404).json({ error: 'No preview available' });
    res.json({ kind: 'html', ...s });
  } catch (e) { next(e); }
});

module.exports = router;
