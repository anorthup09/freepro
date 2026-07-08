const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const staff = [requireAuth, requireRole('ADMIN', 'PRODUCER')];

// ── Client roster: canonical client names, with duplicate flagging ──

const norm = s => String(s || '').toLowerCase()
  .replace(/\b(inc|llc|ltd|corp|corporation|co|company|group)\b\.?/g, '')
  .replace(/[^a-z0-9]/g, '');

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m || !n) return Math.max(m, n);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

// Fuzzy candidates, optionally refined by AI when a key is configured
async function findSimilar(name, existing) {
  const n = norm(name);
  const fuzzy = existing.filter(c => {
    const e = norm(c.name);
    if (!e || !n) return false;
    if (e === n) return true;
    if (e.includes(n) || n.includes(e)) return true;
    return levenshtein(e, n) <= Math.max(1, Math.floor(Math.min(e.length, n.length) / 4));
  });
  if (!fuzzy.length || !process.env.ANTHROPIC_API_KEY) return fuzzy;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 200,
        messages: [{ role: 'user', content:
          `A user wants to add a new client named ${JSON.stringify(name)} to a company roster. Existing similar-looking clients: ${JSON.stringify(fuzzy.map(c => c.name))}. Which of the existing names most likely refer to the SAME client (typo, abbreviation, alternate spelling)? Reply with ONLY a JSON array of the existing names that are likely duplicates, e.g. ["Acme Inc"] or [].` }],
      }),
    });
    const j = await r.json();
    const arr = JSON.parse((j.content?.[0]?.text || '[]').match(/\[[\s\S]*\]/)?.[0] || '[]');
    const keep = fuzzy.filter(c => arr.includes(c.name));
    return keep.length ? keep : fuzzy;
  } catch (e) {
    console.error('client duplicate AI check failed:', e.message);
    return fuzzy;
  }
}

router.get('/roster', ...staff, async (req, res, next) => {
  try {
    res.json(await sql`SELECT id, name FROM clients ORDER BY name`);
  } catch (e) { next(e); }
});

router.post('/roster', ...staff, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Client name required' });
    const existing = await sql`SELECT id, name FROM clients ORDER BY name`;
    const exact = existing.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (exact) return res.json(exact);
    if (!req.body.force) {
      const dups = await findSimilar(name, existing);
      if (dups.length) return res.status(409).json({ possibleDuplicates: dups.map(c => c.name) });
    }
    const [row] = await sql`INSERT INTO clients (name, created_by) VALUES (${name}, ${req.user.name || req.user.email}) RETURNING id, name`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// Per-client hub settings (client-portal password). Creates the roster row on demand.
router.get('/:client/meta', ...staff, async (req, res, next) => {
  try {
    const [c] = await sql`SELECT id, name, hub_password FROM clients WHERE LOWER(name) = LOWER(${req.params.client})`;
    res.json(c || { name: req.params.client, hub_password: null });
  } catch (e) { next(e); }
});

router.patch('/:client/meta', ...staff, async (req, res, next) => {
  try {
    const name = req.params.client;
    let [c] = await sql`SELECT id FROM clients WHERE LOWER(name) = LOWER(${name})`;
    if (!c) [c] = await sql`INSERT INTO clients (name, created_by) VALUES (${name}, ${req.user.name || req.user.email}) RETURNING id`;
    const pw = req.body.hubPassword === undefined ? undefined : (String(req.body.hubPassword || '').trim() || null);
    const [row] = pw === undefined
      ? await sql`SELECT id, name, hub_password FROM clients WHERE id = ${c.id}`
      : await sql`UPDATE clients SET hub_password = ${pw} WHERE id = ${c.id} RETURNING id, name, hub_password`;
    res.json(row);
  } catch (e) { next(e); }
});

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
