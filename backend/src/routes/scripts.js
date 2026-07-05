const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ─── Scripts (uploaded Word/PDF docs, viewable on share pages) ───────────────

router.get('/:id/scripts', requireAuth, async (req, res, next) => {
  try {
    res.json(await sql`
      SELECT id, name, file_name, mime, created_at, (data IS NOT NULL) as has_file
      FROM scripts WHERE project_id = ${req.params.id} ORDER BY lower(name)`);
  } catch(e) { next(e); }
});

router.post('/:id/scripts', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, fileName, mime, dataBase64 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Script name required' });
    const buf = dataBase64 ? Buffer.from(dataBase64, 'base64') : null;
    const [s] = await sql`
      INSERT INTO scripts (id, project_id, name, file_name, mime, data)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${name.trim()}, ${fileName||null}, ${mime||null}, ${buf})
      RETURNING id, name, file_name, mime, created_at, (data IS NOT NULL) as has_file`;
    res.status(201).json(s);
  } catch(e) { next(e); }
});

router.patch('/:id/scripts/:sid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const { name, fileName, mime, dataBase64 } = req.body;
    const buf = dataBase64 !== undefined ? (dataBase64 ? Buffer.from(dataBase64, 'base64') : null) : undefined;
    const [s] = await sql`
      UPDATE scripts SET
        name = ${name !== undefined ? name : sql`name`},
        file_name = ${fileName !== undefined ? (fileName||null) : sql`file_name`},
        mime = ${mime !== undefined ? (mime||null) : sql`mime`},
        data = ${buf !== undefined ? buf : sql`data`}
      WHERE id = ${req.params.sid} AND project_id = ${req.params.id}
      RETURNING id, name, file_name, mime, created_at, (data IS NOT NULL) as has_file`;
    if (!s) return res.status(404).json({ error: 'Script not found' });
    res.json(s);
  } catch(e) { next(e); }
});

router.delete('/:id/scripts/:sid', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`DELETE FROM scripts WHERE id = ${req.params.sid} AND project_id = ${req.params.id}`;
    res.status(204).end();
  } catch(e) { next(e); }
});

router.get('/:id/scripts/:sid/file', requireAuth, async (req, res, next) => {
  try {
    const [s] = await sql`SELECT name, file_name, mime, data FROM scripts WHERE id = ${req.params.sid} AND project_id = ${req.params.id}`;
    if (!s?.data) return res.status(404).json({ error: 'No file uploaded for this script' });
    res.setHeader('Content-Type', s.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${(s.file_name || s.name).replace(/"/g, '')}"`);
    res.send(Buffer.from(s.data));
  } catch(e) { next(e); }
});

module.exports = router;
