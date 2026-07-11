const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth } = require('../middleware/auth');
const { bizToday } = require('../lib/dates');

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
const iso = d => d ? new Date(d).toISOString().slice(0, 10) : null;

// The signed-in user's crew_members row (matched by email)
async function myCrewMember(email) {
  if (!email) return null;
  const [cm] = await sql`SELECT id, name, preferred_first_name, preferred_last_name FROM crew_members WHERE LOWER(email) = ${email.toLowerCase()} LIMIT 1`;
  return cm || null;
}

// GET /api/dashboard/today — the user's Day in Review
async function itemsFor(cm, today) {
  const items = [];
  {
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
      for (const p of pto) items.push({ kind: 'pto', title: `${p.pto_type}`, subtitle: p.title, link: '/team' });

      // Avo edits where I'm the lead editor or PM
      const edits = await sql`
        SELECT e.id, e.title, e.project_code, e.end_date, e.start_date, e.milestones, e.milestone_assignees,
               e.lead_editor_id, e.pm_id
        FROM edits e
        WHERE e.status != 'CLOSED' AND (e.lead_editor_id = ${cm.id} OR e.pm_id = ${cm.id}
          OR e.milestone_assignees::text LIKE ${'%' + cm.id + '%'})`;
      for (const e of edits) {
        const role = e.pm_id === cm.id ? 'PM' : 'Editor';
        if (iso(e.end_date) === today) {
          items.push({ kind: 'due', title: `Edit due — ${e.title}`, subtitle: `${e.project_code || 'Avo'} · you're the ${role}`, link: `/avo/${e.id}` });
        }
        const ms = parseJ(e.milestones);
        const assignees = parseJ(e.milestone_assignees);
        for (const [k, label] of Object.entries(MS_LABELS)) {
          if (ms[k] !== today) continue;
          const mine = assignees[k] ? assignees[k] === cm.id : e.lead_editor_id === cm.id;
          items.push({
            kind: 'due',
            title: `${label} due — ${e.title}`,
            subtitle: `${e.project_code || 'Avo'} · ${mine ? 'your task' : `you're the ${role}`}`,
            link: `/avo/${e.id}`,
          });
        }
        if (iso(e.start_date) === today && e.lead_editor_id === cm.id) {
          items.push({ kind: 'shoot', title: `Edit window starts — ${e.title}`, subtitle: e.project_code || 'Avo', link: `/avo/${e.id}` });
        }
        // Mirror the Crew Calendar: edit windows and editor-task runners that span today
        const sd = iso(e.start_date);
        const ed = iso(e.end_date);
        if (e.lead_editor_id === cm.id && sd && ed && sd < today && ed > today) {
          items.push({ kind: 'work', title: `Edit in progress — ${e.title}`, subtitle: `${e.project_code || 'Avo'} · due ${ed.slice(5).replace('-', '/')}`, link: `/avo/${e.id}` });
        }
        const EDITOR_TASKS = { icr_v1_due: 'ICR v1', client_v1_due: 'Client v1', client_v2_due: 'Client v2', client_v3_due: 'Client v3', color_audio_send: 'Send to Color & Audio', final_comp: 'Final Comp' };
        const MS_ORDER = ['scripting_start', 'scripting_end', 'icr_v1_due', 'icr_feedback', 'client_v1_due', 'client_v1_feedback', 'client_v2_due', 'client_v2_feedback', 'client_v3_due', 'client_v3_feedback', 'color_audio_send', 'color_audio_complete', 'final_comp', 'final_delivery'];
        for (const [k, label] of Object.entries(EDITOR_TASKS)) {
          const due = ms[k];
          if (!due || due <= today) continue;   // due-today already listed above
          const mine = assignees[k] ? assignees[k] === cm.id : e.lead_editor_id === cm.id;
          if (!mine) continue;
          // Runner starts at the closest earlier filled milestone (same walk as the Crew Calendar)
          let start = null;
          for (const pk of MS_ORDER) {
            if (pk === k) break;
            if (ms[pk] && ms[pk] < due) start = ms[pk];
          }
          if (start && start <= today) {
            items.push({ kind: 'work', title: `Working: ${label} — ${e.title}`, subtitle: `${e.project_code || 'Avo'} · due ${due.slice(5).replace('-', '/')}`, link: `/avo/${e.id}` });
          }
        }
      }
    }
  return items;
}

