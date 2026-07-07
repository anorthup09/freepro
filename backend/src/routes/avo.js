const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendMail } = require('../lib/mailer');
const { sendCalendarHold } = require('../lib/ics');

const staff = [requireAuth];
const editStatuses = ['COMING_SOON', 'ASSIGNED', 'FOCUS', 'CLOSED'];

const PREF = "COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name)";

async function logAct(editId, kind, author, body) {
  await sql`INSERT INTO edit_activity (edit_id, kind, author, body) VALUES (${editId}, ${kind}, ${author || null}, ${body})`;
}

async function memberName(id) {
  if (!id) return null;
  const [m] = await sql`SELECT COALESCE(NULLIF(TRIM(CONCAT(preferred_first_name, ' ', preferred_last_name)), ''), name) as n, email FROM crew_members WHERE id = ${id}`;
  return m || null;
}

const FULL_EDIT = editId => sql`
  SELECT e.*,
    (SELECT COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) FROM crew_members cm WHERE cm.id = e.lead_editor_id) as lead_editor_name_resolved,
    (SELECT COALESCE(NULLIF(TRIM(CONCAT(cm.preferred_first_name, ' ', cm.preferred_last_name)), ''), cm.name) FROM crew_members cm WHERE cm.id = e.pm_id) as pm_name,
    (SELECT cm.email FROM crew_members cm WHERE cm.id = e.pm_id) as pm_email,
    (SELECT cm.email FROM crew_members cm WHERE cm.id = e.lead_editor_id) as lead_editor_email,
    p.title as project_title
  FROM edits e LEFT JOIN projects p ON p.id = e.project_id
  WHERE e.id = ${editId}`;

// Sync a subset of edit fields onto the linked FreePro deliverable
async function syncToDeliverable(e) {
  if (!e.deliverable_id) return;
  const statusMap = { COMING_SOON: 'WAITING_ON_ASSETS', ASSIGNED: 'IN_PROGRESS', FOCUS: 'IN_REVIEW', CLOSED: 'DELIVERED' };
  const status = e.approved ? 'APPROVED' : (statusMap[e.status] || 'IN_PROGRESS');
  const editor = e.lead_editor_name_resolved || e.lead_editor_name || null;
  await sql`
    UPDATE deliverables SET
      title = ${e.title}, description = ${e.description || null}, editor_name = ${editor},
      aspect_ratio = ${e.aspect_ratio || null}, resolution = ${e.resolution || null},
      asset_ref = ${e.asset_ref || null}, music_ref = ${e.music_ref || null},
      status = ${status}::deliverable_status,
      due_date = ${e.end_date ? String(e.end_date).slice(0, 10) : null}
    WHERE id = ${e.deliverable_id}`.catch(err => console.error('Deliverable sync failed:', err.message));
}

// Editors get an Outlook hold for their edit window
async function sendEditHold(editId) {
  try {
    const [e] = await FULL_EDIT(editId);
    if (!e || !e.lead_editor_email || !e.start_date) return;
    const seq = Number(e.invite_seq || 0);
    const sent = await sendCalendarHold({
      uid: `edit-${e.id}`,
      sequence: seq,
      startDate: e.start_date,
      endDate: e.end_date || e.start_date,
      summary: `EDIT — ${e.project_code || ''} ${e.title}`.trim(),
      description: `You are the lead editor on "${e.title}"${e.project_code ? ` (${e.project_code})` : ''}.\nEdit window: ${String(e.start_date).slice(0, 10)} to ${String(e.end_date || e.start_date).slice(0, 10)}.\nDetails in AvocadoPost.`,
      attendeeEmail: e.lead_editor_email,
      attendeeName: e.lead_editor_name_resolved,
    });
    if (sent) await sql`UPDATE edits SET invite_seq = ${seq + 1} WHERE id = ${e.id}`;
  } catch (err) { console.error('Edit calendar hold failed:', err.message); }
}

