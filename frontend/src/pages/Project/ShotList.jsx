import React, { useEffect, useState, useRef } from 'react';
import { api } from '../../api.js';

const MOVEMENTS = ['Static', 'Pan', 'Tilt', 'Dolly', 'Handheld', 'Crane', 'Zoom', 'Gimbal'];

const SCENE_TYPE_STYLES = {
  interior: { bg: 'rgba(96,165,250,0.12)', border: 'rgba(96,165,250,0.4)', badge: 'rgba(96,165,250,0.18)', badgeText: '#60a5fa', label: 'INT.' },
  exterior: { bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.4)', badge: 'rgba(74,222,128,0.15)', badgeText: '#4ade80', label: 'EXT.' },
};

function shotLabel(sceneNumber, index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${sceneNumber}${letters[index] || index}`;
}

function ShotRow({ shot, index, sceneNumber, projectId, onUpdate, onDelete }) {
  const captured = shot.status === 'captured';
  const [desc, setDesc] = useState(shot.description || '');
  const [movement, setMovement] = useState(shot.movement || '');
  const [estMinutes, setEstMinutes] = useState(shot.est_minutes || '');

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

  return (
    <tr style={{
      borderBottom: '1px solid var(--border)',
      background: captured ? 'rgba(15,15,12,0.6)' : 'transparent',
      outline: captured ? 'none' : '1px solid rgba(251,146,60,0.3)',
      outlineOffset: '-1px',
      opacity: captured ? 0.4 : 1,
      transition: 'background 0.2s, opacity 0.2s',
    }}>
      <td style={{ padding:'10px 10px 10px 14px', width:32 }}>
        <div onClick={toggleCapture} style={{ width:16, height:16, borderRadius:4, border:`2px solid ${captured ? '#4ade80' : 'var(--orange)'}`, background: captured ? '#4ade80' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
          {captured && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      </td>
      <td style={{ padding:'10px 8px', fontSize:13, fontWeight:700, color: captured ? 'var(--muted)' : 'var(--orange)', whiteSpace:'nowrap', width:44 }}>
        {shotLabel(sceneNumber, index)}
      </td>
      <td style={{ padding:'6px 8px' }}>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onBlur={() => { if (desc !== (shot.description || '')) save('description', desc); }}
          placeholder="Shot description…"
          style={{ width:'100%', background:'transparent', border:'none', outline:'none', color: captured ? 'var(--muted)' : 'var(--text)', fontSize:13, fontFamily:'inherit', padding:0 }}
        />
      </td>
      <td style={{ padding:'6px 8px', width:130 }}>
        <select
          value={movement}
          onChange={e => { setMovement(e.target.value); save('movement', e.target.value); }}
          style={{ background:'transparent', border:'none', outline:'none', color: movement ? (captured ? 'var(--muted)' : 'var(--text)') : 'var(--muted)', fontSize:13, fontFamily:'inherit', cursor:'pointer', padding:0, width:'100%' }}
        >
          <option value="">— Movement —</option>
          {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </td>
      <td style={{ padding:'6px 8px', width:80 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <input
            type="number" min="1"
            value={estMinutes}
            onChange={e => setEstMinutes(e.target.value)}
            onBlur={() => { if (String(estMinutes) !== String(shot.est_minutes || '')) save('estMinutes', estMinutes ? Number(estMinutes) : null); }}
            placeholder="min"
            style={{ width:40, background:'transparent', border:'none', outline:'none', color: captured ? 'var(--muted)' : 'var(--text)', fontSize:13, fontFamily:'inherit', padding:0, MozAppearance:'textfield' }}
          />
          {estMinutes && <span style={{ fontSize:11, color:'var(--muted)' }}>m</span>}
        </div>
      </td>
      <td style={{ padding:'10px 14px 10px 8px', width:28, textAlign:'right' }}>
        <button onClick={() => onDelete(shot.id)} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:13, padding:0, lineHeight:1, opacity:0.5 }}>✕</button>
      </td>
    </tr>
  );
}

function NewShotRow({ sceneNumber, nextIndex, projectId, sceneId, onAdded }) {
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
      <td style={{ padding:'10px 8px', fontSize:13, fontWeight:700, color:'var(--muted)', width:44 }}>
        {shotLabel(sceneNumber, nextIndex)}
      </td>
      <td style={{ padding:'6px 8px' }}>
        <input
          ref={descRef}
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), submit())}
          onBlur={submit}
          placeholder="Add a shot…"
          style={{ width:'100%', background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13, fontFamily:'inherit', padding:0 }}
        />
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
            style={{ width:40, background:'transparent', border:'none', outline:'none', color:'var(--text)', fontSize:13, fontFamily:'inherit', padding:0, MozAppearance:'textfield' }}
          />
          {estMinutes && <span style={{ fontSize:11, color:'var(--muted)' }}>m</span>}
        </div>
      </td>
      <td style={{ width:28 }} />
    </tr>
  );
}

function SceneBlock({ scene, projectId, onShotUpdate, onShotAdded, onShotDelete, onEditScene, onDeleteScene }) {
  const st = SCENE_TYPE_STYLES[scene.scene_type] || SCENE_TYPE_STYLES.interior;

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
        <div style={{ display:'flex', gap:6 }}>
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
            <th style={{ width:28 }} />
          </tr>
        </thead>
        <tbody>
          {scene.shots.map((shot, i) => (
            <ShotRow key={shot.id} shot={shot} index={i} sceneNumber={scene.scene_number}
              projectId={projectId} onUpdate={onShotUpdate} onDelete={onShotDelete} />
          ))}
          <NewShotRow
            key={`new-${scene.id}`}
            sceneNumber={scene.scene_number}
            nextIndex={scene.shots.length}
            projectId={projectId}
            sceneId={scene.id}
            onAdded={shot => onShotAdded(scene.id, shot)}
          />
        </tbody>
      </table>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const fmt = time.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', second:'2-digit', hour12:true });
  return (
    <div style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px 20px', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
      <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:'.18em' }}>Current Time:&nbsp;</span>
      <span style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)', letterSpacing:'.08em', fontVariantNumeric:'tabular-nums' }}>{fmt}</span>
    </div>
  );
}

export default function ShotList({ project }) {
  const [scenes, setScenes] = useState([]);
  const [showAddScene, setShowAddScene] = useState(false);
  const [sceneForm, setSceneForm] = useState({ name: '', description: '', sceneType: 'interior' });
  const [editScene, setEditScene] = useState(null);
  const [editSceneForm, setEditSceneForm] = useState({ name: '', description: '', sceneType: 'interior' });

  useEffect(() => {
    api.getShotList(project.id).then(setScenes).catch(() => {});
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
  }

  function handleShotAdded(sceneId, shot) {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, shots: [...s.shots, shot] } : s));
  }

  function handleShotDelete(shotId) {
    api.deleteShot(project.id, shotId).catch(() => {});
    setScenes(prev => prev.map(s => ({ ...s, shots: s.shots.filter(sh => sh.id !== shotId) })));
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

      {/* Live clock */}
      <LiveClock />

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:20 }}>
        {[
          { label:'Total Shots', val: totalShots },
          { label:'Captured', val: capturedShots },
          { label:'Remaining', val: totalShots - capturedShots },
          { label:'Est. Hours', val: `${(totalMinutes / 60).toFixed(1)}h` },
        ].map(s => (
          <div key={s.label} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 20px' }}>
            <div style={{ fontSize:26, fontWeight:800, color:'var(--text)', fontFamily:"'Syne',sans-serif", letterSpacing:'-0.5px', lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:11, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', fontWeight:500, marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {scenes.length === 0 && (
        <div className="empty">No scenes yet — add one to get started.</div>
      )}

      {/* All scenes stacked */}
      {scenes.map(scene => (
        <SceneBlock
          key={scene.id}
          scene={scene}
          projectId={project.id}
          onShotUpdate={handleShotUpdate}
          onShotAdded={handleShotAdded}
          onShotDelete={handleShotDelete}
          onEditScene={s => { setEditScene(s); setEditSceneForm({ name: s.name, description: s.description || '', sceneType: s.scene_type || 'interior' }); }}
          onDeleteScene={deleteScene}
        />
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
                    <button key={t} type="button"
                      onClick={() => setSceneForm(f => ({...f, sceneType: t}))}
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
                    <button key={t} type="button"
                      onClick={() => setEditSceneForm(f => ({...f, sceneType: t}))}
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
