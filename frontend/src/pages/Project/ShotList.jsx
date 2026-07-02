import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../api.js';

const MOVEMENTS = ['Static', 'Pan', 'Tilt', 'Dolly', 'Handheld', 'Crane', 'Zoom', 'Gimbal'];
const COVERAGES = ['Interview', 'B-Roll'];

const SCENE_TYPE_STYLES = {
  interior: { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.4)', badge: 'rgba(96,165,250,0.18)', badgeText: '#60a5fa', label: 'INT.' },
  exterior: { bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.4)', badge: 'rgba(74,222,128,0.15)', badgeText: '#4ade80', label: 'EXT.' },
};

function shotLabel(sceneNumber, index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${sceneNumber}${letters[index] || index}`;
}

function calcWrapTime(startTime, shots) {
  if (!startTime) return null;
  const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let [, h, m, meridiem] = match;
  h = parseInt(h); m = parseInt(m);
  if (meridiem.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
  const totalStart = h * 60 + m;
  const shotMins = shots.reduce((s, sh) => s + (sh.est_minutes || 0), 0);
  const totalEnd = totalStart + shotMins;
  const endH = Math.floor(totalEnd / 60) % 24;
  const endM = totalEnd % 60;
  const period = endH >= 12 ? 'PM' : 'AM';
  const displayH = endH % 12 || 12;
  return `${displayH}:${String(endM).padStart(2, '0')} ${period}`;
}

// ── Shot Detail Modal ─────────────────────────────────────────────────────────
function ShotDetailModal({ shot, sceneNumber, index, projectId, talent, onUpdate, onClose }) {
  const [form, setForm] = useState({
    angle: shot.angle || '',
    lens: shot.lens || '',
    frameRate: shot.frame_rate || '',
    coverage: shot.coverage || '',
    talentTags: shot.talent_tags || [],
    specialEquipment: shot.special_equipment || '',
    audioNotes: shot.audio_notes || '',
    setupMinutes: shot.setup_minutes ?? 0,
    takesCount: shot.takes_count ?? 1,
    takeMinutes: shot.take_minutes ?? 0,
    bufferMinutes: shot.buffer_minutes ?? 2,
  });
  const [saving, setSaving] = useState(false);

  const totalTime = Number(form.setupMinutes || 0) + (Number(form.takesCount || 0) * Number(form.takeMinutes || 0)) + Number(form.bufferMinutes || 0);

  function toggleTalent(name) {
    setForm(f => {
      const tags = f.talentTags.includes(name) ? f.talentTags.filter(t => t !== name) : [...f.talentTags, name];
      return { ...f, talentTags: tags };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const payload = {
        ...form,
        estMinutes: totalTime || null,
      };
      const updated = await api.updateShot(projectId, shot.id, payload);
      onUpdate(updated);
      onClose();
    } catch(e) { alert(e.message); }
    setSaving(false);
  }

  const label = shotLabel(sceneNumber, index);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width:'100%' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--orange)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:3 }}>Shot {label}</div>
            <div className="modal-title" style={{ margin:0 }}>{shot.description || 'Shot Details'}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:18, cursor:'pointer', padding:4 }}>✕</button>
        </div>

        {/* Shot details */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
          <div className="field">
            <label>Angle</label>
            <input value={form.angle} onChange={e => setForm(f => ({...f, angle: e.target.value}))} placeholder="e.g. Eye level, Low angle" />
          </div>
          <div className="field">
            <label>Lens</label>
            <input value={form.lens} onChange={e => setForm(f => ({...f, lens: e.target.value}))} placeholder="e.g. 24mm, 85mm" />
          </div>
          <div className="field">
            <label>Frame Rate</label>
            <input value={form.frameRate} onChange={e => setForm(f => ({...f, frameRate: e.target.value}))} placeholder="e.g. 24fps, 60fps" />
          </div>
          <div className="field">
            <label>Coverage</label>
            <select value={form.coverage} onChange={e => setForm(f => ({...f, coverage: e.target.value}))}>
              <option value="">— Select —</option>
              {COVERAGES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field span2">
            <label>Special Equipment</label>
            <input value={form.specialEquipment} onChange={e => setForm(f => ({...f, specialEquipment: e.target.value}))} placeholder="e.g. Gimbal, Drone, Slider" />
          </div>
          <div className="field span2">
            <label>Audio</label>
            <input value={form.audioNotes} onChange={e => setForm(f => ({...f, audioNotes: e.target.value}))} placeholder="e.g. Lav mic, Boom, No audio" />
          </div>
        </div>

        {/* Talent tags */}
        {talent.length > 0 && (
          <div className="field" style={{ marginBottom:16 }}>
            <label>Talent</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {talent.map(t => {
                const name = t.name;
                const active = form.talentTags.includes(name);
                return (
                  <button key={name} type="button" onClick={() => toggleTalent(name)}
                    style={{ padding:'4px 10px', borderRadius:100, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active ? 'var(--orange)' : 'var(--border)'}`, background: active ? 'rgba(251,146,60,0.15)' : 'var(--bg2)', color: active ? 'var(--orange)' : 'var(--muted)', transition:'all 0.15s' }}>
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Timing breakdown */}
        <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:18 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:12 }}>Timing Breakdown</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="field" style={{ margin:0 }}>
              <label style={{ fontSize:10 }}>Setup</label>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="number" min="0" value={form.setupMinutes} onChange={e => setForm(f => ({...f, setupMinutes: e.target.value}))}
                  style={{ width:60 }} />
                <span style={{ fontSize:12, color:'var(--muted)' }}>min</span>
              </div>
            </div>
            <div className="field" style={{ margin:0 }}>
              <label style={{ fontSize:10 }}>Buffer</label>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <input type="number" min="0" value={form.bufferMinutes} onChange={e => setForm(f => ({...f, bufferMinutes: e.target.value}))}
                  style={{ width:60 }} />
                <span style={{ fontSize:12, color:'var(--muted)' }}>min</span>
              </div>
            </div>
            <div className="field span2" style={{ margin:0 }}>
              <label style={{ fontSize:10 }}>Takes</label>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="number" min="1" value={form.takesCount} onChange={e => setForm(f => ({...f, takesCount: e.target.value}))}
                  style={{ width:60 }} placeholder="1" />
                <span style={{ fontSize:12, color:'var(--muted)' }}>takes ×</span>
                <input type="number" min="0" value={form.takeMinutes} onChange={e => setForm(f => ({...f, takeMinutes: e.target.value}))}
                  style={{ width:60 }} placeholder="0" />
                <span style={{ fontSize:12, color:'var(--muted)' }}>min each</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop:12, paddingTop:10, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Total Time</span>
            <span style={{ fontSize:18, fontWeight:800, color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>{totalTime} <span style={{ fontSize:12, fontWeight:500, color:'var(--muted)' }}>min</span></span>
          </div>
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Shot Row ──────────────────────────────────────────────────────────────────
function ShotRow({ shot, index, sceneNumber, projectId, onUpdate, onDelete, accentColor, expanded, onOpenDetail }) {
  const captured = shot.status === 'captured';
  const [desc, setDesc] = useState(shot.description || '');
  const [movement, setMovement] = useState(shot.movement || '');
  const [estMinutes, setEstMinutes] = useState(shot.est_minutes || '');

  // Keep local state in sync if parent updates the shot (e.g. after detail save)
  useEffect(() => { setDesc(shot.description || ''); }, [shot.description]);
  useEffect(() => { setMovement(shot.movement || ''); }, [shot.movement]);
  useEffect(() => { setEstMinutes(shot.est_minutes || ''); }, [shot.est_minutes]);

  async function save(field, value) {
    try {
      const updated = await api.updateShot(projectId, shot.id, { [field]: value || null });
      onUpdate(updated);
    } catch {}
  }

  async function toggleCapture() {
    const status = captured ? 'not_captured' : 'captured';
    const updated = await api.updateShot(projectId, shot.id, { status });
    onUpdate(updated);
  }

  const rowStyle = {
    borderBottom: expanded ? 'none' : '1px solid var(--border)',
    background: captured ? 'rgba(15,15,12,0.6)' : 'transparent',
    outline: captured ? 'none' : `1px solid ${accentColor}55`,
    outlineOffset: '-1px',
    opacity: captured ? 0.4 : 1,
    transition: 'background 0.2s, opacity 0.2s',
  };

  return (
    <>
      <tr style={rowStyle}>
        <td style={{ padding:'10px 10px 10px 14px', width:32 }}>
          <div onClick={toggleCapture} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${captured ? '#4ade80' : accentColor}`, background: captured ? '#4ade80' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
            {captured && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </td>
        <td style={{ padding:'10px 8px', fontSize:13, fontWeight:700, color: captured ? 'var(--muted)' : accentColor, whiteSpace:'nowrap', width:44, cursor:'pointer' }}
          onClick={() => onOpenDetail(shot, index)}>
          {shotLabel(sceneNumber, index)}
        </td>
        <td style={{ padding:'6px 8px' }}>
          <input value={desc} onChange={e => setDesc(e.target.value)}
            onBlur={() => { if (desc !== (shot.description || '')) save('description', desc); }}
            placeholder="Shot description…"
            style={{ width:'100%', background:'transparent', border:'none', outline:'none', color: captured ? 'var(--muted)' : 'var(--text)', fontSize:13, fontFamily:'inherit', padding:0 }} />
        </td>
        <td style={{ padding:'6px 8px', width:130 }}>
          <select value={movement} onChange={e => { setMovement(e.target.value); save('movement', e.target.value); }}
            style={{ background:'transparent', border:'none', outline:'none', color: movement ? (captured ? 'var(--muted)' : 'var(--text)') : 'var(--muted)', fontSize:13, fontFamily:'inherit', cursor:'pointer', padding:0, width:'100%' }}>
            <option value="">— Movement —</option>
            {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </td>
        <td style={{ padding:'6px 8px', width:80 }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" min="1" value={estMinutes} onChange={e => setEstMinutes(e.target.value)}
              onBlur={() => { if (String(estMinutes) !== String(shot.est_minutes || '')) save('estMinutes', estMinutes ? Number(estMinutes) : null); }}
              placeholder="min"
              style={{ width:40, background:'transparent', border:'none', outline:'none', color: captured ? 'var(--muted)' : 'var(--text)', fontSize:13, fontFamily:'inherit', padding:0, MozAppearance:'textfield' }} />
            {estMinutes && <span style={{ fontSize:11, color:'var(--muted)' }}>m</span>}
          </div>
        </td>
        <td style={{ padding:'10px 14px 10px 4px', width:52, textAlign:'right', whiteSpace:'nowrap' }}>
          <button onClick={() => onOpenDetail(shot, index)}
            title="Shot details"
            style={{ background:'none', border:'none', color: accentColor, cursor:'pointer', fontSize:11, padding:'2px 4px', opacity:0.7 }}>⋯</button>
          <button onClick={() => onDelete(shot.id)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:13, padding:0, lineHeight:1, opacity:0.4 }}>✕</button>
        </td>
      </tr>
      {/* Expanded detail row */}
      {expanded && (
        <tr style={{ borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,0.02)' }}>
          <td colSpan={6} style={{ padding:'8px 14px 12px 60px' }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 24px', fontSize:11 }}>
              {shot.angle && <span><span style={{ color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontSize:10 }}>Angle </span><span style={{ color:'var(--text)' }}>{shot.angle}</span></span>}
              {shot.lens && <span><span style={{ color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontSize:10 }}>Lens </span><span style={{ color:'var(--text)' }}>{shot.lens}</span></span>}
              {shot.frame_rate && <span><span style={{ color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontSize:10 }}>FPS </span><span style={{ color:'var(--text)' }}>{shot.frame_rate}</span></span>}
              {shot.coverage && <span><span style={{ color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontSize:10 }}>Coverage </span><span style={{ color:'var(--text)' }}>{shot.coverage}</span></span>}
              {shot.special_equipment && <span><span style={{ color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontSize:10 }}>Equip </span><span style={{ color:'var(--text)' }}>{shot.special_equipment}</span></span>}
              {shot.audio_notes && <span><span style={{ color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontSize:10 }}>Audio </span><span style={{ color:'var(--text)' }}>{shot.audio_notes}</span></span>}
              {(shot.talent_tags || []).length > 0 && <span><span style={{ color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontSize:10 }}>Talent </span><span style={{ color:'var(--text)' }}>{shot.talent_tags.join(', ')}</span></span>}
              {(shot.setup_minutes || shot.takes_count) ? (
                <span><span style={{ color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', fontSize:10 }}>Timing </span>
                  <span style={{ color:'var(--text)' }}>
                    {shot.setup_minutes ? `${shot.setup_minutes}m setup` : ''}
                    {shot.takes_count && shot.take_minutes ? ` · ${shot.takes_count}×${shot.take_minutes}m takes` : ''}
                    {shot.buffer_minutes ? ` · ${shot.buffer_minutes}m buffer` : ''}
                  </span>
                </span>
              ) : null}
            </div>
            {!shot.angle && !shot.lens && !shot.frame_rate && !shot.coverage && !shot.special_equipment && !shot.audio_notes && !(shot.talent_tags||[]).length && (
              <span style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No details yet — click ⋯ to add</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ── New Shot Row ──────────────────────────────────────────────────────────────
function NewShotRow({ sceneNumber, nextIndex, projectId, sceneId, onAdded, accentColor }) {
  const [desc, setDesc] = useState('');
  const [movement, setMovement] = useState('');
  const [estMinutes, setEstMinutes] = useState('');
  const [saving, setSaving] = useState(false);
  const descRef = useRef(null);

  async function submit() {
    if (!desc.trim() || saving) return;
    setSaving(true);
    try {
      const shot = await api.createShot(projectId, sceneId, { description: desc, movement: movement || null, estMinutes: estMinutes ? Number(estMinutes) : 9 });
      onAdded(shot);
      setDesc(''); setMovement(''); setEstMinutes('');
      descRef.current?.focus();
    } catch {}
    setSaving(false);
  }

  return (
    <tr style={{ borderBottom:'1px solid var(--border)', opacity: saving ? 0.5 : 1 }}>
      <td style={{ padding:'10px 10px 10px 14px', width:32 }}>
        <div style={{ width:16, height:16, borderRadius:4, border:'2px solid var(--border)' }} />
      </td>
      <td style={{ padding:'10px 8px', fontSize:13, fontWeight:700, color: accentColor ? `${accentColor}66` : 'var(--muted)', width:44 }}>
        {shotLabel(sceneNumber, nextIndex)}
      </td>
      <td style={{ padding:'6px 8px' }}>
        <input ref={descRef} value={desc} onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), submit())}
          onBlur={submit} placeholder="Add a shot…"
          style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13, fontFamily:'inherit', padding:0 }} />
      </td>
      <td style={{ padding:'6px 8px', width:130 }}>
        <select value={movement} onChange={e => setMovement(e.target.value)}
          style={{ background:'transparent', border:'none', outline:'none', color: movement ? 'var(--text)' : 'var(--muted)', fontSize:13, fontFamily:'inherit', cursor:'pointer', padding:0, width:'100%' }}>
          <option value="">— Movement —</option>
          {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td style={{ padding:'6px 8px', width:80 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <input type="number" min="1" value={estMinutes} onChange={e => setEstMinutes(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), submit())}
            placeholder="min"
            style={{ width:40, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13, fontFamily:'inherit', padding:0, MozAppearance:'textfield' }} />
          {estMinutes && <span style={{ fontSize:11, color:'var(--muted)' }}>m</span>}
        </div>
      </td>
      <td style={{ width:52 }} />
    </tr>
  );
}

// ── Scene Block ───────────────────────────────────────────────────────────────
function SceneBlock({ scene, projectId, talent, onShotUpdate, onShotAdded, onShotDelete, onEditScene, onDeleteScene, onStartTimeChange, onOpenDetail }) {
  const st = SCENE_TYPE_STYLES[scene.scene_type] || SCENE_TYPE_STYLES.interior;
  const [startTime, setStartTime] = useState(scene.est_start_time || '');
  const [expanded, setExpanded] = useState(false);
  const wrapTime = calcWrapTime(startTime, scene.shots);

  async function saveStartTime(val) {
    try {
      await api.updateScene(projectId, scene.id, { estStartTime: val || null });
      onStartTimeChange(scene.id, val);
    } catch {}
  }

  return (
    <div style={{ background:'var(--bg2)', border:`1px solid ${st.border}`, borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      {/* Scene header */}
      <div style={{ padding:'14px 20px', background: st.bg, borderBottom:`1px solid ${st.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:10, fontWeight:800, color: st.badgeText, textTransform:'uppercase', letterSpacing:'.1em', background: st.badge, border:`1px solid ${st.border}`, borderRadius:4, padding:'2px 8px' }}>
            {st.label} · Scene {scene.scene_number}
          </span>
          <span style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>{scene.name}</span>
          {scene.description && <span style={{ fontSize:12, color:'var(--muted)' }}>· {scene.description}</span>}
          <span style={{ fontSize:12, color:'var(--muted)', marginLeft:4 }}>{scene.shots.length} shot{scene.shots.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', whiteSpace:'nowrap' }}>Est. Start</span>
            <input value={startTime} onChange={e => setStartTime(e.target.value)} onBlur={() => saveStartTime(startTime)}
              placeholder="9:00 AM"
              style={{ width:78, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:5, padding:'3px 7px', fontSize:12, color:'var(--text)', fontFamily:'inherit', outline:'none' }} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => onEditScene(scene)}>Edit</button>
          <button className="btn btn-ghost btn-sm" style={{ color:'var(--muted)' }} onClick={() => onDeleteScene(scene.id)}>Delete</button>
        </div>
      </div>

      {/* Shot table */}
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border)' }}>
            <th style={{ width:32 }} />
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:44 }}>Shot</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left' }}>Description</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:130 }}>Movement</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:80 }}>Time</th>
            <th style={{ width:52 }} />
          </tr>
        </thead>
        <tbody>
          {scene.shots.map((shot, i) => (
            <ShotRow key={shot.id} shot={shot} index={i} sceneNumber={scene.scene_number}
              projectId={projectId} onUpdate={onShotUpdate} onDelete={onShotDelete}
              accentColor={st.badgeText} expanded={expanded}
              onOpenDetail={(s, idx) => onOpenDetail(s, idx, scene)} />
          ))}
          <NewShotRow
            key={`new-${scene.id}`}
            sceneNumber={scene.scene_number} nextIndex={scene.shots.length}
            projectId={projectId} sceneId={scene.id}
            onAdded={shot => onShotAdded(scene.id, shot)} accentColor={st.badgeText} />
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ padding:'10px 20px', background: st.bg, borderTop:`1px solid ${st.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => setExpanded(e => !e)}
          style={{ background:'none', border:'none', fontSize:11, fontWeight:700, color: st.badgeText, cursor:'pointer', padding:0, textTransform:'uppercase', letterSpacing:'.08em', opacity:0.8, display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:12 }}>{expanded ? '▲' : '▼'}</span>
          {expanded ? 'Collapse Shots' : 'Expand Shots'}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:11, fontWeight:700, color: st.badgeText, textTransform:'uppercase', letterSpacing:'.08em', opacity:0.7 }}>Est. Scene Wrap:</span>
          <span style={{ fontSize:13, fontWeight:800, color: st.badgeText, fontVariantNumeric:'tabular-nums' }}>
            {wrapTime || (startTime ? 'Invalid time' : '—')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = time.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', second:'2-digit', hour12:true });
  return (
    <div style={{
      position: 'sticky', top: 48, zIndex: 80,
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      background: 'rgba(255,255,255,0.06)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      padding: '10px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginBottom: 14, marginLeft: -20, marginRight: -20,
    }}>
      <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.18em' }}>Current Time</span>
      <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)' }}>·</span>
      <span style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.85)', letterSpacing:'.06em', fontVariantNumeric:'tabular-nums' }}>{fmt}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ShotList({ project }) {
  const [scenes, setScenes] = useState([]);
  const [talent, setTalent] = useState([]);
  const [showAddScene, setShowAddScene] = useState(false);
  const [sceneForm, setSceneForm] = useState({ name: '', description: '', sceneType: 'interior' });
  const [editScene, setEditScene] = useState(null);
  const [editSceneForm, setEditSceneForm] = useState({ name: '', description: '', sceneType: 'interior' });
  const [detailShot, setDetailShot] = useState(null); // { shot, index, scene }

  useEffect(() => {
    api.getShotList(project.id).then(setScenes).catch(() => {});
    api.getTalent(project.id).then(setTalent).catch(() => {});
  }, [project.id]);

  const totalShots = scenes.reduce((s, sc) => s + sc.shots.length, 0);
  const totalMinutes = scenes.reduce((s, sc) => s + sc.shots.reduce((a, sh) => a + (sh.est_minutes || 0), 0), 0);
  const capturedShots = scenes.reduce((s, sc) => s + sc.shots.filter(sh => sh.status === 'captured').length, 0);

  async function addScene(e) {
    e.preventDefault();
    try {
      const scene = await api.createScene(project.id, sceneForm);
      setScenes(prev => [...prev, scene]);
      setShowAddScene(false);
      setSceneForm({ name: '', description: '', sceneType: 'interior' });
    } catch(err) { alert(err.message); }
  }

  async function saveScene(e) {
    e.preventDefault();
    try {
      const updated = await api.updateScene(project.id, editScene.id, editSceneForm);
      setScenes(prev => prev.map(s => s.id === editScene.id ? { ...s, ...updated } : s));
      setEditScene(null);
    } catch(err) { alert(err.message); }
  }

  async function deleteScene(sceneId) {
    if (!confirm('Delete this scene and all its shots?')) return;
    await api.deleteScene(project.id, sceneId);
    setScenes(prev => prev.filter(s => s.id !== sceneId));
  }

  function handleShotUpdate(updated) {
    setScenes(prev => prev.map(s => ({ ...s, shots: s.shots.map(sh => sh.id === updated.id ? updated : sh) })));
    if (detailShot?.shot?.id === updated.id) setDetailShot(d => ({ ...d, shot: updated }));
  }

  function handleShotAdded(sceneId, shot) {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, shots: [...s.shots, shot] } : s));
  }

  function handleShotDelete(shotId) {
    api.deleteShot(project.id, shotId).catch(() => {});
    setScenes(prev => prev.map(s => ({ ...s, shots: s.shots.filter(sh => sh.id !== shotId) })));
  }

  function handleStartTimeChange(sceneId, val) {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, est_start_time: val } : s));
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
        <div>
          <div className="page-title" style={{ marginBottom:0 }}>Shot List</div>
          <div className="page-sub">{project.client} · {project.code}</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddScene(true)}>+ Add Scene</button>
      </div>

      <LiveClock />

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Total Shots', val: totalShots },
          { label:'Captured', val: capturedShots },
          { label:'Remaining', val: totalShots - capturedShots },
          { label:'Est. Time', val: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 20px' }}>
            <div style={{ fontSize:26, fontWeight:800, color:'var(--text)', fontFamily:"'Syne',sans-serif", letterSpacing:'-0.5px', lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:500, marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {scenes.length === 0 && <div className="empty">No scenes yet — add one to get started.</div>}

      {scenes.map(scene => (
        <SceneBlock key={scene.id} scene={scene} projectId={project.id} talent={talent}
          onShotUpdate={handleShotUpdate} onShotAdded={handleShotAdded} onShotDelete={handleShotDelete}
          onEditScene={s => { setEditScene(s); setEditSceneForm({ name: s.name, description: s.description || '', sceneType: s.scene_type || 'interior' }); }}
          onDeleteScene={deleteScene} onStartTimeChange={handleStartTimeChange}
          onOpenDetail={(shot, index, scene) => setDetailShot({ shot, index, scene })} />
      ))}

      {/* Shot detail modal */}
      {detailShot && (
        <ShotDetailModal
          shot={detailShot.shot}
          sceneNumber={detailShot.scene.scene_number}
          index={detailShot.index}
          projectId={project.id}
          talent={talent}
          onUpdate={handleShotUpdate}
          onClose={() => setDetailShot(null)}
        />
      )}

      {/* Add Scene Modal */}
      {showAddScene && (
        <div className="modal-backdrop" onClick={() => setShowAddScene(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Scene</div>
            <form onSubmit={addScene}>
              <div className="field"><label>Scene Name *</label><input value={sceneForm.name} onChange={e => setSceneForm(f => ({...f, name: e.target.value}))} placeholder="TEAM FLOOR - HERO SHOT" required autoFocus /></div>
              <div className="field"><label>Description</label><input value={sceneForm.description} onChange={e => setSceneForm(f => ({...f, description: e.target.value}))} placeholder="Brief scene description" /></div>
              <div className="field">
                <label>Interior / Exterior</label>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  {['interior','exterior'].map(t => (
                    <button key={t} type="button" onClick={() => setSceneForm(f => ({...f, sceneType: t}))}
                      style={{ flex:1, padding:'8px 0', borderRadius:6, border:`1px solid ${sceneForm.sceneType === t ? (t === 'interior' ? '#60a5fa' : '#4ade80') : 'var(--border)'}`, background: sceneForm.sceneType === t ? (t === 'interior' ? 'rgba(96,165,250,0.15)' : 'rgba(74,222,128,0.12)') : 'var(--bg2)', color: sceneForm.sceneType === t ? (t === 'interior' ? '#60a5fa' : '#4ade80') : 'var(--muted)', fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:'.06em', transition:'all 0.15s' }}>
                      {t === 'interior' ? 'INT.' : 'EXT.'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button type="submit" className="btn btn-primary btn-sm">Add Scene</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddScene(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Scene Modal */}
      {editScene && (
        <div className="modal-backdrop" onClick={() => setEditScene(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Scene</div>
            <form onSubmit={saveScene}>
              <div className="field"><label>Scene Name *</label><input value={editSceneForm.name} onChange={e => setEditSceneForm(f => ({...f, name: e.target.value}))} required autoFocus /></div>
              <div className="field"><label>Description</label><input value={editSceneForm.description} onChange={e => setEditSceneForm(f => ({...f, description: e.target.value}))} /></div>
              <div className="field">
                <label>Interior / Exterior</label>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  {['interior','exterior'].map(t => (
                    <button key={t} type="button" onClick={() => setEditSceneForm(f => ({...f, sceneType: t}))}
                      style={{ flex:1, padding:'8px 0', borderRadius:6, border:`1px solid ${editSceneForm.sceneType === t ? (t === 'interior' ? '#60a5fa' : '#4ade80') : 'var(--border)'}`, background: editSceneForm.sceneType === t ? (t === 'interior' ? 'rgba(96,165,250,0.15)' : 'rgba(74,222,128,0.12)') : 'var(--bg2)', color: editSceneForm.sceneType === t ? (t === 'interior' ? '#60a5fa' : '#4ade80') : 'var(--muted)', fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:'.06em', transition:'all 0.15s' }}>
                      {t === 'interior' ? 'INT.' : 'EXT.'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditScene(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
