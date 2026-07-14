const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { sendMail, isConfigured: mailReady } = require('../lib/mailer');
const { sendCalendarHold } = require('../lib/ics');
const { noticeHtml, fmtPostmark } = require('../lib/emailTemplates');

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
// A scripted edit with no editor needs one sourced: auto-task the PM.
// Task completes itself once a lead editor is assigned.
async function syncSourcingTask(e) {
  try {
    const ms = typeof e.milestones === 'string' ? JSON.parse(e.milestones || '{}') : (e.milestones || {});
    const scriptDate = ms.scripting_start || ms.scripting_end || null;
    const needs = scriptDate && !e.lead_editor_id && e.project_id && e.status !== 'CLOSED';
    if (needs) {
      if (e.sourcing_task_id) {
        const [t] = await sql`SELECT id, done FROM project_tasks WHERE id = ${e.sourcing_task_id}`;
        if (t && !t.done) return;
      }
      // Assignee: the edit's PM, else the project's Main POC, else unassigned
      let assignee = e.pm_id || null;
      if (!assignee) {
        const [p] = await sql`SELECT poc_crew_member_id FROM projects WHERE id = ${e.project_id}`;
        assignee = p?.poc_crew_member_id || null;
      }
      const [t] = await sql`
        INSERT INTO project_tasks (project_id, text, assignee_id, due_date, notes, created_by)
        VALUES (${e.project_id}, ${'Source an editor — ' + e.title}, ${assignee}, ${scriptDate},
          ${'Auto-created: this edit has a scripting date but no lead editor. Assign one in AvocadoPost and this task completes itself.'},
          'AvocadoPost')
        RETURNING id`;
      await sql`UPDATE edits SET sourcing_task_id = ${t.id} WHERE id = ${e.id}`;
    } else if (e.sourcing_task_id && (e.lead_editor_id || e.status === 'CLOSED')) {
      await sql`UPDATE project_tasks SET done = TRUE WHERE id = ${e.sourcing_task_id} AND done IS NOT TRUE`;
    }
  } catch (err) { console.error('sourcing task sync failed:', err.message); }
}

