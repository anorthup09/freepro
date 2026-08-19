const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const staff = [requireAuth, requireRole('ADMIN', 'PRODUCER', 'FINANCE')];

// List every media storage request, newest first.
router.get('/', ...staff, async (req, res, next) => {
  try {
    res.json(await sql`SELECT * FROM media_storage_requests ORDER BY created_at DESC`);
  } catch (e) { next(e); }
});

// Create a new media storage request.
router.post('/', ...staff, async (req, res, next) => {
  try {
    const b = req.body || {};
    const num = v => (v === '' || v === null || v === undefined ? null : Number(v));
    const clientName = String(b.clientName || '').trim();
    if (!clientName) return res.status(400).json({ error: 'Client name is required' });

    const [row] = await sql`
      INSERT INTO media_storage_requests
        (created_by, user_name, user_email, client_name, project_code, project_name,
         poc_name, poc_email, footage, reference_links, total_media_size,
         subscription_tier, subscription_cost, hard_drive_tier, hard_drive_cost)
      VALUES
        (${req.user?.id || null}, ${req.user?.name || null}, ${req.user?.email || null},
         ${clientName}, ${String(b.projectCode || '').trim() || null}, ${String(b.projectName || '').trim() || null},
         ${String(b.pocName || '').trim() || null}, ${String(b.pocEmail || '').trim() || null},
         ${String(b.footage || '').trim() || null}, ${String(b.referenceLinks || '').trim() || null},
         ${String(b.totalMediaSize || '').trim() || null},
         ${b.subscriptionTier || null}, ${num(b.subscriptionCost)},
         ${b.hardDriveTier || null}, ${num(b.hardDriveCost)})
      RETURNING *`;

    // Grow the ongoing name/email database so this POC autofills next time.
    const pocEmail = String(b.pocEmail || '').trim();
    const pocName = String(b.pocName || '').trim() || null;
    if (pocEmail && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pocEmail)) {
      await sql`
        INSERT INTO invoice_contacts (name, email, added_by)
        VALUES (${pocName}, ${pocEmail}, ${req.user?.name || req.user?.email || null})
        ON CONFLICT (LOWER(email)) DO UPDATE SET name = COALESCE(EXCLUDED.name, invoice_contacts.name)
      `.catch(e2 => console.error('POC contact upsert failed:', e2.message));
    }

    res.status(201).json(row);
  } catch (e) { next(e); }
});

module.exports = router;
