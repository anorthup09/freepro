// Branded HTML email templates. Every template also has a text fallback at
// the call site so plain-text clients still get the content.

const BRAND = {
  orange: '#E8500A', dark: '#141210', panel: '#f9f8f6', border: '#e7e2da',
  ink: '#1a1a1a', muted: '#6d675f', green: '#3f9d68', yellow: '#b8930f',
};

const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const nl2br = v => esc(v).replace(/\n/g, '<br/>');

function shell(title, inner) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#edeae5">
  <div style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:18px 10px;color:${BRAND.ink}">
    <div style="background:${BRAND.dark};padding:22px 26px;border-radius:10px 10px 0 0">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:20px;font-weight:800;color:#fff;letter-spacing:.02em">UNBRIDLED <span style="color:${BRAND.orange}">MEDIA</span></td>
        <td align="right" style="font-size:10px;color:#9a938a;text-transform:uppercase;letter-spacing:.14em">${esc(title)}</td>
      </tr></table>
    </div>
    ${inner}
    <div style="text-align:center;padding:16px 8px 6px;font-size:10px;color:#9a938a">
      Sent automatically by the Unbridled Operating Platform
    </div>
  </div></body></html>`;
}

const section = (label, rowsHtml) => `
  <div style="background:#fff;border:1px solid ${BRAND.border};border-top:none;padding:18px 26px">
    <div style="font-size:11px;font-weight:800;color:${BRAND.orange};text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">${esc(label)}</div>
    ${rowsHtml}
  </div>`;

const row = (label, value) => value ? `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px"><tr>
    <td width="190" valign="top" style="font-size:12px;color:${BRAND.muted};padding:2px 0">${esc(label)}</td>
    <td valign="top" style="font-size:13px;color:${BRAND.ink};padding:2px 0;font-weight:600">${nl2br(value)}</td>
  </tr></table>` : '';

const block = (label, value) => value ? `
  <div style="margin-bottom:10px">
    <div style="font-size:12px;color:${BRAND.muted};margin-bottom:3px">${esc(label)}</div>
    <div style="font-size:13px;line-height:1.55;background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:8px;padding:10px 14px">${nl2br(value)}</div>
  </div>` : '';

// ── Harbinger kickoff report ──
function harbingerHtml({ project, d, appUrl }) {
  const fmt$ = n => (n === undefined || n === null || n === '') ? '' : ('$' + Number(String(n).replace(/[^0-9.\-]/g, '') || 0).toLocaleString('en-US'));
  const hero = `
    <div style="background:${BRAND.orange};padding:20px 26px;color:#fff">
      <div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;opacity:.85">New project ready for assignment &amp; kickoff</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px">${esc(project.code)} — ${esc(project.title)}</div>
      <div style="font-size:13px;margin-top:2px;opacity:.9">${esc(project.client || d.clientCompany || '')}</div>
      <div style="font-size:11px;margin-top:10px;opacity:.85">Submitted by ${esc(d.email || d.submittedBy || 'the team')}</div>
    </div>`;
  const inner = hero
    + section('Project', row('Proposed Code', d.proposedCode || project.code) + row('Project Name', d.projectName || project.title)
        + row('Solutions / Client Code', d.solutionsCode) + block('SOW & Description', d.sow))
    + section('Client', row('Client Company', d.clientCompany || project.client) + row('Primary Contact', d.primaryContactName)
        + row('Primary Contact Email', d.primaryContactEmail) + row('Contract / Invoice CC', d.invoiceCc)
        + row('Mailing Address', d.mailingAddress) + block('Client Contacts', d.clientContacts)
        + row('Contract / MSA signed', d.contractSigned ? 'Yes' : 'No') + row('Link to Contract', d.contractLink))
    + section('Budget', row('Budget', fmt$(d.mediaRevenue) || d.mediaRevenue) + row('Capture Co Revenue', fmt$(d.capcoRevenue) || d.capcoRevenue)
        + row('Budget Owner', d.budgetOwner) + row('Link to Budget', d.budgetLink) + block('Budget Summary', d.budgetSummary)
        + row('Media Commission Owner(s)', d.mediaCommissionOwners) + row('Media Commission %', d.mediaCommissionPct)
        + row('Solutions Commission Owner(s)', d.solutionsCommissionOwners) + row('Solutions Commission %', d.solutionsCommissionPct))
    + section('Important Dates', row('Client Kickoff Call', d.kickoffDate) + row('Production / Travel Dates', d.productionDates)
        + row('Final Delivery', d.finalDelivery) + row('Estimated Close', d.closeMonth))
    + section('Production & Post', row('Shooting Location(s)', d.shootingLocations) + block('Budgeted Positions', d.budgetedPositions)
        + block('Gear Scope / Summary', d.gearScope) + row('Preferred PM(s)', d.preferredPm)
        + row('Preferred Producer(s)/Director(s)', d.preferredProducer) + row('Preferred Crew', d.preferredCrew)
        + row('Preferred Editor(s)', d.preferredEditors) + row('Pro Colorist Needed', d.proColorist)
        + row('Pro Audio Engineer Needed', d.proAudio) + block('Creative Direction', d.creativeNotes)
        + row('Video References', d.videoReferences) + block('Notes', d.notes))
    + `<div style="background:#fff;border:1px solid ${BRAND.border};border-top:none;border-radius:0 0 10px 10px;padding:20px 26px;text-align:center">
        ${appUrl ? `<a href="${esc(appUrl)}" style="display:inline-block;background:${BRAND.orange};color:#fff;text-decoration:none;padding:11px 26px;border-radius:8px;font-size:13px;font-weight:700">Open the project →</a>` : ''}
        <div style="font-size:12px;color:${BRAND.muted};margin-top:14px">Thank you for your human cooperation.<br/><b>Love, Harbinger</b></div>
      </div>`;
  return shell('Harbinger Kickoff', inner);
}

module.exports = { harbingerHtml, shell, section, row, block };