// Backfill on boot: evaluate every open edit once (idempotent)
async function backfillSourcingTasks() {
  try {
    const edits = await sql`SELECT * FROM edits WHERE status != 'CLOSED'`;
    for (const e of edits) await syncSourcingTask(e);
  } catch (err) { console.error('sourcing backfill failed:', err.message); }
}
setTimeout(backfillSourcingTasks, 5000);

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
      category = COALESCE(${e.tracker_type || null}, category),
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
        aspect_ratio, resolution, asset_ref, music_ref, category, status, review_link, start_date, end_date, tracker_type, cost_estimate)
      VALUES (${projectId}, ${d.projectCode || null}, ${d.title}, ${d.description || null}, ${d.leadEditorId || null}, ${d.pmId || null},
        ${d.aspectRatio || null}, ${d.resolution || null}, ${d.assetRef || null}, ${d.musicRef || null},
        ${d.category || null}, ${editStatuses.includes(d.status) ? d.status : 'COMING_SOON'}, ${d.reviewLink || null},
        ${d.startDate || null}, ${d.endDate || null}, ${d.trackerType || null}, ${d.costEstimate ? Number(d.costEstimate) || null : null})
      RETURNING *`;
    const who = req.user?.email || 'someone';
    await logAct(e.id, 'log', who, 'created this edit');
    // Live-mirror into FreePro deliverables when the code maps to a project
    if (projectId) {
      const editor = (await memberName(d.leadEditorId))?.n || null;
      const [del] = await sql`
        INSERT INTO deliverables (id, project_id, title, description, editor_name, aspect_ratio, resolution, due_date, asset_ref, music_ref, category)
        VALUES (gen_random_uuid()::text, ${projectId}, ${d.title}, ${d.description || null}, ${editor}, ${d.aspectRatio || null}, ${d.resolution || null}, ${d.endDate || null}, ${d.assetRef || null}, ${d.musicRef || null}, ${d.trackerType || 'POST_SHOOT'})
        RETURNING id`;
      await sql`UPDATE edits SET deliverable_id = ${del.id} WHERE id = ${e.id}`;
      await logAct(e.id, 'log', who, 'linked to FreePro deliverable');
    }
    if (d.leadEditorId && d.startDate) sendEditHold(e.id);
    const [full] = await FULL_EDIT(e.id);
    syncSourcingTask(full);
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
    // Flag PTO/OOO requests for the lead editor that overlap the edit window
    let ptoConflicts = [];
    if (e.lead_editor_id) {
      ptoConflicts = await sql`
        SELECT id, title, pto_type, start_date, end_date, status FROM pto_requests
        WHERE member_id = ${e.lead_editor_id}
        ORDER BY start_date`;
    }
    res.json({ ...e, activity, files, pto_conflicts: ptoConflicts });
  } catch (e) { next(e); }
});

const MILESTONE_LABELS = {
  scripting_start: 'Scripting Start', scripting_end: 'Creative/Scripting Complete',
  icr_v1_due: 'ICR v1 Due', icr_feedback: 'ICR Feedback',
  client_v1_due: 'Client v1 Due', client_v1_feedback: 'Client v1 Feedback',
  client_v2_due: 'Client v2 Due', client_v2_feedback: 'Client v2 Feedback',
  client_v3_due: 'Client v3 Due', client_v3_feedback: 'Client v3 Feedback',
  color_audio_send: 'Send to Color & Audio', color_audio_complete: 'Color & Audio Complete',
  final_comp: 'Final Comp Complete', final_delivery: 'Final Delivery',
};

const FIELD_LOGS = {
  title: 'Title', description: 'Description', aspectRatio: 'Aspect Ratio', resolution: 'Resolution',
  assetRef: 'Asset Ref', musicRef: 'Music Ref', category: 'Category', drive: 'Drive', costEstimate: 'Cost Estimate', status: 'Status',
  reviewLink: 'Current Review Link', startDate: 'Start Date', endDate: 'End Date',
  version: 'Version', approved: 'Approved', projectCode: 'Project Code',
  trackerType: 'Type', style: 'Style', notes: 'Notes', videoAssets: 'Video Assets',
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
    // Approving a video moves it to Closed Tasks
    if (d.approved === true && before.status !== 'CLOSED' && d.status === undefined) d.status = 'CLOSED';
    // Per-task assignee overrides (empty value = back to the lead editor)
    let msAssignees;
    if (d.milestoneAssignees !== undefined && typeof d.milestoneAssignees === 'object') {
      const prevA = typeof before.milestone_assignees === 'string' ? JSON.parse(before.milestone_assignees || '{}') : (before.milestone_assignees || {});
      msAssignees = {};
      for (const k of Object.keys(MILESTONE_LABELS)) {
        const v = d.milestoneAssignees[k] !== undefined ? d.milestoneAssignees[k] : prevA[k];
        if (v) msAssignees[k] = v;
      }
      for (const k of Object.keys(MILESTONE_LABELS)) {
        if (d.milestoneAssignees[k] === undefined || String(prevA[k] || '') === String(d.milestoneAssignees[k] || '')) continue;
        const m = await memberName(d.milestoneAssignees[k]);
        await logAct(req.params.id, 'log', req.user?.email || 'someone',
          m ? `assigned ${MILESTONE_LABELS[k]} to ${m.n}` : `reset ${MILESTONE_LABELS[k]} back to the lead editor`);
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
        drive = ${d.drive !== undefined ? (d.drive || null) : sql`drive`},
        cost_estimate = ${d.costEstimate !== undefined ? (d.costEstimate === '' || d.costEstimate == null ? null : Number(d.costEstimate) || 0) : sql`cost_estimate`},
        extra = ${d.extra !== undefined && typeof d.extra === 'object' ? sql`COALESCE(extra, '{}'::jsonb) || ${sql.json(d.extra)}` : sql`extra`},
        tracker_sort = ${d.trackerSort !== undefined ? (Number(d.trackerSort) || 0) : sql`tracker_sort`},
        status = ${d.status !== undefined && editStatuses.includes(d.status) ? d.status : sql`status`},
        review_link = ${d.reviewLink !== undefined ? (d.reviewLink || null) : sql`review_link`},
        start_date = ${d.startDate !== undefined ? (d.startDate || null) : sql`start_date`},
        end_date = ${d.endDate !== undefined ? (d.endDate || null) : sql`end_date`},
        version = ${d.version !== undefined ? Math.max(0.1, Math.round((Number(d.version) || 1) * 10) / 10) : sql`version`},
        approved = ${d.approved !== undefined ? (d.approved === true) : sql`approved`},
        tracker_type = ${d.trackerType !== undefined ? (d.trackerType || null) : sql`tracker_type`},
        style = ${d.style !== undefined ? (d.style || null) : sql`style`},
        notes = ${d.notes !== undefined ? (d.notes || null) : sql`notes`},
        video_assets = ${d.videoAssets !== undefined ? (d.videoAssets || null) : sql`video_assets`},
        milestones = ${milestones !== undefined ? sql.json(milestones) : sql`milestones`},
        milestone_skips = ${Array.isArray(d.milestoneSkips) ? sql.json(d.milestoneSkips) : sql`milestone_skips`},
        milestone_assignees = ${msAssignees !== undefined ? sql.json(msAssignees) : sql`milestone_assignees`},
        updated_at = NOW()
      WHERE id = ${req.params.id} RETURNING *`;
    const who = req.user?.email || 'someone';
    // Postmarked change log
    const beforeVals = {
      title: before.title, description: before.description, aspectRatio: before.aspect_ratio, resolution: before.resolution,
      assetRef: before.asset_ref, musicRef: before.music_ref, category: before.category, drive: before.drive, costEstimate: before.cost_estimate, status: before.status,
      reviewLink: before.review_link, startDate: before.start_date ? String(before.start_date).slice(0, 10) : null,
      endDate: before.end_date ? String(before.end_date).slice(0, 10) : null,
      version: before.version, approved: before.approved, projectCode: before.project_code,
      trackerType: before.tracker_type, style: before.style, notes: before.notes, videoAssets: before.video_assets,
    };
    for (const [k, label] of Object.entries(FIELD_LOGS)) {
      if (d[k] === undefined) continue;
      const from = beforeVals[k], to = d[k];
      if (String(from ?? '') === String(to ?? '')) continue;
      if (k === 'approved') {
        await logAct(e.id, 'log', who, to ? 'marked this edit Approved ✓' : 'removed Approved');
        // Let the lead editor know their deliverable was approved (no-op until SMTP is configured)
        if (to && e.lead_editor_id) {
          try {
            const [ed] = await sql`SELECT ${sql.unsafe(PREF)} as name, email FROM crew_members cm WHERE cm.id = ${e.lead_editor_id}`;
            if (!mailReady()) console.log(`Approval email skipped (SMTP not configured) → ${ed?.email || 'no editor email'}`);
            else if (ed?.email) {
              await sendMail({ identity: 'post',
                to: ed.email,
                subject: `Approved ✓ — ${e.title}${e.project_code ? ` (${e.project_code})` : ''}`,
                text: `Hi ${ed.name || 'there'},\n\n"${e.title}"${e.project_code ? ` (${e.project_code})` : ''} was marked Approved by ${who}.\n\nNice work — details are in AvocadoPost.`,
                html: noticeHtml({ tag: 'AvocadoPost', note: 'Deliverable approved', color: '#3f9d68',
                  title: `${e.title} — Approved ✓`, subtitle: e.project_code || '',
                  intro: `Hi ${ed.name || 'there'} — "${e.title}" was marked Approved by ${who}. Nice work!`,
                  rows: [['Version', `V${e.version || 1}`], ['Approved by', who]],
                  postmark: new Date() }),
              });
              await logAct(e.id, 'log', 'system', `emailed ${ed.name || ed.email} about the approval`);
            }
          } catch (err) { console.error('Approval email failed:', err.message); }
        }
      }
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
    syncSourcingTask(full);
    if ((d.leadEditorId !== undefined || d.startDate !== undefined || d.endDate !== undefined) && full.lead_editor_id && full.start_date) {
      sendEditHold(e.id);
    }
    res.json(full);
  } catch (e) { next(e); }
});

