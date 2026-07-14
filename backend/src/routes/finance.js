const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const finance = [requireAuth, requireRole('ADMIN', 'PRODUCER', 'FINANCE')];

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
  ['Equipment Rental', 'Starting daily package rate - cameras, lights, audio & support gear; subject to change', 3500],
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
const TEMPLATE_KEYS = {
  scripting: 'SCRIPTING / STORYBOARDING',
  virtual: 'VIRTUAL RECORDING',
  shoot: 'PRODUCTION COSTS',
  post: 'POST-PRODUCTION',
  misc: 'MISC COSTS',
  photo: 'PHOTOGRAPHY',
};

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
  { title: 'PRODUCTION COSTS — Shoot #1', subtitle: '', kind: 'shoot', lines: 'SHOOT' },
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
    ['Creative Direction - Post-Production', 'Based on section total - toggle on to apply', null, 0.10],
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

// Shoot codes always derive from the project's ROOT code (strip any trailing
// "-NN") so a project whose own code already carries a suffix never produces a
// doubled code like 02.LPL-01-01.
const rootCode = c => String(c || '').replace(/-\d+$/, '');
async function nextShootCode(budgetId) {
  const [b] = await sql`SELECT p.code FROM budgets b JOIN projects p ON p.id = b.project_id WHERE b.id = ${budgetId}`;
  const [{ n }] = await sql`SELECT COUNT(*) as n FROM budget_sections WHERE budget_id = ${budgetId} AND kind = 'shoot'`;
  return `${rootCode(b.code)}-${String(Number(n) + 1).padStart(2, '0')}`;
}

async function seedShootLines(budgetId, sectionId) {
  let sort = 0;
  for (const [scope, notes, unit] of CREW_LINES) {
    await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, unit_cost, sort) VALUES (${budgetId}, ${sectionId}, ${scope}, ${notes}, ${unit}, ${sort++})`;
  }
  await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, percent, sort) VALUES (${budgetId}, ${sectionId}, 'Creative Direction - Pre-Production', 'Based on section total - toggle on to apply', 0.10, ${sort++})`;
  for (const [scope, notes, unit] of TRAVEL_LINES) {
    await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, unit_cost, is_travel, sort) VALUES (${budgetId}, ${sectionId}, ${scope}, ${notes}, ${unit}, TRUE, ${sort++})`;
  }
}

// Match a Budget Owner label ("Alex Northup") to a platform user, tolerating
// nicknames (Alex/Alexander) — last names must match, first names prefix-match.
async function autoTagOwner(budgetId, ownerName) {
  if (!budgetId || !ownerName) return;
  const parts = String(ownerName).trim().toLowerCase().split(/\s+/);
  const first = parts[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const users = await sql`SELECT id, name FROM users WHERE role IN ('ADMIN', 'PRODUCER')`;
  const match = users.find(u => {
    const w = (u.name || '').trim().toLowerCase().split(/\s+/);
    const uf = w[0] || '', ul = w.length > 1 ? w[w.length - 1] : '';
    if (w.join(' ') === parts.join(' ')) return true;
    const firstOk = uf === first || uf.startsWith(first) || first.startsWith(uf);
    return firstOk && (!last || !ul ? uf === first : ul === last);
  });
  if (match) {
    await sql`INSERT INTO budget_tags (budget_id, user_id) VALUES (${budgetId}, ${match.id}) ON CONFLICT DO NOTHING`;
  }
}

// Finance overview: all projects with budget + vcc rollups
router.get('/finance/projects', ...finance, async (req, res, next) => {
  try {
    const projects = await sql`
      SELECT p.id, p.code, p.title, p.client, p.client_logo, p.status, p.start_date, p.end_date, p.pipeline, b.id as budget_id, b.status as budget_status,
             b.mgmt_fee_rate, b.total_cap_co, b.deposit, b.additional_deposit, b.deposit_due, b.final_inv_date, b.extra_deposits, b.media_rep, b.close_month
      FROM projects p LEFT JOIN budgets b ON b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main'
      WHERE p.status != 'ARCHIVED' AND p.parent_project_id IS NULL
      ORDER BY p.code`;
    const lines = await sql`SELECT budget_id, qty, unit_cost, percent, is_travel, section_id FROM budget_lines`;
    const vcc = await sql`SELECT project_id, SUM(amount) as total FROM vcc_entries GROUP BY project_id`;
    const shoots = await sql`SELECT budget_id, shoot_code, trip, subtitle, freepro_project_id FROM budget_sections WHERE kind = 'shoot' ORDER BY sort`;
    const vccMap = Object.fromEntries(vcc.map(v => [v.project_id, Number(v.total)]));
    const tags = await sql`SELECT t.budget_id, t.user_id, u.name FROM budget_tags t JOIN users u ON u.id = t.user_id`;
    res.json(projects.map(p => {
      const bl = lines.filter(l => l.budget_id === p.budget_id);
      const { total, fee } = budgetTotal(bl, Number(p.mgmt_fee_rate ?? 0.15));
      return { ...p, budget_total: total, fee, vcc_total: vccMap[p.id] || 0,
        tags: tags.filter(t => t.budget_id === p.budget_id).map(t => ({ userId: t.user_id, name: t.name })),
        shoots: shoots.filter(x => x.budget_id === p.budget_id).map(x => ({ code: x.shoot_code, trip: x.trip, freeproProjectId: x.freepro_project_id })) };
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
  const fee = mgmtRate * nonTravel;
  return { total: nonTravel + travel + fee, fee };
}

// Full finance bundle for a project
router.get('/finance/taggable-users', ...finance, async (req, res, next) => {
  try {
    res.json(await sql`SELECT id, name FROM users WHERE role IN ('ADMIN', 'PRODUCER') ORDER BY name`);
  } catch (e) { next(e); }
});

// All VCC entries across every project, with the main budget's status/close month
// (drives the All VCCs report — Live vs Closed grouping). Registered before
// /finance/:pid/vcc so 'vcc-report' isn't swallowed as a :pid.
router.get('/finance/vcc-report', ...finance, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT v.*, p.code, p.title as project_title, p.client, b.status as budget_status, b.close_month
      FROM vcc_entries v
      JOIN projects p ON p.id = v.project_id
      LEFT JOIN budgets b ON b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main'
      ORDER BY p.code, v.entry_date NULLS LAST, v.created_at`;
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/finance/:pid', ...finance, async (req, res, next) => {
  try {
    const [project] = await sql`SELECT id, code, title, client, status, start_date, end_date FROM projects WHERE id = ${req.params.pid}`;
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const [budget] = await sql`SELECT * FROM budgets WHERE project_id = ${req.params.pid} AND COALESCE(kind, 'main') = 'main'`;
    let sections = [], lines = [];
    if (budget) {
      await ensureShootProjects(budget.id).catch(e2 => console.error('Shoot link sync failed:', e2.message));
      sections = await sql`
        SELECT s.*, fp.start_date as fp_start_date, fp.end_date as fp_end_date
        FROM budget_sections s LEFT JOIN projects fp ON fp.id = s.freepro_project_id
        WHERE s.budget_id = ${budget.id} ORDER BY s.sort`;
      // backfill shoot codes for sections created before the coding system
      const shootSecs = sections.filter(x => x.kind === 'shoot');
      if (shootSecs.some(x => !x.shoot_code)) {
        const [pr] = await sql`SELECT code FROM projects WHERE id = ${budget.project_id}`;
        for (let i = 0; i < shootSecs.length; i++) {
          if (shootSecs[i].shoot_code) continue;
          shootSecs[i].shoot_code = `${rootCode(pr.code)}-${String(i + 1).padStart(2, '0')}`;
          await sql`UPDATE budget_sections SET shoot_code = ${shootSecs[i].shoot_code} WHERE id = ${shootSecs[i].id}`;
        }
      }
      // Shoot Description keeps feeding the linked FreePro title on every load —
      // but only for separate shoot tiles, never the parent project itself. A
      // single-production budget links its shoot to the parent, whose name is
      // user-controlled via Edit Project and must not be overwritten here.
      for (const sec of sections.filter(x => x.kind === 'shoot' && x.freepro_project_id && x.freepro_project_id !== budget.project_id && (x.subtitle || '').trim())) {
        await sql`UPDATE projects SET title = ${sec.subtitle.trim()} WHERE id = ${sec.freepro_project_id} AND title != ${sec.subtitle.trim()}`
          .catch(e2 => console.error('Title feed failed:', e2.message));
      }
      lines = await sql`SELECT * FROM budget_lines WHERE budget_id = ${budget.id} ORDER BY sort`;
    }
    if (budget) await syncFreeProCosts(req.params.pid).catch(e2 => console.error('Auto sync failed:', e2.message));
    const vcc = await sql`SELECT * FROM vcc_entries WHERE project_id = ${req.params.pid} ORDER BY trip NULLS LAST, entry_date NULLS LAST, created_at`;
    const estRows = await sql`SELECT * FROM budgets WHERE project_id = ${req.params.pid} AND kind = 'estimate' ORDER BY created_at`;
    const estIds = estRows.map(e => e.id);
    const estSections = estIds.length ? await sql`SELECT * FROM budget_sections WHERE budget_id = ANY(${estIds}) ORDER BY sort` : [];
    const estLines = estIds.length ? await sql`SELECT * FROM budget_lines WHERE budget_id = ANY(${estIds}) ORDER BY sort` : [];
    const estimates = estRows.map(e => ({
      ...e,
      sections: estSections.filter(x => x.budget_id === e.id),
      lines: estLines.filter(x => x.budget_id === e.id),
    }));
    res.json({ project, budget, sections, lines, vcc, estimates, categories: VCC_CATEGORIES });
  } catch (e) { next(e); }
});

