require('dotenv').config();
const express = require('express');
const cors = require('cors');
const migrate = require('./lib/migrate');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const crewRoutes = require('./routes/crew');
const scheduleRoutes = require('./routes/schedule');
const deliverableRoutes = require('./routes/deliverables');
const travelRoutes = require('./routes/travel');
const shareRoutes = require('./routes/share');
const utilRoutes = require('./routes/util');
const shotListRoutes = require('./routes/shotlist');

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '30mb' }));

// Serve frontend static files if present (production)
const publicDir = path.join(__dirname, '../public');
const fs = require('fs');
if (fs.existsSync(publicDir)) {
  // Assets (hashed filenames) get long cache; index.html never cached
  app.use('/assets', express.static(path.join(publicDir, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(publicDir, { index: false }));
  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date(), aerodatabox: !!process.env.AERODATABOX_API_KEY }));

// Live probe: can this server reach the weather APIs? (diagnostic, public)
app.get('/health/weather', async (req, res) => {
  const { geocode, fetchWeatherForDay } = require('./lib/weather');
  const out = { ts: new Date() };
  try { out.geocode = await geocode('St. Louis', 'MO'); } catch(e) { out.geocodeError = e.message; }
  try {
    const d = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    out.forecast = await fetchWeatherForDay(38.63, -90.2, d);
    out.forecastDate = d;
  } catch(e) { out.forecastError = e.message; }
  res.json(out);
});

app.post('/admin/seed', async (req, res) => {
  if (req.headers['x-seed-key'] !== process.env.SEED_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const seed = require('./seed');
    await seed();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/seed-crew', async (req, res) => {
  if (req.headers['x-seed-key'] !== process.env.SEED_KEY) return res.status(403).json({ error: 'Forbidden' });
  try {
    const seedCrew = require('./seedCrew');
    await seedCrew();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// CREW-role accounts are locked to Crew Views: they may authenticate and
// list crew views, but every other API surface is off limits.
const jwt = require('jsonwebtoken');
const { requireAuth: requireAuthGlobal } = require('./middleware/auth');
app.use('/api', (req, res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return next();
  try {
    const u = jwt.verify(h.slice(7), process.env.JWT_SECRET);
    if (u.role === 'PENDING' && !(req.path.startsWith('/auth') || req.path.startsWith('/share'))) {
      return res.status(403).json({ error: 'Your account is awaiting approval from an admin' });
    }
    if (u.role === 'CREW' && !(req.path.startsWith('/auth') || req.path === '/crew-views' || req.path.startsWith('/share'))) {
      return res.status(403).json({ error: 'Crew accounts can only access Crew Views' });
    }
  } catch { /* invalid tokens are rejected by route-level auth */ }
  next();
});

// Every project with its crew share token (created on demand) — the only
// project listing available to CREW-role accounts.
app.get('/api/crew-views', requireAuthGlobal, async (req, res) => {
  try {
    const sqldb = require('./lib/db');
    const projects = await sqldb`SELECT id, code, title, client, status, start_date, end_date FROM projects ORDER BY start_date`;
    const shares = await sqldb`SELECT project_id, token FROM project_shares WHERE view_type = 'crew' AND talent_name IS NULL`;
    const byProject = Object.fromEntries(shares.map(s => [s.project_id, s.token]));
    for (const p of projects) {
      if (!byProject[p.id]) {
        const [s] = await sqldb`INSERT INTO project_shares (id, project_id, token, view_type, talent_name) VALUES (gen_random_uuid()::text, ${p.id}, gen_random_uuid()::text, 'crew', NULL) RETURNING token`;
        byProject[p.id] = s.token;
      }
    }
    res.json(projects.map(p => ({ ...p, crewToken: byProject[p.id] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use('/api/share', shareRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/crew', crewRoutes);
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', projectRoutes);
app.use('/api/projects', scheduleRoutes);
app.use('/api/projects', deliverableRoutes);
app.use('/api/projects', travelRoutes);
app.use('/api/projects', shotListRoutes);
app.use('/api/projects', require('./routes/scripts'));
app.use('/api/util', utilRoutes);
app.use('/api', require('./routes/contracts'));

// Fallback: serve index.html for client-side routing (React Router)
if (fs.existsSync(publicDir)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/admin') || req.path.startsWith('/health')) return next();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

migrate()
  .then(() => app.listen(PORT, () => console.log(`FreePro API running on port ${PORT}`)))
  .catch(err => { console.error('Migration failed:', err); process.exit(1); });
