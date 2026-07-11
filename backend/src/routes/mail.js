const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { isConfigured } = require('../lib/mailer');
const { listAutomations, automation, DEFS } = require('../lib/automations');
const { harbingerHtml } = require('../lib/emailTemplates');

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
    const samples = {
      'client-invoice': { subject: 'Invoice — 02.LPL16926 LPL Focus 2026 (Deposit)', text: 'Hello,\n\nPlease find the deposit for LPL Focus 2026 (02.LPL16926).\n\nDeposit: $18,000.00\n\nA formal invoice document follows from our accounting team. Reply to this email with any questions.\n\nThank you,\nUnbridled Media' },
      'gear-request': { subject: 'Gear request — 02.LPL16926-01 Denver', text: 'Name: Fred Munoz\nCrew: Recap Crew\nCheck out: 8/3 · Check in: 8/9\nCamera: FX6 x2\nLights: Aputure kit\nDrives: 2TB x3' },
      'gear-amend': { subject: 'Gear request amended — 02.LPL16926-01', text: 'Gear request amended by Fred Munoz.\n\nCheck out: 8/3 → 8/2\nCamera: FX6 x2 → FX6 x2 + FX3' },
      'calendar-holds': { subject: 'HOLD — 02.LPL16926-01 LPL Focus (DP/Cam Op)', text: 'You are assigned as DP/Cam Op on LPL Focus 2026.\nDates: 2026-08-04 to 2026-08-08.\nDetails in FreePro.\n\n(Outlook meeting request attached)' },
      'contract-send': { subject: 'LPL Focus 2026 — Contractor Agreement', text: 'Hi Fred,\n\nPlease review and sign your contractor agreement for "LPL Focus 2026" (02.LPL16926):\n\nhttps://…/contract/…\n\nPosition: DP/Cam Op\nLabor: $850/day x 5 days = $4,250\n\nOpen the link, review the terms, and type your name to sign.\n\nThanks!\nUnbridled Media' },
      'contract-signed': { subject: 'Contract signed — Fred Munoz (02.LPL16926)', text: 'Fred Munoz signed their DP/Cam Op deal memo for LPL Focus 2026 (02.LPL16926).\n\nThe signed contract is on the crew grid in FreePro.' },
      'crew-question': { subject: 'New question on 02.LPL16926 — LPL Focus 2026', text: 'A new question was submitted on the Crew View:\n\n“What time is load-in on Day 2?”\n\nView & answer from the producer call sheet.' },
      'pto': { subject: 'PTO Request — Fred Munoz - PTO', text: 'Fred Munoz submitted a PTO/OOO request that needs your review.\n\nType: PTO\nDates: 2026-08-12 to 2026-08-15\n\nApprove it in Team Management on the Unbridled hub.' },
      'avo-approval': { subject: 'Approved ✓ — Show Opener (02.LPL16926)', text: 'Hi Joe,\n\n"Show Opener" (02.LPL16926) was marked Approved by anorthup@unbridledmedia.com.\n\nNice work — details are in AvocadoPost.' },
      'password-reset': { subject: 'Reset your password', text: 'Click to reset your password (link valid for 1 hour):\n\nhttps://…/reset-password/…' },
    };
    const s = samples[key];
    if (!s) return res.status(404).json({ error: 'No preview available' });
    res.json({ kind: 'text', ...s });
  } catch (e) { next(e); }
});

module.exports = router;
