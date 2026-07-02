import React, { useEffect, useState, useRef, useCallback } from 'react';
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

// ── Shot Row ──────────────────────────────────────────────────────────────────
function ShotRow({ shot, index, sceneNumber, projectId, onUpdate, onDelete, accentColor, allExpanded, talent,
                   dragHandleProps, isDragOver }) {
  const captured = shot.status === 'captured';
  const [desc, setDesc] = useState(shot.description || '');
  const [movement, setMovement] = useState(shot.movement || '');
  const [estMinutes, setEstMinutes] = useState(shot.est_minutes ?? 15);
  const [open, setOpen] = useState(false);
  const isOpen = allExpanded || open;

  // Detail form state
  const [detail, setDetail] = useState({
    angle: shot.angle || '',
    lens: shot.lens || '',
    frameRate: shot.frame_rate || '',
    coverage: shot.coverage || '',
    talentTags: shot.talent_tags || [],
    specialEquipment: shot.special_equipment || '',
    audioNotes: shot.audio_notes || '',
    setupMinutes: shot.setup_minutes ?? 5,
    takesCount: shot.takes_count ?? 1,
    takeMinutes: shot.take_minutes ?? 5,
    bufferMinutes: shot.buffer_minutes ?? 5,
  });
  const [detailSaving, setDetailSaving] = useState(false);

  useEffect(() => { setDesc(shot.description || ''); }, [shot.description]);
  useEffect(() => { setMovement(shot.movement || ''); }, [shot.movement]);
  useEffect(() => { setEstMinutes(shot.est_minutes ?? 15); }, [shot.est_minutes]);
  useEffect(() => {
    setDetail({
      angle: shot.angle || '',
      lens: shot.lens || '',
      frameRate: shot.frame_rate || '',
      coverage: shot.coverage || '',
      talentTags: shot.talent_tags || [],
      specialEquipment: shot.special_equipment || '',
      audioNotes: shot.audio_notes || '',
      setupMinutes: shot.setup_minutes ?? 5,
      takesCount: shot.takes_count ?? 1,
      takeMinutes: shot.take_minutes ?? 5,
      bufferMinutes: shot.buffer_minutes ?? 5,
    });
  }, [shot.id]);

  const totalTime = Number(detail.setupMinutes || 0) + (Number(detail.takesCount || 0) * Number(detail.takeMinutes || 0)) + Number(detail.bufferMinutes || 0);

  function toggleTalent(name) {
    setDetail(f => {
      const tags = f.talentTags.includes(name) ? f.talentTags.filter(t => t !== name) : [...f.talentTags, name];
      return { ...f, talentTags: tags };
    });
  }

  async function save(field, value) {
    try {
      const updated = await api.updateShot(projectId, shot.id, { [field]: value ?? null });
      onUpdate(updated);
    } catch {}
  }

  async function toggleCapture() {
    const status = captured ? 'not_captured' : 'captured';
    const updated = await api.updateShot(projectId, shot.id, { status });
    onUpdate(updated);
  }

  async function saveDetail() {
    setDetailSaving(true);
    try {
      const updated = await api.updateShot(projectId, shot.id, { ...detail, estMinutes: totalTime || null });
      onUpdate(updated);
      setOpen(false);
    } catch(e) { alert(e.message); }
    setDetailSaving(false);
  }

  const rowBg = isDragOver ? 'rgba(255,255,255,0.06)' : (captured ? 'rgba(15,15,12,0.6)' : 'transparent');

  return (
    <>
      <tr
        {...dragHandleProps}
        style={{
          borderBottom: isOpen ? 'none' : '1px solid var(--border)',
          background: rowBg,
          outline: captured ? 'none' : `1px solid ${accentColor}55`,
          outlineOffset: '-1px',
          opacity: captured ? 0.4 : 1,
          transition: 'background 0.15s, opacity 0.2s',
          cursor: 'default',
        }}
      >
        {/* Drag handle */}
        <td style={{ padding:'10px 4px 10px 10px', width:20, cursor:'grab', color:'var(--muted)', fontSize:13, userSelect:'none', opacity:0.4, lineHeight:1 }}
          title="Drag to reorder">
          ⠿
        </td>
        {/* Checkbox */}
        <td style={{ padding:'10px 8px 10px 4px', width:28 }}>
          <div onClick={toggleCapture} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${captured ? '#4ade80' : accentColor}`, background: captured ? '#4ade80' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
            {captured && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </td>
        {/* Shot label */}
        <td style={{ padding:'10px 6px', fontSize:13, fontWeight:700, color: captured ? 'var(--muted)' : accentColor, whiteSpace:'nowrap', width:40 }}>
          {shotLabel(sceneNumber, index)}
        </td>
        {/* Expand arrow */}
        <td style={{ padding:'10px 4px', width:20 }}>
          <button onClick={() => setOpen(o => !o)}
            title={isOpen ? 'Collapse detail' : 'Expand detail'}
            style={{ background:'none', border:'none', color: isOpen ? accentColor : 'var(--muted)', cursor:'pointer', fontSize:11, padding:0, lineHeight:1, opacity: isOpen ? 1 : 0.5, transition:'all 0.15s' }}>
            {isOpen ? '▼' : '▶'}
          </button>
        </td>
        {/* Description */}
        <td style={{ padding:'6px 8px' }}>
          <input value={desc} onChange={e => setDesc(e.target.value)}
            onBlur={() => { if (desc !== (shot.description || '')) save('description', desc); }}
            placeholder="Shot description…"
            style={{ width:'100%', background:'transparent', border:'none', outline:'none', color: captured ? 'var(--muted)' : 'var(--text)', fontSize:13, fontFamily:'inherit', padding:0 }} />
        </td>
        {/* Movement */}
        <td style={{ padding:'6px 8px', width:130 }}>
          <select value={movement} onChange={e => { setMovement(e.target.value); save('movement', e.target.value); }}
            style={{ background:'transparent', border:'none', outline:'none', color: movement ? (captured ? 'var(--muted)' : 'var(--text)') : 'var(--muted)', fontSize:13, fontFamily:'inherit', cursor:'pointer', padding:0, width:'100%' }}>
            <option value="">— Movement —</option>
            {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </td>
        {/* Time */}
        <td style={{ padding:'6px 8px', width:70 }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" min="1" value={estMinutes} onChange={e => setEstMinutes(e.target.value)}
              onBlur={() => { if (String(estMinutes) !== String(shot.est_minutes ?? 15)) save('estMinutes', estMinutes ? Number(estMinutes) : null); }}
              style={{ width:36, background:'transparent', border:'none', outline:'none', color: captured ? 'var(--muted)' : 'var(--text)', fontSize:13, fontFamily:'inherit', padding:0, MozAppearance:'textfield' }} />
            <span style={{ fontSize:11, color:'var(--muted)' }}>m</span>
          </div>
        </td>
        {/* Delete */}
        <td style={{ padding:'10px 14px 10px 4px', width:28, textAlign:'right' }}>
          <button onClick={() => onDelete(shot.id)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:13, padding:0, lineHeight:1, opacity:0.35 }}>✕</button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {isOpen && (
        <tr style={{ borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,0.025)' }}>
          <td colSpan={8} style={{ padding:'12px 14px 16px 76px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px 14px', marginBottom:12 }}>
              <div className="field" style={{ margin:0 }}>
                <label style={{ fontSize:10 }}>Angle</label>
                <input value={detail.angle} onChange={e => setDetail(f => ({...f, angle: e.target.value}))} placeholder="e.g. Eye level" />
              </div>
              <div className="field" style={{ margin:0 }}>
                <label style={{ fontSize:10 }}>Lens</label>
                <input value={detail.lens} onChange={e => setDetail(f => ({...f, lens: e.target.value}))} placeholder="e.g. 85mm" />
              </div>
              <div className="field" style={{ margin:0 }}>
                <label style={{ fontSize:10 }}>Frame Rate</label>
                <input value={detail.frameRate} onChange={e => setDetail(f => ({...f, frameRate: e.target.value}))} placeholder="e.g. 24fps" />
              </div>
              <div className="field" style={{ margin:0 }}>
                <label style={{ fontSize:10 }}>Coverage</label>
                <select value={detail.coverage} onChange={e => setDetail(f => ({...f, coverage: e.target.value}))}>
                  <option value="">— Select —</option>
                  {COVERAGES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin:0, gridColumn:'span 2' }}>
                <label style={{ fontSize:10 }}>Special Equipment</label>
                <input value={detail.specialEquipment} onChange={e => setDetail(f => ({...f, specialEquipment: e.target.value}))} placeholder="e.g. Gimbal, Drone, Slider" />
              </div>
              <div className="field" style={{ margin:0, gridColumn:'span 2' }}>
                <label style={{ fontSize:10 }}>Audio</label>
                <input value={detail.audioNotes} onChange={e => setDetail(f => ({...f, audioNotes: e.target.value}))} placeholder="e.g. Lav mic, Boom, No audio" />
              </div>
            </div>

            {/* Talent tags */}
            {talent.length > 0 && (
              <div className="field" style={{ margin:'0 0 12px' }}>
                <label style={{ fontSize:10 }}>Talent</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
                  {talent.map(t => {
                    const active = detail.talentTags.includes(t.name);
                    return (
                      <button key={t.name} type="button" onClick={() => toggleTalent(t.name)}
                        style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${active ? 'var(--orange)' : 'var(--border)'}`, background: active ? 'rgba(251,146,60,0.15)' : 'var(--bg2)', color: active ? 'var(--orange)' : 'var(--muted)', transition:'all 0.15s' }}>
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Timing */}
            <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginBottom:12 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:10 }}>Timing Breakdown</div>
              <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Setup</span>
                  <input type="number" min="0" value={detail.setupMinutes} onChange={e => setDetail(f => ({...f, setupMinutes: e.target.value}))}
                    style={{ width:48, textAlign:'center' }} />
                  <span style={{ fontSize:11, color:'var(--muted)' }}>min</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Takes</span>
                  <input type="number" min="1" value={detail.takesCount} onChange={e => setDetail(f => ({...f, takesCount: e.target.value}))}
                    style={{ width:48, textAlign:'center' }} />
                  <span style={{ fontSize:11, color:'var(--muted)' }}>×</span>
                  <input type="number" min="0" value={detail.takeMinutes} onChange={e => setDetail(f => ({...f, takeMinutes: e.target.value}))}
                    style={{ width:48, textAlign:'center' }} />
                  <span style={{ fontSize:11, color:'var(--muted)' }}>min</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>Buffer</span>
                  <input type="number" min="0" value={detail.bufferMinutes} onChange={e => setDetail(f => ({...f, bufferMinutes: e.target.value}))}
                    style={{ width:48, textAlign:'center' }} />
                  <span style={{ fontSize:11, color:'var(--muted)' }}>min</span>
                </div>
                <div style={{ marginLeft:'auto', display:'flex', alignItems:'baseline', gap:5 }}>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Total</span>
                  <span style={{ fontSize:18, fontWeight:800, color:'var(--text)', fontVariantNumeric:'tabular-nums' }}>{totalTime}</span>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>min</span>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary btn-sm" onClick={saveDetail} disabled={detailSaving}>{detailSaving ? 'Saving…' : 'Save Details'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Close</button>
            </div>
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
  const [saving, setSaving] = useState(false);
  const descRef = useRef(null);

  async function submit() {
    if (!desc.trim() || saving) return;
    setSaving(true);
    try {
      const shot = await api.createShot(projectId, sceneId, {
        description: desc,
        movement: movement || null,
        estMinutes: 15,
        setupMinutes: 5,
        takesCount: 1,
        takeMinutes: 5,
        bufferMinutes: 5,
      });
      onAdded(shot);
      setDesc(''); setMovement('');
      descRef.current?.focus();
    } catch {}
    setSaving(false);
  }

  return (
    <tr style={{ borderBottom:'1px solid var(--border)', opacity: saving ? 0.5 : 1 }}>
      <td style={{ width:20 }} />
      <td style={{ padding:'10px 8px 10px 4px', width:28 }}>
        <div style={{ width:16, height:16, borderRadius:4, border:'2px solid var(--border)' }} />
      </td>
      <td style={{ padding:'10px 6px', fontSize:13, fontWeight:700, color: accentColor ? `${accentColor}66` : 'var(--muted)', width:40 }}>
        {shotLabel(sceneNumber, nextIndex)}
      </td>
      <td style={{ width:20 }} />
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
      <td style={{ padding:'6px 8px', width:70 }}>
        <span style={{ fontSize:12, color:'var(--muted)' }}>15m</span>
      </td>
      <td style={{ width:28 }} />
    </tr>
  );
}

