const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const PREF = "COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name)";
const MS_LABELS = {
  scripting_start: 'Scripting Start', scripting_end: 'Creative/Scripting Complete',
  icr_v1_due: 'ICR v1 Due', icr_feedback: 'ICR Feedback',
  client_v1_due: 'Client v1 Due', client_v1_feedback: 'Client v1 Feedback',
  client_v2_due: 'Client v2 Due', client_v2_feedback: 'Client v2 Feedback',
  client_v3_due: 'Client v3 Due', client_v3_feedback: 'Client v3 Feedback',
  color_audio_send: 'Send to Color & Audio', color_audio_complete: 'Color & Audio Complete',
  final_comp: 'Final Comp Complete', final_delivery: 'Final Delivery',
};
const parseJ = v => typeof v === 'string' ? JSON.parse(v || '{}') : (v || {});

// The signed-in user's crew_members row (matched by email)
async function myCrewMember(email) {
  if (!email) return null;
  const [cm] = await sql`SELECT id, name, preferred_first_name, preferred_last_name FROM crew_members WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
  return cm || null;
}

// GET /api/dashboard/today — the user's Day in Review
router.get('/today', requireAuth, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const items = [];
    const cm = await myCrewMember(req.user.email);

    if (cm) {
      // On a shoot today
      const shoots = await sql`
        SELECT pr.id, pr.code, pr.title, pr.city, pr.state, p.name as position_name
        FROM crew_assignments ca
        JOIN positions p ON p.id = ca.position_id
        JOIN projects pr ON pr.id = ca.project_id
        WHERE ca.crew_member_id = ${cm.id} AND pr.status != 'ARCHIVED'
          AND ca.start_date::date <= ${today} AND COALESCE(ca.end_date, ca.start_date)::date >= ${today}`;
      for (const s of shoots) {
        items.push({ kind: 'shoot', title: `On shoot — ${s.code} ${s.title}`, subtitle: `${s.position_name}${s.city ? ` · ${s.city}, ${s.state}` : ''}`, link: `/projects/${s.id}` });
      }
      // PTO today
      const pto = await sql`
        SELECT title, pto_type FROM pto_requests
        WHERE member_id = ${cm.id} AND status != 'CLOSED'
          AND start_date <= ${today} AND end_date >= ${today}`;
      for (const p of pto) items.push({ kind: 'pto', title: `${p.pto_type} today`, subtitle: p.title, link: '/team' });

      // Avo edits where I'm the lead editor or PM
      const edits = await sql`
        SELECT e.id, e.title, e.project_code, e.end_date, e.start_date, e.milestones, e.milestone_assignees,
               e.lead_editor_id, e.pm_id
        FROM edits e
        WHERE e.status != 'CLOSED' AND (e.lead_editor_id = ${cm.id} OR e.pm_id = ${cm.id}
          OR e.milestone_assignees::text LIKE ${'%' + cm.id + '%'})`;
      for (const e of edits) {
        const role = e.pm_id === cm.id ? 'PM' : 'Editor';
        if (e.end_date && String(e.end_date).slice(0, 10) === today) {
          items.push({ kind: 'due', title: `Edit due today — ${e.title}`, subtitle: `${e.project_code || 'Avo'} · you're the ${role}`, link: `/avo/${e.id}` });
        }
        const ms = parseJ(e.milestones);
        const assignees = parseJ(e.milestone_assignees);
        for (const [k, label] of Object.entries(MS_LABELS)) {
          if (ms[k] !== today) continue;
          const mine = assignees[k] ? assignees[k] === cm.id : e.lead_editor_id === cm.id;
          items.push({
            kind: 'due',
            title: `${label} due today — ${e.title}`,
            subtitle: `${e.project_code || 'Avo'} · ${mine ? 'your task' : `you're the ${role}`}`,
            link: `/avo/${e.id}`,
          });
        }
        if (e.start_date && String(e.start_date).slice(0, 10) === today && e.lead_editor_id === cm.id) {
          items.push({ kind: 'shoot', title: `Edit window starts today — ${e.title}`, subtitle: e.project_code || 'Avo', link: `/avo/${e.id}` });
        }
      }
    }
    // Open one-off project tasks assigned to me (fed from Project Overview pages)
    let tasks = [];
    if (cm) {
      tasks = await sql`
        SELECT t.id, t.text, t.due_date, t.done, t.notes, p.code as project_code, p.title as project_title, p.id as project_id
        FROM project_tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.assignee_id = ${cm.id} AND t.done IS NOT TRUE
        ORDER BY t.due_date NULLS LAST, t.created_at`;
    }
    res.json({ date: today, items, tasks });
  } catch (e) { next(e); }
});

// GET /api/dashboard/team — where every Unbridled team member is today
router.get('/team', requireAuth, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const members = await sql`
      SELECT cm.id, ${sql.unsafe(PREF)} as name
      FROM crew_members cm
      WHERE cm.company ILIKE '%unbridled%' AND cm.is_active IS NOT FALSE
      ORDER BY 2`;
    const pto = await sql`
      SELECT member_id, pto_type, title FROM pto_requests
      WHERE status != 'CLOSED' AND start_date <= ${today} AND end_date >= ${today}`;
    const shoots = await sql`
      SELECT ca.crew_member_id, pr.code, pr.title, pr.city, pr.state
      FROM crew_assignments ca JOIN projects pr ON pr.id = ca.project_id
      WHERE pr.status != 'ARCHIVED'
        AND ca.start_date::date <= ${today} AND COALESCE(ca.end_date, ca.start_date)::date >= ${today}`;
    const HIDDEN = ['anna parnigoni', 'ariel lynch', 'allison boon', 'brandon emery', 'cole seifert', 'dylan patterson', 'melinda love'];
    const visible = members.filter(m => !HIDDEN.includes((m.name || '').trim().toLowerCase()));
    const DENVER = ['anabelle', 'fabrizio'];
    res.json(visible.map(m => {
      const first = (m.name || '').trim().toLowerCase().split(/\s+/)[0];
      const homeOffice = DENVER.includes(first) ? 'Denver' : 'St. Louis';
      const p = pto.find(x => x.member_id === m.id);
      if (p) return { id: m.id, name: m.name, status: 'out', location: homeOffice, detail: p.pto_type };
      const s = shoots.find(x => x.crew_member_id === m.id);
      if (s) return { id: m.id, name: m.name, status: 'shoot', location: s.city ? `${s.city}, ${s.state}` : 'On location', detail: s.code };
      return { id: m.id, name: m.name, status: 'office', location: homeOffice, detail: 'In office' };
    }));
  } catch (e) { next(e); }
});

module.exports = router;
