import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

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
  const [projects, setProjects] = useState(null);
  const [f, setF] = useState({
    projectId: projectId || '', name: '', crew: '', checkOut: '', checkIn: '',
    moving: '', camera: '', lights: '', grip: '', other: '',
    drives: [], driveSize: '', driveQty: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  const isView = !!existing;

  useEffect(() => {
    if (!isView) api.gearRequestProjects().then(setProjects).catch(() => setProjects([]));
  }, [isView]);

  const ok = f.projectId && f.name && f.crew && f.checkOut && f.checkIn && f.moving && f.drives.length > 0;

  async function submit() {
    if (!ok || saving) return;
    setSaving(true);
    try {
      const r = await api.createGearRequest(f);
      onSubmitted && onSubmitted(r);
      onClose();
    } catch (e) { alert(e.message); setSaving(false); }
  }

  function toggleDrive(opt) {
    setF(v => ({ ...v, drives: v.drives.includes(opt) ? v.drives.filter(x => x !== opt) : [...v.drives, opt] }));
  }

  const inner = (
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid var(--orange)', borderRadius:12, padding:'22px 26px', width:'100%', maxWidth:640 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontSize:17, fontWeight:800 }}>Gear Request{isView ? <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', border:'1px solid var(--border)', borderRadius:10, padding:'2px 8px', marginLeft:10, verticalAlign:'middle' }}>🔒 Submitted</span> : null}</div>
          {!embedded && <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
        </div>
        {isView ? (
          <>
            {(existing.code || existing.title) && <div style={{ fontSize:11, color:'var(--muted)', marginBottom:16 }}>{existing.code} · {existing.title}</div>}
            <GearRequestView r={existing} />
          </>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14, marginTop:10 }}>
            <div>
              <label style={lbl}>1. Your name?{req}</label>
              <input style={inStyle} value={f.name} onChange={set('name')} />
            </div>
            <div>
              <label style={lbl}>2. Who from Media is traveling with gear for this shoot? (name crew){req}</label>
              <textarea style={areaStyle} value={f.crew} onChange={set('crew')} />
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
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button disabled={!ok || saving} onClick={submit}
                style={{ background: ok ? 'var(--orange)' : 'var(--border)', color:'#fff', border:'none', borderRadius:8, padding:'9px 20px', fontSize:12, fontWeight:800, cursor: ok ? 'pointer' : 'default', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Submitting…' : 'Submit Gear Request'}
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
