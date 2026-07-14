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
  { key: 'invoice-request', title: 'Invoice Request to Billing', identity: 'accounting', editable: true,
    defaultTo: 'billing@unbridledmedia.com',
    desc: 'Request details for accounting when + Add Invoice is submitted in the VCC — deposit #, amount, send-to, CC, description, and who asked.' },
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
    key: d.key, title: d.title, desc: d.desc, editable: d.editable,
    from: (o[d.key] && o[d.key].from_addr) || addrFor(d.identity),
    to: (o[d.key] && o[d.key].to_addrs) || d.defaultTo || null,
    cc: (o[d.key] && o[d.key].cc_addrs) || d.defaultCc || null,
    toDesc: d.toDesc || null,
  }));
}

module.exports = { automation, listAutomations, DEFS };
