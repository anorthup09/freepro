const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const finance = [requireAuth, requireRole('ADMIN', 'PRODUCER')];

// 2026 budget template (mirrors the Excel master; qty starts at 0)
const CREW_LINES = [
  ['Director', 'Flat Rate', 1750],
  ['DP/Cam Op', 'Flat Rate', 1500],
  ['Executive Producer', 'Flat Rate', 1500],
  ['Field Producer', 'Flat Rate', 1325],
  ['Cam B', 'Flat Rate', 1200],
  ['Audio Engineer', 'Flat Rate', 1325],
  ['Key Grip', 'Flat Rate', 1000],
  ['Grip', 'Flat Rate', 1000],
  ['Gaffer', 'Flat Rate', 1100],
  ['First AC', 'Flat Rate', 900],
  ['First AD', 'Flat Rate', 700],
  ['Production Coordinator', 'Flat Rate', 600],
  ['Production Assistant', 'Flat Rate', 300],
  ['Onsite Editor', 'Flat Rate', 1500],
  ['Teleprompter & Operator', 'Flat Rate', 1325],
  ['Hair & Makeup', 'Flat Rate - local contractor; includes kit fee', 1100],
  ['DIT', 'Flat Rate', 1000],
  ['Drone Operator', 'Flat Rate (not including gear)', 1500],
  ['Location Scout', 'Flat Rate', 945],
  ['Casting Director', 'Flat Rate', 945],
  ['Art Director', 'Flat Rate', 850],
  ['Props & Wardrobe Lead', 'Flat Rate', 850],
  ['Craft Services', 'Flat Rate', 1250],
  ['Talent', 'Allocation - billed to actual', 1200],
  ['Props Rental', 'Allocation - billed to actual', 500],
  ['Location Fee / Studio Cost', 'Allocation - billed to actual', 1500],
  ['Equipment Rental', 'Starting daily package rate - cameras, lights, audio & support gear; subject to change', 6000],
];
const TRAVEL_LINES = [
  ['Airfare', 'Round-trip Allocation (per traveling crew member) - billed to actual', 700],
  ['Hotel Accommodations', 'Daily Allocation (per traveling crew member) - billed to actual', 250],
  ['Rental Car', 'Daily Rental Allocation - billed to actual', 500],
  ['Transportation Costs', 'Allocation (per traveling crew member) - billed to actual', 200],
  ['Baggage Fees', 'Allocation (per traveling crew member) - billed to actual', 250],
  ['Daily Per Diem', 'Flat Rate (travel days included) - # crew/# days', 100],
  ['Insurance', 'Flat Rate per shoot', 500],
];
const TEMPLATE = [
  { title: 'SCRIPTING / STORYBOARDING', kind: 'general', lines: [
    ['Scripting', 'Starting allocation per script (based on 2-min max TRT)', 1000],
    ['Storyboarding', 'Starting allocation per script (based on 2-min max TRT)', 1000],
  ]},
  { title: 'VIRTUAL RECORDING', subtitle: 'Costs for Remote Capture — # x 1 hr sessions', kind: 'general', lines: [
    ['Virtual Producer', 'Flat Rate - priced per 1-hour recording session', 175],
    ['Recording Engineer', 'Flat Rate - priced per 1-hour recording session', 175],
    ['Remote Production Studio', 'Flat Rate - Hourly Usage Fee', 200],
  ]},
  { title: 'PRODUCTION COSTS — Shoot #1', subtitle: 'Shoot Description · City, State · Dates', kind: 'shoot', lines: 'SHOOT' },
  { title: 'POST-PRODUCTION', subtitle: 'Allocations subject to change based on final output', kind: 'general', lines: [
    ['Video Editing - Assembly Editing Rate', 'Starting rate: < 30 min TRT', 1500],
    ['Video Editing - Assembly Editing Rate', 'Starting rate: 30-60 min TRT', 2500],
    ['Video Editing - Standard Editing Rate', 'Starting rate: < 60 second TRT', 2800],
    ['Video Editing - Standard Editing Rate', 'Starting rate: 1-2 min TRT', 3500],
    ['Video Editing - Standard Editing Rate', 'Starting rate: Appx 10 min TRT (Editing Rush)', 10000],
    ['Video Editing - Rush Editing Rate', 'Allocation of hours', 225],
    ['Video Editing - Onsite Recap Video', 'Starting rate per video', 4500],
    ['Video Editing - Post-Event Recap Video', 'Starting rate per video', 4000],
    ['Video Editing - Photo Slideshow', 'Starting rate per video', 2000],
    ['Opening/Closing Thematic Video (<60 sec)', 'Starting rate per video (Includes Basic MOGFX)', 8000],
    ['Opening/Closing Thematic Video (60-90 sec)', 'Starting rate per video (Includes Advance MOGFX)', 10200],
    ['Destination Teaser', 'Starting rate per video', 3500],
    ['Motion Graphics', 'Allocation of hours', 225],
    ['Color Correction/Final Polish', 'Starting hourly rate', 250],
    ['Audio Mixing/Sound Design', 'Starting rate per video', 500],
    ['Professional Voiceover Talent', 'Allocation - billed to actual', 1500],
    ['Creative Direction - Post-Production', 'Based on total project budget - set Hrs/Days to 1 if needed', null, 0.10],
  ]},
  { title: 'MISC COSTS', kind: 'general', lines: [
    ['Stock or AI Footage (licensing)', 'Billed to Actual', 0],
    ['AI Creation', 'Hourly Rate for management of AI', 125],
    ['Transcripts', 'Allocation - billed to actual', 50],
    ['Music', 'Flat Rate', 250],
    ['International Costs', 'Carnet ($500), Cash, Work Visa', 0],
    ['Media/Storage', 'Flat Rate per drive or per virtual event', 250],
  ]},
  { title: 'PHOTOGRAPHY', subtitle: 'The Capture Co.', kind: 'photo', lines: [
    ['Photography Allocation', 'Estimated Costs - Photographer Day Rate, Photo Gear, Photo Editing, Photo Gallery', 0],
  ]},
];