router.get('/today', requireAuth, async (req, res, next) => {
  try {
    const today = bizToday();
    const tomorrowDate = bizToday(1);
    const cm = await myCrewMember(req.user.email);
    const items = cm ? await itemsFor(cm, today) : [];
    // Coming Tomorrow: same signals for the next day (skip in-progress noise)
    const tomorrow = cm ? (await itemsFor(cm, tomorrowDate)).filter(i => i.kind !== 'work') : [];
    // Open one-off project tasks assigned to me (fed from Project Overview pages)
    let tasks = [];
    if (cm) {
      tasks = await sql`
        SELECT t.id, t.text, t.due_date, t.done, t.notes, p.code as project_code, p.title as project_title, p.id as project_id
        FROM project_tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.assignee_id = ${cm.id} AND t.done IS NOT TRUE
        ORDER BY t.due_date NULLS LAST, t.created_at`;
    }
    res.json({ date: today, tomorrowDate, items, tomorrow, tasks });
  } catch (e) { next(e); }
});

// POST /api/dashboard/tasks — quick-add a task assigned to the signed-in user
router.post('/tasks', requireAuth, async (req, res, next) => {
  try {
    const cm = await myCrewMember(req.user.email);
    if (!cm) return res.status(400).json({ error: 'No crew member record matches your account email' });
    const { projectId, text, dueDate, notes, taggedId } = req.body;
    if (!projectId || !text?.trim()) return res.status(400).json({ error: 'Project and task text are required' });
    const [t] = await sql`
      INSERT INTO project_tasks (project_id, text, assignee_id, due_date, notes, created_by)
      VALUES (${projectId}, ${text.trim()}, ${cm.id}, ${dueDate || null}, ${notes || null}, ${req.user.name || req.user.email})
      RETURNING *`;
    // Tagging a teammate drops the same task on their My Tasks list too
    if (taggedId && taggedId !== cm.id) {
      const myName = [cm.preferred_first_name, cm.preferred_last_name].filter(Boolean).join(' ').trim() || cm.name || req.user.email;
      const tagNote = [`Tagged by ${myName}`, notes || null].filter(Boolean).join(' — ');
      await sql`
        INSERT INTO project_tasks (project_id, text, assignee_id, due_date, notes, created_by)
        VALUES (${projectId}, ${text.trim()}, ${taggedId}, ${dueDate || null}, ${tagNote}, ${req.user.name || req.user.email})`;
    }
    const [p] = await sql`SELECT code, title FROM projects WHERE id = ${projectId}`;
    res.status(201).json({ ...t, project_code: p?.code, project_title: p?.title, project_id: projectId });
  } catch (e) { next(e); }
});

// GET /api/dashboard/team — where every Unbridled team member is today
router.get('/team', requireAuth, async (req, res, next) => {
  try {
    const today = bizToday();
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
      // STL/DEN Only is a scheduling notation (no travel) — the person is still in office
      const p = pto.find(x => x.member_id === m.id && x.pto_type !== 'STL/DEN Only');
      if (p) return { id: m.id, name: m.name, status: 'out', location: homeOffice, detail: p.pto_type };
      const s = shoots.find(x => x.crew_member_id === m.id);
      if (s) return { id: m.id, name: m.name, status: 'shoot', location: s.city ? `${s.city}, ${s.state}` : 'On location', detail: s.code };
      const stlOnly = pto.find(x => x.member_id === m.id && x.pto_type === 'STL/DEN Only');
      return { id: m.id, name: m.name, status: 'office', location: homeOffice, detail: stlOnly ? 'STL/DEN only' : 'In office' };
    }));
  } catch (e) { next(e); }
});

// ── Hub greeting: one fun, casual, personal line per user per day ──

const DENVER_FIRSTS = ['anabelle', 'fabrizio'];