// Hold a contract editor's cost estimate on the project VCC (idempotent per edit)
router.post('/edits/:id/hold-cost', ...staff, async (req, res, next) => {
  try {
    const [e] = await FULL_EDIT(req.params.id);
    if (!e) return res.status(404).json({ error: 'Edit not found' });
    if (!e.project_id) return res.status(400).json({ error: 'This edit is not linked to a project, so there is no VCC to hold against' });
    const role = ['editor', 'color', 'audio'].includes(req.body?.role) ? req.body.role : 'editor';
    const tile = (e.extra || {})[`contract_${role}`] || {};
    const amount = Number(tile.total) || (role === 'editor' ? Number(e.cost_estimate) : 0);
    if (!amount) return res.status(400).json({ error: 'Set a total estimate on the tile first' });
    const labels = { editor: 'Contract editor', color: 'Color', audio: 'Audio' };
    const vendor = tile.name || (role === 'editor' ? (await memberName(e.lead_editor_id))?.n : null) || null;
    const source = role === 'editor' ? `editcost:${e.id}` : `editcost:${e.id}:${role}`;
    const description = `${labels[role]} — ${e.title}${vendor ? ` (${vendor})` : ''}`;
    const [existing] = await sql`SELECT id FROM vcc_entries WHERE source = ${source}`;
    let entry;
    if (existing) {
      [entry] = await sql`UPDATE vcc_entries SET amount = ${amount}, description = ${description}, vendor = ${vendor}
        WHERE id = ${existing.id} RETURNING *`;
    } else {
      [entry] = await sql`INSERT INTO vcc_entries (project_id, entry_date, vendor, description, category, amount, status, source)
        VALUES (${e.project_id}, ${require('../lib/dates').bizToday()}, ${vendor}, ${description}, ${'Post-Production'}, ${amount}, 'HOLD', ${source})
        RETURNING *`;
    }
    await logAct(e.id, 'log', req.user?.email || 'someone', `held $${amount.toLocaleString()} on the project VCC for ${labels[role].toLowerCase()}`);
    res.json(entry);
  } catch (e) { next(e); }
});

