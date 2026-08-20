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
  ['subscription', 'Subscriptions'],
  ['drives', 'Hard Drive Shipping Request'],
  ['expired', 'Expired / Delete'],
];
// Top-of-view group tabs for Email Requests (Expired & Live live in their own views).
const EMAIL_GROUPS = ['New Request', 'In-Progress', 'Annual Check-In'];
const GROUP_COLOR = { 'New Request': '#4a9eff', 'In-Progress': '#e6c229', 'Annual Check-In': '#a78bfa', 'Expired': '#e05252', 'Live': '#5ABF80' };
// Expired and Live rows are deployed out of the Email Requests tabs into their
// own views; everything else (incl. legacy null/'New') falls back to New Request.
const bucketOf = r => (EMAIL_GROUPS.includes(r.status) ? r.status : (r.status === 'Live' || r.status === 'Expired') ? r.status : 'New Request');
const isDeployedDrive = r => r.hard_drive_added && r.status === 'Live';
const isDeployedSub = r => r.subscription_added && r.status === 'Live';
// Subscription pipeline sub-status: everything starts as New Request until the
// Live button is pressed on the row.
const subBucket = r => (r.sub_status === 'Live Subscription' ? 'Live' : 'New Request');
const SUB_GROUPS = [['New Request', 'New Request', '#e05252'], ['Live', 'Live', '#5ABF80']];

// Hard Drive status is derived from the two Sent flags:
//  both sent → Completed · hd sent only → Send Invoice · invoice sent only →
//  Send Hard Drive · neither → New Request.
const driveState = r => {
  const hd = r.hard_drive_sent, inv = r.hard_drive_invoice_sent;
  if (hd && inv) return { key: 'Completed', label: 'Completed', color: '#5ABF80' };
  if (hd && !inv) return { key: 'SendInvoice', label: 'Send Invoice', color: '#e6c229' };
  if (!hd && inv) return { key: 'SendHardDrive', label: 'Send Hard Drive', color: '#e6c229' };
  return { key: 'NewRequest', label: '(!) New Request', color: '#e05252' };
};
const driveBucket = r => (r.hard_drive_sent && r.hard_drive_invoice_sent ? 'Completed' : 'New Request');
const DRIVE_GROUPS = [['New Request', 'New Request', '#e05252'], ['Completed', 'Completed', '#5ABF80']];

// Expired / Delete: grouped by whether the files have been deleted.
const expBucket = r => (r.files_deleted ? 'Complete' : 'Incomplete');
const EXP_GROUPS = [['Incomplete', 'Incomplete', '#e05252'], ['Complete', 'Complete', '#5ABF80']];

// Whole days since a date (for Days Since Outreach). Null if no date.
const daysSince = d => {
  if (!d) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
};
const hasShipping = r => !!(r.shipping_name || r.shipping_email || r.shipping_address || r.shipping_tracking);
// Shipping is "complete" (required before a hard-drive task can go Live).
const shippingReady = r => !!(String(r.shipping_name || '').trim() && String(r.shipping_address || '').trim());

// On phones the spreadsheet rows collapse to stacked label/value cards.
function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth <= 720);
  useEffect(() => {
    const onR = () => setM(window.innerWidth <= 720);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return m;
}
const rowShell = (mobile, cols) => mobile
  ? { display: 'flex', flexDirection: 'column', gap: 9, padding: '12px 14px', borderRadius: 12 }
  : { display: 'grid', gridTemplateColumns: cols, gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10 };
const cellLbl = { fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', flexShrink: 0 };
// One grid/stacked cell. On mobile it shows its label and right-aligns the value.
function Cell({ mobile, label, children, style }) {
  if (!mobile) return <div style={style}>{children}</div>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span style={cellLbl}>{label}</span>
      <div style={{ minWidth: 0, textAlign: 'right', ...style }}>{children}</div>
    </div>
  );
}

// Pill styling: dark when off, filled (accent) when on.
const pill = color => ({
  fontSize: 10, fontWeight: 800, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
  color: color ? '#06121f' : 'var(--muted)',
  background: color || 'rgba(255,255,255,0.05)',
  border: '1px solid ' + (color || 'rgba(255,255,255,0.14)'),
  backdropFilter: 'blur(8px) saturate(1.2)', WebkitBackdropFilter: 'blur(8px) saturate(1.2)',
});

// Spreadsheet grid: Client | Project | Email Sent | Date | Days Out |
// Client Response | Shipping | + Subscription | + Hard Drive | Status
const COLS = '1.4fr 1.8fr 88px 78px 1.6fr 100px 116px 108px 128px 74px';
const shortDate = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '';
const colHead = { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' };
const daysOutLabel = n => n == null ? '—' : `${n}d`;

// Selectable statuses in a task's dropdown, with Live (deployment) above Expired.
function statusOptions(r) {
  const canLive = r.subscription_added || r.hard_drive_added || r.status === 'Live';
  return ['New Request', 'In-Progress', 'Annual Check-In', ...(canLive ? ['Live'] : []), 'Expired'];
}
// Guard: a hard-drive task needs shipping info completed before going Live.
function changeStatus(r, v, patchReq, onShip) {
  if (v === 'Live' && r.hard_drive_added && !shippingReady(r)) {
    alert('Add shipping information (name and address) before moving this hard-drive request to Live.');
    onShip(r);
    return;
  }
  patchReq(r.id, { status: v });
}

function PipelineHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 10, alignItems: 'end', padding: '0 14px 8px' }}>
      <span style={colHead}>Client / Company</span>
      <span style={colHead}>Project Code — Name</span>
      <span style={colHead}>Email Sent</span>
      <span style={colHead}>Date</span>
      <span style={colHead}>Client Response</span>
      <span style={colHead}>Shipping</span>
      <span style={colHead}>Subscription</span>
      <span style={colHead}>Hard Drive</span>
      <span style={colHead}>Status</span>
      <span style={colHead} title="Days Since Outreach">Days Out</span>
    </div>
  );
}

