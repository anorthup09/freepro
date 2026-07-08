// One-time import of the ClickUp PTO/OOO pipeline (July 2026 export).
// Idempotent: each record is skipped if a request already exists for the
// same person + dates + title. Requesters/managers are matched to the
// crew roster by name (nickname-tolerant), unmatched rows are logged.
const sql = require('./db');

const ROWS = [
  ['Ben Lamb July 4th Flex Week / Sabbatical / COMP', 'Ben Lamb', '2026-06-29', '2026-07-31', 'PTO', 'Derik Smith', '02.VON00124 & Whatever SALT Port will be'],
  ['Derik STL ONLY (Josh Summer Break)', 'Derik Smith', '2026-07-06', '2026-07-13', 'STL/DEN Only', 'Mike Walsh', null],
  ['SHAUN OOO', 'Shaun Teamer', '2026-07-06', '2026-07-08', 'PTO', 'Nate Woodard', null],
  ['Tyler - Comp', 'Tyler Castle', '2026-07-07', '2026-07-10', 'Comp', 'Derik Smith', 'Amazon Cannes'],
  ['Anna OOO', 'Anna Parnigoni', '2026-07-09', '2026-07-15', 'Other OOO', null, null],
  ['Joey STL Only', 'Joey Goldman', '2026-07-09', '2026-07-09', 'STL/DEN Only', 'Kelly Hueseman', null],
  ['MIKE PTO', 'Mike Walsh', '2026-07-10', '2026-07-13', 'PTO', 'Mike Walsh', null],
  ['Tyler - Unavailable', 'Tyler Castle', '2026-07-11', '2026-07-12', 'PTO', 'Derik Smith', null],
  ['Mason Sabbatical', 'Mason Vitro', '2026-07-15', '2026-07-17', 'PTO', 'Derik Smith', null],
  ['JOE PTO', 'Joe Seebeck', '2026-07-18', '2026-08-16', 'PTO', 'Derik Smith', null],
  ['Mason Comp', 'Mason Vitro', '2026-07-20', '2026-07-24', 'Comp', 'Derik Smith', '02.SLT Cannes'],
  ['Joey STL ONLY', 'Joey Goldman', '2026-07-21', '2026-07-23', 'STL/DEN Only', 'Kelly Hueseman', null],
  ['Tyler - STL Only', 'Tyler Castle', '2026-07-22', '2026-07-24', 'STL/DEN Only', 'Derik Smith', null],
  ['Daniel STL Only', 'Daniel Neville', '2026-07-24', '2026-07-24', 'STL/DEN Only', 'Alex Northup', null],
  ['Joey OOO', 'Joey Goldman', '2026-07-24', '2026-07-26', 'PTO', 'Kelly Hueseman', null],
  ['Anabelle OOO', 'Anabelle Porio', '2026-07-24', '2026-07-31', 'PTO', 'Kelly Hueseman', null],
  ['Daniel STL Only', 'Daniel Neville', '2026-07-27', '2026-07-27', 'STL/DEN Only', 'Alex Northup', null],
  ['Fab Sabbatical', 'Fabrizio Alberdi', '2026-07-29', '2026-08-02', 'PTO', 'Alex Northup', null],
  ['Daniel OOO', 'Daniel Neville', '2026-07-31', '2026-08-08', 'PTO', 'Alex Northup', null],
  ['Joey STL Only', 'Joey Goldman', '2026-07-31', '2026-07-31', 'STL/DEN Only', 'Kelly Hueseman', null],
  ['Tyler - STL Only', 'Tyler Castle', '2026-08-06', '2026-08-09', 'STL/DEN Only', 'Derik Smith', null],
  ['Kelly OOO', 'Kelly Hueseman', '2026-08-06', '2026-08-14', 'PTO', 'Mike Walsh', null],
  ['Anabelle DEN Only', 'Anabelle Porio', '2026-08-07', '2026-08-08', 'PTO', 'Kelly Hueseman', null],
  ['Jon COMP', 'Jon Arneson', '2026-08-13', '2026-08-14', 'Comp', 'Derik Smith', '02.LPL06926'],
  ['Daniel STL Only', 'Daniel Neville', '2026-08-14', '2026-08-16', 'STL/DEN Only', 'Alex Northup', null],
  ['Fab PTO', 'Fabrizio Alberdi', '2026-08-17', '2026-08-21', 'PTO', 'Alex Northup', null],
  ['Anabelle DEN Only', 'Anabelle Porio', '2026-08-27', '2026-08-27', 'STL/DEN Only', 'Kelly Hueseman', null],
  ['Tyler - PTO', 'Tyler Castle', '2026-08-29', '2026-08-30', 'PTO', 'Derik Smith', null],
  ['Daniel STL Only', 'Daniel Neville', '2026-08-29', '2026-08-29', 'STL/DEN Only', 'Alex Northup', null],
  ['Tyler - PTO', 'Tyler Castle', '2026-09-04', '2026-09-08', 'PTO', 'Derik Smith', null],
  ['Joey STL Only (Rosh Hashanah)', 'Joey Goldman', '2026-09-12', '2026-09-12', 'STL/DEN Only', 'Kelly Hueseman', null],
  ['Tyler - STL Only', 'Tyler Castle', '2026-09-14', '2026-09-17', 'STL/DEN Only', 'Derik Smith', null],
  ['Anabelle OOO', 'Anabelle Porio', '2026-09-17', '2026-09-21', 'PTO', 'Kelly Hueseman', null],
  ['Joey STL Only (Yom Kippur)', 'Joey Goldman', '2026-09-21', '2026-09-21', 'STL/DEN Only', 'Kelly Hueseman', null],
  ['Daniel OOO', 'Daniel Neville', '2026-09-26', '2026-09-26', 'PTO', 'Alex Northup', null],
  ['Tyler - STL Only', 'Tyler Castle', '2026-09-30', '2026-10-01', 'STL/DEN Only', 'Derik Smith', null],
  ['Tyler - PTO', 'Tyler Castle', '2026-10-09', '2026-10-12', 'PTO', 'Mike Walsh', null],
  ['Daniel OOO', 'Daniel Neville', '2026-10-29', '2026-11-02', 'PTO', 'Alex Northup', null],
  ['Daniel OOO', 'Daniel Neville', '2026-10-30', '2026-11-01', 'PTO', 'Nate Woodard', null],
  ['Derik - OOO Georgia Trip', 'Derik Smith', '2026-11-04', '2026-11-10', 'PTO', 'Mike Walsh', null],
  ['Joey OOO', 'Joey Goldman', '2026-11-04', '2026-11-10', 'PTO', 'Kelly Hueseman', null],
  ['Tyler - PTO', 'Tyler Castle', '2026-11-19', '2026-11-23', 'PTO', 'Mike Walsh', 'Tyler - PTO'],
  ['Kelly OOO Flex Holiday Week', 'Kelly Hueseman', '2026-12-21', '2026-12-25', 'PTO', 'Mike Walsh', null],
  ['Fab Flex Week - Xmas', 'Fabrizio Alberdi', '2026-12-21', '2026-12-24', 'PTO', 'Alex Northup', null],
  ['Anabelle OOO Flex Holiday Week', 'Anabelle Porio', '2026-12-21', '2026-12-25', 'PTO', 'Kelly Hueseman', null],
  ['Joey STL Only', 'Joey Goldman', '2027-01-05', '2027-01-05', 'STL/DEN Only', 'Kelly Hueseman', null],
  ['Joey STL Only', 'Joey Goldman', '2027-03-15', '2027-03-15', 'STL/DEN Only', 'Kelly Hueseman', null],
  ['Tyler - PTO (2027)', 'Tyler Castle', '2027-04-16', '2027-04-24', 'PTO', 'Derik Smith', null],
  ['Tyler - PTO', 'Tyler Castle', '2027-08-25', '2027-08-30', 'PTO', 'Derik Smith', null],
  ['Tyler - PTO', 'Tyler Castle', '2027-10-08', '2027-10-11', 'PTO', 'Derik Smith', null],
];