const VCC_CATEGORIES = [
  '5180 Hotel Payments (B)',
  '5249 Shipping (B)',
  '5255 Staff Travel Expenses (B)',
  '5260 Actors & Voice Talent (B)',
  '5265 Video Elements (Stock Footage,Captions/Templates) (B)',
  '5270 Studio Gear, Equipment Rental (B)',
  '5400 Logistics Labor (B)',
  '5410 Per Diem (B)',
  '5414 Other Expense (B)',
  '5420 Client Meals & Entertainment (B)',
  '5900 Airfare (B)',
  'Prop/Art/Wardrobe',
  'Catering/Crafty',
  'Location/Studio Space',
  'Materials & Supplies',
  '6050 Non-Billable',
];

async function seedShootLines(budgetId, sectionId) {
  let sort = 0;
  for (const [scope, notes, unit] of CREW_LINES) {
    await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, unit_cost, sort) VALUES (${budgetId}, ${sectionId}, ${scope}, ${notes}, ${unit}, ${sort++})`;
  }
  await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, percent, sort) VALUES (${budgetId}, ${sectionId}, 'Creative Direction - Pre-/Production', 'Based on section total - set Hrs/Days to 1 if needed', 0.10, ${sort++})`;
  for (const [scope, notes, unit] of TRAVEL_LINES) {
    await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, unit_cost, is_travel, sort) VALUES (${budgetId}, ${sectionId}, ${scope}, ${notes}, ${unit}, TRUE, ${sort++})`;
  }
}

// Finance overview: all projects with budget + vcc rollups
router.get('/finance/projects', ...finance, async (req, res, next) => {
  try {
    const projects = await sql`
      SELECT p.id, p.code, p.title, p.client, p.status, p.start_date, p.end_date, b.id as budget_id, b.status as budget_status,
             b.mgmt_fee_rate, b.total_cap_co, b.deposit, b.additional_deposit
      FROM projects p LEFT JOIN budgets b ON b.project_id = p.id
      WHERE p.status != 'ARCHIVED'
      ORDER BY p.code`;
    const lines = await sql`SELECT budget_id, qty, unit_cost, percent, is_travel, section_id FROM budget_lines`;
    const vcc = await sql`SELECT project_id, SUM(amount) as total FROM vcc_entries GROUP BY project_id`;
    const vccMap = Object.fromEntries(vcc.map(v => [v.project_id, Number(v.total)]));
    res.json(projects.map(p => {
      const bl = lines.filter(l => l.budget_id === p.budget_id);
      const total = budgetTotal(bl, Number(p.mgmt_fee_rate ?? 0.15));
      return { ...p, budget_total: total, vcc_total: vccMap[p.id] || 0 };
    }));
  } catch (e) { next(e); }
});

function lineSubtotal(l, sectionLines) {
  if (l.percent != null) {
    const base = sectionLines.filter(x => x.percent == null && !x.is_travel).reduce((s, x) => s + Number(x.qty || 0) * Number(x.unit_cost || 0), 0);
    return Number(l.percent) * base * Number(l.qty || 0);
  }
  return Number(l.qty || 0) * Number(l.unit_cost || 0);
}
function budgetTotal(allLines, mgmtRate) {
  const bySection = {};
  for (const l of allLines) (bySection[l.section_id] ||= []).push(l);
  let nonTravel = 0, travel = 0;
  for (const secLines of Object.values(bySection)) {
    for (const l of secLines) {
      const st = lineSubtotal(l, secLines);
      if (l.is_travel) travel += st; else nonTravel += st;
    }
  }
  return nonTravel + travel + mgmtRate * nonTravel;
}

// Full finance bundle for a project
router.get('/finance/:pid', ...finance, async (req, res, next) => {
  try {
    const [project] = await sql`SELECT id, code, title, client, status, start_date, end_date FROM projects WHERE id = ${req.params.pid}`;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [budget] = await sql`SELECT * FROM budgets WHERE project_id = ${req.params.pid}`;
    let sections = [], lines = [];
    if (budget) {
      sections = await sql`SELECT * FROM budget_sections WHERE budget_id = ${budget.id} ORDER BY sort`;
      lines = await sql`SELECT * FROM budget_lines WHERE budget_id = ${budget.id} ORDER BY sort`;
    }
    const vcc = await sql`SELECT * FROM vcc_entries WHERE project_id = ${req.params.pid} ORDER BY trip NULLS LAST, entry_date NULLS LAST, created_at`;
    res.json({ project, budget, sections, lines, vcc, categories: VCC_CATEGORIES });
  } catch (e) { next(e); }
});

// Create budget from template
router.post('/finance/:pid/budget', ...finance, async (req, res, next) => {
  try {
    const [existing] = await sql`SELECT id FROM budgets WHERE project_id = ${req.params.pid}`;
    if (existing) return res.status(409).json({ error: 'Budget already exists' });
    const [b] = await sql`INSERT INTO budgets (project_id) VALUES (${req.params.pid}) RETURNING *`;
    let sort = 0;
    for (const sec of TEMPLATE) {
      const [s] = await sql`INSERT INTO budget_sections (budget_id, title, subtitle, kind, sort) VALUES (${b.id}, ${sec.title}, ${sec.subtitle || null}, ${sec.kind}, ${sort++}) RETURNING id`;
      if (sec.lines === 'SHOOT') {
        await seedShootLines(b.id, s.id);
      } else {
        let lsort = 0;
        for (const [scope, notes, unit, percent] of sec.lines) {
          await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, unit_cost, percent, sort) VALUES (${b.id}, ${s.id}, ${scope}, ${notes}, ${unit ?? 0}, ${percent ?? null}, ${lsort++})`;
        }
      }
    }
    res.status(201).json(b);
  } catch (e) { next(e); }
});