function RequestRow({ r, patchReq, onDetail, onShip, mobile }) {
  const stop = e => e.stopPropagation();
  const shipped = hasShipping(r);
  const days = r.email_sent ? daysSince(r.email_sent_date) : null;
  return (
    <div className="glass" style={rowShell(mobile, COLS)}>
      <Cell mobile={mobile} label="Client / Company"
        style={{ cursor: 'pointer', minWidth: 0, fontSize: 12, fontWeight: 800 }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.client_name}</span>
      </Cell>
      <Cell mobile={mobile} label="Project"
        style={{ cursor: 'pointer', minWidth: 0, fontSize: 11, color: 'var(--muted)' }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.project_code}{r.project_name ? ` — ${r.project_name}` : ''}</span>
      </Cell>
      <Cell mobile={mobile} label="Email Sent">
        <button type="button" onClick={e => {
            stop(e);
            const turningOn = !r.email_sent;
            patchReq(r.id, { emailSent: turningOn, ...(turningOn && bucketOf(r) === 'New Request' ? { status: 'In-Progress' } : {}) });
          }}
          style={pill(r.email_sent ? '#5ABF80' : null)}>{r.email_sent ? 'Sent' : 'Unsent'}</button>
      </Cell>
      <Cell mobile={mobile} label="Date" style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        {r.email_sent ? shortDate(r.email_sent_date) : '—'}
      </Cell>
      <Cell mobile={mobile} label="Client Response" style={{ minWidth: 0, width: mobile ? 150 : undefined }}>
        <input type="date" value={(r.client_response || '').slice(0, 10)} onClick={stop}
          onChange={e => patchReq(r.id, { clientResponse: e.target.value })}
          style={{ ...inpSm, width: '100%' }} />
      </Cell>
      <Cell mobile={mobile} label="Shipping">
        <button type="button" onClick={e => { stop(e); onShip(r); }} title={shipped ? 'Review shipping info' : 'Add shipping info'}
          style={pill(shipped ? '#4a9eff' : null)}>Shipping Info</button>
      </Cell>
      <Cell mobile={mobile} label="Subscription">
        <button type="button" onClick={e => { stop(e); patchReq(r.id, { subscriptionAdded: !r.subscription_added }); }}
          style={pill(r.subscription_added ? '#5ABF80' : null)}>+ Subscription</button>
      </Cell>
      <Cell mobile={mobile} label="Hard Drive">
        <button type="button" onClick={e => { stop(e); patchReq(r.id, { hardDriveAdded: !r.hard_drive_added }); }}
          style={pill(r.hard_drive_added ? '#e6c229' : null)}>+ Hard Drive</button>
      </Cell>
      <Cell mobile={mobile} label="Status" style={{ width: mobile ? 150 : undefined }}>
        <select value={bucketOf(r)} onClick={stop} onChange={e => changeStatus(r, e.target.value, patchReq, onShip)}
          title="Set status — Live deploys to the selected pipeline(s)"
          style={{ ...inpSm, width: '100%', fontWeight: 800, color: GROUP_COLOR[bucketOf(r)] }}>
          {statusOptions(r).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </Cell>
      <Cell mobile={mobile} label="Days Out"
        style={{ fontSize: 11, fontWeight: 700, textAlign: mobile ? 'right' : 'center', color: days != null && days >= 14 ? '#e05252' : 'var(--muted)' }}>
        {daysOutLabel(days)}
      </Cell>
    </div>
  );
}

// New Request tab: a leaner grid focused on the estimate + status.
const NEW_COLS = '1.3fr 1.7fr 96px 132px 150px 156px 132px';
function NewReqHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: NEW_COLS, gap: 10, alignItems: 'end', padding: '0 14px 8px' }}>
      <span style={colHead}>Client / Company</span>
      <span style={colHead}>Project Code — Name</span>
      <span style={colHead}>Email Sent</span>
      <span style={colHead}>Total Media Size</span>
      <span style={colHead}>Annual Subscription</span>
      <span style={colHead}>Hard Drive + Shipping</span>
      <span style={colHead}>Status</span>
    </div>
  );
}