// ── Pipeline list ──
router.get('/edits', ...staff, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT e.*,
        COALESCE((SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = e.lead_editor_id), e.lead_editor_name) as lead_editor,
        (SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = e.pm_id) as pm_name,
        p.title as project_title,
        la.body as latest_comment, la.author as latest_comment_author, la.created_at as latest_comment_at
      FROM edits e
      LEFT JOIN projects p ON p.id = e.project_id
      LEFT JOIN LATERAL (
        SELECT body, author, created_at FROM edit_activity
        WHERE edit_id = e.id AND kind = 'comment' ORDER BY created_at DESC LIMIT 1
      ) la ON TRUE
      ORDER BY e.end_date NULLS LAST, e.created_at`;
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Create ──
router.post('/edits', ...staff, async (req, res, next) => {
  try {
    const d = req.body;
    if (!d.title) return res.status(400).json({ error: 'Title is required' });
    let projectId = d.projectId || null;
    if (!projectId && d.projectCode) {
      const [p] = await sql`SELECT id FROM projects WHERE code = ${d.projectCode.trim()}`;
      if (p) projectId = p.id;
    }
    const [e] = await sql`
      INSERT INTO edits (project_id, project_code, title, description, lead_editor_id, pm_id,
        aspect_ratio, resolution, asset_ref, music_ref, category, status, review_link, start_date, end_date)
      VALUES (${projectId}, ${d.projectCode || null}, ${d.title}, ${d.description || null}, ${d.leadEditorId || null}, ${d.pmId || null},
        ${d.aspectRatio || null}, ${d.resolution || null}, ${d.assetRef || null}, ${d.musicRef || null},
        ${d.category || null}, ${editStatuses.includes(d.status) ? d.status : 'COMING_SOON'}, ${d.reviewLink || null},
        ${d.startDate || null}, ${d.endDate || null})
      RETURNING *`;
    const who = req.user?.email || 'someone';
    await logAct(e.id, 'log', who, 'created this edit');
    // Live-mirror into FreePro deliverables when the code maps to a project
    if (projectId) {
      const editor = (await memberName(d.leadEditorId))?.n || null;
      const [del] = await sql`
        INSERT INTO deliverables (id, project_id, title, description, editor_name, aspect_ratio, resolution, due_date, asset_ref, music_ref, category)
        VALUES (gen_random_uuid()::text, ${projectId}, ${d.title}, ${d.description || null}, ${editor}, ${d.aspectRatio || null}, ${d.resolution || null}, ${d.endDate || null}, ${d.assetRef || null}, ${d.musicRef || null}, 'POST_SHOOT')
        RETURNING id`;
      await sql`UPDATE edits SET deliverable_id = ${del.id} WHERE id = ${e.id}`;
      await logAct(e.id, 'log', who, 'linked to FreePro deliverable');
    }
    if (d.leadEditorId && d.startDate) sendEditHold(e.id);
    const [full] = await FULL_EDIT(e.id);
    res.status(201).json(full);
  } catch (e) { next(e); }
});

// ── Detail ──
router.get('/edits/:id', ...staff, async (req, res, next) => {
  try {
    const [e] = await FULL_EDIT(req.params.id);
    if (!e) return res.status(404).json({ error: 'Edit not found' });
    const activity = await sql`SELECT * FROM edit_activity WHERE edit_id = ${req.params.id} ORDER BY created_at`;
    const files = await sql`SELECT id, filename, mime, size, uploaded_by, created_at FROM edit_files WHERE edit_id = ${req.params.id} ORDER BY created_at`;
    res.json({ ...e, activity, files });
  } catch (e) { next(e); }
});

const MILESTONE_LABELS = {
  scripting_start: 'Scripting Start', scripting_end: 'Scripting End',
  icr_v1_due: 'ICR v1 Due', icr_feedback: 'ICR Feedback',
  client_v1_due: 'Client v1 Due', client_v1_feedback: 'Client v1 Feedback',
  client_v2_due: 'Client v2 Due', client_v2_feedback: 'Client v2 Feedback',
  client_v3_due: 'Client v3 Due', client_v3_feedback: 'Client v3 Feedback',
  color_audio_send: 'Send to Color & Audio', color_audio_complete: 'Color & Audio Complete',
  final_comp: 'Final Comp Complete', final_delivery: 'Final Delivery',
};

const FIELD_LOGS = {
  title: 'Title', description: 'Description', aspectRatio: 'Aspect Ratio', resolution: 'Resolution',
  assetRef: 'Asset Ref', musicRef: 'Music Ref', category: 'Category', status: 'Status',
  reviewLink: 'Current Review Link', startDate: 'Start Date', endDate: 'End Date',
  version: 'Version', approved: 'Approved', projectCode: 'Project Code',
};

// ── Update (logs every change, ClickUp-style) ──
router.patch('/edits/:id', ...staff, async (req, res, next) => {
  try {
    const d = req.body;
    const [before] = await FULL_EDIT(req.params.id);
    if (!before) return res.status(404).json({ error: 'Edit not found' });
    let prevMs = typeof before.milestones === 'string' ? JSON.parse(before.milestones || '{}') : (before.milestones || {});
    prevMs = Object.fromEntries(Object.keys(MILESTONE_LABELS).filter(k => prevMs[k]).map(k => [k, prevMs[k]]));
    let milestones;
    if (d.milestones !== undefined && typeof d.milestones === 'object') {
      milestones = { ...prevMs };
      for (const k of Object.keys(MILESTONE_LABELS)) {
        if (d.milestones[k] === undefined) continue;
        if (d.milestones[k]) milestones[k] = String(d.milestones[k]).slice(0, 10);
        else delete milestones[k];
      }
    }
    let projectId;
    if (d.projectCode !== undefined) {
      const [p] = d.projectCode ? await sql`SELECT id FROM projects WHERE code = ${d.projectCode.trim()}` : [null];
      projectId = p ? p.id : null;
    }
    const [e] = await sql`
      UPDATE edits SET
        title = ${d.title !== undefined ? d.title : sql`title`},
        description = ${d.description !== undefined ? (d.description || null) : sql`description`},
        project_code = ${d.projectCode !== undefined ? (d.projectCode || null) : sql`project_code`},
        project_id = ${projectId !== undefined ? projectId : sql`project_id`},
        lead_editor_id = ${d.leadEditorId !== undefined ? (d.leadEditorId || null) : sql`lead_editor_id`},
        pm_id = ${d.pmId !== undefined ? (d.pmId || null) : sql`pm_id`},
        aspect_ratio = ${d.aspectRatio !== undefined ? (d.aspectRatio || null) : sql`aspect_ratio`},
        resolution = ${d.resolution !== undefined ? (d.resolution || null) : sql`resolution`},
        asset_ref = ${d.assetRef !== undefined ? (d.assetRef || null) : sql`asset_ref`},
        music_ref = ${d.musicRef !== undefined ? (d.musicRef || null) : sql`music_ref`},
        category = ${d.category !== undefined ? (d.category || null) : sql`category`},
        status = ${d.status !== undefined && editStatuses.includes(d.status) ? d.status : sql`status`},
        review_link = ${d.reviewLink !== undefined ? (d.reviewLink || null) : sql`review_link`},
        start_date = ${d.startDate !== undefined ? (d.startDate || null) : sql`start_date`},
        end_date = ${d.endDate !== undefined ? (d.endDate || null) : sql`end_date`},
        version = ${d.version !== undefined ? Math.max(0.1, Math.round((Number(d.version) || 1) * 10) / 10) : sql`version`},
        approved = ${d.approved !== undefined ? (d.approved === true) : sql`approved`},
        milestones = ${milestones !== undefined ? sql.json(milestones) : sql`milestones`},
        updated_at = NOW()
      WHERE id = ${req.params.id} RETURNING *`;
    const who = req.user?.email || 'someone';
    // Postmarked change log
    const beforeVals = {
      title: before.title, description: before.description, aspectRatio: before.aspect_ratio, resolution: before.resolution,
      assetRef: before.asset_ref, musicRef: before.music_ref, category: before.category, status: before.status,
      reviewLink: before.review_link, startDate: before.start_date ? String(before.start_date).slice(0, 10) : null,
      endDate: before.end_date ? String(before.end_date).slice(0, 10) : null,
      version: before.version, approved: before.approved, projectCode: before.project_code,
    };
    for (const [k, label] of Object.entries(FIELD_LOGS)) {
      if (d[k] === undefined) continue;
      const from = beforeVals[k], to = d[k];
      if (String(from ?? '') === String(to ?? '')) continue;
      if (k === 'approved') await logAct(e.id, 'log', who, to ? 'marked this edit Approved ✓' : 'removed Approved');
      else if (k === 'description') await logAct(e.id, 'log', who, 'updated the Description');
      else await logAct(e.id, 'log', who, `set ${label} to ${to || '—'}${from ? ` (was ${String(from).slice(0, 60)})` : ''}`);
    }
    if (milestones !== undefined) {
      const prev = prevMs;
      for (const [k, label] of Object.entries(MILESTONE_LABELS)) {
        if (d.milestones[k] === undefined || String(prev[k] || '') === String(milestones[k] || '')) continue;
        await logAct(e.id, 'log', who, milestones[k]
          ? `set ${label} to ${milestones[k]}${prev[k] ? ` (was ${prev[k]})` : ''}`
          : `cleared ${label}`);
      }
    }
    if (d.leadEditorId !== undefined && d.leadEditorId !== before.lead_editor_id) {
      const m = await memberName(d.leadEditorId);
      await logAct(e.id, 'log', who, m ? `set Lead Editor to ${m.n}` : 'cleared Lead Editor');
    }
    if (d.pmId !== undefined && d.pmId !== before.pm_id) {
      const m = await memberName(d.pmId);
      await logAct(e.id, 'log', who, m ? `set PM to ${m.n}` : 'cleared PM');
    }
    const [full] = await FULL_EDIT(e.id);
    await syncToDeliverable(full);
    if ((d.leadEditorId !== undefined || d.startDate !== undefined || d.endDate !== undefined) && full.lead_editor_id && full.start_date) {
      sendEditHold(e.id);
    }
    res.json(full);
  } catch (e) { next(e); }
});

router.delete('/edits/:id', ...staff, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM edits WHERE id = ${req.params.id}`; res.status(204).end(); } catch (e) { next(e); }
});

