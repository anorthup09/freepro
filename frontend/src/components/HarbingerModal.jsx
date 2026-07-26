import React, { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../api.js';
import { maybeMailNotice } from '../utils/mailNotice.js';
import { useAuth } from '../App.jsx';
import { moneyConfetti } from '../lib/confetti.js';

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

const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `c${Date.now()}${Math.round(Math.random() * 1e6)}`;

// Parse a currency-ish string to a number ("$113,721.25" → 113721.25)
const num$ = s => Number(String(s || '').replace(/[^0-9.-]/g, '')) || 0;
const fmtUSD = n => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// Collapsed-by-default card that expands on click — keeps long fields tidy
function Collapsible({ title, summary, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', width: '100%' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--bg)', border: 'none', color: 'var(--text)', padding: '10px 12px', cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'left' }}>
        <span>{title}{summary && !open && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> — {summary}</span>}</span>
        <span style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  );
}

// URL entry with an Add button; accepted links show as removable tag bubbles.
// Stored as a newline-joined string so it round-trips through the form data.
function UrlTagField({ value, onChange }) {
  const [url, setUrl] = useState('');
  const links = String(value || '').split('\n').map(s => s.trim()).filter(Boolean);
  const addUrl = () => {
    const u = url.trim();
    if (!u) return;
    if (!links.some(l => l.toLowerCase() === u.toLowerCase())) onChange([...links, u].join('\n'));
    setUrl('');
  };
  const remove = u => onChange(links.filter(l => l !== u).join('\n'));
  return (
    <div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input style={{ ...inS, flex: 1 }} value={url} placeholder="Paste a URL…"
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }} />
        <button type="button" onClick={addUrl}
          style={{ background: 'rgba(90,191,128,0.14)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 6, padding: '0 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>Add</button>
      </div>
      {links.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {links.map(l => (
            <a key={l} href={l.startsWith('http') ? l : `https://${l}`} target="_blank" rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, maxWidth: '100%', background: 'rgba(90,191,128,0.12)', border: '1px solid #5ABF80', color: '#5ABF80', borderRadius: 12, padding: '3px 9px', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>{l.replace(/^https?:\/\//, '')}</span>
              <span onClick={e => { e.preventDefault(); remove(l); }} style={{ cursor: 'pointer', fontWeight: 800 }}>✕</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

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

// Step-tab icons — line-art, matching the liquid-glass docks across the app
const HB_ICONS = {
  project:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2 2 0 0 1 10 3.5h4a2 2 0 0 1 2 2V7"/></svg>,
  client:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-3.6 3.4-6.2 7.5-6.2s7.5 2.6 7.5 6.2"/></svg>,
  revenue:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 .9-3 2.2c0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2s-3-1.1-3-2.5"/></svg>,
  creative:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21.5h4"/><path d="M12 2.5a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V18h6v-.7c0-.8.4-1.6 1-2.1a7 7 0 0 0-4-12.7z"/></svg>,
  production: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="12" rx="2"/><circle cx="12" cy="13" r="3.2"/><path d="M8 7l1.4-2h5.2L16 7"/></svg>,
  dates:      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>,
};
// Wizard steps, in order — drive the top tabs + the left progress panel
const STEPS = [
  { id: 'project',    label: 'Project',                short: 'Project' },
  { id: 'client',     label: 'Client',                 short: 'Client' },
  { id: 'revenue',    label: 'Revenue / Commissions',  short: 'Revenue' },
  { id: 'creative',   label: 'Creative',               short: 'Creative' },
  { id: 'production',  label: 'Production / Crew',       short: 'Production' },
  { id: 'dates',      label: 'Key Dates',              short: 'Dates' },
];
// One descriptor per field on a step: { req, filled } → drives the dots
function stepFieldsFor(id, f, solutionsOn) {
  const b = v => !!(typeof v === 'string' ? v.trim() : v);
  switch (id) {
    case 'project': return [
      { req: true, filled: b(f.email) }, { req: true, filled: b(f.clientCompany) }, { req: true, filled: b(f.projectName) },
      { req: true, filled: b(f.budgetOwner) }, { req: true, filled: b(f.proposedCode) },
      ...(solutionsOn ? [{ req: false, filled: b(f.solutionsCode) }] : []),
      { req: false, filled: b(f.contractSigned) }, { req: true, filled: b(f.sow) }, { req: false, filled: b(f.budgetSummary) },
    ];
    case 'client': return [
      { req: true, filled: f.clientInfos.length > 0 && f.clientInfos.some(c => c.isPrimary) },
      { req: true, filled: f.clientInfos.some(c => c.invoicePoc) },
      { req: true, filled: b(f.invoiceCc) },
    ];
    case 'revenue': return [
      { req: true, filled: b(f.mediaRevenue) }, { req: false, filled: b(f.capcoRevenue) },
      ...(f.commissionable && f.mediaCommission ? [{ req: false, filled: b(f.mediaCommissionOwners) }, { req: false, filled: b(f.mediaCommissionPct) }] : []),
      ...(f.commissionable && f.solutionsCommission ? [{ req: false, filled: b(f.solutionsCommissionOwners) }, { req: false, filled: b(f.solutionsCommissionPct) }] : []),
    ];
    case 'creative': return [
      { req: false, filled: b(f.budgetLink) }, { req: false, filled: b(f.creativeNotes) }, { req: false, filled: b(f.videoReferences) },
    ];
    case 'production': return (f.noShoot ? [] : [
      { req: false, filled: b(f.budgetedPositions) }, { req: false, filled: b(f.shootingLocations) },
      { req: false, filled: b(f.gearScope) }, { req: false, filled: b(f.productionDates) },
    ]).concat([
      { req: false, filled: b(f.preferredPm) }, { req: false, filled: b(f.preferredProducer) },
      { req: false, filled: b(f.preferredCrew) }, { req: false, filled: b(f.preferredEditors) },
      { req: false, filled: b(f.crewNotes) }, { req: false, filled: b(f.proColorist) }, { req: false, filled: b(f.proAudio) },
    ]);
    case 'dates': return [
      { req: false, filled: b(f.kickoffDate) }, { req: true, filled: b(f.finalDelivery) }, { req: true, filled: b(f.closeMonth) },
    ];
    default: return [];
  }
}
// Dot color: filled → orange, required-but-skipped → red, otherwise gray
const dotColor = (fld, attempted) => fld.filled ? '#e8500a' : (fld.req && attempted ? '#e05252' : '#4a453e');

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
export default function HarbingerModal({ pid, initial, onClose, onSubmitted, solutionsOn = false }) {
  const [f, setF] = useState({
    email: '', clientCompany: '', projectName: '', proposedCode: '', solutionsCode: '',
    sow: '', budgetSummary: '', clientContacts: '', contractSigned: false, clientInfos: [], noShoot: false,
    primaryContactName: '', primaryContactEmail: '', mailingAddress: '', invoiceCc: '',
    mediaRevenue: '', capcoRevenue: '', mediaCommissionOwners: '', budgetOwner: '',
    mediaCommissionPct: '', solutionsCommissionOwners: '', noCommissions: false, solutionsCommissionPct: '',
    commissionable: false, mediaCommission: false, solutionsCommission: false,
    budgetLink: '', creativeNotes: '', videoReferences: '', kickoffDate: '',
    preferredPm: '', preferredProducer: '', budgetedPositions: '', shootingLocations: '',
    gearScope: '', productionDates: '', preferredCrew: '', crewNotes: '',
    preferredEditors: '', proColorist: '', proAudio: '', finalDelivery: '', closeMonth: '', notes: '',
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);   // AI brief review before submit
  const [contactModal, setContactModal] = useState(null); // client contact add/edit popout
  const set = k => e => setF(v => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setVal = (k, val) => setF(v => ({ ...v, [k]: val }));

  const { user } = useAuth();
  const [crew, setCrew] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [sowLoading, setSowLoading] = useState(false);
  const cmOptions = useMemo(closeMonthOptions, []);
  // Unbridled Media employees for the Budget Owner dropdown
  const umCrew = useMemo(() => crew.filter(m => (m.company || '').toLowerCase().includes('unbridled') && (m.name || '').trim())
    .sort((a, b) => a.name.localeCompare(b.name)), [crew]);

  // Budget Owner defaults to whoever is submitting the Harbinger
  useEffect(() => {
    if (user?.name) setF(v => v.budgetOwner ? v : { ...v, budgetOwner: user.name });
  }, [user]);

  // Prefill-driven defaults: open commission toggles, seed a Primary contact,
  // and auto-select "No Shoot" when the budget has no production items.
  useEffect(() => {
    const hasMedia = !!(initial?.mediaCommissionOwners || initial?.mediaCommissionPct);
    const hasSol = !!(initial?.solutionsCommissionOwners || initial?.solutionsCommissionPct);
    if (hasMedia || hasSol) setF(v => ({ ...v, commissionable: true, mediaCommission: v.mediaCommission || hasMedia, solutionsCommission: v.solutionsCommission || hasSol }));
    if (initial?.primaryContactName || initial?.primaryContactEmail) {
      setF(v => v.clientInfos.length ? v : ({ ...v, clientInfos: [{ id: uid(), name: initial.primaryContactName || '', position: '', involvement: '', email: initial.primaryContactEmail || '', mailingAddress: initial.mailingAddress || '', isPrimary: true, invoicePoc: true }] }));
    }
    // No production positions/dates in the prefill → treat as a no-shoot project
    if (initial && !((initial.budgetedPositions || '').trim() || (initial.productionDates || '').trim())) {
      setF(v => ({ ...v, noShoot: true }));
    }
  }, []);

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

  // Seed a Primary contact tile from a saved client's info (only when empty)
  const seedFromClient = c => setF(v => {
    if (v.clientInfos.length) return v;
    if (!(c.primary_contact_name || c.primary_contact_email)) return v;
    return { ...v, clientInfos: [{ id: uid(), name: c.primary_contact_name || '', position: '', involvement: '', email: c.primary_contact_email || '', mailingAddress: c.mailing_address || '', isPrimary: true, invoicePoc: true }] };
  });

  // When the typed company exactly matches a saved client, seed the primary contact
  useEffect(() => { if (clientMatch) seedFromClient(clientMatch); }, [clientMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyClient(c) {
    setF(v => ({ ...v, clientCompany: c.name || v.clientCompany }));
    seedFromClient(c);
    setClientOpen(false);
  }

  // Keep flat contract fields in sync with the contact tiles (source of truth)
  useEffect(() => {
    const primary = f.clientInfos.find(c => c.isPrimary) || f.clientInfos[0] || null;
    const lines = f.clientInfos.map(c => {
      let head = c.name + (c.position ? ` — ${c.position}` : '');
      if (c.isPrimary) head += ' (Primary)';
      if (c.invoicePoc) head += ' (Invoice POC)';
      const bits = [head];
      if (c.involvement) bits.push(`Involvement: ${c.involvement}`);
      if (c.email) bits.push(c.email);
      if (c.mailingAddress) bits.push(c.mailingAddress);
      return bits.join('\n');
    });
    setF(v => ({ ...v, primaryContactName: primary?.name || '', primaryContactEmail: primary?.email || '', mailingAddress: primary?.mailingAddress || '', clientContacts: lines.join('\n\n') }));
  }, [f.clientInfos]);

  // Contact tile CRUD
  function saveContact() {
    const m = contactModal;
    if (!m || !m.name.trim() || !m.email.trim()) { alert('Client Name and Email are required.'); return; }
    setF(v => {
      let list = [...v.clientInfos];
      if (m.editId) list = list.map(c => c.id === m.editId ? { ...c, name: m.name.trim(), position: m.position.trim(), involvement: m.involvement.trim(), email: m.email.trim(), mailingAddress: m.mailingAddress.trim(), invoicePoc: !!m.invoicePoc } : c);
      else list.push({ id: uid(), name: m.name.trim(), position: m.position.trim(), involvement: m.involvement.trim(), email: m.email.trim(), mailingAddress: m.mailingAddress.trim(), isPrimary: list.length === 0, invoicePoc: !!m.invoicePoc });
      if (m.invoicePoc) { const keep = m.editId || list[list.length - 1].id; list = list.map(c => c.id === keep ? c : { ...c, invoicePoc: false }); }
      return { ...v, clientInfos: list };
    });
    setContactModal(null);
  }
  function removeContact(id) {
    setF(v => {
      let list = v.clientInfos.filter(c => c.id !== id);
      if (list.length && !list.some(c => c.isPrimary)) list = list.map((c, i) => i === 0 ? { ...c, isPrimary: true } : c);
      return { ...v, clientInfos: list };
    });
  }
  const setPrimary = id => setF(v => ({ ...v, clientInfos: v.clientInfos.map(c => ({ ...c, isPrimary: c.id === id })) }));
  const setInvoicePoc = id => setF(v => ({ ...v, clientInfos: v.clientInfos.map(c => ({ ...c, invoicePoc: c.id === id })) }));

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

  const hasPrimary = f.clientInfos.some(c => c.isPrimary);
  const hasInvoicePoc = f.clientInfos.some(c => c.invoicePoc);
  const videoRefCount = String(f.videoReferences || '').split('\n').filter(s => s.trim()).length;

  // Wizard navigation
  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState(() => new Set());
  const isReview = step >= STEPS.length;
  const stepFields = id => stepFieldsFor(id, f, solutionsOn);
  const markAttempted = i => setAttempted(s => new Set(s).add(i));
  const goTab = i => { markAttempted(step); setStep(i); };
  const goNext = () => { markAttempted(step); setStep(s => Math.min(s + 1, STEPS.length - 1)); };
  const firstIncomplete = () => STEPS.findIndex(s => stepFields(s.id).some(fl => fl.req && !fl.filled));
  const goReview = () => {
    setAttempted(new Set(STEPS.map((_, i) => i)));
    const inc = firstIncomplete();
    setStep(inc >= 0 ? inc : STEPS.length);
  };
  const arrowBtn = { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#5ABF80', color: '#0b0b0b', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 800, cursor: 'pointer' };
  const ok = f.email && f.clientCompany && f.projectName && f.proposedCode && f.sow
    && f.clientInfos.length > 0 && hasPrimary && hasInvoicePoc && f.invoiceCc
    && f.mediaRevenue && f.budgetOwner && f.finalDelivery && f.closeMonth;

  async function submit() {
    if (!ok || saving) return;
    setSaving(true);
    try {
      await api.submitHarbinger(pid, f);
      moneyConfetti(8000);   // celebrate: 8s of gold confetti + dollar signs
      maybeMailNotice('The Harbinger kickoff report email to accounting');
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

  const budgetOwnerField = (
    <div key="budgetOwner">
      <label style={lbl}>Budget Owner (Primary Contact at Unbridled Media){req}</label>
      <select style={inS} value={f.budgetOwner} onChange={set('budgetOwner')}>
        {!f.budgetOwner && <option value="">Select…</option>}
        {f.budgetOwner && !umCrew.some(m => m.name === f.budgetOwner) && <option value={f.budgetOwner}>{f.budgetOwner}</option>}
        {umCrew.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
      </select>
    </div>
  );

  // Commission-type chip (Media / Solutions) shown once the project is marked commissionable
  const commChip = (label, k) => (
    <button type="button" key={k} onClick={() => setF(v => ({ ...v, [k]: !v[k] }))}
      style={{ background: f[k] ? 'rgba(90,191,128,0.16)' : 'var(--bg)', border: `1px solid ${f[k] ? '#5ABF80' : 'var(--border)'}`,
        color: f[k] ? '#5ABF80' : 'var(--muted)', borderRadius:20, padding:'6px 15px', fontSize:12, fontWeight:800, cursor:'pointer', transition:'all .15s ease' }}>
      {f[k] ? '✓ ' : ''}{label}
    </button>
  );

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:130, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'30px 14px', overflowY:'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #5ABF80', borderRadius:12, padding:'22px 26px', width:'100%', maxWidth:820 }}>
        <style>{`@keyframes hbPulse{0%,100%{box-shadow:0 0 0 0 rgba(90,191,128,0.55)}50%{box-shadow:0 0 0 12px rgba(90,191,128,0)}}.hb-pulse{animation:hbPulse 1.8s ease-in-out infinite}`}</style>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:800 }}>Harbinger — Project Initiation</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
              {isReview ? <>Review everything below, then <b style={{ color:'#5ABF80' }}>go live</b>.</> : <>Kicks off the project internally and notifies accounting to open the project code.</>}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        {/* Top progress tabs — liquid-glass dock, matching the app's bottom navs */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:2, padding:'7px 10px', maxWidth:'100%', overflowX:'auto',
            background:'rgba(24,22,19,0.81)', backdropFilter:'blur(18px) saturate(1.5)', WebkitBackdropFilter:'blur(18px) saturate(1.5)',
            border:'1px solid rgba(255,255,255,0.12)', borderRadius:30, boxShadow:'0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            {STEPS.map((s, i) => {
              const done = !stepFields(s.id).some(fl => fl.req && !fl.filled);
              const cur = i === step && !isReview;
              const color = cur ? 'var(--orange)' : (done ? '#5ABF80' : 'rgba(255,255,255,0.5)');
              return (
                <button key={s.id} type="button" onClick={() => goTab(i)} aria-label={s.label} title={s.label}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, position:'relative', flexShrink:0,
                    background: cur ? 'rgba(255,255,255,0.08)' : 'transparent', border:'none', cursor:'pointer',
                    color, borderRadius:20, padding:'6px 13px 5px', transition:'color .2s ease, background .2s ease' }}>
                  <span style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:30, height:30, borderRadius:'50%',
                    background: cur ? 'rgba(232,80,10,0.16)' : (done ? 'rgba(90,191,128,0.14)' : 'transparent'), transition:'background .2s ease' }}>
                    {HB_ICONS[s.id]}
                  </span>
                  <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.02em', whiteSpace:'nowrap' }}>{s.short}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display:'flex', gap:20, marginTop:14, alignItems:'flex-start' }}>
          {/* Left progress panel — dots for the current step (condensed on review) */}
          <div style={{ flex:`0 0 ${isReview ? 128 : 182}px`, transition:'flex-basis .2s ease' }}>
            {STEPS.map((s, i) => {
              const active = i === step && !isReview;
              return (
                <div key={s.id} style={{ marginBottom: active ? 12 : 9 }}>
                  <button type="button" onClick={() => goTab(i)}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:0, textAlign:'left', fontSize:12,
                      color: i === step && !isReview ? 'var(--text)' : 'var(--muted)', fontWeight: i === step && !isReview ? 800 : 600 }}>
                    {s.label}
                  </button>
                  {active && (
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:7 }}>
                      {stepFields(s.id).map((fld, di) => (
                        <span key={di} style={{ width:9, height:9, borderRadius:'50%', background: dotColor(fld, attempted.has(i)), transition:'background .2s ease' }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Step content */}
          <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:12 }}>
          {step === 0 && (<>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:16, flexWrap:'wrap' }}>
            <button type="button" onClick={() => setF(v => ({ ...v, contractSigned: !v.contractSigned }))}
              style={{ display:'flex', alignItems:'center', gap:8,
                background: f.contractSigned ? 'rgba(90,191,128,0.16)' : 'var(--bg)',
                border: `1px solid ${f.contractSigned ? '#5ABF80' : 'var(--border)'}`,
                color: f.contractSigned ? '#5ABF80' : 'var(--text)',
                borderRadius:8, padding:'7px 13px', fontSize:12, fontWeight:800, cursor:'pointer', transition:'all .15s ease' }}>
              <span style={{ width:15, height:15, borderRadius:4, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900,
                border:`1px solid ${f.contractSigned ? '#5ABF80' : 'var(--muted)'}`, background: f.contractSigned ? '#5ABF80' : 'transparent', color:'#0d0c0a' }}>{f.contractSigned ? '✓' : ''}</span>
              Contract / MSA Signed
            </button>
          </div>
          {row(text('Your Email Address', 'email', true, 'Shows on the contract sent to the client.'),
            <div style={{ position:'relative' }}>
              <label style={lbl}>Client Company Name{req}</label>
              <div style={hint}>Search client roster or add new</div>
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
              {clientMatch && <div style={{ ...hint, color:'#5ABF80' }}>Saved client — primary contact added below.</div>}
            </div>)}
          {row(text('Name of Project', 'projectName', true),
               budgetOwnerField)}
          {row(text('Proposed Code', 'proposedCode', true),
               solutionsOn ? text('Existing Solutions / Client Code (If Applicable)', 'solutionsCode') : <div />)}
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <label style={{ ...lbl, marginBottom:0 }}>SOW & Project Description{req}</label>
              <button type="button" onClick={generateSow} disabled={sowLoading}
                style={{ background:'rgba(90,191,128,0.14)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:8, padding:'4px 10px', fontSize:11, fontWeight:800, cursor: sowLoading ? 'default' : 'pointer', opacity: sowLoading ? 0.6 : 1 }}>
                {sowLoading ? 'Generating…' : '✨ Budget Brief'}
              </button>
            </div>
            <div style={hint}>Auto-drafted from the budget allocations. Edit freely or regenerate.</div>
            <textarea style={{ ...areaS, minHeight:120, opacity: sowLoading ? 0.6 : 1 }} value={f.sow} onChange={set('sow')} />
          </div>
          {area('Budget Summary / Breakdown', 'budgetSummary', false, 'Optional — only if the client needs a budget breakdown on the contract. The total project estimate appears on the contract regardless.')}

          </>)}
          {step === 1 && (<>
          <div style={hint}>Add each client contact. At least one Primary contact is required, and one contact must be marked the Invoice POC.</div>
          {f.clientInfos.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {f.clientInfos.map(c => (
                <div key={c.id} style={{ flex:'1 1 260px', minWidth:230, background:'var(--bg)', border:`1px solid ${c.invoicePoc ? '#5ABF80' : 'var(--border)'}`, borderRadius:9, padding:'11px 13px', position:'relative' }}>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:5 }}>
                    {c.isPrimary && <span style={{ fontSize:8.5, fontWeight:900, letterSpacing:'0.08em', color:'#a78bfa', border:'1px solid #a78bfa55', borderRadius:9, padding:'1px 7px' }}>PRIMARY</span>}
                    {c.invoicePoc && <span style={{ fontSize:8.5, fontWeight:900, letterSpacing:'0.08em', color:'#5ABF80', border:'1px solid #5ABF8055', borderRadius:9, padding:'1px 7px' }}>INVOICE POC</span>}
                  </div>
                  <div style={{ fontSize:13, fontWeight:800 }}>{c.name}{c.position ? <span style={{ color:'var(--muted)', fontWeight:600, fontSize:11 }}> · {c.position}</span> : null}</div>
                  {c.involvement && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{c.involvement}</div>}
                  <div style={{ fontSize:11.5, color:'var(--tan)', marginTop:3 }}>{c.email}</div>
                  {c.mailingAddress && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, whiteSpace:'pre-wrap' }}>{c.mailingAddress}</div>}
                  <div style={{ display:'flex', gap:8, marginTop:9, flexWrap:'wrap', alignItems:'center' }}>
                    {!c.isPrimary && <button type="button" onClick={() => setPrimary(c.id)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:12, padding:'2px 9px', fontSize:10, fontWeight:700, cursor:'pointer' }}>Make Primary</button>}
                    {!c.invoicePoc && <button type="button" onClick={() => setInvoicePoc(c.id)} style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:12, padding:'2px 9px', fontSize:10, fontWeight:700, cursor:'pointer' }}>Set Invoice POC</button>}
                    <button type="button" onClick={() => setContactModal({ editId:c.id, name:c.name, position:c.position, involvement:c.involvement, email:c.email, mailingAddress:c.mailingAddress, invoicePoc:c.invoicePoc })} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:11, fontWeight:700, cursor:'pointer', padding:2 }}>Edit</button>
                    <button type="button" onClick={() => removeContact(c.id)} style={{ background:'none', border:'none', color:'#e05252', fontSize:11, fontWeight:700, cursor:'pointer', padding:2, marginLeft:'auto' }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {f.clientInfos.length > 0 && !hasInvoicePoc && (
            <div style={{ ...hint, color:'#e6c229' }}>Mark one contact as the Invoice POC to continue.</div>
          )}
          <button type="button" onClick={() => setContactModal({ editId:null, name:'', position:'', involvement:'', email:'', mailingAddress:'', invoicePoc: f.clientInfos.length === 0 })}
            style={{ alignSelf:'flex-start', background:'rgba(90,191,128,0.14)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:8, padding:'9px 15px', fontSize:12.5, fontWeight:800, cursor:'pointer' }}>
            + Add Client Info
          </button>
          {text('Contract/Invoice CC', 'invoiceCc', true, 'Auto-filled with your email — anyone else who receives a copy of the contract or invoices.')}

          </>)}
          {step === 2 && (<>
          {row(text('Media Budget (Total less CapCo Revenue)', 'mediaRevenue', true),
               text('CapCo Revenue Amount (If Applicable)', 'capcoRevenue'),
            <div>
              <label style={lbl}>Total Budget</label>
              <div style={{ ...inS, display:'flex', alignItems:'center', color:'var(--muted)', background:'rgba(255,255,255,0.03)' }}>{fmtUSD(num$(f.mediaRevenue) + num$(f.capcoRevenue))}</div>
            </div>)}

          {/* Commissionable toggle — black by default, green with a check when on */}
          <button type="button"
            onClick={() => setF(v => ({ ...v, commissionable: !v.commissionable, noCommissions: v.commissionable }))}
            style={{ display:'flex', alignItems:'center', gap:9, alignSelf:'flex-start',
              background: f.commissionable ? 'rgba(90,191,128,0.16)' : 'var(--bg)',
              border: `1px solid ${f.commissionable ? '#5ABF80' : 'var(--border)'}`,
              color: f.commissionable ? '#5ABF80' : 'var(--text)',
              borderRadius:8, padding:'9px 15px', fontSize:13, fontWeight:800, cursor:'pointer', transition:'all .15s ease' }}>
            <span style={{ width:16, height:16, borderRadius:4, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:11, fontWeight:900, border:`1px solid ${f.commissionable ? '#5ABF80' : 'var(--muted)'}`,
              background: f.commissionable ? '#5ABF80' : 'transparent', color:'#0d0c0a' }}>{f.commissionable ? '✓' : ''}</span>
            Commissionable Project
          </button>

          {f.commissionable && (
            <div style={{ display:'flex', flexDirection:'column', gap:12, borderLeft:'2px solid rgba(90,191,128,0.35)', paddingLeft:14, marginLeft:2 }}>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                {commChip('Media Commission', 'mediaCommission')}
                {solutionsOn && commChip('Solutions Commission', 'solutionsCommission')}
              </div>
              {f.mediaCommission && row(
                text('Media Commission Owner(s)', 'mediaCommissionOwners'),
                text('Media Commission %', 'mediaCommissionPct'))}
              {solutionsOn && f.solutionsCommission && row(
                text('Solutions Commission Owner(s)', 'solutionsCommissionOwners'),
                text('% for Solutions Commission(s)', 'solutionsCommissionPct'))}
            </div>
          )}

          </>)}
          {step === 3 && (<>
          {text('Link to Budget', 'budgetLink')}
          {row(
            <Collapsible title="Creative Direction Notes" summary={f.creativeNotes.trim() ? 'notes added' : 'add notes'}>
              <textarea style={{ ...areaS, minHeight:120 }} value={f.creativeNotes} onChange={set('creativeNotes')} />
            </Collapsible>,
            <Collapsible title="Video Reference Links" summary={videoRefCount ? `${videoRefCount} link${videoRefCount !== 1 ? 's' : ''}` : 'add links'}>
              <div style={hint}>Links shared with the client or that exemplify target creative.</div>
              <UrlTagField value={f.videoReferences} onChange={val => setVal('videoReferences', val)} />
            </Collapsible>)}

          </>)}
          {step === 4 && (<>
          {/* No Shoot toggle — dark by default, red when on; grays the shoot logistics */}
          <button type="button" onClick={() => setF(v => ({ ...v, noShoot: !v.noShoot }))}
            style={{ alignSelf:'flex-start', display:'flex', alignItems:'center', gap:8,
              background: f.noShoot ? 'rgba(224,82,82,0.16)' : 'var(--bg)',
              border: `1px solid ${f.noShoot ? '#e05252' : 'var(--border)'}`,
              color: f.noShoot ? '#e05252' : 'var(--text)',
              borderRadius:8, padding:'8px 14px', fontSize:12.5, fontWeight:800, cursor:'pointer', transition:'all .15s ease' }}>
            <span style={{ width:15, height:15, borderRadius:4, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900,
              border:`1px solid ${f.noShoot ? '#e05252' : 'var(--muted)'}`, background: f.noShoot ? '#e05252' : 'transparent', color:'#0d0c0a' }}>{f.noShoot ? '✓' : ''}</span>
            No Shoot (If Applicable)
          </button>
          <div style={{ display:'flex', flexDirection:'column', gap:12, opacity: f.noShoot ? 0.4 : 1, pointerEvents: f.noShoot ? 'none' : 'auto', transition:'opacity .15s ease' }}>
            {area('All Budgeted Positions', 'budgetedPositions')}
            {row(text('Shooting Location(s)', 'shootingLocations'),
                 area('Gear Scope/Summary', 'gearScope'))}
            {area('Production and Travel Dates (all key shooting dates and anticipated crew travel dates)', 'productionDates')}
          </div>
          {row(
            <CrewTagField label="Preferred PM(s)" value={f.preferredPm} onChange={val => setVal('preferredPm', val)} crew={crew} />,
            <CrewTagField label="Preferred Producer(s)/Director(s)" value={f.preferredProducer} onChange={val => setVal('preferredProducer', val)} crew={crew} />)}
          {row(
            <CrewTagField label="Preferred Crew" value={f.preferredCrew} onChange={val => setVal('preferredCrew', val)} crew={crew} />,
            <CrewTagField label="Preferred Editor(s)" value={f.preferredEditors} onChange={val => setVal('preferredEditors', val)} crew={crew} />)}
          {area('Crew Preference Notes', 'crewNotes')}
          {row(yesNo('Pro Colorist Needed?', 'proColorist'), yesNo('Pro Audio Engineer Needed?', 'proAudio'))}

          </>)}
          {step === 5 && (<>
          {row(
            <div>
              <label style={lbl}>Client Kickoff Call Date?</label>
              <input type="date" style={inS} value={f.kickoffDate} onChange={set('kickoffDate')} />
            </div>,
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
          </>)}

          {isReview && (
            <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
              <div style={{ fontSize:13, fontWeight:800, marginBottom:2 }}>Review the Harbinger before it goes out</div>
              {FIELD_LABELS.map(([k, label]) => {
                if (k === 'sow') return (
                  <div key={k}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                      <div style={{ fontSize:10, color:'#5ABF80', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:800 }}>{label} — editable</div>
                      <button type="button" onClick={generateSow} disabled={sowLoading} style={{ background:'none', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:8, padding:'2px 9px', fontSize:10, fontWeight:800, cursor: sowLoading ? 'default' : 'pointer', opacity: sowLoading ? 0.6 : 1 }}>{sowLoading ? 'Generating…' : '✨ Regenerate'}</button>
                    </div>
                    <textarea value={f.sow} onChange={set('sow')} style={{ ...areaS, minHeight:130, fontSize:12.5, lineHeight:1.55 }} />
                  </div>
                );
                const v = f[k];
                if (v === undefined || v === null || v === '' || v === false) return null;
                return (
                  <div key={k}>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:13, whiteSpace:'pre-wrap' }}>{v === true ? 'Yes' : String(v)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Wizard footer */}
          {!isReview ? (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginTop:8 }}>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              {step < STEPS.length - 1
                ? <button type="button" onClick={goNext} style={arrowBtn}>Next: {STEPS[step + 1].label} <span style={{ fontSize:15, lineHeight:1 }}>→</span></button>
                : <button type="button" onClick={goReview} style={arrowBtn}>Review Harbinger <span style={{ fontSize:15, lineHeight:1 }}>→</span></button>}
            </div>
          ) : (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginTop:10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep(STEPS.length - 1)}>‹ Back to edit</button>
              <button type="button" className="hb-pulse" disabled={!ok || saving} onClick={submit}
                style={{ background:'#5ABF80', color:'#0b0b0b', border:'none', borderRadius:10, padding:'13px 28px', fontSize:14, fontWeight:900, cursor: ok ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Submitting…' : 'Submit Harbinger & Go Live'}
              </button>
            </div>
          )}
          </div>
        </div>

        {/* Add / edit a client contact */}
        {contactModal && (
          <div onClick={e => e.target === e.currentTarget && setContactModal(null)}
            style={{ position:'fixed', inset:0, zIndex:160, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 14px', overflowY:'auto' }}>
            <div style={{ width:'100%', maxWidth:460, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #5ABF80', borderRadius:12, padding:'20px 22px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ fontSize:15, fontWeight:800 }}>{contactModal.editId ? 'Edit' : 'Add'} Client Contact</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setContactModal(null)}>✕</button>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                <div><label style={lbl}>Client Name{req}</label><input style={inS} value={contactModal.name} onChange={e => setContactModal(m => ({ ...m, name: e.target.value }))} /></div>
                <div style={{ display:'flex', gap:12 }}>
                  <div style={{ flex:1 }}><label style={lbl}>Position <span style={{ color:'var(--muted)', fontWeight:400 }}>(Optional)</span></label><input style={inS} value={contactModal.position} onChange={e => setContactModal(m => ({ ...m, position: e.target.value }))} /></div>
                  <div style={{ flex:1 }}><label style={lbl}>Involvement <span style={{ color:'var(--muted)', fontWeight:400 }}>(Optional)</span></label><input style={inS} value={contactModal.involvement} onChange={e => setContactModal(m => ({ ...m, involvement: e.target.value }))} /></div>
                </div>
                <div><label style={lbl}>Email{req}</label><input style={inS} value={contactModal.email} onChange={e => setContactModal(m => ({ ...m, email: e.target.value }))} /></div>
                <div><label style={lbl}>Mailing Address</label><input style={inS} value={contactModal.mailingAddress} onChange={e => setContactModal(m => ({ ...m, mailingAddress: e.target.value }))} /></div>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" checked={!!contactModal.invoicePoc} onChange={e => setContactModal(m => ({ ...m, invoicePoc: e.target.checked }))} style={{ width:'auto', margin:0 }} />
                  <span>Invoice POC <span style={{ color:'var(--muted)', fontSize:11 }}>— receives invoices for this project</span></span>
                </label>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setContactModal(null)}>Cancel</button>
                <button onClick={saveContact} style={{ background:'#5ABF80', color:'#0b0b0b', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:800, cursor:'pointer' }}>
                  {contactModal.editId ? 'Save' : 'Add Contact'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full-Harbinger review before it goes out; the AI brief stays editable here */}
        {reviewOpen && (
          <div onClick={e => e.target === e.currentTarget && setReviewOpen(false)}
            style={{ position:'fixed', inset:0, zIndex:150, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
            <div style={{ width:'100%', maxWidth:640, maxHeight:'90vh', display:'flex', flexDirection:'column', background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #5ABF80', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'16px 22px 10px', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:15, fontWeight:800 }}>Review the Harbinger before it goes out</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setReviewOpen(false)}>✕</button>
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, marginTop:2 }}>
                  Everything below is exactly what submits. The AI-drafted project brief is editable right here.
                </div>
              </div>
              <div style={{ overflowY:'auto', padding:'14px 22px' }}>
                {FIELD_LABELS.map(([k, label]) => {
                  const v = f[k];
                  if (k === 'sow') return (
                    <div key={k} style={{ marginBottom:14 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                        <div style={{ fontSize:10, color:'#5ABF80', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:800 }}>{label} — AI-drafted, editable</div>
                        <button type="button" onClick={generateSow} disabled={sowLoading}
                          style={{ background:'none', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:8, padding:'2px 9px', fontSize:10, fontWeight:800, cursor: sowLoading ? 'default' : 'pointer', opacity: sowLoading ? 0.6 : 1 }}>
                          {sowLoading ? 'Generating…' : '✨ Regenerate'}
                        </button>
                      </div>
                      <textarea value={f.sow} onChange={set('sow')}
                        style={{ ...areaS, minHeight:140, fontSize:12.5, lineHeight:1.55, opacity: sowLoading ? 0.6 : 1 }} />
                    </div>
                  );
                  if (v === undefined || v === null || v === '' || v === false) return null;
                  return (
                    <div key={k} style={{ marginBottom:11 }}>
                      <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
                      <div style={{ fontSize:13, whiteSpace:'pre-wrap' }}>{v === true ? 'Yes' : String(v)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, padding:'12px 22px', borderTop:'1px solid var(--border)' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setReviewOpen(false)}>Back to form</button>
                <button disabled={!ok || saving || !f.sow.trim()} onClick={submit}
                  style={{ background:'#5ABF80', color:'#0b0b0b', border:'none', borderRadius:8, padding:'8px 18px', fontSize:13, fontWeight:800, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
                  {saving ? 'Submitting…' : 'Looks good — Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