// Budget header fields
router.patch('/finance/budget/:bid', ...finance, async (req, res, next) => {
  try {
    const d = req.body;
    const num = v => (v === '' || v === null || v === undefined ? null : Number(v));
    const [b] = await sql`
      UPDATE budgets SET
        status = COALESCE(${d.status ?? null}, status),
        mgmt_fee_rate = ${d.mgmtFeeRate !== undefined ? num(d.mgmtFeeRate) : sql`mgmt_fee_rate`},
        deposit = ${d.deposit !== undefined ? num(d.deposit) : sql`deposit`},
        deposit_due = ${d.depositDue !== undefined ? (d.depositDue || null) : sql`deposit_due`},
        additional_deposit = ${d.additionalDeposit !== undefined ? num(d.additionalDeposit) : sql`additional_deposit`},
        final_inv_date = ${d.finalInvDate !== undefined ? (d.finalInvDate || null) : sql`final_inv_date`},
        paid_date = ${d.paidDate !== undefined ? (d.paidDate || null) : sql`paid_date`},
        total_cap_co = ${d.totalCapCo !== undefined ? (num(d.totalCapCo) ?? 0) : sql`total_cap_co`},
        original_fee_estimate = ${d.originalFeeEstimate !== undefined ? num(d.originalFeeEstimate) : sql`original_fee_estimate`},
        budget_date = ${d.budgetDate !== undefined ? (d.budgetDate || null) : sql`budget_date`},
        media_rep = ${d.mediaRep !== undefined ? (d.mediaRep || null) : sql`media_rep`},
        solutions_code = ${d.solutionsCode !== undefined ? (d.solutionsCode || null) : sql`solutions_code`}
      WHERE id = ${req.params.bid} RETURNING *`;
    res.json(b);
  } catch (e) { next(e); }
});

