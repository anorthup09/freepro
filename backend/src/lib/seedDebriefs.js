// One-time import of post-mortem debriefs (Start / Stop / Continue / Notes).
// Idempotent: an entry is skipped if the same project + kind + text already
// exists. Projects are matched by code; unmatched debriefs are logged. Also sets
// each project's program tag (only if it doesn't already have one).
const sql = require('./db');

const AUTHOR = 'Post-Mortem Import';

const DEBRIEFS = [
  {
    code: '02.STB00126', program: 'Investor Day', client: 'Starbucks',
    title: 'Starbucks Investor Day 2026', startDate: '2026-01-01', city: '', state: '',
    start: [
      'Utilizing SFX in rough cuts and initial deliveries for pre-produced edits.',
      'Arranging backup editor or Plan B for lingering edit on recap video day after event.',
      'Confirm and ensure working space for editor and our gear before arriving at event.',
      'Ensure ISO settings are the same across all cameras with Tyler H.',
      'Create meetings with Brandon and editor.',
      'Holding weekend before event for pivots.',
    ],
    stop: [
      'Sending all archive B-roll in lots of TB - find a way to be more deliberate about what footage is being used for which video.',
      'Getting exec feedback earlier in the process of editing to make sure it is aligned.',
    ],
    continue: [
      'Telling Brandon NO on recap notes if the client approves it at event.',
      'Charging a premium for the last-minute logistics.',
    ],
    note: [
      'Editors and Solutions creative leads need more direct, face-to-face conversations for successful deliverables - especially on ambitious videos and higher-profile clients. Face-to-face creates a collaborative environment, shared artistic ownership, and connection between the creative lead on the project and the editor executing the work.',
      'Example editor/creative-lead conversation scripts: "Client has a lot of big picture notes, here is generally how I think we can best accomplish these in our next cut together." / "I read through the client notes, here is what I think is realistic given where we are currently at, and here are my expectations for the next cut." / "This updated cut you sent is not working or hitting the mark I am after, here are the reasons why." / "Music is an important part to establish the style and rhythm of this video - here is what we need to find (or a track we should use). Let\'s align on this as early as possible." / "Let\'s kick off this big editing project together - here is a brief with mandatories, but let me explain exactly what we are going for in my own words, what I am expecting, and my vision, so we are aligned before you start editing." / "The client has moved the goal posts. Here is how they want this video to be different from what we were originally aligned on, and here are my new expectations for the next cut." / "Here are references (past and new) that hit the mark for the style we are going for, to help you better understand what I am expecting." / "There are a lot of eyes on this video and the expectations around tone and execution are very specific." / "Do you feel like you have a crystal-clear understanding of the specific tone for this video right now?" / "Let\'s make sure you understand exactly what that tone is and the execution expectations, and that we are aligned before you start editing this piece again." / "The direction I am about to give is not directly from client, but my best educated guess at how to make this video the best it can be with limited info. Let\'s accomplish this take, then recalibrate once client gives more direct feedback."',
    ],
  },
  {
    code: '02.ASM05725', program: 'LPL Focus', client: 'LPL Financial',
    title: 'LPL Focus 2025', startDate: '2025-08-01', city: 'San Diego', state: 'CA',
    start: [
      'Define realistic amount of social output for on-site team for a 10-hour day and set expectations ahead of event.',
      'If lift goes over that - we will need to bill overtime or add extra bodies.',
      'Ask for a compliance person to be with the social team to help with review/approval process.',
      'Must have 9 total spots for backstage/table media workstations.',
      'Dial back reds in color correction by 10%-16% for final delivery.',
      'Include a rock and roller cart in gear rentals if we have dedicated interview setups.',
      'Test shoot scheduling for special shoots/rigging needs ahead of on-site shooting.',
      'Review recap video at 1pm instead of 12pm - need that extra hour.',
    ],
    stop: [
      'Asking open Q/A questions for SME interviews - creates interviews that are too long and editors lose time sifting through.',
      'Delivering final pre-produced video assets to productions as combined files - send final mix and final color files separately instead.',
    ],
    continue: [
      'Bring an onsite editor dedicated solely to pre-produced video management and revisions at event on site.',
      'Alex Yorchik did a great job with recap.',
      'Legit drone permits for San Diego were a big win and helped the team remain efficient and cover bases. Start this months in advance.',
    ],
    note: [
      'San Diego Event + Cash Cab.',
      'Bobby idea - could have social be in a centralized single place where people come to us, rather than hunting them down.',
      'Wash the backdrop.',
    ],
  },
  {
    code: '02.GRA90625', program: 'Fall NTC', client: 'Graybar',
    title: 'Graybar Fall NTC 2025', startDate: '2025-10-01', city: 'Orlando', state: 'FL',
    start: [
      'Minimize trade show footage to a single day - determine any necessary trade show footage to minimize needless overshooting.',
      'Write dedicated breaks into the schedule so client and company are all aware.',
      'Determine any necessary party/post-event social coverage needed ahead of the event and adjust our schedule to compensate ahead of time.',
      'Put Tyler on the supplier product shoot if possible - use Fab for recap.',
    ],
    stop: [
      'Hotel - ensure that Marriott World Orlando is flagged and not used in future if possible.',
    ],
    continue: [
      'Suppliers were super impressed with the product video capture - big win.',
      'Build extra time into the schedule for the supplier product shoots - what Anabelle allocated on schedule for this NTC was perfect.',
      'Renting the gear locally from Pro Gear Studio and having it delivered was a huge relief and a big logistical win.',
      'Luke was great, continue working with him. Swing/gaffer on this project - primarily camera and editor.',
    ],
  },
  {
    code: '02.FAS06125', program: 'Rankin AU', client: 'FAST',
    title: 'FAST Rankin AU Shoot 2025', startDate: '2025-07-01', city: '', state: '',
    start: [
      'Share the International Travel Requirements doc with anyone selling-in new international projects to help with accurate planning and scoping.',
      'Pad more time in layovers to allow Carnet sign and gear re-checks.',
      'Push for media presence on pre-pro to ensure correct number of shooters, audio needs, and nuts-and-bolts execution is realistic.',
      'Explore local options for extra hands/extra shooters coverage.',
    ],
    stop: [
      'Australia specifically - stop bringing large amounts of gear, plenty of options for local rental gear solutions.',
      'Stop sending only 1 camera and 1 photo person for this event specifically - needs at least 2 camera and 2 photo for this type of recap for coverage and spreading gear lift.',
      'Stop scoping and executing family/personal events the same way as an efficient corporate event.',
    ],
    continue: [
      'We will continue to use Carnets moving forward for any gear we bring from the USA.',
      'Carnet expectation - may not be necessary for certain countries if gear is minimal, such as camera body only.',
      'Rebel Playground (or other local production team members) can help with any last-minute hiring and gear rentals.',
      'Work with videographer Adam locally for extra help!',
    ],
    note: [
      'Carnet stamps must be stamped at the last location before leaving the country.',
      'Never had direct contact with Jenny (client), which made the project difficult.',
    ],
  },
  {
    code: '02.ASMSLT90025', program: 'SALT Cannes', client: 'SALT / Amazon',
    title: 'SALT Cannes 2025', startDate: '2025-06-01', city: 'Cannes', state: 'France',
    start: [
      'Prioritize renting locally for gear instead of Carnet if possible - especially for larger studio shoots. Inflate gear budget to cover rental costs.',
      'Carnets are expensive - add an additional $500 at least as a line item for each Carnet, outside of normal gear allocation, if used for international.',
      'Schedule the gear house to drop off and pick up the gear if possible.',
      '2 days early arrival for international is crucial. Flight delays and international logistics make this a need-to-have, not nice-to-have. Budget for these extra days.',
      'Remember cars are very small in Europe for gear transpo. Consider 2 rental cars for the purpose of 1.',
      'Reserve gear/hotel 6 months in advance or else do not rely on it for international.',
      'Have a plan for breakfast and water bottles on site.',
      'Work in double per-diem allocations next time - costs are much higher for everything in Europe.',
      'Ethernet adapters - bring them on any international!',
      'Stock up on snacks/food/breakfast for homebase before go-time.',
    ],
    stop: [
      'Ubers were a problem in Europe - never on time, very slow, and more expensive than expected. Rent cars instead if possible.',
      'Do not use a secondary company for recap video if possible - working with Franc was rough.',
      'Stop using MXF RAW - shoot in .MP4 with color baked in for ease of delivery and sharing for SALT/Amazon.',
      'Do not eat the food at the event, even if client encourages you to - Amazon does not like it.',
      'Do not use tap pay, try to always use chip. Lots of credit cards were failing. Avoid multiple charges in the same location. Discover does not work. Have a backup Visa.',
      'Do not use high-profile mics for the podcast - they got in the way and were too tall visually. Use low-profile mics.',
    ],
    continue: [
      'Send someone early to secure gear before the shoot starts - especially with international.',
      'Getting the location/room measurements to mimic and test at home before the shoot was crucial - very limited on time with international travel logistics.',
      'The scheduling and the breaks worked out great and were necessary.',
      'Vibes with client were great!',
      'Use AI transcripts for these heavy-dialogue quick-turn needs.',
      'Cost-wise, Airbnb may be the best lodging option.',
      'Corey and Ryan were great to work with!',
    ],
    note: [
      'Notes from the SALT recap call 7.9.25.',
      'Involve Unbridled more in the planning phase for unboxed. Need help setting up for 3-speaker capture without blocking people.',
      'Delivery spec: full color, sync and audio edit + project file.',
      'Deliver within 24-48 hours.',
      'Add a body for this.',
      'Tech specs to detail what the partners are actually going to get and steps for finishing post-event.',
    ],
  },
  {
    code: '02.ASM92425', program: "Women's Forum", client: 'Assetmark',
    title: "Assetmark Women's Forum 2025", startDate: '2025-06-01', city: '', state: '',
    start: [
      'Assetmark specific - understand if a project is associated with other Solutions collaborators and, if so, connect with Sabrina earlier. Neither of us knew the other party was involved until right before the event.',
      'Consider rental car costs vs Ubers in more detail when deciding travel cost allocations in the budget. Extra Uber rides beyond arrival/departure were not accounted for and may have cost the same as a rental car - which would have been more convenient for the ground team.',
      'DIT - when shooting for multiple Post projects, schedule a quick meeting to set folder structure/organization instead of doing it on the fly at the shoot.',
      'Gear walkthrough - schedule an official final gear walkthrough on calendar 24-48 hours before shoot to double-check all prepped gear with the production team, not just Mason.',
      'Load/unload/setup - if load-in details are unclear, pad extra time for load in/out. Load-in options were limited here, it took much longer than anticipated, and ended in non-planned OT payment for a contractor.',
    ],
    stop: [
      'Staying off-site during events when at all possible. Push for on-site lodging early - we may have gotten a hotel on site if Sabrina knew we needed it earlier in the process.',
    ],
    continue: [
      'Work with Dan Dunneman, gaffer! Went the extra mile and charged very fairly. Brings lots of carts, which saved our butts.',
      'Home Goods/Target run by producer upon arrival if possible - for art, decor, props. Makes a huge difference in a bland room.',
      'Location info - push for shooting location specifics, pictures, or measurements early. Results in setup efficiencies, clearer budgeting, and reduced risk of over-promising.',
    ],
  },
  {
    code: '02.ASM02426', program: 'Gold Forum', client: 'Assetmark',
    title: 'Assetmark Gold Forum 2026', startDate: '2026-01-01', city: '', state: '',
    start: [
      'Add more budget to fly in good crew instead of relying on the local market if possible.',
      'Have a conversation with Jordan re: Jimmy to prepare her for next year.',
      'Use Jimmy as drone operator!',
      'Ask Jordan for more oversight with the social team - it needs a dedicated ASM person with authority of oversight (having to ask Jordan is not helpful).',
      'Get approved bumpers and title cards for pre-produced videos!',
    ],
    stop: [
      'Using brokers for filling contractor positions - contact people directly.',
      'Bad gaffer and audio.',
      'Using Jimmy as shooter or crew.',
      'Jerome - using color references that do not match the look you want.',
    ],
    continue: [
      'Use Elias - he bailed us out on recap for Jimmy!',
      'Bridge the gap between Solutions, productions, and Jimmy/Jerome.',
    ],
    note: [
      'Jimmy (contractor) assessment: did not have camera ready/prepped for the first day (losing time). Flew drone without permissions. Unable to use gimbal. Required a lot of hand-holding. Shots were fine after the first day (most of the first day was unusable). Generally overshot with some good shots but not much recap coverage. Shot his preferred scenes and would not take direction from producer - Anabelle had to become very direct/strict. Generally unreliable, not autonomous, not communicative. Bad attitude/mood, bad for morale. Not in sync with team for card dumps, bottlenecking post, and gave attitude when told to dump cards. Not responsible for prepping, batteries, card dumps, etc. Last day he pulled out last-second and did not tell anyone until shooting time, spending the day on his drone and not helping the team. He was a nice guy.',
    ],
  },
];

