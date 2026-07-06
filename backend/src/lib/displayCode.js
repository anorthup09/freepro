const sql = require('./db');

// FreePro views show the ProFi shoot code (e.g. 02.TEST00126-01) as the
// project code. A project tied to exactly one production block displays that
// block's code; multi-shoot parents keep their base code (ambiguous), and
// child shoot projects already carry their shoot code as their real code.
async function displayCodes(projectIds) {
  const ids = [...new Set(projectIds)].filter(Boolean);
  if (!ids.length) return {};
  const rows = await sql`
    SELECT b.project_id, s.shoot_code
    FROM budget_sections s
    JOIN budgets b ON b.id = s.budget_id AND COALESCE(b.kind, 'main') = 'main'
    WHERE s.kind = 'shoot' AND s.shoot_code IS NOT NULL AND b.project_id = ANY(${ids})
    ORDER BY s.sort`;
  const byProject = {};
  for (const r of rows) (byProject[r.project_id] ||= []).push(r.shoot_code);
  const out = {};
  for (const [pid, codes] of Object.entries(byProject)) {
    if (codes.length === 1) out[pid] = codes[0];
  }
  return out;
}

async function applyDisplayCode(project) {
  if (!project) return project;
  const codes = await displayCodes([project.id]);
  if (codes[project.id]) project.code = codes[project.id];
  return project;
}

module.exports = { displayCodes, applyDisplayCode };
