import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../api.js';

// Close-month options: 6 months back through ~3 years out. Value stays YYYY-MM
// (matches how the budget stores close_month); label shows MM-YYYY.
function closeMonthOptions() {
  const opts = [];
  const start = new Date();
  start.setMonth(start.getMonth() - 6, 1);
  for (let i = 0; i < 43; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    opts.push({ value: `${d.getFullYear()}-${mm}`, label: `${mm}-${d.getFullYear()}` });
  }
  return opts;
}

const isUnbridled = m => (m.company || '').toLowerCase().includes('unbridled');
const crewLabel = m => [m.preferred_first_name, m.preferred_last_name].filter(Boolean).join(' ').trim() || m.name || '';

// Tag Unbridled crew members into a comma-joined text field (chips + search).
function CrewTagField({ label, value, onChange, crew }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tags = String(value || '').split(',').map(s => s.trim()).filter(Boolean);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const add = name => {
    if (!tags.some(t => t.toLowerCase() === name.toLowerCase())) onChange([...tags, name].join(', '));
    setQ(''); setOpen(false);
  };
  const remove = name => onChange(tags.filter(t => t !== name).join(', '));
  const matches = crew
    .filter(isUnbridled)
    .map(crewLabel).filter(Boolean)
    .filter(n => !tags.some(t => t.toLowerCase() === n.toLowerCase()))
    .filter(n => !q.trim() || n.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={lbl}>{label}</label>
      <div style={{ ...inS, display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', minHeight: 38, padding: '5px 7px' }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(90,191,128,0.16)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            {t}<span onClick={() => remove(t)} style={{ cursor: 'pointer', fontWeight: 800 }}>✕</span>
          </span>
        ))}
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={tags.length ? '' : 'Search Unbridled crew…'}
          style={{ flex: 1, minWidth: 90, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13 }} />
      </div>
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 140, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 7, marginTop: 3, maxHeight: 200, overflowY: 'auto', boxShadow: '0 8px 22px rgba(0,0,0,0.5)' }}>
          {matches.slice(0, 30).map(n => (
            <div key={n} onClick={() => add(n)} style={{ padding: '7px 10px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const setVal = (k, val) => setF(v => ({ ...v, [k]: val }));

  const [crew, setCrew] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [sowLoading, setSowLoading] = useState(false);
  const cmOptions = useMemo(closeMonthOptions, []);

  // Load crew roster + saved client contacts, and draft the SOW synopsis with AI
  useEffect(() => {
    api.getCrew().then(setCrew).catch(() => {});
    api.clientContacts().then(setContacts).catch(() => {});
    generateSow();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generateSow() {
    setSowLoading(true);
    try {
      const { sow } = await api.harbingerSow(pid);
      if (sow) setF(v => ({ ...v, sow }));
    } catch { /* keep the existing prefill */ }
    setSowLoading(false);
  }

  // Client search / autofill: match the typed company to the saved roster
  const clientMatch = useMemo(() => contacts.find(c =>
    (c.name || '').trim().toLowerCase() === (f.clientCompany || '').trim().toLowerCase()), [contacts, f.clientCompany]);
  const clientSuggestions = useMemo(() => {
    const q = (f.clientCompany || '').trim().toLowerCase();
    if (!q) return [];
    return contacts.filter(c => (c.name || '').toLowerCase().includes(q) && (c.name || '').toLowerCase() !== q).slice(0, 8);
  }, [contacts, f.clientCompany]);
  const [clientOpen, setClientOpen] = useState(false);

  // When the typed company exactly matches a saved client, fill any empty
  // contact fields (never clobbering values already entered/prefilled)
  useEffect(() => {
    if (!clientMatch) return;
    setF(v => ({
      ...v,
      primaryContactName: v.primaryContactName || clientMatch.primary_contact_name || '',
      primaryContactEmail: v.primaryContactEmail || clientMatch.primary_contact_email || '',
      mailingAddress: v.mailingAddress || clientMatch.mailing_address || '',
      clientContacts: v.clientContacts || clientMatch.contacts_note || '',
    }));
  }, [clientMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyClient(c) {
    setF(v => ({
      ...v,
      clientCompany: c.name || v.clientCompany,
      primaryContactName: c.primary_contact_name || v.primaryContactName,
      primaryContactEmail: c.primary_contact_email || v.primaryContactEmail,
      mailingAddress: c.mailing_address || v.mailingAddress,
      clientContacts: c.contacts_note || v.clientContacts,
    }));
    setClientOpen(false);
  }

  // Contact search on the Primary Client Contact field — fills name/email/mailing
  const [contactOpen, setContactOpen] = useState(false);
  const contactSuggestions = useMemo(() => {
    const withContact = contacts.filter(c => (c.primary_contact_name || '').trim());
    const q = (f.primaryContactName || '').trim().toLowerCase();
    const list = q
      ? withContact.filter(c => c.primary_contact_name.toLowerCase().includes(q) || (c.name || '').toLowerCase().includes(q))
      : withContact;
    return list.slice(0, 8);
  }, [contacts, f.primaryContactName]);
  function applyContact(c) {
    setF(v => ({
      ...v,
      primaryContactName: c.primary_contact_name || v.primaryContactName,
      primaryContactEmail: c.primary_contact_email || v.primaryContactEmail,
      mailingAddress: c.mailing_address || v.mailingAddress,
      clientCompany: v.clientCompany || c.name || '',
    }));
    setContactOpen(false);
  }

  async function addNewClient() {
    const name = (f.clientCompany || '').trim();
    if (!name) return;
    try {
      await api.addClient(name, true);
      const list = await api.clientContacts().catch(() => contacts);
      setContacts(list);
      alert(`"${name}" added to the client roster.`);
    } catch (e) { alert(e.message); }
  }

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
            <div style={{ position:'relative' }}>
              <label style={lbl}>Client Company Name{req}</label>
              <div style={hint}>Search the client roster to auto-fill saved contact info, or add a new client.</div>
              <input style={inS} value={f.clientCompany}
                onChange={e => { setVal('clientCompany', e.target.value); setClientOpen(true); }}
                onFocus={() => setClientOpen(true)}
                onBlur={() => setTimeout(() => setClientOpen(false), 150)} />
              {clientOpen && (clientSuggestions.length > 0 || (f.clientCompany.trim() && !clientMatch)) && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:140, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:7, marginTop:3, maxHeight:220, overflowY:'auto', boxShadow:'0 8px 22px rgba(0,0,0,0.5)' }}>
                  {clientSuggestions.map(c => (
                    <div key={c.id} onMouseDown={() => applyClient(c)} style={{ padding:'7px 10px', fontSize:13, cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                      {c.name}{c.primary_contact_name ? <span style={{ color:'var(--muted)', fontSize:11 }}> · {c.primary_contact_name}</span> : null}
                    </div>
                  ))}
                  {f.clientCompany.trim() && !clientMatch && (
                    <div onMouseDown={addNewClient} style={{ padding:'8px 10px', fontSize:13, fontWeight:700, color:'#5ABF80', cursor:'pointer' }}>
                      + Add “{f.clientCompany.trim()}” as a new client
                    </div>
                  )}
                </div>
              )}
              {clientMatch && <div style={{ ...hint, color:'#5ABF80' }}>Saved client — contact info auto-filled below.</div>}
            </div>)}
          {row(text('Name of Project', 'projectName', true),
               text('Proposed Code', 'proposedCode', true))}
          {text('Existing Solutions Code or Client Specific Code (If Applicable)', 'solutionsCode')}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <label style={{ ...lbl, marginBottom:0 }}>SOW & Project Description{req}</label>
              <button type="button" onClick={generateSow} disabled={sowLoading}
                style={{ background:'rgba(90,191,128,0.14)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:8, padding:'4px 10px', fontSize:11, fontWeight:800, cursor: sowLoading ? 'default' : 'pointer', opacity: sowLoading ? 0.6 : 1 }}>
                {sowLoading ? 'Generating…' : '✨ AI synopsis from budget'}
              </button>
            </div>
            <div style={hint}>Auto-drafted from the budget allocations. Edit freely or regenerate.</div>
            <textarea style={{ ...areaS, minHeight:120, opacity: sowLoading ? 0.6 : 1 }} value={f.sow} onChange={set('sow')} />
          </div>
          {area('Budget Summary / Breakdown', 'budgetSummary', false, 'Optional — only if the client needs a budget breakdown on the contract. The total project estimate appears on the contract regardless.')}

          <div style={secHead}>Client</div>
          {area('Client Contacts (Names, positions, involvement, who to send invoices to, etc…)', 'clientContacts')}
          {check('Contract (or MSA) is Already Signed', 'contractSigned')}
          {row(
            <div style={{ position:'relative' }}>
              <label style={lbl}>Primary Client Contact — Full Name{req}</label>
              <div style={hint}>Search a saved contact to auto-fill email &amp; mailing address, or type a new one.</div>
              <input style={inS} value={f.primaryContactName}
                onChange={e => { setVal('primaryContactName', e.target.value); setContactOpen(true); }}
                onFocus={() => setContactOpen(true)}
                onBlur={() => setTimeout(() => setContactOpen(false), 150)} />
              {contactOpen && contactSuggestions.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:140, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:7, marginTop:3, maxHeight:220, overflowY:'auto', boxShadow:'0 8px 22px rgba(0,0,0,0.5)' }}>
                  {contactSuggestions.map(c => (
                    <div key={c.id} onMouseDown={() => applyContact(c)} style={{ padding:'7px 10px', fontSize:13, cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontWeight:700 }}>{c.primary_contact_name}</div>
                      <div style={{ color:'var(--muted)', fontSize:11 }}>{c.name}{c.primary_contact_email ? ` · ${c.primary_contact_email}` : ''}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>,
            text('Primary Client Contact — Email Address', 'primaryContactEmail', true))}
          {text('Client/Company Mailing Address', 'mailingAddress', true)}
          {text('Contract/Invoice CC', 'invoiceCc', true, 'Auto-filled with your email — anyone else who receives a copy of the contract or invoices.')}

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
          {row(
            <CrewTagField label="Preferred Crew" value={f.preferredCrew} onChange={val => setVal('preferredCrew', val)} crew={crew} />,
            <CrewTagField label="Preferred Editor(s)" value={f.preferredEditors} onChange={val => setVal('preferredEditors', val)} crew={crew} />)}
          {area('Crew Preference Notes', 'crewNotes')}
          {row(yesNo('Pro Colorist Needed?', 'proColorist'), yesNo('Pro Audio Engineer Needed?', 'proAudio'))}

          <div style={secHead}>Delivery & Close</div>
          {row(
            <div>
              <label style={lbl}>Estimated Final Delivery{req}</label>
              <input type="date" style={inS} value={f.finalDelivery} onChange={set('finalDelivery')} />
            </div>,
            <div>
              <label style={lbl}>Estimated Close Month{req}</label>
              <select style={inS} value={f.closeMonth} onChange={set('closeMonth')}>
                <option value="">— Select MM-YYYY —</option>
                {f.closeMonth && !cmOptions.some(o => o.value === f.closeMonth) && (
                  <option value={f.closeMonth}>{f.closeMonth}</option>
                )}
                {cmOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>)}
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
