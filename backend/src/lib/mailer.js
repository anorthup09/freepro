const nodemailer = require('nodemailer');

// Configured via Railway env vars:
//   SMTP_HOST, SMTP_PORT (587 default), SMTP_USER, SMTP_PASS
//   MAIL_FROM (defaults to SMTP_USER, e.g. info@unbridledmedia.com)
function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
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

async function sendMail({ to, subject, text, html }) {
  if (!isConfigured()) {
    const err = new Error('Email is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.');
    err.status = 501;
    throw err;
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  return getTransporter().sendMail({ from: `Unbridled Media <${from}>`, to, subject, text, html });
}

module.exports = { sendMail, isConfigured };