// ── Comments (with @mention emails) ──
router.post('/edits/:id/comments', ...staff, async (req, res, next) => {
  try {
    const body = (req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Empty comment' });
    const who = req.user?.email || 'someone';
    await logAct(req.params.id, 'comment', who, body);
    // @mentions: match roster names appearing after an @ and email them
    const [e] = await FULL_EDIT(req.params.id);
    if (body.includes('@')) {
      const members = await sql`SELECT id, name, email, COALESCE(NULLIF(TRIM(CONCAT(preferred_first_name, ' ', preferred_last_name)), ''), name) as display FROM crew_members WHERE email IS NOT NULL`;
      const lower = body.toLowerCase();
      const notified = new Set();
      for (const m of members) {
        for (const nm of [m.display, m.name]) {
          if (nm && lower.includes('@' + nm.toLowerCase()) && !notified.has(m.email)) {
            notified.add(m.email);
            sendMail({
              to: m.email,
              subject: `${who} mentioned you — ${e.title}`,
              text: `${who} mentioned you on "${e.title}"${e.project_code ? ` (${e.project_code})` : ''}:\n\n${body}\n\n${e.review_link ? 'Review link: ' + e.review_link + '\n\n' : ''}Open AvocadoPost to reply.`,
            }).catch(err => console.error('Mention email failed:', err.message));
            await logAct(req.params.id, 'log', 'system', `emailed ${m.display} about this comment`);
          }
        }
      }
    }
    const activity = await sql`SELECT * FROM edit_activity WHERE edit_id = ${req.params.id} ORDER BY created_at`;
    res.status(201).json(activity);
  } catch (e) { next(e); }
});

// ── RFR: notify the PM the current version is ready for review ──
router.post('/edits/:id/rfr', ...staff, async (req, res, next) => {
  try {
    const [e] = await FULL_EDIT(req.params.id);
    if (!e) return res.status(404).json({ error: 'Edit not found' });
    const editor = e.lead_editor_name_resolved || e.lead_editor_name || req.user?.email || 'The editor';
    const to = req.body.to || e.pm_email;
    const who = req.user?.email || 'someone';
    if (to) {
      sendMail({
        to,
        subject: `Ready For Review — ${e.title}`,
        text: `${editor} has notified you a video is ready for review.\n\nVideo: ${e.title}${e.project_code ? ` (${e.project_code})` : ''}\nVersion: V${e.version}\n${e.review_link ? `Review link: ${e.review_link}` : 'No review link set yet.'}\n\nOnce reviewed, hit Sent in AvocadoPost to log it went to the client.`,
      }).catch(err => console.error('RFR email failed:', err.message));
    }
    await logAct(e.id, 'rfr', who, `V${e.version} RFR${to ? ` — notified ${to}` : ''}`);
    const activity = await sql`SELECT * FROM edit_activity WHERE edit_id = ${e.id} ORDER BY created_at`;
    res.json(activity);
  } catch (e) { next(e); }
});

// ── Sent: log the current version went to the client ──
router.post('/edits/:id/sent', ...staff, async (req, res, next) => {
  try {
    const [e] = await FULL_EDIT(req.params.id);
    if (!e) return res.status(404).json({ error: 'Edit not found' });
    await logAct(e.id, 'sent', req.user?.email || 'someone', `V${e.version} sent for client review`);
    const activity = await sql`SELECT * FROM edit_activity WHERE edit_id = ${e.id} ORDER BY created_at`;
    res.json(activity);
  } catch (e) { next(e); }
});

// ── Files (creative briefs, music, logos, clips) ──
router.post('/edits/:id/files', ...staff, async (req, res, next) => {
  try {
    const { filename, mime, fileBase64 } = req.body;
    const buf = Buffer.from(String(fileBase64 || ''), 'base64');
    if (!buf.length || !filename) return res.status(400).json({ error: 'No file received' });
    if (buf.length > 20 * 1024 * 1024) return res.status(400).json({ error: 'File too large (20MB max)' });
    const who = req.user?.email || 'someone';
    const [f] = await sql`
      INSERT INTO edit_files (edit_id, filename, mime, size, data, uploaded_by)
      VALUES (${req.params.id}, ${filename}, ${mime || 'application/octet-stream'}, ${buf.length}, ${buf}, ${who})
      RETURNING id, filename, mime, size, uploaded_by, created_at`;
    await logAct(req.params.id, 'log', who, `uploaded ${filename}`);
    res.status(201).json(f);
  } catch (e) { next(e); }
});
router.get('/files/:fid', ...staff, async (req, res, next) => {
  try {
    const [f] = await sql`SELECT * FROM edit_files WHERE id = ${req.params.fid}`;
    if (!f) return res.status(404).json({ error: 'File not found' });
    res.setHeader('Content-Type', f.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${f.filename.replace(/"/g, '')}"`);
    res.send(f.data);
  } catch (e) { next(e); }
});
router.delete('/files/:fid', ...staff, async (req, res, next) => {
  try {
    const [f] = await sql`DELETE FROM edit_files WHERE id = ${req.params.fid} RETURNING edit_id, filename`;
    if (f) await logAct(f.edit_id, 'log', req.user?.email || 'someone', `deleted ${f.filename}`);
    res.status(204).end();
  } catch (e) { next(e); }
});

// ── Gantt shares (public) ──
router.post('/gantt-share', ...staff, async (req, res, next) => {
  try {
    const { kind, ref } = req.body; // kind: 'project' (ref = project_code) | 'edit' (ref = edit id)
    if (!['project', 'edit'].includes(kind) || !ref) return res.status(400).json({ error: 'kind and ref required' });
    const [existing] = await sql`SELECT token FROM gantt_shares WHERE kind = ${kind} AND ref = ${ref}`;
    if (existing) return res.json({ token: existing.token });
    const [row] = await sql`INSERT INTO gantt_shares (kind, ref) VALUES (${kind}, ${ref}) RETURNING token`;
    res.status(201).json({ token: row.token });
  } catch (e) { next(e); }
});

// ── Live ProFi project codes (New Edit form only offers these) ──
router.get('/project-codes', ...staff, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT DISTINCT COALESCE(s.shoot_code, p.code) as code, p.title, p.client
      FROM projects p
      JOIN budgets b ON b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main' AND b.status = 'Live'
      LEFT JOIN budget_sections s ON s.budget_id = b.id AND s.kind = 'shoot' AND s.shoot_code IS NOT NULL
      WHERE p.parent_project_id IS NULL
      ORDER BY 1`;
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Project pages (lookup, lower-thirds grid, to-do list) ──
router.get('/projects', ...staff, async (req, res, next) => {
  try {
    const rows = await sql`SELECT * FROM avo_project_pages ORDER BY last_opened_at DESC`;
    res.json(rows);
  } catch (e) { next(e); }
});
router.post('/projects', ...staff, async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code required' });
    const [existing] = await sql`SELECT * FROM avo_project_pages WHERE LOWER(code) = ${code.toLowerCase()}`;
    if (existing) return res.json(existing);
    const [row] = await sql`INSERT INTO avo_project_pages (code, title) VALUES (${code}, ${req.body.title || null}) RETURNING *`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});
router.get('/projects/:id', ...staff, async (req, res, next) => {
  try {
    const [page] = await sql`UPDATE avo_project_pages SET last_opened_at = NOW() WHERE id = ${req.params.id} RETURNING *`;
    if (!page) return res.status(404).json({ error: 'Project page not found' });
    const lowerThirds = await sql`SELECT * FROM avo_lower_thirds WHERE page_id = ${page.id} ORDER BY sort, created_at`;
    const todos = await sql`SELECT * FROM avo_todos WHERE page_id = ${page.id} ORDER BY sort, created_at`;
    res.json({ ...page, lowerThirds, todos });
  } catch (e) { next(e); }
});
router.patch('/projects/:id', ...staff, async (req, res, next) => {
  try {
    const [row] = await sql`UPDATE avo_project_pages SET
        title = ${req.body.title !== undefined ? (req.body.title || null) : sql`title`},
        code = ${req.body.code !== undefined && String(req.body.code).trim() ? String(req.body.code).trim() : sql`code`}
      WHERE id = ${req.params.id} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Project page not found' });
    res.json(row);
  } catch (e) { next(e); }
});
router.delete('/projects/:id', ...staff, async (req, res, next) => {
  try {
    await sql`DELETE FROM avo_project_pages WHERE id = ${req.params.id}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

// Grid rows: kind is 'lower-thirds' or 'todos'
const GRID_TABLES = {
  'lower-thirds': { table: 'avo_lower_thirds', cols: ['name', 'title', 'notes', 'sort'] },
  'todos': { table: 'avo_todos', cols: ['text', 'done', 'sort'] },
};
router.post('/projects/:id/:kind', ...staff, async (req, res, next) => {
  try {
    const g = GRID_TABLES[req.params.kind];
    if (!g) return res.status(404).json({ error: 'Unknown grid' });
    const [row] = await sql`INSERT INTO ${sql.unsafe(g.table)} (page_id) VALUES (${req.params.id}) RETURNING *`;
    res.status(201).json(row);
  } catch (e) { next(e); }
});
router.patch('/grid/:kind/:rowId', ...staff, async (req, res, next) => {
  try {
    const g = GRID_TABLES[req.params.kind];
    if (!g) return res.status(404).json({ error: 'Unknown grid' });
    const data = {};
    for (const c of g.cols) {
      if (req.body[c] === undefined) continue;
      data[c] = c === 'done' ? req.body[c] === true : c === 'sort' ? (Number(req.body[c]) || 0) : String(req.body[c]);
    }
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ error: 'Nothing to update' });
    const [row] = await sql`UPDATE ${sql.unsafe(g.table)} SET ${sql(data, ...keys)} WHERE id = ${req.params.rowId} RETURNING *`;
    if (!row) return res.status(404).json({ error: 'Row not found' });
    res.json(row);
  } catch (e) { next(e); }
});
router.delete('/grid/:kind/:rowId', ...staff, async (req, res, next) => {
  try {
    const g = GRID_TABLES[req.params.kind];
    if (!g) return res.status(404).json({ error: 'Unknown grid' });
    await sql`DELETE FROM ${sql.unsafe(g.table)} WHERE id = ${req.params.rowId}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;

// Public gantt data (mounted separately without auth)
const publicRouter = require('express').Router();
publicRouter.get('/gantt-share/:token', async (req, res, next) => {
  try {
    const [share] = await sql`SELECT * FROM gantt_shares WHERE token = ${req.params.token}`;
    if (!share) return res.status(404).json({ error: 'Share not found' });
    let edits;
    if (share.kind === 'edit') {
      edits = await sql`
        SELECT e.id, e.title, e.project_code, e.status, e.version, e.start_date, e.end_date, e.approved, e.milestones,
          COALESCE((SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = e.lead_editor_id), e.lead_editor_name) as lead_editor
        FROM edits e WHERE e.id = ${share.ref}`;
    } else {
      edits = await sql`
        SELECT e.id, e.title, e.project_code, e.status, e.version, e.start_date, e.end_date, e.approved, e.milestones,
          COALESCE((SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = e.lead_editor_id), e.lead_editor_name) as lead_editor
        FROM edits e WHERE e.project_code = ${share.ref} ORDER BY e.start_date NULLS LAST`;
    }
    res.json({ kind: share.kind, ref: share.ref, edits });
  } catch (e) { next(e); }
});
module.exports.publicRouter = publicRouter;
