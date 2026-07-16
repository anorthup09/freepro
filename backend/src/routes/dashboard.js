const router = require('express').Router();
const sql = require('../lib/db');
const { requireAuth, requireRole } = require('../middleware/auth');
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

// Best-effort city from a full address ("…, Denver, Colorado, 80203, USA" → Denver)
function cityFromAddress(addr) {
  if (!addr) return null;
  const parts = String(addr).split(',').map(x => x.trim()).filter(Boolean)
    .filter(x => !/^united states$/i.test(x) && !/^usa$/i.test(x) && !/^\d{5}(-\d{4})?$/.test(x) && !/^\d+$/.test(x));
  if (!parts.length) return null;
  const last = parts[parts.length - 1];
  // "KC 64105" / "Kansas City MO 64105" — city is the alpha run before state/zip
  const m = last.match(/^([A-Za-z. ]+?)\s+(?:[A-Z]{2}\s+)?\d{5}/) || last.match(/^([A-Za-z. ]+?)\s+[A-Z]{2}$/);
  if (m) return m[1].trim();
  // last segment is the state ("MO" / "Colorado") — city is the segment before it
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}
// A usable city has to contain letters — placeholder dashes ("—", "–", "- -")
// and bare punctuation from empty form fields all get rejected
const realCity = c => { const s = String(c || '').trim(); return s && /[A-Za-z]/.test(s) ? s : null; };

async function greetingContext(user) {
  const today = bizToday();
  const cm = await myCrewMember(user.email);
  const first = (user.name || user.email || 'there').trim().split(/\s+/)[0];
  const ctx = { first, weekday: new Date(today + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }), date: today };
  ctx.homeOffice = DENVER_FIRSTS.includes(first.toLowerCase()) ? 'Denver' : 'St. Louis';
  if (cm) {
    const [trip] = await sql`
      SELECT pr.id as project_id, pr.city, pr.state, pr.title, pr.code, ca.start_date
      FROM crew_assignments ca JOIN projects pr ON pr.id = ca.project_id
      WHERE ca.crew_member_id = ${cm.id} AND pr.status != 'ARCHIVED'
        AND COALESCE(ca.end_date, ca.start_date)::date >= ${today}
        AND ca.start_date::date <= ${bizToday(10)}
      ORDER BY ca.start_date LIMIT 1`;
    if (trip) {
      // The shoot's real location comes from the schedule: the day's weather
      // location first, then a located venue's address, then the project record
      let city = null, state = null;
      const [wd] = await sql`
        SELECT weather_location_name FROM shoot_days
        WHERE project_id = ${trip.project_id} AND weather_location_name IS NOT NULL
        ORDER BY date LIMIT 1`;
      if (realCity(wd?.weather_location_name)) city = realCity(wd.weather_location_name);
      if (!city) {
        const locs = await sql`
          SELECT address FROM locations
          WHERE project_id = ${trip.project_id} AND address IS NOT NULL
          ORDER BY (type = 'PRIMARY_VENUE') DESC, name LIMIT 6`;
        for (const l of locs) { const c = realCity(cityFromAddress(l.address)); if (c) { city = c; break; } }
      }
      if (!city) { city = realCity(trip.city); state = realCity(trip.state); }
      ctx.trip = { city, state, title: trip.title, startsToday: iso(trip.start_date) <= today };
    }
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
    Monday: `Hey ${ctx.first}, Mondays are Monday-ing. The coffee knows what it signed up for.`,
    Tuesday: `Hey ${ctx.first}, Tuesday: Monday's sequel nobody asked for.`,
    Wednesday: `Hey ${ctx.first}, halfway there. The camel has been notified.`,
    Thursday: `Hey ${ctx.first}, Thursday is just Friday wearing a lanyard.`,
    Friday: `Hey ${ctx.first}, it's Friday — the render bar can smell the weekend.`,
    Saturday: `Hey ${ctx.first}, working on a Saturday? Legend. Or concerning. Maybe both.`,
    Sunday: `Hey ${ctx.first}, logging in on a Sunday? We're telling HR. (We are HR.)`,
  };
  return byDay[ctx.weekday] || `Hey ${ctx.first}, go be great today. Or adequate. We'll take adequate.`;
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
          `Write ONE short greeting line for the internal dashboard of a video production company full of funny people who roast each other lovingly. Start with "Hey ${ctx.first}," then GO FOR THE LAUGH — this crowd rewards actual jokes, not pleasantries. Riff on whatever's funniest today: their travel gig, PTO countdown, fun fact, the day of the week, their city's weather stereotype, Midwest life, production-world pain (call times, client notes, "can you make the logo bigger"), coffee dependency, whatever. Absurdist, deadpan, gently roasty all welcome. Surprise them; never be formulaic or corporate-cute. If they have a travel gig or PTO coming up, that's usually comedy gold, but you're not required to use it. Keep it under 18 words, no hashtags, at most one emoji. Vibe examples: "Hey Alex, Mondays are Monday-ing" / "Hey Alex, it's hot af in St. Louis today, amirite?" / "Hey Alex, Chicago this week — try not to expense an entire deep dish" / "Hey Alex, PTO in 2 days. Blink twice if you're rendering".\n\nWhat we know about them today:\n${facts}\n\nReply with ONLY the greeting line.` }],
      }),
    });
    const j = await r.json();
    const text = (j.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '');
    return text && text.length < 160 ? text : null;
  } catch (e) { console.error('greeting AI failed:', e.message); return null; }
}

