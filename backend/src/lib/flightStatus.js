const https = require('https');
const sql = require('./db');

// Timed, IPv4-forced JSON fetch — same egress-hardening pattern as weather.js
function fetchJson(url, headers = {}, timeout = 9000) {
  return new Promise((resolve, reject) => {
    const r = https.get(url, { timeout, family: 4, headers }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { /* non-JSON body */ }
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, data: parsed });
      });
    });
    r.on('timeout', () => r.destroy(new Error('flight status request timed out')));
    r.on('error', reject);
  });
}

// Refresh live statuses for a project's flights that are near their travel
// window. Called fire-and-forget from the travel + share routes; results land
// in the DB so the next load shows them. Throttled to one API hit per flight
// per 15 minutes, and only within ±30h of departure so we don't burn
// AeroDataBox calls on flights weeks out or long landed.
async function refreshFlightStatuses(projectId) {
  const key = process.env.AERODATABOX_API_KEY;
  if (!key) return;
  const flights = await sql`
    SELECT id, flight_number, depart_time, origin FROM flights
    WHERE project_id = ${projectId}
      AND flight_number IS NOT NULL
      AND depart_time IS NOT NULL
      AND depart_time BETWEEN now() - interval '30 hours' AND now() + interval '30 hours'
      AND (status_checked_at IS NULL OR status_checked_at < now() - interval '15 minutes')
      AND lower(coalesce(status, '')) NOT IN ('arrived', 'canceled', 'cancelled')
    LIMIT 8`;
  for (const f of flights) {
    try {
      const date = new Date(f.depart_time).toISOString().slice(0, 10);
      const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(f.flight_number.toUpperCase().replace(/\s+/g, ''))}/${date}?dateLocalRole=Both`;
      const r = await fetchJson(url, { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' });
      // Multi-leg flight numbers: match the saved leg by its origin airport
      const arr = (Array.isArray(r.data) ? r.data : [r.data]).filter(Boolean);
      const d = (f.origin && arr.find(x => (x.departure?.airport?.iata || '').toUpperCase() === f.origin.toUpperCase())) || arr[0];
      const status = (r.ok && d?.status) ? d.status : null;
      await sql`UPDATE flights SET status = COALESCE(${status}, status), status_checked_at = now() WHERE id = ${f.id}`;
    } catch (e) {
      // Stamp the attempt so a dead API doesn't get hammered every page load
      await sql`UPDATE flights SET status_checked_at = now() WHERE id = ${f.id}`.catch(() => {});
    }
  }
}

module.exports = { refreshFlightStatuses };