// Create budget from template
router.post('/finance/:pid/budget', ...finance, async (req, res, next) => {
  try {
    const [existing] = await sql`SELECT id FROM budgets WHERE project_id = ${req.params.pid} AND COALESCE(kind, 'main') = 'main'`;
    if (existing) return res.status(409).json({ error: 'Budget already exists' });
    const [b] = await sql`INSERT INTO budgets (project_id, status) VALUES (${req.params.pid}, 'RFP') RETURNING *`;
    let sort = 0;
    for (const sec of TEMPLATE) {
      const shootCode = sec.kind === 'shoot' ? await nextShootCode(b.id) : null;
      const [s] = await sql`INSERT INTO budget_sections (budget_id, title, subtitle, kind, sort, shoot_code) VALUES (${b.id}, ${sec.title}, ${sec.subtitle || null}, ${sec.kind}, ${sort++}, ${shootCode}) RETURNING id`;
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
// Give every production block of a Live main budget its own FreePro project tile
async function ensureShootProjects(budgetId) {
  const [b] = await sql`SELECT * FROM budgets WHERE id = ${budgetId}`;
  if (!b || (b.kind || 'main') !== 'main' || b.status !== 'Live') return;
  const [parent] = await sql`SELECT * FROM projects WHERE id = ${b.project_id}`;
  if (!parent) return;
  const shootSecs = await sql`SELECT * FROM budget_sections WHERE budget_id = ${b.id} AND kind = 'shoot'`;
  for (const sec of shootSecs) {
    if (sec.freepro_project_id || !sec.shoot_code) continue;
    const nn = sec.shoot_code.split('-').pop();
    const named = (sec.subtitle || '').trim() || (sec.trip || '').trim();
    // A single, unnamed production block reuses the parent project as its tile
    // (no redundant record). The parent project code stays bare — only the budget's
    // Production Costs section carries the …-01 suffix, which FreePro views render
    // through displayCodes(). Any shoot with a Trip or Shoot Description gets its own
    // FreePro tile named distinctly so it never collides with the ProFi project
    // name: the Shoot Description if set, else "[Title] - [Trip]".
    if (shootSecs.length === 1 && !named) {
      await sql`UPDATE budget_sections SET freepro_project_id = ${parent.id} WHERE id = ${sec.id}`;
      continue;
    }
    const title = (sec.subtitle || '').trim() || `${parent.title} - ${sec.trip || 'Shoot ' + nn}`;
    const shootName = named; // Shoot Description if set, else the Trip label
    let [proj] = await sql`SELECT id FROM projects WHERE code = ${sec.shoot_code}`;
    if (!proj) {
      [proj] = await sql`INSERT INTO projects (id, code, title, subtitle, client, city, state, start_date, end_date, status, parent_project_id)
        VALUES (gen_random_uuid()::text, ${sec.shoot_code}, ${title}, ${shootName || null}, ${parent.client}, ${parent.city}, ${parent.state}, ${parent.start_date}, ${parent.end_date}, 'PLANNING', ${parent.id})
        RETURNING id`;
    } else if (shootName) {
      await sql`UPDATE projects SET subtitle = ${shootName} WHERE id = ${proj.id} AND (subtitle IS NULL OR subtitle = '')`;
    }
    await sql`UPDATE budget_sections SET freepro_project_id = ${proj.id} WHERE id = ${sec.id}`;
  }
}

// ── Link an existing FreePro project to a budget shoot section ───────────
// For shoots someone hand-created before the budget spawned its own tile:
// adopt the existing project as this shoot (aligning its code + parent).
router.get('/finance/section/:sid/link-candidates', ...finance, async (req, res, next) => {
  try {
    const [sec] = await sql`
      SELECT s.*, b.project_id as parent_id FROM budget_sections s
      JOIN budgets b ON b.id = s.budget_id WHERE s.id = ${req.params.sid}`;
    if (!sec) return res.status(404).json({ error: 'Section not found' });
    const rows = await sql`
      SELECT p.id, p.code, p.title, p.start_date, p.end_date
      FROM projects p
      WHERE p.status != 'ARCHIVED'
        AND p.id != ${sec.parent_id}
        AND p.id != ${sec.freepro_project_id || '~none~'}
        AND NOT EXISTS (SELECT 1 FROM budget_sections bs WHERE bs.freepro_project_id = p.id AND bs.id != ${sec.id})
        AND NOT EXISTS (SELECT 1 FROM budgets bb WHERE bb.project_id = p.id)
      ORDER BY p.created_at DESC
      LIMIT 100`;
    res.json(rows);
  } catch (e) { next(e); }
});
router.post('/finance/section/:sid/link-shoot', ...finance, async (req, res, next) => {
  try {
    const { projectId } = req.body;
    if (!projectId) return res.status(400).json({ error: 'projectId required' });
    const [sec] = await sql`
      SELECT s.*, b.project_id as parent_id FROM budget_sections s
      JOIN budgets b ON b.id = s.budget_id WHERE s.id = ${req.params.sid} AND s.kind = 'shoot'`;
    if (!sec) return res.status(404).json({ error: 'Shoot section not found' });
    const [target] = await sql`SELECT * FROM projects WHERE id = ${projectId}`;
    if (!target) return res.status(404).json({ error: 'Project not found' });
    if (target.id === sec.parent_id) return res.status(400).json({ error: 'That is the parent ProFi project — pick the shoot itself' });
    const [taken] = await sql`SELECT id FROM budget_sections WHERE freepro_project_id = ${projectId} AND id != ${sec.id}`;
    if (taken) return res.status(400).json({ error: 'That project is already linked to another budget shoot' });
    // Align: shoot code, parent, and the link itself
    if (sec.shoot_code && target.code !== sec.shoot_code) {
      const [clash] = await sql`SELECT id FROM projects WHERE code = ${sec.shoot_code} AND id != ${projectId}`;
      if (clash) {
        // The auto-spawned duplicate holds the code — archive it and free the code up
        await sql`UPDATE projects SET code = ${sec.shoot_code + '-old'}, status = 'ARCHIVED' WHERE id = ${clash.id}`;
      }
      await sql`UPDATE projects SET code = ${sec.shoot_code} WHERE id = ${projectId}`;
    }
    await sql`UPDATE projects SET parent_project_id = ${sec.parent_id} WHERE id = ${projectId}`;
    await sql`UPDATE budget_sections SET freepro_project_id = ${projectId} WHERE id = ${sec.id}`;
    res.json({ ok: true, code: sec.shoot_code || target.code });
  } catch (e) { next(e); }
});

// ── Budget versioning ────────────────────────────────────────────────────
// Freeze the current budget as an immutable snapshot (kind='version'),
// then keep editing the live budget as the next version number.
router.post('/finance/budget/:bid/version', ...finance, async (req, res, next) => {
  try {
    const [b] = await sql`SELECT * FROM budgets WHERE id = ${req.params.bid} AND COALESCE(kind, 'main') = 'main'`;
    if (!b) return res.status(404).json({ error: 'Budget not found' });
    const ver = Number(b.version || 1);
    const [snap] = await sql`
      INSERT INTO budgets (project_id, kind, version, label, status, mgmt_fee_rate, budget_date, media_rep,
                           solutions_code, close_month, client_contact, est_final_delivery, unbridled_solutions)
      VALUES (${b.project_id}, 'version', ${ver}, ${'Version ' + ver}, ${b.status}, ${b.mgmt_fee_rate},
              ${b.budget_date}, ${b.media_rep}, ${b.solutions_code}, ${b.close_month},
              ${b.client_contact ? sql.json(b.client_contact) : null}, ${b.est_final_delivery}, ${b.unbridled_solutions === true})
      RETURNING id`;
    const secs = await sql`SELECT * FROM budget_sections WHERE budget_id = ${b.id} ORDER BY sort`;
    for (const sec of secs) {
      const [ns] = await sql`
        INSERT INTO budget_sections (budget_id, title, subtitle, kind, sort, shoot_code, trip)
        VALUES (${snap.id}, ${sec.title}, ${sec.subtitle}, ${sec.kind}, ${sec.sort}, ${sec.shoot_code}, ${sec.trip})
        RETURNING id`;
      await sql`
        INSERT INTO budget_lines (budget_id, section_id, scope, notes, qty, unit_cost, percent, is_travel, actual, sort)
        SELECT ${snap.id}, ${ns.id}, scope, notes, qty, unit_cost, percent, is_travel, actual, sort
        FROM budget_lines WHERE section_id = ${sec.id}`;
    }
    await sql`UPDATE budgets SET version = ${ver + 1} WHERE id = ${b.id}`;
    res.json({ ok: true, version: ver + 1, snapshotId: snap.id });
  } catch (e) { next(e); }
});

// Past versions of a project's budget (newest first)
router.get('/finance/:pid/versions', ...finance, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT b.id, b.version, b.label, b.status, b.created_at,
             (SELECT COALESCE(SUM(CASE WHEN l.percent IS NULL THEN l.qty * l.unit_cost ELSE 0 END), 0)
              FROM budget_lines l WHERE l.budget_id = b.id) as raw_total
      FROM budgets b WHERE b.project_id = ${req.params.pid} AND b.kind = 'version'
      ORDER BY b.version DESC`;
    res.json(rows);
  } catch (e) { next(e); }
});

// One frozen version, with its sections and lines (read-only)
router.get('/finance/versions/:vid', ...finance, async (req, res, next) => {
  try {
    const [budget] = await sql`SELECT * FROM budgets WHERE id = ${req.params.vid} AND kind = 'version'`;
    if (!budget) return res.status(404).json({ error: 'Version not found' });
    const sections = await sql`SELECT * FROM budget_sections WHERE budget_id = ${budget.id} ORDER BY sort`;
    const lines = await sql`SELECT * FROM budget_lines WHERE budget_id = ${budget.id} ORDER BY sort`;
    res.json({ budget, sections, lines });
  } catch (e) { next(e); }
});

// Is outbound email configured? Drives the under-construction pop-ups.
router.get('/mail/status', requireAuth, (req, res) => {
  res.json({ configured: mailReady() });
});

// Email a client invoice summary (deposit or final) to the budget's client
// contacts. Buttons still stamp the invoice date locally; this adds the send.
// New invoice request → billing@unbridledmedia.com, sent on behalf of the
// requesting user so accounting can cut the formal invoice
router.post('/finance/budget/:bid/invoice-request', ...finance, async (req, res, next) => {
  try {
    if (!mailReady()) return res.status(501).json({ error: 'Email is not connected yet' });
    const { number, sendToName, sendToEmail, cc, description, amount } = req.body || {};
    const [b] = await sql`SELECT * FROM budgets WHERE id = ${req.params.bid}`;
    if (!b) return res.status(404).json({ error: 'Budget not found' });
    const [proj] = await sql`SELECT * FROM projects WHERE id = ${b.project_id}`;
    const who = req.user?.name || req.user?.email || 'Unknown';
    const fmt = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sendTo = [sendToName, sendToEmail].filter(Boolean).join(' — ');
    const cfg = await automation('invoice-request').catch(() => null);
    // No automation-level CC: the invoice's own CC list travels in the email body
    await sendMail({ identity: 'accounting',
      ...(cfg?.from ? { from: cfg.from } : {}),
      to: cfg?.to || 'billing@unbridledmedia.com',
      subject: `Invoice Request — ${proj.code} ${proj.title} (Deposit ${number || '?'})`,
      text: who + ' requested a client invoice.\n\nProject: ' + proj.code + ' — ' + proj.title +
        '\nDeposit #: ' + (number || '') + '\nAmount: ' + fmt(amount) + '\nSend To: ' + sendTo +
        '\nCC: ' + (cc || '—') + '\nDescription: ' + (description || ''),
      html: noticeHtml({ tag: 'Invoice Request', note: `Deposit ${number || ''}`,
        title: proj.title, subtitle: proj.code,
        intro: `${who} requested a client invoice — details below.`,
        rows: [
          ['Deposit #', number || '—'],
          ['Amount', fmt(amount)],
          ['Send To', sendTo || '—'],
          ['CC', cc || '—'],
          ['Description', description || '—'],
          ['Requested By', who],
        ],
        postmark: new Date(), color: '#5ABF80' }),
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/finance/budget/:bid/send-invoice', ...finance, async (req, res, next) => {
  try {
    if (!mailReady()) return res.status(501).json({ error: 'Email is not connected yet' });
    const { label, amount, to: toOverride, cc: ccOverride, description } = req.body;   // per-invoice Send To/CC win when set
    const [b] = await sql`SELECT * FROM budgets WHERE id = ${req.params.bid}`;
    if (!b) return res.status(404).json({ error: 'Budget not found' });
    const [proj] = await sql`SELECT * FROM projects WHERE id = ${b.project_id}`;
    const contacts = await sql`SELECT name, email FROM client_contacts WHERE project_id = ${b.project_id} AND email IS NOT NULL`;
    let to = contacts.map(c => c.email);
    let h = null;
    try {
      const [row] = await sql`SELECT data FROM harbingers WHERE project_id = ${b.project_id}`;
      const dta = row ? (typeof row.data === 'string' ? JSON.parse(row.data) : row.data) : null;
      if (dta) h = { primary_contact_email: dta.primaryContactEmail, invoice_cc: dta.invoiceCc };
    } catch { /* no harbinger yet */ }
    if (h?.primary_contact_email && !to.includes(h.primary_contact_email)) to.push(h.primary_contact_email);
    if (toOverride) to = [toOverride];
    if (!to.length) return res.status(400).json({ error: 'No client contact emails on this project — add one on the Overview or Harbinger first' });
    const fmt = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await sendMail({ identity: 'accounting',
      to: to.join(', '),
      cc: ccOverride || h?.invoice_cc || undefined,
      subject: `Invoice — ${proj.code} ${proj.title} (${label})${description ? ` — ${description}` : ''}`,
      text: `Hello,\n\nPlease find the ${label.toLowerCase()} for ${proj.title} (${proj.code}).\n\n${label}: ${fmt(amount)}\n\nA formal invoice document follows from our accounting team. Reply to this email with any questions.\n\nThank you,\nUnbridled Media`,
      html: noticeHtml({ tag: 'Invoice', note: label,
        title: proj.title, subtitle: proj.code,
        intro: `Please find the ${label.toLowerCase()} for ${proj.title}. A formal invoice document follows from our accounting team — reply to this email with any questions.`,
        rows: [[label, fmt(amount)]],
        postmark: new Date() }),
    });
    res.json({ sent: true, to });
  } catch (e) { next(e); }
});

router.patch('/finance/budget/:bid', ...finance, async (req, res, next) => {
  try {
    const d = req.body;
    const num = v => (v === '' || v === null || v === undefined ? null : Number(v));
    // A project can't close until invoicing is complete: every deposit sent and
    // the final invoice sent, so total invoiced equals the total budget.
    if (d.status === 'Closed') {
      const [cur] = await sql`SELECT * FROM budgets WHERE id = ${req.params.bid}`;
      if (cur) {
        const blines = await sql`SELECT qty, unit_cost, percent, is_travel, section_id FROM budget_lines WHERE budget_id = ${req.params.bid}`;
        const { total } = budgetTotal(blines, Number(cur.mgmt_fee_rate ?? 0.15));
        const extras = Array.isArray(cur.extra_deposits) ? cur.extra_deposits : JSON.parse(cur.extra_deposits || '[]');
        const allDeposits = Number(cur.deposit || 0) + Number(cur.additional_deposit || 0) + extras.reduce((a, x) => a + Number(x.amount || 0), 0);
        const invoiced =
          (cur.deposit_due ? Number(cur.deposit || 0) : 0) +
          (cur.paid_date ? Number(cur.additional_deposit || 0) : 0) +
          extras.reduce((a, x) => a + (x.date ? Number(x.amount || 0) : 0), 0) +
          (cur.final_inv_date ? Math.max(total - allDeposits, 0) : 0);
        if (Math.abs(invoiced - total) > 0.01) {
          const fmt = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          return res.status(400).json({ error: `Can't close this project yet — total invoiced (${fmt(invoiced)}) must equal the total budget (${fmt(total)}). Send the final invoice and any unsent deposits in Client Deposits first.` });
        }
      }
    }
    const [b] = await sql`
      UPDATE budgets SET
        status = COALESCE(${d.status ?? null}, status),
        mgmt_fee_rate = ${d.mgmtFeeRate !== undefined ? num(d.mgmtFeeRate) : sql`mgmt_fee_rate`},
        deposit = ${d.deposit !== undefined ? num(d.deposit) : sql`deposit`},
        deposit_due = ${d.depositDue !== undefined ? (d.depositDue || null) : sql`deposit_due`},
        additional_deposit = ${d.additionalDeposit !== undefined ? num(d.additionalDeposit) : sql`additional_deposit`},
        extra_deposits = ${d.extraDeposits !== undefined ? sql.json(d.extraDeposits || []) : sql`extra_deposits`},
        final_inv_date = ${d.finalInvDate !== undefined ? (d.finalInvDate || null) : sql`final_inv_date`},
        paid_date = ${d.paidDate !== undefined ? (d.paidDate || null) : sql`paid_date`},
        total_cap_co = ${d.totalCapCo !== undefined ? (num(d.totalCapCo) ?? 0) : sql`total_cap_co`},
        original_fee_estimate = ${d.originalFeeEstimate !== undefined ? num(d.originalFeeEstimate) : sql`original_fee_estimate`},
        budget_date = ${d.budgetDate !== undefined ? (d.budgetDate || null) : sql`budget_date`},
        media_rep = ${d.mediaRep !== undefined ? (d.mediaRep || null) : sql`media_rep`},
        label = ${d.label !== undefined ? (d.label || null) : sql`label`},
        close_month = ${d.closeMonth !== undefined ? (d.closeMonth || null) : sql`close_month`},
        solutions_code = ${d.solutionsCode !== undefined ? (d.solutionsCode || null) : sql`solutions_code`},
        share_mode = ${d.shareMode !== undefined ? (d.shareMode || 'lines') : sql`share_mode`},
        client_contact = ${d.clientContact !== undefined ? (d.clientContact ? sql.json(d.clientContact) : null) : sql`client_contact`},
        est_final_delivery = ${d.estFinalDelivery !== undefined ? (d.estFinalDelivery || null) : sql`est_final_delivery`},
        unbridled_solutions = ${d.unbridledSolutions !== undefined ? !!d.unbridledSolutions : sql`unbridled_solutions`}
      WHERE id = ${req.params.bid} RETURNING *`;
    // Setting a budget owner auto-tags them on the budget (matched by name)
    if (b && d.mediaRep) {
      await autoTagOwner(b.id, d.mediaRep).catch(e2 => console.error('Owner auto-tag failed:', e2.message));
    }
    // Live budgets keep every production block paired with a FreePro project tile
    if (b && (b.kind || 'main') === 'main' && (d.status === 'Live' || b.status === 'Live')) {
      await ensureShootProjects(b.id).catch(e2 => console.error('FreePro shoot project creation failed:', e2.message));
    }
    // Closing a project archives its FreePro shoot tiles too
    if (b && (b.kind || 'main') === 'main' && d.status === 'Closed') {
      await sql`UPDATE projects SET status = 'ARCHIVED'::project_status WHERE parent_project_id = ${b.project_id} AND status != 'ARCHIVED'`
        .catch(e2 => console.error('Shoot archive on close failed:', e2.message));
    }
    res.json(b);
  } catch (e) { next(e); }
});

