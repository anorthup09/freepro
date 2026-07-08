# Unbridled Operating Platform — working notes

Four apps in one deploy: ProFi (finance), FreePro (production), AvocadoPost
(post), Team Management (PTO/roster). React (frontend/) + Express/Postgres
(backend/) served from backend/public on Railway; push to `main` deploys,
mirror to `claude/video-shoot-backend-f33oxv`.

Deploy: `cd frontend && npm run build && cp -r dist/* ../backend/public/`,
commit, push both branches.

## Feature walkthrough PDF (standing instruction)

Every new user-facing function added from 2026-07-08 onward gets documented
for the team walkthrough — but ONLY after the user says the feature is
approved. Until then, build and deploy the feature and wait; add the
walkthrough entry + screenshot + PDF regen only on their approval.

1. Append an entry to `docs/walkthrough/entries.json`:
   `{ "title", "what", "where", "how": [steps], "screenshot": "file.png" }`
2. Save a screenshot of the feature to `docs/walkthrough/shots/`
   (Playwright against the local stack, 1280px wide).
3. Regenerate the PDF: `node docs/walkthrough/build.mjs` and send it to the
   user (`docs/walkthrough/whats-new.pdf`).

Each entry answers: what the new function is, where to access it, and how
to use it (numbered steps).

## Other standing lists

- `EMAIL_TODO.md` — every email-dependent feature, dormant until SMTP.
- `docs/CLIENT_CONTRACT_TEMPLATE.md` — spec for Harbinger → Send Contract.
