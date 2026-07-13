const sql = require('./db');

const TASK_TEXT = 'Assign gear to sources';
const ASSIGNEE = 'Mason Vitro';

// Keeps a Hub task on Mason Vitro's list whenever a shoot has gear that
// hasn't been assigned to a source yet — and checks it off automatically
// once everything is sourced.
async function syncGearAssignTask(projectId) {
  try {
    const [{ n }] = await sql`
      SELECT COUNT(*)::int as n FROM gear_items
      WHERE project_id = ${projectId} AND COALESCE(source, 'unassigned') = 'unassigned'`;
    const [task] = await sql`
      SELECT * FROM project_tasks WHERE project_id = ${projectId} AND text = ${TASK_TEXT} LIMIT 1`;
    if (n > 0) {
      if (!task) {
        const [mason] = await sql`
          SELECT id FROM crew_members
          WHERE company ILIKE '%unbridled%'
            AND (name ILIKE '%mason%vitro%' OR CONCAT(preferred_first_name, ' ', preferred_last_name) ILIKE '%mason%vitro%')
          LIMIT 1`;
        await sql`
          INSERT INTO project_tasks (project_id, text, assignee_id, created_by)
          VALUES (${projectId}, ${TASK_TEXT}, ${mason?.id || null}, 'Gear automation')`;
      } else if (task.done) {
        await sql`UPDATE project_tasks SET done = FALSE WHERE id = ${task.id}`;
      }
    } else if (task && !task.done) {
      await sql`UPDATE project_tasks SET done = TRUE WHERE id = ${task.id}`;
    }
  } catch (e) { console.error('Gear assign task sync failed:', e.message); }
}

module.exports = { syncGearAssignTask, GEAR_TASK_TEXT: TASK_TEXT, GEAR_TASK_ASSIGNEE: ASSIGNEE };
