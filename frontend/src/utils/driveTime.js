// Estimated drive times between two addresses (Nominatim geocode + OSRM),
// with in-memory caches shared across calls. Same engine the share views use.
const geoCache = new Map();
const driveCache = new Map();

async function geocode(address) {
  if (geoCache.has(address)) return geoCache.get(address);
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, { headers: { 'Accept-Language': 'en' } });
    const d = await r.json();
    const result = d[0] ? { lat: parseFloat(d[0].lat), lon: parseFloat(d[0].lon) } : null;
    geoCache.set(address, result);
    return result;
  } catch { geoCache.set(address, null); return null; }
}

export async function driveTime(fromAddr, toAddr) {
  const key = `${fromAddr}||${toAddr}`;
  if (driveCache.has(key)) return driveCache.get(key);
  const [c1, c2] = await Promise.all([geocode(fromAddr), geocode(toAddr)]);
  if (!c1 || !c2) { driveCache.set(key, null); return null; }
  try {
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${c1.lon},${c1.lat};${c2.lon},${c2.lat}?overview=false`);
    const d = await r.json();
    const secs = d.routes?.[0]?.duration;
    if (!secs) { driveCache.set(key, null); return null; }
    const mins = Math.round(secs / 60);
    const label = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
    driveCache.set(key, label);
    return label;
  } catch { driveCache.set(key, null); return null; }
}
