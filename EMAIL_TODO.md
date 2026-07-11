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
| `MAIL_FROM_INFO` | Sender for Harbinger kickoff reports (defaults to info@unbridledmedia.com) |
| `MAIL_FROM_ACCOUNTING` | Sender for client invoices (e.g. accounting@unbridledmedia.com) |
| `MAIL_FROM_PRODUCTION` | Sender for calendar holds/cancels, contracts, crew questions |
| `MAIL_FROM_GEAR` | Sender for gear request + amendment notifications |
| `MAIL_FROM_TEAM` | Sender for PTO/OOO requests, approvals, FYIs |
| `MAIL_FROM_POST` | Sender for AvocadoPost approvals, mentions, RFR notices |
| `MAIL_FROM_NOREPLY` | Sender for password resets |

Every identity falls back to `MAIL_FROM` until its variable is set, so the
addresses can be provisioned one at a time. The SMTP account needs Send-As
permission on each address (Outlook 365: shared mailbox or alias).

## Already built — go live as soon as SMTP is connected

> **UI note:** while SMTP/Outlook is unconnected, user-triggered email actions
> show an "Email Automation — Under Construction" pop-up (target: full Outlook
> integration by end of July). Backend automations log a skip instead.

- [x] **Gear request amendment → Mason** — amend emails the diff report.
- [x] **Client invoice send** — Send Invoice emails the client contacts a summary.
- [x] **Harbinger CC to submitter** — kickoff report CCs whoever submitted it.
- [x] **Contract signed confirmation** — Main POC is emailed on e-sign.
- [x] **Calendar hold cancellations** — METHOD:CANCEL on unassign/delete.
- [x] **PTO notify list + approval confirmation** — FYI emails to listed teammates; requester gets an approval email.

- [ ] **Deliverable approval email** — when an edit is marked Approved in
      AvocadoPost, the lead editor gets an email (activity note logs the send).

- [ ] **Harbinger submission report** — designed HTML kickoff report from
      info@unbridledmedia.com when a budget moves RFP → Live. Recipients
      (default: aporio, khueseman, dsmith, anorthup; cc blamb, mwalsh) are
      editable in the admin Automations dashboard on the hub.
      (`backend/src/routes/finance.js`, `backend/src/lib/emailTemplates.js`)
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

- [x] **Gear request amendment notification** — when a locked gear request is
      amended (FreePro → Gear Request → Amend Gear Request), the change report is
      already posted to the shoot's gear activity feed. Once SMTP is live, also
      tag Mason Vitro and email him the amendment report. Hook: the amend endpoint
      in `backend/src/routes/gearRequests.js` (POST /project/:pid/amend) — send to
      `mvitro@unbridledmedia.com` with the diff.

- [x] **Client invoice send** — the ✉ Send Invoice buttons on VCC deposits
      currently auto-date the invoice; wire them to actually email the client
      (invoice PDF or summary, using the budget's client contacts from the
      Harbinger).
- [ ] **Weekly finance report email** — auto-send the Friday finance report
      (PDF or link) to the finance team instead of requiring a manual pull.
- [x] **Harbinger copy to submitter** — CC the person who submitted the
      Harbinger so they have the kickoff record.
- [x] **Contract signed confirmation** — notify the producer when a
      contractor e-signs their deal memo.
- [x] **Calendar hold cancellations** — send METHOD:CANCEL when someone is
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
- [x] **PTO request → manager approval email** — `backend/src/routes/team.js`
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

- Every notification uses the shared branded HTML design
  (`backend/src/lib/emailTemplates.js` → `noticeHtml`): dark UNBRIDLED MEDIA
  header, colored hero, labeled rows, optional button/copy-link, and a
  postmark timestamp. Plain-text fallbacks ride along on every send.
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
