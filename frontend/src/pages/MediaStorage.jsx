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
        <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, marginTop: 4, borderRadius: 10, maxHeight: 240, overflowY: 'auto' }}>
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
        <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, marginTop: 4, borderRadius: 10, maxHeight: 240, overflowY: 'auto' }}>
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
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleCc = id => setCcIds(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

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

        {/* ── Submitted requests ── */}
        <div style={{ marginTop: 26 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: 10 }}>
            Submitted Requests {requests && `· ${requests.length}`}
          </div>
          {!requests && <div className="empty">Loading…</div>}
          {requests && requests.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>No requests yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(requests || []).map(r => (
              <div key={r.id} className="glass" style={{ borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>
                    {r.client_name}
                    {r.project_code && <span style={{ color: 'var(--muted)', fontWeight: 600 }}> · {r.project_code}</span>}
                    {r.project_name && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> — {r.project_name}</span>}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '4px 18px', flexWrap: 'wrap', marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                  {r.total_media_size && <span>Size <b style={{ color: 'var(--text)' }}>{r.total_media_size}</b></span>}
                  {r.subscription_tier && <span>Subscription <b style={{ color: 'var(--text)' }}>{r.subscription_tier} · {fmt$(r.subscription_cost)}/yr</b></span>}
                  {r.hard_drive_tier && <span>Hard Drive <b style={{ color: 'var(--text)' }}>{r.hard_drive_tier} · {fmt$(r.hard_drive_cost)}</b></span>}
                  {r.poc_name && <span>POC <b style={{ color: 'var(--text)' }}>{r.poc_name}</b>{r.poc_email ? ` (${r.poc_email})` : ''}</span>}
                  {r.user_name && <span>By {r.user_name}</span>}
                </div>
                {Array.isArray(r.cc) && r.cc.length > 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}><b style={{ color: 'var(--text)' }}>CC:</b> {r.cc.map(c => c.name || c.email).filter(Boolean).join(', ')}</div>}
                {r.footage && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, whiteSpace: 'pre-wrap' }}><b style={{ color: 'var(--text)' }}>Footage:</b> {r.footage}</div>}
                {r.reference_links && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}><b style={{ color: 'var(--text)' }}>References:</b> {r.reference_links}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
