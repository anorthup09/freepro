import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';
import ClientSelect from '../components/ClientSelect.jsx';

const ACCENT = '#4a9eff';
const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US');

// Annual subscription tiers. `price` is the client-facing figure (after any
// volume discount); list/disc are shown so the math is transparent.
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

const lbl = { fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 };
const sub = { fontSize: 10, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2, marginBottom: 4, fontWeight: 400, textTransform: 'none', letterSpacing: 0 };
const inp = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: 13, width: '100%' };

function Field({ label, note, children, required }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={lbl}>{label}{required && <span style={{ color: ACCENT }}> *</span>}</span>
      {note && <span style={sub}>{note}</span>}
      {children}
    </label>
  );
}

// Searchable project-code combobox: pick an existing project (fills code + name)
// or type a new code. Requires FINANCE/PRODUCER/ADMIN, matching this report.
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
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {matches.map(p => (
            <div key={p.id} onClick={() => { onPick(p.code, p.title, p.client); setQ(p.code); setOpen(false); }}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
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
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 40, marginTop: 4, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {matches.map((p, i) => (
            <div key={(p.email || '') + i} onClick={() => { onPick(p.name, p.email || ''); setQ(p.name); setOpen(false); }}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
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
  footage: '', referenceLinks: '', totalMediaSize: '', subIdx: '', hdIdx: '',
};

export default function MediaStorage() {
  const { user } = useAuth();
  const [f, setF] = useState(BLANK);
  const [people, setPeople] = useState([]);
  const [requests, setRequests] = useState(null);
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    api.clientContactPeople().then(setPeople).catch(() => setPeople([]));
    api.mediaStorageRequests().then(setRequests).catch(() => setRequests([]));
  }, []);

  const canSubmit = f.clientName.trim() && f.totalMediaSize.trim() && f.subIdx !== '';

  async function submit() {
    if (!canSubmit || saving) return;
    setSaving(true); setOkMsg('');
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
        totalMediaSize: f.totalMediaSize.trim(),
        subscriptionTier: st?.label || null,
        subscriptionCost: st?.price ?? null,
        hardDriveTier: hd?.label || null,
        hardDriveCost: hd?.price ?? null,
      });
      setRequests(rs => [row, ...(rs || [])]);
      setF(BLANK);
      setOkMsg('Request submitted.');
      // refresh contact database so a new POC autofills next time
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
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>‹ Reports</Link>
          <HomeButton />
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '10px 16px 80px' }}>
        <div className="page-title">Media Storage Management</div>
        <div className="page-sub">Request long-term storage for footage subject to expiration.</div>

        {/* ── New Request form ── */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderTop: `3px solid ${ACCENT}`, borderRadius: 12, padding: '20px 22px', marginTop: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>New Request</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Your Name">
              <input value={user?.name || ''} readOnly style={{ ...inp, opacity: 0.7, cursor: 'default' }} />
            </Field>
            <Field label="Your Email">
              <input value={user?.email || ''} readOnly style={{ ...inp, opacity: 0.7, cursor: 'default' }} />
            </Field>

            <Field label="Client Name" required>
              <ClientSelect value={f.clientName} onChange={v => set('clientName', v)} inputStyle={inp} />
            </Field>
            <Field label="Main POC — Client Name">
              <ContactSelect name={f.pocName} people={people}
                onPick={(nm, em) => setF(p => ({ ...p, pocName: nm, ...(em !== undefined ? { pocEmail: em } : {}) }))} />
            </Field>

            <Field label="Relevant Project Code">
              <ProjectCodeSelect code={f.projectCode}
                onPick={(code, title, client) => setF(p => ({
                  ...p, projectCode: code,
                  ...(title !== undefined ? { projectName: title } : {}),
                  ...(client && !p.clientName ? { clientName: client } : {}),
                }))} />
            </Field>
            <Field label="Main POC — Client Email">
              <input type="email" value={f.pocEmail} onChange={e => set('pocEmail', e.target.value)}
                placeholder="name@client.com" style={inp} />
            </Field>

            <Field label="Project Name">
              <input value={f.projectName} onChange={e => set('projectName', e.target.value)}
                placeholder="Tied to the code, or type a new one" style={inp} />
            </Field>
            <Field label="Total Media Size (GB or TB)" required>
              <input value={f.totalMediaSize} onChange={e => set('totalMediaSize', e.target.value)}
                placeholder="e.g. 3.5 TB" style={inp} />
            </Field>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 14 }}>
            <Field label="Footage" note="Name all projects, videos, series, or event footage subject to expiration.">
              <textarea value={f.footage} onChange={e => set('footage', e.target.value)} rows={3}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
            <Field label="Link to Final Video Reference(s)" note="If available or helpful to the client — paste any review links to the video/projects set to expire.">
              <textarea value={f.referenceLinks} onChange={e => set('referenceLinks', e.target.value)} rows={2}
                style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <Field label="Annual Subscription Service Estimate" required>
              <select value={f.subIdx} onChange={e => set('subIdx', e.target.value)} style={inp}>
                <option value="">Select a tier…</option>
                {SUB_TIERS.map((t, i) => <option key={i} value={i}>{subOptionText(t)}</option>)}
              </select>
            </Field>
            <Field label="Hard Drive + Shipping Estimate">
              <select value={f.hdIdx} onChange={e => set('hdIdx', e.target.value)} style={inp}>
                <option value="">Select a tier…</option>
                {HD_TIERS.map((t, i) => <option key={i} value={i}>{hdOptionText(t)}</option>)}
              </select>
            </Field>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 18 }}>
            {okMsg && <span style={{ fontSize: 12, color: '#5ABF80', fontWeight: 700 }}>{okMsg}</span>}
            <button disabled={!canSubmit || saving} onClick={submit}
              style={{ background: ACCENT, color: '#06121f', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 800, cursor: canSubmit && !saving ? 'pointer' : 'not-allowed', opacity: canSubmit && !saving ? 1 : 0.5 }}>
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
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
              <div key={r.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
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
