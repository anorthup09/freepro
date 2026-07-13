import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api.js';
import { maybeMailNotice } from '../utils/mailNotice.js';
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

const DEPTS = [
  ['camera', 'Camera'], ['grip', 'Grip'], ['electric', 'Electric'],
  ['audio', 'Audio'], ['media_management', 'Media Management'], ['editing', 'Editing'],
];
const DEPT_LABEL = Object.fromEntries(DEPTS);

const MOVING_OPTS = ['Flying', 'Local/Driving', 'In-house (not moving)'];
const DRIVE_OPTS = ['Editing Drive', 'SSD', 'No, I do not need a drive provided to me.'];
const SIZE_OPTS = ['1TB', '2TB', '4TB', 'MORE'];

const areaStyle = { background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'8px 10px', fontSize:13, width:'100%', minHeight:64, fontFamily:'inherit' };
const inStyle = { ...areaStyle, minHeight:0 };
const lbl = { fontSize:11, fontWeight:600, color:'var(--text)', display:'block', marginBottom:5, textTransform:'none', letterSpacing:'normal', textAlign:'left' };
const req = <span style={{ color:'#e05252' }}>{'\u00A0'}*</span>;

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
      {Array.isArray(r.items) && r.items.length > 0 ? (
        DEPTS.map(([k, label]) => {
          const list = r.items.filter(i => i.category === k);
          if (!list.length) return null;
          return row(label, list.map(i => `${i.qty} × ${i.name}`).join('\n'), true);
        })
      ) : (
        <>
          {row('Camera gear & accessories', r.camera, true)}
          {row('Lights & light peripherals', r.lights, true)}
          {row('Grip', r.grip, true)}
          {row('Other', r.other, true)}
        </>
      )}
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

