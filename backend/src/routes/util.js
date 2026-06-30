const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');

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

// ─── Flight Lookup (FlightAware AeroAPI) ─────────────────────────────────────
router.get('/flight-lookup', requireAuth, async (req, res, next) => {
  try {
    const { flight, date } = req.query;
    if (!flight) return res.status(400).json({ error: 'flight number required' });

    const key = process.env.FLIGHTAWARE_API_KEY;
    if (!key) return res.status(503).json({ error: 'FLIGHTAWARE_API_KEY not configured' });

    const targetDate = date || new Date().toISOString().slice(0, 10);
    const daysOut = (new Date(targetDate) - Date.now()) / 86400000;

    // Flights endpoint only supports up to 2 days in future; use schedules beyond that
    if (daysOut > 2) {
      const airlineCode = flight.match(/^[A-Za-z]+/)?.[0]?.toUpperCase() || '';
      const numericFlight = flight.replace(/^[A-Za-z]+/, '');
      const dateEnd = targetDate;
      const params = new URLSearchParams({ flight_number: numericFlight });
      if (airlineCode) params.set('airline', airlineCode);
      const url = `https://aeroapi.flightaware.com/aeroapi/schedules/${targetDate}/${dateEnd}?${params}`;
      const r = await fetch(url, { headers: { 'x-apikey': key } });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        const msg = [err.title, err.reason, err.detail].filter(Boolean).join(' — ') || 'FlightAware error';
        return res.status(r.status).json({ error: msg });
      }

      const data = await r.json();
      const keys = Object.keys(data);
      const counts = keys.map(k => `${k}:${Array.isArray(data[k]) ? data[k].length : typeof data[k]}`).join(', ');
      const f = (data.scheduled || data.flights || [])[0];
      if (!f) return res.status(404).json({ error: `Flight not found (searched airline=${airlineCode} flight=${numericFlight} date=${targetDate}). API returned: ${counts || JSON.stringify(data).slice(0,200)}` });

      return res.json({
        flightNumber: f.ident_iata || f.ident || flight.toUpperCase(),
        airline: f.operator_iata || f.operator || '',
        origin: f.origin?.code_iata || f.origin?.code || f.origin || '',
        destination: f.destination?.code_iata || f.destination?.code || f.destination || '',
        departTime: f.scheduled_out || f.departure_time?.scheduled || f.depart_time || null,
        arriveTime: f.scheduled_in || f.arrival_time?.scheduled || f.arrive_time || null,
        status: '',
      });
    }

    // Within 2 days — use live flights endpoint
    const start = new Date(targetDate + 'T00:00:00Z').toISOString();
    const end = new Date(targetDate + 'T23:59:59Z').toISOString();
    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(flight.toUpperCase())}?start=${start}&end=${end}`;
    const r = await fetch(url, { headers: { 'x-apikey': key } });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      const msg = [err.title, err.reason, err.detail].filter(Boolean).join(' — ') || 'FlightAware error';
      return res.status(r.status).json({ error: msg });
    }

    const data = await r.json();
    const f = (data.flights || [])[0];
    if (!f) return res.status(404).json({ error: 'Flight not found for that date' });

    res.json({
      flightNumber: f.ident_iata || f.ident,
      airline: f.operator || f.operator_iata || '',
      origin: f.origin?.code_iata || f.origin?.code || '',
      destination: f.destination?.code_iata || f.destination?.code || '',
      departTime: f.scheduled_out || f.estimated_out || f.actual_out || null,
      arriveTime: f.scheduled_in || f.estimated_in || f.actual_in || null,
      status: f.status || '',
    });
  } catch(e) { next(e); }
});

// ─── Flight Status (live refresh) ────────────────────────────────────────────
router.get('/flight-status', requireAuth, async (req, res, next) => {
  try {
    const { flight, date } = req.query;
    if (!flight) return res.status(400).json({ error: 'flight number required' });

    const key = process.env.FLIGHTAWARE_API_KEY;
    if (!key) return res.status(503).json({ error: 'FLIGHTAWARE_API_KEY not configured' });

    const start = date ? new Date(date + 'T00:00:00Z').toISOString() : new Date().toISOString();
    const end = date ? new Date(date + 'T23:59:59Z').toISOString() : new Date(Date.now() + 86400000).toISOString();

    const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(flight.toUpperCase())}?start=${start}&end=${end}`;
    const r = await fetch(url, { headers: { 'x-apikey': key } });
    if (!r.ok) return res.status(r.status).json({ error: 'lookup failed' });

    const data = await r.json();
    const f = (data.flights || [])[0];
    if (!f) return res.json({ status: 'Unknown' });

    res.json({
      status: f.status || 'Unknown',
      departTime: f.actual_out || f.estimated_out || f.scheduled_out || null,
      arriveTime: f.actual_in || f.estimated_in || f.scheduled_in || null,
    });
  } catch(e) { next(e); }
});

module.exports = router;
