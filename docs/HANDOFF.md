# Unbridled Operating Platform — Session Handoff

Prepared 2026-07-18 for migrating development from Alex's personal Claude
account to the corporate account. Read alongside `CLAUDE.md` (standing
instructions) — this file is the project history and working context.

## What this project is

Four apps in one deploy, one repo (`anorthup09/freepro`):

- **ProFi** — project finance: budgets, VCCs, vendor invoices, client invoices, reconciliation
- **FreePro** — production: projects, schedules, travel, catering, locations, gear, shot lists, share views
- **AvocadoPost** — post-production: edit pipelines, milestones, editor/color/audio contractors
- **Team Management** — roster, PTO, crew calendar

React (`frontend/`) + Express/Postgres (`backend/`), frontend built into
`backend/public`, deployed on Railway. **Push to `main` deploys.** All work is
developed on `claude/video-shoot-backend-f33oxv` and pushed to BOTH branches.

## Deploy loop

```
cd frontend && npm run build && cp -r dist/* ../backend/public/
git add -A && git commit
git push -u origin HEAD:claude/video-shoot-backend-f33oxv
git push origin HEAD:main
```

## Standing instructions (also in CLAUDE.md)

- Every new user-facing feature gets an entry in the **What's New v1.4 PDF**
  (`docs/walkthrough/entries.json` + 1280px screenshot in
  `docs/walkthrough/shots/` + `node docs/walkthrough/build.mjs` from repo
  root) — but **only after Alex explicitly approves the feature**. Some
  approvals say "don't note" — then skip the PDF entry.
  Entry `page` values must match the GROUPS list in
  `docs/walkthrough/build-condensed.mjs` or the entry silently drops out.
- `EMAIL_TODO.md` — email-dependent features, dormant until SMTP is set up.
- `docs/CLIENT_CONTRACT_TEMPLATE.md` — spec for Harbinger → Send Contract.
- Verify features locally with Playwright screenshots before pushing.

## Local dev environment (rebuild after container resets)

Container resets are frequent — always check `git log --oneline -1` before
editing; if it shows a stale commit, restore with:

```
git fetch origin claude/video-shoot-backend-f33oxv
git checkout -f -B claude/video-shoot-backend-f33oxv origin/claude/video-shoot-backend-f33oxv
git clean -fd
```

Stack: `pg_ctlcluster 16 main start`; run backend with `node src/index.js`
(wait for "Migration complete"); mint an admin JWT with secret
`freepro-dev-secret-change-in-production` after setting `mfa_enabled` on the
admin user. Playwright: `playwright-core` + chromium at
`/opt/pw-browsers/.../chrome` with `--no-sandbox --no-proxy-server`.
External APIs (Nominatim, OSRM, Google, OSM tiles) are blocked in the
sandbox — stub with `page.route()`; they work in production.

## Feature history (this account's sessions, most recent last)

Everything below is built, deployed, and (unless noted) in the What's New PDF
(26 entries as of today):

1. **Vendor Contracts Report** — production + post contractors unioned, ordered
   by start date, archived when end date passes, click a row for the contract
   detail form. Post contractors coded to `5400 Logistics Labor (B)`.
2. **Music Resources & Video References** — shared link libraries with
   populating category tags (no duplicates), under Reports & Resources.
3. **Reports → renamed "Reports & Resources".**
4. **Color & Audio tracker** — separate tracker on Project Video Tracker tab
   (+Add Color / +Add Audio), billing info, roster name autosearch, invoice-to
   defaults to current user, click row to reopen, Hold Cost on VCC + Send
   Contract at form bottom, start/end dates, feeds Vendor Contracts report.
5. **Send Contract flow for post contractors** — review-modal email from
   info@, signing page at `/contract/:token`, flat `quoted_total`.
6. **Room/Space quick fill** — per-shoot saved values, datalist + chips.
7. **Travel crew dropdowns** — full roster optgroups, preferred names,
   Duplicate Flight (confirm new cost), hotel + rental-car locations feed the
   Locations tab (rental feed is server-side upsert in `travel.js`).