router.delete('/edits/:id', ...staff, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try { await sql`DELETE FROM edits WHERE id = ${req.params.id}`; res.status(204).end(); } catch (e) { next(e); }
});

// ── Color & Audio contractor tracker (Project Video Tracker tab) ──
const CONTRACTOR_ROLES = ['color', 'audio'];

router.get('/pages/:id/contractors', ...staff, async (req, res, next) => {
  try {
    res.json(await sql`SELECT * FROM avo_contractors WHERE page_id = ${req.params.id} ORDER BY created_at`);
  } catch (e) { next(e); }
});

router.post('/pages/:id/contractors', ...staff, async (req, res, next) => {
  try {
    const d = req.body;
    if (!CONTRACTOR_ROLES.includes(d.role)) return res.status(400).json({ error: 'Role must be color or audio' });
    const [r] = await sql`
      INSERT INTO avo_contractors (page_id, role, name, email, rate, services, total, invoice_pm_id)
      VALUES (${req.params.id}, ${d.role}, ${d.name || ''}, ${d.email || ''}, ${d.rate || ''}, ${d.services || ''},
        ${d.total === '' || d.total == null ? null : Number(d.total) || 0}, ${d.invoicePmId || null})
      RETURNING *`;
    res.status(201).json(r);
  } catch (e) { next(e); }
});

router.patch('/contractors/:id', ...staff, async (req, res, next) => {
  try {
    const d = req.body;
    const [r] = await sql`
      UPDATE avo_contractors SET
        name = ${d.name !== undefined ? (d.name || '') : sql`name`},
        email = ${d.email !== undefined ? (d.email || '') : sql`email`},
        rate = ${d.rate !== undefined ? (d.rate || '') : sql`rate`},
        services = ${d.services !== undefined ? (d.services || '') : sql`services`},
        total = ${d.total !== undefined ? (d.total === '' || d.total == null ? null : Number(d.total) || 0) : sql`total`},
        invoice_pm_id = ${d.invoicePmId !== undefined ? (d.invoicePmId || null) : sql`invoice_pm_id`}
      WHERE id = ${req.params.id} RETURNING *`;
    if (!r) return res.status(404).json({ error: 'Not found' });
    res.json(r);
  } catch (e) { next(e); }
});

router.delete('/contractors/:id', ...staff, async (req, res, next) => {
  try { await sql`DELETE FROM avo_contractors WHERE id = ${req.params.id}`; res.status(204).end(); } catch (e) { next(e); }
});

// Create (or regenerate) a signable contract for a Color/Audio contractor.
// Reuses the crew-contract email/signing flow: the frontend follows up with
// /projects/:pid/contracts/:cid/email-prefill + /email.
router.post('/contractors/:id/contract', ...staff, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const [c] = await sql`SELECT ac.*, pp.code FROM avo_contractors ac JOIN avo_project_pages pp ON pp.id = ac.page_id WHERE ac.id = ${req.params.id}`;
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (!c.name || !c.email) return res.status(400).json({ error: 'Fill in the contractor name and email first' });
    const [proj] = await sql`SELECT * FROM projects WHERE code = ${c.code}`;
    if (!proj) return res.status(400).json({ error: `No project with code ${c.code} to contract against` });
    if (c.contract_id) await sql`DELETE FROM contracts WHERE id = ${c.contract_id} AND signed_at IS NULL`;
    const position = c.role === 'color' ? 'Color' : 'Audio';
    const scope = [c.services, c.rate ? `Rate: ${c.rate}` : null].filter(Boolean).join('\n\n') || null;
    const [k] = await sql`
      INSERT INTO contracts (project_id, contractor_name, contractor_email, position_name,
        project_title, project_code, start_date, end_date, scope, quoted_total)
      VALUES (${proj.id}, ${c.name}, ${c.email}, ${position}, ${proj.title}, ${proj.code},
        ${proj.start_date ? new Date(proj.start_date).toISOString().slice(0, 10) : null},
        ${proj.end_date ? new Date(proj.end_date).toISOString().slice(0, 10) : null}, ${scope}, ${Number(c.total) || null})
      RETURNING *`;
    await sql`UPDATE avo_contractors SET contract_id = ${k.id} WHERE id = ${c.id}`;
    res.status(201).json({ contract: k, projectId: proj.id, total: c.total });
  } catch (e) { next(e); }
});