// ── Estimates: parallel budget containers for pricing new client asks ──
router.post('/finance/:pid/estimates', ...finance, async (req, res, next) => {
  try {
    const [main] = await sql`SELECT mgmt_fee_rate FROM budgets WHERE project_id = ${req.params.pid} AND COALESCE(kind, 'main') = 'main'`;
    const [{ n }] = await sql`SELECT COUNT(*) as n FROM budgets WHERE project_id = ${req.params.pid} AND kind = 'estimate'`;
    const label = req.body.label || `Estimate ${Number(n) + 1}`;
    const [e] = await sql`INSERT INTO budgets (project_id, kind, label, status, mgmt_fee_rate)
      VALUES (${req.params.pid}, 'estimate', ${label}, 'Estimate', ${main ? main.mgmt_fee_rate : 0.15}) RETURNING *`;
    res.status(201).json({ ...e, sections: [], lines: [] });
  } catch (e) { next(e); }
});
router.delete('/finance/estimates/:eid', ...finance, async (req, res, next) => {
  try {
    await sql`DELETE FROM budgets WHERE id = ${req.params.eid} AND kind = 'estimate'`;
    res.status(204).end();
  } catch (e) { next(e); }
});
// Fold an approved estimate into the main budget
// Tentative estimate: copy the estimate's sections into the main budget,
// outlined yellow and removable — the estimate itself stays open.
router.post('/finance/estimates/:eid/tentative', ...finance, async (req, res, next) => {
  try {
    const [est] = await sql`SELECT * FROM budgets WHERE id = ${req.params.eid} AND kind = 'estimate'`;
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    const [main] = await sql`SELECT * FROM budgets WHERE project_id = ${est.project_id} AND COALESCE(kind, 'main') = 'main'`;
    if (!main) return res.status(400).json({ error: 'Create the main budget first' });
    const [already] = await sql`SELECT id FROM budget_sections WHERE budget_id = ${main.id} AND estimate_ref = ${est.id}`;
    if (already) return res.json({ ok: true, existing: true });
    const secs = await sql`SELECT * FROM budget_sections WHERE budget_id = ${est.id} ORDER BY sort`;
    const [{ max }] = await sql`SELECT COALESCE(MAX(sort), -1) as max FROM budget_sections WHERE budget_id = ${main.id}`;
    let sort = Number(max) + 1;
    for (const sec of secs) {
      const [ns] = await sql`
        INSERT INTO budget_sections (id, budget_id, title, subtitle, kind, sort, estimate_ref)
        VALUES (gen_random_uuid()::text, ${main.id}, ${(est.label ? est.label + ' — ' : '') + sec.title}, ${sec.subtitle || null}, ${sec.kind || 'general'}, ${sort++}, ${est.id})
        RETURNING id`;
      const lines = await sql`SELECT * FROM budget_lines WHERE section_id = ${sec.id} ORDER BY sort`;
      const nsId = ns.id;
      for (const l of lines) {
        await sql`
          INSERT INTO budget_lines (id, budget_id, section_id, scope, notes, qty, unit_cost, percent, is_travel, sort)
          VALUES (gen_random_uuid()::text, ${main.id}, ${nsId}, ${l.scope}, ${l.notes}, ${l.qty}, ${l.unit_cost}, ${l.percent}, ${l.is_travel}, ${l.sort})`;
      }
    }
    res.json({ ok: true, added: secs.length });
  } catch (e) { next(e); }
});
router.delete('/finance/estimates/:eid/tentative', ...finance, async (req, res, next) => {
  try {
    const [est] = await sql`SELECT project_id FROM budgets WHERE id = ${req.params.eid}`;
    const r = await sql`DELETE FROM budget_sections WHERE estimate_ref = ${req.params.eid} RETURNING id`;
    res.json({ ok: true, removed: r.length });
  } catch (e) { next(e); }
});

