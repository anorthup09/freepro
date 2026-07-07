# Client Project Agreement — template spec

Reference for the future **Harbinger → Send Contract** feature: after a
Harbinger form is submitted, offer to generate and e-sign this Project
Agreement, pre-filled from the budget + Harbinger. Modeled on the executed
"ResMed ASM 2026" agreement (Adobe Sign, 12 pages).

## Document structure

**Title:** PROJECT AGREEMENT — Statement of Work & Terms and Conditions

### Page 1 — Project Summary + Investment (all merge fields live here)

| Field | Source |
|---|---|
| Client Company Name | ProFi project client (Harbinger client info) |
| Project Title | ProFi project title |
| Address | Client address from the Harbinger |
| Agreement Date | date of generation |
| Total Project Investment | budget total (client-facing estimate total) |
| Client Contact | Harbinger client contact name |
| Unbridled Media Contact | Harbinger PM / submitter |

**Project Investment table** — same buckets as the Estimate Overview:

| Line | Description (fixed copy) | Amount source |
|---|---|---|
| Pre-Production / Creative Costs | "Creative development, planning, logistics, and coordination." | scripting/creative sections subtotal |
| Production Costs | "Crew, equipment, and resources required to capture content and execute shoot(s)." | production sections subtotal |
| Post-Production Costs | "Editing, color, sound, motion graphics, revisions, and delivery of final assets." | post sections subtotal |
| Travel Costs | "Projected costs associated with crew travel, including airfare, lodging, per diem, ground transportation, and insurance." | travel lines subtotal |
| **TOTAL PROJECT INVESTMENT** | | grand total |

(Management fee is folded into the buckets per the client-facing estimate,
not shown as its own line.)

### Pages 2–10 — Standard Terms and Conditions (static boilerplate)

Sections, verbatim from the executed contract (full text lives in the PDF —
keep a canonical copy at `docs/contract-boilerplate.txt` when building):

1. Definitions (Deliverables, Fees, IP Rights, Services, SOW)
2. Scope of Services (SOWs; estimates only; customer assistance; **no
   retention of project materials after completion unless agreed**)
3. Term and Termination (15-day cure; 30-day no-cause termination; survival)
4. Fees and Payment — key business terms:
   - **80% due net-30 from execution, 20% net-30 after completion**
   - 18%/yr interest on late payment
   - expenses reimbursable; Company may require pre-payment of third-party costs
   - change orders / rush charges billable (4.5)
   - **cancellation fee ladder: 0–25% → 25%, 26–50% → 50%, 51–75% → 75%,
     76–100% → 100% of budget; 100% within one week of completion**
5. Representations & Warranties (re-perform or refund as sole remedy; AS-IS disclaimer)
6. Confidentiality (mutual)
7. Ownership & License (deliverables to client on full payment; Unbridled
   retains portfolio/marketing rights and tooling IP; third-party content
   licensed; **7.4 explicitly permits generative-AI/third-party tech unless
   client opts out in the SOW**)
8. Authorized Agent & Indemnification
9. Limitation of Liability (capped at fees paid under the SOW)
10. General (publicity rights, notices to 1115 Grant St. Denver CO 80203 /
    info@unbridledmedia.com, Colorado law, Denver venue, JAMS mediation →
    arbitration, independent contractor, 1-year non-solicit, entire agreement)

### Page 11 — Signature page ("NEXT STEPS")

Two signature blocks (Unbridled Media / Client): Signature, Printed Name,
Date. The executed example ran through Adobe Sign; our build can reuse the
existing FreePro e-sign flow (`/contract/:token`) with an audit trail
(created / emailed / viewed / signed timestamps) like the crew deal memos.

## Build notes (when we get to it)

- Generation point: Harbinger submit → pop-up "Send contract?" (already in
  EMAIL_TODO). Prefill everything from the budget + Harbinger; PM reviews
  page 1 numbers before sending.
- The investment buckets map 1:1 to the Estimate Overview logic in
  `frontend/src/pages/FinanceProject.jsx` (`OverviewEstimateModal`) — reuse
  that subtotaling.
- Output: HTML → printable PDF page styled like the original (white, serif
  headers, "-- n of 12 --" footers), plus client e-sign link + signed-copy
  storage on the ProFi project.
- Source PDF for the boilerplate text: ResMed ASM 2026 executed agreement
  (uploaded 2026-07-07).
