const https = require('https');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function geocode(city, state) {
  const q = encodeURIComponent(`${city}, ${state}, USA`);
  const data = await get(`https://geocoding-api.open-meteo.com/v1/search?name=${q}&count=1&language=en&format=json`);
  if (!data.results?.length) throw new Error(`Could not geocode: ${city}, ${state}`);
  return { lat: data.results[0].latitude, lon: data.results[0].longitude };
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

module.exports = { geocode, fetchWeatherForDay };
