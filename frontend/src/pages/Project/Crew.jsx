import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

function initials(name) {
  return name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '??';
}
const COLORS = ['#E8A030','#5ABF80','#8080E0','#E08080','#B080E0','#40A0A0','#D0A030','#C08080'];
function colorFor(str) { let h = 0; for (let c of str||'') h = (h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; }

export default function Crew({ project }) {
  const [assignments, setAssignments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [roster, setRoster] = useState([]);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [slotForm, setSlotForm] = useState({ positionId:'', crewMemberId:'', slotNumber:1, callTime:'', daysActive:'' });
  const [showAddCrew, setShowAddCrew] = useState(false);
  const [crewForm, setCrewForm] = useState({ name:'', email:'', phone:'', company:'' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    Promise.all([
      api.getProjectCrew(project.id),
      api.getPositions(),
      api.getCrew(),
    ]).then(([a, p, r]) => { setAssignments(a); setPositions(p); setRoster(r); });
  }, [project.id]);

  async function addSlot(e) {
    e.preventDefault();
    try {
      const a = await api.addCrewSlot(project.id, {
        ...slotForm,
        slotNumber: parseInt(slotForm.slotNumber) || 1,
        crewMemberId: slotForm.crewMemberId || null,
      });
      setAssignments(prev => [...prev, a]);
      setShowAddSlot(false);
      setSlotForm({ positionId:'', crewMemberId:'', slotNumber:1, callTime:'', daysActive:'' });
    } catch(e) { alert(e.message); }
  }

  async function addCrewMember(e) {
    e.preventDefault();
    try {
      const m = await api.createCrewMember(crewForm);
      setRoster(r => [...r, m]);
      setShowAddCrew(false);
      setCrewForm({ name:'', email:'', phone:'', company:'' });
    } catch(e) { alert(e.message); }
  }

  async function saveEdit(id) {
    try {
      const updated = await api.updateCrewSlot(project.id, id, editForm);
      setAssignments(prev => prev.map(a => a.id === id ? updated : a));
      setEditId(null);
    } catch(e) { alert(e.message); }
  }

  async function removeSlot(id) {
    if (!confirm('Remove this position from the project?')) return;
    await api.removeCrewSlot(project.id, id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  }

  // Count existing slots per position so we can suggest next slot number
  function nextSlot(positionId) {
    return assignments.filter(a => a.positionId === positionId).length + 1;
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
        <div>
          <div className="page-title">Crew</div>
          <div className="page-sub">{assignments.length} position{assignments.length !== 1 ? 's' : ''} assigned</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCrew(true)}>+ New Person</button>
          <button className="btn btn-primary" onClick={() => setShowAddSlot(true)}>+ Add Position</button>
        </div>
      </div>

      {assignments.length === 0 && <div className="empty">No crew assigned yet. Add a position to get started.</div>}

      {assignments.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          <table className="pos-table" style={{ width:'100%' }}>
            <thead>
              <tr>
                <th>Position</th>
                <th>Crew Member</th>
                <th>Call Time</th>
                <th>Days Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id}>
                  <td>
                    <div className="pos-name">{a.position.name}</div>
                    {a.slotNumber > 1 && <div className="pos-slot">Slot {a.slotNumber}</div>}
                  </td>
                  <td>
                    {editId === a.id ? (
                      <select value={editForm.crewMemberId || ''} onChange={e => setEditForm(f=>({...f,crewMemberId:e.target.value||null}))} style={{ width:'100%' }}>
                        <option value="">— Unassigned —</option>
                        {roster.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    ) : (
                      a.crewMember ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="av" style={{ width:26, height:26, fontSize:9, background: colorFor(a.crewMember.name)+'22', color: colorFor(a.crewMember.name) }}>
                            {initials(a.crewMember.name)}
                          </div>
                          <div>
                            <div style={{ fontSize:12, fontWeight:500 }}>{a.crewMember.name}</div>
                            {a.crewMember.phone && <div style={{ fontSize:10, color:'var(--muted)' }}>{a.crewMember.phone}</div>}
                          </div>
                        </div>
                      ) : <span style={{ color:'var(--muted)', fontSize:11 }}>— Unassigned —</span>
                    )}
                  </td>
                  <td>
                    {editId === a.id
                      ? <input style={{ width:90 }} value={editForm.callTime||''} onChange={e => setEditForm(f=>({...f,callTime:e.target.value}))} placeholder="7:30 AM" />
                      : <span style={{ color:'var(--orange)', fontSize:11, fontWeight:500 }}>{a.callTime || '—'}</span>
                    }
                  </td>
                  <td>
                    {editId === a.id
                      ? <input value={editForm.daysActive||''} onChange={e => setEditForm(f=>({...f,daysActive:e.target.value}))} placeholder="All days" />
                      : <span style={{ fontSize:11, color:'var(--muted)' }}>{a.daysActive || 'All days'}</span>
                    }
                  </td>
                  <td style={{ textAlign:'right' }}>
                    {editId === a.id ? (
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(a.id)}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(a.id); setEditForm({ crewMemberId: a.crewMemberId||'', callTime: a.callTime||'', daysActive: a.daysActive||'' }); }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => removeSlot(a.id)}>✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Roster reference */}
      <div className="sec-lbl">Full Roster</div>
      <div className="crew-grid">
        {roster.map(m => (
          <div key={m.id} className="cc">
            <div className="av" style={{ background: colorFor(m.name)+'22', color: colorFor(m.name) }}>{initials(m.name)}</div>
            <div style={{ flex:1 }}>
              <div className="cc-name">{m.name}</div>
              <div className="cc-contact">
                {m.email && <>{m.email}<br/></>}
                {m.phone}
                {m.company && <> · {m.company}</>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Position Slot Modal */}
      {showAddSlot && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAddSlot(false)}>
          <div className="modal">
            <div className="modal-title">Add Position to Project</div>
            <form onSubmit={addSlot}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2">
                  <label>Position</label>
                  <select value={slotForm.positionId} onChange={e => {
                    const pid = e.target.value;
                    setSlotForm(f=>({ ...f, positionId: pid, slotNumber: nextSlot(pid) }));
                  }} required>
                    <option value="">Select position…</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field span2">
                  <label>Crew Member</label>
                  <select value={slotForm.crewMemberId} onChange={e => setSlotForm(f=>({...f,crewMemberId:e.target.value}))}>
                    <option value="">— Unassigned —</option>
                    {roster.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <span style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>Can't find them? Add via "New Person" first.</span>
                </div>
                <div className="field">
                  <label>Call Time</label>
                  <input value={slotForm.callTime} onChange={e => setSlotForm(f=>({...f,callTime:e.target.value}))} placeholder="7:30 AM" />
                </div>
                <div className="field">
                  <label>Days Active</label>
                  <input value={slotForm.daysActive} onChange={e => setSlotForm(f=>({...f,daysActive:e.target.value}))} placeholder="All days / 5/4 & 5/5 only" />
                </div>
                {slotForm.positionId && nextSlot(slotForm.positionId) > 1 && (
                  <div className="field span2" style={{ background:'var(--amber-bg)', border:'1px solid var(--amber-border)', borderRadius:6, padding:'8px 10px', color:'var(--amber-text)', fontSize:11 }}>
                    This adds slot {nextSlot(slotForm.positionId)} for this position (e.g. Audio {nextSlot(slotForm.positionId)})
                  </div>
                )}
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add to Project</button><button type="button" className="btn btn-ghost" onClick={() => setShowAddSlot(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Crew Member Modal */}
      {showAddCrew && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAddCrew(false)}>
          <div className="modal">
            <div className="modal-title">Add New Crew Member</div>
            <form onSubmit={addCrewMember}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Full Name</label><input value={crewForm.name} onChange={e => setCrewForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={crewForm.email} onChange={e => setCrewForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={crewForm.phone} onChange={e => setCrewForm(f=>({...f,phone:e.target.value}))} /></div>
                <div className="field span2"><label>Company</label><input value={crewForm.company} onChange={e => setCrewForm(f=>({...f,company:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save to Roster</button><button type="button" className="btn btn-ghost" onClick={() => setShowAddCrew(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