// Same for the edit's Contract Editor tile (data lives in edits.extra)
router.post('/edits/:id/contract', ...staff, requireRole('ADMIN', 'PRODUCER'), async (req, res, next) => {
  try {
    const [e] = await FULL_EDIT(req.params.id);
    if (!e) return res.status(404).json({ error: 'Edit not found' });
    if (!e.project_id) return res.status(400).json({ error: 'This edit is not linked to a project' });
    const tile = (e.extra || {}).contract_editor || {};
    const name = tile.name || e.lead_editor_name_resolved;
    const email = tile.email || e.lead_editor_email;
    if (!name || !email) return res.status(400).json({ error: 'Fill in the contract editor name and email first' });
    if (tile.contractId) await sql`DELETE FROM contracts WHERE id = ${tile.contractId} AND signed_at IS NULL`;
    const [proj] = await sql`SELECT * FROM projects WHERE id = ${e.project_id}`;
    const scope = [tile.services, tile.rate ? `Rate: ${tile.rate}` : null].filter(Boolean).join('\n\n') || null;
    const [k] = await sql`
      INSERT INTO contracts (project_id, contractor_name, contractor_email, position_name,
        project_title, project_code, start_date, end_date, scope, quoted_total)
      VALUES (${e.project_id}, ${name}, ${email}, ${'Contract Editor'}, ${proj?.title || e.project_title}, ${e.project_code},
        ${e.start_date ? new Date(e.start_date).toISOString().slice(0, 10) : null},
        ${e.end_date ? new Date(e.end_date).toISOString().slice(0, 10) : null}, ${scope},
        ${(Number(tile.total) || Number(e.cost_estimate)) + (Number(tile.misc) || 0) || null})
      RETURNING *`;
    await sql`UPDATE edits SET extra = COALESCE(extra, '{}'::jsonb) || ${sql.json({ contract_editor: { ...tile, contractId: k.id } })} WHERE id = ${e.id}`;
    await logAct(e.id, 'log', req.user?.email || 'someone', `generated a contract for ${name}`);
    const total = Number(tile.total) || Number(e.cost_estimate) || null;
    res.status(201).json({ contract: k, projectId: e.project_id, total });
  } catch (e) { next(e); }
});