router.post('/finance/estimates/:eid/merge', ...finance, async (req, res, next) => {
  try {
    const [est] = await sql`SELECT * FROM budgets WHERE id = ${req.params.eid} AND kind = 'estimate'`;
    if (!est) return res.status(404).json({ error: 'Estimate not found' });
    const [main] = await sql`SELECT * FROM budgets WHERE project_id = ${est.project_id} AND COALESCE(kind, 'main') = 'main'`;
    if (!main) return res.status(400).json({ error: 'Create the main budget first' });
    // a tentative copy of this estimate must not double up with the real merge
    await sql`DELETE FROM budget_sections WHERE budget_id = ${main.id} AND estimate_ref = ${est.id}`;
    const secs = await sql`SELECT * FROM budget_sections WHERE budget_id = ${est.id} ORDER BY sort`;
    const [{ max }] = await sql`SELECT COALESCE(MAX(sort), -1) as max FROM budget_sections WHERE budget_id = ${main.id}`;
    let sort = Number(max) + 1;
    for (const sec of secs) {
      const shootCode = sec.kind === 'shoot' ? await nextShootCode(main.id) : null;
      await sql`UPDATE budget_sections SET budget_id = ${main.id}, sort = ${sort++}, shoot_code = ${shootCode} WHERE id = ${sec.id}`;
      await sql`UPDATE budget_lines SET budget_id = ${main.id} WHERE section_id = ${sec.id}`;
    }
    await sql`DELETE FROM budgets WHERE id = ${est.id}`;
    await ensureShootProjects(main.id).catch(e2 => console.error('FreePro shoot project creation failed:', e2.message));
    res.json({ ok: true, moved: secs.length });
  } catch (e) { next(e); }
});