// ── Scene Block ───────────────────────────────────────────────────────────────
function SceneBlock({ scene, projectId, talent, onShotUpdate, onShotAdded, onShotDelete, onDeleteScene, onStartTimeChange, onShotsReorder, onSceneUpdate }) {
  const st = SCENE_TYPE_STYLES[scene.scene_type] || SCENE_TYPE_STYLES.interior;
  const [startTime, setStartTime] = useState(scene.est_start_time || '');
  const [allExpanded, setAllExpanded] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragIndexRef = useRef(null);

  // Inline scene editing
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(scene.name);
  const [descVal, setDescVal] = useState(scene.description || '');

  async function saveStartTime(val) {
    try {
      await api.updateScene(projectId, scene.id, { estStartTime: val || null });
      onStartTimeChange(scene.id, val);
    } catch {}
  }

  async function saveSceneName() {
    if (!nameVal.trim()) return;
    try {
      const updated = await api.updateScene(projectId, scene.id, { name: nameVal, description: descVal });
      onSceneUpdate(scene.id, updated);
    } catch {}
    setEditingName(false);
  }

  async function toggleSceneType() {
    const newType = scene.scene_type === 'interior' ? 'exterior' : 'interior';
    try {
      const updated = await api.updateScene(projectId, scene.id, { sceneType: newType });
      onSceneUpdate(scene.id, updated);
    } catch {}
  }

  // Drag-and-drop reorder
  function handleDragStart(index) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function handleDrop(e, dropIndex) {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex == null || fromIndex === dropIndex) { setDragOverIndex(null); return; }
    const newShots = [...scene.shots];
    const [moved] = newShots.splice(fromIndex, 1);
    newShots.splice(dropIndex, 0, moved);
    // Assign new sort_orders and persist
    const updated = newShots.map((sh, i) => ({ ...sh, sort_order: i }));
    onShotsReorder(scene.id, updated);
    updated.forEach((sh, i) => {
      if (sh.sort_order !== scene.shots.find(s => s.id === sh.id)?.sort_order) {
        api.updateShot(projectId, sh.id, { sortOrder: i }).catch(() => {});
      }
    });
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }

  const wrapTime = calcWrapTime(startTime, scene.shots);

  return (
    <div style={{ background:'var(--bg2)', border:`1px solid ${st.border}`, borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      {/* Scene header */}
      <div style={{ padding:'12px 20px', background: st.bg, borderBottom:`1px solid ${st.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          {/* INT/EXT toggle badge */}
          <button onClick={toggleSceneType}
            title="Click to toggle INT/EXT"
            style={{ fontSize:10, fontWeight:800, color: st.badgeText, textTransform:'uppercase', letterSpacing:'.1em', background: st.badge, border:`1px solid ${st.border}`, borderRadius:4, padding:'2px 8px', cursor:'pointer', whiteSpace:'nowrap', lineHeight:'20px' }}>
            {st.label} · Scene {scene.scene_number}
          </button>

          {/* Editable name */}
          {editingName ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, flex:1 }}>
              <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveSceneName(); if (e.key === 'Escape') setEditingName(false); }}
                autoFocus
                style={{ fontSize:14, fontWeight:700, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:5, padding:'3px 8px', color:'var(--text)', fontFamily:'inherit', outline:'none', minWidth:120 }} />
              <input value={descVal} onChange={e => setDescVal(e.target.value)}
                placeholder="Description (optional)"
                onKeyDown={e => { if (e.key === 'Enter') saveSceneName(); if (e.key === 'Escape') setEditingName(false); }}
                style={{ fontSize:12, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:5, padding:'3px 8px', color:'var(--muted)', fontFamily:'inherit', outline:'none', minWidth:100 }} />
              <button className="btn btn-primary btn-sm" style={{ padding:'3px 10px', fontSize:11 }} onClick={saveSceneName}>Save</button>
              <button className="btn btn-ghost btn-sm" style={{ padding:'3px 10px', fontSize:11 }} onClick={() => setEditingName(false)}>✕</button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:6, cursor:'text', minWidth:0 }} onClick={() => { setNameVal(scene.name); setDescVal(scene.description||''); setEditingName(true); }}>
              <span style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>{scene.name}</span>
              {scene.description && <span style={{ fontSize:12, color:'var(--muted)' }}>· {scene.description}</span>}
              <span style={{ fontSize:10, color:'var(--muted)', opacity:0.5, marginLeft:2 }}>✏</span>
            </div>
          )}
          <span style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{scene.shots.length} shot{scene.shots.length !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', whiteSpace:'nowrap' }}>Est. Start</span>
            <input value={startTime} onChange={e => setStartTime(e.target.value)} onBlur={() => saveStartTime(startTime)}
              placeholder="9:00 AM"
              style={{ width:78, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:5, padding:'3px 7px', fontSize:12, color:'var(--text)', fontFamily:'inherit', outline:'none' }} />
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color:'var(--muted)', fontSize:11 }} onClick={() => {
            if (confirm('Delete this scene and all its shots?')) onDeleteScene(scene.id);
          }}>Delete</button>
        </div>
      </div>

      {/* Shot table */}
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border)' }}>
            <th style={{ width:20 }} />
            <th style={{ width:28 }} />
            <th style={{ padding:'8px 6px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:40 }}>Shot</th>
            <th style={{ width:20 }} />
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left' }}>Description</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:130 }}>Movement</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:70 }}>Time</th>
            <th style={{ width:28 }} />
          </tr>
        </thead>
        <tbody>
          {scene.shots.map((shot, i) => (
            <ShotRow key={shot.id} shot={shot} index={i} sceneNumber={scene.scene_number}
              projectId={projectId} onUpdate={onShotUpdate} onDelete={onShotDelete}
              accentColor={st.badgeText} allExpanded={allExpanded} talent={talent}
              isDragOver={dragOverIndex === i}
              dragHandleProps={{
                draggable: true,
                onDragStart: () => handleDragStart(i),
                onDragOver: e => handleDragOver(e, i),
                onDrop: e => handleDrop(e, i),
                onDragEnd: () => setDragOverIndex(null),
              }}
            />
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
        <button onClick={() => setAllExpanded(e => !e)}
          style={{ background:'none', border:'none', fontSize:11, fontWeight:700, color: st.badgeText, cursor:'pointer', padding:0, textTransform:'uppercase', letterSpacing:'.08em', opacity:0.8, display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:12 }}>{allExpanded ? '▲' : '▼'}</span>
          {allExpanded ? 'Collapse All' : 'Expand All Shots'}
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

  async function deleteScene(sceneId) {
    await api.deleteScene(project.id, sceneId);
    setScenes(prev => prev.filter(s => s.id !== sceneId));
  }

  function handleShotUpdate(updated) {
    setScenes(prev => prev.map(s => ({ ...s, shots: s.shots.map(sh => sh.id === updated.id ? updated : sh) })));
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

  function handleShotsReorder(sceneId, newShots) {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, shots: newShots } : s));
  }

  function handleSceneUpdate(sceneId, updated) {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updated } : s));
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
          onDeleteScene={deleteScene} onStartTimeChange={handleStartTimeChange}
          onShotsReorder={handleShotsReorder} onSceneUpdate={handleSceneUpdate} />
      ))}

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
    </div>
  );
}
