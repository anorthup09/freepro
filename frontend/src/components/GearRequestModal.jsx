import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

const isUnbridled = m => (m.company || '').toLowerCase().includes('unbridled');
const crewName = m => [m.preferred_first_name, m.preferred_last_name].filter(Boolean).join(' ').trim() || m.name || '';

// Multi-select of Unbridled crew stored as a comma-joined string
function CrewMultiSelect({ value, onChange, crew }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tags = String(value || '').split(',').map(s => s.trim()).filter(Boolean);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const add = n => { if (!tags.some(t => t.toLowerCase() === n.toLowerCase())) onChange([...tags, n].join(', ')); setQ(''); };
  const remove = n => onChange(tags.filter(t => t !== n).join(', '));
  const matches = crew.filter(isUnbridled).map(crewName).filter(Boolean)
    .filter(n => !tags.some(t => t.toLowerCase() === n.toLowerCase()))
    .filter(n => !q.trim() || n.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 7px', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', minHeight: 40 }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(232,80,10,0.16)', border: '1px solid var(--orange)', color: 'var(--orange)', borderRadius: 12, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            {t}<span onClick={() => remove(t)} style={{ cursor: 'pointer', fontWeight: 800 }}>✕</span>
          </span>
        ))}
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={tags.length ? '' : 'Select Unbridled crew…'}
          style={{ flex: 1, minWidth: 100, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13 }} />
      </div>
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
          {matches.slice(0, 30).map(n => (
            <div key={n} onMouseDown={() => add(n)} style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{n}</div>
          ))}
        </div>
      )}
    </div>
  );
}

const MOVING_OPTS = ['Flying', 'Local/Driving', 'In-house (not moving)'];
const DRIVE_OPTS = ['Editing Drive', 'SSD', 'No, I do not need a drive provided to me.'];
const SIZE_OPTS = ['1TB', '2TB', '4TB', 'MORE'];

const areaStyle = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'8px 10px', fontSize:13, width:'100%', minHeight:64, fontFamily:'inherit' };
const inStyle = { ...areaStyle, minHeight:0 };
const lbl = { fontSize:11, fontWeight:600, color:'var(--text)', display:'block', marginBottom:5, textTransform:'none', letterSpacing:'normal', textAlign:'left' };
const req = <span style={{ color:'#e05252' }}> *</span>;

function fmtDate(d) {
  if (!d) return '—';
  return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString();
}

// Read-only rendering of a submitted request
export function GearRequestView({ r }) {
  const row = (label, value, pre) => (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:13, whiteSpace: pre ? 'pre-wrap' : 'normal' }}>{value || '—'}</div>
    </div>
  );
  return (
    <div>
      <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:160 }}>{row('Submitted by', r.name)}</div>
        <div style={{ flex:1, minWidth:160 }}>{row('Check-Out', fmtDate(r.check_out))}</div>
        <div style={{ flex:1, minWidth:160 }}>{row('Check-In', fmtDate(r.check_in))}</div>
      </div>
      {row('Who from Media is traveling with gear', r.crew, true)}
      {row('How is this gear moving', r.moving)}
      {row('Camera gear & accessories', r.camera, true)}
      {row('Lights & light peripherals', r.lights, true)}
      {row('Grip', r.grip, true)}
      {row('Other', r.other, true)}
      <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
        <div style={{ flex:2, minWidth:180 }}>{row('Media drives', r.drives)}</div>
        <div style={{ flex:1, minWidth:100 }}>{row('Drive size', r.drive_size)}</div>
        <div style={{ flex:1, minWidth:100 }}>{row('How many', r.drive_qty)}</div>
      </div>
      {row('Special instructions', r.notes, true)}
      <div style={{ fontSize:10, color:'var(--muted)' }}>Submitted {r.created_at ? new Date(r.created_at).toLocaleString() : ''}{r.submitted_by ? ` · ${r.submitted_by}` : ''}</div>
    </div>
  );
}