function NewRequestRow({ r, patchReq, onDetail, onShip, mobile }) {
  const stop = e => e.stopPropagation();
  const sizeIdx = SUB_TIERS.findIndex(t => t.label === r.total_media_size);
  const subIdx = r.subscription_added ? SUB_TIERS.findIndex(t => t.label === r.subscription_tier) : -1;
  const hdIdx = r.hard_drive_added ? HD_TIERS.findIndex(t => t.label === r.hard_drive_tier) : -1;
  // Picking a size fills both estimate tiers and marks them for deployment.
  const onSize = v => {
    if (v === '') { patchReq(r.id, { totalMediaSize: '' }); return; }
    const i = Number(v), h = HD_FOR_SIZE(i);
    patchReq(r.id, {
      totalMediaSize: SUB_TIERS[i].label,
      subscriptionTier: SUB_TIERS[i].label, subscriptionCost: SUB_TIERS[i].price, subscriptionAdded: true,
      hardDriveTier: HD_TIERS[h].label, hardDriveCost: HD_TIERS[h].price, hardDriveAdded: true,
    });
  };
  const onSub = v => v === ''
    ? patchReq(r.id, { subscriptionAdded: false })
    : patchReq(r.id, { subscriptionTier: SUB_TIERS[+v].label, subscriptionCost: SUB_TIERS[+v].price, subscriptionAdded: true });
  const onHd = v => v === ''
    ? patchReq(r.id, { hardDriveAdded: false })
    : patchReq(r.id, { hardDriveTier: HD_TIERS[+v].label, hardDriveCost: HD_TIERS[+v].price, hardDriveAdded: true });
  return (
    <div className="glass" style={rowShell(mobile, NEW_COLS)}>
      <Cell mobile={mobile} label="Client / Company" style={{ cursor: 'pointer', minWidth: 0, fontSize: 12, fontWeight: 800 }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.client_name}</span>
      </Cell>
      <Cell mobile={mobile} label="Project" style={{ cursor: 'pointer', minWidth: 0, fontSize: 11, color: 'var(--muted)' }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.project_code}{r.project_name ? ` — ${r.project_name}` : ''}</span>
      </Cell>
      <Cell mobile={mobile} label="Email Sent">
        <button type="button" onClick={e => {
            stop(e);
            const turningOn = !r.email_sent;
            patchReq(r.id, { emailSent: turningOn, ...(turningOn && bucketOf(r) === 'New Request' ? { status: 'In-Progress' } : {}) });
          }}
          style={pill(r.email_sent ? '#5ABF80' : null)}>{r.email_sent ? 'Sent' : 'Unsent'}</button>
      </Cell>
      <Cell mobile={mobile} label="Total Media Size" style={{ width: mobile ? 160 : undefined }}>
        <select value={sizeIdx < 0 ? '' : sizeIdx} onClick={stop} onChange={e => onSize(e.target.value)} style={{ ...inpSm, width: '100%' }}>
          <option value="">Select…</option>
          {SUB_TIERS.map((t, i) => <option key={i} value={i}>{t.label}</option>)}
        </select>
      </Cell>
      <Cell mobile={mobile} label="Annual Subscription" style={{ width: mobile ? 170 : undefined }}>
        <select value={subIdx < 0 ? '' : subIdx} onClick={stop} onChange={e => onSub(e.target.value)} style={{ ...inpSm, width: '100%' }}>
          <option value="">None</option>
          {SUB_TIERS.map((t, i) => <option key={i} value={i}>{t.label} · {fmt$(t.price)}/yr</option>)}
        </select>
      </Cell>
      <Cell mobile={mobile} label="Hard Drive + Shipping" style={{ width: mobile ? 170 : undefined }}>
        <select value={hdIdx < 0 ? '' : hdIdx} onClick={stop} onChange={e => onHd(e.target.value)} style={{ ...inpSm, width: '100%' }}>
          <option value="">None</option>
          {HD_TIERS.map((t, i) => <option key={i} value={i}>{t.label} · {fmt$(t.price)}</option>)}
        </select>
      </Cell>
      <Cell mobile={mobile} label="Status" style={{ width: mobile ? 150 : undefined }}>
        <select value={bucketOf(r)} onClick={stop} onChange={e => changeStatus(r, e.target.value, patchReq, onShip)}
          title="Set status — Live deploys to the selected pipeline(s)"
          style={{ ...inpSm, width: '100%', fontWeight: 800, color: GROUP_COLOR[bucketOf(r)] }}>
          {statusOptions(r).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </Cell>
    </div>
  );
}

// Hard Drive Shipping Request spreadsheet.
const DRIVE_COLS = '82px 132px 1.25fr 1.7fr 150px 104px 116px 104px';
function DriveHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: DRIVE_COLS, gap: 10, alignItems: 'end', padding: '0 14px 8px' }}>
      <span style={colHead} title="Date deployed to Live">Went Live</span>
      <span style={colHead}>Status</span>
      <span style={colHead}>Client / Company</span>
      <span style={colHead}>Project Code — Name</span>
      <span style={colHead}>Tier Cost</span>
      <span style={colHead}>Hard Drive</span>
      <span style={colHead}>Invoice</span>
      <span style={colHead}>Shipping</span>
    </div>
  );
}

