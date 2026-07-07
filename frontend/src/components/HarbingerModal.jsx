import React, { useState } from 'react';
import { api } from '../api.js';

const inS = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'8px 10px', fontSize:13, width:'100%', minWidth:0 };
const areaS = { ...inS, minHeight:70, fontFamily:'inherit', resize:'vertical' };
const lbl = { fontSize:11, fontWeight:600, color:'var(--text)', display:'block', marginBottom:4, textTransform:'none', letterSpacing:'normal', textAlign:'left' };
const hint = { fontSize:10, color:'var(--muted)', marginTop:-2, marginBottom:4 };
const req = <span style={{ color:'#e05252' }}> *</span>;
const secHead = { fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.1em', color:'#5ABF80', margin:'10px 0 2px' };

const FIELD_LABELS = [
  ['email', 'Your Email Address'], ['clientCompany', 'Client Company Name'], ['projectName', 'Name of Project'],
  ['proposedCode', 'Proposed Code'], ['solutionsCode', 'Existing Solutions / Client Code'],
  ['sow', 'SOW & Project Description'], ['budgetSummary', 'Budget Summary / Breakdown'],
  ['clientContacts', 'Client Contacts'], ['contractSigned', 'Contract (or MSA) Already Signed'],
  ['primaryContactName', 'Primary Client Contact'], ['primaryContactEmail', 'Primary Contact Email'],
  ['mailingAddress', 'Client Mailing Address'], ['invoiceCc', 'Contract/Invoice CC'],
  ['mediaRevenue', 'Media Revenue'], ['capcoRevenue', 'Capture Co Revenue'],
  ['mediaCommissionOwners', 'Media Commission Owner(s)'], ['budgetOwner', 'Budget Owner'],
  ['mediaCommissionPct', 'Media Commission % Breakdown'], ['solutionsCommissionOwners', 'Solutions Commission Owner(s)'],
  ['noCommissions', 'No Commissions'], ['solutionsCommissionPct', '% for Solutions Commission(s)'],
  ['budgetLink', 'Link to Budget'], ['creativeNotes', 'Creative Direction Notes'],
  ['videoReferences', 'Video References'], ['kickoffDate', 'Client Kickoff Call Date'],
  ['preferredPm', 'Preferred PM(s)'], ['preferredProducer', 'Preferred Producer(s)/Director(s)'],
  ['budgetedPositions', 'Budgeted Positions'], ['shootingLocations', 'Shooting Location(s)'],
  ['gearScope', 'Gear Scope/Summary'], ['productionDates', 'Production and Travel Dates'],
  ['preferredCrew', 'Preferred Crew'], ['crewNotes', 'Crew Preference Notes'],
  ['preferredEditors', 'Preferred Editor(s)'], ['proColorist', 'Pro Colorist Needed'],
  ['proAudio', 'Pro Audio Engineer Needed'], ['finalDelivery', 'Estimated Final Delivery'],
  ['closeMonth', 'Estimated Close Month'], ['notes', 'Notes'],
];

// Read-only view of a submitted Harbinger
export function HarbingerView({ harbinger, onClose }) {
  const d = harbinger.data || {};
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:130, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 14px', overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #5ABF80', borderRadius:12, padding:'22px 26px', width:'100%', maxWidth:680 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800 }}>Harbinger — Submitted</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
              Submitted {harbinger.created_at ? new Date(harbinger.created_at).toLocaleString() : ''}{harbinger.submitted_by ? ` · ${harbinger.submitted_by}` : ''}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {FIELD_LABELS.map(([k, label]) => {
          const v = d[k];
          if (v === undefined || v === null || v === '' || v === false) return null;
          return (
            <div key={k} style={{ marginBottom:12 }}>
              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:13, whiteSpace:'pre-wrap' }}>{v === true ? 'Yes' : String(v)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Internal kickoff form ("Harbinger") — opens the project code with accounting.
// Shown when a budget moves from RFP to Live. `initial` carries prefills.
export default function HarbingerModal({ pid, initial, onClose, onSubmitted }) {
  const [f, setF] = useState({
    email: '', clientCompany: '', projectName: '', proposedCode: '', solutionsCode: '',
    sow: '', budgetSummary: '', clientContacts: '', contractSigned: false,
    primaryContactName: '', primaryContactEmail: '', mailingAddress: '', invoiceCc: '',
    mediaRevenue: '', capcoRevenue: '', mediaCommissionOwners: '', budgetOwner: '',
    mediaCommissionPct: '', solutionsCommissionOwners: '', noCommissions: false, solutionsCommissionPct: '',
    budgetLink: '', creativeNotes: '', videoReferences: '', kickoffDate: '',
    preferredPm: '', preferredProducer: '', budgetedPositions: '', shootingLocations: '',
    gearScope: '', productionDates: '', preferredCrew: '', crewNotes: '',
    preferredEditors: '', proColorist: '', proAudio: '', finalDelivery: '', closeMonth: '', notes: '',
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const ok = f.email && f.clientCompany && f.projectName && f.proposedCode && f.sow
    && f.primaryContactName && f.primaryContactEmail && f.mailingAddress && f.invoiceCc
    && f.mediaRevenue && f.budgetOwner && f.finalDelivery && f.closeMonth;

  async function submit() {
    if (!ok || saving) return;
    setSaving(true);
    try {
      await api.submitHarbinger(pid, f);
      onSubmitted && onSubmitted();
      onClose();
    } catch (e) { alert(e.message); setSaving(false); }
  }

  const text = (label, k, required, hintText) => (
    <div key={k}>
      <label style={lbl}>{label}{required ? req : null}</label>
      {hintText && <div style={hint}>{hintText}</div>}
      <input style={inS} value={f[k]} onChange={set(k)} />
    </div>
  );
  const area = (label, k, required, hintText) => (
    <div key={k}>
      <label style={lbl}>{label}{required ? req : null}</label>
      {hintText && <div style={hint}>{hintText}</div>}
      <textarea style={areaS} value={f[k]} onChange={set(k)} />
    </div>
  );
  const check = (label, k, hintText) => (
    <div key={k} onClick={() => setF(v => ({ ...v, [k]: !v[k] }))}
      style={{ display:'flex', alignItems:'center', justifyContent:'flex-start', gap:8, fontSize:13, cursor:'pointer', color:'var(--text)' }}>
      <input type="checkbox" checked={f[k]} onChange={set(k)} style={{ width:'auto', margin:0, flexShrink:0 }} />
      <span>{label}{hintText && <span style={{ color:'var(--muted)', fontSize:11 }}> — {hintText}</span>}</span>
    </div>
  );
  const yesNo = (label, k) => (
    <div key={k}>
      <label style={lbl}>{label}</label>
      <select style={inS} value={f[k]} onChange={set(k)}>
        <option value="">— Select —</option>
        <option>Yes</option>
        <option>No</option>
      </select>
    </div>
  );
  const row = (...kids) => <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>{kids.map((k2, i) => <div key={i} style={{ flex:1, minWidth:180 }}>{k2}</div>)}</div>;

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:130, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 14px', overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #5ABF80', borderRadius:12, padding:'22px 26px', width:'100%', maxWidth:720 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:4 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800 }}>Harbinger — Project Initiation</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
              Kicks off the project internally and notifies accounting to open the project code. Submitting moves this budget to <b style={{ color:'#5ABF80' }}>Live</b>.
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12 }}>
          <div style={secHead}>Project</div>
          {row(text('Your Email Address', 'email', true, 'Shows on the contract sent to the client.'),
               text('Client Company Name', 'clientCompany', true))}
          {row(text('Name of Project', 'projectName', true),
               text('Proposed Code', 'proposedCode', true))}
          {text('Existing Solutions Code or Client Specific Code (If Applicable)', 'solutionsCode')}
          {area('SOW & Project Description (Summary of Project, # of deliverables, etc…)', 'sow', true)}
          {area('Budget Summary / Breakdown', 'budgetSummary', false, 'Optional — only if the client needs a budget breakdown on the contract. The total project estimate appears on the contract regardless.')}

          <div style={secHead}>Client</div>
          {area('Client Contacts (Names, positions, involvement, who to send invoices to, etc…)', 'clientContacts')}
          {check('Contract (or MSA) is Already Signed', 'contractSigned')}
          {row(text('Primary Client Contact — Full Name', 'primaryContactName', true),
               text('Primary Client Contact — Email Address', 'primaryContactEmail', true))}
          {text('Client/Company Mailing Address', 'mailingAddress', true)}
          {text('Contract/Invoice CC', 'invoiceCc', true, 'Anyone else who receives a copy of the contract or invoices.')}

          <div style={secHead}>Revenue & Commissions</div>
          {row(text('Media Revenue (Total Budget minus CapCo Allocation)', 'mediaRevenue', true),
               text('Capture Co Revenue Amount (If Applicable)', 'capcoRevenue'))}
          {row(text('Media Commission Owner(s) (If applicable)', 'mediaCommissionOwners'),
               text('Budget Owner (Primary Contact at Unbridled Media)', 'budgetOwner', true))}
          {text('Media Commission % Breakdown', 'mediaCommissionPct')}
          {row(text('Solutions Commission Owner(s) (If Applicable)', 'solutionsCommissionOwners'),
               text('% for Solutions Commission(s)', 'solutionsCommissionPct'))}
          {check('No Commissions', 'noCommissions', 'check if there are no commissions')}

          <div style={secHead}>Creative & Kickoff</div>
          {text('Link to Budget', 'budgetLink')}
          {area('Creative Direction Notes', 'creativeNotes')}
          {text('Link to video references shared with client or that exemplify target creative', 'videoReferences')}
          {row(
            <div>
              <label style={lbl}>Client Kickoff Call Date?</label>
              <input type="date" style={inS} value={f.kickoffDate} onChange={set('kickoffDate')} />
            </div>,
            text('Preferred PM(s)', 'preferredPm'))}
          {text('Preferred Producer(s)/Director(s)', 'preferredProducer')}

          <div style={secHead}>Production</div>
          {area('All Budgeted Positions', 'budgetedPositions')}
          {text('Shooting Location(s) (Enter NO SHOOT if applicable)', 'shootingLocations')}
          {area('Gear Scope/Summary (Enter NO SHOOT if applicable)', 'gearScope')}
          {area('Production and Travel Dates (all key shooting dates and anticipated crew travel dates)', 'productionDates')}
          {row(text('Preferred Crew', 'preferredCrew'), text('Preferred Editor(s)', 'preferredEditors'))}
          {area('Crew Preference Notes', 'crewNotes')}
          {row(yesNo('Pro Colorist Needed?', 'proColorist'), yesNo('Pro Audio Engineer Needed?', 'proAudio'))}

          <div style={secHead}>Delivery & Close</div>
          {row(
            <div>
              <label style={lbl}>Estimated Final Delivery{req}</label>
              <input type="date" style={inS} value={f.finalDelivery} onChange={set('finalDelivery')} />
            </div>,
            text('Estimated Close Month', 'closeMonth', true))}
          {area('Notes', 'notes')}

          <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button disabled={!ok || saving} onClick={submit}
              style={{ background: ok ? '#5ABF80' : 'var(--border)', color:'#0b0b0b', border:'none', borderRadius:8, padding:'10px 22px', fontSize:13, fontWeight:800, cursor: ok ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Submitting…' : 'Submit Harbinger & Go Live'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
