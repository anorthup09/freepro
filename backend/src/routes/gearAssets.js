const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

// Gear asset database — company-wide equipment inventory, browsed and edited
// from FreePro's Gear Management (Asset Management). `extra` keeps any
// spreadsheet columns that don't map to a first-class field.

// GET /api/gear-assets?q=
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const rows = q
      ? await sql`
          SELECT * FROM gear_assets
          WHERE name ILIKE ${'%' + q + '%'} OR asset_tag ILIKE ${'%' + q + '%'} OR category ILIKE ${'%' + q + '%'}
             OR make ILIKE ${'%' + q + '%'} OR model ILIKE ${'%' + q + '%'} OR serial_number ILIKE ${'%' + q + '%'}
             OR location ILIKE ${'%' + q + '%'} OR assigned_to ILIKE ${'%' + q + '%'}
          ORDER BY category NULLS LAST, name`
      : await sql`SELECT * FROM gear_assets ORDER BY category NULLS LAST, name`;
    res.json(rows);
  } catch (e) { next(e); }
});

const FIELDS = ['assetTag','name','category','make','model','serialNumber','qty','status','location','assignedTo','purchaseDate','purchasePrice','currentValue','notes','extra'];
const colOf = {
  assetTag:'asset_tag', name:'name', category:'category', make:'make', model:'model', serialNumber:'serial_number',
  qty:'qty', status:'status', location:'location', assignedTo:'assigned_to', purchaseDate:'purchase_date',
  purchasePrice:'purchase_price', currentValue:'current_value', notes:'notes', extra:'extra',
};

// POST /api/gear-assets
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!(b.name || '').trim()) return res.status(400).json({ error: 'Name is required' });
    const [a] = await sql`
      INSERT INTO gear_assets (asset_tag, name, category, make, model, serial_number, qty, status, location, assigned_to, purchase_date, purchase_price, current_value, notes, extra)
      VALUES (${b.assetTag||null}, ${b.name.trim()}, ${b.category||null}, ${b.make||null}, ${b.model||null}, ${b.serialNumber||null},
              ${b.qty ?? 1}, ${b.status||'AVAILABLE'}, ${b.location||null}, ${b.assignedTo||null},
              ${b.purchaseDate||null}, ${b.purchasePrice ?? null}, ${b.currentValue ?? null}, ${b.notes||null}, ${sql.json(b.extra || {})})
      RETURNING *`;
    res.status(201).json(a);
  } catch (e) { next(e); }
});

// PATCH /api/gear-assets/:id
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const b = req.body || {};
    const sets = FIELDS.filter(k => b[k] !== undefined);
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    let a;
    for (const k of sets) {
      const v = k === 'extra' ? sql.json(b[k] || {}) : (b[k] === '' ? null : b[k]);
      [a] = await sql`UPDATE gear_assets SET ${sql(colOf[k])} = ${v}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING *`;
    }
    if (!a) return res.status(404).json({ error: 'Asset not found' });
    res.json(a);
  } catch (e) { next(e); }
});

// DELETE /api/gear-assets/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await sql`DELETE FROM gear_assets WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// POST /api/gear-assets/import — bulk rows from a spreadsheet
router.post('/import', requireAuth, async (req, res, next) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    let n = 0;
    for (const b of rows) {
      if (!(b.name || '').trim()) continue;
      await sql`
        INSERT INTO gear_assets (asset_tag, name, category, make, model, serial_number, qty, status, location, assigned_to, purchase_date, purchase_price, current_value, notes, extra)
        VALUES (${b.assetTag||null}, ${b.name.trim()}, ${b.category||null}, ${b.make||null}, ${b.model||null}, ${b.serialNumber||null},
                ${b.qty ?? 1}, ${b.status||'AVAILABLE'}, ${b.location||null}, ${b.assignedTo||null},
                ${b.purchaseDate||null}, ${b.purchasePrice ?? null}, ${b.currentValue ?? null}, ${b.notes||null}, ${sql.json(b.extra || {})})`;
      n++;
    }
    res.json({ ok: true, imported: n });
  } catch (e) { next(e); }
});

module.exports = router;
