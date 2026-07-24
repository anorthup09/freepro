// Nearest-hospital lookup for shoot locations. Geocodes an address, then finds
// the closest hospital — preferring one with an emergency room. Uses Google
// (Places/Geocoding) when a key is configured, else OpenStreetMap (Nominatim +
// Overpass, trying a few mirrors). All calls are best-effort and time-bounded.
const UA = 'FreePro/1.0 (Unbridled Media production management; info@unbridledmedia.com)';
const OVERPASS_HOSTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const KEY = () => process.env.GOOGLE_MAPS_API_KEY;

function haversine(aLat, aLon, bLat, bLon) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocode(address) {
  if (!address) return null;
  if (KEY()) {
    try {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY()}`, { signal: AbortSignal.timeout(8000) });
      const loc = (await r.json())?.results?.[0]?.geometry?.location;
      if (loc) return { lat: loc.lat, lon: loc.lng };
    } catch { /* fall through to OSM */ }
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (Array.isArray(j) && j[0]) return { lat: Number(j[0].lat), lon: Number(j[0].lon) };
  } catch { /* no geocode */ }
  return null;
}

async function overpassHospitals(lat, lon) {
  const Q = `[out:json][timeout:15];(node["amenity"="hospital"](around:25000,${lat},${lon});way["amenity"="hospital"](around:25000,${lat},${lon}););out center 80;`;
  for (const host of OVERPASS_HOSTS) {
    try {
      const r = await fetch(host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA, 'Accept': 'application/json' },
        body: 'data=' + encodeURIComponent(Q),
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j.elements) && j.elements.length) return j.elements;
    } catch { /* try next mirror */ }
  }
  return [];
}

// Businesses that carry a "hospital"-ish tag but are NOT full ER hospitals — we
// skip these so the call sheet points at a real emergency department.
const NOT_ER = /cryo|cryogenic|cryotherap|clinic|urgent care|immediate care|walk-?in|veterinar|animal|pet |dental|dentist|orthodont|chiropract|physical therapy|\brehab|rehabilitation|surg(ery|ical) cent|surgical hospital|specialty (hospital|surgical|care)|long.?term acute|\bltac\b|select specialty|kindred|outpatient|ambulatory|endoscopy|infusion|sleep (center|disorder|medicine)|primary care|family (medicine|practice)|imaging|radiolog|\blabs?\b|laborator|pharmac|hospice|behavioral|psychiatr|mental health|\beye\b|vision|optical|wellness|med ?spa|fertility|ivf|plastic surg|dermatolog|urology|cardiolog|orthopedic|cancer cent|oncolog|dialysis|blood|plasma|birth(ing)? cent|nursing home|assisted living/i;
// Names that read like a real hospital / medical center with an ER.
const IS_MAJOR = /hospital|medical cent|med(ical)? cntr|regional|memorial|health (system|center|cent)|university|\bmercy\b|\bsaint\b|\bst\.? |presbyterian|methodist|baptist|kaiser/i;

// Returns { name, address } of the nearest major hospital with an ER, or null.
async function nearestHospital(address) {
  const pt = await geocode(address);
  if (!pt) return null;
  // Google Places — gather nearby hospitals, drop non-ER medical businesses,
  // then prefer the nearest that reads like a real full-service hospital. Small
  // freestanding ERs and specialty facilities have few reviews and non-hospital
  // names, so review volume + name are strong "is this a real hospital" signals.
  if (KEY()) {
    try {
      const places = async keyword => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${pt.lat},${pt.lon}&rankby=distance&type=hospital${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}&key=${KEY()}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        return (await r.json())?.results || [];
      };
      const ok = p => p?.name && (p.types || []).includes('hospital')
        && (p.business_status ? p.business_status === 'OPERATIONAL' : true) && !NOT_ER.test(p.name);
      // Merge an ER-biased search with a plain hospital search, de-dupe, and
      // sort by true distance (results are per-query distance-sorted, so a plain
      // concat wouldn't be).
      const seen = new Set();
      const cands = [...(await places('hospital emergency room')), ...(await places())]
        .filter(ok)
        .filter(p => (p.place_id && seen.has(p.place_id)) ? false : (p.place_id && seen.add(p.place_id), true))
        .map(p => ({ p, dist: p.geometry?.location ? haversine(pt.lat, pt.lon, p.geometry.location.lat, p.geometry.location.lng) : Infinity }))
        .sort((a, b) => a.dist - b.dist);
      // "Major" = hospital-like name OR the review volume of a real facility
      // (small clinics/specialty ERs have a handful of reviews, not hundreds).
      const major = x => IS_MAJOR.test(x.p.name) || (x.p.user_ratings_total || 0) >= 80;
      const pick = (cands.find(major) || cands[0])?.p;
      if (pick?.name) return { name: pick.name, address: pick.vicinity || '' };
    } catch { /* fall through to OSM */ }
  }
  // OpenStreetMap — nearest hospital with an ER, skipping non-ER businesses and
  // anything explicitly tagged as having no emergency department.
  const els = await overpassHospitals(pt.lat, pt.lon);
  const scored = els.map(e => {
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    if (la == null || !e.tags?.name || NOT_ER.test(e.tags.name) || e.tags.emergency === 'no') return null;
    return { dist: haversine(pt.lat, pt.lon, la, lo), tags: e.tags };
  }).filter(Boolean).sort((a, b) => a.dist - b.dist);
  if (!scored.length) return null;
  // Prefer a tagged ER, else a name that reads like a major hospital, else nearest.
  const best = scored.find(h => h.tags.emergency === 'yes') || scored.find(h => IS_MAJOR.test(h.tags.name)) || scored[0];
  const t = best.tags;
  const street = t['addr:housenumber'] && t['addr:street'] ? `${t['addr:housenumber']} ${t['addr:street']}` : t['addr:street'];
  const addr = [street, t['addr:city'], t['addr:state'], t['addr:postcode']].filter(Boolean).join(', ');
  return { name: t.name, address: addr };
}

// Driving distance/time from one origin to many destinations (Google only).
async function drivingDistances(origin, dests) {
  if (!KEY() || !dests.length) return dests.map(() => null);
  try {
    const destStr = dests.map(d => `${d.lat},${d.lon}`).join('|');
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lon}&destinations=${encodeURIComponent(destStr)}&units=imperial&mode=driving&key=${KEY()}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const els = (await r.json())?.rows?.[0]?.elements || [];
    return dests.map((_, i) => {
      const el = els[i];
      if (!el || el.status !== 'OK' || !el.distance) return null;
      return { miles: Math.round((el.distance.value / 1609.34) * 10) / 10, minutes: Math.round(el.duration.value / 60) };
    });
  } catch { return dests.map(() => null); }
}

// Fetch a Google Static Map (shoot pin + numbered hospital pins) server-side and
// return it as a data: URL so the API key never reaches the browser.
async function staticMapDataUrl(origin, options) {
  if (!KEY() || !origin) return null;
  try {
    const markers = [`markers=${encodeURIComponent('color:red|label:S|' + origin.lat + ',' + origin.lon)}`];
    options.forEach((o, i) => markers.push(`markers=${encodeURIComponent('color:0x2b78e4|label:' + (i + 1) + '|' + o.lat + ',' + o.lon)}`));
    const url = `https://maps.googleapis.com/maps/api/staticmap?size=620x300&scale=2&${markers.join('&')}&key=${KEY()}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:${r.headers.get('content-type') || 'image/png'};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

// Returns a short ranked list of nearby major hospitals for the picker:
// { origin:{lat,lon}, options:[{name,address,lat,lon,miles,minutes,driving}], mapDataUrl }.
async function hospitalOptions(address, limit = 3) {
  const pt = await geocode(address);
  if (!pt) return { origin: null, options: [], mapDataUrl: null };
  let candidates = [];
  if (KEY()) {
    try {
      const places = async keyword => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${pt.lat},${pt.lon}&rankby=distance&type=hospital${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}&key=${KEY()}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        return (await r.json())?.results || [];
      };
      const ok = p => p?.name && (p.types || []).includes('hospital')
        && (p.business_status ? p.business_status === 'OPERATIONAL' : true) && !NOT_ER.test(p.name);
      const seen = new Set();
      const all = [...(await places('hospital emergency room')), ...(await places())]
        .filter(ok)
        .filter(p => (p.place_id && seen.has(p.place_id)) ? false : (p.place_id && seen.add(p.place_id), true))
        .map(p => ({
          name: p.name, address: p.vicinity || '',
          lat: p.geometry?.location?.lat, lon: p.geometry?.location?.lng,
          major: IS_MAJOR.test(p.name) || (p.user_ratings_total || 0) >= 80,
        }))
        .filter(c => c.lat != null);
      all.forEach(c => { c.crow = haversine(pt.lat, pt.lon, c.lat, c.lon); });
      all.sort((a, b) => a.crow - b.crow);
      const majors = all.filter(c => c.major);
      candidates = (majors.length ? majors : all).slice(0, 6);
    } catch { candidates = []; }
  }
  if (!candidates.length) {
    // OpenStreetMap fallback (no driving distances without a key).
    const els = await overpassHospitals(pt.lat, pt.lon);
    candidates = els.map(e => {
      const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
      if (la == null || !e.tags?.name || NOT_ER.test(e.tags.name) || e.tags.emergency === 'no') return null;
      const t = e.tags;
      const street = t['addr:housenumber'] && t['addr:street'] ? `${t['addr:housenumber']} ${t['addr:street']}` : t['addr:street'];
      const addr = [street, t['addr:city'], t['addr:state'], t['addr:postcode']].filter(Boolean).join(', ');
      return { name: t.name, address: addr, lat: la, lon: lo, major: t.emergency === 'yes' || IS_MAJOR.test(t.name), crow: haversine(pt.lat, pt.lon, la, lo) };
    }).filter(Boolean).sort((a, b) => (Number(b.major) - Number(a.major)) || (a.crow - b.crow)).slice(0, 6);
  }
  const dm = await drivingDistances(pt, candidates);
  candidates.forEach((c, i) => {
    if (dm[i]) { c.miles = dm[i].miles; c.minutes = dm[i].minutes; c.driving = true; }
    else { c.miles = Math.round((c.crow / 1609.34) * 10) / 10; c.minutes = null; c.driving = false; }
  });
  candidates.sort((a, b) => a.miles - b.miles);
  const options = candidates.slice(0, limit).map(c => ({
    name: c.name, address: c.address, lat: c.lat, lon: c.lon, miles: c.miles, minutes: c.minutes, driving: !!c.driving,
  }));
  const mapDataUrl = await staticMapDataUrl(pt, options);
  return { origin: pt, options, mapDataUrl };
}

// Resolve a manually-typed hospital name to a real place near the shoot,
// auto-filling its address and driving distance. Returns a single option or null.
async function resolveHospital(address, query) {
  if (!query || !query.trim()) return null;
  const pt = await geocode(address);
  if (KEY()) {
    try {
      let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=hospital&key=${KEY()}`;
      if (pt) url += `&location=${pt.lat},${pt.lon}&radius=50000`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const p = (await r.json())?.results?.[0];
      if (p?.name && p.geometry?.location) {
        const dest = { lat: p.geometry.location.lat, lon: p.geometry.location.lng };
        let miles = pt ? Math.round(haversine(pt.lat, pt.lon, dest.lat, dest.lon) / 1609.34 * 10) / 10 : null;
        let minutes = null, driving = false;
        if (pt) {
          const dm = await drivingDistances(pt, [dest]);
          if (dm[0]) { miles = dm[0].miles; minutes = dm[0].minutes; driving = true; }
        }
        return { name: p.name, address: p.formatted_address || p.vicinity || '', lat: dest.lat, lon: dest.lon, miles, minutes, driving };
      }
    } catch { /* fall through to OSM */ }
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (Array.isArray(j) && j[0]) {
      const dest = { lat: Number(j[0].lat), lon: Number(j[0].lon) };
      const miles = pt ? Math.round(haversine(pt.lat, pt.lon, dest.lat, dest.lon) / 1609.34 * 10) / 10 : null;
      return { name: j[0].name || query.trim(), address: j[0].display_name || '', lat: dest.lat, lon: dest.lon, miles, minutes: null, driving: false };
    }
  } catch { /* none */ }
  return null;
}

module.exports = { nearestHospital, hospitalOptions, resolveHospital, geocode };