function DriveRow({ r, patchReq, onDetail, onShip, onTrack, mobile }) {
  const stop = e => e.stopPropagation();
  const st = driveState(r);
  const shipped = hasShipping(r);
  return (
    <div className="glass" style={rowShell(mobile, DRIVE_COLS)}>
      <Cell mobile={mobile} label="Went Live" style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{shortDate(r.live_date) || '—'}</Cell>
      <Cell mobile={mobile} label="Status">
        <span style={{ ...pill(st.color), cursor: 'default' }}>{st.label}</span>
      </Cell>
      <Cell mobile={mobile} label="Client / Company" style={{ cursor: 'pointer', minWidth: 0, fontSize: 12, fontWeight: 800 }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.client_name}</span>
      </Cell>
      <Cell mobile={mobile} label="Project" style={{ cursor: 'pointer', minWidth: 0, fontSize: 11, color: 'var(--muted)' }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.project_code}{r.project_name ? ` — ${r.project_name}` : ''}</span>
      </Cell>
      <Cell mobile={mobile} label="Tier Cost" style={{ fontSize: 11 }}>{r.hard_drive_tier ? `${r.hard_drive_tier} · ${fmt$(r.hard_drive_cost)}` : '—'}</Cell>
      <Cell mobile={mobile} label="Hard Drive">
        <button type="button" title={r.hard_drive_sent ? 'Mark hard drive unsent' : 'Confirm tracking number to mark sent'}
          onClick={e => { stop(e); if (r.hard_drive_sent) patchReq(r.id, { hardDriveSent: false }); else onTrack(r); }}
          style={pill(r.hard_drive_sent ? '#5ABF80' : null)}>{r.hard_drive_sent ? 'Sent' : 'Unsent'}</button>
      </Cell>
      <Cell mobile={mobile} label="Invoice">
        <button type="button" onClick={e => { stop(e); patchReq(r.id, { hardDriveInvoiceSent: !r.hard_drive_invoice_sent }); }}
          style={pill(r.hard_drive_invoice_sent ? '#5ABF80' : null)}>{r.hard_drive_invoice_sent ? 'Sent' : 'Unsent'}</button>
      </Cell>
      <Cell mobile={mobile} label="Shipping">
        <button type="button" onClick={e => { stop(e); onShip(r); }} title={shipped ? 'Review shipping info' : 'Add shipping info'}
          style={pill(shipped ? '#4a9eff' : null)}>Shipping Info</button>
      </Cell>
    </div>
  );
}

// Subscriptions spreadsheet.
const SUB_COLS = '82px 1.25fr 1.85fr 168px 116px 130px 130px 92px';
function SubHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: SUB_COLS, gap: 10, alignItems: 'end', padding: '0 14px 8px' }}>
      <span style={colHead} title="Date deployed to Live">Went Live</span>
      <span style={colHead}>Client / Company</span>
      <span style={colHead}>Project Code — Name</span>
      <span style={colHead}>Tier Cost</span>
      <span style={colHead}>Invoice</span>
      <span style={colHead}>Subscription Start</span>
      <span style={colHead}>Subscription End</span>
      <span style={colHead}>Live</span>
    </div>
  );
}

