const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const staff = [requireAuth, requireRole('ADMIN', 'PRODUCER')];

// ── Client resources: logos & brand guidelines, keyed by client name ──

router.get('/:client/resources', ...staff, async (req, res, next) => {
  try {
    res.json(await sql`
      SELECT id, client, kind, filename, mime, size, note, uploaded_by, created_at
      FROM client_resources WHERE LOWER(client) = LOWER(${req.params.client})
      ORDER BY kind, created_at DESC`);
  } catch (e) { next(e); }
});

router.post('/:client/resources', ...staff, async (req, res, next) => {
  try {
    const { filename, mime, fileBase64, kind, note } = req.body;
    if (!filename || !fileBase64) return res.status(400).json({ error: 'filename and file required' });
    const buf = Buffer.from(fileBase64, 'base64');
    if (buf.length > 25 * 1024 * 1024) return res.status(400).json({ error: 'File too large (25MB max)' });
    const [row] = await sql`
      INSERT INTO client_resources (client, kind, filename, mime, size, data, note, uploaded_by)
      VALUES (${req.params.client}, ${kind || 'other'}, ${filename}, ${mime || null}, ${buf.length}, ${buf}, ${note || null}, ${req.user.name || req.user.email})
      RETURNING id, client, kind, filename, mime, size, note, uploaded_by, created_at`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get('/resources/:id/file', ...staff, async (req, res, next) => {
  try {
    const [f] = await sql`SELECT filename, mime, data FROM client_resources WHERE id = ${req.params.id}`;
    if (!f) return res.status(404).json({ error: 'Resource not found' });
    res.setHeader('Content-Type', f.mime || 'application/octet-stream');
    const disp = req.query.inline ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disp}; filename="${f.filename.replace(/"/g, '')}"`);
    res.send(f.data);
  } catch (e) { next(e); }
});

router.delete('/resources/:id', ...staff, async (req, res, next) => {
  try {
    await sql`DELETE FROM client_resources WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
