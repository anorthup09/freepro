const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Admin user
  const hashed = await bcrypt.hash('freepro2026!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@unbridledmedia.com' },
    update: {},
    create: { name: 'Admin', email: 'admin@unbridledmedia.com', password: hashed, role: 'ADMIN' },
  });
  console.log('Admin user:', admin.email);

  // Crew members
  const crewData = [
    { name: 'Joey Goldman',  role: 'Executive / Field Producer', email: 'jgoldman@unbridledmedia.com', phone: '303-903-0543', company: 'Unbridled Media', initials: 'JG', avatarColor: '#E8A030' },
    { name: 'Ben Lamb',      role: 'Field Producer',             email: 'blamb@unbridledmedia.com',    phone: '818-400-6156', company: 'Unbridled Media', initials: 'BL', avatarColor: '#5ABF80' },
    { name: 'Anna Parnigoni',role: 'Field Producer',             email: 'aparnigoni@unbridledmedia.com', phone: '513-702-4833', company: 'Unbridled Media', initials: 'AP', avatarColor: '#8080E0' },
    { name: 'Brandon Emery', role: 'Creative Director',          email: 'bemery@unbridled.com',         phone: '727-439-3833', company: 'Unbridled Media', initials: 'BE', avatarColor: '#8080E0' },
    { name: 'Fred Munoz',    role: 'Camera A Op / DP',           email: 'fredmunoz@gmail.com',          phone: '305-213-2769', company: 'Freelance',        initials: 'FM', avatarColor: '#E08080' },
    { name: 'Daniel Neville',role: 'Camera B Op / Drone',        email: 'dneville@unbridledmedia.com',  phone: '314-629-4931', company: 'Unbridled Media', initials: 'DN', avatarColor: '#B080E0' },
    { name: 'Brenden Brooks', role: 'Camera C Op',               email: 'brooksfilmmaking@gmail.com',   phone: '636-395-6895', company: 'Freelance',        initials: 'BB', avatarColor: '#40A0A0' },
    { name: 'Joe Seebeck',   role: 'Expo Cam / GS Cutdowns',    email: 'jseebeck@unbridledmedia.com',  phone: '314-368-2160', company: 'Unbridled Media', initials: 'JS', avatarColor: '#5ABF80' },
    { name: 'Jon Arneson',   role: 'On-Site Editor',             email: 'jarneson@unbridledmedia.com',  phone: '618-409-9916', company: 'Unbridled Media', initials: 'JA', avatarColor: '#E8A030' },
    { name: 'Danny Bowersox',role: 'Audio',                      email: 'danielbowersox@gmail.com',     phone: '913-406-1704', company: 'Freelance',        initials: 'DB', avatarColor: '#8080E0' },
    { name: 'Nathan Hoefert',role: 'Still Photographer',         email: 'nathanh@capture-co.com',       phone: '303-591-0325', company: 'Capture Co',       initials: 'NH', avatarColor: '#D0A030' },
    { name: 'Max Sassaman',  role: 'Still Photographer',         email: 'maxs@capture-co.com',          phone: '303-941-4122', company: 'Capture Co',       initials: 'MS', avatarColor: '#D0A030' },
    { name: 'Brannden Ard',  role: 'Photographer',               email: 'brannden@bardmedia.art',        phone: '314-403-5943', company: 'Freelance',        initials: 'BA', avatarColor: '#C08080' },
    { name: 'Katie Baxter',  role: 'Photographer',               email: 'photographykatiedid@gmail.com', phone: '618-560-6519', company: 'Freelance',        initials: 'KB', avatarColor: '#C08080' },
    { name: 'Antonio Harris',role: 'Photographer',               email: 'hello@antoniotharrisphotography.com', phone: '314-723-3037', company: 'Freelance', initials: 'AH', avatarColor: '#C08080' },
    { name: 'Kevin Kersting',role: 'Photographer',               email: 'kevin@kevinkersting.com',       phone: '314-779-9070', company: 'Freelance',        initials: 'KK', avatarColor: '#C08080' },
  ];

  const crew = {};
  for (const c of crewData) {
    const m = await prisma.crewMember.upsert({ where: { id: c.name }, update: c, create: c }).catch(async () => {
      return prisma.crewMember.create({ data: c });
    });
    crew[c.name] = m;
  }
  console.log('Crew seeded:', Object.keys(crew).length);

  // Project
  const project = await prisma.project.upsert({
    where: { code: '02.CGS00626' },
    update: {},
    create: {
      code: '02.CGS00626',
      title: "Casey's C3 Convention",
      subtitle: '2026',
      client: "Casey's",
      city: 'Kansas City',
      state: 'MO',
      startDate: new Date('2026-05-03'),
      endDate: new Date('2026-05-06'),
      status: 'ACTIVE',
    },
  });
  console.log('Project:', project.code);

  // Tech specs
  await prisma.techSpec.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      aspectRatio: '2.39:1',
      resolution: '3672 × 1536',
      quality: '4K',
      cameras: 'A, B, C + Drone',
      execProducer: 'Joey Goldman',
      onSiteEditor: 'Jon Arneson',
    },
  });

  // Locations
  const locationData = [
    { name: 'Kansas City Convention Center', address: '301 W 13th St #100, KC 64105', type: 'PRIMARY_VENUE', emoji: '🏛' },
    { name: "Loew's Kansas City Hotel",       address: '1515 Wyandotte St, KC 64108', type: 'CREW_HOTEL',     emoji: '🏨' },
    { name: 'Kansas City Marriott Downtown',  address: '200 W 12th St, KC 64105',     type: 'SECONDARY',       emoji: '🏩' },
    { name: 'Hilton President Kansas City',   address: '1329 Baltimore Ave, KC 64105',type: 'SECONDARY',       emoji: '🏛' },
  ];
  for (const l of locationData) {
    await prisma.location.create({ data: { ...l, projectId: project.id } });
  }

  // Client contacts
  await prisma.clientContact.createMany({ data: [
    { projectId: project.id, name: 'Katie Petru',       title: 'Dir. Communications',  email: 'katie.petru@caseys.com',      phone: '515-480-8503' },
    { projectId: project.id, name: 'Anne Juelsgaard',   title: 'Manager, PR & Events', email: 'anne.juelsgaard@caseys.com',  phone: '319-610-2699' },
    { projectId: project.id, name: 'Chase Russell',     title: 'Communications Mgr',   email: 'chase.russell@caseys.com',    phone: '602-694-8503' },
  ]});

  // Key talent
  await prisma.keyTalent.createMany({ data: [
    { projectId: project.id, name: 'Darren Rebelez', role: 'CEO, Casey\'s' },
    { projectId: project.id, name: 'Chris Boling',   role: 'SVP, Store Operations' },
    { projectId: project.id, name: 'Ena Williams',   role: 'SVP, Stores' },
    { projectId: project.id, name: 'Sean Patrick',   role: 'Pizza Comp Host' },
    { projectId: project.id, name: 'Andrew Zimmern', role: 'Celebrity Judge' },
  ]});

  // Crew assignments
  const assignments = [
    { name: 'Joey Goldman',   callTime: '7:30 AM' },
    { name: 'Ben Lamb',       callTime: '12:00 PM' },
    { name: 'Anna Parnigoni', callTime: '7:30 AM' },
    { name: 'Brandon Emery',  callTime: '12:30 PM' },
    { name: 'Fred Munoz',     callTime: '7:30 AM' },
    { name: 'Daniel Neville', callTime: '7:30 AM' },
    { name: 'Brenden Brooks', callTime: '7:30 AM' },
    { name: 'Joe Seebeck',    callTime: '7:30 AM' },
    { name: 'Jon Arneson',    callTime: '7:30 AM' },
    { name: 'Danny Bowersox', callTime: '12:30 PM', daysActive: '5/4 & 5/5 only' },
    { name: 'Nathan Hoefert', callTime: '7:30 AM' },
    { name: 'Max Sassaman',   callTime: '7:30 AM' },
    { name: 'Brannden Ard',   callTime: '4:30 PM', daysActive: '5/4 & 5/5 only' },
    { name: 'Katie Baxter',   callTime: '4:30 PM', daysActive: '5/4 & 5/5 only' },
    { name: 'Antonio Harris', callTime: '4:30 PM', daysActive: '5/4 & 5/5 only' },
    { name: 'Kevin Kersting', callTime: '4:30 PM', daysActive: '5/4 & 5/5 only' },
  ];
  for (const a of assignments) {
    if (crew[a.name]) {
      await prisma.crewAssignment.create({
        data: { projectId: project.id, crewMemberId: crew[a.name].id, callTime: a.callTime, daysActive: a.daysActive },
      });
    }
  }

  // Deliverables
  await prisma.deliverable.createMany({ data: [
    { projectId: project.id, title: 'Onsite Recap Video',               description: 'Plays Day 4 GS · 2 min · Asset #801_', editorName: 'Jon A.', aspectRatio: '2.39:1', resolution: '3672×1536', dueDate: '7 AM, 5/6', isUrgent: true, assetRef: 'Asset #801_' },
    { projectId: project.id, title: 'General Session Recordings (3)',    description: 'Web sharing · TRT TBD',                  editorName: 'Joe S.', aspectRatio: '16:9', resolution: '1920×1080', dueDate: 'On site' },
    { projectId: project.id, title: 'Pizza Certification Breakout',      description: 'Web sharing · TRT TBD',                  editorName: 'Joe S.', aspectRatio: '16:9', resolution: '1920×1080', dueDate: 'On site' },
    { projectId: project.id, title: 'Darren + Chris Cascade Recording',  description: 'Script attached · Web sharing',           editorName: 'Joe S.', aspectRatio: '16:9', resolution: '1920×1080', dueDate: 'By 5/8' },
    { projectId: project.id, title: 'Pizza Competition Recap',           description: '2 min · Player intros + walkout graphics',editorName: 'Jon A.', aspectRatio: '16:9', resolution: '1920×1080', dueDate: 'V1 by 5/15', musicRef: 'Pizza Comp Recap Music' },
    { projectId: project.id, title: 'Pizza Comp Recap — Social Clip',    description: '10–15 sec · No bumpers, sizzle only',     editorName: 'Jon A.', aspectRatio: '9:16 vertical', dueDate: 'Onsite or 5/8', musicRef: 'Pizza Comp Recap Music' },
    { projectId: project.id, title: 'Expo Video',                        description: '2–3 min · Web sharing · Ref: MDV-2024-03',editorName: 'Daniel N.', aspectRatio: '16:9', resolution: '1920×1080', dueDate: 'V1 by 5/15' },
  ]});

  console.log('Seed complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