// Sections
router.post('/finance/budget/:bid/sections', ...finance, async (req, res, next) => {
  try {
    const { title: rawTitle, subtitle: rawSubtitle, kind: rawKind = 'general', seedShoot: rawSeed, afterSectionId, template } = req.body;
    let title = rawTitle, subtitle = rawSubtitle, kind = rawKind, seedShoot = rawSeed, tmplLines = null;
    if (template && TEMPLATE_KEYS[template]) {
      const tmpl = TEMPLATE.find(t => t.title.startsWith(TEMPLATE_KEYS[template]));
      title = title || (template === 'shoot' ? 'PRODUCTION COSTS — New Shoot' : tmpl.title);
      subtitle = subtitle ?? tmpl.subtitle;
      kind = tmpl.kind;
      if (template === 'shoot') seedShoot = true;
      else tmplLines = tmpl.lines;
    }
    let sort;
    if (afterSectionId) {
      const [after] = await sql`SELECT sort FROM budget_sections WHERE id = ${afterSectionId} AND budget_id = ${req.params.bid}`;
      sort = after ? Number(after.sort) + 1 : null;
      if (sort != null) await sql`UPDATE budget_sections SET sort = sort + 1 WHERE budget_id = ${req.params.bid} AND sort >= ${sort}`;
    }
    if (sort == null) {
      const [{ max }] = await sql`SELECT COALESCE(MAX(sort), -1) as max FROM budget_sections WHERE budget_id = ${req.params.bid}`;
      sort = Number(max) + 1;
    }
    const [bRow] = await sql`SELECT kind FROM budgets WHERE id = ${req.params.bid}`;
    const isEstimate = bRow && bRow.kind === 'estimate';
    const shootCode = kind === 'shoot' && !isEstimate ? await nextShootCode(req.params.bid) : null;
    const [s] = await sql`INSERT INTO budget_sections (budget_id, title, subtitle, kind, sort, shoot_code) VALUES (${req.params.bid}, ${title}, ${subtitle || null}, ${kind}, ${sort}, ${shootCode}) RETURNING *`;
    if (seedShoot) await seedShootLines(req.params.bid, s.id);
    if (tmplLines) {
      let lsort = 0;
      for (const [scope, notes, unit, percent] of tmplLines) {
        await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, unit_cost, percent, sort) VALUES (${req.params.bid}, ${s.id}, ${scope}, ${notes}, ${unit ?? 0}, ${percent ?? null}, ${lsort++})`;
      }
    }
    const lines = await sql`SELECT * FROM budget_lines WHERE section_id = ${s.id} ORDER BY sort`;
    await ensureShootProjects(req.params.bid).catch(e2 => console.error('FreePro shoot project creation failed:', e2.message));
    res.status(201).json({ section: s, lines });
  } catch (e) { next(e); }
});
router.patch('/finance/sections/:sid', ...finance, async (req, res, next) => {
  try {
    const { title, subtitle, sort, trip } = req.body;
    const [s] = await sql`UPDATE budget_sections SET
      title = COALESCE(${title ?? null}, title),
      subtitle = ${subtitle !== undefined ? (subtitle || null) : sql`subtitle`},
      trip = ${trip !== undefined ? (trip || null) : sql`trip`},
      sort = COALESCE(${sort ?? null}, sort)
      WHERE id = ${req.params.sid} RETURNING *`;
    // Shoot Description feeds the linked FreePro project's title — but not when
    // the shoot is the parent project itself (single-production), whose name is
    // user-controlled via Edit Project.
    if (subtitle !== undefined && s && s.kind === 'shoot' && s.freepro_project_id && (subtitle || '').trim()) {
      const [pb] = await sql`SELECT project_id FROM budgets WHERE id = ${s.budget_id}`;
      if (pb && s.freepro_project_id !== pb.project_id) {
        await sql`UPDATE projects SET title = ${subtitle.trim()} WHERE id = ${s.freepro_project_id}`
          .catch(e2 => console.error('Title feed failed:', e2.message));
      }
    }
    res.json(s);
  } catch (e) { next(e); }
});
router.delete('/finance/sections/:sid', ...finance, async (req, res, next) => {
  try { await sql`DELETE FROM budget_sections WHERE id = ${req.params.sid}`; res.status(204).end(); } catch (e) { next(e); }
});

// Lines
router.post('/finance/sections/:sid/lines', ...finance, async (req, res, next) => {
  try {
    const { scope = '', notes = '', isTravel = false, unitCost = null, percent = null, qty = null, afterLineId = null } = req.body;
    const [sec] = await sql`SELECT budget_id FROM budget_sections WHERE id = ${req.params.sid}`;
    let sort;
    if (afterLineId) {
      const [after] = await sql`SELECT sort FROM budget_lines WHERE id = ${afterLineId} AND section_id = ${req.params.sid}`;
      if (after) {
        sort = Number(after.sort) + 1;
        await sql`UPDATE budget_lines SET sort = sort + 1 WHERE section_id = ${req.params.sid} AND sort > ${after.sort}`;
      }
    }
    if (sort === undefined) {
      const [{ max }] = await sql`SELECT COALESCE(MAX(sort), -1) as max FROM budget_lines WHERE section_id = ${req.params.sid}`;
      sort = Number(max) + 1;
    }
    const [l] = await sql`INSERT INTO budget_lines (budget_id, section_id, scope, notes, is_travel, unit_cost, percent, qty, sort)
      VALUES (${sec.budget_id}, ${req.params.sid}, ${scope}, ${notes}, ${isTravel === true}, ${unitCost}, ${percent}, ${qty}, ${sort}) RETURNING *`;
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
      actual = ${d.actual !== undefined ? num(d.actual) : sql`actual`},
      sort = ${d.sort !== undefined ? (num(d.sort) ?? 0) : sql`sort`}
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
      not_posted = ${d.notPosted !== undefined ? (d.notPosted === true) : sql`not_posted`},
      review = ${d.review !== undefined ? (d.review === true) : sql`review`},
      flag = ${d.flag !== undefined ? (d.flag || null) : sql`flag`}
      WHERE id = ${req.params.id} RETURNING *`;
    res.json(e);
  } catch (e) { next(e); }
});
router.delete('/finance/vcc/:id', ...finance, async (req, res, next) => {
  try { await sql`DELETE FROM vcc_entries WHERE id = ${req.params.id}`; res.status(204).end(); } catch (e) { next(e); }
});

// ── FreePro cost sync: contracts + travel costs → VCC entries (idempotent by source key)
// Pull FreePro costs (crew labor/gear, flights, hotels, rentals) into the VCC.
// Idempotent by source key — safe to run on every budget load.
async function syncFreeProCosts(pid) {
    const upserts = [];
    // trip auto-coding: with a single shoot the destination is obvious
    const shootSecs2 = await sql`
      SELECT bs.shoot_code, bs.trip FROM budget_sections bs
      JOIN budgets b2 ON b2.id = bs.budget_id
      WHERE b2.project_id = ${pid} AND COALESCE(b2.kind, 'main') = 'main' AND bs.kind = 'shoot'`;
    const defaultTrip = shootSecs2.length === 1 ? (shootSecs2[0].trip || shootSecs2[0].shoot_code) : null;

    // Contract crew labor/gear from the FreePro crew grid (no signed contract required)
    const crew = await sql`
      SELECT ca.*, p2.name as position_name, COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) as crew_name
      FROM crew_assignments ca
      JOIN positions p2 ON p2.id = ca.position_id
      LEFT JOIN crew_members cm ON cm.id = ca.crew_member_id
      WHERE ca.project_id = ${pid} AND ca.is_contractor = TRUE`;
    for (const c of crew) {
      const who = c.crew_name || 'Unassigned';
      const labor = Number(c.day_rate || 0) * Number(c.labor_days || 0);
      const gear = Number(c.gear_cost || 0) * Number(c.gear_days || 0);
      if (labor > 0) upserts.push({ source: `crewlabor:${c.id}`, description: `Hold - ${who} - ${c.position_name} Labor`, category: '5400 Logistics Labor (B)', amount: labor, status: 'HOLD', vendor: who, entry_date: null });
      if (gear > 0) upserts.push({ source: `crewgear:${c.id}`, description: `Hold - ${who} - ${c.position_name} Gear`, category: '5270 Studio Gear, Equipment Rental (B)', amount: gear, status: 'HOLD', vendor: who, entry_date: null });
    }
    // retire legacy contract-sourced holds so the crew-grid holds don't double count
    await sql`DELETE FROM vcc_entries WHERE project_id = ${pid} AND source LIKE 'contract:%'`;

    const flights = await sql`SELECT * FROM flights WHERE project_id = ${pid} AND cost IS NOT NULL AND cost > 0`;
    for (const f of flights) {
      upserts.push({ source: `flight:${f.id}`, description: `Airfare — ${f.crew_name || f.passenger_name} (${f.origin}→${f.destination})`, category: '5900 Airfare (B)', amount: Number(f.cost), status: 'HOLD', vendor: f.airline || null, entry_date: f.depart_time ? new Date(f.depart_time).toISOString().slice(0, 10) : null });
    }
    const guests = await sql`
      SELECT hg.*, hb.name as hotel_name, hb.project_id FROM hotel_guests hg
      JOIN hotel_blocks hb ON hb.id = hg.hotel_block_id
      WHERE hb.project_id = ${pid} AND hg.cost IS NOT NULL AND hg.cost > 0`;
    for (const g of guests) {
      upserts.push({ source: `hotelguest:${g.id}`, description: `Hotel — ${g.guest_name} @ ${g.hotel_name}`, category: '5180 Hotel Payments (B)', amount: Number(g.cost), status: 'HOLD', vendor: g.hotel_name, entry_date: g.check_in ? new Date(g.check_in).toISOString().slice(0, 10) : null });
    }
    const cars = await sql`SELECT * FROM rental_cars WHERE project_id = ${pid} AND cost IS NOT NULL AND cost > 0`;
    for (const d of cars) {
      upserts.push({ source: `rentalcar:${d.id}`, description: `Rental car${d.pickup_location ? ` — ${d.pickup_location}` : ''}`, category: '5255 Staff Travel Expenses (B)', amount: Number(d.cost), status: 'HOLD', vendor: d.vendor || null, entry_date: d.pickup_date ? new Date(d.pickup_date).toISOString().slice(0, 10) : null });
    }
    const rentals = await sql`SELECT * FROM online_rentals WHERE project_id = ${pid} AND cost IS NOT NULL AND cost > 0`;
    for (const r2 of rentals) {
      upserts.push({ source: `rental:${r2.id}`, description: `Online gear rental${r2.renter_name ? ` — ${r2.renter_name}` : ''}`, category: '5270 Studio Gear, Equipment Rental (B)', amount: Number(r2.cost), status: 'HOLD', vendor: r2.renter_name || null, entry_date: null });
    }

    let created = 0, updated = 0;
    for (const u of upserts) {
      const trip = u.trip || defaultTrip;
      const [existing] = await sql`SELECT id, amount, trip FROM vcc_entries WHERE project_id = ${pid} AND source = ${u.source}`;
      if (existing) {
        if (Number(existing.amount) !== u.amount || (!existing.trip && trip)) {
          await sql`UPDATE vcc_entries SET amount = ${u.amount}, description = ${u.description}, trip = COALESCE(trip, ${trip}) WHERE id = ${existing.id}`;
          updated++;
        }
      } else {
        await sql`INSERT INTO vcc_entries (project_id, entry_date, vendor, description, category, trip, amount, status, source)
          VALUES (${pid}, ${u.entry_date}, ${u.vendor}, ${u.description}, ${u.category}, ${trip}, ${u.amount}, ${u.status}, ${u.source})`;
        created++;
      }
    }
    const vcc = await sql`SELECT * FROM vcc_entries WHERE project_id = ${pid} ORDER BY trip NULLS LAST, entry_date NULLS LAST, created_at`;
    return { created, updated, vcc };
}

router.post('/finance/:pid/sync-freepro', ...finance, async (req, res, next) => {
  try { res.json(await syncFreeProCosts(req.params.pid)); } catch (e) { next(e); }
});

// ── ODC report import: parse spreadsheet, dedupe, AI-guess coding, flag anomalies
router.post('/finance/:pid/odc-import', ...finance, async (req, res, next) => {
  try {
    const pid = req.params.pid;
    const XLSX = require('xlsx');
    const buf = Buffer.from(String(req.body.fileBase64 || ''), 'base64');
    if (!buf.length) return res.status(400).json({ error: 'No file received' });
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });

    // Find a sheet + header row with recognizable columns
    let rows = [];
    for (const name of wb.SheetNames) {
      const grid = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null });
      let headerIdx = -1, map = {};
      for (let i = 0; i < Math.min(grid.length, 30); i++) {
        const cells = (grid[i] || []).map(c => String(c ?? '').toLowerCase().trim());
        const m = {};
        // Priority pass: exact accounting-report headers (Program ODC Report etc.)
        cells.forEach((c, j) => {
          if (!c) return;
          if (m.account === undefined && c === 'account') m.account = j;
          if (m.acctName === undefined && /account name/.test(c)) m.acctName = j;
          if (m.vendor === undefined && /purchased by/.test(c)) m.vendor = j;
          if (m.desc === undefined && /vendor description/.test(c)) m.desc = j;
          if (m.amount === undefined && /reimbursable/.test(c)) m.amount = j;
        });
        // Generic fallback pass — never reuse a column already claimed
        const taken = () => new Set(Object.values(m));
        cells.forEach((c, j) => {
          if (!c || taken().has(j)) return;
          if (m.date === undefined && /(^|\s)date/.test(c)) m.date = j;
          if (m.vendor === undefined && /(vendor|payee|merchant|supplier|employee|name)/.test(c)) m.vendor = j;
          if (m.desc === undefined && /(desc|memo|detail|expense item|transaction)/.test(c)) m.desc = j;
          if (m.amount === undefined && /(amount|total|cost|charge)/.test(c)) m.amount = j;
        });
        if (m.amount !== undefined && (m.desc !== undefined || m.vendor !== undefined)) { headerIdx = i; map = m; break; }
      }
      if (headerIdx === -1) continue;
      for (let i = headerIdx + 1; i < grid.length; i++) {
        const r2 = grid[i] || [];
        // Rows with a value in the Account column (TOTALS, 5210, …) are subtotals — skip
        if (map.account !== undefined && String(r2[map.account] ?? '').trim()) continue;
        const amount = Number(String(r2[map.amount] ?? '').toString().replace(/[$,()]/g, m => m === '(' ? '-' : m === ')' ? '' : ''));
        if (!amount || isNaN(amount)) continue;
        let date = r2[map.date];
        if (date instanceof Date) date = date.toISOString().slice(0, 10);
        else if (date != null) { const d2 = new Date(date); date = isNaN(d2) ? null : d2.toISOString().slice(0, 10); }
        const acctName = map.acctName !== undefined ? String(r2[map.acctName] ?? '').trim() || null : null;
        rows.push({ date: date || null, vendor: map.vendor !== undefined ? String(r2[map.vendor] ?? '').trim() || null : null, description: map.desc !== undefined ? String(r2[map.desc] ?? '').trim() || null : null, amount, acctName });
      }
      if (rows.length) break;
    }
    if (!rows.length) return res.status(400).json({ error: 'Could not find charge rows in that file — expected columns like Date / Vendor / Description / Amount.' });

    // Dedupe against existing entries (amount within a cent + same date, or amount + same vendor)
    const existing = await sql`SELECT entry_date, vendor, amount FROM vcc_entries WHERE project_id = ${pid}`;
    const isDup = r2 => existing.some(e =>
      Math.abs(Number(e.amount) - r2.amount) < 0.01 &&
      ((e.entry_date && r2.date && e.entry_date === r2.date) ||
       (e.vendor && r2.vendor && e.vendor.toLowerCase() === r2.vendor.toLowerCase())));
    const fresh = rows.filter(r2 => !isDup(r2));
    const skipped = rows.length - fresh.length;

    // Project context for coding
    const [project] = await sql`SELECT code, title, start_date, end_date FROM projects WHERE id = ${pid}`;
    const trips = [...new Set((await sql`SELECT DISTINCT trip FROM vcc_entries WHERE project_id = ${pid} AND trip IS NOT NULL`).map(x => x.trip))];
    const shootSections = await sql`
      SELECT bs.title, bs.subtitle FROM budget_sections bs JOIN budgets b ON b.id = bs.budget_id
      WHERE b.project_id = ${pid} AND bs.kind = 'shoot'`;
    const travelers = await sql`
      SELECT DISTINCT passenger_name, depart_time FROM flights WHERE project_id = ${pid}`;
    const history = await sql`
      SELECT vendor, description, category, trip FROM vcc_entries
      WHERE category IS NOT NULL ORDER BY created_at DESC LIMIT 300`;

    const catFromAcct = name => {
      if (!name) return null;
      const n = name.toLowerCase();
      return VCC_CATEGORIES.find(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase().replace(/^\d+\s*/, ''))) || null;
    };
    let guesses = fresh.map(r2 => ({ category: catFromAcct(r2.acctName), trip: null, flag: null }));
    let aiUsed = false;
    if (process.env.ANTHROPIC_API_KEY && fresh.length) {
      try {
        const prompt = `You are coding production-expense charges into a Vendor Cost Control ledger for a video production company.

Project: ${project.code} ${project.title}, dates ${project.start_date} to ${project.end_date}.
Valid categories: ${JSON.stringify(VCC_CATEGORIES)}
Known trips/shoots for this project: ${JSON.stringify(trips)} plus shoot blocks: ${JSON.stringify(shootSections)}
People who traveled on this project (with departure dates): ${JSON.stringify(travelers.map(t => ({ name: t.passenger_name, date: t.depart_time })))}
Historical coding examples (vendor/description -> category, trip): ${JSON.stringify(history.slice(0, 120))}

Charges to code (index, date, vendor, description, amount): ${JSON.stringify(fresh.map((r2, i) => ({ i, ...r2 })))}

For each charge return: category (from the valid list, or null if unsure), trip (short label matching known trips/shoots if determinable, else null), and flag (null, or a short human explanation if suspicious: traveler not on this project, date outside all shoot/travel windows, looks like it belongs to a different project, or possible duplicate).
Respond with ONLY a JSON array, one object per charge in order: [{"i":0,"category":"...","trip":"...","flag":null}, ...]`;
        const r3 = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
        });
        const out = await r3.json();
        const text = out?.content?.[0]?.text || '';
        const jsonStr = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
        const parsed = JSON.parse(jsonStr);
        for (const g of parsed) {
          if (g && typeof g.i === 'number' && guesses[g.i]) {
            guesses[g.i] = {
              category: VCC_CATEGORIES.includes(g.category) ? g.category : guesses[g.i].category,
              trip: g.trip || null,
              flag: g.flag || null,
            };
          }
        }
        aiUsed = true;
      } catch (err) {
        console.error('ODC AI coding failed, falling back to history match:', err.message);
      }
    }
    if (!aiUsed) {
      // deterministic fallback: exact vendor history match
      for (let i = 0; i < fresh.length; i++) {
        const v = (fresh[i].vendor || '').toLowerCase();
        const hit = v && history.find(h => (h.vendor || '').toLowerCase() === v);
        if (hit) guesses[i] = { category: guesses[i].category || hit.category, trip: hit.trip, flag: null };
      }
    }

    const inserted = [];
    for (let i = 0; i < fresh.length; i++) {
      const r2 = fresh[i], g = guesses[i];
      const [e] = await sql`INSERT INTO vcc_entries (project_id, entry_date, vendor, description, category, trip, amount, status, source, review, flag)
        VALUES (${pid}, ${r2.date}, ${r2.vendor}, ${r2.description || r2.vendor || 'Imported charge'}, ${g.category}, ${g.trip}, ${r2.amount}, 'POSTED', 'odc-import', TRUE, ${g.flag})
        RETURNING *`;
      inserted.push(e);
    }
    const vcc = await sql`SELECT * FROM vcc_entries WHERE project_id = ${pid} ORDER BY trip NULLS LAST, entry_date NULLS LAST, created_at`;
    res.json({ imported: inserted.length, skipped, aiUsed, vcc });
  } catch (e) { next(e); }
});

