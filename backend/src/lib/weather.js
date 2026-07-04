const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 5000, family: 4 }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('timeout', () => { req.destroy(new Error('weather request timed out')); });
    req.on('error', reject);
  });
}

const STATE_NAMES = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado',
  CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho',
  IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana',
  ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota',
  MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada',
  NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York',
  NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon',
  PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota',
  TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington',
  WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming', DC:'District of Columbia',
};

async function geocode(city, state) {
  // Open-Meteo geocoding matches on place name only — "City, ST, USA" returns
  // nothing. Search by city, then pick the result in the right state.
  const data = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`);
  if (!data.results?.length) throw new Error(`Could not geocode: ${city}`);
  const stateName = state ? (STATE_NAMES[state.trim().toUpperCase()] || state.trim()) : null;
  const best =
    (stateName && data.results.find(r => r.country_code === 'US' && r.admin1?.toLowerCase() === stateName.toLowerCase())) ||
    data.results.find(r => r.country_code === 'US') ||
    data.results[0];
  return { lat: best.latitude, lon: best.longitude };
}

function fmtTime(isoStr) {
  if (!isoStr) return null;
  // isoStr is like "2025-08-06T06:23" (local time from Open-Meteo)
  const t = isoStr.slice(11);
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// WMO weather condition codes → short label
function wmoLabel(code) {
  if (code == null) return null;
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly Clear';
  if (code === 2) return 'Partly Cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 49) return 'Foggy';
  if (code <= 59) return 'Drizzle';
  if (code <= 69) return 'Rain';
  if (code <= 79) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 84) return 'Snow Showers';
  if (code <= 99) return 'Thunderstorm';
  return null;
}

async function fetchWeatherForDay(lat, lon, dateStr) {
  // dateStr: "YYYY-MM-DD"
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;
  const data = await get(url);
  const d = data.daily;
  if (!d || !d.time?.length) throw new Error('No weather data returned');
  return {
    high: Math.round(d.temperature_2m_max[0]),
    low: Math.round(d.temperature_2m_min[0]),
    sunrise: fmtTime(d.sunrise[0]),
    sunset: fmtTime(d.sunset[0]),
    precip: d.precipitation_probability_max[0] ?? null,
    condition: wmoLabel(d.weathercode[0]),
  };
}

// Refresh weather for shoot days that are missing it or stale (>6h old).
// Each day can carry its own weather location (weather_lat/lon, set via the
// city search on the Schedule page); days without one fall back to the
// project city. Mutates the passed day rows in place.
async function refreshWeather(project, shootDays) {
  const sql = require('./db');
  if (!shootDays.length) return;
  const stale = shootDays.filter(d => {
    if (!d.weather_fetched_at) return true;
    const age = Date.now() - new Date(d.weather_fetched_at).getTime();
    return age > 6 * 60 * 60 * 1000;
  });
  if (!stale.length) return;
  try {
    let projCoords = null;
    const projectCoords = async () => {
      if (!projCoords && project.city) projCoords = await geocode(project.city, project.state);
      return projCoords;
    };
    await Promise.all(stale.map(async day => {
      try {
        const coords = (day.weather_lat != null && day.weather_lon != null)
          ? { lat: Number(day.weather_lat), lon: Number(day.weather_lon) }
          : await projectCoords();
        if (!coords) return;
        const { lat, lon } = coords;
        const dateStr = new Date(day.date).toISOString().slice(0, 10);
        const w = await fetchWeatherForDay(lat, lon, dateStr);
        await sql`UPDATE shoot_days SET
          weather_high=${w.high}, weather_low=${w.low},
          weather_sunrise=${w.sunrise}, weather_sunset=${w.sunset},
          weather_precip=${w.precip}, weather_condition=${w.condition},
          weather_fetched_at=NOW()
          WHERE id=${day.id}`;
        Object.assign(day, {
          weather_high: w.high, weather_low: w.low,
          weather_sunrise: w.sunrise, weather_sunset: w.sunset,
          weather_precip: w.precip, weather_condition: w.condition,
        });
      } catch(e) {
        console.error('weather fetch failed for day', day.id, e.message);
        // Record the attempt so failing days (e.g. beyond the 16-day forecast
        // window) are retried at most every 6h instead of on every page load
        await sql`UPDATE shoot_days SET weather_fetched_at=NOW() WHERE id=${day.id}`.catch(() => {});
      }
    }));
  } catch(e) { console.error('weather geocode failed:', project.city, project.state, '-', e.message); }
}

module.exports = { geocode, fetchWeatherForDay, getJson: get, refreshWeather };