async function greetingContext(user) {
  const today = bizToday();
  const cm = await myCrewMember(user.email);
  const first = (user.name || user.email || 'there').trim().split(/\s+/)[0];
  const ctx = { first, weekday: new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }), date: today };
  ctx.homeOffice = DENVER_FIRSTS.includes(first.toLowerCase()) ? 'Denver' : 'St. Louis';
  if (cm) {
    const [trip] = await sql`
      SELECT pr.city, pr.state, pr.title, pr.code, ca.start_date
      FROM crew_assignments ca JOIN projects pr ON pr.id = ca.project_id
      WHERE ca.crew_member_id = ${cm.id} AND pr.status != 'ARCHIVED'
        AND COALESCE(ca.end_date, ca.start_date)::date >= ${today}
        AND ca.start_date::date <= ${bizToday(10)}
      ORDER BY ca.start_date LIMIT 1`;
    if (trip) ctx.trip = { city: trip.city, state: trip.state, title: trip.title, startsToday: iso(trip.start_date) <= today };
    const [pto] = await sql`
      SELECT title, pto_type, start_date FROM pto_requests
      WHERE member_id = ${cm.id} AND status = 'APPROVED' AND pto_type != 'STL/DEN Only'
        AND start_date >= ${today} AND start_date <= ${bizToday(14)}
      ORDER BY start_date LIMIT 1`;
    if (pto) ctx.pto = { type: pto.pto_type, startsIn: Math.round((new Date(iso(pto.start_date)) - new Date(today)) / 86400000) };
    const [fact] = await sql`SELECT prompt, answer FROM fun_facts WHERE member_email = ${(user.email || '').toLowerCase()} ORDER BY created_at DESC LIMIT 1`;
    if (fact) ctx.funFact = { prompt: fact.prompt, answer: fact.answer };
  }
  return ctx;
}

function fallbackGreeting(ctx) {
  if (ctx.trip) return ctx.trip.startsToday
    ? `Hey ${ctx.first}, have fun in ${ctx.trip.city || 'the field'} — go make something great 🎬`
    : `Hey ${ctx.first}, ${ctx.trip.city || 'a shoot'} is calling — pack the good snacks`;
  if (ctx.pto) return ctx.pto.startsIn <= 1
    ? `Hey ${ctx.first}, PTO starts basically now. Don't let the door hit ya 🏝️`
    : `Hey ${ctx.first}, PTO in ${ctx.pto.startsIn} days — you can make it`;
  const byDay = {
    Monday: `Hey ${ctx.first}, Mondays are Monday-ing. Coffee first, everything else second.`,
    Tuesday: `Hey ${ctx.first}, Tuesday: like Monday, but with less excuses.`,
    Wednesday: `Hey ${ctx.first}, it's the hump. Over we go.`,
    Thursday: `Hey ${ctx.first}, Thursday is just Friday's opening act.`,
    Friday: `Hey ${ctx.first}, it's Friday — the timeline can smell the weekend.`,
    Saturday: `Hey ${ctx.first}, working on a Saturday? Legend. Or concerning. Maybe both.`,
    Sunday: `Hey ${ctx.first}, Sunday scaries have nothing on you.`,
  };
  return byDay[ctx.weekday] || `Hey ${ctx.first}, go be great today.`;
}

async function aiGreeting(ctx) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const facts = [
      `Name: ${ctx.first}`, `Day: ${ctx.weekday}, ${ctx.date}`, `Home office: ${ctx.homeOffice}`,
      ctx.trip ? `Upcoming/current travel gig: ${ctx.trip.title} in ${ctx.trip.city || 'the field'}${ctx.trip.state ? ', ' + ctx.trip.state : ''}${ctx.trip.startsToday ? ' (on it now)' : ' (soon)'}` : null,
      ctx.pto ? `PTO (${ctx.pto.type}) starts in ${ctx.pto.startsIn} day(s)` : null,
      ctx.funFact ? `Their fun fact — Q: ${ctx.funFact.prompt} A: ${ctx.funFact.answer}` : null,
    ].filter(Boolean).join('\n');
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 100,
        messages: [{ role: 'user', content:
          `Write ONE short, fun, casual greeting line for a video production company's internal dashboard. Start with "Hey ${ctx.first}," and riff on exactly one of these details (travel gig > PTO > fun fact > day of week/city, in that priority). Keep it under 18 words, playful, a little irreverent, no hashtags, at most one emoji. Examples of the vibe: "Hey Alex, Mondays are Monday-ing" / "Hey Alex, have fun in Chicago this week" / "Hey Alex, PTO is almost here, you can make it".\n\nDetails:\n${facts}\n\nReply with ONLY the greeting line.` }],
      }),
    });
    const j = await r.json();
    const text = (j.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '');
    return text && text.length < 160 ? text : null;
  } catch (e) { console.error('greeting AI failed:', e.message); return null; }
}