// Sections
router.post('/finance/budget/:bid/sections', ...finance, async (req, res, next) => {
  try {
    const { title, subtitle, kind = 'general', seedShoot } = req.body;
    const [{ max }] = await sql`SELECT COALESCE(MAX(sort), -1) as max FROM budget_sections WHERE budget_id = ${req.params.bid}`;
    const [s] = await sql`INSERT INTO budget_sections (budget_id, title, subtitle, kind, sort) VALUES (${req.params.bid}, ${title}, ${subtitle || null}, ${kind}, ${Number(max) + 1}) RETURNING *`;
    if (seedShoot) await seedShootLines(req.params.bid, s.id);
    const lines = await sql`SELECT * FROM budget_lines WHERE section_id = ${s.id} ORDER BY sort`;
    res.status(201).json({ section: s, lines });
  } catch (e) { next(e); }
});
router.patch('/finance/sections/:sid', ...finance, async (req, res, next) => {
  try {
    const { title, subtitle, sort } = req.body;
    const [s] = await sql`UPDATE budget_sections SET
      title = COALESCE(${title ?? null}, title),
      subtitle = ${subtitle !== undefined ? (subtitle || null) : sql`subtitle`},
      sort = COALESCE(${sort ?? null}, sort)
      WHERE id = ${req.params.sid} RETURNING *`;
    res.json(s);
  } catch (e) { next(e); }
});
router.delete('/finance/sections/:sid', ...finance, async (req, res, next) => {
  try { await sql`DELETE FROM budget_sections WHERE id = ${req.params.sid}`; res.status(204).end(); } catch (e) { next(e); }
});

// Lines
router.post('/finance/sections/:sid/lines', ...finance, async (req, res, next) => {
  try {
    const { scope = '', notes = '', isTravel = false } = req.body;
    const [sec] = await sql`SELECT budget_id FROM budget_sections WHERE id = ${req.params.sid}`;
    const [{ max }] = await sql`SELECT COALESCE(MAX(sort), -1) as max FROM budget_lines WHERE section_id = ${req.params.sid}`;
    const [l] = await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, is_travel, sort) VALUES (${sec.budget_id}, ${req.params.sid}, ${scope}, ${notes}, ${isTravel === true}, ${Number(max) + 1}) RETURNING *`;
    res.status(201).json(l);
  } catch (e) { next(e); }
});
router.patch('/finance/lines/:lid', ...finance, async (req, res, next) => {
  try {
    const d = req.body;
    const num = v => (v === '' || v === null || v === undefined ? null : Number(v));
    const [l] = await sql`UPDATE budget_lines SET
      scope = ${d.scope !== undefined ? d.scope : sql`scope`},
      notes = ${d.notes !== undefined ? d.notes : sql`notes`},
      qty = ${d.qty !== undefined ? (num(d.qty) ?? 0) : sql`qty`},
      unit_cost = ${d.unitCost !== undefined ? (num(d.unitCost) ?? 0) : sql`unit_cost`},
      percent = ${d.percent !== undefined ? num(d.percent) : sql`percent`},
      actual = ${d.actual !== undefined ? num(d.actual) : sql`actual`}
      WHERE id = ${req.params.lid} RETURNING *`;
    res.json(l);
  } catch (e) { next(e); }
});
router.delete('/finance/lines/:lid', ...finance, async (req, res, next) => {
  try { await sql`DELETE FROM budget_lines WHERE id = ${req.params.lid}`; res.status(204).end(); } catch (e) { next(e); }
});

// VCC entries
router.post('/finance/:pid/vcc', ...finance, async (req, res, next) => {
  try {
    const d = req.body;
    const [e] = await sql`INSERT INTO vcc_entries (project_id, entry_date, vendor, description, category, trip, amount, status, not_posted, source)
      VALUES (${req.params.pid}, ${d.entryDate || null}, ${d.vendor || null}, ${d.description || null}, ${d.category || null}, ${d.trip || null}, ${Number(d.amount) || 0}, ${d.status || 'HOLD'}, ${d.notPosted === true}, ${d.source || 'manual'})
      RETURNING *`;
    res.status(201).json(e);
  } catch (e) { next(e); }
});
router.patch('/finance/vcc/:id', ...finance, async (req, res, next) => {
  try {
    const d = req.body;
    const [e] = await sql`UPDATE vcc_entries SET
      entry_date = ${d.entryDate !== undefined ? (d.entryDate || null) : sql`entry_date`},
      vendor = ${d.vendor !== undefined ? (d.vendor || null) : sql`vendor`},
      description = ${d.description !== undefined ? (d.description || null) : sql`description`},
      category = ${d.category !== undefined ? (d.category || null) : sql`category`},
      trip = ${d.trip !== undefined ? (d.trip || null) : sql`trip`},
      amount = ${d.amount !== undefined ? (Number(d.amount) || 0) : sql`amount`},
      status = ${d.status !== undefined ? d.status : sql`status`},
      not_posted = ${d.notPosted !== undefined ? (d.notPosted === true) : sql`not_posted`}
      WHERE id = ${req.params.id} RETURNING *`;
    res.json(e);
  } catch (e) { next(e); }
});
router.delete('/finance/vcc/:id', ...finance, async (req, res, next) => {
  try { await sql`DELETE FROM vcc_entries WHERE id = ${req.params.id}`; res.status(204).end(); } catch (e) { next(e); }
});

module.exports = router;
