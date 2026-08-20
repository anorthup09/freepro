// Automated emails for the Media Storage Management pipeline. Every send goes
// through sendMail, which logs a draft to the outbox while SMTP is unconnected
// and sends live once it is. Failures never bubble up to the triggering action.
const sql = require('./db');
const { sendMail } = require('./mailer');
const { automation } = require('./automations');
const { noticeHtml } = require('./emailTemplates');

const APP = process.env.FRONTEND_URL || 'https://freepro-production.up.railway.app';
const MS_URL = `${APP}/reports/media-storage`;

const fmt$ = n => (n === null || n === undefined || n === '') ? '' : ('$' + Number(n).toLocaleString('en-US'));
const codeName = r => [r.project_code, r.project_name].filter(Boolean).join(' - ') || r.client_name || 'Media Storage';
const dash = v => (v === null || v === undefined || String(v).trim() === '') ? '—' : v;
const ccList = r => {
  const arr = Array.isArray(r.cc) ? r.cc : (() => { try { return JSON.parse(r.cc || '[]'); } catch { return []; } })();
  return arr.map(c => c && c.email).filter(Boolean).join(', ');
};
const textFrom = (intro, rows) => intro + '\n\n' + rows.map(([l, v]) => `${l}: ${v}`).join('\n');

async function fire(key, { to, cc, subject, intro, rows, blocks = [], note, title, subtitle, color, button }) {
  const btn = button || { label: 'Open Media Storage', url: MS_URL };
  try {
    const cfg = await automation(key).catch(() => null);
    const blockText = blocks.filter(b => b && b[1]).map(([l, v]) => (l ? `${l}: ` : '') + v).join('\n\n');
    await sendMail({
      automationKey: key,
      identity: cfg?.identity,
      ...(cfg?.from ? { fromAddr: cfg.from } : {}),
      to: to || cfg?.to,
      cc: cc || undefined,
      subject,
      text: textFrom(intro, rows) + (blockText ? `\n\n${blockText}` : '') + `\n\n${btn.label}: ${btn.url}`,
      html: noticeHtml({
        tag: 'Media Storage', note, title, subtitle, intro, rows, blocks, color,
        button: btn, postmark: new Date(),
      }),
    });
  } catch (e) {
    if (e.status !== 501) console.error(`Media storage email ${key} failed:`, e.message);
  }
}

// Hard Drive request deployed to Live → invoice request + ship request.
async function hardDriveLive(r) {
  const creator = r.user_name || r.user_email || 'A team member';
  if (r.invoice_needed !== false) await fire('ms-hd-invoice', {
    cc: ccList(r) || undefined,
    subject: `Invoice Needed - ${creator} has requested an Invoice for ${dash(r.project_name || r.project_code)}`,
    note: 'Invoice Needed', title: codeName(r), subtitle: r.client_name, color: '#5ABF80',
    intro: 'Please review the details below and send out an invoice for the relevant hard drive, shipping, and labor costs ASAP.\n\nOnce the invoice is sent, please check the relevant HD Invoice Sent box in the platform (Media Storage Management).',
    rows: [
      ['Invoice Amount', fmt$(r.hard_drive_cost) ? `${fmt$(r.hard_drive_cost)} (hard drive + shipping estimate)` : '—'],
      ['Main POC Name', dash(r.poc_name)],
      ['Main POC Email', `${dash(r.poc_email)}  (confirm with AM this is the best email for the invoice)`],
      ['Relevant Project Code', dash(r.project_code)],
      ['Media / Project Name / ID', dash(r.footage || r.project_name)],
      ['Total size of media on drive', dash(r.total_media_size)],
    ],
  });
  await fire('ms-hd-ship', {
    cc: r.user_email || undefined,
    subject: `HARD DRIVE NEEDED - ${codeName(r)} - Ship ASAP`,
    note: 'Hard Drive Needed', title: codeName(r), subtitle: r.client_name, color: '#e6c229',
    intro: 'Please review the details below and coordinate a hard drive shipment to the client ASAP.\n\nOnce the hard drive is shipped, please inform the client and then check the relevant Hard Drive Sent box within the platform (Media Storage Management).',
    rows: [
      ['Main POC Name', dash(r.poc_name)],
      ['Hard Drive Shipping Address', dash([r.shipping_name, r.shipping_address].filter(Boolean).join('\n'))],
      ['Project Code', dash(r.project_code)],
      ['Media / Project Name / ID', dash(r.footage || r.project_name)],
      ['Total size of media on drive', dash(r.total_media_size)],
      ['Budget for Shipping, Drive, and Profit', dash(fmt$(r.hard_drive_cost))],
      ['Project reference link', dash(r.reference_links)],
    ],
  });
}