8. **Event tile layout** — addresses right-aligned, drive time bottom-right
   (Nominatim + OSRM via `frontend/src/utils/driveTime.js`), on share views
   AND internal schedule.
9. **Lunch end time** (approved "don't note" — no PDF entry).
10. **Catering delivery checkbox** — unchecked = reservation: address becomes a
    driving stop; "Reservation/Delivery Time" label.
11. **One-off event locations** — ad-hoc location + Google-searchable address
    (`/util/place-search`: Google Places if `GOOGLE_MAPS_API_KEY` set, else
    Nominatim) without touching the Locations tab.
12. **Crew grid** — unfilled positions hidden (approved "don't note").
13. **Jump to Live** — button with pulsing dot on producer/crew/client views;
    scrolls to the live/recent/next event.
14. **Custom milestones** in the post timeline — add anywhere, single person
    selector (same style as editor dropdown), feeds their task checklist;
    strict 2-line mobile grid. **NOT yet in the What's New PDF — awaiting
    approval to note.**
15. **Live pulse** — `.ev-body.ev-live` orange left edge + glow on the current
    time block: share views, internal schedule, and flights while in the air
    (UTC instant comparison; suppressed once status says Arrived/Landed/
    Cancelled). In PDF.
16. **Hub greeting** — schedule-derived city (weather location → venue address
    parse → project city), placeholder-dash cities rejected (must contain
    letters), broken cached greetings regenerate. Greetings cache per
    user/day in `daily_greetings`.
17. **Swipe-left phone reminders** — share-view timeline tiles swipe left to
    reveal **+Reminder** (no emoji); downloads an .ics with a 30-min-before
    alert (floating local time; flights use UTC instants). Hint text next to
    Schedule headers. In PDF.
18. **Foodie Recs** (`/reports/foodie`, open to every role) — restaurant recs
    with 1–5 star votes (one per person, in the Add form too), photo uploads
    (base64 → bytea, authenticated blob thumbnails), Leaflet pin map with
    server-side Nominatim geocoding, live place-search on the name field
    auto-filling address/city, roster search bar. Tables: `foodie_recs`,
    `foodie_photos`, `foodie_ratings`. **Awaiting What's New approval.**
19. **Hub trip prompt** — when the signed-in user has a crew assignment
    spanning today, an orange banner offers one-tap access to the public
    share view: admin/producer/agency → producer view, crew → crew view
    (token found or created on demand). Dismissible per day per project.
    **Awaiting What's New approval.**

## Open items / pending

- **What's New entries awaiting approval**: custom milestones, Foodie Recs,
  Hub trip prompt.
- **ANTHROPIC_API_KEY on Railway** — deferred ("skip for now"); enables the
  AI-written hub greeting (falls back to canned lines without it).
- **GOOGLE_MAPS_API_KEY** — optional; upgrades place search + geocoding.
- **SMTP** — everything in `EMAIL_TODO.md` is dormant until configured.
- One-off deliverable delivered: platform hierarchy diagram
  (`platform-map.html/png`).

## Conventions & gotchas

- Commits end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- `.live` CSS class is a green pill — live tiles use `.ev-live`; the pulsing
  dot is `.live-dot`.
- Flight times are TIMESTAMPTZ UTC instants; schedule event times are
  wall-clock strings — never mix the two comparison styles.
- New `ALTER TABLE` migrations must come AFTER the table's `CREATE TABLE` in
  `backend/src/lib/migrate.js` (fresh-DB ordering bug bit us once).
- `api.js` BACKEND base: `localhost` hostname points at production Railway —
  use `127.0.0.1` when testing locally.
- Role gates live in `backend/src/index.js` (`crewAllowed`, AGENCY, FINANCE) —
  new open-to-everyone routes must be added there.
- File uploads: JSON base64 → bytea, served via authenticated `/file`
  endpoints; images displayed via authFetch → blob → objectURL.
- postgres.js: `sql.json()` for JSONB writes; jsonb `||` merge for partial
  JSONB updates.
