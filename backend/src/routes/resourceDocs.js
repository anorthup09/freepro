const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// Editable resource docs (JSON body). Mounted under /resources so the crew/agency
// read allowance applies; writes are gated to producers/admin at the route.
// Path: /api/resources/docs/:key

router.get('/resources/docs/:key', requireAuth, async (req, res, next) => {
  try {
    const [row] = await sql`SELECT key, data, updated_at, updated_by FROM resource_docs WHERE key = ${req.params.key}`;
    res.json(row || { key: req.params.key, data: null });
  } catch (e) { next(e); }
});

router.put('/resources/docs/:key', requireAuth, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const data = req.body?.data ?? {};
    const [row] = await sql`
      INSERT INTO resource_docs (key, data, updated_at, updated_by)
      VALUES (${req.params.key}, ${sql.json(data)}, NOW(), ${req.user.name || req.user.email})
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW(), updated_by = EXCLUDED.updated_by
      RETURNING key, data, updated_at, updated_by`;
    res.json(row);
  } catch (e) { next(e); }
});

module.exports = router;