// On a trip today? Hand back the public share view matching the user's role
// so the hub can offer a one-tap jump (admin/producer/agency -> producer view,
// crew -> crew view)
router.get('/on-trip', requireAuth, async (req, res, next) => {
  try {
    const today = bizToday();
    const cm = await myCrewMember(req.user.email);
    if (!cm) return res.json(null);
    const [trip] = await sql`
      SELECT pr.id, pr.code, pr.title, pr.city, pr.state
      FROM crew_assignments ca JOIN projects pr ON pr.id = ca.project_id
      WHERE ca.crew_member_id = ${cm.id} AND pr.status != 'ARCHIVED'
        AND ca.start_date::date <= ${today} AND COALESCE(ca.end_date, ca.start_date)::date >= ${today}
      ORDER BY ca.start_date LIMIT 1`;
    if (!trip) return res.json(null);
    const viewType = req.user.role === 'CREW' ? 'crew' : 'producer';
    let [share] = await sql`
      SELECT token FROM project_shares
      WHERE project_id = ${trip.id} AND view_type = ${viewType} AND talent_name IS NULL AND crew_group_id IS NULL
      LIMIT 1`;
    if (!share) {
      [share] = await sql`
        INSERT INTO project_shares (id, project_id, token, view_type)
        VALUES (gen_random_uuid()::text, ${trip.id}, gen_random_uuid()::text, ${viewType})
        RETURNING token`;
    }
    res.json({ project: { id: trip.id, code: trip.code, title: trip.title, city: trip.city, state: trip.state }, token: share.token, viewType });
  } catch (e) { next(e); }
});

