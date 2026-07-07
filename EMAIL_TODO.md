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
- [ ] **Gear request status updates** — optional reply/confirmation to the
      requester when the gear team fulfills a request.

## Notes

- All senders share one transport: `backend/src/lib/mailer.js`
  (nodemailer). If SMTP env vars are unset, sends fail gracefully — features
  still work, mail is just skipped/501.
- Test after connecting: submit a gear request and a Harbinger on a test
  project and confirm both emails arrive.
