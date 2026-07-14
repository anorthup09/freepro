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

// ─── City / ZIP search ───────────────────────────────────────────────────────
// Google Geocoding when GOOGLE_MAPS_API_KEY is set (guarantees a mappable
// place), otherwise Open-Meteo geocoding. Both return the same shape.
router.get('/geo-search', requireAuth, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const { getJson } = require('../lib/weather');
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const g = await getJson(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q.trim())}&key=${process.env.GOOGLE_MAPS_API_KEY}`);
        const CITYISH = ['locality', 'sublocality', 'postal_town', 'administrative_area_level_3', 'neighborhood'];
        const list = (g.results || [])
          .filter(r => (r.types || []).some(t => CITYISH.includes(t)))
          .slice(0, 8)
          .map(r => {
            const comp = t => (r.address_components || []).find(c => (c.types || []).includes(t));
            const city = comp('locality') || comp('postal_town') || comp('sublocality') || comp('administrative_area_level_3');
            const state = comp('administrative_area_level_1');
            const country = comp('country');
            return {
              name: city?.long_name || r.formatted_address,
              admin1: state?.long_name || '',
              country: country?.short_name || '',
              latitude: r.geometry?.location?.lat,
              longitude: r.geometry?.location?.lng,
              label: [city?.long_name, state?.short_name || state?.long_name, country?.short_name === 'US' ? null : country?.short_name]
                .filter(Boolean).join(', ') || r.formatted_address,
            };
          })
          .filter(x => x.latitude != null);
        if (list.length) return res.json(list);
      } catch { /* fall through to Open-Meteo */ }
    }
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

// AeroDataBox BASIC allows ~1 request/second: space consecutive calls out and
// retry once on 429 so multi-call lookups (number + ICAO + board scan) survive.
const sleep = ms => new Promise(r => setTimeout(r, ms));
let lastAeroCall = 0;
async function aeroFetch(url, key) {
  const wait = lastAeroCall + 1150 - Date.now();
  if (wait > 0) await sleep(wait);
  lastAeroCall = Date.now();
  let r = await fetchJson(url, aeroHeaders(key));
  if (r.status === 429) {
    await sleep(1600);
    lastAeroCall = Date.now();
    r = await fetchJson(url, aeroHeaders(key));
  }
  return r;
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

// The ICAO form of a flight number (WN4657 → SWA4657) — AeroDataBox sometimes
// returns different/fuller leg sets per form, so lookups query both and merge.
const IATA_TO_ICAO = { WN:'SWA', AA:'AAL', UA:'UAL', DL:'DAL', B6:'JBU', AS:'ASA', NK:'NKS', F9:'FFT', HA:'HAL', G4:'AAY', SY:'SCX' };
function icaoForm(flight) {
  const m = /^([A-Z]{2})\s?(\d+)$/.exec(flight.toUpperCase().trim());
  return m && IATA_TO_ICAO[m[1]] ? `${IATA_TO_ICAO[m[1]]}${m[2]}` : null;
}

router.get('/flight-lookup', requireAuth, async (req, res, next) => {
  try {
    const { flight, date, origin } = req.query;
    if (!flight) return res.status(400).json({ error: 'flight number required' });

    const key = process.env.AERODATABOX_API_KEY;
    if (!key) return res.status(503).json({ error: 'AERODATABOX_API_KEY not configured' });

    const targetDate = date || bizToday();
    const fetchLegs = async (num) => {
      const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(num)}/${targetDate}?dateLocalRole=Both`;
      const r = await aeroFetch(url, key);
      if (!r.ok) return { r, arr: [] };
      return { r, arr: (Array.isArray(r.data) ? r.data : [r.data]).filter(Boolean) };
    };

    const primary = await fetchLegs(flight.toUpperCase().replace(/\s+/g, ''));
    let arr = primary.arr;
    // Merge legs found under the ICAO callsign form, deduped by origin + departure
    const alt = icaoForm(flight);
    if (alt) {
      try {
        const extra = await fetchLegs(alt);
        for (const f of extra.arr) {
          const kf = x => `${x.departure?.airport?.iata || ''}|${x.departure?.scheduledTime?.utc || x.departure?.scheduledTime?.local || ''}`;
          if (!arr.some(x => kf(x) === kf(f))) arr.push(f);
        }
      } catch { /* alt lookup is best-effort */ }
    }

    // Onward legs of through-flights often aren't returned by the number
    // endpoint at all. When the user supplies an origin airport and no returned
    // leg departs from it, scan that airport's departure board for the number.
    const originIata = String(origin || '').trim().toUpperCase();
    const hasOriginLeg = originIata && arr.some(x => (x.departure?.airport?.iata || '').toUpperCase() === originIata);
    let originScan = null;
    if (originIata && !hasOriginLeg) {
      originScan = { airport: originIata, boardFlights: 0, matched: 0, errors: [] };
      const wanted = new Set([flight.toUpperCase().replace(/\s+/g, ''), alt].filter(Boolean));
      const matchesNumber = n => wanted.has(String(n || '').toUpperCase().replace(/\s+/g, ''));
      for (const [from, to] of [[`${targetDate}T00:00`, `${targetDate}T11:59`], [`${targetDate}T12:00`, `${targetDate}T23:59`]]) {
        try {
          const url = `https://aerodatabox.p.rapidapi.com/flights/airports/iata/${originIata}/${from}/${to}?direction=Departure&withLeg=true&withCancelled=true&withCodeshared=true&withCargo=false&withPrivate=false`;
          const r2 = await aeroFetch(url, key);
          if (!r2.ok) { originScan.errors.push(`${r2.status}: ${r2.data?.message || 'board query failed'}`); continue; }
          const deps = r2.data?.departures || [];
          originScan.boardFlights += deps.length;
          for (const d2 of deps) {
            if (!matchesNumber(d2.number) && !(d2.codeshareStatus === 'IsOperator' && matchesNumber(d2.callSign))) continue;
            originScan.matched++;
            // FIDS shape → number-endpoint shape: movement is the counterpart
            // airport; scheduledTime is the departure at the queried airport
            arr.push({
              number: d2.number || flight.toUpperCase(),
              airline: d2.airline,
              departure: { airport: { iata: originIata }, scheduledTime: d2.movement?.scheduledTime || null },
              arrival: { airport: d2.movement?.airport || {}, scheduledTime: null },
              status: d2.status || '',
            });
          }
        } catch (e2) { originScan.errors.push(e2.message); }
      }
    }

    if (!arr.length) {
      if (primary.r.status === 404) return res.status(404).json({ error: `Flight ${flight.toUpperCase()} not found on ${targetDate}. Try entering details manually.` });
      if (!primary.r.ok) return res.status(primary.r.status || 502).json({ error: primary.r.data?.message || 'AeroDataBox error' });
      return res.status(404).json({ error: `No data found for ${flight.toUpperCase()} on ${targetDate}${originIata ? ` departing ${originIata}` : ''}.` });
    }

    const legs = arr.map(f => {
      const departLocal = f.departure?.scheduledTime?.local || null;
      const arriveLocal = f.arrival?.scheduledTime?.local || null;
      return {
        flightNumber: f.number || flight.toUpperCase(),
        airline: f.airline?.name || f.airline?.iata || '',
        origin: f.departure?.airport?.iata || '',
        originName: f.departure?.airport?.name || '',
        destination: f.arrival?.airport?.iata || '',
        destinationName: f.arrival?.airport?.name || '',
        departTime: f.departure?.scheduledTime?.utc || departLocal || null,
        arriveTime: f.arrival?.scheduledTime?.utc || arriveLocal || null,
        departTimeLocal: departLocal,
        arriveTimeLocal: arriveLocal,
        departDisplay: fmtLocalTime(departLocal),
        arriveDisplay: fmtLocalTime(arriveLocal),
        status: f.status || '',
      };
    }).sort((a, b) => String(a.departTime || a.arriveTime || '').localeCompare(String(b.departTime || b.arriveTime || '')));

    // The provider sometimes splits one leg into two partial records — a
    // departure-only half ("LAS → ?") and an arrival-only half ("? → TUL").
    // Stitch a departure-only leg to the next arrival-only one after it.
    const merged = [];
    for (let i = 0; i < legs.length; i++) {
      const a = legs[i], b = legs[i + 1];
      if (a.origin && !a.destination && b && b.destination && !b.origin
          && (!a.departTime || !b.arriveTime || String(a.departTime) < String(b.arriveTime))) {
        merged.push({
          ...a,
          destination: b.destination, destinationName: b.destinationName,
          arriveTime: b.arriveTime, arriveDisplay: b.arriveDisplay,
          status: a.status || b.status,
        });
        i++; // consume the arrival half
      } else merged.push(a);
    }

    // First leg stays at the top level for backward compatibility
    res.json({ ...merged[0], legs: merged, originScan });
  } catch(e) { next(e); }
});

