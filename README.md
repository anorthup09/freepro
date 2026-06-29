# FreePro — Video Shoot Management

Backend API for managing video production projects, crew, schedules, deliverables, and travel.

## Stack
- **Node.js + Express** — API server
- **PostgreSQL** — database
- **Prisma** — ORM + migrations
- **JWT** — auth

## Quick Start

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET

npm install
npm run db:push      # create tables
npm run db:seed      # load Casey's C3 2026 sample data
npm run dev          # start dev server on :3001
```

## API Overview

| Resource | Base Path |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` |
| Projects | `GET/POST /api/projects` · `GET/PATCH/DELETE /api/projects/:id` |
| Locations | `/api/projects/:id/locations` |
| Tech Specs | `PUT /api/projects/:id/tech-specs` |
| Contacts | `/api/projects/:id/contacts` |
| Talent | `/api/projects/:id/talent` |
| Crew | `GET/POST /api/crew` · `/api/projects/:id/crew` |
| Schedule | `/api/projects/:id/schedule` · `.../days` · `.../events` |
| Deliverables | `/api/projects/:id/deliverables` |
| Hotels | `/api/projects/:id/travel/hotels` |
| Flights | `/api/projects/:id/travel/flights` |
| Drive Groups | `/api/projects/:id/travel/drives` |

## Roles
- `ADMIN` — full access
- `PRODUCER` — read/write everything except delete users/projects
- `CREW` — read only
- `CLIENT` — read only (future: filtered view)