// Inventory picker window: equipment MODELS for one department (assets deduped
// by name — six C70s show once), with qty steppers and a custom-item row.
function InventoryPicker({ dept, inventory, qtyOf, setQty, onClose }) {
  const [q, setQ] = useState('');
  const [custom, setCustom] = useState('');
  const list = (inventory || []).filter(m => m.dept === dept)
    .filter(m => !q.trim() || m.name.toLowerCase().includes(q.trim().toLowerCase()));
  const stepBtn = { width:24, height:24, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontWeight:800, cursor:'pointer', fontSize:13, lineHeight:1 };
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:260, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid var(--orange)', borderRadius:12, width:'100%', maxWidth:560, maxHeight:'82vh', display:'flex', flexDirection:'column', padding:'18px 20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ fontSize:15, fontWeight:800 }}>{DEPT_LABEL[dept]} — Equipment Inventory</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Done</button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search equipment…" style={{ marginBottom:8 }} autoFocus />
        <div style={{ overflowY:'auto', flex:1, border:'1px solid var(--border)', borderRadius:8 }}>
          {inventory === null && <div style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)' }}>Loading inventory…</div>}
          {list.map(m => {
            const n = qtyOf(dept, m.name);
            return (
              <div key={m.name} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', background: n > 0 ? 'rgba(232,80,10,0.07)' : 'transparent' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight: n > 0 ? 700 : 500 }}>{m.name}</div>
                  <div style={{ fontSize:9, color:'var(--muted)' }}>{m.available} of {m.total} available · {m.category}</div>
                </div>
                <button type="button" style={stepBtn} onClick={() => setQty(dept, m.name, Math.max(0, n - 1))}>−</button>
                <span style={{ width:22, textAlign:'center', fontSize:13, fontWeight:800, color: n > 0 ? 'var(--orange)' : 'var(--muted)' }}>{n}</span>
                <button type="button" style={stepBtn} onClick={() => setQty(dept, m.name, n + 1)}>+</button>
              </div>
            );
          })}
          {inventory !== null && list.length === 0 && <div style={{ padding:'10px 14px', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>Nothing in the inventory matches.</div>}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Not in the inventory? Type it here…" style={{ flex:1 }}
            onKeyDown={e => { if (e.key === 'Enter' && custom.trim()) { setQty(dept, custom.trim(), qtyOf(dept, custom.trim()) + 1); setCustom(''); e.preventDefault(); } }} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { if (custom.trim()) { setQty(dept, custom.trim(), qtyOf(dept, custom.trim()) + 1); setCustom(''); } }}>Add</button>
        </div>
      </div>
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
  const [items, setItems] = useState([]);          // [{category, name, qty}]
  const [inventory, setInventory] = useState(null); // asset models by department
  const [pickerDept, setPickerDept] = useState(null);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const setQty = (category, name, qty) => setItems(prev => {
    const next = prev.filter(i => !(i.category === category && i.name === name));
    return qty > 0 ? [...next, ...(prev.some(i => i.category === category && i.name === name)
      ? [{ ...prev.find(i => i.category === category && i.name === name), qty }]
      : [{ category, name, qty }])].sort((a, b) => a.name.localeCompare(b.name)) : next;
  });
  const qtyOf = (category, name) => items.find(i => i.category === category && i.name === name)?.qty || 0;
  const isView = !!existing && !amending;
  const showForm = !existing || amending;

  useEffect(() => {
    if (showForm) {
      api.gearRequestProjects().then(setProjects).catch(() => setProjects([]));
      api.getCrew().then(setCrew).catch(() => {});
      api.gearInventory().then(setInventory).catch(() => setInventory([]));
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
    setItems(Array.isArray(existing.items) ? existing.items : []);
    setAmending(true);
  }

  const ok = f.projectId && f.name && f.crew && f.checkOut && f.checkIn && f.moving && f.drives.length > 0;

  async function submit() {
    if (!ok || saving) return;
    setSaving(true);
    try {
      const payload = { ...f, items };
      const r = amending
        ? await api.amendGearRequest(existing.project_id, payload)
        : await api.createGearRequest(payload);
      maybeMailNotice(amending ? 'The amendment report email to the gear team' : 'The gear request email to the gear team');
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
              <label style={lbl}>7. What gear do you need, by department? <span style={{ color:'var(--muted)', fontWeight:400 }}>Pick from the equipment inventory — set how many of each.</span></label>
              {DEPTS.map(([k, label]) => {
                const deptItems = items.filter(i => i.category === k);
                return (
                  <div key={k} style={{ border:'1px solid var(--border)', borderRadius:8, padding:'8px 12px', marginBottom:6 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                      <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.05em', color: deptItems.length ? 'var(--orange)' : 'var(--muted)' }}>
                        {label}{deptItems.length > 0 && <span style={{ fontWeight:600 }}> · {deptItems.reduce((s2, i) => s2 + Number(i.qty), 0)} item{deptItems.reduce((s2, i) => s2 + Number(i.qty), 0) !== 1 ? 's' : ''}</span>}
                      </div>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding:'2px 10px', fontSize:10 }} onClick={() => setPickerDept(k)}>+ Add Gear</button>
                    </div>
                    {deptItems.length > 0 && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                        {deptItems.map(i => (
                          <span key={i.name} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(232,80,10,0.12)', border:'1px solid rgba(232,80,10,0.5)', color:'var(--text)', borderRadius:12, padding:'2px 9px', fontSize:11 }}>
                            <b style={{ color:'var(--orange)' }}>{i.qty}×</b> {i.name}
                            <span onClick={() => setQty(k, i.name, 0)} style={{ cursor:'pointer', color:'var(--muted)', fontWeight:800 }}>✕</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {pickerDept && (
              <InventoryPicker dept={pickerDept} inventory={inventory} qtyOf={qtyOf} setQty={setQty} onClose={() => setPickerDept(null)} />
            )}
            <div>
              <label style={lbl}>8. Do you need media drives provided? (Select all that apply){req}</label>
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
                <label style={lbl}>9. If drives are needed, what size?</label>
                <select style={inStyle} value={f.driveSize} onChange={set('driveSize')}>
                  <option value="">—</option>
                  {SIZE_OPTS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ flex:1, minWidth:160 }}>
                <label style={lbl}>10. And how many drives?</label>
                <input style={inStyle} value={f.driveQty} onChange={set('driveQty')} />
              </div>
            </div>
            <div>
              <label style={lbl}>11. Anything else that needs to be known for this shoot? Any special instructions?</label>
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