// ─── Flight Status (live refresh) ────────────────────────────────────────────
router.get('/flight-status', requireAuth, async (req, res, next) => {
  try {
    const { flight, date, origin } = req.query;
    if (!flight) return res.status(400).json({ error: 'flight number required' });

    const key = process.env.AERODATABOX_API_KEY;
    if (!key) return res.status(503).json({ error: 'AERODATABOX_API_KEY not configured' });

    const targetDate = date || bizToday();
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flight.toUpperCase())}/${targetDate}?dateLocalRole=Both`;
    const r = await fetchJson(url, aeroHeaders(key));
    if (!r.ok) return res.status(r.status || 502).json({ error: 'lookup failed' });

    const data = r.data;
    // Multi-leg numbers: match the tracked leg by origin airport when provided
    const arr = (Array.isArray(data) ? data : [data]).filter(Boolean);
    const f = (origin && arr.find(x => (x.departure?.airport?.iata || '').toUpperCase() === String(origin).toUpperCase())) || arr[0];
    if (!f) return res.json({ status: 'Unknown' });

    res.json({
      status: f.status || 'Unknown',
      departTime: f.departure?.actualTime?.utc || f.departure?.estimatedTime?.utc || f.departure?.scheduledTime?.utc || null,
      arriveTime: f.arrival?.actualTime?.utc || f.arrival?.estimatedTime?.utc || f.arrival?.scheduledTime?.utc || null,
    });
  } catch(e) { next(e); }
});

module.exports = router;
