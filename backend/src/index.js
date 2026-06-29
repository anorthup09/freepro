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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

app.use('/api/auth', authRoutes);
app.use('/api/crew', crewRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', scheduleRoutes);
app.use('/api/projects', deliverableRoutes);
app.use('/api/projects', travelRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

migrate()
  .then(() => app.listen(PORT, () => console.log(`FreePro API running on port ${PORT}`)))
  .catch(err => { console.error('Migration failed:', err); process.exit(1); });