const TRAVEL_CATEGORIES = ['5900 Airfare (B)', '5180 Hotel Payments (B)', '5410 Per Diem (B)', '5255 Staff Travel Expenses (B)'];

async function shootTravelContext(sid) {
  const [sec] = await sql`SELECT bs.*, b.project_id FROM budget_sections bs JOIN budgets b ON b.id = bs.budget_id WHERE bs.id = ${sid}`;
  if (!sec) return {};
  const lines = await sql`SELECT * FROM budget_lines WHERE section_id = ${sid} AND is_travel = TRUE`;
  const budgetTravel = lines.reduce((s2, l) => s2 + Number(l.qty || 0) * Number(l.unit_cost || 0), 0);
  return { sec, lines, budgetTravel };
}

// Push the section's budgeted travel to the VCC as a single Travel Hold
router.post('/finance/sections/:sid/push-travel-hold', ...finance, async (req, res, next) => {
  try {
    const { sec, budgetTravel } = await shootTravelContext(req.params.sid);
    if (!sec) return res.status(404).json({ error: 'Section not found' });
    if (!sec.shoot_code) return res.status(400).json({ error: 'This section has no shoot code' });
    const source = `travelhold:${sec.id}`;
    const desc = `${sec.shoot_code} - Travel Hold`;
    const trip = sec.trip || sec.shoot_code;
    const [existing] = await sql`SELECT id FROM vcc_entries WHERE source = ${source}`;
    if (existing) {
      await sql`UPDATE vcc_entries SET amount = ${budgetTravel}, description = ${desc}, trip = ${trip} WHERE id = ${existing.id}`;
    } else {
      await sql`INSERT INTO vcc_entries (project_id, description, category, trip, amount, status, source)
        VALUES (${sec.project_id}, ${desc}, '5255 Staff Travel Expenses (B)', ${trip}, ${budgetTravel}, 'HOLD', ${source})`;
    }
    const vcc = await sql`SELECT * FROM vcc_entries WHERE project_id = ${sec.project_id} ORDER BY trip NULLS LAST, entry_date NULLS LAST, created_at`;
    res.json({ ok: true, amount: budgetTravel, vcc });
  } catch (e) { next(e); }
});

// Pull VCC travel actuals for this shoot back into the budget's travel lines
router.post('/finance/sections/:sid/pull-travel-actuals', ...finance, async (req, res, next) => {
  try {
    const { sec, lines } = await shootTravelContext(req.params.sid);
    if (!sec) return res.status(404).json({ error: 'Section not found' });
    const trips = [sec.trip, sec.shoot_code].filter(Boolean);
    if (!trips.length) return res.status(400).json({ error: 'Set a trip descriptor or shoot code first' });
    const entries = await sql`
      SELECT category, SUM(amount) as total FROM vcc_entries
      WHERE project_id = ${sec.project_id} AND trip = ANY(${trips})
        AND category = ANY(${TRAVEL_CATEGORIES}) AND source NOT LIKE 'travelhold:%'
      GROUP BY category`;
    const byCat = Object.fromEntries(entries.map(e => [e.category, Number(e.total)]));
    const stamp = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
    const MAP = [
      ['5900 Airfare (B)', /airfare/i],
      ['5180 Hotel Payments (B)', /hotel/i],
      ['5410 Per Diem (B)', /per diem/i],
      ['5255 Staff Travel Expenses (B)', /transportation|t&e/i],
    ];
    const updated = [];
    for (const [cat, rx] of MAP) {
      if (byCat[cat] == null) continue;
      const line = lines.find(l => rx.test(l.scope || ''));
      if (!line) continue;
      const total = Math.round(byCat[cat] * 100) / 100;
      const baseNotes = String(line.notes || '').replace(/\s*—? ?Actuals from VCC.*$/i, '');
      await sql`UPDATE budget_lines SET qty = 1, unit_cost = ${total}, notes = ${baseNotes + ` — Actuals from VCC ${stamp}`} WHERE id = ${line.id}`;
      updated.push({ scope: line.scope, total });
    }
    // the actuals are in the VCC now, so retire this shoot's travel hold
    await sql`DELETE FROM vcc_entries WHERE source = ${'travelhold:' + sec.id}`;
    res.json({ ok: true, updated });
  } catch (e) { next(e); }
});

// ── Harbinger: internal kickoff form that opens the project with accounting ──
const { sendMail, isConfigured: mailReady } = require('../lib/mailer');
const { automation } = require('../lib/automations');
const { harbingerHtml, noticeHtml } = require('../lib/emailTemplates');

router.get('/finance/:pid/harbinger', ...finance, async (req, res, next) => {
  try {
    const [h] = await sql`SELECT * FROM harbingers WHERE project_id = ${req.params.pid}`;
    if (!h) return res.status(404).json({ error: 'No harbinger yet' });
    res.json(h);
  } catch (e) { next(e); }
});

