const router = require('express').Router();
const https = require('https');

// Timed, IPv4-forced JSON fetch — Node's global fetch can hang indefinitely
// on some egress routes from the host (see the weather API saga).
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
    r.on('timeout', () => r.destroy(new Error('Flight data request timed out — please try again')));
    r.on('error', reject);
  });
}
const { requireAuth } = require('../middleware/auth');
const { bizToday } = require('../lib/dates');

// ─── Hotel Search (OpenStreetMap Nominatim) ───────────────────────────────────
router.get('/hotel-search', requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&extratags=1&limit=8&featuretype=settlement`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'FreePro/1.0 (video production management app)' },
    });
    const data = await r.json();

    const results = data
      .filter(p => p.type === 'hotel' || p.class === 'tourism' || p.class === 'building' || p.addresstype === 'hotel')
      .slice(0, 6)
      .map(p => {
        const a = p.address || {};
        const parts = [
          a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road,
          a.city || a.town || a.village || a.county,
          a.state,
          a.postcode,
        ].filter(Boolean);
        return {
          name: p.name || p.display_name.split(',')[0],
          address: parts.join(', '),
          phone: p.extratags?.phone || p.extratags?.['contact:phone'] || '',
          displayName: p.display_name,
        };
      });

    // If nothing matched tourism/hotel types, fall back to any result with a name
    if (results.length === 0) {
      const fallback = data.filter(p => p.name).slice(0, 6).map(p => {
        const a = p.address || {};
        const parts = [
          a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road,
          a.city || a.town || a.village || a.county,
          a.state,
          a.postcode,
        ].filter(Boolean);
        return {
          name: p.name,
          address: parts.join(', '),
          phone: p.extratags?.phone || '',
          displayName: p.display_name,
        };
      });
      return res.json(fallback);
    }

    res.json(results);
  } catch(e) { next(e); }
});

// ─── City / ZIP search (Open-Meteo geocoding) ────────────────────────────────
router.get('/geo-search', requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const { getJson } = require('../lib/weather');
    const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=8&language=en&format=json`);
    res.json((data.results || []).map(p => ({
      name: p.name,
      admin1: p.admin1 || '',
      country: p.country_code || '',
      latitude: p.latitude,
      longitude: p.longitude,
      label: [p.name, p.admin1, p.country_code === 'US' ? null : p.country_code].filter(Boolean).join(', '),
    })));
  } catch(e) { next(e); }
});

// ─── Flight Lookup (AeroDataBox via RapidAPI) ────────────────────────────────
function aeroHeaders(key) {
  return { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' };
}

// "2026-08-06 08:35-05:00" → "Aug 6, 8:35 AM"
function fmtLocalTime(localStr) {
  if (!localStr) return null;
  const [datePart, timeWithTz] = localStr.split(' ');
  if (!datePart || !timeWithTz) return null;
  const [, month, day] = datePart.split('-').map(Number);
  const timePart = timeWithTz.replace(/[+-]\d{2}:\d{2}$/, '');
  const [hour, min] = timePart.split(':').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${months[month-1]} ${day}, ${h12}:${String(min).padStart(2,'0')} ${ampm}`;
}

router.get('/flight-lookup', requireAuth, async (req, res, next) => {
  try {
    const { flight, date } = req.query;
    if (!flight) return res.status(400).json({ error: 'flight number required' });

    const key = process.env.AERODATABOX_API_KEY;
    if (!key) return res.status(503).json({ error: 'AERODATABOX_API_KEY not configured' });

    const targetDate = date || bizToday();
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flight.toUpperCase())}/${targetDate}`;
    const r = await fetchJson(url, aeroHeaders(key));

    if (r.status === 404) return res.status(404).json({ error: `Flight ${flight.toUpperCase()} not found on ${targetDate}. Try entering details manually.` });
    if (!r.ok) {
      return res.status(r.status || 502).json({ error: r.data?.message || 'AeroDataBox error' });
    }

    const data = r.data;
    const f = Array.isArray(data) ? data[0] : data;
    if (!f) return res.status(404).json({ error: `No data found for ${flight.toUpperCase()} on ${targetDate}.` });

    const departLocal = f.departure?.scheduledTime?.local || null;
    const arriveLocal = f.arrival?.scheduledTime?.local || null;

    res.json({
      flightNumber: f.number || flight.toUpperCase(),
      airline: f.airline?.name || f.airline?.iata || '',
      origin: f.departure?.airport?.iata || '',
      destination: f.arrival?.airport?.iata || '',
      departTime: f.departure?.scheduledTime?.utc || departLocal || null,
      arriveTime: f.arrival?.scheduledTime?.utc || arriveLocal || null,
      departDisplay: fmtLocalTime(departLocal),
      arriveDisplay: fmtLocalTime(arriveLocal),
      status: f.status || '',
    });
  } catch(e) { next(e); }
});

// ─── Flight Status (live refresh) ────────────────────────────────────────────
router.get('/flight-status', requireAuth, async (req, res, next) => {
  try {
    const { flight, date } = req.query;
    if (!flight) return res.status(400).json({ error: 'flight number required' });

    const key = process.env.AERODATABOX_API_KEY;
    if (!key) return res.status(503).json({ error: 'AERODATABOX_API_KEY not configured' });

    const targetDate = date || bizToday();
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flight.toUpperCase())}/${targetDate}`;
    const r = await fetchJson(url, aeroHeaders(key));
    if (!r.ok) return res.status(r.status || 502).json({ error: 'lookup failed' });

    const data = r.data;
    const f = Array.isArray(data) ? data[0] : data;
    if (!f) return res.json({ status: 'Unknown' });

    res.json({
      status: f.status || 'Unknown',
      departTime: f.departure?.actualTime?.utc || f.departure?.estimatedTime?.utc || f.departure?.scheduledTime?.utc || null,
      arriveTime: f.arrival?.actualTime?.utc || f.arrival?.estimatedTime?.utc || f.arrival?.scheduledTime?.utc || null,
    });
  } catch(e) { next(e); }
});

module.exports = router;