router.get('/greeting', requireAuth, async (req, res, next) => {
  try {
    const today = bizToday();
    const key = (req.user.email || req.user.id || '').toLowerCase();
    const [hit] = await sql`SELECT text FROM daily_greetings WHERE user_key = ${key} AND day = ${today}`;
    if (hit) return res.json({ text: hit.text });
    const ctx = await greetingContext(req.user);
    const text = (await aiGreeting(ctx)) || fallbackGreeting(ctx);
    await sql`INSERT INTO daily_greetings (user_key, day, text) VALUES (${key}, ${today}, ${text})
      ON CONFLICT (user_key, day) DO UPDATE SET text = ${text}`;
    res.json({ text });
  } catch (e) { next(e); }
});

// ── UM Fun Facts ──
// Weekly: everyone gets their own prompt to answer (first login of the week).
// Daily: one teammate's fact takes over the Team Today card as a blob.

const FUN_PROMPTS = [
  "What's the weirdest food combo you secretly love?",
  'What was your first concert?',
  "What's a movie you can quote start to finish?",
  'What job did you want as a kid?',
  "What's your most useless talent?",
  "What's the best meal you've ever had on a shoot or trip?",
  'If you could live in any city for a year, where?',
  "What's a song you'll never skip?",
  "What's your guilty-pleasure TV show?",
  'Whats the most famous person you have ever met?',
  "What's one thing on your bucket list?",
  'Coffee order — be honest.',
  "What's the best piece of advice you've ever gotten?",
  'What hobby would you pick up if time and money were no object?',
  "What's your go-to karaoke song?",
  'Whats a smell that instantly takes you back?',
  "What's the strangest thing in your camera bag / desk drawer right now?",
  'If you had a walk-up song, what would it be?',
  "What's a food you refuse to eat, no exceptions?",
  'Dream vacation: beach, mountains, or city?',
  "What's your favorite family tradition?",
  'What game could you play forever?',
  'Whats the best gift you have ever received?',
  "What's a skill you learned purely from YouTube?",
  'If you opened a restaurant, what would it serve?',
  "What's your favorite word?",
  'Whats the last photo on your camera roll (describe it)?',
  'Cats, dogs, or something weirder?',
  "What's a trend you'll never understand?",
  'Whats your comfort movie?',
  'If you could instantly master one instrument, which?',
  "What's the farthest you've ever been from home?",
  'Whats your midnight snack of choice?',
  'What fictional place would you move to?',
  "What's the best live event you've ever attended?",
];

const isoWeek = d => {
  const dt = new Date(d + 'T12:00:00');
  const jan = new Date(dt.getFullYear(), 0, 1);
  return `${dt.getFullYear()}-W${String(Math.ceil((((dt - jan) / 86400000) + jan.getDay() + 1) / 7)).padStart(2, '0')}`;
};
const hashStr = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

router.get('/funfact/prompt', requireAuth, async (req, res, next) => {
  try {
    const week = isoWeek(bizToday());
    const key = (req.user.email || '').toLowerCase();
    const prompt = FUN_PROMPTS[hashStr(key + week) % FUN_PROMPTS.length];
    const [done] = await sql`SELECT id FROM fun_facts WHERE member_email = ${key} AND week = ${week}`;
    res.json({ week, prompt, answered: !!done });
  } catch (e) { next(e); }
});

router.post('/funfact', requireAuth, async (req, res, next) => {
  try {
    const answer = String(req.body.answer || '').trim();
    if (!answer) return res.status(400).json({ error: 'Give us something!' });
    const week = isoWeek(bizToday());
    const key = (req.user.email || '').toLowerCase();
    const prompt = FUN_PROMPTS[hashStr(key + week) % FUN_PROMPTS.length];
    await sql`INSERT INTO fun_facts (member_email, member_name, prompt, answer, week)
      VALUES (${key}, ${req.user.name || key}, ${prompt}, ${answer.slice(0, 500)}, ${week})`;
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Today's fact — rotates through everything submitted, one per day
router.get('/funfact/today', requireAuth, async (req, res, next) => {
  try {
    const facts = await sql`SELECT member_name, prompt, answer FROM fun_facts ORDER BY created_at`;
    if (!facts.length) return res.json(null);
    const dayN = Math.floor(new Date(bizToday() + 'T12:00:00').getTime() / 86400000);
    const f = facts[dayN % facts.length];
    res.json({ name: f.member_name, prompt: f.prompt, answer: f.answer });
  } catch (e) { next(e); }
});

module.exports = router;