// Modal: shows the submitted request read-only, or the form to submit one.
// Props: projectId (optional — locks the project dropdown), existing (request row or null), onClose, onSubmitted
export default function GearRequestModal({ projectId, existing, onClose, onSubmitted, embedded }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [crew, setCrew] = useState([]);
  const [amending, setAmending] = useState(false);
  const [f, setF] = useState({
    projectId: projectId || '', name: user?.name || '', crew: '', checkOut: '', checkIn: '',
    moving: '', camera: '', lights: '', grip: '', other: '',
    drives: [], driveSize: '', driveQty: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const isView = !!existing && !amending;
  const showForm = !existing || amending;

  useEffect(() => {
    if (showForm) {
      api.gearRequestProjects().then(setProjects).catch(() => setProjects([]));
      api.getCrew().then(setCrew).catch(() => {});
    }
  }, [showForm]);

  // "Your name" carries the account's FULL name. The account name may be just a
  // first name, so resolve first + last from the crew roster by email; if there's
  // no roster match, fall back to whatever the account has.
  const myFullName = () => {
    const me = user?.email ? crew.find(m => (m.email || '').toLowerCase() === user.email.toLowerCase()) : null;
    return (me && crewName(me)) || user?.name || '';
  };
  useEffect(() => {
    if (!crew.length) return;
    const full = myFullName();
    if (full) setF(v => (!v.name || v.name === user?.name ? { ...v, name: full } : v));
  }, [crew, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill the form from the existing request when amending
  function startAmend() {
    setF({
      projectId: existing.project_id || projectId || '',
      name: myFullName() || existing.name || '',
      crew: existing.crew || '',
      checkOut: existing.check_out ? String(existing.check_out).slice(0, 10) : '',
      checkIn: existing.check_in ? String(existing.check_in).slice(0, 10) : '',
      moving: existing.moving || '',
      camera: existing.camera || '', lights: existing.lights || '', grip: existing.grip || '', other: existing.other || '',
      drives: String(existing.drives || '').split(',').map(s => s.trim()).filter(Boolean),
      driveSize: existing.drive_size || '', driveQty: existing.drive_qty || '', notes: existing.notes || '',
    });
    setAmending(true);
  }

  const ok = f.projectId && f.name && f.crew && f.checkOut && f.checkIn && f.moving && f.drives.length > 0;

  async function submit() {
    if (!ok || saving) return;
    setSaving(true);
    try {
      const r = amending
        ? await api.amendGearRequest(existing.project_id, f)
        : await api.createGearRequest(f);
      onSubmitted && onSubmitted(r);
      if (amending && embedded) { setAmending(false); setSaving(false); return; }
      onClose();
    } catch (e) { alert(e.message); setSaving(false); }
  }

  function toggleDrive(opt) {
    setF(v => ({ ...v, drives: v.drives.includes(opt) ? v.drives.filter(x => x !== opt) : [...v.drives, opt] }));
  }

  const inner = (
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid var(--orange)', borderRadius:12, padding:'22px 26px', width:'100%', maxWidth:640 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, gap:10 }}>
          <div style={{ fontSize:17, fontWeight:800 }}>
            {amending ? 'Amend Gear Request' : 'Gear Request'}
            {isView ? <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:10, padding:'2px 8px', marginLeft:10, verticalAlign:'middle' }}>🔒 Submitted</span> : null}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {isView && <button onClick={startAmend}
              style={{ background:'rgba(232,80,10,0.14)', border:'1px solid var(--orange)', color:'var(--orange)', borderRadius:14, padding:'4px 12px', fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
              Amend Gear Request
            </button>}
            {!embedded && <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
          </div>
        </div>
        {isView ? (
          <>
            {(existing.code || existing.title) && <div style={{ fontSize:11, color:'var(--muted)', marginBottom:16 }}>{existing.code} · {existing.title}</div>}
            <GearRequestView r={existing} />
          </>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:10 }}>
            {amending && <div style={{ fontSize:11, color:'var(--muted)' }}>Update the request below. On submit, a change report (what's added and removed) is posted to the gear activity feed.</div>}
            <div>
              <label style={lbl}>1. Your name?{req}</label>
              <input style={{ ...inStyle, opacity:0.85 }} value={f.name} onChange={set('name')} readOnly />
            </div>
            <div>
              <label style={lbl}>2. Who from Media is traveling with gear for this shoot?{req}</label>
              <CrewMultiSelect value={f.crew} onChange={val => setF(v => ({ ...v, crew: val }))} crew={crew} />
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:180 }}>
                <label style={lbl}>3. Check-Out Date (taking gear from Saint Louis office){req}</label>
                <input type="date" style={inStyle} value={f.checkOut} onChange={set('checkOut')} />
              </div>
              <div style={{ flex:1, minWidth:180 }}>
                <label style={lbl}>4. Check-In Date (bringing it in for return){req}</label>
                <input type="date" style={inStyle} value={f.checkIn} onChange={set('checkIn')} />
              </div>
            </div>
            <div>
              <label style={lbl}>5. What is the Project Code/Client?{req}</label>
              <select style={inStyle} value={f.projectId} onChange={set('projectId')} disabled={!!projectId}>
                <option value="">{projects === null ? 'Loading…' : '— Select a project code —'}</option>
                {(projects || []).map(p => <option key={p.id} value={p.id}>{p.code} — {p.client} · {p.title}</option>)}
                {projectId && !(projects || []).some(p => p.id === projectId) && <option value={projectId}>This project</option>}
              </select>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>Only project codes without a gear request are listed.</div>
            </div>
            <div>
              <label style={lbl}>6. How is this gear moving?{req}</label>
              {MOVING_OPTS.map(opt => (
                <div key={opt} onClick={() => setF(v => ({ ...v, moving: opt }))}
                  style={{ display:'flex', alignItems:'center', justifyContent:'flex-start', gap:8, fontSize:13, padding:'3px 0', cursor:'pointer', color:'var(--text)' }}>
                  <input type="radio" name="moving" checked={f.moving === opt} onChange={() => setF(v => ({ ...v, moving: opt }))} style={{ width:'auto', margin:0, flexShrink:0 }} />
                  <span>{opt}</span>
                </div>
              ))}
            </div>
            <div>
              <label style={lbl}>7. Camera Gear and Camera Accessories needed? <span style={{ color:'var(--muted)', fontWeight:400 }}>(one item per line, e.g. 3x c70kits ⏎ 3x 5" Monitor ⏎ 2x 24-70mm)</span></label>
              <textarea style={areaStyle} value={f.camera} onChange={set('camera')} />
            </div>
            <div>
              <label style={lbl}>8. Lights and Light Peripherals? <span style={{ color:'var(--muted)', fontWeight:400 }}>Same format.</span></label>
              <textarea style={areaStyle} value={f.lights} onChange={set('lights')} />
            </div>
            <div>
              <label style={lbl}>9. Grip? <span style={{ color:'var(--muted)', fontWeight:400 }}>Same format.</span></label>
              <textarea style={areaStyle} value={f.grip} onChange={set('grip')} />
            </div>
            <div>
              <label style={lbl}>10. Other? <span style={{ color:'var(--muted)', fontWeight:400 }}>Same format.</span></label>
              <textarea style={areaStyle} value={f.other} onChange={set('other')} />
            </div>
            <div>
              <label style={lbl}>11. Do you need media drives provided? (Select all that apply){req}</label>
              {DRIVE_OPTS.map(opt => (
                <div key={opt} onClick={() => toggleDrive(opt)}
                  style={{ display:'flex', alignItems:'center', justifyContent:'flex-start', gap:8, fontSize:13, padding:'3px 0', cursor:'pointer', color:'var(--text)' }}>
                  <input type="checkbox" checked={f.drives.includes(opt)} onChange={() => toggleDrive(opt)} style={{ width:'auto', margin:0, flexShrink:0 }} />
                  <span>{opt}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:160 }}>
                <label style={lbl}>12. If drives are needed, what size?</label>
                <select style={inStyle} value={f.driveSize} onChange={set('driveSize')}>
                  <option value="">—</option>
                  {SIZE_OPTS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ flex:1, minWidth:160 }}>
                <label style={lbl}>13. And how many drives?</label>
                <input style={inStyle} value={f.driveQty} onChange={set('driveQty')} />
              </div>
            </div>
            <div>
              <label style={lbl}>14. Anything else that needs to be known for this shoot? Any special instructions?</label>
              <textarea style={areaStyle} value={f.notes} onChange={set('notes')} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => amending ? setAmending(false) : onClose()}>Cancel</button>
              <button disabled={!ok || saving} onClick={submit}
                style={{ background: ok ? 'var(--orange)' : 'var(--border)', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontSize:12, fontWeight:800, cursor: ok ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Submitting…' : amending ? 'Submit Amendment' : 'Submit Gear Request'}
              </button>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) return inner;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:120, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', overflowY:'auto' }}>
      {inner}
    </div>
  );
}
