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

// Businesses that carry a "hospital"-ish tag but are NOT ER hospitals — we skip
// these so the call sheet points at a real emergency department.
const NOT_ER = /cryo|cryogenic|cryotherap|clinic|urgent care|immediate care|walk-?in|veterinar|animal|pet |dental|dentist|orthodont|chiropract|physical therapy|\brehab|rehabilitation|surg(ery|ical) cent|outpatient|ambulatory|imaging|radiolog|\blabs?\b|laborator|pharmac|hospice|behavioral|psychiatr|mental health|\beye\b|vision|optical|wellness|med ?spa|fertility|ivf|plastic surg|dermatolog|urology|cardiolog|orthopedic|cancer cent|oncolog|dialysis|blood|plasma|birth(ing)? cent|nursing home|assisted living/i;
// Names that read like a real hospital / medical center with an ER.
const IS_MAJOR = /hospital|medical cent|med(ical)? cntr|regional|memorial|health (system|center|cent)|university|\bmercy\b|\bsaint\b|\bst\.? |presbyterian|methodist|baptist|kaiser/i;

// Returns { name, address } of the nearest major hospital with an ER, or null.
async function nearestHospital(address) {
  const pt = await geocode(address);
  if (!pt) return null;
  // Google Places — bias to actual emergency rooms, then filter out non-ER
  // medical businesses (cryogenics offices, clinics, urgent care, etc.).
  if (KEY()) {
    try {
      const places = async keyword => {
        const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${pt.lat},${pt.lon}&rankby=distance&type=hospital${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ''}&key=${KEY()}`;
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        return (await r.json())?.results || [];
      };
      const ok = p => p?.name && (p.types || []).includes('hospital')
        && (p.business_status ? p.business_status === 'OPERATIONAL' : true) && !NOT_ER.test(p.name);
      // 1) nearest ER-branded hospital · 2) nearest "major" hospital · 3) nearest hospital
      const byEr = (await places('emergency room')).filter(ok);
      const byPlain = (await places()).filter(ok);
      const pick = byEr[0] || byPlain.find(p => IS_MAJOR.test(p.name)) || byPlain[0] || byEr[0];
      if (pick?.name) return { name: pick.name, address: pick.vicinity || '' };
    } catch { /* fall through to OSM */ }
  }
  // OpenStreetMap — nearest hospital with an ER, skipping non-ER businesses.
  const els = await overpassHospitals(pt.lat, pt.lon);
  const scored = els.map(e => {
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    if (la == null || !e.tags?.name || NOT_ER.test(e.tags.name)) return null;
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

module.exports = { nearestHospital, geocode };
