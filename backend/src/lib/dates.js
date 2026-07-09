// All "what day is it" logic runs in the business timezone, not server UTC.
// The server runs in UTC, so after ~7pm Central toISOString() already reads
// tomorrow — Day in Review skipped a day and PTO auto-closed early.
const BIZ_TZ = process.env.BIZ_TZ || 'America/Chicago';

// YYYY-MM-DD for today (or today +/- offsetDays) in the business timezone.
const bizToday = (offsetDays = 0) =>
  new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: BIZ_TZ });

module.exports = { bizToday, BIZ_TZ };
