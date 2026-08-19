import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import { displayName } from '../utils/displayName.js';
import HomeButton from '../components/HomeButton.jsx';
import ClientSelect from '../components/ClientSelect.jsx';

const ACCENT = '#4a9eff';
const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US');

// Annual subscription tiers. `price` is the client-facing figure (after any
// volume discount); list/disc are shown so the math is transparent. The media
// size dropdown is 1:1 with this list and auto-selects the matching tier.
const SUB_TIERS = [
  { label: '< 1 TB',      price: 200 },
  { label: 'up to 2 TB',  price: 400 },
  { label: 'up to 3 TB',  price: 600 },
  { label: 'up to 4 TB',  price: 800 },
  { label: 'up to 5 TB',  price: 950,  list: 1000, disc: '5%' },
  { label: 'up to 6 TB',  price: 1140, list: 1200, disc: '5%' },
  { label: 'up to 7 TB',  price: 1260, list: 1400, disc: '10%' },
  { label: 'up to 8 TB',  price: 1440, list: 1600, disc: '10%' },
  { label: 'up to 9 TB',  price: 1530, list: 1800, disc: '15%' },
  { label: 'up to 10 TB', price: 1700, list: 2000, disc: '15%' },
];
const subOptionText = t => t.disc
  ? `${t.label} — ${fmt$(t.price)} (${fmt$(t.list)} less ${t.disc})`
  : `${t.label} — ${fmt$(t.price)}`;

const HD_TIERS = [
  { label: 'Up to 2 TB',  price: 550 },
  { label: 'Up to 5 TB',  price: 650 },
  { label: 'Up to 10 TB', price: 1100 },
];
const hdOptionText = t => `${t.label} — ${fmt$(t.price)}`;

// Media size (subscription-tier index) → hard-drive tier index.
// <1–2 TB → 2 TB drive · 3–5 TB → 5 TB drive · 6–10 TB → 10 TB drive.
const HD_FOR_SIZE = i => (i <= 1 ? 0 : i <= 4 ? 1 : 2);

// ── Liquid-glass field styling ──
const lbl = { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 };
const noteS = { fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2, marginBottom: 4, fontWeight: 400, textTransform: 'none', letterSpacing: 0 };
const inp = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9,
  color: 'var(--text)', padding: '9px 11px', fontSize: 13, width: '100%',
  backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
};
const inpSm = { ...inp, fontSize: 11, padding: '6px 8px', borderRadius: 8 };

function Field({ label, note, children, required, full }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, ...(full ? { gridColumn: '1 / -1' } : {}) }}>
      <span style={lbl}>{label}{required && <span style={{ color: ACCENT }}> *</span>}</span>
      {note && <span style={noteS}>{note}</span>}
      {children}
    </label>
  );
}

