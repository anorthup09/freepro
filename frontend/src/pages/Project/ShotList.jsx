import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api.js';
import ShineBorder from '../../components/ShineBorder.jsx';

const MOVEMENTS = ['Static', 'Pan', 'Tilt', 'Dolly', 'Handheld', 'Crane', 'Zoom', 'Gimbal'];
const COVERAGES = ['Interview', 'B-Roll'];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function formatDayDate(month, day, year) {
  if (!month || !day || !year) return '';
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return `${DOW[d.getDay()]}, ${MONTHS[Number(month)-1].toUpperCase()} ${day}, ${year}`;
}

function parseDayDate(str) {
  if (!str) return { month: '', day: '', year: new Date().getFullYear().toString() };
  const m = str.match(/(\w+),\s+(\w+)\s+(\d+),\s+(\d{4})/);
  if (!m) return { month: '', day: '', year: new Date().getFullYear().toString() };
  const mi = MONTHS.findIndex(mo => mo.toUpperCase() === m[2].toUpperCase()) + 1;
  return { month: String(mi || ''), day: m[3], year: m[4] };
}

// Day dates are stored as free text; some rows carry raw ISO timestamps.
// Render those as "WED, AUG 13, 2026"; pass other text through unchanged.
function displayDayDate(str) {
  if (!str) return str;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (!m) return str;
  return formatDayDate(Number(m[2]), Number(m[3]), m[1]);
}

const SCENE_TYPE_STYLES = {
  interior: { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.4)', badge: 'rgba(96,165,250,0.18)', badgeText: '#60a5fa', label: 'INT.' },
  exterior: { bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.4)', badge: 'rgba(74,222,128,0.15)', badgeText: '#4ade80', label: 'EXT.' },
};

const isMobileNow = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;

