# Email Functions — Setup & To-Do

Running list of everything email-related, to activate/build once the email
link (SMTP) is connected. Keep this file updated as email features are added.

## Environment variables to set on Railway

| Variable | Purpose |
|---|---|
| `SMTP_HOST` | Mail server host |
| `SMTP_PORT` | Mail server port (defaults sensibly if omitted) |
| `SMTP_USER` | Mail account username |
| `SMTP_PASS` | Mail account password / app password |
| `MAIL_FROM` | From address (falls back to `SMTP_USER`) |
| `HARBINGER_EMAIL` | Accounting recipient for Harbinger submission reports |

## Already built — go live as soon as SMTP is connected

- [ ] **Harbinger submission report** — full kickoff report emailed to
      `HARBINGER_EMAIL` when a budget moves RFP → Live and the form is
      submitted. (`backend/src/routes/finance.js`)
- [ ] **Contract / deal memo send** — one-click email of the signing link to
      contract crew from the crew grid. (`backend/src/routes/contracts.js`)
- [ ] **Gear request notification** — full gear request emailed to
      `mvitro@unbridledmedia.com` on submission.
      (`backend/src/routes/gearRequests.js`)
- [ ] **Outlook calendar holds** — assigning an Unbridled crew member to a
      shoot (with dates) emails them an .ics meeting request; re-sends an
      update when dates change. (`backend/src/lib/ics.js`,
      `backend/src/routes/projects.js`)
- [ ] **Crew question notification** — emails the project POC when a crew
      member submits a question from a shared call sheet.
      (`backend/src/routes/share.js` → `backend/src/lib/email.js`)

## To build once email works

- [ ] **Gear request amendment notification** — when a locked gear request is
      amended (FreePro → Gear Request → Amend Gear Request), the change report is
      already posted to the shoot's gear activity feed. Once SMTP is live, also
      tag Mason Vitro and email him the amendment report. Hook: the amend endpoint
      in `backend/src/routes/gearRequests.js` (POST /project/:pid/amend) — send to
      `mvitro@unbridledmedia.com` with the diff.

- [ ] **Client invoice send** — the ✉ Send Invoice buttons on VCC deposits
      currently auto-date the invoice; wire them to actually email the client
      (invoice PDF or summary, using the budget's client contacts from the
      Harbinger).
- [ ] **Weekly finance report email** — auto-send the Friday finance report
      (PDF or link) to the finance team instead of requiring a manual pull.
- [ ] **Harbinger copy to submitter** — CC the person who submitted the
      Harbinger so they have the kickoff record.
- [ ] **Contract signed confirmation** — notify the producer when a
      contractor e-signs their deal memo.
- [ ] **Calendar hold cancellations** — send METHOD:CANCEL when someone is
      unassigned or an assignment is deleted.
- [ ] **AvocadoPost edit assignments** — when AvocadoPost is built, extend
      the same system to editors: assigning someone to an edit sends an
      Outlook hold for the edit window, and edit assignments appear as bars
      on the Crew Calendar alongside shoots. (The hold sender in
      `backend/src/lib/ics.js` is generic — just wire Avo's assignment
      events into `sendCalendarHold` and add its rows to
      `/api/projects/crew-calendar`.)
- [ ] **Gear request status updates** — optional reply/confirmation to the
      requester when the gear team fulfills a request.
- [ ] **Harbinger → send contract** — after a Harbinger form is submitted,
      auto-populate a pop-up asking whether to send the contract, and email
      the contract/e-sign link to the client right from that prompt (uses the
      client contacts captured on the Harbinger). Contract format is specced
      in `docs/CLIENT_CONTRACT_TEMPLATE.md` (from the executed ResMed ASM
      2026 agreement); boilerplate text in `docs/contract-boilerplate.txt`.
- [ ] **PTO request → manager approval email** — `backend/src/routes/team.js`
      POST /pto emails the selected manager ("PTO Request — {title}" with
      type, dates, shoot conflicts, comp reference). Once SMTP is live, also
      notify the extra team members listed on the request and confirm
      approval back to the requester.
- [ ] **Contractor sourcing blasts (shoots + edits)** — replace one-off
      texts/emails to individual contractors when a role needs filling.
      Rough shape (exact home/UX TBD): pick a role + scope of work + dates
      from a shoot or Avo edit, select matching contractors from the crew
      roster (by position/skill/market), and email them all the scope at
      once with a respond-if-interested link; responses collect back on the
      project so the producer picks from the interested pool instead of
      chasing threads. Could live on the FreePro crew tab and/or the Avo
      edit page; needs SMTP first.

## Notes

- All senders share one transport: `backend/src/lib/mailer.js`
  (nodemailer). If SMTP env vars are unset, sends fail gracefully — features
  still work, mail is just skipped/501.
- Test after connecting: submit a gear request and a Harbinger on a test
  project and confirm both emails arrive.
- [ ] **Password reset email** — `backend/src/routes/auth.js` POST
      /forgot-password sends "Reset your password" with a 1-hour single-use
      link (/reset-password/:token). Dormant until SMTP; until then admins
      can reset passwords manually.
- **Call sheet email sending (FreePro → Send Call Sheet Emails page)** — the page, recipient picker (producers/crew/client/talent), and AI draft are live; the "Send Emails" button is waiting on email. Requirement: send directly from the Main POC's inbox (per-user Gmail/Outlook OAuth, not a shared SMTP identity). Until then the page hands off via "Open in Mail App" with recipients in BCC.