async function findProject(code) {
  const core = String(code).replace(/^0?2\./, '').trim();
  let rows = await sql`SELECT id, program FROM projects WHERE code = ${code} ORDER BY parent_project_id NULLS FIRST LIMIT 1`;
  if (!rows.length) rows = await sql`SELECT id, program FROM projects WHERE code ILIKE ${'%' + code + '%'} ORDER BY parent_project_id NULLS FIRST LIMIT 1`;
  if (!rows.length && core) rows = await sql`SELECT id, program FROM projects WHERE code ILIKE ${'%' + core + '%'} ORDER BY parent_project_id NULLS FIRST LIMIT 1`;
  return rows[0] || null;
}

async function seedDebriefs() {
  let added = 0, projects = 0, created = 0;
  for (const d of DEBRIEFS) {
    let proj = await findProject(d.code);
    // No existing project for this historical debrief — create a closed one so it
    // shows up under the right client/program/year in the Debrief report.
    if (!proj) {
      const [np] = await sql`
        INSERT INTO projects (id, code, title, client, city, state, start_date, status, program)
        VALUES (gen_random_uuid()::text, ${d.code}, ${d.title || d.code}, ${d.client || 'Unassigned'},
                ${d.city || ''}, ${d.state || ''}, ${d.startDate || null}, 'ARCHIVED'::project_status, ${d.program || null})
        RETURNING id, program`;
      proj = np;
      created++;
    }
    projects++;
    if (d.program && !proj.program) {
      await sql`UPDATE projects SET program = ${d.program} WHERE id = ${proj.id}`.catch(() => {});
    }
    for (const kind of ['start', 'stop', 'continue', 'note']) {
      for (const text of (d[kind] || [])) {
        const [exists] = await sql`SELECT id FROM project_debriefs WHERE project_id = ${proj.id} AND kind = ${kind} AND text = ${text}`;
        if (exists) continue;
        await sql`INSERT INTO project_debriefs (project_id, kind, text, author_name)
                  VALUES (${proj.id}, ${kind}, ${text}, ${AUTHOR})`;
        added++;
      }
    }
  }
  if (added || created) console.log(`Debrief seed: imported ${added} entries across ${projects} projects (${created} created).`);
}

// Diagnostics: for each doc, whether a project matched (and its real code/client)
// plus how many debrief entries currently exist on it. Admin-only surface.
seedDebriefs.diagnose = async () => {
  const out = [];
  for (const d of DEBRIEFS) {
    const proj = await findProject(d.code);
    const expected = ['start', 'stop', 'continue', 'note'].reduce((a, k) => a + (d[k] || []).length, 0);
    let matched = null, existing = 0;
    if (proj) {
      const [full] = await sql`SELECT code, client, program FROM projects WHERE id = ${proj.id}`;
      matched = { id: proj.id, code: full?.code, client: full?.client, program: full?.program };
      const [c] = await sql`SELECT COUNT(*)::int AS n FROM project_debriefs WHERE project_id = ${proj.id}`;
      existing = c?.n || 0;
    }
    out.push({ docCode: d.code, program: d.program, expected, matched, existing });
  }
  // A slim project roster so mismatched codes can be corrected.
  const projects = await sql`
    SELECT code, client FROM projects
    WHERE COALESCE(NULLIF(TRIM(client), ''), '') <> ''
    ORDER BY client, code`;
  return { docs: out, projects };
};

module.exports = seedDebriefs;
