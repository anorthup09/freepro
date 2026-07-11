const nodemailer = require('nodemailer');

// Configured via Railway env vars:
//   SMTP_HOST, SMTP_PORT (587 default), SMTP_USER, SMTP_PASS
//   MAIL_FROM (default identity, e.g. info@unbridledmedia.com)
//
// Sender identities — each automation sends from its own account. Every
// identity falls back to MAIL_FROM (then SMTP_USER) until its env var is set,
// so nothing breaks while the mailboxes/aliases are being provisioned.
// The SMTP account must be allowed to "send as" these addresses (Outlook/365:
// shared mailboxes or aliases with Send As permission).
//   MAIL_FROM_ACCOUNTING — Harbinger kickoff reports, client invoices
//   MAIL_FROM_PRODUCTION — calendar holds/cancels, contracts, crew questions
//   MAIL_FROM_GEAR       — gear request + amendment notifications
//   MAIL_FROM_TEAM       — PTO/OOO requests, approvals, FYIs
//   MAIL_FROM_POST       — AvocadoPost approval emails
//   MAIL_FROM_NOREPLY    — password resets
const IDENTITIES = {
  accounting: { env: 'MAIL_FROM_ACCOUNTING', name: 'Unbridled Accounting' },
  production: { env: 'MAIL_FROM_PRODUCTION', name: 'Unbridled Production' },
  gear:       { env: 'MAIL_FROM_GEAR',       name: 'Unbridled Gear' },
  team:       { env: 'MAIL_FROM_TEAM',       name: 'Unbridled Team' },
  post:       { env: 'MAIL_FROM_POST',       name: 'Unbridled Post' },
  noreply:    { env: 'MAIL_FROM_NOREPLY',    name: 'Unbridled Media' },
};

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function addrFor(identity) {
  const id = IDENTITIES[identity];
  return (id && process.env[id.env]) || process.env.MAIL_FROM || process.env.SMTP_USER;
}

function fromFor(identity) {
  const name = IDENTITIES[identity] ? IDENTITIES[identity].name : 'Unbridled Media';
  return `${name} <${addrFor(identity)}>`;
}

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendMail({ to, cc, subject, text, html, icalEvent, identity }) {
  if (!isConfigured()) {
    const err = new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
    err.status = 501;
    throw err;
  }
  return getTransporter().sendMail({ from: fromFor(identity), to, cc, subject, text, html, ...(icalEvent ? { icalEvent } : {}) });
}

module.exports = { sendMail, isConfigured, fromFor, addrFor };
