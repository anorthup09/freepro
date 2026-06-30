import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

const STATUSES = ['WAITING_ON_ASSETS','IN_PROGRESS','ROUGH_CUT','IN_REVIEW','APPROVED','DELIVERED'];
const STATUS_LABEL = { WAITING_ON_ASSETS:'Waiting on Assets', IN_PROGRESS:'In Progress', ROUGH_CUT:'Rough Cut', IN_REVIEW:'In Review', APPROVED:'Approved', DELIVERED:'Delivered' };
const STATUS_DOT = { WAITING_ON_ASSETS:'wait', IN_PROGRESS:'prog', ROUGH_CUT:'prog', IN_REVIEW:'prog', APPROVED:'done', DELIVERED:'done' };

export default function Deliverables({ project }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title:'', description:'', editorName:'', aspectRatio:'', resolution:'', dueDate:'', assetRef:'', musicRef:'', isUrgent:false });
  const [editId, setEditId] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editItemId, setEditItemId] = useState(null);
  const [editForm, setEditForm] = useState({ title:'', description:'', editorName:'', aspectRatio:'', resolution:'', dueDate:'', assetRef:'', musicRef:'', isUrgent:false, status:'' });

  const existingSpecs = project.techSpecs || {};
  const [ditId, setDitId] = useState(existingSpecs.dit_crew_member_id || '');
  const [ditSaving, setDitSaving] = useState(false);
  const [specs, setSpecs] = useState({
    aspectRatio: existingSpecs.aspect_ratio || '',
    resolution: existingSpecs.resolution || '',
    frameRate: existingSpecs.frame_rate || '',
  });
  const [specSaving, setSpecSaving] = useState(false);

  useEffect(() => {
    api.getDeliverables(project.id).then(setItems);
  }, [project.id]);

  // Persist the full tech_specs row, merging the editable fields here with the
  // untouched ones so nothing gets wiped (the API replaces the whole row).
  async function persistSpecs(nextSpecs, nextDitId) {
    setSpecSaving(true);
    try {
      await api.saveTechSpecs(project.id, {
        aspectRatio: nextSpecs.aspectRatio || null,
        resolution: nextSpecs.resolution || null,
        frameRate: nextSpecs.frameRate || null,
        quality: existingSpecs.quality || null,
        cameras: existingSpecs.cameras || null,
        execProducer: existingSpecs.exec_producer || null,
        onSiteEditor: existingSpecs.on_site_editor || null,
        notes: existingSpecs.notes || null,
        ditCrewMemberId: nextDitId || null,
      });
    } catch(err) { alert(err.message); }
    setSpecSaving(false);
  }

  async function saveDit(crewMemberId) {
    setDitId(crewMemberId);
    setDitSaving(true);
    await persistSpecs(specs, crewMemberId);
    setDitSaving(false);
  }

  function commitSpec() {
    persistSpecs(specs, ditId);
  }

  async function add(e) {
    e.preventDefault();
    try {
      const item = await api.createDeliverable(project.id, form);
      setItems(d => [...d, item]);
      setShowAdd(false);
      setForm({ title:'', description:'', editorName:'', aspectRatio:'', resolution:'', dueDate:'', assetRef:'', musicRef:'', isUrgent:false });
    } catch(e) { alert(e.message); }
  }

  async function updateStatus(id, status) {
    const updated = await api.updateDeliverable(project.id, id, { status });
    setItems(d => d.map(i => i.id === id ? updated : i));
    setEditId(null);
  }

  function openEdit(item) {
    setEditItemId(item.id);
    setEditForm({ title: item.title||'', description: item.description||'', editorName: item.editorName||'', aspectRatio: item.aspectRatio||'', resolution: item.resolution||'', dueDate: item.dueDate||'', assetRef: item.assetRef||'', musicRef: item.musicRef||'', isUrgent: item.isUrgent||false, status: item.status||'' });
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      const updated = await api.updateDeliverable(project.id, editItemId, editForm);
      setItems(d => d.map(i => i.id === editItemId ? updated : i));
      setEditItemId(null);
    } catch(e) { alert(e.message); }
  }

  async function remove(id) {
    if (!confirm('Delete this deliverable?')) return;
    await api.deleteDeliverable(project.id, id);
    setItems(d => d.filter(i => i.id !== id));
  }

  return (
    <div>
      <div className="page-title" style={{ marginBottom:3 }}>Post-Production</div>
      <div className="page-sub">{project.client} · {project.code}</div>

      {/* ── DIT ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:20 }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', whiteSpace:'nowrap' }}>DIT</span>
        <select
          value={ditId}
          onChange={e => saveDit(e.target.value)}
          style={{ flex:1, maxWidth:320 }}
        >
          <option value="">— Unassigned —</option>
          {(project.crewAssignments || []).filter(a => a.crewMember).map(a => (
            <option key={a.crewMember.id} value={a.crewMember.id}>
              {a.crewMember.name} — {a.position.name}
            </option>
          ))}
        </select>
        {ditSaving && <span style={{ fontSize:11, color:'var(--muted)' }}>Saving…</span>}
        {ditId && !ditSaving && (
          <span style={{ fontSize:11, color:'var(--muted)' }}>
            Managing data for this project
          </span>
        )}
      </div>

      {/* ── Technical Specs ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Technical Specs</span>
        {specSaving && <span style={{ fontSize:11, color:'var(--muted)' }}>Saving…</span>}
      </div>
      <div className="glass-grid" style={{ marginBottom:24 }}>
        {[
          { key:'aspectRatio', label:'Aspect Ratio', placeholder:'16:9' },
          { key:'resolution',  label:'Resolution',   placeholder:'3840×2160' },
          { key:'frameRate',   label:'Frame Rate',   placeholder:'23.976 fps' },
        ].map(f => (
          <div key={f.key} className="glass-tile">
            <div className="glass-tile-label">{f.label}</div>
            <input
              className="glass-tile-input"
              value={specs[f.key]}
              placeholder={f.placeholder}
              onChange={e => setSpecs(s => ({ ...s, [f.key]: e.target.value }))}
              onBlur={commitSpec}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
          </div>
        ))}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Deliverables <span style={{ fontWeight:400, color:'var(--muted)' }}>· {items.length} output{items.length !== 1 ? 's' : ''}</span></div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Deliverable</button>
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
        <table className="dtable">
          <thead><tr>
            <th>Deliverable</th>
            <th>Status</th>
            <th>Editor</th>
            <th>Specs</th>
            <th>Due</th>
            <th></th>
          </tr></thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="empty">No deliverables yet.</td></tr>
            )}
            {items.map(item => (
              <tr key={item.id}>
                <td>
                  <div style={{ fontWeight:500 }}>{item.isUrgent && <span style={{ color:'var(--orange)' }}>⚠ </span>}{item.title}</div>
                  {item.description && <div style={{ fontSize:10, color:'var(--muted)' }}>{item.description}</div>}
                  {item.musicRef && <div style={{ fontSize:10, color:'var(--purple-text)', marginTop:2 }}>♪ {item.musicRef}</div>}
                </td>
                <td>
                  {editId === item.id ? (
                    <select value={editStatus} onChange={e => { setEditStatus(e.target.value); updateStatus(item.id, e.target.value); }} style={{ width:'auto' }} autoFocus>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  ) : (
                    <div className="sdot" style={{ cursor:'pointer' }} onClick={() => { setEditId(item.id); setEditStatus(item.status); }}>
                      <div className={`sd ${STATUS_DOT[item.status]}`} />
                      {STATUS_LABEL[item.status]}
                    </div>
                  )}
                </td>
                <td><span className="epill">{item.editorName || '—'}</span></td>
                <td style={{ fontSize:11, color:'var(--tan)' }}>
                  {item.aspectRatio}{item.resolution && ` · ${item.resolution}`}
                </td>
                <td style={{ fontSize:11, color: item.isUrgent ? 'var(--orange)' : 'var(--muted)', fontWeight: item.isUrgent ? 500 : 400 }}>
                  {item.dueDate || '—'}
                </td>
                <td style={{ display:'flex', gap:4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>✎</button>
                  <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => remove(item.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editItemId && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditItemId(null)}>
          <div className="modal">
            <div className="modal-title">Edit Deliverable</div>
            <form onSubmit={saveEdit}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Title</label><input value={editForm.title} onChange={e => setEditForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field span2"><label>Description</label><input value={editForm.description} onChange={e => setEditForm(f=>({...f,description:e.target.value}))} /></div>
                <div className="field"><label>Editor</label><input value={editForm.editorName} onChange={e => setEditForm(f=>({...f,editorName:e.target.value}))} /></div>
                <div className="field"><label>Due Date</label><input value={editForm.dueDate} onChange={e => setEditForm(f=>({...f,dueDate:e.target.value}))} /></div>
                <div className="field"><label>Aspect Ratio</label><input value={editForm.aspectRatio} onChange={e => setEditForm(f=>({...f,aspectRatio:e.target.value}))} /></div>
                <div className="field"><label>Resolution</label><input value={editForm.resolution} onChange={e => setEditForm(f=>({...f,resolution:e.target.value}))} /></div>
                <div className="field"><label>Asset Ref</label><input value={editForm.assetRef} onChange={e => setEditForm(f=>({...f,assetRef:e.target.value}))} /></div>
                <div className="field"><label>Music Ref</label><input value={editForm.musicRef} onChange={e => setEditForm(f=>({...f,musicRef:e.target.value}))} /></div>
                <div className="field span2"><label>Status</label>
                  <select value={editForm.status} onChange={e => setEditForm(f=>({...f,status:e.target.value}))}>
                    {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div className="field span2" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <input type="checkbox" id="editUrgent" checked={editForm.isUrgent} onChange={e => setEditForm(f=>({...f,isUrgent:e.target.checked}))} style={{ width:'auto' }} />
                  <label htmlFor="editUrgent" style={{ textTransform:'none', letterSpacing:0, fontSize:12, color:'var(--text)' }}>Mark as urgent</label>
                </div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditItemId(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">Add Deliverable</div>
            <form onSubmit={add}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Title</label><input value={form.title} onChange={e => setForm(f=>({...f,title:e.target.value}))} placeholder="Onsite Recap Video" required /></div>
                <div className="field span2"><label>Description</label><input value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} placeholder="Plays Day 4 GS · 2 min" /></div>
                <div className="field"><label>Editor</label><input value={form.editorName} onChange={e => setForm(f=>({...f,editorName:e.target.value}))} placeholder="Jon A." /></div>
                <div className="field"><label>Due Date</label><input value={form.dueDate} onChange={e => setForm(f=>({...f,dueDate:e.target.value}))} placeholder="7 AM, 5/6" /></div>
                <div className="field"><label>Aspect Ratio</label><input value={form.aspectRatio} onChange={e => setForm(f=>({...f,aspectRatio:e.target.value}))} placeholder="16:9" /></div>
                <div className="field"><label>Resolution</label><input value={form.resolution} onChange={e => setForm(f=>({...f,resolution:e.target.value}))} placeholder="1920×1080" /></div>
                <div className="field"><label>Asset Ref</label><input value={form.assetRef} onChange={e => setForm(f=>({...f,assetRef:e.target.value}))} placeholder="Asset #801_" /></div>
                <div className="field"><label>Music Ref</label><input value={form.musicRef} onChange={e => setForm(f=>({...f,musicRef:e.target.value}))} placeholder="C3 Recap Music" /></div>
                <div className="field span2" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <input type="checkbox" id="urgent" checked={form.isUrgent} onChange={e => setForm(f=>({...f,isUrgent:e.target.checked}))} style={{ width:'auto' }} />
                  <label htmlFor="urgent" style={{ textTransform:'none', letterSpacing:0, fontSize:12, color:'var(--text)' }}>Mark as urgent</label>
                </div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Deliverable</button><button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
