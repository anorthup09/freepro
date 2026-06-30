const sql = require('./db');

async function migrate() {
  // CREATE TYPE doesn't support IF NOT EXISTS in PG < 17; use DO block workaround
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('ADMIN','PRODUCER','CREW','CLIENT');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE project_status AS ENUM ('PLANNING','ACTIVE','WRAPPED','DELIVERED','ARCHIVED');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'location_type') THEN
        CREATE TYPE location_type AS ENUM ('PRIMARY_VENUE','CREW_HOTEL','SECONDARY','AIRPORT','OTHER');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deliverable_status') THEN
        CREATE TYPE deliverable_status AS ENUM ('WAITING_ON_ASSETS','IN_PROGRESS','ROUGH_CUT','IN_REVIEW','APPROVED','DELIVERED');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_tag_type') THEN
        CREATE TYPE event_tag_type AS ENUM ('VIDEO','PHOTO','AUDIO','ALL_CREW','TALENT','CUSTOM');
      END IF;
    END $$
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role user_role NOT NULL DEFAULT 'CREW',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT UNIQUE NOT NULL,
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crew_members (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      initials TEXT,
      avatar_color TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      client TEXT NOT NULL,
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      start_date TIMESTAMPTZ NOT NULL,
      end_date TIMESTAMPTZ NOT NULL,
      status project_status DEFAULT 'PLANNING',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      type location_type NOT NULL,
      emoji TEXT,
      notes TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tech_specs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      aspect_ratio TEXT,
      resolution TEXT,
      quality TEXT,
      cameras TEXT,
      exec_producer TEXT,
      on_site_editor TEXT,
      notes TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS client_contacts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      email TEXT,
      phone TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS key_talent (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      notes TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crew_assignments (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      position_id TEXT NOT NULL REFERENCES positions(id),
      crew_member_id TEXT REFERENCES crew_members(id),
      slot_number INT DEFAULT 1,
      notes TEXT,
      UNIQUE(project_id, position_id, slot_number)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shoot_days (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      day_number INT NOT NULL,
      date TIMESTAMPTZ NOT NULL,
      call_time TEXT,
      wrap_time TEXT,
      weather TEXT,
      notes TEXT,
      UNIQUE(project_id, day_number)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_events (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      shoot_day_id TEXT NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
      location_id TEXT REFERENCES locations(id),
      start_time TEXT NOT NULL,
      end_time TEXT,
      title TEXT NOT NULL,
      detail TEXT,
      is_alert BOOLEAN DEFAULT FALSE,
      alert_message TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS event_tags (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      event_id TEXT NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
      type event_tag_type NOT NULL,
      label TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS event_crew_tags (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      event_id TEXT NOT NULL REFERENCES schedule_events(id) ON DELETE CASCADE,
      crew_member_id TEXT NOT NULL REFERENCES crew_members(id) ON DELETE CASCADE,
      note TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crew_day_calls (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      crew_assignment_id TEXT NOT NULL REFERENCES crew_assignments(id) ON DELETE CASCADE,
      shoot_day_id TEXT NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
      call_time TEXT,
      wrap_time TEXT,
      location_note TEXT,
      notes TEXT,
      UNIQUE(crew_assignment_id, shoot_day_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      status deliverable_status DEFAULT 'WAITING_ON_ASSETS',
      editor_name TEXT,
      aspect_ratio TEXT,
      resolution TEXT,
      due_date TEXT,
      asset_ref TEXT,
      music_ref TEXT,
      is_urgent BOOLEAN DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS hotel_blocks (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT,
      notes TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS hotel_guests (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      hotel_block_id TEXT NOT NULL REFERENCES hotel_blocks(id) ON DELETE CASCADE,
      crew_member_id TEXT REFERENCES crew_members(id),
      guest_name TEXT NOT NULL,
      confirmation TEXT,
      check_in TIMESTAMPTZ NOT NULL,
      check_out TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS flights (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      crew_member_id TEXT REFERENCES crew_members(id),
      passenger_name TEXT NOT NULL,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      depart_time TIMESTAMPTZ NOT NULL,
      arrive_time TIMESTAMPTZ NOT NULL,
      airline TEXT,
      confirmation TEXT,
      is_return BOOLEAN DEFAULT FALSE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS drive_groups (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      origin TEXT NOT NULL,
      destination TEXT NOT NULL,
      depart_time TIMESTAMPTZ,
      arrive_time TIMESTAMPTZ,
      notes TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS drive_group_members (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      drive_group_id TEXT NOT NULL REFERENCES drive_groups(id) ON DELETE CASCADE,
      crew_member_id TEXT REFERENCES crew_members(id),
      name TEXT NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS project_shares (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
      view_type TEXT NOT NULL,
      talent_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS audience TEXT[] DEFAULT '{}'`;
  await sql`ALTER TABLE crew_day_calls ADD COLUMN IF NOT EXISTS audience TEXT[] DEFAULT '{}'`;

  console.log('Migration complete.');
}

module.exports = migrate;