function shotLabel(sceneNumber, index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${sceneNumber}${letters[index] || index}`;
}

function calcWrapTime(startTime, shots) {
  if (!startTime) return null;
  const totalStart = timeToMins(startTime);
  if (totalStart === null) return null;
  const shotMins = shots.reduce((s, sh) => {
    const m = (sh.setup_minutes ?? 5) + ((sh.takes_count ?? 1) * (sh.take_minutes ?? 5)) + (sh.buffer_minutes ?? 5);
    return s + m;
  }, 0);
  const totalEnd = totalStart + shotMins;
  const endH = Math.floor(totalEnd / 60) % 24;
  const endM = totalEnd % 60;
  const period = endH >= 12 ? 'PM' : 'AM';
  const displayH = endH % 12 || 12;
  return `${displayH}:${String(endM).padStart(2, '0')} ${period}`;
}

function timeToMins(t) {
  if (!t) return null;
  // 12-hour: "9:00 AM" / "12:30 PM"
  const m12 = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1]), min = parseInt(m12[2]);
    const mer = m12[3].toUpperCase();
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return h * 60 + min;
  }
  // 24-hour: "09:00" / "13:30"
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) return parseInt(m24[1]) * 60 + parseInt(m24[2]);
  return null;
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

function calcShotEstTime(sceneStartTime, shots, shotIndex) {
  const startMins = timeToMins(sceneStartTime);
  if (startMins === null) return null;
  const offset = shots.slice(0, shotIndex).reduce((s, sh) => {
    const m = (sh.setup_minutes ?? 5) + ((sh.takes_count ?? 1) * (sh.take_minutes ?? 5)) + (sh.buffer_minutes ?? 5);
    return s + m;
  }, 0);
  return minsToTime(startMins + offset);
}

// ── Shot Row ──────────────────────────────────────────────────────────────────
function ShotRow({ shot, index, sceneNumber, projectId, onUpdate, onDelete, accentColor, allExpanded, talent,
                   dragHandleProps, isDragOver, sceneStartTime, allShots }) {
  const captured = shot.status === 'captured';
  const [desc, setDesc] = useState(shot.description || '');
  const [movement, setMovement] = useState(shot.movement || '');
  const [open, setOpen] = useState(false);
  const [talentOpen, setTalentOpen] = useState(false);
  const talentRef = useRef(null);
  const isOpen = allExpanded || open;

  // Derived display time from breakdown
  const displayMinutes = (shot.setup_minutes ?? 5) + ((shot.takes_count ?? 1) * (shot.take_minutes ?? 5)) + (shot.buffer_minutes ?? 5);

  useEffect(() => {
    function handleClick(e) {
      if (talentRef.current && !talentRef.current.contains(e.target)) setTalentOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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
        onClick={() => { if (isMobileNow()) setOpen(true); }}
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
        <td className="sl-col-hide" style={{ padding:'10px 4px 10px 10px', width:20, cursor:'grab', color:'var(--muted)', fontSize:13, userSelect:'none', opacity:0.4, lineHeight:1 }}
          title="Drag to reorder">
          ⠿
        </td>
        {/* Checkbox */}
        <td style={{ padding:'10px 8px 10px 4px', width:28 }}>
          <div onClick={e => { e.stopPropagation(); toggleCapture(); }} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${captured ? '#4ade80' : accentColor}`, background: captured ? '#4ade80' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
            {captured && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
        </td>
        {/* Shot label */}
        <td style={{ padding:'10px 6px', fontSize:13, fontWeight:700, color: captured ? 'var(--muted)' : accentColor, whiteSpace:'nowrap', width:40 }}>
          {shotLabel(sceneNumber, index)}
        </td>
        {/* Expand arrow */}
        <td style={{ padding:'10px 4px', width:20 }}>
          <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
            title={isOpen ? 'Collapse detail' : 'Expand detail'}
            style={{ background:'none', border:'none', color: isOpen ? accentColor : 'var(--muted)', cursor:'pointer', fontSize:11, padding:0, lineHeight:1, opacity: isOpen ? 1 : 0.5, transition:'all 0.15s' }}>
            {isOpen ? '▼' : '▶'}
          </button>
        </td>
        {/* Description */}
        <td style={{ padding:'6px 8px' }} onClick={e => e.stopPropagation()}>
          <input value={desc} onChange={e => setDesc(e.target.value)}
            onBlur={() => { if (desc !== (shot.description || '')) save('description', desc); }}
            placeholder="Shot description…"
            style={{ width:'100%', background:'transparent', border:'none', outline:'none', color: captured ? 'var(--muted)' : 'var(--text)', fontSize:13, fontFamily:'inherit', padding:0 }} />
        </td>
        {/* Movement */}
        <td className="sl-col-hide" style={{ padding:'6px 8px', width:130 }}>
          <select value={movement} onChange={e => { setMovement(e.target.value); save('movement', e.target.value); }}
            style={{ background:'transparent', border:'none', outline:'none', color: movement ? (captured ? 'var(--muted)' : 'var(--text)') : 'var(--muted)', fontSize:13, fontFamily:'inherit', cursor:'pointer', padding:0, width:'100%' }}>
            <option value="">— Movement —</option>
            {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </td>
        {/* Talent */}
        <td className="sl-col-hide" style={{ padding:'6px 8px', width:80 }} ref={talentRef}>
          {(shot.talent_tags || []).length > 0 ? (
            <div style={{ position:'relative' }}>
              <button onClick={() => setTalentOpen(o => !o)}
                style={{ background: talentOpen ? `${accentColor}22` : 'transparent', border:`1px solid ${accentColor}55`, borderRadius:100, padding:'2px 8px', fontSize:11, fontWeight:700, color: captured ? 'var(--muted)' : accentColor, cursor:'pointer', lineHeight:'16px', whiteSpace:'nowrap' }}>
                {shot.talent_tags.length} {shot.talent_tags.length === 1 ? 'talent' : 'talent'}
              </button>
              {talentOpen && (
                <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:200, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, boxShadow:'0 4px 16px rgba(0,0,0,0.4)', padding:'8px 12px', minWidth:120, whiteSpace:'nowrap' }}>
                  {shot.talent_tags.map(name => (
                    <div key={name} style={{ fontSize:12, color:'var(--text)', padding:'3px 0', borderBottom:'1px solid var(--border)' }}
                      className="last-no-border">{name}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span style={{ fontSize:12, color:'var(--muted)', opacity:0.4 }}>—</span>
          )}
        </td>
        {/* Allocation (read-only, derived from breakdown) */}
        <td style={{ padding:'6px 8px', width:60 }}>
          <span style={{ fontSize:13, color: captured ? 'var(--muted)' : 'var(--text)', fontVariantNumeric:'tabular-nums' }}>{displayMinutes}<span style={{ fontSize:10, color:'var(--muted)', marginLeft:2 }}>m</span></span>
        </td>
        {/* Est. Time */}
        <td style={{ padding:'6px 8px', width:72 }}>
          {(() => {
            const t = calcShotEstTime(sceneStartTime, allShots || [], index);
            return t ? <span style={{ fontSize:12, color: captured ? 'var(--muted)' : 'var(--muted)', fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{t}</span> : <span style={{ color:'var(--muted)', opacity:0.3, fontSize:12 }}>—</span>;
          })()}
        </td>
        {/* Delete */}
        <td style={{ padding:'10px 14px 10px 4px', width:28, textAlign:'right' }}>
          <button onClick={e => { e.stopPropagation(); onDelete(shot.id); }} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:13, padding:0, lineHeight:1, opacity:0.35 }}>✕</button>
        </td>
      </tr>

      {/* Expanded detail row */}
      {open && isMobileNow() && createPortal(
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal">
            <div className="modal-title">Shot {shotLabel(sceneNumber, index)}</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:'10px 14px', marginBottom:12 }}>
              <div className="field sl-detail-move" style={{ margin:0 }}>
                <label style={{ fontSize:10 }}>Movement</label>
                <select value={movement} onChange={e => { setMovement(e.target.value); save('movement', e.target.value); }}>
                  <option value="">— Select —</option>
                  {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
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
          </div>
        </div>, document.body)}
      {isOpen && !(open && isMobileNow()) && (
        <tr style={{ borderBottom:'1px solid var(--border)', background:'rgba(255,255,255,0.025)' }}>
          <td colSpan={9} className="sl-detail-cell" style={{ padding:'12px 14px 16px 76px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:'10px 14px', marginBottom:12 }}>
              <div className="field sl-detail-move" style={{ margin:0 }}>
                <label style={{ fontSize:10 }}>Movement</label>
                <select value={movement} onChange={e => { setMovement(e.target.value); save('movement', e.target.value); }}>
                  <option value="">— Select —</option>
                  {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
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
      <td className="sl-col-hide" style={{ width:20 }} />
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
      <td className="sl-col-hide" style={{ padding:'6px 8px', width:130 }}>
        <select value={movement} onChange={e => setMovement(e.target.value)}
          style={{ background:'transparent', border:'none', outline:'none', color: movement ? 'var(--text)' : 'var(--muted)', fontSize:13, fontFamily:'inherit', cursor:'pointer', padding:0, width:'100%' }}>
          <option value="">— Movement —</option>
          {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td className="sl-col-hide" style={{ width:80 }} />
      <td style={{ padding:'6px 8px', width:60 }} />

      <td style={{ width:28 }} />
    </tr>
  );
}

// ── Day Synopsis Card ─────────────────────────────────────────────────────────
function fmt12(t) {
  if (!t) return t;
  const m = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (!m) return t;
  let h = parseInt(m[1]), min = parseInt(m[2]);
  const meridiem = m[4];
  if (meridiem) return t; // already 12-hour
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(min).padStart(2, '0')} ${period}`;
}

// "FRI, AUG 7, 2026" or ISO text -> "2026-08-07" (null if unparseable)
function slDayDateToISO(str) {
  if (!str) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const { month, day, year } = parseDayDate(str);
  if (!month || !day || !year) return null;
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function DaySynopsisCard({ day, onDelete, onAddScene, scenes, scheduleDays, onDateSelect, onOpenSchedule, onToggleHidePublic }) {
  const tiles = [
    { label: 'Call Time', val: fmt12(day.call_time) },
    { label: 'Shooting Call', val: fmt12(day.shooting_call) },
    { label: 'Lunch', val: fmt12(day.lunch_time) },
    { label: 'Est. Wrap', val: fmt12(day.est_wrap) },
  ];
  const dayScenes = scenes || [];
  const totalShots = dayScenes.reduce((s, sc) => s + sc.shots.length, 0);
  const capturedShots = dayScenes.reduce((s, sc) => s + sc.shots.filter(sh => sh.status === 'captured').length, 0);
  const remaining = totalShots - capturedShots;

  function fmtSchedDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }).toUpperCase();
  }

  return (
    <div style={{ marginBottom: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '6px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
            DAY {day.day_number}
          </div>
          {day.date && (
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap' }}>
              {displayDayDate(day.date)}
            </span>
          )}
          {totalShots > 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <span style={{ color: 'var(--text)', fontWeight: 700 }}>{totalShots}</span> shots · <span style={{ color: 'var(--text)', fontWeight: 700 }}>{capturedShots}</span> captured · <span style={{ color: 'var(--text)', fontWeight: 700 }}>{remaining}</span> remaining
            </div>
          )}
        </div>
        {totalShots === 0 && (
          <div onClick={() => onToggleHidePublic?.(day.id, !day.hide_public)}
            title={day.hide_public ? 'Hidden from public views — tap to show' : 'Shown on public views — tap to hide'}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: day.hide_public ? 'var(--muted)' : 'rgba(74,222,128,0.9)', whiteSpace: 'nowrap' }}>
              {day.hide_public ? 'Hidden from Public' : 'Public'}
            </span>
            <span style={{ width: 32, height: 18, borderRadius: 100, flexShrink: 0, position: 'relative', transition: 'background 0.2s, border-color 0.2s', background: day.hide_public ? 'rgba(255,255,255,0.08)' : 'rgba(74,222,128,0.35)', border: `1px solid ${day.hide_public ? 'rgba(255,255,255,0.18)' : 'rgba(74,222,128,0.7)'}` }}>
              <span style={{ position: 'absolute', top: 2, left: day.hide_public ? 2 : 16, width: 12, height: 12, borderRadius: '50%', background: day.hide_public ? 'rgba(255,255,255,0.45)' : '#4ade80', transition: 'left 0.2s, background 0.2s' }} />
            </span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 100%' }}>
          <button className="btn btn-primary btn-sm" style={{ fontSize: 11, whiteSpace: 'nowrap', padding: '2px 9px', minHeight: 0, height: 22, lineHeight: '18px' }} onClick={() => onAddScene?.(day.id)}>+ Add Scene</button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 8px', minHeight: 0, height: 22, lineHeight: '18px', marginLeft: 'auto' }} onClick={() => {
            if (confirm(`Delete Day ${day.day_number}?`)) onDelete(day.id);
          }}>Delete</button>
        </div>
      </div>
      <div style={{ padding: '0 16px 10px' }}>
        <ShineBorder radius={10}>
          <div className="sl-day-tiles" style={{ background: 'rgba(10,10,8,0.92)', borderRadius: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', overflow: 'hidden' }}>
            {tiles.map((t, i) => (
              <div key={t.label} onClick={onOpenSchedule} title="Edit on the Schedule" style={{ padding: '3px 12px 4px', borderRight: i < 3 ? '1px solid rgba(255,255,255,0.07)' : 'none', textAlign: 'center', cursor: onOpenSchedule ? 'pointer' : 'default' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.12em' }}>{t.label}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: t.val ? 'var(--text)' : 'rgba(255,255,255,0.2)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>{t.val || '—'}</div>
              </div>
            ))}
          </div>
        </ShineBorder>
      </div>
    </div>
  );
}

// ── Scene Block ───────────────────────────────────────────────────────────────
function SceneBlock({ scene, projectId, talent, days, onShotUpdate, onShotAdded, onShotDelete, onDeleteScene, onStartTimeChange, onShotsReorder, onSceneUpdate, onAddBreak, isFirstScene, shootingCall }) {
  const st = SCENE_TYPE_STYLES[scene.scene_type] || SCENE_TYPE_STYLES.interior;
  const effectiveStart = fmt12(isFirstScene && shootingCall ? shootingCall : (scene.est_start_time || '')) || '';
  const [startTime, setStartTime] = useState(effectiveStart);
  const [allExpanded, setAllExpanded] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragIndexRef = useRef(null);

  // Inline scene editing
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(scene.name);
  const [descVal, setDescVal] = useState(scene.description || '');

  // Scene Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: scene.name, description: scene.description || '', sceneType: scene.scene_type || 'interior', dayId: scene.day_id || '' });

  useEffect(() => {
    if (isFirstScene && shootingCall) {
      const normalized = fmt12(shootingCall) || shootingCall;
      if (normalized !== startTime) {
        setStartTime(normalized);
        api.updateScene(projectId, scene.id, { estStartTime: normalized }).catch(() => {});
        onStartTimeChange(scene.id, normalized);
      }
    }
  }, [shootingCall]);

  // Sync start time when cascade updates scene.est_start_time externally
  useEffect(() => {
    if (!isFirstScene) {
      const normalized = fmt12(scene.est_start_time || '') || '';
      if (normalized !== startTime) setStartTime(normalized);
    }
  }, [scene.est_start_time]);

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

  async function saveSceneEdit(e) {
    e.preventDefault();
    try {
      const updated = await api.updateScene(projectId, scene.id, {
        name: editForm.name,
        description: editForm.description,
        sceneType: editForm.sceneType,
        dayId: editForm.dayId || null,
      });
      onSceneUpdate(scene.id, updated);
      setShowEditModal(false);
    } catch(err) { alert(err.message); }
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

  const [showBreakForm, setShowBreakForm] = useState(false);
  const [breakEndTime, setBreakEndTime] = useState('');

  function handleAddBreak(e) {
    e.preventDefault();
    if (!wrapTime || !breakEndTime) return;
    onAddBreak?.({ dayId: scene.day_id || null, startTime: wrapTime, endTime: breakEndTime, sceneId: scene.id });
    setBreakEndTime('');
    setShowBreakForm(false);
  }

  return (
    <div style={{ background:'var(--bg2)', border:`1px solid ${st.border}`, borderRadius:10, overflow:'hidden', marginBottom:16 }}>
      {/* Scene header */}
      <div className="sl-scene-head" style={{ padding:'12px 20px', background: st.bg, borderBottom:`1px solid ${st.border}`, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
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
          <span className="m-hide" style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{scene.shots.length} shot{scene.shots.length !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <span className="m-only" style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{scene.shots.length} shot{scene.shots.length !== 1 ? 's' : ''}</span>
          {scene.day_id && days.find(d => d.id === scene.day_id) && (
            <span className="m-hide" style={{ fontSize:10, fontWeight:700, color:'rgba(251,146,60,0.9)', background:'rgba(251,146,60,0.12)', border:'1px solid rgba(251,146,60,0.3)', borderRadius:4, padding:'2px 8px', whiteSpace:'nowrap', letterSpacing:'.06em' }}>
              DAY {days.find(d => d.id === scene.day_id).day_number}
            </span>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', whiteSpace:'nowrap' }}>Est. Start</span>
            <span style={{ fontSize:12, fontVariantNumeric:'tabular-nums', color: startTime ? 'var(--text)' : 'var(--muted)', opacity: startTime ? 1 : 0.4, fontWeight:600 }}>{startTime || '—'}</span>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ color:'var(--text)', fontSize:11 }} onClick={() => {
            setEditForm({ name: scene.name, description: scene.description || '', sceneType: scene.scene_type || 'interior', dayId: scene.day_id || '' });
            setShowEditModal(true);
          }}>Edit</button>
          <button className="btn btn-ghost btn-sm" style={{ color:'var(--muted)', fontSize:11 }} onClick={() => {
            if (confirm('Delete this scene and all its shots?')) onDeleteScene(scene.id);
          }}>Delete</button>
        </div>
      </div>

      {/* Shot table */}
      <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
      <table className="sl-shot-table" style={{ width:'100%', minWidth:520, borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--border)' }}>
            <th className="sl-col-hide" style={{ width:20 }} />
            <th style={{ width:28 }} />
            <th style={{ padding:'8px 6px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:40 }}>Shot</th>
            <th style={{ width:20 }} />
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left' }}>Description</th>
            <th className="sl-col-hide" style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:130 }}>Movement</th>
            <th className="sl-col-hide" style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:80 }}>Talent</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:60 }}>Allocation</th>
            <th style={{ padding:'8px 8px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign:'left', width:92 }}>Est. Start Time</th>
            <th style={{ width:28 }} />
          </tr>
        </thead>
        <tbody>
          {scene.shots.map((shot, i) => (
            <ShotRow key={shot.id} shot={shot} index={i} sceneNumber={scene.scene_number}
              projectId={projectId} onUpdate={onShotUpdate} onDelete={onShotDelete}
              accentColor={st.badgeText} allExpanded={allExpanded} talent={talent}
              sceneStartTime={startTime} allShots={scene.shots}
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
      </div>

      {/* Footer */}
      <div className="sl-scene-foot" style={{ padding:'10px 20px', background: st.bg, borderTop:`1px solid ${st.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={() => setAllExpanded(e => !e)}
          style={{ background:'none', border:'none', fontSize:11, fontWeight:700, color: st.badgeText, cursor:'pointer', padding:0, textTransform:'uppercase', letterSpacing:'.08em', opacity:0.8, display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:12 }}>{allExpanded ? '▲' : '▼'}</span>
          {allExpanded ? 'Collapse All' : 'Expand All Shots'}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, color: st.badgeText, textTransform:'uppercase', letterSpacing:'.08em', opacity:0.7 }}>Est. Scene Wrap:</span>
            <span style={{ fontSize:13, fontWeight:800, color: st.badgeText, fontVariantNumeric:'tabular-nums' }}>
              {wrapTime || (startTime ? 'Invalid time' : '—')}
            </span>
          </div>
          {wrapTime && !showBreakForm && (
            <button onClick={() => setShowBreakForm(true)} style={{ fontSize:10, fontWeight:700, color:'rgba(234,179,8,0.8)', background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.25)', borderRadius:5, padding:'3px 8px', cursor:'pointer', letterSpacing:'.06em', textTransform:'uppercase' }}>+ Break</button>
          )}
          {showBreakForm && (
            <form onSubmit={handleAddBreak} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:11, color:'rgba(234,179,8,0.7)', fontVariantNumeric:'tabular-nums', fontWeight:600 }}>{wrapTime}</span>
              <span style={{ fontSize:11, color:'var(--muted)' }}>→</span>
              <input value={breakEndTime} onChange={e => setBreakEndTime(e.target.value)} placeholder="1:00 PM" autoFocus
                style={{ width:82, background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:5, padding:'3px 7px', fontSize:12, color:'var(--text)', fontFamily:'inherit', outline:'none' }} />
              <button type="submit" style={{ fontSize:10, fontWeight:700, color:'rgba(234,179,8,0.9)', background:'rgba(234,179,8,0.12)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:5, padding:'3px 8px', cursor:'pointer' }}>Add</button>
              <button type="button" onClick={() => { setShowBreakForm(false); setBreakEndTime(''); }} style={{ fontSize:10, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', padding:'3px 4px' }}>✕</button>
            </form>
          )}
        </div>
      </div>

      {/* Scene Edit Modal — portalled to body so it escapes overflow:hidden */}
      {showEditModal && createPortal(
        <div className="modal-bg" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Scene</div>
            <form onSubmit={saveSceneEdit}>
              <div className="field">
                <label>Scene Name *</label>
                <input value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} required autoFocus />
              </div>
              <div className="field">
                <label>Description</label>
                <input value={editForm.description} onChange={e => setEditForm(f => ({...f, description: e.target.value}))} placeholder="Brief scene description" />
              </div>
              <div className="field">
                <label>Interior / Exterior</label>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  {['interior','exterior'].map(t => (
                    <button key={t} type="button" onClick={() => setEditForm(f => ({...f, sceneType: t}))}
                      style={{ flex:1, padding:'8px 0', borderRadius:6, border:`1px solid ${editForm.sceneType === t ? (t === 'interior' ? '#60a5fa' : '#4ade80') : 'var(--border)'}`, background: editForm.sceneType === t ? (t === 'interior' ? 'rgba(96,165,250,0.15)' : 'rgba(74,222,128,0.12)') : 'var(--bg2)', color: editForm.sceneType === t ? (t === 'interior' ? '#60a5fa' : '#4ade80') : 'var(--muted)', fontSize:12, fontWeight:700, cursor:'pointer', textTransform:'uppercase', letterSpacing:'.06em', transition:'all 0.15s' }}>
                      {t === 'interior' ? 'INT.' : 'EXT.'}
                    </button>
                  ))}
                </div>
              </div>
              {days.length > 0 && (
                <div className="field">
                  <label>Assign to Day</label>
                  <select value={editForm.dayId} onChange={e => setEditForm(f => ({...f, dayId: e.target.value}))}
                    style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', color:'var(--text)', fontFamily:'inherit', fontSize:13 }}>
                    <option value="">— No Day —</option>
                    {days.map(d => (
                      <option key={d.id} value={d.id}>Day {d.day_number}{d.date ? ` — ${displayDayDate(d.date)}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock({ currentDay }) {
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
      padding: '8px 20px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      marginBottom: 14, marginLeft: -20, marginRight: -20,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'.18em' }}>Current Time</span>
        <span style={{ fontSize:11, color:'rgba(255,255,255,0.2)' }}>·</span>
        <span style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.85)', letterSpacing:'.06em', fontVariantNumeric:'tabular-nums' }}>{fmt}</span>
      </div>
      {currentDay && (
        <div style={{ display:'flex', alignItems:'center', gap: 20 }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
            <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em' }}>Day {currentDay.day_number}</span>
          </div>
          {(currentDay.shooting_call || currentDay.est_wrap) && (
            <div style={{ width:1, height:28, background:'rgba(255,255,255,0.1)' }} />
          )}
          {currentDay.shooting_call && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em' }}>Shooting Call</span>
              <span style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)', fontVariantNumeric:'tabular-nums' }}>{fmt12(currentDay.shooting_call)}</span>
            </div>
          )}
          {currentDay.shooting_call && currentDay.est_wrap && (
            <div style={{ width:1, height:28, background:'rgba(255,255,255,0.1)' }} />
          )}
          {currentDay.est_wrap && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
              <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.35)', textTransform:'uppercase', letterSpacing:'.12em' }}>Est. Wrap</span>
              <span style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)', fontVariantNumeric:'tabular-nums' }}>{fmt12(currentDay.est_wrap)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ShotList({ project, onScenesChange, onCurrentDayChange, onOpenScheduleDay }) {
  const [scenes, setScenes] = useState([]);
  const [talent, setTalent] = useState([]);
  const [days, setDays] = useState([]);
  const [showAddScene, setShowAddScene] = useState(false);
  const [sceneForm, setSceneForm] = useState({ name: '', description: '', sceneType: 'interior', dayId: '', estStartTime: '' });
  const [dayForm, setDayForm] = useState({ date: '', callTime: '', shootingCall: '', lunchTime: '', estWrap: '' });
  const [editingDay, setEditingDay] = useState(null);
  const [scheduleDays, setScheduleDays] = useState([]);
  const [breaks, setBreaks] = useState([]);
  const [showAddBreak, setShowAddBreak] = useState(false);
  const [breakForm, setBreakForm] = useState({ dayId: '', startTime: '', endTime: '' });
  const [editingBreak, setEditingBreak] = useState(null);
  const [breakAnchorMap, setBreakAnchorMap] = useState({}); // breakId -> sceneId (in-memory anchor)
  const [currentDayId, setCurrentDayId] = useState(null);
  const dayRefs = useRef({});

  useEffect(() => {
    const observers = [];
    const visibleDays = new Map();
    Object.entries(dayRefs.current).forEach(([id, el]) => {
      if (!el) return;
      const obs = new IntersectionObserver(([entry]) => {
        visibleDays.set(id, entry.isIntersecting ? entry.boundingClientRect.top : Infinity);
        // Pick the day whose top is closest to (and above) the viewport center
        let best = null, bestTop = Infinity;
        visibleDays.forEach((top, dayId) => {
          if (top < bestTop) { bestTop = top; best = dayId; }
        });
        if (best) {
          setCurrentDayId(best);
          const d = days.find(x => x.id === best);
          if (d) onCurrentDayChange?.(d);
        }
      }, { threshold: 0, rootMargin: '0px 0px -80% 0px' });
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [days]);

  function updateScenes(updater) {
    setScenes(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onScenesChange?.(next);
      return next;
    });
  }

  useEffect(() => {
    api.getShotList(project.id).then(s => { setScenes(s); onScenesChange?.(s); }).catch(() => {});
    api.getTalent(project.id).then(setTalent).catch(() => {});
    api.getSlDays(project.id).then(d => { setDays(d); if (d.length) onCurrentDayChange?.(d[0]); }).catch(() => {});
    api.getSchedule(project.id).then(d => setScheduleDays(d || [])).catch(() => {});
    api.getBreaks(project.id).then(setBreaks).catch(() => {});
  }, [project.id]);

  const totalShots = scenes.reduce((s, sc) => s + sc.shots.length, 0);
  const totalMinutes = scenes.reduce((s, sc) => s + sc.shots.reduce((a, sh) => {
    const m = (sh.setup_minutes ?? 5) + ((sh.takes_count ?? 1) * (sh.take_minutes ?? 5)) + (sh.buffer_minutes ?? 5);
    return a + m;
  }, 0), 0);
  const capturedShots = scenes.reduce((s, sc) => s + sc.shots.filter(sh => sh.status === 'captured').length, 0);

  function openAddSceneForDay(dayId) {
    let defaultMins = -1;
    let defaultStart = '';
    const dayScenes = scenes.filter(s => s.day_id === dayId && s.est_start_time)
      .sort((a, b) => (timeToMins(a.est_start_time) ?? 0) - (timeToMins(b.est_start_time) ?? 0));
    if (dayScenes.length > 0) {
      const last = dayScenes[dayScenes.length - 1];
      const wrap = calcWrapTime(last.est_start_time, last.shots || []);
      if (wrap) { defaultStart = wrap; defaultMins = timeToMins(wrap) ?? -1; }
    }
    breaks.filter(b => b.day_id === dayId && b.end_time).forEach(b => {
      const m = timeToMins(b.end_time);
      if (m != null && m > defaultMins) { defaultMins = m; defaultStart = b.end_time; }
    });
    setSceneForm({ name: '', description: '', sceneType: 'interior', dayId, estStartTime: defaultStart });
    setShowAddScene(true);
  }

  async function addScene(e) {
    e.preventDefault();
    try {
      const scene = await api.createScene(project.id, sceneForm);
      updateScenes(prev => [...prev, scene]);
      setShowAddScene(false);
      setSceneForm({ name: '', description: '', sceneType: 'interior', dayId: '', estStartTime: '' });
    } catch(err) { alert(err.message); }
  }

  async function deleteScene(sceneId) {
    const deleted = scenes.find(s => s.id === sceneId);
    await api.deleteScene(project.id, sceneId);
    const remaining = scenes.filter(s => s.id !== sceneId);
    updateScenes(() => remaining);
    if (deleted?.day_id) await recalcDay(deleted.day_id, remaining, breaks, breakAnchorMap);
  }

  async function saveEditDay(e) {
    e.preventDefault();
    try {
      const updated = await api.updateSlDay(project.id, editingDay.id, dayForm);
      setDays(prev => prev.map(d => d.id === updated.id ? updated : d));
      setEditingDay(null);
    } catch(err) { alert(err.message); }
  }

  async function deleteDay(dayId) {
    await api.deleteSlDay(project.id, dayId);
    setDays(prev => prev.filter(d => d.id !== dayId));
    updateScenes(prev => prev.map(s => s.day_id === dayId ? { ...s, day_id: null } : s));
  }

  async function addBreak(e) {
    e.preventDefault();
    try {
      const b = await api.createBreak(project.id, { dayId: breakForm.dayId || null, startTime: breakForm.startTime, endTime: breakForm.endTime });
      const newBreaks = [...breaks, b];
      setBreaks(newBreaks);
      await recalcDay(breakForm.dayId, scenes, newBreaks, breakAnchorMap);
      setShowAddBreak(false);
      setBreakForm({ dayId: '', startTime: '', endTime: '' });
    } catch(err) { alert(err.message); }
  }

  async function handleSceneBreakAdd({ dayId, startTime, endTime, sceneId }) {
    try {
      const b = await api.createBreak(project.id, { dayId: dayId || null, startTime, endTime });
      const newBreaks = [...breaks, b];
      setBreaks(newBreaks);
      const newAnchorMap = { ...breakAnchorMap, [b.id]: sceneId };
      setBreakAnchorMap(newAnchorMap);
      await recalcDay(dayId, scenes, newBreaks, newAnchorMap);
    } catch(err) { alert(err.message); }
  }

  async function deleteBreak(breakId) {
    const brk = breaks.find(b => b.id === breakId);
    await api.deleteBreak(project.id, breakId);
    const newBreaks = breaks.filter(b => b.id !== breakId);
    setBreaks(newBreaks);
    const newAnchorMap = { ...breakAnchorMap };
    delete newAnchorMap[breakId];
    setBreakAnchorMap(newAnchorMap);
    if (brk?.day_id) await recalcDay(brk.day_id, scenes, newBreaks, newAnchorMap);
  }

  async function saveEditBreak(e) {
    e.preventDefault();
    try {
      const updated = await api.updateBreak(project.id, editingBreak.id, { dayId: breakForm.dayId || null, startTime: breakForm.startTime, endTime: breakForm.endTime });
      const newBreaks = breaks.map(b => b.id === updated.id ? updated : b);
      setBreaks(newBreaks);
      await recalcDay(updated.day_id, scenes, newBreaks, breakAnchorMap);
      setEditingBreak(null);
      setBreakForm({ dayId: '', startTime: '', endTime: '' });
    } catch(err) { alert(err.message); }
  }

  function openEditBreak(b) {
    setBreakForm({ dayId: b.day_id || '', startTime: b.start_time || '', endTime: b.end_time || '' });
    setEditingBreak(b);
  }

  function openEditDay(day) {
    const parsed = parseDayDate(day.date);
    setDayForm({ ...parsed, callTime: day.call_time || '', shootingCall: day.shooting_call || '', lunchTime: day.lunch_time || '', estWrap: day.est_wrap || '' });
    setEditingDay(day);
  }

  async function handleDayDateSelect(day, dateLabel) {
    const matched = scheduleDays.find(sd => {
      const d = new Date(sd.date);
      const label = d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }).toUpperCase();
      return label === dateLabel;
    });
    const payload = {
      date: dateLabel || null,
      callTime: matched?.call_time || day.call_time || '',
      shootingCall: matched?.shooting_call_time || day.shooting_call || '',
      lunchTime: matched?.lunch_time || day.lunch_time || '',
      estWrap: matched?.wrap_time || day.est_wrap || '',
    };
    try {
      const updated = await api.updateSlDay(project.id, day.id, payload);
      setDays(prev => prev.map(d => d.id === updated.id ? updated : d));
    } catch(err) { alert(err.message); }
  }

  async function recalcDay(dayId, currentScenes, currentBreaks, anchorMap = {}) {
    if (!dayId) return;
    const day = days.find(d => d.id === dayId);
    const dayScenes = [...currentScenes]
      .filter(s => s.day_id === dayId)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const dayBreaks = [...currentBreaks]
      .filter(b => b.day_id === dayId)
      .sort((a, b) => (timeToMins(a.start_time) ?? 0) - (timeToMins(b.start_time) ?? 0));

    if (!dayScenes.length) return;

    // Build interleaved sequence: scenes in sort_order, breaks placed after their anchor scene.
    // If no anchor, fall back to time-based placement.
    const orderedItems = [];
    const usedBreakIds = new Set();
    for (let i = 0; i < dayScenes.length; i++) {
      const scene = dayScenes[i];
      orderedItems.push({ type: 'scene', data: scene });
      // First: breaks with an explicit anchor pointing to this scene
      for (const b of dayBreaks) {
        if (usedBreakIds.has(b.id)) continue;
        if (anchorMap[b.id] === scene.id) { usedBreakIds.add(b.id); orderedItems.push({ type: 'break', data: b }); }
      }
      // Second: unanchored breaks whose start_time falls near this scene's wrap
      const sceneWrap = calcWrapTime(scene.est_start_time, scene.shots || []);
      const sceneWrapMins = timeToMins(sceneWrap) ?? (timeToMins(scene.est_start_time) ?? (i * 1e6));
      const nextScene = dayScenes[i + 1];
      const nextStartMins = nextScene ? (timeToMins(nextScene.est_start_time) ?? Infinity) : Infinity;
      for (const b of dayBreaks) {
        if (usedBreakIds.has(b.id)) continue;
        if (anchorMap[b.id]) continue; // has anchor but doesn't match this scene — skip
        const bm = timeToMins(b.start_time) ?? 0;
        if (bm >= sceneWrapMins - 1 && bm < nextStartMins) { usedBreakIds.add(b.id); orderedItems.push({ type: 'break', data: b }); }
      }
    }
    for (const b of dayBreaks) {
      if (!usedBreakIds.has(b.id)) orderedItems.push({ type: 'break', data: b });
    }

    let currentTime = fmt12(day?.shooting_call) || dayScenes[0].est_start_time || null;
    let newScenes = [...currentScenes];
    let newBreaks = [...currentBreaks];

    for (const item of orderedItems) {
      if (item.type === 'scene') {
        if (currentTime && item.data.est_start_time !== currentTime) {
          await api.updateScene(project.id, item.data.id, { estStartTime: currentTime }).catch(() => {});
          newScenes = newScenes.map(s => s.id === item.data.id ? { ...s, est_start_time: currentTime } : s);
        }
        const shots = newScenes.find(s => s.id === item.data.id)?.shots || item.data.shots || [];
        const wrap = calcWrapTime(currentTime || item.data.est_start_time, shots);
        if (wrap) currentTime = wrap;
      } else {
        if (currentTime && item.data.start_time !== currentTime) {
          const updated = await api.updateBreak(project.id, item.data.id, {
            dayId: item.data.day_id, startTime: currentTime, endTime: item.data.end_time
          }).catch(() => null);
          if (updated) newBreaks = newBreaks.map(b => b.id === item.data.id ? updated : b);
        }
        const endTime = fmt12(item.data.end_time);
        if (endTime) currentTime = endTime;
      }
    }

    updateScenes(() => newScenes);
    setBreaks(newBreaks);
  }

  function handleShotUpdate(updated) {
    updateScenes(prev => {
      const next = prev.map(s => ({ ...s, shots: s.shots.map(sh => sh.id === updated.id ? updated : sh) }));
      const scene = next.find(s => s.shots.some(sh => sh.id === updated.id));
      if (scene?.day_id) recalcDay(scene.day_id, next, breaks, breakAnchorMap);
      return next;
    });
  }

  function handleShotAdded(sceneId, shot) {
    updateScenes(prev => {
      const next = prev.map(s => s.id === sceneId ? { ...s, shots: [...s.shots, shot] } : s);
      const scene = next.find(s => s.id === sceneId);
      if (scene?.day_id) recalcDay(scene.day_id, next, breaks, breakAnchorMap);
      return next;
    });
  }

  function handleShotDelete(shotId) {
    api.deleteShot(project.id, shotId).catch(() => {});
    updateScenes(prev => {
      const scene = prev.find(s => s.shots.some(sh => sh.id === shotId));
      const next = prev.map(s => ({ ...s, shots: s.shots.filter(sh => sh.id !== shotId) }));
      if (scene?.day_id) recalcDay(scene.day_id, next, breaks, breakAnchorMap);
      return next;
    });
  }

  function handleStartTimeChange(sceneId, val) {
    updateScenes(prev => {
      const next = prev.map(s => s.id === sceneId ? { ...s, est_start_time: val } : s);
      const scene = next.find(s => s.id === sceneId);
      if (scene?.day_id) recalcDay(scene.day_id, next, breaks, breakAnchorMap);
      return next;
    });
  }

  function handleShotsReorder(sceneId, newShots) {
    updateScenes(prev => {
      const next = prev.map(s => s.id === sceneId ? { ...s, shots: newShots } : s);
      const scene = next.find(s => s.id === sceneId);
      if (scene?.day_id) recalcDay(scene.day_id, next, breaks, breakAnchorMap);
      return next;
    });
  }

  function handleSceneUpdate(sceneId, updated) {
    updateScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updated } : s));
  }

  const shootingCall = scenes.length > 0 ? scenes[0].est_start_time || null : null;
  const lastScene = scenes.length > 0 ? scenes[scenes.length - 1] : null;
  const shootingWrap = lastScene ? calcWrapTime(lastScene.est_start_time, lastScene.shots || []) : null;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:4, gap:10, flexWrap:'wrap' }}>
        <div>
          <div className="page-title" style={{ marginBottom:0 }}>Shot List</div>
          <div className="page-sub">{project.client} · {project.code}</div>
        </div>
      </div>

      {showAddScene && createPortal(
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAddScene(false)}>
        <div className="modal">
          <div className="modal-title">Add Scene</div>
          <form onSubmit={addScene}>
            <div className="form-grid" style={{ marginBottom:10 }}>
              <div className="field span2"><label>Scene Name *</label><input value={sceneForm.name} onChange={e => setSceneForm(f => ({...f, name: e.target.value}))} placeholder="TEAM FLOOR - HERO SHOT" required autoFocus /></div>
              <div className="field span2"><label>Description</label><input value={sceneForm.description} onChange={e => setSceneForm(f => ({...f, description: e.target.value}))} placeholder="Brief scene description" /></div>
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
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" className="btn btn-primary btn-sm">Add Scene</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddScene(false)}>Cancel</button>
            </div>
          </form>
        </div>
        </div>, document.body)}


      {/* Scenes grouped by day, then unassigned */}
      {scenes.length === 0 && days.length === 0 && <div className="empty">No scenes yet — add one to get started.</div>}

      {days.map((day, dayIdx) => {
        const dayScenes = scenes.filter(s => s.day_id === day.id);
        const dayBreaks = breaks.filter(b => b.day_id === day.id);
        // Scenes ordered by sort_order (stable insertion order)
        // Sort scenes by sort_order; assign each a time-based sort key falling back to sort_order
        const sortedScenes = [...dayScenes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
        // Give each scene a numeric sort position: its est_start_time in mins, or (sort_order * 1e6) as fallback
        const sceneItems = sortedScenes.map((s, idx) => ({
          _type: 'scene',
          _sort: timeToMins(s.est_start_time) ?? (idx * 1e6),
          data: s,
        }));
        // Breaks sort after the scene at the same minute (+0.5 offset)
        const breakItems = dayBreaks.map(b => ({
          _type: 'break',
          _sort: (timeToMins(b.start_time) ?? 0) + 0.5,
          data: b,
        }));
        const items = [...sceneItems, ...breakItems].sort((a, b) => a._sort - b._sort);
        return (
          <div key={day.id} style={{ marginBottom: 32 }} ref={el => { dayRefs.current[day.id] = el; }}>
            {dayIdx > 0 && <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 1, marginBottom: 24 }} />}
            <DaySynopsisCard day={day} onDelete={deleteDay} onAddScene={openAddSceneForDay} scenes={dayScenes} scheduleDays={scheduleDays} onDateSelect={handleDayDateSelect} onOpenSchedule={onOpenScheduleDay ? () => onOpenScheduleDay(slDayDateToISO(day.date)) : undefined}
              onToggleHidePublic={async (dayId, hide) => {
                try {
                  const u = await api.updateSlDay(project.id, dayId, { hidePublic: hide });
                  setDays(prev => prev.map(d => d.id === u.id ? u : d));
                } catch (e) { alert(e.message); }
              }} />
            {items.map((item, itemIdx) => item._type === 'scene' ? (
              <SceneBlock key={item.data.id} scene={item.data} projectId={project.id} talent={talent} days={days}
                onShotUpdate={handleShotUpdate} onShotAdded={handleShotAdded} onShotDelete={handleShotDelete}
                onDeleteScene={deleteScene} onStartTimeChange={handleStartTimeChange}
                onShotsReorder={handleShotsReorder} onSceneUpdate={handleSceneUpdate} onAddBreak={handleSceneBreakAdd}
                isFirstScene={items.filter(i => i._type === 'scene').indexOf(item) === 0}
                shootingCall={items.filter(i => i._type === 'scene').indexOf(item) === 0 ? (fmt12(day.shooting_call) || '') : undefined} />
            ) : (
              <div key={item.data.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', margin:'8px 0', padding:'10px 16px', background:'rgba(234,179,8,0.08)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:10, fontWeight:800, color:'rgba(234,179,8,0.9)', textTransform:'uppercase', letterSpacing:'.1em', background:'rgba(234,179,8,0.15)', border:'1px solid rgba(234,179,8,0.3)', borderRadius:4, padding:'2px 8px' }}>BREAK</span>
                  <span style={{ fontSize:13, fontWeight:700, color:'rgba(234,179,8,0.9)', fontVariantNumeric:'tabular-nums' }}>
                    {fmt12(item.data.start_time)}{item.data.end_time ? ` – ${fmt12(item.data.end_time)}` : ''}
                  </span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={() => openEditBreak(item.data)} className="btn btn-ghost btn-sm" style={{ fontSize:11, color:'rgba(234,179,8,0.7)', border:'1px solid rgba(234,179,8,0.25)' }}>Edit</button>
                  <button onClick={() => deleteBreak(item.data.id)} style={{ background:'none', border:'none', color:'rgba(234,179,8,0.4)', cursor:'pointer', fontSize:13, padding:0, lineHeight:1 }}>✕</button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div style={{ textAlign:'center', padding:'12px 0 20px', fontSize:12, color:'var(--muted)', opacity:0.5 }}>No scenes assigned to this day yet.</div>
            )}
          </div>
        );
      })}

      {/* Unassigned scenes */}
      {(() => {
        const unassigned = scenes.filter(s => !s.day_id);
        if (!unassigned.length) return null;
        return (
          <div>
            {days.length > 0 && (
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:10, marginTop:4, opacity:0.6 }}>Unassigned Scenes</div>
            )}
            {unassigned.map((scene, ui) => (
              <SceneBlock key={scene.id} scene={scene} projectId={project.id} talent={talent} days={days}
                onShotUpdate={handleShotUpdate} onShotAdded={handleShotAdded} onShotDelete={handleShotDelete}
                onDeleteScene={deleteScene} onStartTimeChange={handleStartTimeChange}
                onShotsReorder={handleShotsReorder} onSceneUpdate={handleSceneUpdate} onAddBreak={handleSceneBreakAdd}
                isFirstScene={ui === 0} />
            ))}
          </div>
        );
      })()}

      {/* Edit Day Modal */}
      {editingDay && (
        <div className="modal-bg" onClick={() => setEditingDay(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Day {editingDay.day_number}</div>
            <form onSubmit={saveEditDay}>
              {scheduleDays.length > 0 && (
                <div className="field">
                  <label>Import Times from Schedule</label>
                  <select defaultValue="" onChange={e => {
                    const sd = scheduleDays.find(d => d.id === e.target.value);
                    if (!sd) return;
                    setDayForm(f => ({ ...f, callTime: sd.call_time || f.callTime, shootingCall: sd.shooting_call_time || f.shootingCall, lunchTime: sd.lunch_time || f.lunchTime, estWrap: sd.wrap_time || f.estWrap }));
                  }} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', color:'var(--text)', fontFamily:'inherit', fontSize:13 }}>
                    <option value="">— Select a schedule day —</option>
                    {scheduleDays.map(sd => <option key={sd.id} value={sd.id}>Day {sd.day_number}{sd.call_time ? ` · Call ${sd.call_time}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="field" style={{ margin:0 }}><label>Call Time</label><input value={dayForm.callTime} onChange={e => setDayForm(f => ({...f, callTime: e.target.value}))} placeholder="8:00 AM" /></div>
                <div className="field" style={{ margin:0 }}><label>Shooting Call</label><input value={dayForm.shootingCall} onChange={e => setDayForm(f => ({...f, shootingCall: e.target.value}))} placeholder="9:00 AM" /></div>
                <div className="field" style={{ margin:0 }}><label>Lunch</label><input value={dayForm.lunchTime} onChange={e => setDayForm(f => ({...f, lunchTime: e.target.value}))} placeholder="12:00 PM" /></div>
                <div className="field" style={{ margin:0 }}><label>Est. Wrap</label><input value={dayForm.estWrap} onChange={e => setDayForm(f => ({...f, estWrap: e.target.value}))} placeholder="6:00 PM" /></div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingDay(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Break Modal */}
      {(showAddBreak || editingBreak) && (
        <div className="modal-bg" onClick={() => { setShowAddBreak(false); setEditingBreak(null); setBreakForm({ dayId: '', startTime: '', endTime: '' }); }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{editingBreak ? 'Edit Break' : 'Add Break'}</div>
            <form onSubmit={editingBreak ? saveEditBreak : addBreak}>
              {days.length > 0 && (
                <div className="field">
                  <label>Day</label>
                  <select value={breakForm.dayId} onChange={e => setBreakForm(f => ({...f, dayId: e.target.value}))}
                    style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', color:'var(--text)', fontFamily:'inherit', fontSize:13 }}>
                    <option value="">— No day —</option>
                    {days.map(d => <option key={d.id} value={d.id}>Day {d.day_number}{d.date ? ` — ${displayDayDate(d.date)}` : ''}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="field" style={{ margin:0 }}>
                  <label>Start Time</label>
                  <span style={{ fontSize:13, color:'var(--text)', fontVariantNumeric:'tabular-nums', display:'block', padding:'7px 0' }}>{breakForm.startTime || '—'}</span>
                </div>
                <div className="field" style={{ margin:0 }}>
                  <label>End Time</label>
                  <input value={breakForm.endTime} onChange={e => setBreakForm(f => ({...f, endTime: e.target.value}))} placeholder="1:00 PM" />
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button type="submit" className="btn btn-primary" style={{ flex:1 }}>{editingBreak ? 'Save Break' : 'Add Break'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => { setShowAddBreak(false); setEditingBreak(null); setBreakForm({ dayId: '', startTime: '', endTime: '' }); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