// Subscription deployed to Live → invoice request + move-to-cold-storage.
async function subscriptionLive(r) {
  await fire('ms-sub-invoice', {
    cc: r.user_email || undefined,
    subject: `A New Cold Storage Subscription Has Been Approved - INVOICE NEEDED - ${codeName(r)}`,
    note: 'Invoice Needed', title: codeName(r), subtitle: r.client_name, color: '#5ABF80',
    intro: 'A new cold storage subscription has been approved — reach out to confirm these details for invoicing:',
    rows: [
      ['Project Code', dash(r.project_code)],
      ['Project Name', dash(r.project_name)],
      ['Project Description', dash(r.footage)],
      ['Company', dash(r.client_name)],
      ['Main POC Name', dash(r.poc_name)],
      ['Main POC Email', `${dash(r.poc_email)}  (confirm with AM this is the best email for the invoice)`],
      ['Total Media Size', dash(r.total_media_size)],
      ['Invoice Amount for 1 Year of Subscription Service', dash(fmt$(r.subscription_cost))],
      ['Video Link(s)', dash(r.reference_links)],
    ],
  });
  await fire('ms-sub-move', {
    cc: r.user_email || undefined,
    subject: `A new COLD STORAGE subscription for ${codeName(r)} has been APPROVED!`,
    note: 'Move Media to Cold Storage', title: codeName(r), subtitle: r.client_name, color: '#4a9eff',
    intro: 'Please review the media information below and move all associated media to cold storage.\n\nDO NOT DELETE THIS MEDIA!!!',
    rows: [
      ['Subscription Start Date', dash(r.subscription_start)],
      ['Subscription End Date', dash(r.subscription_end)],
      ['Project Code', dash(r.project_code)],
      ['Company / Client', dash(r.client_name)],
      ['Project Description', dash(r.footage || r.project_name)],
      ['Main POC Name', dash(r.poc_name)],
      ['Main POC Email', dash(r.poc_email)],
      ['Video Link(s)', dash(r.reference_links)],
      ['Total Media Size', dash(r.total_media_size)],
      ['Yearly Cost for Subscription Service', dash(fmt$(r.subscription_cost))],
    ],
  });
}

// Fired when a mirror Annual Check-In task is spawned ~30 days before lapse.
async function subscriptionEnding(r) {
  const extraTo = r.user_email || '';
  const cfg = await automation('ms-sub-checkin').catch(() => null);
  const to = [cfg?.to, extraTo].filter(Boolean).join(', ');
  await fire('ms-sub-checkin', {
    to,
    subject: `SUBSCRIPTION ENDING - ${codeName(r)}`,
    note: 'Subscription Ending', title: codeName(r), subtitle: r.client_name, color: '#e05252',
    intro: `Please review the following subscription for ${codeName(r)} ending on ${dash(r.subscription_end)} and reach out to the client for cold storage renewal:`,
    rows: [
      ['Company / Client', dash(r.client_name)],
      ['Main POC Name', dash(r.poc_name)],
      ['Main POC Email', dash(r.poc_email)],
      ['Video Link(s)', dash(r.reference_links)],
      ['Total Media Size', dash(r.total_media_size)],
      ['Yearly Cost for Subscription Service', dash(fmt$(r.subscription_cost))],
    ],
  });
}