// Searchable project-code combobox: pick an existing project (fills code + name)
// or type a new code.
function ProjectCodeSelect({ code, onPick }) {
  const [projects, setProjects] = useState([]);
  const [q, setQ] = useState(code || '');
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => { api.financeProjects(true).then(setProjects).catch(() => setProjects([])); }, []);
  useEffect(() => { setQ(code || ''); }, [code]);
  useEffect(() => {
    const close = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const s = q.trim().toLowerCase();
  const matches = projects.filter(p =>
    (p.code || '').toLowerCase().includes(s) || (p.title || '').toLowerCase().includes(s)).slice(0, 40);
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <input value={q} placeholder="Search a project code, or type a new one…"
        onChange={e => { setQ(e.target.value); setOpen(true); onPick(e.target.value, undefined); }}
        onFocus={() => setOpen(true)} style={inp} />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, marginTop: 4, borderRadius: 10, maxHeight: 240, overflowY: 'auto', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 12px 34px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)' }}>
          {matches.map(p => (
            <div key={p.id} onClick={() => { onPick(p.code, p.title, p.client); setQ(p.code); setOpen(false); }}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <b>{p.code}</b> <span style={{ color: 'var(--muted)' }}>— {p.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Searchable POC combobox backed by the ongoing name/email database. Picking a
// name fills the email; typing a new name is allowed (and saved on submit).
function ContactSelect({ name, people, onPick }) {
  const [q, setQ] = useState(name || '');
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => { setQ(name || ''); }, [name]);
  useEffect(() => {
    const close = e => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const s = q.trim().toLowerCase();
  const matches = (people || []).filter(p => (p.name || '').toLowerCase().includes(s) && p.name).slice(0, 40);
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <input value={q} placeholder="Search a contact, or type a new name…"
        onChange={e => { setQ(e.target.value); setOpen(true); onPick(e.target.value, undefined); }}
        onFocus={() => setOpen(true)} style={inp} />
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, marginTop: 4, borderRadius: 10, maxHeight: 240, overflowY: 'auto', background: 'var(--bg2)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 12px 34px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px) saturate(1.4)', WebkitBackdropFilter: 'blur(20px) saturate(1.4)' }}>
          {matches.map((p, i) => (
            <div key={(p.email || '') + i} onClick={() => { onPick(p.name, p.email || ''); setQ(p.name); setOpen(false); }}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <b>{p.name}</b>{p.email && <span style={{ color: 'var(--muted)' }}> — {p.email}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const BLANK = {
  clientName: '', projectCode: '', projectName: '', pocName: '', pocEmail: '',
  footage: '', referenceLinks: '', sizeIdx: '', subIdx: '', hdIdx: '',
};

// ── Media Management Pipeline ──
const PIPE_VIEWS = [
  ['email', 'Email Requests'],
  ['subscription', 'Current Live Subscription'],
  ['expired', 'Expired / Delete'],
  ['drives', 'Hard Drive Shipping Request'],
];
const EMAIL_GROUPS = ['New Request', 'In-Progress', 'Live', 'Expired'];
const GROUP_COLOR = { 'New Request': '#4a9eff', 'In-Progress': '#e6c229', 'Live': '#5ABF80', 'Expired': '#e05252' };
const bucketOf = r => (EMAIL_GROUPS.includes(r.status) ? r.status : 'New Request');
const hasShipping = r => !!(r.shipping_name || r.shipping_email || r.shipping_address || r.shipping_tracking);

// Pill styling: dark when off, filled (accent) when on.
const pill = color => ({
  fontSize: 10, fontWeight: 800, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  color: color ? '#06121f' : 'var(--muted)',
  background: color || 'rgba(255,255,255,0.05)',
  border: '1px solid ' + (color || 'rgba(255,255,255,0.14)'),
  backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
});

function RequestTile({ r, patchReq, onDetail, onShip }) {
  const [resp, setResp] = useState(r.client_response || '');
  useEffect(() => { setResp(r.client_response || ''); }, [r.client_response]);
  const stop = e => e.stopPropagation();
  const shipped = hasShipping(r);
  return (
    <div className="glass" style={{ borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div onClick={() => onDetail(r)} style={{ cursor: 'pointer', minWidth: 0 }} title="Open full request">
          <div style={{ fontSize: 13, fontWeight: 800 }}>{r.client_name}</div>
          {(r.project_code || r.project_name) &&
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.project_code}{r.project_name ? ` — ${r.project_name}` : ''}</div>}
        </div>
        <select value={bucketOf(r)} onClick={stop} onChange={e => patchReq(r.id, { status: e.target.value })}
          style={{ ...inpSm, width: 'auto', fontWeight: 800, color: GROUP_COLOR[bucketOf(r)] }}>
          {EMAIL_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <label onClick={stop} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={!!r.email_sent} onChange={e => patchReq(r.id, { emailSent: e.target.checked })} />
          Email Sent
          {r.email_sent && r.email_sent_date && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· {new Date(r.email_sent_date).toLocaleDateString()}</span>}
        </label>
        <input value={resp} onClick={stop} onChange={e => setResp(e.target.value)}
          onBlur={() => { if (resp !== (r.client_response || '')) patchReq(r.id, { clientResponse: resp }); }}
          placeholder="Client response…" style={{ ...inpSm, flex: 1, minWidth: 160 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10, justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={e => { stop(e); onShip(r); }} title={shipped ? 'Review shipping info' : 'No shipping info yet'}
            style={pill(shipped ? '#4a9eff' : null)}>Shipping Info</button>
          <button type="button" onClick={e => { stop(e); onShip(r); }} className="evt-glass evt-sm">Add Shipping Information</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={e => { stop(e); patchReq(r.id, { subscriptionAdded: !r.subscription_added }); }}
            style={pill(r.subscription_added ? '#5ABF80' : null)}>+ Subscription</button>
          <button type="button" onClick={e => { stop(e); patchReq(r.id, { hardDriveAdded: !r.hard_drive_added }); }}
            style={pill(r.hard_drive_added ? '#e6c229' : null)}>+ Hard Drive</button>
        </div>
      </div>
    </div>
  );
}

function ShippingModal({ r, onClose, onSave }) {
  const [s, setS] = useState({
    shippingName: r.shipping_name || '', shippingEmail: r.shipping_email || '',
    shippingAddress: r.shipping_address || '', shippingTracking: r.shipping_tracking || '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setS(p => ({ ...p, [k]: v }));
  async function save() { setSaving(true); await onSave(r.id, s); setSaving(false); onClose(); }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="glass" style={{ width: '100%', maxWidth: 460, borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Shipping Information</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>{r.client_name}{r.project_code ? ` · ${r.project_code}` : ''}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Shipping Name"><input value={s.shippingName} onChange={e => set('shippingName', e.target.value)} style={inp} /></Field>
          <Field label="Shipping Email"><input type="email" value={s.shippingEmail} onChange={e => set('shippingEmail', e.target.value)} style={inp} /></Field>
          <Field label="Shipping Address"><textarea value={s.shippingAddress} onChange={e => set('shippingAddress', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} /></Field>
          <Field label="Shipping Tracking Number"><input value={s.shippingTracking} onChange={e => set('shippingTracking', e.target.value)} style={inp} /></Field>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button disabled={saving} onClick={save} className="evt-glass">{saving ? 'Saving…' : 'Save Shipping Info'}</button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }) {
  if (!children) return null;
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12, padding: '5px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ color: 'var(--muted)', minWidth: 150, flexShrink: 0 }}>{label}</span>
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{children}</span>
    </div>
  );
}

function DetailModal({ r, onClose, onShip }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="glass" style={{ width: '100%', maxWidth: 560, maxHeight: '86vh', overflowY: 'auto', borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{r.client_name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.project_code}{r.project_name ? ` — ${r.project_name}` : ''}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <DetailRow label="Status">{bucketOf(r)}</DetailRow>
        <DetailRow label="Total Media Size">{r.total_media_size}</DetailRow>
        <DetailRow label="Annual Subscription">{r.subscription_tier ? `${r.subscription_tier} · ${fmt$(r.subscription_cost)}/yr` : ''}</DetailRow>
        <DetailRow label="Hard Drive + Shipping">{r.hard_drive_tier ? `${r.hard_drive_tier} · ${fmt$(r.hard_drive_cost)}` : ''}</DetailRow>
        <DetailRow label="Main POC">{r.poc_name ? `${r.poc_name}${r.poc_email ? ` (${r.poc_email})` : ''}` : (r.poc_email || '')}</DetailRow>
        <DetailRow label="Footage">{r.footage}</DetailRow>
        <DetailRow label="Reference Link(s)">{r.reference_links}</DetailRow>
        <DetailRow label="Email Sent">{r.email_sent ? `Yes${r.email_sent_date ? ` · ${new Date(r.email_sent_date).toLocaleDateString()}` : ''}` : 'No'}</DetailRow>
        <DetailRow label="Client Response">{r.client_response}</DetailRow>
        <DetailRow label="CC">{Array.isArray(r.cc) && r.cc.length ? r.cc.map(c => c.name || c.email).filter(Boolean).join(', ') : ''}</DetailRow>
        <DetailRow label="Requested By">{r.user_name}{r.user_email ? ` (${r.user_email})` : ''}</DetailRow>
        <DetailRow label="Submitted">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</DetailRow>

        <div style={{ marginTop: 14, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>Shipping Info</div>
          <button type="button" onClick={() => onShip(r)} className="evt-glass evt-sm">{hasShipping(r) ? 'Edit' : 'Add Shipping Information'}</button>
        </div>
        {hasShipping(r) ? (
          <>
            <DetailRow label="Shipping Name">{r.shipping_name}</DetailRow>
            <DetailRow label="Shipping Email">{r.shipping_email}</DetailRow>
            <DetailRow label="Shipping Address">{r.shipping_address}</DetailRow>
            <DetailRow label="Tracking Number">{r.shipping_tracking}</DetailRow>
          </>
        ) : <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No shipping info yet.</div>}
      </div>
    </div>
  );
}

export default function MediaStorage() {
  const { user } = useAuth();
  const [f, setF] = useState(BLANK);
  const [people, setPeople] = useState([]);
  const [crew, setCrew] = useState([]);
  const [requests, setRequests] = useState(null);
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState('');
  const [open, setOpen] = useState(false);   // New Request starts collapsed
  const [ccOpen, setCcOpen] = useState(false);
  const [ccIds, setCcIds] = useState([]);
  const [pipeView, setPipeView] = useState('email');
  const [detail, setDetail] = useState(null);   // request open in the detail modal
  const [shipEdit, setShipEdit] = useState(null);   // request whose shipping is being edited
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleCc = id => setCcIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  async function patchReq(id, data) {
    try {
      const row = await api.updateMediaStorageRequest(id, data);
      setRequests(rs => (rs || []).map(x => x.id === id ? row : x));
      setDetail(d => (d && d.id === id ? row : d));
      return row;
    } catch (e) { alert(e.message); }
  }

  useEffect(() => {
    api.clientContactPeople().then(setPeople).catch(() => setPeople([]));
    api.mediaStorageRequests().then(setRequests).catch(() => setRequests([]));
    api.getCrew().then(setCrew).catch(() => setCrew([]));
  }, []);

  // Preferred first + last name for the signed-in user (from the crew roster).
  const me = crew.find(m => (m.email || '').toLowerCase() === (user?.email || '').toLowerCase());
  const preferredName = displayName(me) || user?.name || '';

  // Unbridled Media employees available to CC on the request.
  const employees = crew
    .filter(m => (m.company || '').toLowerCase().includes('unbridled'))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));

  // Selecting a media size auto-selects the subscription + hard-drive tiers.
  function onSize(v) {
    if (v === '') { setF(p => ({ ...p, sizeIdx: '', subIdx: '', hdIdx: '' })); return; }
    const i = Number(v);
    setF(p => ({ ...p, sizeIdx: i, subIdx: i, hdIdx: HD_FOR_SIZE(i) }));
  }

  const canSubmit = f.clientName.trim() && f.sizeIdx !== '';

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true); setOkMsg('');
    const size = f.sizeIdx !== '' ? SUB_TIERS[f.sizeIdx] : null;
    const st = f.subIdx !== '' ? SUB_TIERS[f.subIdx] : null;
    const hd = f.hdIdx !== '' ? HD_TIERS[f.hdIdx] : null;
    try {
      const row = await api.createMediaStorageRequest({
        clientName: f.clientName.trim(),
        projectCode: f.projectCode.trim(),
        projectName: f.projectName.trim(),
        pocName: f.pocName.trim(),
        pocEmail: f.pocEmail.trim(),
        footage: f.footage.trim(),
        referenceLinks: f.referenceLinks.trim(),
        totalMediaSize: size?.label || null,
        subscriptionTier: st?.label || null,
        subscriptionCost: st?.price ?? null,
        hardDriveTier: hd?.label || null,
        hardDriveCost: hd?.price ?? null,
        cc: ccIds.map(id => crew.find(m => m.id === id)).filter(Boolean)
          .map(m => ({ name: displayName(m), email: m.email || '' })),
      });
      setRequests(rs => [row, ...(rs || [])]);
      setF(BLANK);
      setCcIds([]); setCcOpen(false);
      setOkMsg('Request submitted.');
      api.clientContactPeople().then(setPeople).catch(() => {});
      setTimeout(() => setOkMsg(''), 3500);
    } catch (e) { alert(e.message); }
    setSaving(false);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height: 20, filter: 'brightness(0) invert(1)', opacity: 0.95 }} />
          </Link>
          <span style={{ fontSize: 12, color: ACCENT, fontWeight: 700, letterSpacing: '0.04em' }}>Reports & Resources</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{preferredName}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 16px 80px' }}>
        <div className="page-title">Media Storage Management</div>
        <div className="page-sub">Request long-term storage for footage subject to expiration.</div>

        {/* ── New Request (collapsible, liquid glass) ── */}
        <div className="glass" style={{ borderRadius: 14, marginTop: 8, overflow: 'hidden' }}>
          <button onClick={() => setOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', padding: '16px 20px', font: 'inherit' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
              <span style={{ fontSize: 15, fontWeight: 800 }}>New Request</span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>{open ? 'Hide ▴' : 'New Request ▾'}</span>
          </button>

          {open && (
            <div style={{ padding: '4px 20px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Your Name">
                  <input value={preferredName} readOnly style={{ ...inp, opacity: 0.7, cursor: 'default' }} />
                </Field>
                <Field label="Your Email">
                  <input value={user?.email || ''} readOnly style={{ ...inp, opacity: 0.7, cursor: 'default' }} />
                </Field>

                <Field label="Client (Company) Name" required full>
                  <ClientSelect value={f.clientName} onChange={v => set('clientName', v)} inputStyle={inp} />
                </Field>

                <Field label="Main POC — Client Name">
                  <ContactSelect name={f.pocName} people={people}
                    onPick={(nm, em) => setF(p => ({ ...p, pocName: nm, ...(em !== undefined ? { pocEmail: em } : {}) }))} />
                </Field>
                <Field label="Main POC — Client Email">
                  <input type="email" value={f.pocEmail} onChange={e => set('pocEmail', e.target.value)}
                    placeholder="name@client.com" style={inp} />
                </Field>

                <Field label="Relevant Project Code">
                  <ProjectCodeSelect code={f.projectCode}
                    onPick={(code, title, client) => setF(p => ({
                      ...p, projectCode: code,
                      ...(title !== undefined ? { projectName: title } : {}),
                      ...(client && !p.clientName ? { clientName: client } : {}),
                    }))} />
                </Field>
                <Field label="Project Name">
                  <input value={f.projectName} onChange={e => set('projectName', e.target.value)}
                    placeholder="Tied to the code, or type a new one" style={inp} />
                </Field>

                <Field label="Footage" full note="Name all projects, videos, series, or event footage subject to expiration.">
                  <textarea value={f.footage} onChange={e => set('footage', e.target.value)} rows={3}
                    style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
                </Field>
                <Field label="Link to Final Video Reference(s)" full note="If available or helpful to the client — paste any review links to the video/projects set to expire.">
                  <textarea value={f.referenceLinks} onChange={e => set('referenceLinks', e.target.value)} rows={2}
                    style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
                </Field>

                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
                  <Field label="Total Media Size" required>
                    <select value={f.sizeIdx} onChange={e => onSize(e.target.value)} style={inpSm}>
                      <option value="">Select…</option>
                      {SUB_TIERS.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Annual Subscription" required>
                    <select value={f.subIdx} onChange={e => set('subIdx', e.target.value === '' ? '' : Number(e.target.value))} style={inpSm}>
                      <option value="">Select…</option>
                      {SUB_TIERS.map((t, i) => <option key={i} value={i}>{subOptionText(t)}</option>)}
                    </select>
                  </Field>
                  <Field label="Hard Drive + Shipping">
                    <select value={f.hdIdx} onChange={e => set('hdIdx', e.target.value === '' ? '' : Number(e.target.value))} style={inpSm}>
                      <option value="">Select…</option>
                      {HD_TIERS.map((t, i) => <option key={i} value={i}>{hdOptionText(t)}</option>)}
                    </select>
                  </Field>
                </div>
              </div>

              {ccOpen && (
                <div className="glass" style={{ borderRadius: 12, padding: '12px 14px', marginTop: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <span style={lbl}>CC — Unbridled Media Team</span>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>{ccIds.length} selected · tap to toggle</span>
                  </div>
                  {employees.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>No team members found.</div>}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {employees.map(m => {
                      const on = ccIds.includes(m.id);
                      return (
                        <button key={m.id} type="button" onClick={() => toggleCc(m.id)} title={m.email || ''}
                          style={{
                            fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                            padding: '5px 12px', borderRadius: 20,
                            color: on ? '#06121f' : 'var(--text)',
                            background: on ? ACCENT : 'rgba(255,255,255,0.05)',
                            border: '1px solid ' + (on ? ACCENT : 'rgba(255,255,255,0.14)'),
                            backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
                          }}>
                          {displayName(m)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
                {okMsg && <span style={{ fontSize: 12, color: '#5ABF80', fontWeight: 700 }}>{okMsg}</span>}
                <button type="button" onClick={() => setCcOpen(o => !o)} className="evt-glass evt-sm">
                  {ccOpen ? 'Hide CC' : '‹ Request CC'}{ccIds.length ? ` (${ccIds.length})` : ''}
                </button>
                <button disabled={!canSubmit || saving} onClick={submit} className="evt-glass"
                  style={{ opacity: canSubmit && !saving ? 1 : 0.5, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed' }}>
                  {saving ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Media Management Pipeline ── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>
            Media Management Pipeline
          </div>
          <div className="seg-glass" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            {PIPE_VIEWS.map(([k, label]) => (
              <button key={k} className={pipeView === k ? 'on' : ''} onClick={() => setPipeView(k)}>{label}</button>
            ))}
          </div>

          {pipeView === 'email' && (
            <>
              {!requests && <div className="empty">Loading…</div>}
              {requests && requests.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No requests yet.</div>}
              {requests && requests.length > 0 && EMAIL_GROUPS.map(group => {
                const rows = requests.filter(r => bucketOf(r) === group);
                return (
                  <div key={group} style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: '50%', background: GROUP_COLOR[group] }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: GROUP_COLOR[group] }}>{group}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {rows.length}</span>
                    </div>
                    {rows.length === 0
                      ? <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', paddingLeft: 17 }}>None.</div>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {rows.map(r => <RequestTile key={r.id} r={r} patchReq={patchReq} onDetail={setDetail} onShip={setShipEdit} />)}
                        </div>}
                  </div>
                );
              })}
            </>
          )}

          {pipeView !== 'email' && (
            <div className="glass" style={{ borderRadius: 14, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4 }}>{PIPE_VIEWS.find(v => v[0] === pipeView)?.[1]}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>We'll build out this view soon.</div>
            </div>
          )}
        </div>
      </div>

      {shipEdit && <ShippingModal r={shipEdit} onClose={() => setShipEdit(null)}
        onSave={async (id, s) => { await patchReq(id, s); }} />}
      {detail && <DetailModal r={detail} onClose={() => setDetail(null)}
        onShip={r => { setShipEdit(r); }} />}
    </div>
  );
}
