const { sendMail, isConfigured } = require('./mailer');

const esc = v => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const dstamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateOnly = d => String(d).slice(0, 10).replace(/-/g, '');

// All-day Outlook-compatible calendar invite (METHOD:REQUEST). DTEND is
// exclusive per RFC 5545, so we add a day to the end date.
function buildInvite({ uid, sequence = 0, startDate, endDate, summary, description, location, organizerEmail, attendeeEmail, attendeeName }) {
  const end = new Date(String(endDate || startDate).slice(0, 10) + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  return [
    'BEGIN:VCALENDAR',
    'PRODID:-//Unbridled Media//FreePro//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}@freepro.unbridledmedia.com`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${dstamp(new Date())}`,
    `DTSTART;VALUE=DATE:${dateOnly(startDate)}`,
    `DTEND;VALUE=DATE:${dateOnly(end.toISOString())}`,
    `SUMMARY:${esc(summary)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    location ? `LOCATION:${esc(location)}` : null,
    organizerEmail ? `ORGANIZER;CN=Unbridled Media:mailto:${organizerEmail}` : null,
    `ATTENDEE;CN=${esc(attendeeName || attendeeEmail)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendeeEmail}`,
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'BEGIN:VALARM',
    'TRIGGER:-PT12H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Shoot reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

// Email a calendar hold; no-ops (with a log) when SMTP isn't configured.
async function sendCalendarHold(opts) {
  if (!isConfigured()) {
    console.log(`Calendar hold skipped (SMTP not configured): ${opts.summary} → ${opts.attendeeEmail}`);
    return false;
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const content = buildInvite({ ...opts, organizerEmail: from });
  await sendMail({
    to: opts.attendeeEmail,
    subject: opts.summary,
    text: opts.description || opts.summary,
    icalEvent: { method: 'REQUEST', content },
  });
  return true;
}

// Cancel a previously sent hold (METHOD:CANCEL with a bumped sequence)
async function sendCalendarCancel({ uid, sequence = 1, startDate, endDate, summary, attendeeEmail, attendeeName }) {
  if (!isConfigured()) {
    console.log(`Calendar cancel skipped (SMTP not configured): ${summary} → ${attendeeEmail}`);
    return false;
  }
  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  const end = new Date(String(endDate || startDate).slice(0, 10) + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + 1);
  const content = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Unbridled Media//FreePro//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:${uid}@freepro.unbridledmedia.com`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${dstamp(new Date())}`,
    `DTSTART;VALUE=DATE:${dateOnly(startDate)}`,
    `DTEND;VALUE=DATE:${dateOnly(end.toISOString())}`,
    `SUMMARY:${esc('CANCELLED — ' + summary)}`,
    `ORGANIZER;CN=Unbridled Media:mailto:${from}`,
    `ATTENDEE;CN=${esc(attendeeName || attendeeEmail)}:mailto:${attendeeEmail}`,
    'STATUS:CANCELLED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  await sendMail({
    to: attendeeEmail,
    subject: `Cancelled: ${summary}`,
    text: `This hold was cancelled: ${summary}`,
    icalEvent: { method: 'CANCEL', content },
  });
  return true;
}

module.exports = { buildInvite, sendCalendarHold, sendCalendarCancel };