router.post('/finance/:pid/harbinger', ...finance, async (req, res, next) => {
  try {
    const pid = req.params.pid;
    const d = req.body || {};
    const [budget] = await sql`SELECT * FROM budgets WHERE project_id = ${pid} AND COALESCE(kind, 'main') = 'main'`;
    if (!budget) return res.status(400).json({ error: 'No budget for this project' });
    const [project] = await sql`SELECT code, title, client FROM projects WHERE id = ${pid}`;
    const [existing] = await sql`SELECT id FROM harbingers WHERE budget_id = ${budget.id}`;
    let row;
    if (existing) {
      [row] = await sql`UPDATE harbingers SET data = ${d}, submitted_by = ${req.user?.email || null} WHERE id = ${existing.id} RETURNING *`;
    } else {
      [row] = await sql`INSERT INTO harbingers (budget_id, project_id, data, submitted_by)
        VALUES (${budget.id}, ${pid}, ${d}, ${req.user?.email || null}) RETURNING *`;
    }
    // Moving to Live is what the harbinger announces
    await sql`UPDATE budgets SET status = 'Live' WHERE id = ${budget.id}`;
    await ensureShootProjects(budget.id).catch(e2 => console.error('Shoot tiles on harbinger failed:', e2.message));

    // Save the client's contact info to the roster for future reuse (idempotent upsert)
    try {
      const cname = String(d.clientCompany || project.client || '').trim();
      if (cname) {
        let [c] = await sql`SELECT id FROM clients WHERE LOWER(name) = LOWER(${cname})`;
        if (!c) [c] = await sql`INSERT INTO clients (name, created_by) VALUES (${cname}, ${req.user?.email || null}) RETURNING id`;
        await sql`UPDATE clients SET
          primary_contact_name  = COALESCE(NULLIF(${d.primaryContactName || ''}, ''), primary_contact_name),
          primary_contact_email = COALESCE(NULLIF(${d.primaryContactEmail || ''}, ''), primary_contact_email),
          mailing_address       = COALESCE(NULLIF(${d.mailingAddress || ''}, ''), mailing_address),
          contacts_note         = COALESCE(NULLIF(${d.clientContacts || ''}, ''), contacts_note)
          WHERE id = ${c.id}`;
      }
    } catch (e2) { console.error('Client contact save failed:', e2.message); }

    const harbCfg = await automation('harbinger');
    const to = harbCfg?.to || process.env.HARBINGER_EMAIL;
    if (to) {
      const line = (label, v) => `${label}: ${v || '—'}`;
      const text = [
        `Harbinger — ${project.code} ${project.title} (${project.client})`,
        `Submitted by: ${d.email || req.user?.email || 'unknown'}`,
        '',
        line('Client Company', d.clientCompany), line('Project Name', d.projectName),
        line('Proposed Code', d.proposedCode), line('Existing Solutions/Client Code', d.solutionsCode),
        '', 'SOW & Project Description:', d.sow || '—', '', 'Budget Summary / Breakdown:', d.budgetSummary || '—',
        '', 'Client Contacts:', d.clientContacts || '—',
        line('Contract/MSA already signed', d.contractSigned ? 'Yes' : 'No'),
        line('Primary Client Contact', d.primaryContactName), line('Primary Contact Email', d.primaryContactEmail),
        line('Client Mailing Address', d.mailingAddress), line('Contract/Invoice CC', d.invoiceCc),
        line('Media Revenue', d.mediaRevenue), line('Capture Co Revenue', d.capcoRevenue),
        line('Media Commission Owner(s)', d.mediaCommissionOwners), line('Budget Owner', d.budgetOwner),
        line('Media Commission % Breakdown', d.mediaCommissionPct),
        line('Solutions Commission Owner(s)', d.solutionsCommissionOwners),
        line('No Commissions', d.noCommissions ? 'Yes' : 'No'), line('% for Solutions Commission(s)', d.solutionsCommissionPct),
        line('Link to Budget', d.budgetLink), line('Creative Direction Notes', d.creativeNotes),
        line('Video References', d.videoReferences), line('Client Kickoff Call Date', d.kickoffDate),
        line('Preferred PM(s)', d.preferredPm), line('Preferred Producer(s)/Director(s)', d.preferredProducer),
        '', 'Budgeted Positions:', d.budgetedPositions || '—',
        line('Shooting Location(s)', d.shootingLocations), '', 'Gear Scope/Summary:', d.gearScope || '—',
        line('Production and Travel Dates', d.productionDates),
        line('Preferred Crew', d.preferredCrew), line('Crew Preference Notes', d.crewNotes),
        line('Preferred Editor(s)', d.preferredEditors), line('Pro Colorist Needed', d.proColorist),
        line('Pro Audio Engineer Needed', d.proAudio),
        line('Estimated Final Delivery', d.finalDelivery), line('Estimated Close Month', d.closeMonth),
        '', 'Notes:', d.notes || '—',
      ].join('\n');
      const ccList = [harbCfg?.cc, d.email || req.user?.email].filter(Boolean).join(', ');
      sendMail({
        identity: 'info', fromAddr: harbCfg?.from || undefined,
        to, cc: ccList || undefined,
        subject: `HARBINGER ALERT: [${project.code}: ${project.title}]`,
        text,
        html: harbingerHtml({ project, d, appUrl: (process.env.FRONTEND_URL || 'https://freepro-production.up.railway.app') + '/finance/' + project.id }),
      }).catch(err => console.error('Harbinger email failed:', err.message));
    }
    res.status(201).json(row);
  } catch (e) { next(e); }
});

// AI synopsis of the budget allocations for the Harbinger SOW field. Builds a
// per-section allocation breakdown from the budget and asks Claude to write a
// concise scope-of-work paragraph. Falls back to a plain breakdown with no key.
router.post('/finance/:pid/harbinger-sow', ...finance, async (req, res, next) => {
  try {
    const pid = req.params.pid;
    const [project] = await sql`SELECT code, title, client FROM projects WHERE id = ${pid}`;
    const [budget] = await sql`SELECT * FROM budgets WHERE project_id = ${pid} AND COALESCE(kind, 'main') = 'main'`;
    if (!budget) return res.status(400).json({ error: 'No budget for this project' });
    const sections = await sql`SELECT * FROM budget_sections WHERE budget_id = ${budget.id} ORDER BY sort`;
    const lines = await sql`SELECT * FROM budget_lines WHERE budget_id = ${budget.id}`;
    const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

    // Per-section allocation: flat lines are qty×unit; percent lines apply to the
    // section's flat subtotal. Good enough to characterize where the money goes.
    const breakdown = [];
    let grand = 0;
    for (const s of sections) {
      const secLines = lines.filter(l => l.section_id === s.id);
      const flat = secLines.filter(l => l.percent == null)
        .reduce((sum, l) => sum + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);
      const pct = secLines.filter(l => l.percent != null)
        .reduce((sum, l) => sum + flat * (Number(l.percent) || 0), 0);
      const cost = flat + pct;
      if (cost <= 0) continue;
      grand += cost;
      const items = secLines.filter(l => l.percent == null && (Number(l.qty) || 0) > 0 && l.scope)
        .map(l => l.scope);
      breakdown.push({ section: s.title || s.kind, kind: s.kind, cost, items });
    }

    const fallback = () => breakdown
      .map(b => `${b.section} — ${money(b.cost)}` + (b.items.length ? `\n- ${b.items.join('\n- ')}` : ''))
      .join('\n\n') + `\n\nTotal — ${money(grand)}`;

    let sow = fallback();
    if (process.env.ANTHROPIC_API_KEY && breakdown.length) {
      try {
        const prompt = `You are writing the Scope of Work / Project Description for an internal project-initiation form ("Harbinger") at a video production company.

Project: ${project.title} (${project.code}) for client ${project.client}.
Budget allocations by section (dollar amounts show where the budget is concentrated):
${breakdown.map(b => `- ${b.section} (${b.kind}): ${money(b.cost)}${b.items.length ? ` — includes: ${b.items.join(', ')}` : ''}`).join('\n')}
Total budget: ${money(grand)}.

Write a concise, professional synopsis (2-4 short paragraphs or a tight bulleted summary) describing the scope of work implied by these allocations: what will be produced, the production/crew footprint, and where the budget is focused. Do NOT restate every dollar figure line-by-line; instead characterize the work. Return ONLY the synopsis text, no preamble.`;
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
        });
        const out = await r.json();
        const text = (out?.content?.[0]?.text || '').trim();
        if (text) sow = text;
      } catch (err) {
        console.error('Harbinger SOW AI failed, using breakdown fallback:', err.message);
      }
    }
    res.json({ sow, total: money(grand) });
  } catch (e) { next(e); }
});

// Generate (or fetch) the client share token for a budget
router.post('/finance/budget/:bid/share', ...finance, async (req, res, next) => {
  try {
    const [b] = await sql`UPDATE budgets SET share_token = COALESCE(share_token, gen_random_uuid()::text) WHERE id = ${req.params.bid} RETURNING share_token`;
    if (!b) return res.status(404).json({ error: 'Budget not found' });
    res.json({ token: b.share_token });
  } catch (e) { next(e); }
});

// Public: client-facing budget estimate (sanitized — no costs ledger, no profit data)
router.get('/budget-share/:token', async (req, res, next) => {
  try {
    const [budget] = await sql`SELECT id, project_id, budget_date, media_rep, solutions_code, mgmt_fee_rate, status, share_mode FROM budgets WHERE share_token = ${req.params.token}`;
    if (!budget) return res.status(404).json({ error: 'Budget not found' });
    const [project] = await sql`SELECT code, title, client FROM projects WHERE id = ${budget.project_id}`;
    const sections = await sql`SELECT id, title, subtitle, kind, sort FROM budget_sections WHERE budget_id = ${budget.id} ORDER BY sort`;
    const lines = await sql`SELECT id, section_id, scope, notes, qty, unit_cost, percent, is_travel, sort FROM budget_lines WHERE budget_id = ${budget.id} ORDER BY sort`;
    res.json({ project, budget: { budget_date: budget.budget_date, media_rep: budget.media_rep, solutions_code: budget.solutions_code, mgmt_fee_rate: budget.mgmt_fee_rate, share_mode: budget.share_mode || 'lines' }, sections, lines });
  } catch (e) { next(e); }
});

// Weekly finance report: snapshot current state, diff against the previous snapshot
router.post('/finance/weekly-report', ...finance, async (req, res, next) => {
  try {
    const projects = await sql`
      SELECT p.id, p.code, p.title, p.client, p.status as project_status, b.id as budget_id, b.status as budget_status,
             b.mgmt_fee_rate, b.media_rep, b.close_month
      FROM projects p LEFT JOIN budgets b ON b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main'
      WHERE p.parent_project_id IS NULL
      ORDER BY p.code`;
    const lines = await sql`SELECT budget_id, qty, unit_cost, percent, is_travel, section_id FROM budget_lines`;
    const current = projects.filter(p => (p.budget_status || '') !== 'RFP').map(p => {
      const { total, fee } = budgetTotal(lines.filter(l => l.budget_id === p.budget_id), Number(p.mgmt_fee_rate ?? 0.15));
      return {
        project_id: p.id, code: p.code, title: p.title, client: p.client,
        media_rep: p.media_rep || null, budget_status: p.budget_status || (p.budget_id ? 'Draft' : 'No budget'),
        budget_total: Math.round(total * 100) / 100, fee: Math.round(fee * 100) / 100,
        close_month: p.close_month || null, project_status: p.project_status,
      };
    });

    const [latest] = await sql`SELECT batch_id, created_at FROM finance_snapshots ORDER BY created_at DESC LIMIT 1`;
    let prev = [];
    if (latest) prev = await sql`SELECT * FROM finance_snapshots WHERE batch_id = ${latest.batch_id}`;
    const prevMap = Object.fromEntries(prev.map(x => [x.project_id, x]));

    const added = [], changed = [], closed = [];
    const DEAD = ['Dead', 'Reconcile', 'Reconciled', 'Closed'];
    for (const c of current) {
      const p = prevMap[c.project_id];
      if (!p) { added.push(c); continue; }
      const diffs = [];
      if (Math.abs(Number(p.budget_total || 0) - c.budget_total) >= 0.01) diffs.push({ field: 'Budget', from: Number(p.budget_total || 0), to: c.budget_total, money: true });
      if (Math.abs(Number(p.fee || 0) - c.fee) >= 0.01) diffs.push({ field: 'Fee', from: Number(p.fee || 0), to: c.fee, money: true });
      if ((p.budget_status || '') !== (c.budget_status || '')) diffs.push({ field: 'Status', from: p.budget_status || '—', to: c.budget_status || '—' });
      if ((p.close_month || '') !== (c.close_month || '')) diffs.push({ field: 'Close Month', from: p.close_month || '—', to: c.close_month || '—' });
      const nowClosed = DEAD.includes(c.budget_status) || c.project_status === 'ARCHIVED';
      const wasClosed = DEAD.includes(p.budget_status || '');
      if (nowClosed && !wasClosed) closed.push({ ...c, reason: c.budget_status === 'Dead' ? 'Budget marked Dead' : ['Reconcile', 'Reconciled'].includes(c.budget_status) ? 'Reconciled' : 'Project archived' });
      else if (diffs.length) changed.push({ ...c, diffs });
    }
    const removedIds = prev.filter(x => !current.some(c => c.project_id === x.project_id));

    const batchId = require('crypto').randomUUID();
    for (const c of current) {
      await sql`INSERT INTO finance_snapshots (batch_id, project_id, code, title, media_rep, budget_status, budget_total, fee, close_month)
        VALUES (${batchId}, ${c.project_id}, ${c.code}, ${c.title}, ${c.media_rep}, ${c.budget_status}, ${c.budget_total}, ${c.fee}, ${c.close_month})`;
    }
    res.json({
      generatedAt: new Date().toISOString(),
      previousAt: latest ? latest.created_at : null,
      firstReport: !latest,
      added, changed, closed,
      removed: removedIds.map(x => ({ code: x.code, title: x.title })),
      current,
    });
  } catch (e) { next(e); }
});

