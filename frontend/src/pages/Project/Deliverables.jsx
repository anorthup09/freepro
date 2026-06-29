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

  useEffect(() => { api.getDeliverables(project.id).then(setItems); }, [project.id]);

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

  async function remove(id) {
    if (!confirm('Delete this deliverable?')) return;
    await api.deleteDeliverable(project.id, id);
    setItems(d => d.filter(i => i.id !== id));
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div className="page-title">Deliverables</div>
          <div className="page-sub">{project.client} · {items.length} video output{items.length !== 1 ? 's' : ''}</div>
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
                <td>
                  <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => remove(item.id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
