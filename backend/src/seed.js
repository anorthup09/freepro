const bcrypt = require('bcryptjs');
const sql = require('./lib/db');

const POSITIONS = [
  'Director','Executive Producer','Field Producer','DP/Cam Op','Camera B','Camera C',
  'Drone Operator','First AC','DIT','Onsite Editor','Audio Engineer','Key Grip','Grip',
  'Gaffer','First AD','Production Coordinator','Production Assistant','Teleprompter Operator',
  'Hair & Makeup','Location Scout','Casting Director','Art Director','Props & Wardrobe Lead',
  'Craft Services','Talent',
];

async function seed() {

  // Admin user
  const hashed = await bcrypt.hash('freepro2026!', 12);
  await sql`INSERT INTO users (id, name, email, password, role) VALUES (gen_random_uuid()::text, 'Admin', 'admin@unbridledmedia.com', ${hashed}, 'ADMIN') ON CONFLICT (email) DO NOTHING`;
  console.log('Admin user ready');

  // Positions
  for (let i = 0; i < POSITIONS.length; i++) {
    await sql`INSERT INTO positions (id, name, sort_order) VALUES (gen_random_uuid()::text, ${POSITIONS[i]}, ${i}) ON CONFLICT (name) DO UPDATE SET sort_order = ${i}`;
  }
  console.log('Positions ready:', POSITIONS.length);

  // Crew members
  const crewData = [
    { name:'Joey Goldman',   email:'jgoldman@unbridledmedia.com', phone:'303-903-0543', company:'Unbridled Media', initials:'JG', avatarColor:'#E8A030' },
    { name:'Ben Lamb',       email:'blamb@unbridledmedia.com',    phone:'818-400-6156', company:'Unbridled Media', initials:'BL', avatarColor:'#5ABF80' },
    { name:'Anna Parnigoni', email:'aparnigoni@unbridledmedia.com', phone:'513-702-4833', company:'Unbridled Media', initials:'AP', avatarColor:'#8080E0' },
    { name:'Brandon Emery',  email:'bemery@unbridled.com',         phone:'727-439-3833', company:'Unbridled Media', initials:'BE', avatarColor:'#8080E0' },
    { name:'Fred Munoz',     email:'fredmunoz@gmail.com',          phone:'305-213-2769', company:'Freelance',        initials:'FM', avatarColor:'#E08080' },
    { name:'Daniel Neville', email:'dneville@unbridledmedia.com',  phone:'314-629-4931', company:'Unbridled Media', initials:'DN', avatarColor:'#B080E0' },
    { name:'Brenden Brooks', email:'brooksfilmmaking@gmail.com',   phone:'636-395-6895', company:'Freelance',        initials:'BB', avatarColor:'#40A0A0' },
    { name:'Joe Seebeck',    email:'jseebeck@unbridledmedia.com',  phone:'314-368-2160', company:'Unbridled Media', initials:'JS', avatarColor:'#5ABF80' },
    { name:'Jon Arneson',    email:'jarneson@unbridledmedia.com',  phone:'618-409-9916', company:'Unbridled Media', initials:'JA', avatarColor:'#E8A030' },
    { name:'Danny Bowersox', email:'danielbowersox@gmail.com',     phone:'913-406-1704', company:'Freelance',        initials:'DB', avatarColor:'#8080E0' },
  ];
  for (const c of crewData) {
    await sql`INSERT INTO crew_members (id, name, email, phone, company, initials, avatar_color) VALUES (gen_random_uuid()::text, ${c.name}, ${c.email}, ${c.phone}, ${c.company}, ${c.initials}, ${c.avatarColor}) ON CONFLICT DO NOTHING`;
  }
  console.log('Crew ready');

  // Project
  await sql`
    INSERT INTO projects (id, code, title, subtitle, client, city, state, start_date, end_date, status)
    VALUES (gen_random_uuid()::text, '02.CGS00626', 'Casey''s C3 Convention', '2026', 'Casey''s', 'Kansas City', 'MO', '2026-05-03', '2026-05-06', 'ACTIVE')
    ON CONFLICT (code) DO NOTHING`;
  const [project] = await sql`SELECT id FROM projects WHERE code = '02.CGS00626'`;
  console.log('Project ready:', project.id);

  // Tech specs
  await sql`
    INSERT INTO tech_specs (id, project_id, aspect_ratio, resolution, quality, cameras, exec_producer, on_site_editor)
    VALUES (gen_random_uuid()::text, ${project.id}, '2.39:1', '3672 × 1536', '4K', 'A, B, C + Drone', 'Joey Goldman', 'Jon Arneson')
    ON CONFLICT (project_id) DO NOTHING`;

  // Locations
  const locs = [
    { name:'Kansas City Convention Center', address:'301 W 13th St #100, KC 64105', type:'PRIMARY_VENUE', emoji:'🏛' },
    { name:"Loew's Kansas City Hotel",      address:'1515 Wyandotte St, KC 64108',  type:'CREW_HOTEL',   emoji:'🏨' },
    { name:'Kansas City Marriott Downtown', address:'200 W 12th St, KC 64105',      type:'SECONDARY',     emoji:'🏩' },
    { name:'Hilton President Kansas City',  address:'1329 Baltimore Ave, KC 64105', type:'SECONDARY',     emoji:'🏛' },
  ];
  const existingLocs = await sql`SELECT id FROM locations WHERE project_id = ${project.id}`;
  if (!existingLocs.length) {
    for (const l of locs) {
      await sql`INSERT INTO locations (id, project_id, name, address, type, emoji) VALUES (gen_random_uuid()::text, ${project.id}, ${l.name}, ${l.address}, ${l.type}::location_type, ${l.emoji})`;
    }
  }

  // Client contacts
  const existingContacts = await sql`SELECT id FROM client_contacts WHERE project_id = ${project.id}`;
  if (!existingContacts.length) {
    await sql`INSERT INTO client_contacts (id, project_id, name, title, email, phone) VALUES (gen_random_uuid()::text, ${project.id}, 'Katie Petru', 'Dir. Communications', 'katie.petru@caseys.com', '515-480-8503')`;
    await sql`INSERT INTO client_contacts (id, project_id, name, title, email, phone) VALUES (gen_random_uuid()::text, ${project.id}, 'Anne Juelsgaard', 'Manager, PR & Events', 'anne.juelsgaard@caseys.com', '319-610-2699')`;
    await sql`INSERT INTO client_contacts (id, project_id, name, title, email, phone) VALUES (gen_random_uuid()::text, ${project.id}, 'Chase Russell', 'Communications Mgr', 'chase.russell@caseys.com', '602-694-8503')`;
  }

  // Key talent
  const existingTalent = await sql`SELECT id FROM key_talent WHERE project_id = ${project.id}`;
  if (!existingTalent.length) {
    for (const t of [{name:'Darren Rebelez',role:"CEO, Casey's"},{name:'Chris Boling',role:'SVP, Store Operations'},{name:'Ena Williams',role:'SVP, Stores'},{name:'Sean Patrick',role:'Pizza Comp Host'},{name:'Andrew Zimmern',role:'Celebrity Judge'}]) {
      await sql`INSERT INTO key_talent (id, project_id, name, role) VALUES (gen_random_uuid()::text, ${project.id}, ${t.name}, ${t.role})`;
    }
  }

  // Deliverables
  const existingDels = await sql`SELECT id FROM deliverables WHERE project_id = ${project.id}`;
  if (!existingDels.length) {
    const dels = [
      { title:'Onsite Recap Video', description:'Plays Day 4 GS · 2 min', editor_name:'Jon A.', aspect_ratio:'2.39:1', resolution:'3672×1536', due_date:'7 AM, 5/6', is_urgent:true },
      { title:'General Session Recordings (3)', description:'Web sharing · TRT TBD', editor_name:'Joe S.', aspect_ratio:'16:9', resolution:'1920×1080', due_date:'On site' },
      { title:'Pizza Certification Breakout', description:'Web sharing', editor_name:'Joe S.', aspect_ratio:'16:9', resolution:'1920×1080', due_date:'On site' },
      { title:'Darren + Chris Cascade Recording', description:'Script attached', editor_name:'Joe S.', aspect_ratio:'16:9', resolution:'1920×1080', due_date:'By 5/8' },
      { title:'Pizza Competition Recap', description:'2 min · Player intros', editor_name:'Jon A.', aspect_ratio:'16:9', resolution:'1920×1080', due_date:'V1 by 5/15', music_ref:'Pizza Comp Recap Music' },
      { title:'Pizza Comp Recap — Social Clip', description:'10–15 sec sizzle', editor_name:'Jon A.', aspect_ratio:'9:16 vertical', due_date:'Onsite or 5/8', music_ref:'Pizza Comp Recap Music' },
      { title:'Expo Video', description:'2–3 min · Ref: MDV-2024-03', editor_name:'Daniel N.', aspect_ratio:'16:9', resolution:'1920×1080', due_date:'V1 by 5/15' },
    ];
    for (const d of dels) {
      await sql`INSERT INTO deliverables (id, project_id, title, description, editor_name, aspect_ratio, resolution, due_date, music_ref, is_urgent) VALUES (gen_random_uuid()::text, ${project.id}, ${d.title}, ${d.description||null}, ${d.editor_name||null}, ${d.aspect_ratio||null}, ${d.resolution||null}, ${d.due_date||null}, ${d.music_ref||null}, ${d.is_urgent||false})`;
    }
  }

  console.log('Seed complete.');
}

module.exports = seed;