// Project pipeline stage overrides (JSON map of stage -> 'active' | 'done')
router.patch('/finance/pipeline/:pid', ...finance, async (req, res, next) => {
  try {
    const pipeline = JSON.stringify(req.body.pipeline || {});
    const [p] = await sql`UPDATE projects SET pipeline = ${pipeline} WHERE id = ${req.params.pid} RETURNING id, pipeline`;
    if (!p) return res.status(404).json({ error: 'Project not found' });
    res.json(p);
  } catch (e) { next(e); }
});

// ── Vendor invoices: uploaded files per project ──
// Claude reads the invoice and pulls out the vendor + total (needs ANTHROPIC_API_KEY)
async function extractInvoiceFields(mime, base64) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('AI reading is not configured on the server (ANTHROPIC_API_KEY is not set)');
  const isPdf = (mime || '').includes('pdf');
  const isImg = /image\/(png|jpe?g|webp|gif)/.test(mime || '');
  if (!isPdf && !isImg) throw new Error('Only PDF and image invoices can be read automatically');
  const block = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 300,
      messages: [{ role: 'user', content: [block, { type: 'text', text: 'This is a vendor invoice. Reply with ONLY a JSON object: {"vendor": "<the vendor/company issuing the invoice>", "total": <the invoice total as a number, no currency symbol>}. Use null for anything you cannot find.' }] }],
    }),
  });
  if (!r.ok) throw new Error(`AI extract failed (${r.status})`);
  const d = await r.json();
  const text = (d.content || []).map(c => c.text || '').join('');
  const m2 = text.match(/\{[\s\S]*\}/);
  if (!m2) return null;
  const parsed = JSON.parse(m2[0]);
  return { vendor: parsed.vendor || null, total: Number.isFinite(Number(parsed.total)) ? Number(parsed.total) : null };
}

router.get('/finance/:pid/vendor-invoices', ...finance, async (req, res, next) => {
  try {
    res.json(await sql`SELECT id, filename, mime, size, note, uploaded_by, vendor_name, amount, created_at FROM vendor_invoices WHERE project_id = ${req.params.pid} ORDER BY created_at DESC`);
  } catch (e) { next(e); }
});
router.post('/finance/:pid/vendor-invoices', ...finance, async (req, res, next) => {
  try {
    const { filename, mime, fileBase64, note } = req.body;
    if (!filename || !fileBase64) return res.status(400).json({ error: 'filename and file required' });
    const buf = Buffer.from(fileBase64, 'base64');
    if (buf.length > 20 * 1024 * 1024) return res.status(413).json({ error: 'File too large (20MB max)' });
    let [row] = await sql`
      INSERT INTO vendor_invoices (project_id, filename, mime, size, data, note, uploaded_by)
      VALUES (${req.params.pid}, ${filename}, ${mime || null}, ${buf.length}, ${buf}, ${note || null}, ${req.user?.email || null})
      RETURNING id, filename, mime, size, note, uploaded_by, vendor_name, amount, created_at`;
    try {
      const ai = await extractInvoiceFields(mime, fileBase64);
      if (ai && (ai.vendor || ai.total != null)) {
        [row] = await sql`UPDATE vendor_invoices SET vendor_name = ${ai.vendor}, amount = ${ai.total}
          WHERE id = ${row.id} RETURNING id, filename, mime, size, note, uploaded_by, vendor_name, amount, created_at`;
      }
    } catch (e2) { console.error('Invoice AI extract failed:', e2.message); }
    res.status(201).json(row);
  } catch (e) { next(e); }
});
// Re-run the AI read on a stored invoice (upload-time extraction failed or was skipped)
router.post('/finance/vendor-invoices/:id/extract', ...finance, async (req, res, next) => {
  try {
    const [f] = await sql`SELECT id, mime, data FROM vendor_invoices WHERE id = ${req.params.id}`;
    if (!f) return res.status(404).json({ error: 'Invoice not found' });
    let ai;
    try { ai = await extractInvoiceFields(f.mime, Buffer.from(f.data).toString('base64')); }
    catch (e2) { return res.status(400).json({ error: e2.message }); }
    if (!ai || (!ai.vendor && ai.total == null)) return res.status(400).json({ error: 'Could not find a vendor or total in this file' });
    const [row] = await sql`UPDATE vendor_invoices SET vendor_name = ${ai.vendor}, amount = ${ai.total}
      WHERE id = ${f.id} RETURNING id, filename, mime, size, note, uploaded_by, vendor_name, amount, created_at`;
    res.json(row);
  } catch (e) { next(e); }
});

// Cross-project invoice search: vendor, project code, and/or total amount
router.get('/finance/vendor-invoices/search', ...finance, async (req, res, next) => {
  try {
    const vendor = String(req.query.vendor || '').trim();
    const code = String(req.query.code || '').trim();
    const amount = req.query.amount !== undefined && req.query.amount !== '' ? Number(req.query.amount) : null;
    const rows = await sql`
      SELECT vi.id, vi.filename, vi.mime, vi.size, vi.vendor_name, vi.amount, vi.uploaded_by, vi.created_at,
             p.code, p.title, p.client
      FROM vendor_invoices vi JOIN projects p ON p.id = vi.project_id
      WHERE (${vendor} = '' OR vi.vendor_name ILIKE ${'%' + vendor + '%'} OR vi.filename ILIKE ${'%' + vendor + '%'})
        AND (${code} = '' OR p.code ILIKE ${'%' + code + '%'})
        AND (${amount}::numeric IS NULL OR ABS(COALESCE(vi.amount, 0) - ${amount}::numeric) < 0.005)
      ORDER BY vi.created_at DESC LIMIT 200`;
    res.json(rows);
  } catch (e) { next(e); }
});

router.get('/finance/vendor-invoices/:id/file', ...finance, async (req, res, next) => {
  try {
    const [f] = await sql`SELECT filename, mime, data FROM vendor_invoices WHERE id = ${req.params.id}`;
    if (!f) return res.status(404).json({ error: 'Invoice not found' });
    res.setHeader('Content-Type', f.mime || 'application/octet-stream');
    const dispo = req.query.inline ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${dispo}; filename="${f.filename.replace(/"/g, '')}"`);
    res.send(f.data);
  } catch (e) { next(e); }
});
router.delete('/finance/vendor-invoices/:id', ...finance, async (req, res, next) => {
  try {
    await sql`DELETE FROM vendor_invoices WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Budget visibility tags ──
router.get('/finance/budgets/:bid/tags', ...finance, async (req, res, next) => {
  try {
    const [b] = await sql`SELECT media_rep FROM budgets WHERE id = ${req.params.bid}`;
    if (b?.media_rep) await autoTagOwner(req.params.bid, b.media_rep).catch(() => {});
    res.json(await sql`SELECT t.user_id, u.name FROM budget_tags t JOIN users u ON u.id = t.user_id WHERE t.budget_id = ${req.params.bid} ORDER BY u.name`);
  } catch (e) { next(e); }
});
router.post('/finance/budgets/:bid/tags', ...finance, async (req, res, next) => {
  try {
    if (req.body.userId) {
      await sql`INSERT INTO budget_tags (budget_id, user_id) VALUES (${req.params.bid}, ${req.body.userId}) ON CONFLICT DO NOTHING`;
    } else if (req.body.name) {
      // Tag by budget-owner name; resolved to a platform account (Alex ↔ Alexander tolerant)
      const before = await sql`SELECT COUNT(*)::int as c FROM budget_tags WHERE budget_id = ${req.params.bid}`;
      await autoTagOwner(req.params.bid, req.body.name);
      const after = await sql`SELECT COUNT(*)::int as c FROM budget_tags WHERE budget_id = ${req.params.bid}`;
      if (after[0].c === before[0].c) {
        const dup = await sql`SELECT 1 FROM budget_tags t JOIN users u ON u.id = t.user_id WHERE t.budget_id = ${req.params.bid}`;
        // distinguish "already tagged" (fine) from "no account" only loosely — report if truly unmatched
        const users = await sql`SELECT name FROM users WHERE role IN ('ADMIN', 'PRODUCER')`;
        const parts = String(req.body.name).trim().toLowerCase().split(/\s+/);
        const matched = users.some(u => {
          const w = (u.name || '').trim().toLowerCase().split(/\s+/);
          const firstOk = w[0] === parts[0] || w[0]?.startsWith(parts[0]) || parts[0]?.startsWith(w[0] || '');
          const last = parts.length > 1 ? parts[parts.length - 1] : '';
          const ul = w.length > 1 ? w[w.length - 1] : '';
          return w.join(' ') === parts.join(' ') || (firstOk && (last && ul ? ul === last : w[0] === parts[0]));
        });
        if (!matched) return res.status(404).json({ error: `${req.body.name} doesn't have a platform account yet — they need one to be tagged.` });
      }
    } else {
      return res.status(400).json({ error: 'userId or name required' });
    }
    res.json(await sql`SELECT t.user_id, u.name FROM budget_tags t JOIN users u ON u.id = t.user_id WHERE t.budget_id = ${req.params.bid} ORDER BY u.name`);
  } catch (e) { next(e); }
});
router.delete('/finance/budgets/:bid/tags/:uid', ...finance, async (req, res, next) => {
  try {
    await sql`DELETE FROM budget_tags WHERE budget_id = ${req.params.bid} AND user_id = ${req.params.uid}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
