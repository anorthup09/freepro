const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

// Best-effort geocode via Nominatim — a rec without coordinates still saves,
// it just won't get a map pin
async function geocode(q) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
      headers: { 'User-Agent': 'FreePro/1.0 (video production management app)' },
    });
    const [hit] = await r.json();
    return hit ? { lat: Number(hit.lat), lon: Number(hit.lon) } : null;
  } catch { return null; }
}

const userKey = req => (req.user.email || req.user.id || '').toLowerCase();

// All recs, ranked by average rating
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT r.*,
        COALESCE(rt.avg_rating, 0) AS avg_rating,
        COALESCE(rt.rating_count, 0) AS rating_count,
        my.rating AS my_rating,
        COALESCE(ph.photo_ids, '{}') AS photo_ids
      FROM foodie_recs r
      LEFT JOIN (
        SELECT rec_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS rating_count
        FROM foodie_ratings GROUP BY rec_id
      ) rt ON rt.rec_id = r.id
      LEFT JOIN foodie_ratings my ON my.rec_id = r.id AND my.user_key = ${userKey(req)}
      LEFT JOIN (
        SELECT rec_id, ARRAY_AGG(id ORDER BY created_at) AS photo_ids
        FROM foodie_photos GROUP BY rec_id
      ) ph ON ph.rec_id = r.id
      ORDER BY COALESCE(rt.avg_rating, 0) DESC, COALESCE(rt.rating_count, 0) DESC, r.created_at DESC`;
    res.json(rows);
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, address, city, cuisine, price, notes } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    let coords = null;
    if (address) coords = await geocode([name, address].filter(Boolean).join(', ')) || await geocode(address);
    else if (city) coords = await geocode(`${name}, ${city}`);
    const [row] = await sql`
      INSERT INTO foodie_recs (name, address, city, cuisine, price, notes, lat, lon, added_by)
      VALUES (${String(name).trim()}, ${address || null}, ${city || null}, ${cuisine || null},
              ${price || null}, ${notes || null}, ${coords?.lat ?? null}, ${coords?.lon ?? null},
              ${req.user.name || req.user.email})
      RETURNING *`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const [rec] = await sql`SELECT added_by FROM foodie_recs WHERE id = ${req.params.id}`;
    if (!rec) return res.status(404).json({ error: 'Not found' });
    const mine = rec.added_by === (req.user.name || req.user.email);
    if (!mine && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only the person who added it (or an admin) can remove a rec' });
    await sql`DELETE FROM foodie_recs WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Rate 1–5 (one vote per person, re-rating overwrites); rating 0 clears
router.post('/:id/rate', requireAuth, async (req, res, next) => {
  try {
    const rating = Number(req.body.rating);
    if (rating === 0) {
      await sql`DELETE FROM foodie_ratings WHERE rec_id = ${req.params.id} AND user_key = ${userKey(req)}`;
    } else {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1–5' });
      await sql`
        INSERT INTO foodie_ratings (rec_id, user_key, rating) VALUES (${req.params.id}, ${userKey(req)}, ${rating})
        ON CONFLICT (rec_id, user_key) DO UPDATE SET rating = ${rating}`;
    }
    const [agg] = await sql`
      SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS rating_count
      FROM foodie_ratings WHERE rec_id = ${req.params.id}`;
    res.json({ avg_rating: agg.avg_rating || 0, rating_count: agg.rating_count || 0, my_rating: rating || null });
  } catch (e) { next(e); }
});

router.post('/:id/photos', requireAuth, async (req, res, next) => {
  try {
    const { filename, mime, fileBase64 } = req.body;
    if (!filename || !fileBase64) return res.status(400).json({ error: 'filename and file required' });
    if (!(mime || '').startsWith('image/')) return res.status(400).json({ error: 'Photos only' });
    const buf = Buffer.from(fileBase64, 'base64');
    if (buf.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Photo too large (10MB max)' });
    const [row] = await sql`
      INSERT INTO foodie_photos (rec_id, filename, mime, size, data, uploaded_by)
      VALUES (${req.params.id}, ${filename}, ${mime}, ${buf.length}, ${buf}, ${req.user.name || req.user.email})
      RETURNING id, rec_id, filename, mime, size, uploaded_by, created_at`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});

router.get('/photos/:id/file', requireAuth, async (req, res, next) => {
  try {
    const [f] = await sql`SELECT filename, mime, data FROM foodie_photos WHERE id = ${req.params.id}`;
    if (!f) return res.status(404).json({ error: 'Photo not found' });
    res.setHeader('Content-Type', f.mime || 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${f.filename.replace(/"/g, '')}"`);
    res.send(f.data);
  } catch (e) { next(e); }
});

router.delete('/photos/:id', requireAuth, async (req, res, next) => {
  try {
    const [ph] = await sql`SELECT uploaded_by FROM foodie_photos WHERE id = ${req.params.id}`;
    if (!ph) return res.status(404).json({ error: 'Photo not found' });
    const mine = ph.uploaded_by === (req.user.name || req.user.email);
    if (!mine && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Only the uploader (or an admin) can remove a photo' });
    await sql`DELETE FROM foodie_photos WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
