const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');

// FreePro deliverables mirror into AvocadoPost edits (and stay in sync)
async function mirrorToAvo(item, actor) {
  try {
    const [existing] = await sql`SELECT id FROM edits WHERE deliverable_id = ${item.id}`;
    const [proj] = await sql`SELECT code FROM projects WHERE id = ${item.project_id}`;
    const [editor] = item.editor_name
      ? await sql`SELECT id FROM crew_members WHERE LOWER(TRIM(CONCAT(preferred_first_name, ' ', preferred_last_name))) = LOWER(${item.editor_name}) OR LOWER(name) = LOWER(${item.editor_name}) LIMIT 1`
      : [null];
    const statusMap = { WAITING_ON_ASSETS: 'COMING_SOON', IN_PROGRESS: 'ASSIGNED', ROUGH_CUT: 'ASSIGNED', IN_REVIEW: 'FOCUS', APPROVED: 'CLOSED', DELIVERED: 'CLOSED' };
    if (existing) {
      await sql`
        UPDATE edits SET
          title = ${item.title}, description = ${item.description || null},
          lead_editor_id = ${editor ? editor.id : null}, lead_editor_name = ${item.editor_name || null},
          aspect_ratio = ${item.aspect_ratio || null}, resolution = ${item.resolution || null},
          asset_ref = ${item.asset_ref || null}, music_ref = ${item.music_ref || null},
          status = ${statusMap[item.status] || 'ASSIGNED'},
          approved = ${item.status === 'APPROVED'},
          end_date = ${item.due_date || null},
          updated_at = NOW()
        WHERE id = ${existing.id}`;
      await sql`INSERT INTO edit_activity (edit_id, kind, author, body) VALUES (${existing.id}, 'log', ${actor || 'FreePro'}, 'updated from the FreePro deliverable')`;
    } else {
      const [e] = await sql`
        INSERT INTO edits (project_id, project_code, deliverable_id, title, description, lead_editor_id, lead_editor_name,
          aspect_ratio, resolution, asset_ref, music_ref, status, end_date, category)
        VALUES (${item.project_id}, ${proj ? proj.code : null}, ${item.id}, ${item.title}, ${item.description || null},
          ${editor ? editor.id : null}, ${item.editor_name || null}, ${item.aspect_ratio || null}, ${item.resolution || null},
          ${item.asset_ref || null}, ${item.music_ref || null}, ${statusMap[item.status] || 'COMING_SOON'}, ${item.due_date || null}, ${item.category || null})
        RETURNING id`;
      await sql`INSERT INTO edit_activity (edit_id, kind, author, body) VALUES (${e.id}, 'log', ${actor || 'FreePro'}, 'created from a FreePro deliverable')`;
    }
  } catch (err) { console.error('Avo mirror failed:', err.message); }
}

router.get('/:id/deliverables', requireAuth, async (req, res, next) => {
  try { res.json(await sql`SELECT * FROM deliverables WHERE project_id = ${req.params.id} ORDER BY created_at`); } catch(e){next(e);}
});

router.post('/:id/deliverables', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [item] = await sql`
      INSERT INTO deliverables (id, project_id, title, description, editor_name, aspect_ratio, resolution, due_date, asset_ref, music_ref, is_urgent, notes, category)
      VALUES (gen_random_uuid()::text, ${req.params.id}, ${d.title}, ${d.description||null}, ${d.editorName||null}, ${d.aspectRatio||null}, ${d.resolution||null}, ${d.dueDate||null}, ${d.assetRef||null}, ${d.musicRef||null}, ${d.isUrgent||false}, ${d.notes||null}, ${d.category||'POST_SHOOT'})
      RETURNING *`;
    mirrorToAvo(item, req.user?.email);
    res.status(201).json(item);
  } catch(e){next(e);}
});

router.patch('/:id/deliverables/:did', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    const d = req.body;
    const [item] = await sql`
      UPDATE deliverables SET
        title=COALESCE(${d.title??null},title), description=COALESCE(${d.description??null},description),
        status=COALESCE(${d.status??null}::deliverable_status,status), editor_name=COALESCE(${d.editorName??null},editor_name),
        aspect_ratio=COALESCE(${d.aspectRatio??null},aspect_ratio), resolution=COALESCE(${d.resolution??null},resolution),
        due_date=COALESCE(${d.dueDate??null},due_date), music_ref=COALESCE(${d.musicRef??null},music_ref),
        is_urgent=COALESCE(${d.isUrgent??null},is_urgent), category=COALESCE(${d.category??null},category)
      WHERE id=${req.params.did} RETURNING *`;
    mirrorToAvo(item, req.user?.email);
    res.json(item);
  } catch(e){next(e);}
});

router.delete('/:id/deliverables/:did', requireAuth, requireRole('ADMIN','PRODUCER'), async (req, res, next) => {
  try {
    await sql`UPDATE edits SET deliverable_id = NULL WHERE deliverable_id = ${req.params.did}`;
    await sql`DELETE FROM deliverables WHERE id = ${req.params.did}`;
    res.status(204).end();
  } catch(e){next(e);}
});

module.exports = router;
