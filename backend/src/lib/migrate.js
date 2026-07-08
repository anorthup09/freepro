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

  await sql`ALTER TABLE tech_specs ADD COLUMN IF NOT EXISTS dit_crew_member_id TEXT REFERENCES crew_members(id)`;

  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS home_airport TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS notes TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS date_of_birth DATE`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS passport_number TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS passport_expiry DATE`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS known_traveler_number TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS seat_preference TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS emergency_contact TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS emergency_phone TEXT`;

  await sql`ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS audience TEXT[] DEFAULT '{}'`;
  await sql`ALTER TABLE crew_day_calls ADD COLUMN IF NOT EXISTS audience TEXT[] DEFAULT '{}'`;

  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS poc_crew_member_id TEXT REFERENCES crew_members(id)`;
  await sql`ALTER TABLE crew_assignments ADD COLUMN IF NOT EXISTS start_date TEXT`;
  await sql`ALTER TABLE crew_assignments ADD COLUMN IF NOT EXISTS end_date TEXT`;
  await sql`ALTER TABLE crew_assignments ADD COLUMN IF NOT EXISTS is_contractor BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE crew_assignments ADD COLUMN IF NOT EXISTS day_rate NUMERIC`;
  await sql`ALTER TABLE crew_assignments ADD COLUMN IF NOT EXISTS labor_days NUMERIC`;
  await sql`ALTER TABLE crew_assignments ADD COLUMN IF NOT EXISTS gear_cost NUMERIC`;
  await sql`ALTER TABLE crew_assignments ADD COLUMN IF NOT EXISTS gear_days NUMERIC`;

  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS crew_lunch TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS gear_storage TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS gs_audio TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS project_gear (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      gear_person_id TEXT REFERENCES crew_members(id),
      internal_request_submitted BOOLEAN DEFAULT FALSE,
      rental_company TEXT,
      rental_contact TEXT,
      rental_phone TEXT,
      rental_email TEXT,
      coi_received BOOLEAN DEFAULT FALSE,
      rental_agreement_received BOOLEAN DEFAULT FALSE,
      cc_auth_received BOOLEAN DEFAULT FALSE,
      delivery_datetime TEXT,
      pickup_datetime TEXT,
      delivery_driver TEXT,
      delivery_driver_phone TEXT,
      camera_gear TEXT,
      grip_gear TEXT,
      electric_gear TEXT,
      audio_gear TEXT,
      media_management_gear TEXT,
      editing_gear TEXT,
      storage_location TEXT
    )
  `;

  await sql`ALTER TABLE hotel_guests ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2)`;
  await sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS cost NUMERIC(10,2)`;
  await sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS flight_number TEXT`;
  await sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS status TEXT`;
  await sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS depart_display TEXT`;
  await sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS arrive_display TEXT`;
  await sql`ALTER TABLE flights ADD COLUMN IF NOT EXISTS status_checked_at TIMESTAMPTZ`;

  await sql`
    CREATE TABLE IF NOT EXISTS rental_cars (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      vendor TEXT NOT NULL,
      pickup_location TEXT,
      dropoff_location TEXT,
      pickup_date TIMESTAMPTZ,
      dropoff_date TIMESTAMPTZ,
      confirmation TEXT,
      cost NUMERIC(10,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS agency_contacts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      email TEXT,
      phone TEXT
    )
  `;

  await sql`ALTER TABLE tech_specs ADD COLUMN IF NOT EXISTS frame_rate TEXT`;

  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_high INT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_low INT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_sunrise TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_sunset TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_precip INT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_condition TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_fetched_at TIMESTAMPTZ`;

  await sql`INSERT INTO positions (id, name, sort_order) VALUES (gen_random_uuid()::text, 'Post-Production Supervisor', 999) ON CONFLICT (name) DO NOTHING`;

  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS preferred_first_name TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS preferred_last_name TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT`;

  await sql`ALTER TABLE key_talent ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE key_talent ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE key_talent ADD COLUMN IF NOT EXISTS notes TEXT`;
  await sql`ALTER TABLE key_talent ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT`;

  // Backfill preferred name from legal name for existing crew members
  await sql`
    UPDATE crew_members SET
      preferred_first_name = CASE
        WHEN position(' ' IN name) > 0 THEN split_part(name, ' ', 1)
        ELSE name
      END,
      preferred_last_name = CASE
        WHEN position(' ' IN name) > 0 THEN substring(name FROM position(' ' IN name) + 1)
        ELSE NULL
      END
    WHERE preferred_first_name IS NULL AND preferred_last_name IS NULL
  `;

  await sql`ALTER TABLE project_gear ADD COLUMN IF NOT EXISTS rental_cost NUMERIC(10,2)`;

  await sql`
    CREATE TABLE IF NOT EXISTS online_rentals (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      renter_name TEXT,
      confirmation TEXT,
      tracking_number TEXT,
      cost NUMERIC(10,2),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS catering_orders (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      shoot_day_id TEXT NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
      meal_type TEXT NOT NULL,
      name TEXT,
      address TEXT,
      order_number TEXT,
      delivery_time TEXT,
      UNIQUE(shoot_day_id, meal_type)
    )
  `;

  await sql`ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS is_filming BOOLEAN DEFAULT FALSE`;

  await sql`ALTER TABLE key_talent ADD COLUMN IF NOT EXISTS call_time TEXT`;

  await sql`ALTER TABLE key_talent ADD COLUMN IF NOT EXISTS wardrobe_notes TEXT`;
  await sql`ALTER TABLE key_talent ADD COLUMN IF NOT EXISTS arrival_notes TEXT`;

  await sql`ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS is_shooting_call BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS is_lunch BOOLEAN DEFAULT FALSE`;

  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS shooting_call_time TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS lunch_time TEXT`;

  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS call_time_notes TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS call_time_tags TEXT[] DEFAULT '{}'`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS shooting_call_notes TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS shooting_call_tags TEXT[] DEFAULT '{}'`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS lunch_notes TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS lunch_tags TEXT[] DEFAULT '{}'`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS wrap_time_notes TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS wrap_time_tags TEXT[] DEFAULT '{}'`;

  await sql`
    CREATE TABLE IF NOT EXISTS talent_day_calls (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      talent_id TEXT NOT NULL REFERENCES key_talent(id) ON DELETE CASCADE,
      shoot_day_id TEXT NOT NULL REFERENCES shoot_days(id) ON DELETE CASCADE,
      call_time TEXT,
      UNIQUE(talent_id, shoot_day_id)
    )
  `;

  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS day_type TEXT DEFAULT 'SHOOT'`;

  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS call_time_location_id TEXT REFERENCES locations(id)`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS shooting_call_location_id TEXT REFERENCES locations(id)`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS lunch_location_id TEXT REFERENCES locations(id)`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS wrap_time_location_id TEXT REFERENCES locations(id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS gear_items (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'other',
      item TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'internal',
      notes TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE key_talent ADD COLUMN IF NOT EXISTS video_title TEXT`;
  await sql`ALTER TABLE tech_specs ADD COLUMN IF NOT EXISTS broll_frame_rate TEXT`;
  await sql`ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS room_space TEXT`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_password TEXT`;
  await sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS space_map TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS project_questions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer TEXT,
      asked_at TIMESTAMPTZ DEFAULT NOW(),
      answered_at TIMESTAMPTZ
    )
  `;

  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS show_shot_list BOOLEAN DEFAULT FALSE`;

  await sql`
    CREATE TABLE IF NOT EXISTS shot_list_days (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      day_number INT NOT NULL,
      date TEXT,
      call_time TEXT,
      shooting_call TEXT,
      lunch_time TEXT,
      est_wrap TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shot_list_scenes (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scene_number INT NOT NULL DEFAULT 1,
      name TEXT,
      description TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS shot_list_shots (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      scene_id TEXT NOT NULL REFERENCES shot_list_scenes(id) ON DELETE CASCADE,
      description TEXT,
      distance TEXT,
      movement TEXT,
      priority TEXT DEFAULT 'Important',
      est_minutes INT DEFAULT 15,
      status TEXT DEFAULT 'not_captured',
      sort_order INT DEFAULT 0,
      setup_minutes INT DEFAULT 5,
      takes_count INT DEFAULT 1,
      take_minutes INT DEFAULT 5,
      buffer_minutes INT DEFAULT 5,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE shot_list_scenes ADD COLUMN IF NOT EXISTS day_id TEXT REFERENCES shot_list_days(id)`;
  await sql`ALTER TABLE shot_list_scenes ADD COLUMN IF NOT EXISTS scene_type TEXT DEFAULT 'interior'`;
  await sql`ALTER TABLE shot_list_scenes ADD COLUMN IF NOT EXISTS est_start_time TEXT`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS angle TEXT`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS lens TEXT`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS frame_rate TEXT`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS coverage TEXT`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS talent_tags JSONB DEFAULT '[]'`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS special_equipment TEXT`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS audio_notes TEXT`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS setup_minutes INTEGER DEFAULT 0`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS takes_count INTEGER DEFAULT 1`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS take_minutes INTEGER DEFAULT 0`;
  await sql`ALTER TABLE shot_list_shots ADD COLUMN IF NOT EXISTS buffer_minutes INTEGER DEFAULT 2`;

  await sql`
    CREATE TABLE IF NOT EXISTS shot_list_scenes (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scene_number INT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shot_list_shots (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      scene_id TEXT NOT NULL REFERENCES shot_list_scenes(id) ON DELETE CASCADE,
      description TEXT,
      distance TEXT,
      movement TEXT,
      priority TEXT DEFAULT 'Important',
      est_minutes INT DEFAULT 9,
      status TEXT DEFAULT 'not_captured',
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS shot_list_breaks (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      day_id TEXT REFERENCES shot_list_days(id) ON DELETE SET NULL,
      start_time TEXT,
      end_time TEXT,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Flights can be entered before times are known (lookup unavailable, etc.)
  await sql`ALTER TABLE flights ALTER COLUMN depart_time DROP NOT NULL`;
  await sql`ALTER TABLE flights ALTER COLUMN arrive_time DROP NOT NULL`;

  // No-access role for fresh signups until an admin promotes them
  try { await sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'PENDING'`; } catch (e) { /* older PG without IF NOT EXISTS */ }

  // Deliverable category (Pre-Produced / On-Site / Post-Shoot)
  await sql`ALTER TABLE deliverables ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'POST_SHOOT'`;

  // Per-day weather location (searched city/zip; falls back to project city)
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_location_name TEXT`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_lat DOUBLE PRECISION`;
  await sql`ALTER TABLE shoot_days ADD COLUMN IF NOT EXISTS weather_lon DOUBLE PRECISION`;

  // Shot list days can be hidden from public views (e.g. travel days with no scenes)
  await sql`ALTER TABLE shot_list_days ADD COLUMN IF NOT EXISTS hide_public BOOLEAN DEFAULT false`;

  // Uploaded scripts (PDF/Word) viewable on share pages
  await sql`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      file_name TEXT,
      mime TEXT,
      data BYTEA,
      created_at TIMESTAMPTZ DEFAULT now()
    )`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS show_scripts BOOLEAN DEFAULT false`;

  // Client logo (small data-URL PNG shown on public sticky bars)
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_logo TEXT`;

  // Photo department toggle — projects without photo hide the Photo tag everywhere
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS include_photo BOOLEAN DEFAULT true`;

  // Seed the Unbridled Media staff roster (idempotent; matches by name)
  const UNBRIDLED_ROSTER = [
    ['Alex Northup', null],
    ['Anabelle Porio', 'Sr. Project Manager'],
    ['Anna Parnigoni', 'Project Manager, Producer'],
    ['Ben Lamb', 'Executive Producer, Partner'],
    ['Cole Seifert', null],
    ['Daniel Neville', 'Sr. Shooter/Editor'],
    ['Derik Smith', 'Director of Operations'],
    ['Dylan Patterson', null],
    ['Fabrizio Alberdi', 'Sr. Shooter/Editor'],
    ['Joe Seebeck', 'Sr. Video Producer, Partner'],
    ['Joey Goldman', 'Producer'],
    ['Jon Arneson', 'Video Editor'],
    ['Kelly Hueseman', 'Director of Account Services & People Operations'],
    ['Mason Vitro', 'Studio Manager'],
    ['Melinda Love', 'Solutions Contractor'],
    ['Mike Walsh', 'Executive Producer, Partner'],
    ['Nate Woodard', 'Executive Creative Director'],
    ['Shaun Teamer', 'Editor/Motion Graphics Designer'],
    ['Tyler Castle', 'Director of Photography'],
    ['Brandon Emery', null],
    ['Ariel Lynch', null],
    ['Allison Boon', null],
  ];
  for (const [name, title] of UNBRIDLED_ROSTER) {
    const company = title ? `Unbridled Media · ${title}` : 'Unbridled Media';
    const [existing] = await sql`SELECT id, company FROM crew_members WHERE LOWER(name) = ${name.toLowerCase()} LIMIT 1`;
    if (existing) {
      if (!(existing.company || '').toLowerCase().includes('unbridled')) {
        await sql`UPDATE crew_members SET company = ${company} WHERE id = ${existing.id}`;
      }
    } else {
      await sql`INSERT INTO crew_members (id, name, company) VALUES (gen_random_uuid()::text, ${name}, ${company})`;
    }
  }

  // Keep assignment grouping in sync with the roster: Unbridled staff are never
  // contractors, everyone else assigned to a slot is. Runs every boot so roster
  // company edits propagate to existing projects.
  await sql`
    UPDATE crew_assignments ca
    SET is_contractor = NOT (COALESCE(cm.company, '') ILIKE '%unbridled%')
    FROM crew_members cm
    WHERE cm.id = ca.crew_member_id
      AND ca.is_contractor IS DISTINCT FROM NOT (COALESCE(cm.company, '') ILIKE '%unbridled%')`;

  // Contractor deal-memo contracts (token = id, shared via public link)
  await sql`
    CREATE TABLE IF NOT EXISTS contracts (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      crew_assignment_id TEXT REFERENCES crew_assignments(id) ON DELETE SET NULL,
      contractor_name TEXT,
      contractor_email TEXT,
      position_name TEXT,
      project_title TEXT,
      project_code TEXT,
      start_date TEXT,
      end_date TEXT,
      day_rate NUMERIC,
      labor_days NUMERIC,
      gear_rate NUMERIC,
      gear_days NUMERIC,
      scope TEXT,
      status TEXT DEFAULT 'SENT',
      signed_name TEXT,
      signed_at TIMESTAMPTZ,
      signed_ip TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // ── ProFi: project finance ──
  await sql`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT UNIQUE NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'Draft',
      mgmt_fee_rate NUMERIC DEFAULT 0.15,
      deposit NUMERIC,
      deposit_due TEXT,
      additional_deposit NUMERIC,
      final_inv_date TEXT,
      paid_date TEXT,
      total_cap_co NUMERIC DEFAULT 0,
      original_fee_estimate NUMERIC,
      budget_date TEXT,
      media_rep TEXT,
      solutions_code TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS budget_sections (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      subtitle TEXT,
      kind TEXT DEFAULT 'general',
      sort INT DEFAULT 0
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS budget_lines (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      section_id TEXT NOT NULL REFERENCES budget_sections(id) ON DELETE CASCADE,
      scope TEXT,
      notes TEXT,
      qty NUMERIC DEFAULT 0,
      unit_cost NUMERIC DEFAULT 0,
      percent NUMERIC,
      is_travel BOOLEAN DEFAULT FALSE,
      actual NUMERIC,
      sort INT DEFAULT 0
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS vcc_entries (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      entry_date TEXT,
      vendor TEXT,
      description TEXT,
      category TEXT,
      trip TEXT,
      amount NUMERIC DEFAULT 0,
      status TEXT DEFAULT 'HOLD',
      not_posted BOOLEAN DEFAULT FALSE,
      source TEXT DEFAULT 'manual',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`ALTER TABLE vcc_entries ADD COLUMN IF NOT EXISTS review BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE vcc_entries ADD COLUMN IF NOT EXISTS flag TEXT`;
  await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS share_token TEXT`;
  await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS close_month TEXT`;
  await sql`UPDATE budgets SET status = 'RFP' WHERE status IN ('Draft','Sent')`;
  await sql`ALTER TABLE budget_sections ADD COLUMN IF NOT EXISTS shoot_code TEXT`;
  await sql`ALTER TABLE budget_sections ADD COLUMN IF NOT EXISTS trip TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery TEXT`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS pipeline TEXT`;
  await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'main'`;
  await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS label TEXT`;
  await sql`ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_project_id_key`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS budgets_main_uniq ON budgets(project_id) WHERE COALESCE(kind, 'main') = 'main'`;
  await sql`ALTER TABLE budget_sections ADD COLUMN IF NOT EXISTS freepro_project_id TEXT`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS parent_project_id TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS finance_snapshots (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      batch_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      code TEXT,
      title TEXT,
      media_rep TEXT,
      budget_status TEXT,
      budget_total NUMERIC,
      fee NUMERIC,
      close_month TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`ALTER TABLE budgets ADD COLUMN IF NOT EXISTS share_mode TEXT DEFAULT 'lines'`;
  await sql`UPDATE budget_lines SET scope = 'Creative Direction - Pre-Production' WHERE scope = 'Creative Direction - Pre-/Production'`;

  // Cleanup: single-shoot budgets should point at the parent project, not a
  // duplicate child tile. Repoint and remove/park the auto-created child.
  try {
    const dups = await sql`
      SELECT s.id as section_id, s.freepro_project_id as child_id, b.project_id as parent_id
      FROM budget_sections s
      JOIN budgets b ON b.id = s.budget_id AND COALESCE(b.kind, 'main') = 'main'
      WHERE s.kind = 'shoot'
        AND s.freepro_project_id IS NOT NULL
        AND s.freepro_project_id != b.project_id
        AND (SELECT COUNT(*) FROM budget_sections s2 WHERE s2.budget_id = b.id AND s2.kind = 'shoot') = 1
        AND EXISTS (SELECT 1 FROM projects c WHERE c.id = s.freepro_project_id AND c.parent_project_id = b.project_id)`;
    for (const d of dups) {
      await sql`UPDATE budget_sections SET freepro_project_id = ${d.parent_id} WHERE id = ${d.section_id}`;
      const [{ n }] = await sql`
        SELECT (SELECT COUNT(*) FROM crew_assignments WHERE project_id = ${d.child_id})
             + (SELECT COUNT(*) FROM shoot_days WHERE project_id = ${d.child_id})
             + (SELECT COUNT(*) FROM deliverables WHERE project_id = ${d.child_id}) as n`;
      if (Number(n) === 0) await sql`DELETE FROM projects WHERE id = ${d.child_id}`;
      else await sql`UPDATE projects SET status = 'ARCHIVED'::project_status WHERE id = ${d.child_id}`;
    }
    if (dups.length) console.log(`Merged ${dups.length} duplicate single-shoot tile(s) back into their parent project.`);
  } catch (e) { console.error('Duplicate shoot tile cleanup failed:', e.message); }

  // Backfill: every production block of a Live budget gets its FreePro project tile
  try {
    const secs = await sql`
      SELECT s.id, s.shoot_code, s.trip, s.subtitle, p.id as parent_id, p.title, p.client, p.city, p.state, p.start_date, p.end_date,
             (SELECT COUNT(*) FROM budget_sections s2 WHERE s2.budget_id = b.id AND s2.kind = 'shoot') as shoot_count
      FROM budget_sections s
      JOIN budgets b ON b.id = s.budget_id AND COALESCE(b.kind, 'main') = 'main' AND b.status = 'Live'
      JOIN projects p ON p.id = b.project_id
      WHERE s.kind = 'shoot' AND s.freepro_project_id IS NULL AND s.shoot_code IS NOT NULL`;
    for (const sec of secs) {
      if (Number(sec.shoot_count) === 1) {
        await sql`UPDATE budget_sections SET freepro_project_id = ${sec.parent_id} WHERE id = ${sec.id}`;
        continue;
      }
      const nn = sec.shoot_code.split('-').pop();
      const title = (sec.subtitle || '').trim() || `${sec.title} — ${sec.trip || 'Shoot ' + nn}`;
      let [proj] = await sql`SELECT id FROM projects WHERE code = ${sec.shoot_code}`;
      if (!proj) {
        [proj] = await sql`INSERT INTO projects (id, code, title, client, city, state, start_date, end_date, status, parent_project_id)
          VALUES (gen_random_uuid()::text, ${sec.shoot_code}, ${title}, ${sec.client}, ${sec.city}, ${sec.state}, ${sec.start_date}, ${sec.end_date}, 'PLANNING', ${sec.parent_id})
          RETURNING id`;
      }
      await sql`UPDATE budget_sections SET freepro_project_id = ${proj.id} WHERE id = ${sec.id}`;
    }
    if (secs.length) console.log(`Backfilled ${secs.length} FreePro shoot project tile(s).`);
  } catch (e) { console.error('Shoot tile backfill failed:', e.message); }

  await sql`
    CREATE TABLE IF NOT EXISTS gear_requests (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL UNIQUE,
      name TEXT,
      crew TEXT,
      check_out DATE,
      check_in DATE,
      moving TEXT,
      camera TEXT,
      lights TEXT,
      grip TEXT,
      other TEXT,
      drives TEXT,
      drive_size TEXT,
      drive_qty TEXT,
      notes TEXT,
      submitted_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Backfill: shoots under closed/dead budgets should be archived in FreePro
  try {
    const archived = await sql`
      UPDATE projects SET status = 'ARCHIVED'::project_status
      WHERE status != 'ARCHIVED' AND parent_project_id IN (
        SELECT project_id FROM budgets WHERE COALESCE(kind, 'main') = 'main' AND status IN ('Closed', 'Dead')
      ) RETURNING code`;
    if (archived.length) console.log(`Archived ${archived.length} shoot tile(s) under closed budgets.`);
  } catch (e) { console.error('Shoot archive backfill failed:', e.message); }

  await sql`UPDATE budgets SET status = 'Reconcile' WHERE status = 'Reconciled'`;

  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS legal_first_name TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS legal_middle_name TEXT`;
  await sql`ALTER TABLE crew_members ADD COLUMN IF NOT EXISTS legal_last_name TEXT`;
  // Backfill the split legal name from the full legal name
  await sql`
    UPDATE crew_members SET
      legal_first_name = split_part(TRIM(name), ' ', 1),
      legal_last_name = CASE WHEN TRIM(name) LIKE '% %' THEN reverse(split_part(reverse(TRIM(name)), ' ', 1)) ELSE NULL END,
      legal_middle_name = NULLIF(TRIM(BOTH ' ' FROM
        CASE WHEN array_length(string_to_array(TRIM(name), ' '), 1) > 2
          THEN array_to_string((string_to_array(TRIM(name), ' '))[2:array_length(string_to_array(TRIM(name), ' '), 1) - 1], ' ')
          ELSE '' END), '')
    WHERE legal_first_name IS NULL AND name IS NOT NULL`;

  // Merge duplicate crew members (e.g. "Ben Lamb"/"Benjamin Lamb", double
  // entries). Keeper = the record with the most linked data (travel etc.);
  // missing profile fields are filled in from the duplicate before it goes.
  try {
    const members = await sql`SELECT * FROM crew_members`;
    const norm = v => String(v || '').trim().toLowerCase();
    const lastName = m => norm(m.name).split(/\s+/).slice(-1)[0] || '';
    const firstName = m => norm(m.name).split(/\s+/)[0] || '';
    const isDupPair = (a, b) => {
      if (norm(a.name) && norm(a.name) === norm(b.name)) return true;
      if (lastName(a) && lastName(a) === lastName(b)) {
        if (a.email && b.email && norm(a.email) === norm(b.email)) return true;
        if (a.phone && b.phone && norm(a.phone).replace(/\D/g, '') === norm(b.phone).replace(/\D/g, '')) return true;
        const fa = firstName(a), fb = firstName(b);
        if (fa.length >= 3 && fb.length >= 3 && (fa.startsWith(fb) || fb.startsWith(fa)) && fa !== fb) return true;
        if (fa === fb) return true;
      }
      return false;
    };
    const weight = async m => {
      const [{ n }] = await sql`
        SELECT (SELECT COUNT(*) FROM crew_assignments WHERE crew_member_id = ${m.id})
             + (SELECT COUNT(*) FROM flights WHERE crew_member_id = ${m.id})
             + (SELECT COUNT(*) FROM hotel_guests WHERE crew_member_id = ${m.id})
             + (SELECT COUNT(*) FROM event_crew_tags WHERE crew_member_id = ${m.id}) as n`;
      const filled = ['email','phone','company','home_airport','known_traveler_number','passport_number','seat_preference','date_of_birth','preferred_first_name']
        .filter(k => m[k]).length;
      return Number(n) * 100 + filled;
    };
    const gone = new Set();
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = members[i], b = members[j];
        if (gone.has(a.id) || gone.has(b.id)) continue;
        if (!isDupPair(a, b)) continue;
        const [wa, wb] = [await weight(a), await weight(b)];
        const keep = wa >= wb ? a : b;
        const dup = wa >= wb ? b : a;
        for (const [table, col] of [
          ['crew_assignments', 'crew_member_id'], ['event_crew_tags', 'crew_member_id'],
          ['hotel_guests', 'crew_member_id'], ['flights', 'crew_member_id'],
          ['drive_group_members', 'crew_member_id'], ['tech_specs', 'dit_crew_member_id'],
          ['projects', 'poc_crew_member_id'], ['project_gear', 'gear_person_id'],
        ]) {
          await sql.unsafe(`UPDATE ${table} SET ${col} = $1 WHERE ${col} = $2`, [keep.id, dup.id]);
        }
        for (const k of ['email','phone','company','home_airport','known_traveler_number','passport_number','passport_expiry','seat_preference','date_of_birth','dietary_restrictions','emergency_contact','emergency_phone','preferred_first_name','preferred_last_name','notes']) {
          if (!keep[k] && dup[k]) {
            await sql.unsafe(`UPDATE crew_members SET ${k} = $1 WHERE id = $2`, [dup[k], keep.id]);
            keep[k] = dup[k];
          }
        }
        await sql`DELETE FROM crew_members WHERE id = ${dup.id}`;
        gone.add(dup.id);
        console.log(`Merged duplicate crew member "${dup.name}" into "${keep.name}".`);
      }
    }
  } catch (e) { console.error('Crew dedupe failed:', e.message); }

  await sql`
    CREATE TABLE IF NOT EXISTS harbingers (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      budget_id TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL,
      data JSONB NOT NULL,
      submitted_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`ALTER TABLE crew_assignments ADD COLUMN IF NOT EXISTS invite_seq INT DEFAULT 0`;

  await sql`
    CREATE TABLE IF NOT EXISTS edits (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT,
      project_code TEXT,
      deliverable_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      lead_editor_id TEXT REFERENCES crew_members(id),
      lead_editor_name TEXT,
      pm_id TEXT REFERENCES crew_members(id),
      aspect_ratio TEXT,
      resolution TEXT,
      asset_ref TEXT,
      music_ref TEXT,
      category TEXT,
      status TEXT DEFAULT 'COMING_SOON',
      version NUMERIC(6,1) DEFAULT 1,
      review_link TEXT,
      start_date DATE,
      end_date DATE,
      approved BOOLEAN DEFAULT FALSE,
      invite_seq INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS edit_activity (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      edit_id TEXT NOT NULL REFERENCES edits(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      author TEXT,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS edit_files (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      edit_id TEXT NOT NULL REFERENCES edits(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime TEXT,
      size INT,
      data BYTEA,
      uploaded_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS gantt_shares (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
      kind TEXT NOT NULL,
      ref TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Versions increment by 0.1 (V1.0, V1.1, …)
  await sql`ALTER TABLE edits ALTER COLUMN version TYPE NUMERIC(6,1)`;
  // Per-edit timeline milestones (scripting, ICR/client review rounds, color/audio, delivery)
  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS milestones JSONB DEFAULT '{}'::jsonb`;
  // Editor-task milestones default to the lead editor but can be reassigned per task
  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS milestone_assignees JSONB DEFAULT '{}'::jsonb`;

  // Per-project pages in AvocadoPost: lower-thirds grid + to-do list
  await sql`
    CREATE TABLE IF NOT EXISTS avo_project_pages (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      code TEXT UNIQUE NOT NULL,
      title TEXT,
      last_opened_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS avo_lower_thirds (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      page_id TEXT NOT NULL REFERENCES avo_project_pages(id) ON DELETE CASCADE,
      name TEXT DEFAULT '',
      title TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      sort INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS avo_todos (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      page_id TEXT NOT NULL REFERENCES avo_project_pages(id) ON DELETE CASCADE,
      text TEXT DEFAULT '',
      done BOOLEAN DEFAULT FALSE,
      sort INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  // To-do list matches the production tracker: Category / Video / Needs / To Do
  await sql`ALTER TABLE avo_todos ADD COLUMN IF NOT EXISTS category TEXT DEFAULT ''`;
  await sql`ALTER TABLE avo_todos ADD COLUMN IF NOT EXISTS video TEXT DEFAULT ''`;
  await sql`ALTER TABLE avo_todos ADD COLUMN IF NOT EXISTS needs TEXT DEFAULT ''`;
  // Music options per project page
  await sql`
    CREATE TABLE IF NOT EXISTS avo_music (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      page_id TEXT NOT NULL REFERENCES avo_project_pages(id) ON DELETE CASCADE,
      category TEXT DEFAULT '',
      url TEXT DEFAULT '',
      note TEXT DEFAULT '',
      sort INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  // Video-tracker columns on edits (Type / Style / Notes / Video Assets)
  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS tracker_type TEXT`;
  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS style TEXT`;
  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS notes TEXT`;
  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS video_assets TEXT`;

  // Team Management: PTO / OOO requests
  await sql`
    CREATE TABLE IF NOT EXISTS pto_requests (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      member_id TEXT REFERENCES crew_members(id),
      title TEXT NOT NULL,
      pto_type TEXT DEFAULT 'PTO',
      start_date DATE,
      end_date DATE,
      on_shoots TEXT,
      comp_notes TEXT,
      manager_id TEXT REFERENCES crew_members(id),
      notify TEXT,
      status TEXT DEFAULT 'REVIEW',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Password reset tokens (single-use, 1-hour expiry)
  await sql`
    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Budget visibility tags — platform users tagged onto a project budget
  await sql`
    CREATE TABLE IF NOT EXISTS budget_tags (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      budget_id TEXT NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(budget_id, user_id)
    )`;

  // Vendor invoice files per project (VCC page)
  await sql`
    CREATE TABLE IF NOT EXISTS vendor_invoices (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime TEXT,
      size INT,
      data BYTEA,
      note TEXT,
      uploaded_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  // AI-extracted fields from the invoice file
  await sql`ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS vendor_name TEXT`;
  await sql`ALTER TABLE vendor_invoices ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2)`;

  // Client hub resources (logos, brand guidelines) keyed by client name
  await sql`
    CREATE TABLE IF NOT EXISTS client_resources (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      client TEXT NOT NULL,
      kind TEXT DEFAULT 'other',
      filename TEXT NOT NULL,
      mime TEXT,
      size INT,
      data BYTEA,
      note TEXT,
      uploaded_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS drive TEXT`;

  // Custom grid columns + cell merges on Avo project pages
  await sql`ALTER TABLE avo_project_pages ADD COLUMN IF NOT EXISTS grid_config JSONB DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE avo_lower_thirds ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE avo_todos ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE avo_music ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE edits ADD COLUMN IF NOT EXISTS tracker_sort INT`;

  // User-defined tables on Avo project pages (fully custom columns)
  await sql`
    CREATE TABLE IF NOT EXISTS avo_custom_tables (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      page_id TEXT NOT NULL REFERENCES avo_project_pages(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      config JSONB DEFAULT '{}'::jsonb,
      sort INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS avo_custom_rows (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      table_id TEXT NOT NULL REFERENCES avo_custom_tables(id) ON DELETE CASCADE,
      extra JSONB DEFAULT '{}'::jsonb,
      sort INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Project Overview cover page: client call notes + one-off project tasks
  await sql`
    CREATE TABLE IF NOT EXISTS project_call_notes (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      call_date DATE,
      note TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS project_tasks (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text TEXT,
      assignee_id TEXT REFERENCES crew_members(id) ON DELETE SET NULL,
      due_date DATE,
      done BOOLEAN DEFAULT FALSE,
      notes TEXT,
      sort INT DEFAULT 0,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Project documents on the Overview cover page (creative briefs, VPPs)
  await sql`
    CREATE TABLE IF NOT EXISTS project_docs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT DEFAULT 'brief',
      filename TEXT NOT NULL,
      mime TEXT,
      size INT,
      data BYTEA,
      uploaded_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

  // Client roster — canonical client names, selected from budgets
  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL UNIQUE,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS hub_password TEXT`;
  // Seed the roster from client names already on projects
  await sql`
    INSERT INTO clients (name)
    SELECT DISTINCT TRIM(client) FROM projects
    WHERE COALESCE(TRIM(client), '') NOT IN ('', '—')
    ON CONFLICT (name) DO NOTHING`;

  console.log('Migration complete.');
}

module.exports = migrate;
