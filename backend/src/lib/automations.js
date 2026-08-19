// Registry of email automations for the admin Automations dashboard: where
// each one sends from, who it goes to, and a sample of what it looks like.
// From/recipients can be overridden per automation (mail_automations table);
// entries with dynamic recipients describe them instead.
const sql = require('./db');
const { addrFor } = require('./mailer');

const DEFS = [
  { key: 'harbinger', title: 'Harbinger Kickoff Report', identity: 'info',
    defaultTo: 'aporio@unbridledmedia.com, khueseman@unbridledmedia.com, dsmith@unbridledmedia.com, anorthup@unbridledmedia.com',
    defaultCc: 'blamb@unbridledmedia.com, mwalsh@unbridledmedia.com',
    editable: true,
    desc: 'Full kickoff report when a Harbinger is submitted (budget RFP → Live). Submitter is CC’d automatically.' },
  { key: 'client-invoice', title: 'Client Invoice Send', identity: 'accounting', editable: 'from',
    toDesc: "Project's client contacts + Harbinger invoice CC",
    desc: 'Invoice summary when a deposit or final invoice is sent from Client Deposits.' },
  { key: 'invoice-request', title: 'Invoice Request to Billing', identity: 'accounting', editable: true, noCc: true,
    defaultTo: 'billing@unbridledmedia.com',
    desc: 'Request details for accounting when + Add Invoice is submitted in the VCC — deposit #, amount, the invoice\'s send-to and CC, description, and who asked.' },
  { key: 'gear-request', title: 'Gear Request Submitted', identity: 'gear', editable: true,
    defaultTo: 'mvitro@unbridledmedia.com',
    desc: 'The full gear request when a crew member submits one.' },
  { key: 'gear-amend', title: 'Gear Request Amended', identity: 'gear', editable: true,
    defaultTo: 'mvitro@unbridledmedia.com',
    desc: 'The change report when a locked gear request is amended.' },
  { key: 'calendar-holds', title: 'Outlook Calendar Holds & Cancels', identity: 'production', editable: 'from',
    toDesc: 'The assigned crew member / lead editor',
    desc: 'Meeting request when someone is assigned to a shoot or edit window; a cancel when unassigned.' },
  { key: 'contract-send', title: 'Contract / Deal Memo Send', identity: 'info', editable: 'from',
    toDesc: 'The contractor being hired',
    desc: 'Signing link + terms when a contract is emailed from the crew grid.' },
  { key: 'contract-signed', title: 'Contract Signed Confirmation', identity: 'production', editable: 'from',
    toDesc: "The project's Main POC",
    desc: 'Confirmation when a contractor e-signs their deal memo.' },
  { key: 'crew-question', title: 'Call Sheet Question', identity: 'production', editable: 'from',
    toDesc: "The project's Main POC",
    desc: 'Notification when crew submit a question from a shared call sheet.' },
  { key: 'pto', title: 'PTO / OOO Emails', identity: 'team', editable: 'from',
    toDesc: 'Manager (approval request), notify list (FYI), requester (approval confirmation)',
    desc: 'The full PTO request flow.' },
  { key: 'avo-approval', title: 'Edit Approved / Mentions / RFR', identity: 'post', editable: 'from',
    toDesc: 'Lead editor, mentioned teammates, or the PM (RFR)',
    desc: 'AvocadoPost notifications: approvals, @mentions, Ready-For-Review (to the PM, with the review link), and Sent confirmations (to the editor).' },
  { key: 'password-reset', title: 'Password Reset', identity: 'noreply', editable: 'from',
    toDesc: 'The account owner',
    desc: 'Single-use reset link from the login page.' },
  { key: 'event-added', title: 'Added to an Event', identity: 'team', editable: 'from',
    toDesc: 'Each newly-tagged person on the Misc. Event',
    desc: "\"You've been added to an Event!\" with the event name, dates, and location when someone is tagged on a Team → Event Pipeline event." },
  { key: 'site-photo', title: 'On-Site Photo Submitted', identity: 'production', editable: true, noCc: true,
    defaultTo: 'blamb@unbridledmedia.com',
    desc: 'The submitted photo (attached) with project code and name, client, shoot city/state, the full crew list, and the caption — sent whenever someone submits an on-site photo from the hub.' },
  { key: 'ms-hd-invoice', title: 'Media Storage — Hard Drive Invoice Needed', identity: 'accounting', editable: true,
    defaultTo: 'khueseman@unbridledmedia.com, aporio@unbridledmedia.com, billing@unbridledmedia.com',
    desc: 'When a Hard Drive request goes Live: asks billing to invoice the hard drive, shipping & labor. CCs whoever was tagged on the request.' },
  { key: 'ms-hd-ship', title: 'Media Storage — Hard Drive Ship Request', identity: 'gear', editable: true,
    defaultTo: 'mvitro@unbridledmedia.com',
    desc: 'When a Hard Drive request goes Live: asks for a drive to be shipped to the client ASAP. CCs the submitter.' },
  { key: 'ms-sub-invoice', title: 'Media Storage — Subscription Invoice Needed', identity: 'accounting', editable: true,
    defaultTo: 'aporio@unbridledmedia.com, khueseman@unbridledmedia.com, billing@unbridledmedia.com',
    desc: 'When a Subscription goes Live: asks billing to invoice a year of cold storage. CCs the submitter.' },
  { key: 'ms-sub-move', title: 'Media Storage — Move Media to Cold Storage', identity: 'post', editable: true,
    defaultTo: 'mvitro@unbridledmedia.com, dsmith@unbridledmedia.com',
    desc: 'When a Subscription goes Live: tells the team to move the media to cold storage. CCs the submitter.' },
  { key: 'ms-sub-checkin', title: 'Media Storage — Subscription Ending (Annual Check-In)', identity: 'post', editable: true,
    defaultTo: 'mvitro@unbridledmedia.com, dsmith@unbridledmedia.com',
    desc: 'Fires 30 days before a cold-storage subscription lapses (a mirror Annual Check-In task is created). Also sent to the original submitter.' },
];

async function overrides() {
  try { return Object.fromEntries((await sql`SELECT * FROM mail_automations`).map(r => [r.key, r])); }
  catch { return {}; }
}

// Effective config for one automation (senders call this at send time)
async function automation(key) {
  const def = DEFS.find(d => d.key === key);
  if (!def) return null;
  const o = (await overrides())[key] || {};
  return {
    ...def,
    from: o.from_addr || addrFor(def.identity),
    to: o.to_addrs || def.defaultTo || null,
    cc: o.cc_addrs || def.defaultCc || null,
  };
}

async function listAutomations() {
  const o = await overrides();
  return DEFS.map(d => ({
    key: d.key, title: d.title, desc: d.desc, editable: d.editable, noCc: d.noCc || false,
    from: (o[d.key] && o[d.key].from_addr) || addrFor(d.identity),
    to: (o[d.key] && o[d.key].to_addrs) || d.defaultTo || null,
    cc: (o[d.key] && o[d.key].cc_addrs) || d.defaultCc || null,
    toDesc: d.toDesc || null,
  }));
}

module.exports = { automation, listAutomations, DEFS };