function SubRow({ r, patchReq, onDetail, mobile }) {
  const stop = e => e.stopPropagation();
  const live = r.sub_status === 'Live Subscription';
  return (
    <div className="glass" style={rowShell(mobile, SUB_COLS)}>
      <Cell mobile={mobile} label="Went Live" style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{shortDate(r.live_date) || '—'}</Cell>
      <Cell mobile={mobile} label="Client / Company" style={{ cursor: 'pointer', minWidth: 0, fontSize: 12, fontWeight: 800 }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.client_name}</span>
      </Cell>
      <Cell mobile={mobile} label="Project" style={{ cursor: 'pointer', minWidth: 0, fontSize: 11, color: 'var(--muted)' }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.project_code}{r.project_name ? ` — ${r.project_name}` : ''}</span>
      </Cell>
      <Cell mobile={mobile} label="Tier Cost" style={{ fontSize: 11 }}>{r.subscription_tier ? `${r.subscription_tier} · ${fmt$(r.subscription_cost)}/yr` : '—'}</Cell>
      <Cell mobile={mobile} label="Invoice">
        <button type="button" onClick={e => { stop(e); patchReq(r.id, { subscriptionInvoiceSent: !r.subscription_invoice_sent }); }}
          style={pill(r.subscription_invoice_sent ? '#5ABF80' : null)}>{r.subscription_invoice_sent ? 'Sent' : 'Unsent'}</button>
      </Cell>
      <Cell mobile={mobile} label="Subscription Start" style={{ width: mobile ? 150 : undefined }}>
        <input type="date" value={(r.subscription_start || '').slice(0, 10)} onClick={stop}
          onChange={e => patchReq(r.id, { subscriptionStart: e.target.value })} style={{ ...inpSm, width: '100%' }} />
      </Cell>
      <Cell mobile={mobile} label="Subscription End" style={{ width: mobile ? 150 : undefined }}>
        <input type="date" value={(r.subscription_end || '').slice(0, 10)} onClick={stop}
          onChange={e => patchReq(r.id, { subscriptionEnd: e.target.value })} style={{ ...inpSm, width: '100%' }} />
      </Cell>
      <Cell mobile={mobile} label="Live">
        <button type="button" title={live ? 'Live subscription' : 'Requires start/end dates + invoice sent'}
          onClick={e => {
            stop(e);
            if (!live) {
              if (!r.subscription_start || !r.subscription_end || !r.subscription_invoice_sent) {
                alert('Enter the Subscription Start and End dates and mark the Invoice Sent before moving to Live.');
                return;
              }
              patchReq(r.id, { subStatus: 'Live Subscription' });
            } else {
              patchReq(r.id, { subStatus: 'New Subscription' });
            }
          }}
          style={pill(live ? '#5ABF80' : null)}>Live</button>
      </Cell>
    </div>
  );
}

// Expired / Delete spreadsheet.
const EXP_COLS = '1.4fr 2fr 130px 150px 150px';
function ExpiredHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: EXP_COLS, gap: 10, alignItems: 'end', padding: '0 14px 8px' }}>
      <span style={colHead}>Client / Company</span>
      <span style={colHead}>Project Code — Name</span>
      <span style={colHead}>Email Sent Date</span>
      <span style={colHead}>Status</span>
      <span style={colHead}>Files Deleted</span>
    </div>
  );
}

function ExpiredRow({ r, patchReq, onDetail, onShip, mobile }) {
  const stop = e => e.stopPropagation();
  return (
    <div className="glass" style={rowShell(mobile, EXP_COLS)}>
      <Cell mobile={mobile} label="Client / Company" style={{ cursor: 'pointer', minWidth: 0, fontSize: 12, fontWeight: 800 }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.client_name}</span>
      </Cell>
      <Cell mobile={mobile} label="Project" style={{ cursor: 'pointer', minWidth: 0, fontSize: 11, color: 'var(--muted)' }}>
        <span onClick={() => onDetail(r)} title="Open full request">{r.project_code}{r.project_name ? ` — ${r.project_name}` : ''}</span>
      </Cell>
      <Cell mobile={mobile} label="Email Sent Date" style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{r.email_sent ? shortDate(r.email_sent_date) : '—'}</Cell>
      <Cell mobile={mobile} label="Status" style={{ width: mobile ? 150 : undefined }}>
        <select value={bucketOf(r)} onClick={stop} onChange={e => changeStatus(r, e.target.value, patchReq, onShip)}
          style={{ ...inpSm, width: '100%', fontWeight: 800, color: GROUP_COLOR[bucketOf(r)] }}>
          {statusOptions(r).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </Cell>
      <Cell mobile={mobile} label="Files Deleted">
        <button type="button" title={r.files_deleted ? 'Files deleted' : 'Mark files deleted'}
          onClick={e => { stop(e); patchReq(r.id, { filesDeleted: !r.files_deleted }); }}
          style={pill(r.files_deleted ? '#5ABF80' : null)}>{r.files_deleted ? 'Completed' : 'Incomplete'}</button>
      </Cell>
    </div>
  );
}

// Closed programs from the last 12 months (Annual Check-In → Last 12 Months).
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function parseCloseMonth(s) {
  if (!s) return null;
  const p = String(s).trim().toLowerCase().split(/\s+/);
  if (p.length < 2) return null;
  const mi = MONTHS.indexOf(p[0]);
  const y = parseInt(p[1], 10);
  if (mi < 0 || !y) return null;
  return new Date(y, mi, 1);
}
const CLOSED_COLS = '110px 1.3fr 1.7fr 128px 150px 156px 116px';
function ClosedHeader() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: CLOSED_COLS, gap: 10, alignItems: 'end', padding: '0 14px 8px' }}>
      <span style={colHead}>Close Date</span>
      <span style={colHead}>Client / Company</span>
      <span style={colHead}>Project Code — Name</span>
      <span style={colHead}>Total Media Size</span>
      <span style={colHead}>Annual Subscription</span>
      <span style={colHead}>Hard Drive + Shipping</span>
      <span style={colHead}>Status</span>
    </div>
  );
}
function ClosedRow({ p, mobile }) {
  const muted = { fontSize: 11, color: 'var(--muted)' };
  return (
    <div className="glass" style={rowShell(mobile, CLOSED_COLS)}>
      <Cell mobile={mobile} label="Close Date" style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{p.close_month || (p.end_date ? shortDate(p.end_date) : '—')}</Cell>
      <Cell mobile={mobile} label="Client / Company" style={{ fontSize: 12, fontWeight: 800, minWidth: 0 }}>{p.client}</Cell>
      <Cell mobile={mobile} label="Project" style={{ fontSize: 11, color: 'var(--muted)', minWidth: 0 }}>{p.code}{p.title ? ` — ${p.title}` : ''}</Cell>
      <Cell mobile={mobile} label="Total Media Size" style={{ fontSize: 11 }}>{p.data_storage || '—'}</Cell>
      <Cell mobile={mobile} label="Annual Subscription" style={muted}>—</Cell>
      <Cell mobile={mobile} label="Hard Drive + Shipping" style={muted}>—</Cell>
      <Cell mobile={mobile} label="Status"><span style={{ ...pill('#8a8f98'), cursor: 'default' }}>Closed</span></Cell>
    </div>
  );
}

