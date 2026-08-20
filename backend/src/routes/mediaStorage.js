const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { onLive, taskExpired, newRequest } = require('../lib/mediaStorageEmails');

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

    const cc = Array.isArray(b.cc) ? b.cc : [];
    const [row] = await sql`
      INSERT INTO media_storage_requests
        (created_by, user_name, user_email, client_name, project_code, project_name,
         poc_name, poc_email, footage, reference_links, total_media_size,
         subscription_tier, subscription_cost, hard_drive_tier, hard_drive_cost, cc, status)
      VALUES
        (${req.user?.id || null}, ${req.user?.name || null}, ${req.user?.email || null},
         ${clientName}, ${String(b.projectCode || '').trim() || null}, ${String(b.projectName || '').trim() || null},
         ${String(b.pocName || '').trim() || null}, ${String(b.pocEmail || '').trim() || null},
         ${String(b.footage || '').trim() || null}, ${String(b.referenceLinks || '').trim() || null},
         ${String(b.totalMediaSize || '').trim() || null},
         ${b.subscriptionTier || null}, ${num(b.subscriptionCost)},
         ${b.hardDriveTier || null}, ${num(b.hardDriveCost)}, ${sql.json(cc)}, 'New Request')
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

    // Notify the team a new storage request came in (draft until SMTP live).
    if (row) newRequest(row).catch(e2 => console.error('Media storage newRequest email failed:', e2.message));

    res.status(201).json(row);
  } catch (e) { next(e); }
});

// Update a request's pipeline/workflow fields.
const STATUSES = ['New Request', 'In-Progress', 'Annual Check-In', 'Live', 'Expired'];
router.patch('/:id', ...staff, async (req, res, next) => {
  try {
    const d = req.body || {};
    const [cur] = await sql`SELECT * FROM media_storage_requests WHERE id = ${req.params.id}`;
    if (!cur) return res.status(404).json({ error: 'Request not found' });

    // Email Sent auto-stamps the date the moment it's checked (never a hard entry).
    let emailSent = cur.email_sent, emailSentDate = cur.email_sent_date;
    if (d.emailSent !== undefined) {
      emailSent = !!d.emailSent;
      emailSentDate = emailSent ? (cur.email_sent_date || new Date().toISOString()) : null;
    }
    const status = d.status !== undefined && STATUSES.includes(d.status) ? d.status : cur.status;
    // A hard-drive task can't go Live until its shipping info is completed.
    if (status === 'Live' && cur.status !== 'Live' && cur.hard_drive_added) {
      const name = d.shippingName !== undefined ? d.shippingName : cur.shipping_name;
      const addr = d.shippingAddress !== undefined ? d.shippingAddress : cur.shipping_address;
      if (!String(name || '').trim() || !String(addr || '').trim()) {
        return res.status(400).json({ error: 'Add shipping information (name and address) before moving this hard-drive request to Live.' });
      }
    }
    // A subscription can't go Live until start/end dates and a sent invoice exist.
    if (d.subStatus === 'Live Subscription' && cur.sub_status !== 'Live Subscription') {
      const start = d.subscriptionStart !== undefined ? d.subscriptionStart : cur.subscription_start;
      const end = d.subscriptionEnd !== undefined ? d.subscriptionEnd : cur.subscription_end;
      const inv = d.subscriptionInvoiceSent !== undefined ? d.subscriptionInvoiceSent : cur.subscription_invoice_sent;
      if (!String(start || '').trim() || !String(end || '').trim() || !inv) {
        return res.status(400).json({ error: 'Enter the Subscription Start and End dates and send the invoice before moving to Live.' });
      }
    }
    // Stamp the deployment date the first time a task goes Live.
    const goingLive = status === 'Live' && cur.status !== 'Live';
    const goingExpired = status === 'Expired' && cur.status !== 'Expired';
    const liveDate = status === 'Live' ? (cur.live_date || new Date().toISOString()) : cur.live_date;

    // Subscription start/end: on deployment to Live, auto-fill start = today and
    // end = exactly one year later (unless already set / provided).
    let subStart = d.subscriptionStart !== undefined ? (d.subscriptionStart || null) : cur.subscription_start;
    let subEnd = d.subscriptionEnd !== undefined ? (d.subscriptionEnd || null) : cur.subscription_end;
    if (goingLive && cur.subscription_added && !String(subStart || '').trim()) {
      const iso = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const now = new Date();
      const end = new Date(now); end.setFullYear(end.getFullYear() + 1);
      subStart = iso(now);
      subEnd = iso(end);
    }

    // Client Response auto-stamps the date it was first logged.
    let clientResponse = cur.client_response, clientResponseDate = cur.client_response_date;
    if (d.clientResponse !== undefined) {
      clientResponse = String(d.clientResponse).trim() || null;
      clientResponseDate = clientResponse ? (cur.client_response_date || new Date().toISOString()) : null;
    }

    const [row] = await sql`
      UPDATE media_storage_requests SET
        status = ${status},
        live_date = ${liveDate},
        email_sent = ${emailSent},
        email_sent_date = ${emailSentDate},
        client_response = ${clientResponse},
        client_response_date = ${clientResponseDate},
        shipping_name = ${d.shippingName !== undefined ? (String(d.shippingName).trim() || null) : cur.shipping_name},
        shipping_email = ${d.shippingEmail !== undefined ? (String(d.shippingEmail).trim() || null) : cur.shipping_email},
        shipping_address = ${d.shippingAddress !== undefined ? (String(d.shippingAddress).trim() || null) : cur.shipping_address},
        shipping_tracking = ${d.shippingTracking !== undefined ? (String(d.shippingTracking).trim() || null) : cur.shipping_tracking},
        total_media_size = ${d.totalMediaSize !== undefined ? (String(d.totalMediaSize).trim() || null) : cur.total_media_size},
        subscription_tier = ${d.subscriptionTier !== undefined ? (d.subscriptionTier || null) : cur.subscription_tier},
        subscription_cost = ${d.subscriptionCost !== undefined ? (d.subscriptionCost === '' || d.subscriptionCost == null ? null : Number(d.subscriptionCost)) : cur.subscription_cost},
        hard_drive_tier = ${d.hardDriveTier !== undefined ? (d.hardDriveTier || null) : cur.hard_drive_tier},
        hard_drive_cost = ${d.hardDriveCost !== undefined ? (d.hardDriveCost === '' || d.hardDriveCost == null ? null : Number(d.hardDriveCost)) : cur.hard_drive_cost},
        subscription_added = ${d.subscriptionAdded !== undefined ? !!d.subscriptionAdded : cur.subscription_added},
        hard_drive_added = ${d.hardDriveAdded !== undefined ? !!d.hardDriveAdded : cur.hard_drive_added},
        hard_drive_sent = ${d.hardDriveSent !== undefined ? !!d.hardDriveSent : cur.hard_drive_sent},
        hard_drive_invoice_sent = ${d.hardDriveInvoiceSent !== undefined ? !!d.hardDriveInvoiceSent : cur.hard_drive_invoice_sent},
        drive_status = ${d.driveStatus !== undefined && ['New Request', 'Sent'].includes(d.driveStatus) ? d.driveStatus : cur.drive_status},
        files_deleted = ${d.filesDeleted !== undefined ? !!d.filesDeleted : cur.files_deleted},
        subscription_invoice_sent = ${d.subscriptionInvoiceSent !== undefined ? !!d.subscriptionInvoiceSent : cur.subscription_invoice_sent},
        subscription_start = ${subStart},
        subscription_end = ${subEnd},
        sub_status = ${d.subStatus !== undefined && ['New Subscription', 'Live Subscription'].includes(d.subStatus) ? d.subStatus : cur.sub_status}
      WHERE id = ${req.params.id} RETURNING *`;
    // Deploying to Live fires the relevant Media Storage automations (drafts
    // until SMTP is connected). Never let a mail hiccup fail the update.
    if (goingLive && row) { onLive(row).catch(e => console.error('Media storage onLive email failed:', e.message)); }
    if (goingExpired && row) { taskExpired(row).catch(e => console.error('Media storage taskExpired email failed:', e.message)); }
    res.json(row);
  } catch (e) { next(e); }
});

module.exports = router;