// Hold a contractor's total estimate on the project VCC (idempotent per contractor)
router.post('/contractors/:id/hold-cost', ...staff, async (req, res, next) => {
  try {
    const [c] = await sql`SELECT ac.*, pp.code FROM avo_contractors ac JOIN avo_project_pages pp ON pp.id = ac.page_id WHERE ac.id = ${req.params.id}`;
    if (!c) return res.status(404).json({ error: 'Not found' });
    const [proj] = await sql`SELECT id, title FROM projects WHERE code = ${c.code}`;
    if (!proj) return res.status(400).json({ error: `No project with code ${c.code} to hold against` });
    const amount = Number(c.total);
    if (!amount) return res.status(400).json({ error: 'Set a total estimate first' });
    const label = c.role === 'color' ? 'Color' : 'Audio';
    const vendor = c.name || null;
    const source = `avocontractor:${c.id}`;
    const description = `${label} — ${proj.title || c.code}${vendor ? ` (${vendor})` : ''}`;
    const [existing] = await sql`SELECT id FROM vcc_entries WHERE source = ${source}`;
    let entry;
    if (existing) {
      [entry] = await sql`UPDATE vcc_entries SET amount = ${amount}, description = ${description}, vendor = ${vendor}
        WHERE id = ${existing.id} RETURNING *`;
    } else {
      [entry] = await sql`INSERT INTO vcc_entries (project_id, entry_date, vendor, description, category, amount, status, source)
        VALUES (${proj.id}, ${require('../lib/dates').bizToday()}, ${vendor}, ${description}, ${'Post-Production'}, ${amount}, 'HOLD', ${source})
        RETURNING *`;
    }
    res.json(entry);
  } catch (e) { next(e); }
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
            sendMail({ identity: 'post',
              to: m.email,
              subject: `${who} mentioned you — ${e.title}`,
              text: `${who} mentioned you on "${e.title}"${e.project_code ? ` (${e.project_code})` : ''}:\n\n${body}\n\n${e.review_link ? 'Review link: ' + e.review_link + '\n\n' : ''}Open AvocadoPost to reply.`,
              html: noticeHtml({ tag: 'AvocadoPost', note: 'You were mentioned',
                title: e.title, subtitle: e.project_code || '',
                intro: `${who} mentioned you in a comment:`,
                blocks: [['Comment', body]],
                copyLink: e.review_link ? { label: 'Review link', url: e.review_link } : undefined,
                postmark: new Date() }),
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
    const who = req.user?.name || req.user?.email || 'someone';
    const to = req.body.to || e.pm_email;
    if (to) {
      const now = new Date();
      sendMail({ identity: 'post',
        to,
        subject: `Ready For Review — ${e.title} V${e.version || 1}`,
        text: `V${e.version || 1} of "${e.title}"${e.project_code ? ` (${e.project_code})` : ''} is ready for review from ${who}.\n\n${e.review_link ? `Review link: ${e.review_link}` : 'No review link set yet.'}\n\nOnce reviewed, hit Sent in AvocadoPost to log it went out.\n\nPostmarked ${fmtPostmark(now)}`,
        html: noticeHtml({ tag: 'AvocadoPost', note: 'Ready for review',
          title: `${e.title} — V${e.version || 1}`, subtitle: e.project_code || '',
          intro: `V${e.version || 1} is ready for review from ${who}.`,
          rows: [['Video', e.title], ['Version', `V${e.version || 1}`], ['From', who],
                 ['Lead Editor', e.lead_editor_name_resolved || e.lead_editor_name || '']],
          copyLink: e.review_link ? { label: 'Review link — quick copy', url: e.review_link } : undefined,
          button: e.review_link ? { label: 'Open review', url: e.review_link } : undefined,
          postmark: now }),
      }).catch(err => console.error('RFR email failed:', err.message));
    }
    await logAct(e.id, 'rfr', req.user?.email || 'someone', `V${e.version} RFR${to ? ` — notified ${to}` : ''}`);
    const activity = await sql`SELECT * FROM edit_activity WHERE edit_id = ${e.id} ORDER BY created_at`;
    res.json(activity);
  } catch (e) { next(e); }
});

// ── Sent: log the current version went to the client ──
router.post('/edits/:id/sent', ...staff, async (req, res, next) => {
  try {
    const [e] = await FULL_EDIT(req.params.id);
    if (!e) return res.status(404).json({ error: 'Edit not found' });
    // Let the lead editor know their cut went out (no-op until SMTP is configured)
    const who = req.user?.name || req.user?.email || 'someone';
    if (e.lead_editor_email) {
      const now = new Date();
      if (!mailReady()) console.log(`Sent email skipped (SMTP not configured) → ${e.lead_editor_email}`);
      else sendMail({ identity: 'post',
        to: e.lead_editor_email,
        subject: `Sent for review — ${e.title} V${e.version || 1}`,
        text: `V${e.version || 1} of "${e.title}"${e.project_code ? ` (${e.project_code})` : ''} was sent by ${who} for internal creative or client review.\n\nPostmarked ${fmtPostmark(now)}`,
        html: noticeHtml({ tag: 'AvocadoPost', note: 'Sent for review', color: '#4a7fb5',
          title: `${e.title} — V${e.version || 1}`, subtitle: e.project_code || '',
          intro: `V${e.version || 1} was sent by ${who} for internal creative or client review.`,
          rows: [['Video', e.title], ['Version', `V${e.version || 1}`], ['Sent by', who]],
          postmark: now }),
      }).catch(err => console.error('Sent email failed:', err.message));
    }
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

// ── Creative assets on a project page (photos, motion gfx…), taggable to a video ──
const cleanEditIds = v => [...new Set((Array.isArray(v) ? v : v ? [v] : []).filter(Boolean).map(String))];
router.post('/projects/:id/assets', ...staff, async (req, res, next) => {
  try {
    const { filename, mime, fileBase64 } = req.body;
    const editIds = cleanEditIds(req.body.editIds ?? req.body.editId);
    const buf = Buffer.from(String(fileBase64 || ''), 'base64');
    if (!buf.length || !filename) return res.status(400).json({ error: 'No file received' });
    if (buf.length > 20 * 1024 * 1024) return res.status(400).json({ error: 'File too large (20MB max)' });
    const who = req.user?.email || 'someone';
    const [a] = await sql`
      INSERT INTO avo_assets (page_id, filename, mime, size, data, edit_ids, uploaded_by)
      VALUES (${req.params.id}, ${filename}, ${mime || 'application/octet-stream'}, ${buf.length}, ${buf}, ${sql.json(editIds)}, ${who})
      RETURNING id, page_id, filename, mime, size, edit_ids, uploaded_by, created_at`;
    for (const eid of editIds) await logAct(eid, 'log', who, `uploaded creative asset ${filename}`);
    res.status(201).json(a);
  } catch (e) { next(e); }
});
router.patch('/assets/:aid', ...staff, async (req, res, next) => {
  try {
    const editIds = cleanEditIds(req.body.editIds ?? req.body.editId);
    const [before] = await sql`SELECT edit_ids FROM avo_assets WHERE id = ${req.params.aid}`;
    if (!before) return res.status(404).json({ error: 'Asset not found' });
    const [a] = await sql`UPDATE avo_assets SET edit_ids = ${sql.json(editIds)}
      WHERE id = ${req.params.aid}
      RETURNING id, page_id, filename, mime, size, edit_ids, uploaded_by, created_at`;
    const prev = new Set(cleanEditIds(before.edit_ids));
    const who = req.user?.email || 'someone';
    for (const eid of editIds.filter(x => !prev.has(x)))
      await logAct(eid, 'log', who, `tagged creative asset ${a.filename} to this video`);
    res.json(a);
  } catch (e) { next(e); }
});
router.get('/assets/:aid/file', ...staff, async (req, res, next) => {
  try {
    const [f] = await sql`SELECT filename, mime, data FROM avo_assets WHERE id = ${req.params.aid}`;
    if (!f) return res.status(404).json({ error: 'Asset not found' });
    res.setHeader('Content-Type', f.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${f.filename.replace(/"/g, '')}"`);
    res.send(f.data);
  } catch (e) { next(e); }
});
router.delete('/assets/:aid', ...staff, async (req, res, next) => {
  try {
    const [f] = await sql`DELETE FROM avo_assets WHERE id = ${req.params.aid} RETURNING edit_ids, filename`;
    for (const eid of cleanEditIds(f?.edit_ids)) await logAct(eid, 'log', req.user?.email || 'someone', `deleted creative asset ${f.filename}`);
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
    // Base ProFi project codes only — no -01/-02 suffixes (those are production-specific)
    const rows = await sql`
      SELECT DISTINCT p.code, p.title, p.client
      FROM projects p
      JOIN budgets b ON b.project_id = p.id AND COALESCE(b.kind, 'main') = 'main' AND b.status = 'Live'
      WHERE p.parent_project_id IS NULL
      ORDER BY 1`;
    res.json(rows);
  } catch (e) { next(e); }
});

// ── Project pages (lookup, lower-thirds grid, to-do list) ──
router.get('/projects', ...staff, async (req, res, next) => {
  try {
    // Base project codes only — hide pages created with -01/-02 production suffixes
    // The ProFi project name is authoritative — pages mirror it live by code
    const rows = await sql`
      SELECT a.*, COALESCE(pr.title, a.title) as title
      FROM avo_project_pages a
      LEFT JOIN projects pr ON pr.code = a.code AND pr.parent_project_id IS NULL
      WHERE a.code !~ '-[0-9]+$' ORDER BY a.last_opened_at DESC`;
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
// Look up a project page id by code (exact, or the base code family)
router.get('/projects/by-code/:code', ...staff, async (req, res, next) => {
  try {
    const code = req.params.code;
    const base = code.replace(/-\d+$/, '');
    const [page] = await sql`
      SELECT id, code FROM avo_project_pages
      WHERE code = ${code} OR code = ${base}
      ORDER BY (code = ${code}) DESC LIMIT 1`;
    if (!page) return res.status(404).json({ error: 'No project page for this code' });
    res.json(page);
  } catch (e) { next(e); }
});
router.get('/projects/:id', ...staff, async (req, res, next) => {
  try {
    let [page] = await sql`UPDATE avo_project_pages SET last_opened_at = NOW() WHERE id = ${req.params.id} RETURNING *`;
    if (page) {
      const [pr] = await sql`SELECT title FROM projects WHERE code = ${page.code} AND parent_project_id IS NULL LIMIT 1`;
      if (pr?.title) page = { ...page, title: pr.title };
    }
    if (!page) return res.status(404).json({ error: 'Project page not found' });
    const lowerThirds = await sql`SELECT * FROM avo_lower_thirds WHERE page_id = ${page.id} ORDER BY sort, created_at`;
    const todos = await sql`SELECT * FROM avo_todos WHERE page_id = ${page.id} ORDER BY sort, created_at`;
    const music = await sql`SELECT * FROM avo_music WHERE page_id = ${page.id} ORDER BY sort, created_at`;
    // Video tracker: every pipeline edit carrying this project code (or one of its shoot codes)
    const edits = await sql`
      SELECT e.*, COALESCE((SELECT ${sql.unsafe(PREF)} FROM crew_members cm WHERE cm.id = e.lead_editor_id), e.lead_editor_name) as lead_editor
      FROM edits e
      WHERE e.project_code = ${page.code} OR e.project_code LIKE ${page.code + '-%'}
      ORDER BY e.tracker_sort NULLS LAST, e.end_date NULLS LAST, e.created_at`;
    const assets = await sql`SELECT id, page_id, filename, mime, size, edit_ids, uploaded_by, created_at FROM avo_assets WHERE page_id = ${page.id} ORDER BY created_at DESC`;
    const tables = await sql`SELECT * FROM avo_custom_tables WHERE page_id = ${page.id} ORDER BY sort, created_at`;
    const tRows = tables.length ? await sql`SELECT * FROM avo_custom_rows WHERE table_id IN ${sql(tables.map(t => t.id))} ORDER BY sort, created_at` : [];
    const customTables = tables.map(t => ({ ...t, rows: tRows.filter(r => r.table_id === t.id) }));
    res.json({ ...page, lowerThirds, todos, music, edits, customTables, assets });
  } catch (e) { next(e); }
});
router.patch('/projects/:id', ...staff, async (req, res, next) => {
  try {
    const [row] = await sql`UPDATE avo_project_pages SET
        title = ${req.body.title !== undefined ? (req.body.title || null) : sql`title`},
        code = ${req.body.code !== undefined && String(req.body.code).trim() ? String(req.body.code).trim() : sql`code`},
        grid_config = ${req.body.gridConfig !== undefined && typeof req.body.gridConfig === 'object' ? sql.json(req.body.gridConfig || {}) : sql`grid_config`}
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

// ── Custom tables on a project page ──
router.post('/projects/:id/tables', ...staff, async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Table name required' });
    const config = { cols: [{ key: 'c' + Date.now().toString(36), label: 'Column 1' }], merges: {} };
    const [t] = await sql`INSERT INTO avo_custom_tables (page_id, name, config) VALUES (${req.params.id}, ${name}, ${sql.json(config)}) RETURNING *`;
    res.status(201).json({ ...t, rows: [] });
  } catch (e) { next(e); }
});
router.patch('/tables/:tid', ...staff, async (req, res, next) => {
  try {
    const [t] = await sql`UPDATE avo_custom_tables SET
        name = ${req.body.name !== undefined && String(req.body.name).trim() ? String(req.body.name).trim() : sql`name`},
        config = ${req.body.config !== undefined && typeof req.body.config === 'object' ? sql.json(req.body.config || {}) : sql`config`}
      WHERE id = ${req.params.tid} RETURNING *`;
    if (!t) return res.status(404).json({ error: 'Table not found' });
    res.json(t);
  } catch (e) { next(e); }
});
router.delete('/tables/:tid', ...staff, async (req, res, next) => {
  try {
    await sql`DELETE FROM avo_custom_tables WHERE id = ${req.params.tid}`;
    res.status(204).end();
  } catch (e) { next(e); }
});
router.post('/tables/:tid/rows', ...staff, async (req, res, next) => {
  try {
    const [r] = await sql`INSERT INTO avo_custom_rows (table_id) VALUES (${req.params.tid}) RETURNING *`;
    res.status(201).json(r);
  } catch (e) { next(e); }
});
router.patch('/table-rows/:rid', ...staff, async (req, res, next) => {
  try {
    const [r] = await sql`UPDATE avo_custom_rows SET
        extra = ${req.body.extra !== undefined && typeof req.body.extra === 'object' ? sql`COALESCE(extra, '{}'::jsonb) || ${sql.json(req.body.extra)}` : sql`extra`},
        sort = ${req.body.sort !== undefined ? (Number(req.body.sort) || 0) : sql`sort`}
      WHERE id = ${req.params.rid} RETURNING *`;
    if (!r) return res.status(404).json({ error: 'Row not found' });
    res.json(r);
  } catch (e) { next(e); }
});
router.delete('/table-rows/:rid', ...staff, async (req, res, next) => {
  try {
    await sql`DELETE FROM avo_custom_rows WHERE id = ${req.params.rid}`;
    res.status(204).end();
  } catch (e) { next(e); }
});

// Grid rows: kind is 'lower-thirds' or 'todos'
const GRID_TABLES = {
  'lower-thirds': { table: 'avo_lower_thirds', cols: ['name', 'title', 'notes', 'sort'] },
  'todos': { table: 'avo_todos', cols: ['category', 'video', 'needs', 'text', 'done', 'sort'] },
  'music': { table: 'avo_music', cols: ['category', 'url', 'note', 'sort'] },
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
    const hasExtra = req.body.extra && typeof req.body.extra === 'object';
    if (!keys.length && !hasExtra) return res.status(400).json({ error: 'Nothing to update' });
    let row;
    if (keys.length) [row] = await sql`UPDATE ${sql.unsafe(g.table)} SET ${sql(data, ...keys)} WHERE id = ${req.params.rowId} RETURNING *`;
    if (hasExtra) [row] = await sql`UPDATE ${sql.unsafe(g.table)} SET extra = COALESCE(extra, '{}'::jsonb) || ${sql.json(req.body.extra)} WHERE id = ${req.params.rowId} RETURNING *`;
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
