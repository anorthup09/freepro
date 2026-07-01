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

const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve frontend static files if present (production)
const publicDir = path.join(__dirname, '../../public');
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

app.use('/share', shareRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/crew', crewRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', scheduleRoutes);
app.use('/api/projects', deliverableRoutes);
app.use('/api/projects', travelRoutes);
app.use('/api/util', utilRoutes);

// Fallback: serve index.html for client-side routing (React Router)
if (fs.existsSync(publicDir)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/share') || req.path.startsWith('/admin') || req.path.startsWith('/health')) return next();
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
