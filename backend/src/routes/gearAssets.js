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

// Department buckets for the gear request pickers. Explicit map first, then
// keyword fallback for the grab-bag "Equipment"/blank categories.
const DEPT_BY_CATEGORY = {
  'Cameras':'camera','Camera Accessories':'camera','Camera Equipment':'camera','Camera Stability':'camera',
  'Lenses':'camera','Gimbal':'camera','Drone':'camera','GOPRO':'camera','Filter':'camera','Tripods/Heads':'camera','Monitor':'camera',
  'Grip':'grip','Stands':'grip','Dolly System':'grip','Production/ Set Accessories':'grip','Tools':'grip',
  'Lights':'electric','Strobe/Flash':'electric','Cable':'electric','Battery':'electric',
  'Audio':'audio',
  'HDD':'media_management','Media (Memory Cards)':'media_management',
  'Computer equipment':'editing',
};
function deptOf(cat, name) {
  if (DEPT_BY_CATEGORY[cat]) return DEPT_BY_CATEGORY[cat];
  const n = (name || '').toLowerCase();
  if (/\b(mic|audio|boom|lav|headphone|speaker)\b/.test(n)) return 'audio';
  if (/(cable|charger|power|battery|light|dimmer)/.test(n)) return 'electric';
  if (/(card|reader|ssd|drive|hdd|storage)/.test(n)) return 'media_management';
  if (/(computer|laptop|imac|macbook|keyboard)/.test(n)) return 'editing';
  if (/(lens|cap|mount|filter|matte|focus|monitor|camera|tripod|gimbal|timecode)/.test(n)) return 'camera';
  return 'grip';
}

// GET /api/gear-assets/inventory — one row per equipment MODEL (assets deduped
// by name), bucketed into the six gear departments, with availability counts.
router.get('/inventory', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT name, category, COUNT(*)::int as total,
             COUNT(*) FILTER (WHERE status = 'AVAILABLE')::int as available
      FROM gear_assets
      WHERE status NOT IN ('RETIRED', 'LOST')
      GROUP BY name, category
      ORDER BY name`;
    // Unit-ID suffixes are one model — combine "… CAM A", "… STUDIO 117",
    // "… #3", and "… Z1/E5"-style tags. The letter+digit rule only merges
    // when siblings exist, so real model names ("Sony FX6") never collapse.
    const safeBase = n => n
      .replace(/\s+CAM\s+[A-Z0-9]{1,2}$/i, '')
      .replace(/\s+STUDIO\s+\d{1,4}$/i, '')
      .replace(/\s+#\d+$/, '')
      .trim();
    const idBase = n => {
      const b = n.replace(/\s+-?[A-Z]{1,2}\d{1,3}$/, '').trim();
      return b.length >= 8 ? b : n;   // don't reduce short names to nothing
    };
    const pre = rows.map(r => ({ ...r, name: safeBase(r.name) }));
    // letter+digit suffix merges only when >1 distinct raw name shares the base
    const baseCount = {};
    for (const r of pre) {
      const b = idBase(r.name);
      if (b !== r.name) (baseCount[b.toLowerCase()] ||= new Set()).add(r.name);
    }
    const merged = new Map();
    for (const r of pre) {
      const b = idBase(r.name);
      const name = b !== r.name && baseCount[b.toLowerCase()]?.size > 1 ? b : r.name;
      const key = name.toLowerCase() + '|' + (r.category || '');
      const m = merged.get(key);
      if (m) { m.total += r.total; m.available += r.available; }
      else merged.set(key, { name, dept: deptOf(r.category, name), category: r.category, total: r.total, available: r.available });
    }
    res.json([...merged.values()].sort((a, b) => a.name.localeCompare(b.name)));
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