function ShippingModal({ r, onClose, onSave }) {
  const [s, setS] = useState({
    shippingName: r.shipping_name || '', shippingEmail: r.shipping_email || '',
    shippingAddress: r.shipping_address || '',
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
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button disabled={saving} onClick={save} className="evt-glass">{saving ? 'Saving…' : 'Save Shipping Info'}</button>
        </div>
      </div>
    </div>
  );
}

// Confirm the shipping tracking number when marking a hard drive Sent.
function TrackingModal({ r, onClose, onConfirm }) {
  const [tracking, setTracking] = useState(r.shipping_tracking || '');
  const [saving, setSaving] = useState(false);
  async function confirm() {
    if (!tracking.trim()) return;
    setSaving(true);
    await onConfirm(r.id, tracking.trim());
    setSaving(false);
    onClose();
  }
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 210, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="glass" style={{ width: '100%', maxWidth: 420, borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>Confirm Shipping Tracking</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>Enter the tracking number to mark the hard drive as sent — {r.client_name}{r.project_code ? ` · ${r.project_code}` : ''}.</div>
        <input autoFocus value={tracking} onChange={e => setTracking(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && tracking.trim()) confirm(); }}
          placeholder="Tracking number" style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          <button disabled={!tracking.trim() || saving} onClick={confirm} className="evt-glass"
            style={{ opacity: tracking.trim() && !saving ? 1 : 0.5, cursor: tracking.trim() && !saving ? 'pointer' : 'not-allowed' }}>
            {saving ? 'Saving…' : 'Confirm & Mark Sent'}
          </button>
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
  const [emailGroup, setEmailGroup] = useState('New Request');
  const [subGroup, setSubGroup] = useState('New Request');
  const [driveGroup, setDriveGroup] = useState('New Request');
  const [expGroup, setExpGroup] = useState('Incomplete');
  const [showClosed, setShowClosed] = useState(false);   // Annual Check-In → Last 12 Months
  const [closedProgs, setClosedProgs] = useState(null);
  const [trackEdit, setTrackEdit] = useState(null);   // request whose tracking is being confirmed
  const [detail, setDetail] = useState(null);   // request open in the detail modal
  const [shipEdit, setShipEdit] = useState(null);   // request whose shipping is being edited
  const mobile = useIsMobile();
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

  // Lazy-load closed programs the first time "Last 12 Months" is turned on.
  useEffect(() => {
    if (showClosed && closedProgs === null) api.financeProjects(true).then(setClosedProgs).catch(() => setClosedProgs([]));
  }, [showClosed]);
  const closedLast12 = React.useMemo(() => {
    if (!closedProgs) return [];
    const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
    return closedProgs
      // Closed by budget, or archived after a Close (exclude never-approved "Dead").
      .filter(p => p.budget_status === 'Closed' || (p.status === 'ARCHIVED' && p.budget_status !== 'Dead' && p.budget_status !== 'RFP'))
      // Prefer the chosen close month; fall back to the project end date.
      .map(p => ({ ...p, _cd: parseCloseMonth(p.close_month) || (p.end_date ? new Date(p.end_date) : null) }))
      .filter(p => p._cd && p._cd >= cutoff)
      .sort((a, b) => a._cd - b._cd);
  }, [closedProgs]);

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
  // Any deployed subscription not yet marked live → pulse the tab.
  const subsPending = (requests || []).some(r => isDeployedSub(r) && r.sub_status !== 'Live Subscription');
  // Any deployed hard-drive task not yet Completed → pulse the tab.
  const drivesPending = (requests || []).some(r => isDeployedDrive(r) && driveBucket(r) === 'New Request');
  // Any expired task whose files aren't deleted yet → pulse the tab.
  const expiredPending = (requests || []).some(r => r.status === 'Expired' && !r.files_deleted);

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
      setCcIds([]); setCcOpen(false); setOpen(false);
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

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '10px 16px 80px' }}>
        <div>
          <div className="page-title" style={{ marginBottom: 2 }}>Media Storage Management</div>
          <div className="page-sub" style={{ marginBottom: 0 }}>Request long-term storage for footage subject to expiration.</div>
        </div>

        {/* ── New Request (modal, liquid glass) ── */}
        {open && (
          <div onClick={e => e.target === e.currentTarget && setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
            <div className="glass" style={{ width: '100%', maxWidth: 720, borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 10px ${ACCENT}` }} />
                  <span style={{ fontSize: 15, fontWeight: 800 }}>New Request</span>
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
              </div>
              <div style={{ padding: '16px 20px 20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 14 }}>
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

                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
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
            </div>
          </div>
        )}

        {/* ── Media Management Pipeline ── */}
        <div style={{ marginTop: 28 }}>
          <div style={mobile
            ? { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }
            : { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            {!mobile && <div />}
            <div className="seg-glass" style={{ flexWrap: 'wrap', ...(mobile ? { justifyContent: 'center' } : {}) }}>
              {PIPE_VIEWS.map(([k, label]) => (
                <button key={k}
                  className={`${pipeView === k ? 'on' : ''}${(k === 'drives' && drivesPending) || (k === 'subscription' && subsPending) || (k === 'expired' && expiredPending) ? ' ms-pulse' : ''}`}
                  onClick={() => setPipeView(k)}>{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: mobile ? 'center' : 'flex-end' }}>
              <button type="button" className="evt-glass" onClick={() => setOpen(true)}>+ New Request</button>
            </div>
          </div>

          {pipeView === 'email' && (
            <>
              {!requests && <div className="empty">Loading…</div>}
              {requests && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div className="seg-glass" style={{ flexWrap: 'wrap' }}>
                      {EMAIL_GROUPS.map(group => {
                        const n = requests.filter(r => bucketOf(r) === group).length;
                        return (
                          <button key={group} className={emailGroup === group ? 'on' : ''} onClick={() => setEmailGroup(group)}
                            style={emailGroup === group ? { color: GROUP_COLOR[group] } : undefined}>
                            {group} <span style={{ opacity: 0.6 }}>· {n}</span>
                          </button>
                        );
                      })}
                    </div>
                    {emailGroup === 'Annual Check-In' && (
                      <button type="button" onClick={() => setShowClosed(s => !s)}
                        style={pill(showClosed ? '#4a9eff' : null)}>
                        Last 12 Months{showClosed && closedProgs ? ` · ${closedLast12.length}` : ''}
                      </button>
                    )}
                  </div>
                  {(() => {
                    const rows = requests.filter(r => bucketOf(r) === emailGroup);
                    if (rows.length === 0) return <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 4px' }}>No requests in {emailGroup}.</div>;
                    const isNew = emailGroup === 'New Request';
                    const Row = isNew ? NewRequestRow : RequestRow;
                    const Header = isNew ? NewReqHeader : PipelineHeader;
                    const minW = isNew ? 900 : 1040;
                    const body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rows.map(r => <Row key={r.id} r={r} patchReq={patchReq} onDetail={setDetail} onShip={setShipEdit} mobile={mobile} />)}
                    </div>;
                    return mobile ? body
                      : <div style={{ overflowX: 'auto' }}><div style={{ minWidth: minW }}><Header />{body}</div></div>;
                  })()}

                  {emailGroup === 'Annual Check-In' && showClosed && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8 }}>Closed Programs — Last 12 Months</div>
                      {!closedProgs && <div className="empty">Loading…</div>}
                      {closedProgs && closedLast12.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 4px' }}>No programs closed in the last 12 months.</div>}
                      {closedProgs && closedLast12.length > 0 && (mobile
                        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{closedLast12.map(p => <ClosedRow key={p.id} p={p} mobile={mobile} />)}</div>
                        : <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 1060 }}><ClosedHeader />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{closedLast12.map(p => <ClosedRow key={p.id} p={p} mobile={mobile} />)}</div>
                          </div></div>)}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {pipeView === 'drives' && (
            <>
              {!requests && <div className="empty">Loading…</div>}
              {requests && (() => {
                const deployed = requests.filter(isDeployedDrive);
                if (!deployed.length) return <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 4px' }}>No hard drive shipping requests yet. On an Email Request, select <b>+ Hard Drive</b> and move it to <b>Live</b> to deploy it here.</div>;
                const rows = deployed.filter(r => driveBucket(r) === driveGroup);
                return (
                  <>
                    <div className="seg-glass" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                      {DRIVE_GROUPS.map(([key, label, color]) => {
                        const n = deployed.filter(r => driveBucket(r) === key).length;
                        return (
                          <button key={key} className={driveGroup === key ? 'on' : ''} onClick={() => setDriveGroup(key)}
                            style={driveGroup === key ? { color } : undefined}>
                            ({n}) {label}
                          </button>
                        );
                      })}
                    </div>
                    {rows.length === 0
                      ? <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 4px' }}>None in {driveGroup === 'Completed' ? 'Completed' : 'New Request'}.</div>
                      : (() => {
                        const body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {rows.map(r => <DriveRow key={r.id} r={r} patchReq={patchReq} onDetail={setDetail} onShip={setShipEdit} onTrack={setTrackEdit} mobile={mobile} />)}
                        </div>;
                        return mobile ? body
                          : <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 940 }}><DriveHeader />{body}</div></div>;
                      })()}
                  </>
                );
              })()}
            </>
          )}

          {pipeView === 'subscription' && (
            <>
              {!requests && <div className="empty">Loading…</div>}
              {requests && (() => {
                const deployed = requests.filter(isDeployedSub);
                if (!deployed.length) return <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 4px' }}>No subscriptions yet. On an Email Request, select <b>+ Subscription</b> and move it to <b>Live</b> to deploy it here.</div>;
                const rows = deployed.filter(r => subBucket(r) === subGroup);
                return (
                  <>
                    <div className="seg-glass" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                      {SUB_GROUPS.map(([key, label, color]) => {
                        const n = deployed.filter(r => subBucket(r) === key).length;
                        return (
                          <button key={key} className={subGroup === key ? 'on' : ''} onClick={() => setSubGroup(key)}
                            style={subGroup === key ? { color } : undefined}>
                            ({n}) {label}
                          </button>
                        );
                      })}
                    </div>
                    {rows.length === 0
                      ? <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 4px' }}>None in {subGroup === 'Live' ? 'Live' : 'New Request'}.</div>
                      : (() => {
                        const body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {rows.map(r => <SubRow key={r.id} r={r} patchReq={patchReq} onDetail={setDetail} mobile={mobile} />)}
                        </div>;
                        return mobile ? body
                          : <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 980 }}><SubHeader />{body}</div></div>;
                      })()}
                  </>
                );
              })()}
            </>
          )}

          {pipeView === 'expired' && (
            <>
              {!requests && <div className="empty">Loading…</div>}
              {requests && (() => {
                const expired = requests.filter(r => r.status === 'Expired');
                if (!expired.length) return <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 4px' }}>Nothing expired. Set a task's status to <b>Expired</b> to move it here.</div>;
                const rows = expired.filter(r => expBucket(r) === expGroup);
                return (
                  <>
                    <div className="seg-glass" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
                      {EXP_GROUPS.map(([key, label, color]) => {
                        const n = expired.filter(r => expBucket(r) === key).length;
                        return (
                          <button key={key} className={expGroup === key ? 'on' : ''} onClick={() => setExpGroup(key)}
                            style={expGroup === key ? { color } : undefined}>
                            ({n}) {label}
                          </button>
                        );
                      })}
                    </div>
                    {rows.length === 0
                      ? <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '10px 4px' }}>None in {expGroup}.</div>
                      : (() => {
                        const body = <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {rows.map(r => <ExpiredRow key={r.id} r={r} patchReq={patchReq} onDetail={setDetail} onShip={setShipEdit} mobile={mobile} />)}
                        </div>;
                        return mobile ? body
                          : <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 820 }}><ExpiredHeader />{body}</div></div>;
                      })()}
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {shipEdit && <ShippingModal r={shipEdit} onClose={() => setShipEdit(null)}
        onSave={async (id, s) => { await patchReq(id, s); }} />}
      {trackEdit && <TrackingModal r={trackEdit} onClose={() => setTrackEdit(null)}
        onConfirm={async (id, tracking) => { await patchReq(id, { shippingTracking: tracking, hardDriveSent: true }); }} />}
      {detail && <DetailModal r={detail} onClose={() => setDetail(null)}
        onShip={r => { setShipEdit(r); }} />}
    </div>
  );
}
