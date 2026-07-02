import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

const DISTANCES = ['Wide', 'Medium', 'Close', 'ECU', 'OTS', 'Two-Shot', 'Insert'];
const MOVEMENTS = ['Static', 'Pan', 'Tilt', 'Dolly', 'Handheld', 'Crane', 'Zoom', 'Gimbal'];
const PRIORITIES = ['Essential', 'Important', 'Nice to Have'];

const PRIORITY_COLOR = {
  Essential: '#f97316',
  Important: '#f59e0b',
  'Nice to Have': 'var(--muted)',
};

function shotLabel(sceneNumber, index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return `${sceneNumber}${letters[index] || index}`;
}

export default function ShotList({ project }) {
  const [scenes, setScenes] = useState([]);
  const [activeSceneId, setActiveSceneId] = useState(null);
  const [showAddScene, setShowAddScene] = useState(false);
  const [sceneForm, setSceneForm] = useState({ name: '', description: '' });
  const [editSceneId, setEditSceneId] = useState(null);
  const [editSceneForm, setEditSceneForm] = useState({ name: '', description: '' });
  const [showAddShot, setShowAddShot] = useState(false);
  const [shotForm, setShotForm] = useState({ description: '', distance: '', movement: '', priority: 'Important', estMinutes: 9 });
  const [editShotId, setEditShotId] = useState(null);
  const [editShotForm, setEditShotForm] = useState({ description: '', distance: '', movement: '', priority: 'Important', estMinutes: 9 });

  useEffect(() => {
    api.getShotList(project.id).then(data => {
      setScenes(data);
      if (data.length > 0 && !activeSceneId) setActiveSceneId(data[0].id);
    }).catch(() => {});
  }, [project.id]);

  const totalShots = scenes.reduce((s, sc) => s + sc.shots.length, 0);
  const totalMinutes = scenes.reduce((s, sc) => s + sc.shots.reduce((a, sh) => a + (sh.est_minutes || 0), 0), 0);
  const estHours = (totalMinutes / 60).toFixed(1);
  const activeScene = scenes.find(s => s.id === activeSceneId);

  async function addScene(e) {
    e.preventDefault();
    try {
      const scene = await api.createScene(project.id, sceneForm);
      setScenes(prev => [...prev, scene]);
      setActiveSceneId(scene.id);
      setShowAddScene(false);
      setSceneForm({ name: '', description: '' });
    } catch(err) { alert(err.message); }
  }

  async function saveScene(e) {
    e.preventDefault();
    try {
      const updated = await api.updateScene(project.id, editSceneId, editSceneForm);
      setScenes(prev => prev.map(s => s.id === editSceneId ? { ...s, ...updated } : s));
      setEditSceneId(null);
    } catch(err) { alert(err.message); }
  }

  async function deleteScene(sceneId) {
    if (!confirm('Delete this scene and all its shots?')) return;
    await api.deleteScene(project.id, sceneId);
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    if (activeSceneId === sceneId) setActiveSceneId(scenes.find(s => s.id !== sceneId)?.id || null);
  }

  async function addShot(e) {
    e.preventDefault();
    if (!activeSceneId) return;
    try {
      const shot = await api.createShot(project.id, activeSceneId, { ...shotForm, estMinutes: Number(shotForm.estMinutes) });
      setScenes(prev => prev.map(s => s.id === activeSceneId ? { ...s, shots: [...s.shots, shot] } : s));
      setShowAddShot(false);
      setShotForm({ description: '', distance: '', movement: '', priority: 'Important', estMinutes: 9 });
    } catch(err) { alert(err.message); }
  }

  async function saveShot(e) {
    e.preventDefault();
    try {
      const updated = await api.updateShot(project.id, editShotId, { ...editShotForm, estMinutes: Number(editShotForm.estMinutes) });
      setScenes(prev => prev.map(s => ({ ...s, shots: s.shots.map(sh => sh.id === editShotId ? updated : sh) })));
      setEditShotId(null);
    } catch(err) { alert(err.message); }
  }

  async function toggleCapture(shot) {
    const status = shot.status === 'captured' ? 'not_captured' : 'captured';
    const updated = await api.updateShot(project.id, shot.id, { status });
    setScenes(prev => prev.map(s => ({ ...s, shots: s.shots.map(sh => sh.id === shot.id ? updated : sh) })));
  }

  async function deleteShot(shotId) {
    await api.deleteShot(project.id, shotId);
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

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, margin:'20px 0' }}>
        {[
          { label:'Total Shots', val: totalShots },
          { label:'Scenes', val: scenes.length },
          { label:'Est. Hours', val: `${estHours}h` },
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

      {/* Scene grid */}
      {scenes.length > 0 && (
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', fontWeight:700, marginBottom:10 }}>Scenes</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:8 }}>
            {scenes.map(s => (
              <button key={s.id} onClick={() => setActiveSceneId(s.id)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'var(--bg2)', border:`1px solid ${s.id === activeSceneId ? 'var(--orange)' : 'var(--border)'}`, borderRadius:8, cursor:'pointer', textAlign:'left', transition:'border-color 0.15s' }}>
                <span style={{ flexShrink:0, width:24, height:24, borderRadius:'50%', border:`2px solid ${s.id === activeSceneId ? 'var(--orange)' : 'var(--border)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color: s.id === activeSceneId ? 'var(--orange)' : 'var(--muted)' }}>{s.scene_number}</span>
                <span style={{ fontSize:12, fontWeight:600, color:'var(--text)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</span>
                <span style={{ fontSize:11, color:'var(--muted)', flexShrink:0 }}>{s.shots.length}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active scene detail */}
      {activeScene && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
          {/* Scene header */}
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                  <span style={{ fontSize:10, fontWeight:700, color:'var(--orange)', textTransform:'uppercase', letterSpacing:'.08em', border:'1px solid var(--orange)', borderRadius:4, padding:'2px 8px' }}>Scene {activeScene.scene_number}</span>
                  <span style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>{activeScene.name}</span>
                  <span style={{ fontSize:12, color:'var(--muted)', marginLeft:'auto' }}>{activeScene.shots.length} shot{activeScene.shots.length !== 1 ? 's' : ''}</span>
                </div>
                {activeScene.description && <div style={{ fontSize:12, color:'var(--muted)' }}>{activeScene.description}</div>}
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditSceneId(activeScene.id); setEditSceneForm({ name: activeScene.name, description: activeScene.description || '' }); }}>Edit</button>
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--muted)' }} onClick={() => deleteScene(activeScene.id)}>Delete</button>
              </div>
            </div>
          </div>

          {/* Shots table */}
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--border)' }}>
                {['Shot','Description','Distance','Movement','Priority','Time',''].map(h => (
                  <th key={h} style={{ padding:'8px 12px', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', textAlign: h === 'Time' || h === '' ? 'right' : 'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeScene.shots.map((shot, i) => (
                <tr key={shot.id} style={{ borderBottom:'1px solid var(--border)', background: shot.status === 'captured' ? 'rgba(74,222,128,0.04)' : 'transparent' }}>
                  <td style={{ padding:'12px', fontSize:13, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap' }}>{shotLabel(activeScene.scene_number, i)}</td>
                  <td style={{ padding:'12px', fontSize:13, color:'var(--text)', maxWidth:260 }}>{shot.description || '—'}</td>
                  <td style={{ padding:'12px', fontSize:13, color:'var(--muted)', whiteSpace:'nowrap' }}>{shot.distance || '—'}</td>
                  <td style={{ padding:'12px', fontSize:13, color:'var(--muted)', whiteSpace:'nowrap' }}>{shot.movement || '—'}</td>
                  <td style={{ padding:'12px', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:12, fontWeight:600, color: PRIORITY_COLOR[shot.priority] || 'var(--muted)' }}>{shot.priority}</span>
                  </td>
                  <td style={{ padding:'12px', textAlign:'right', whiteSpace:'nowrap' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:8 }}>
                      <span style={{ fontSize:12, color:'var(--muted)' }}>{shot.est_minutes}m</span>
                      <div onClick={() => toggleCapture(shot)} title={shot.status === 'captured' ? 'Mark not captured' : 'Mark captured'}
                        style={{ width:10, height:10, borderRadius:'50%', background: shot.status === 'captured' ? '#4ade80' : 'transparent', border:`2px solid ${shot.status === 'captured' ? '#4ade80' : 'var(--muted)'}`, cursor:'pointer', flexShrink:0 }} />
                    </div>
                  </td>
                  <td style={{ padding:'12px', textAlign:'right', whiteSpace:'nowrap' }}>
                    <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => { setEditShotId(shot.id); setEditShotForm({ description: shot.description||'', distance: shot.distance||'', movement: shot.movement||'', priority: shot.priority||'Important', estMinutes: shot.est_minutes||9 }); }}>Edit</button>
                    <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, marginLeft:6 }} onClick={() => deleteShot(shot.id)}>✕</button>
                  </td>
                </tr>
              ))}
              {activeScene.shots.length === 0 && (
                <tr><td colSpan={7} style={{ padding:'20px 12px', fontSize:12, color:'var(--muted)', textAlign:'center', fontStyle:'italic' }}>No shots yet</td></tr>
              )}
            </tbody>
          </table>
          <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddShot(true)}>+ Add Shot</button>
          </div>
        </div>
      )}

      {/* Add Scene Modal */}
      {showAddScene && (
        <div className="modal-backdrop" onClick={() => setShowAddScene(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Scene</div>
            <form onSubmit={addScene}>
              <div className="field"><label>Scene Name *</label><input value={sceneForm.name} onChange={e => setSceneForm(f => ({...f, name: e.target.value}))} placeholder="INT. CASEY'S WORTHINGTON - TEAM FLOOR" required autoFocus /></div>
              <div className="field"><label>Description</label><input value={sceneForm.description} onChange={e => setSceneForm(f => ({...f, description: e.target.value}))} placeholder="Brief scene description" /></div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button type="submit" className="btn btn-primary btn-sm">Add Scene</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddScene(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Scene Modal */}
      {editSceneId && (
        <div className="modal-backdrop" onClick={() => setEditSceneId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Scene</div>
            <form onSubmit={saveScene}>
              <div className="field"><label>Scene Name *</label><input value={editSceneForm.name} onChange={e => setEditSceneForm(f => ({...f, name: e.target.value}))} required autoFocus /></div>
              <div className="field"><label>Description</label><input value={editSceneForm.description} onChange={e => setEditSceneForm(f => ({...f, description: e.target.value}))} /></div>
              <div style={{ display:'flex', gap:8, marginTop:16 }}>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditSceneId(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Shot Modal */}
      {showAddShot && (
        <div className="modal-backdrop" onClick={() => setShowAddShot(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Add Shot — Scene {activeScene?.scene_number}</div>
            <form onSubmit={addShot} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="field span2"><label>Description</label><textarea value={shotForm.description} onChange={e => setShotForm(f => ({...f, description: e.target.value}))} placeholder="Hero group shot. Floor team smiling, waving at camera." rows={2} style={{ resize:'vertical' }} autoFocus /></div>
              <div className="field">
                <label>Distance</label>
                <select value={shotForm.distance} onChange={e => setShotForm(f => ({...f, distance: e.target.value}))}>
                  <option value="">— Select —</option>
                  {DISTANCES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Movement</label>
                <select value={shotForm.movement} onChange={e => setShotForm(f => ({...f, movement: e.target.value}))}>
                  <option value="">— Select —</option>
                  {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Priority</label>
                <select value={shotForm.priority} onChange={e => setShotForm(f => ({...f, priority: e.target.value}))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field"><label>Est. Minutes</label><input type="number" min="1" value={shotForm.estMinutes} onChange={e => setShotForm(f => ({...f, estMinutes: e.target.value}))} /></div>
              <div className="span2" style={{ display:'flex', gap:8, marginTop:4 }}>
                <button type="submit" className="btn btn-primary btn-sm">Add Shot</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAddShot(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shot Modal */}
      {editShotId && (
        <div className="modal-backdrop" onClick={() => setEditShotId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Edit Shot</div>
            <form onSubmit={saveShot} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="field span2"><label>Description</label><textarea value={editShotForm.description} onChange={e => setEditShotForm(f => ({...f, description: e.target.value}))} rows={2} style={{ resize:'vertical' }} autoFocus /></div>
              <div className="field">
                <label>Distance</label>
                <select value={editShotForm.distance} onChange={e => setEditShotForm(f => ({...f, distance: e.target.value}))}>
                  <option value="">— Select —</option>
                  {DISTANCES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Movement</label>
                <select value={editShotForm.movement} onChange={e => setEditShotForm(f => ({...f, movement: e.target.value}))}>
                  <option value="">— Select —</option>
                  {MOVEMENTS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Priority</label>
                <select value={editShotForm.priority} onChange={e => setEditShotForm(f => ({...f, priority: e.target.value}))}>
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field"><label>Est. Minutes</label><input type="number" min="1" value={editShotForm.estMinutes} onChange={e => setEditShotForm(f => ({...f, estMinutes: e.target.value}))} /></div>
              <div className="span2" style={{ display:'flex', gap:8, marginTop:4 }}>
                <button type="submit" className="btn btn-primary btn-sm">Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditShotId(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