const norm = s => String(s || '').trim().toLowerCase();

function matchMember(name, roster) {
  if (!name) return null;
  const [first, ...rest] = norm(name).split(/\s+/);
  const last = rest[rest.length - 1] || '';
  for (const m of roster) {
    for (const cand of [m.pref, m.plain]) {
      if (!cand) continue;
      const parts = norm(cand).split(/\s+/);
      const f = parts[0] || '', l = parts[parts.length - 1] || '';
      if (l !== last) continue;
      if (f === first || f.startsWith(first) || first.startsWith(f)) return m.id;
    }
  }
  return null;
}

async function seedPto() {
  const roster = (await sql`
    SELECT id, name as plain, NULLIF(TRIM(CONCAT(preferred_first_name, ' ', preferred_last_name)), '') as pref
    FROM crew_members WHERE company ILIKE '%unbridled%'`);
  if (!roster.length) return;
  let added = 0;
  for (const [title, who, start, end, type, mgr, comp] of ROWS) {
    const memberId = matchMember(who, roster);
    if (!memberId) { console.log(`PTO seed: no roster match for "${who}" — skipped "${title}"`); continue; }
    const managerId = matchMember(mgr, roster);
    const [existing] = await sql`
      SELECT id FROM pto_requests WHERE member_id = ${memberId} AND start_date = ${start} AND end_date = ${end} AND title = ${title}`;
    if (existing) continue;
    await sql`
      INSERT INTO pto_requests (member_id, title, pto_type, start_date, end_date, comp_notes, manager_id, status)
      VALUES (${memberId}, ${title}, ${type}, ${start}, ${end}, ${comp}, ${managerId}, 'APPROVED')`;
    added++;
  }
  if (added) console.log(`PTO seed: imported ${added} ClickUp requests.`);
}

module.exports = seedPto;