router.get('/greeting', requireAuth, async (req, res, next) => {
  try {
    const today = bizToday();
    const key = (req.user.email || req.user.id || '').toLowerCase();
    const [hit] = await sql`SELECT text FROM daily_greetings WHERE user_key = ${key} AND day = ${today}`;
    // A cached greeting with a placeholder city ("in — —", "in undefined") is
    // broken — regenerate instead of serving it all day
    if (hit && !/\bin\s+[—–-]\s|\bin undefined\b/.test(hit.text)) return res.json({ text: hit.text });
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
  // Food & drink
  "What's the weirdest food combo you secretly love?",
  'Coffee order — be honest, we can see the cup from here.',
  "What's a food you refuse to eat, no exceptions?",
  "What's your 11:47pm standing-in-the-fridge-light snack of choice?",
  'If you opened a restaurant, what would it serve?',
  "What's the best meal you've ever had on a shoot or trip?",
  'Last meal on Earth — and no, you can\'t say "a little bit of everything".',
  "What's your most controversial food opinion?",
  'Pineapple on pizza: defend your position.',
  "What's the one dish you actually cook well?",
  "What's your gas-station road-trip snack strategy?",
  'Breakfast for dinner or dinner for breakfast? There is a correct answer.',
  "What's a restaurant you'd drive two hours for?",
  'What condiment would you defend physically?',
  // Music & movies
  'First concert — and yes, the embarrassing one counts double.',
  "What movie can you quote start to finish (and force others to endure)?",
  "What's a song you'll never skip?",
  "What's your guilty-pleasure TV show?",
  "What's your go-to karaoke song?",
  'If you had a walk-up song, what would it be?',
  "What's your comfort movie?",
  'If you could instantly master one instrument, which?',
  "What's the best live event you've ever attended?",
  'What album could you listen to front to back forever?',
  "What's a movie everyone loves that you just don't get?",
  'What song do you know every word to that would surprise people?',
  "First CD/tape/download you ever bought — this is a judgment-full zone.",
  'Which movie universe would you actually survive in?',
  "What's your favorite one-liner from any movie?",
  'What show did you binge embarrassingly fast?',
  // Childhood & growing up
  'What job did you want as a kid, before the world said "video"?',
  "What's your favorite family tradition?",
  'What cartoon did you race home to watch?',
  "What's the most trouble you got into as a kid?",
  'What did you spend your first paycheck on?',
  'Childhood nickname — and the story you tell people vs. the real one.',
  "What's a toy you begged for and finally got?",
  'What did your family always have in the fridge?',
  'What were you unreasonably afraid of as a kid?',
  "What's the first thing you remember saving up for?",
  // College & school days
  'College major — and would you pick it again under oath?',
  "What's the best class you ever took?",
  'What was your go-to late-night study fuel?',
  "What's your most legendary college story you can tell at work?",
  'What extracurricular were you weirdly committed to?',
  'Dorm life or off-campus — describe the worst kitchen you survived.',
  'What class did you take purely because it sounded easy?',
  // Work & talents
  "What's your most useless talent?",
  "What's a skill you learned purely from YouTube?",
  "What's the strangest thing in your camera bag / desk drawer right now?",
  "What's the best piece of advice you've ever gotten?",
  'What would you do for work if video/production didn\'t exist?',
  "What's your weirdest on-set or on-the-job story?",
  'What productivity hack actually works for you?',
  "What's a tool or app you can't work without?",
  'First job ever — the more embarrassing the uniform, the better.',
  "What's something you're better at than 90% of people?",
  // Travel & adventure
  'If you could live in any city for a year, where?',
  'Dream vacation: beach, mountains, or city?',
  "What's the farthest you've ever been from home?",
  "What's one thing on your bucket list?",
  "What's the best souvenir you've ever brought home?",
  'Window seat or aisle — wrong answers will be mocked.',
  "What's a place you'd go back to tomorrow?",
  "What's your worst travel disaster story?",
  'If you had a free month and unlimited miles, where first?',
  'Camping under stars or five-star hotel?',
  // Favorites & random
  "What's the most famous person you have ever met?",
  'What hobby would you pick up if time and money were no object?',
  "What's a smell that instantly takes you back?",
  'What game could you play forever?',
  "What's the best gift you have ever received?",
  "What's your favorite word? Bonus points if HR would frown.",
  "What's the last photo on your camera roll (describe it)?",
  'Cats, dogs, or something the landlord doesn\'t know about?',
  "What's a trend you'll never understand?",
  'What fictional place would you move to?',
  'What would the title of your autobiography be?',
  "What's your most-used emoji? We will be checking your texts.",
  'If animals could talk, which would be the rudest?',
  "What's a hill you'll absolutely die on?",
  'What superpower would you pick — but it has to be mildly inconvenient?',
  "What's your unpopular opinion about the Midwest?",
  'If you won the lottery tomorrow, what\'s the first dumb thing you\'d buy?',
  "What do you own way too many of? Be honest, hoarder.",
  'What conspiracy theory do you low-key enjoy?',
  "What's your hidden talent nobody at work knows about?",
  'What decade had the best everything? (Saying the one you were born in is cheating.)',
  "What's the best costume you've ever worn?",
  'If your pet (real or future) had a job, what would it be?',
  "What's a sound you absolutely cannot stand?",
  'What tiny thing makes your whole day better?',
  "What's your go-to fun fact when someone traps you in an icebreaker?",
  'If you could have dinner with anyone, living or dead, who?',
  "What's the most spontaneous thing you've ever done?",
  'What would you name a boat if you had one?',
  "What's your favorite holiday and why is it wrong if it isn't Halloween?",
  'What skill do you want to learn this year?',
  "What's the most Midwest thing you've ever said or done?",
  "What's the best prank you've ever pulled (or had pulled on you)?",
];

const isoWeek = d => {
  const dt = new Date(d + 'T12:00:00');
  const jan = new Date(dt.getFullYear(), 0, 1);
  return `${dt.getFullYear()}-W${String(Math.ceil((((dt - jan) / 86400000) + jan.getDay() + 1) / 7)).padStart(2, '0')}`;
};
const hashStr = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

// Ways of Being: every week two people are chosen (deterministically) to
// shout out a teammate going above and beyond. Their weekly prompt becomes
// the WoB ask — and it isn't skippable.
const WOB_PROMPT = 'Give a quick Ways of Being for someone going above and beyond';

async function wobChosen(week) {
  const users = await sql`SELECT email FROM users WHERE role NOT IN ('PENDING', 'CLIENT', 'AGENCY', 'CREW') AND email IS NOT NULL`;
  return users
    .map(u => ({ e: u.email.toLowerCase(), h: hashStr(week + '|' + u.email.toLowerCase()) }))
    .sort((a, b) => a.h - b.h)
    .slice(0, 2).map(x => x.e);
}

router.get('/funfact/prompt', requireAuth, async (req, res, next) => {
  try {
    const week = isoWeek(bizToday());
    const key = (req.user.email || '').toLowerCase();
    if ((await wobChosen(week)).includes(key)) {
      const [done] = await sql`SELECT id FROM ways_of_being WHERE giver_email = ${key} AND week = ${week}`;
      const team = await sql`
        SELECT ${sql.unsafe(PREF)} as name, cm.email FROM crew_members cm
        WHERE cm.company ILIKE '%unbridled%' AND cm.is_active IS NOT FALSE AND cm.email IS NOT NULL
        ORDER BY 1`;
      return res.json({ kind: 'wob', week, prompt: WOB_PROMPT, answered: !!done,
        team: team.map(t => ({ name: t.name, email: t.email })) });
    }
    const prompt = FUN_PROMPTS[hashStr(key + week) % FUN_PROMPTS.length];
    const [done] = await sql`SELECT id FROM fun_facts WHERE member_email = ${key} AND week = ${week}`;
    res.json({ kind: 'fact', week, prompt, answered: !!done });
  } catch (e) { next(e); }
});

// Submit a Ways of Being shoutout
router.post('/wob', requireAuth, async (req, res, next) => {
  try {
    const text = String(req.body.text || '').trim();
    const recipientName = String(req.body.recipientName || '').trim();
    if (!text || !recipientName) return res.status(400).json({ error: 'Pick a teammate and write the shoutout' });
    const week = isoWeek(bizToday());
    await sql`INSERT INTO ways_of_being (giver_email, giver_name, recipient_email, recipient_name, text, week)
      VALUES (${(req.user.email || '').toLowerCase()}, ${req.user.name || req.user.email},
        ${(req.body.recipientEmail || '').toLowerCase() || null}, ${recipientName}, ${text.slice(0, 800)}, ${week})`;
    res.status(201).json({ ok: true });
  } catch (e) { next(e); }
});

// Shoutouts about me (recipient's hub banner) — last 30 days
router.get('/wob/mine', requireAuth, async (req, res, next) => {
  try {
    const rows = await sql`
      SELECT giver_name, text, created_at FROM ways_of_being
      WHERE recipient_email = ${(req.user.email || '').toLowerCase()}
        AND created_at > NOW() - INTERVAL '30 days'
      ORDER BY created_at DESC LIMIT 5`;
    res.json(rows);
  } catch (e) { next(e); }
});

// Every Ways of Being ever — Admin report
router.get('/wob/all', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
  try {
    res.json(await sql`SELECT giver_name, recipient_name, text, week, created_at FROM ways_of_being ORDER BY created_at DESC`);
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

// Visual garnish for a fact: an emoji, or a photo (Wikipedia page image) of
// whatever the answer is about. Computed once per fact and cached on the row
// as 'emoji:X', an https URL, or 'none'.
async function wikiImage(term) {
  try {
    const u = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1&gsrsearch=${encodeURIComponent(term)}&prop=pageimages&piprop=thumbnail&pithumbsize=900&format=json`;
    const r = await fetch(u, { headers: { 'User-Agent': 'UnbridledOperatingPlatform/1.0 (info@unbridledmedia.com)' } });
    const j = await r.json();
    for (const p of Object.values(j.query?.pages || {})) if (p.thumbnail?.source) return p.thumbnail.source;
  } catch (e) { console.error('wiki image failed:', e.message); }
  return null;
}

async function factVisual(prompt, answer) {
  if (!process.env.ANTHROPIC_API_KEY) return 'none';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 40,
        messages: [{ role: 'user', content:
          `Q: ${prompt}\nA: ${answer}\n\nPick a background visual for this answer. Reply with EXACTLY one line:\n- "IMG: <1-3 word search term>" if the answer centers on something photographable with a recognizable Wikipedia image (a city, landmark, food, movie, band, animal, object)\n- "EMOJI: <one emoji>" if a single emoji nails it better\n- "NONE" if neither fits.` }],
      }),
    });
    const j = await r.json();
    const line = (j.content?.[0]?.text || '').trim();
    const em = line.match(/^EMOJI:\s*(\S+)/i);
    if (em) return 'emoji:' + em[1];
    const im = line.match(/^IMG:\s*(.+)/i);
    if (im) {
      const url = await wikiImage(im[1].trim());
      if (url) return url;
    }
  } catch (e) { console.error('fact visual failed:', e.message); }
  return 'none';
}

// Today's fact — rotates through everything submitted, one per day
router.get('/funfact/today', requireAuth, async (req, res, next) => {
  try {
    const facts = await sql`SELECT id, member_name, prompt, answer, image_url FROM fun_facts ORDER BY created_at`;
    // Ways of Being shoutouts join the daily rotation
    const wobs = await sql`SELECT id, giver_name, recipient_name, text, created_at FROM ways_of_being ORDER BY created_at`;
    const pool = [
      ...facts.map(x => ({ kind: 'fact', ...x })),
      ...wobs.map(x => ({ kind: 'wob', ...x })),
    ];
    if (!pool.length) return res.json(null);
    const dayN = Math.floor(new Date(bizToday() + 'T12:00:00').getTime() / 86400000);
    const f = pool[dayN % pool.length];
    if (f.kind === 'wob') {
      return res.json({ kind: 'wob', name: f.giver_name, recipient: f.recipient_name, answer: f.text,
        prompt: `Ways of Being — shouting out ${f.recipient_name}`, image: { type: 'emoji', value: '🏆' } });
    }
    let visual = f.image_url;
    if (!visual) {
      visual = await factVisual(f.prompt, f.answer);
      await sql`UPDATE fun_facts SET image_url = ${visual} WHERE id = ${f.id}`.catch(() => {});
    }
    const image = visual && visual !== 'none'
      ? (visual.startsWith('emoji:') ? { type: 'emoji', value: visual.slice(6) } : { type: 'photo', value: visual })
      : null;
    res.json({ kind: 'fact', name: f.member_name, prompt: f.prompt, answer: f.answer, image });
  } catch (e) { next(e); }
});

module.exports = router;