// Map a free-text media size (e.g. "4.5 TB") to the subscription + hard-drive tiers.
const SUB_PRICES = [200, 400, 600, 800, 950, 1140, 1260, 1440, 1530, 1700];
const subLabel = i => (i === 0 ? '< 1 TB' : `up to ${i + 1} TB`);
const HD = [['Up to 2 TB', 550], ['Up to 5 TB', 650], ['Up to 10 TB', 1100]];
const hdForSize = i => (i <= 1 ? 0 : i <= 4 ? 1 : 2);
function sizeToTiers(sizeStr) {
  const m = String(sizeStr || '').match(/([\d.]+)\s*(tb|gb|mb)?/i);
  let tb = 0;
  if (m) { tb = parseFloat(m[1]) || 0; const u = (m[2] || 'tb').toLowerCase(); if (u === 'gb') tb /= 1000; else if (u === 'mb') tb /= 1e6; }
  let si = tb <= 1 ? 0 : Math.min(10, Math.ceil(tb)) - 1;
  if (si < 0) si = 0;
  const hi = hdForSize(si);
  return { subTier: subLabel(si), subCost: SUB_PRICES[si], hdTier: HD[hi][0], hdCost: HD[hi][1] };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function parseCloseMonth(s) {
  if (!s) return null;
  const p = String(s).trim().toLowerCase().split(/\s+/);
  if (p.length < 2) return null;
  const mi = MONTHS.indexOf(p[0]);
  const y = parseInt(p[1], 10);
  if (mi < 0 || !y) return null;
  return new Date(y, mi, 1);
}

// A closed project reached 12 months post-close → storage follow-up.
async function postCloseCheckin(r) {
  await fire('ms-postclose-checkin', {
    subject: `12 Months Post-Close: Storage Follow-Up (${codeName(r)})`,
    note: '12 Months Post-Close', title: codeName(r), subtitle: r.client_name, color: '#a78bfa',
    intro: `The following project has lapsed 12 months of storage - ${codeName(r)}. Please inform ${dash(r.poc_name)} of storage costs and decision deadline.`,
    rows: [
      ['Original Project Code', dash(r.project_code)],
      ['Main POC Name', dash(r.poc_name)],
      ['Main POC Email', dash(r.poc_email)],
      ['Total Media Size', dash(r.total_media_size)],
      ['Yearly Cost for Subscription Service', dash(fmt$(r.subscription_cost))],
      ['One-Time Cost for Hard Drive', dash(fmt$(r.hard_drive_cost))],
      ['Project Description', dash(r.footage || r.project_name)],
      ['Video Link(s)', dash(r.reference_links)],
    ],
    button: { label: 'Annual Check-In', url: MS_URL },
  });
}

// Daily scan: closed projects crossing the 12-month post-close mark spawn a
// mirror Annual Check-In task (once) and send the storage follow-up.
async function runPostCloseScan() {
  let rows = [];
  try {
    rows = await sql`
      SELECT p.id, p.code, p.title, p.client, p.data_storage, p.status AS project_status, p.end_date,
             b.status AS budget_status, b.close_month
      FROM projects p LEFT JOIN budgets b ON b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main'
      WHERE p.parent_project_id IS NULL`;
  } catch (e) { console.error('Post-close scan query failed:', e.message); return 0; }
  const now = Date.now(), YEAR = 365 * 24 * 3600 * 1000, MONTH = 31 * 24 * 3600 * 1000;
  let made = 0;
  for (const p of rows) {
    const closed = p.budget_status === 'Closed' || (p.project_status === 'ARCHIVED' && !['Dead', 'RFP'].includes(p.budget_status || ''));
    if (!closed) continue;
    const cd = parseCloseMonth(p.close_month) || (p.end_date ? new Date(p.end_date) : null);
    if (!cd) continue;
    const age = now - cd.getTime();
    if (age < YEAR || age >= YEAR + MONTH) continue;   // fire once as it crosses 12 months
    try {
      const [ex] = await sql`SELECT id FROM media_storage_requests WHERE from_close = true AND project_code = ${p.code} LIMIT 1`;
      if (ex) continue;
      const t = sizeToTiers(p.data_storage);
      const [row] = await sql`
        INSERT INTO media_storage_requests
          (client_name, project_code, project_name, footage, total_media_size,
           subscription_tier, subscription_cost, hard_drive_tier, hard_drive_cost, status, from_close)
        VALUES (${p.client}, ${p.code}, ${p.title}, ${p.title}, ${p.data_storage || null},
           ${t.subTier}, ${t.subCost}, ${t.hdTier}, ${t.hdCost}, 'Annual Check-In', true)
        RETURNING *`;
      await postCloseCheckin(row);
      made++;
    } catch (e) { console.error('Post-close check-in failed:', e.message); }
  }
  return made;
}

// A new request was submitted → ask the team to inform the client of costs.
async function newRequest(r) {
  const creator = r.user_name || r.user_email || 'A team member';
  const cfg = await automation('ms-new-request').catch(() => null);
  const to = [cfg?.to, r.user_email].filter(Boolean).join(', ');
  const ccNames = (Array.isArray(r.cc) ? r.cc : []).map(c => c && (c.name || c.email)).filter(Boolean).join(', ') || 'none listed';
  await fire('ms-new-request', {
    to,
    subject: `NEW REQUEST: ${creator} submitted a storage/drive request for ${codeName(r)}`,
    note: 'New Storage Request', title: codeName(r), subtitle: r.client_name, color: '#4a9eff',
    intro: `Please inform ${dash(r.poc_name)} of storage costs and decision deadline.\n\n${creator} has submitted a storage email request for ${dash(r.poc_name)} at ${dash(r.client_name)}. Please include on CC: ${ccNames}`,
    rows: [
      ['Original Project Code', dash(r.project_code)],
      ['Main POC Name', dash(r.poc_name)],
      ['Main POC Email', dash(r.poc_email)],
      ['Total Media Size', dash(r.total_media_size)],
      ['Yearly Cost for Subscription Service', dash(fmt$(r.subscription_cost))],
      ['One-Time Cost for Hard Drive', dash(fmt$(r.hard_drive_cost))],
      ['Project Description', dash(r.footage)],
      ['Video Link(s)', dash(r.reference_links)],
    ],
  });
}

// Task set to Expired → tell Mason the media is ready to delete.
async function taskExpired(r) {
  await fire('ms-expired-delete', {
    cc: r.user_email || undefined,
    subject: `NEW MEDIA READY TO DELETE - ${dash(r.client_name)} has declined Archive/Storage Services`,
    note: 'Media Ready to Delete', title: codeName(r), subtitle: r.client_name, color: '#e05252',
    intro: 'Mason,\n\nThe following media is ready for deletion/offloading from our server and company hard drives.',
    rows: [
      ['Client', dash(r.client_name)],
      ['Code', dash(r.project_code)],
      ['Project Name', dash(r.project_name)],
      ['Total Media Size', dash(r.total_media_size)],
      ['Export Reference', dash(r.reference_links)],
    ],
    blocks: [['', 'Please delete with impunity.\n\nIMPORTANT: Once deleted, please mark it Completed on the UM Platform (button below).']],
    button: { label: 'UM Platform', url: MS_URL },
  });
}

// Fire the right emails when a task deploys to Live.
async function onLive(r) {
  if (r.hard_drive_added) await hardDriveLive(r);
  if (r.subscription_added) await subscriptionLive(r);
}

// Daily scan: for live subscriptions lapsing within 30 days, spawn a mirror
// Annual Check-In task in Email Requests and send the ending notice — once.
async function runCheckinScan() {
  let rows = [];
  try {
    rows = await sql`
      SELECT * FROM media_storage_requests
      WHERE subscription_added = true AND status = 'Live' AND sub_status = 'Live Subscription'
        AND checkin_created = false
        AND subscription_end IS NOT NULL AND subscription_end <> ''
        AND (subscription_end)::date <= (NOW() + INTERVAL '30 days')::date`;
  } catch (e) { console.error('Check-in scan query failed:', e.message); return 0; }
  for (const r of rows) {
    try {
      await sql`
        INSERT INTO media_storage_requests
          (created_by, user_name, user_email, client_name, project_code, project_name, poc_name, poc_email,
           footage, reference_links, total_media_size, subscription_tier, subscription_cost, cc, status,
           subscription_start, subscription_end)
        VALUES
          (${r.created_by}, ${r.user_name}, ${r.user_email}, ${r.client_name}, ${r.project_code}, ${r.project_name},
           ${r.poc_name}, ${r.poc_email}, ${r.footage}, ${r.reference_links}, ${r.total_media_size},
           ${r.subscription_tier}, ${r.subscription_cost}, ${sql.json(Array.isArray(r.cc) ? r.cc : [])}, 'Annual Check-In',
           ${r.subscription_start}, ${r.subscription_end})`;
      await sql`UPDATE media_storage_requests SET checkin_created = true WHERE id = ${r.id}`;
      await subscriptionEnding(r);
    } catch (e) { console.error('Check-in task creation failed:', e.message); }
  }
  return rows.length;
}

function scheduleCheckinScan() {
  const run = () => {
    runCheckinScan().catch(e => console.error('Check-in scan failed:', e.message));
    runPostCloseScan().catch(e => console.error('Post-close scan failed:', e.message));
  };
  setTimeout(run, 60_000);
  setInterval(run, 24 * 60 * 60 * 1000);
}

module.exports = { onLive, taskExpired, newRequest, runCheckinScan, runPostCloseScan, scheduleCheckinScan };
