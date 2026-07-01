import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';

function initials(name) {
  return name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() || '??';
}
const COLORS = ['#E8A030','#5ABF80','#8080E0','#E08080','#B080E0','#40A0A0','#D0A030','#C08080'];
function colorFor(str) { let h = 0; for (let c of str||'') h = (h*31+c.charCodeAt(0))&0xffffffff; return COLORS[Math.abs(h)%COLORS.length]; }

export default function Crew({ project, onProjectUpdate }) {
  const [assignments, setAssignments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [roster, setRoster] = useState([]);
  const [flights, setFlights] = useState([]);
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [slotForm, setSlotForm] = useState({ positionId:'', crewMemberId:'', slotNumber:1, startDate:'', endDate:'' });
  const [showAddCrew, setShowAddCrew] = useState(false);
  const [crewForm, setCrewForm] = useState({ name:'', email:'', phone:'', company:'' });
  const [rosterQuery, setRosterQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberDetail, setMemberDetail] = useState(null);
  const [memberEditing, setMemberEditing] = useState(false);
  const [memberForm, setMemberForm] = useState({});
  const [memberSaving, setMemberSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showTalentModal, setShowTalentModal] = useState(false);
  const [talentForm, setTalentForm] = useState({ name:'', role:'' });
  const [editTalent, setEditTalent] = useState(null);
  const [editTalentForm, setEditTalentForm] = useState({ name:'', role:'', phone:'', email:'', notes:'', dietaryRestrictions:'' });

  useEffect(() => {
    Promise.all([
      api.getProjectCrew(project.id),
      api.getPositions(),
      api.getCrew(),
      api.getFlights(project.id),
    ]).then(([a, p, r, f]) => { setAssignments(a); setPositions(p); setRoster(r); setFlights(f); });
  }, [project.id]);

  function flightDatesFor(crewMemberId) {
    if (!crewMemberId) return { startDate: '', endDate: '' };
    const memberFlights = flights.filter(f => f.crew_member_id === crewMemberId && f.depart_time);
    if (!memberFlights.length) return { startDate: '', endDate: '' };
    const sorted = [...memberFlights].sort((a, b) => a.depart_time.localeCompare(b.depart_time));
    return {
      startDate: sorted[0].depart_time.slice(0, 10),
      endDate: sorted[sorted.length - 1].depart_time.slice(0, 10),
    };
  }

  async function addSlot(e) {
    e.preventDefault();
    try {
      const a = await api.addCrewSlot(project.id, {
        positionId: slotForm.positionId,
        crewMemberId: slotForm.crewMemberId || null,
        slotNumber: parseInt(slotForm.slotNumber) || 1,
        startDate: slotForm.startDate || null,
        endDate: slotForm.endDate || null,
      });
      setAssignments(prev => [...prev, a]);
      setShowAddSlot(false);
      setSlotForm({ positionId:'', crewMemberId:'', slotNumber:1, startDate:'', endDate:'' });
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

  async function openMember(m) {
    setMemberEditing(false);
    setSelectedMember(m);
    const detail = await api.getCrewMember(m.id).catch(() => m);
    setMemberDetail(detail);
    setRosterQuery('');
  }

  function startEditMember() {
    setMemberForm({
      name: memberDetail.name || '',
      email: memberDetail.email || '',
      phone: memberDetail.phone || '',
      company: memberDetail.company || '',
      homeAirport: memberDetail.home_airport || '',
      notes: memberDetail.notes || '',
      dateOfBirth: memberDetail.date_of_birth?.slice(0,10) || '',
      passportNumber: memberDetail.passport_number || '',
      passportExpiry: memberDetail.passport_expiry?.slice(0,10) || '',
      knownTravelerNumber: memberDetail.known_traveler_number || '',
      seatPreference: memberDetail.seat_preference || '',
      emergencyContact: memberDetail.emergency_contact || '',
      emergencyPhone: memberDetail.emergency_phone || '',
      preferredFirstName: memberDetail.preferred_first_name || '',
      preferredLastName: memberDetail.preferred_last_name || '',
      dietaryRestrictions: memberDetail.dietary_restrictions || '',
    });
    setMemberEditing(true);
  }

  async function deleteMember() {
    if (!confirm(`Remove ${displayName(memberDetail)} from the roster? This cannot be undone.`)) return;
    await api.deleteCrewMember(memberDetail.id);
    setRoster(r => r.filter(m => m.id !== memberDetail.id));
    setSelectedMember(null);
    setMemberDetail(null);
    setMemberEditing(false);
  }

  async function saveMember(e) {
    e.preventDefault();
    setMemberSaving(true);
    try {
      const updated = await api.updateCrewMember(memberDetail.id, memberForm);
      setRoster(r => r.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      setMemberDetail(d => ({ ...d, ...updated }));
      setMemberEditing(false);
    } catch(err) { alert(err.message); }
    setMemberSaving(false);
  }

  async function saveEdit(id) {
    try {
      const updated = await api.updateCrewSlot(project.id, id, editForm);
      setAssignments(prev => prev.map(a => a.id === id ? updated : a));
      setEditId(null);
    } catch(e) { alert(e.message); }
  }

  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
  }

  async function removeSlot(id) {
    if (!confirm('Remove this position from the project?')) return;
    await api.removeCrewSlot(project.id, id);
    setAssignments(prev => prev.filter(a => a.id !== id));
  }

  async function addTalent(e) {
    e.preventDefault();
    try {
      const t = await api.createTalent(project.id, talentForm);
      if (onProjectUpdate) onProjectUpdate(p => ({ ...p, keyTalent: [...(p.keyTalent||[]), t] }));
      setShowTalentModal(false);
      setTalentForm({ name:'', role:'' });
    } catch(e) { alert(e.message); }
  }

  async function saveEditTalent(e) {
    e.preventDefault();
    try {
      const t = await api.updateTalent(project.id, editTalent.id, editTalentForm);
      if (onProjectUpdate) onProjectUpdate(p => ({ ...p, keyTalent: p.keyTalent.map(x => x.id === t.id ? { ...x, ...t } : x) }));
      setEditTalent(null);
    } catch(e) { alert(e.message); }
  }

  async function deleteTalent(id) {
    if (!confirm('Remove this talent?')) return;
    await api.deleteTalent(project.id, id);
    if (onProjectUpdate) onProjectUpdate(p => ({ ...p, keyTalent: p.keyTalent.filter(t => t.id !== id) }));
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
        <button className="btn btn-primary" onClick={() => setShowAddSlot(true)}>+ Add Position</button>
      </div>

      {assignments.length === 0 && <div className="empty">No crew assigned yet. Add a position to get started.</div>}

      {assignments.length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          <table className="pos-table" style={{ width:'100%' }}>
            <thead>
              <tr>
                <th>Position</th>
                <th>Crew Member</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Start Date</th>
                <th>End Date</th>
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
                      <select value={editForm.crewMemberId || ''} onChange={e => {
                        const id = e.target.value;
                        const dates = flightDatesFor(id);
                        setEditForm(f => ({ ...f, crewMemberId: id||null, startDate: f.startDate || dates.startDate, endDate: f.endDate || dates.endDate }));
                      }} style={{ width:'100%' }}>
                        <option value="">— Unassigned —</option>
                        {roster.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    ) : (
                      a.crewMember ? (
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div className="av" style={{ width:26, height:26, fontSize:9, background: colorFor(a.crewMember.name)+'22', color: colorFor(a.crewMember.name) }}>
                            {initials(a.crewMember.name)}
                          </div>
                          <div style={{ fontSize:12, fontWeight:500 }}>{displayName(a.crewMember)}</div>
                        </div>
                      ) : <span style={{ color:'var(--muted)', fontSize:11 }}>— Unassigned —</span>
                    )}
                  </td>
                  <td style={{ fontSize:11, color:'var(--tan)', whiteSpace:'nowrap' }}>{a.crewMember?.phone || '—'}</td>
                  <td style={{ fontSize:11, color:'var(--muted)' }}>{a.crewMember?.email || '—'}</td>
                  <td>
                    {editId === a.id
                      ? <input type="date" style={{ width:130 }} value={editForm.startDate||''} onChange={e => setEditForm(f=>({...f,startDate:e.target.value}))} />
                      : <span style={{ fontSize:11, color:'var(--orange)' }}>{fmtDate(a.start_date)}</span>
                    }
                  </td>
                  <td>
                    {editId === a.id
                      ? <input type="date" style={{ width:130 }} value={editForm.endDate||''} onChange={e => setEditForm(f=>({...f,endDate:e.target.value}))} />
                      : <span style={{ fontSize:11, color:'var(--orange)' }}>{fmtDate(a.end_date)}</span>
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
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(a.id); const dates = flightDatesFor(a.crewMemberId); setEditForm({ crewMemberId: a.crewMemberId||'', startDate: a.start_date || dates.startDate, endDate: a.end_date || dates.endDate }); }}>Edit</button>
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

      {/* Talent */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:24, marginBottom:6 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Talent</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTalentModal(true)}>+ Add</button>
      </div>
      {(project.keyTalent||[]).length === 0
        ? <div className="empty" style={{ marginBottom:16 }}>No talent added yet.</div>
        : (
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
            <table className="pos-table" style={{ width:'100%' }}>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Dietary</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(project.keyTalent||[]).map(t => (
                  <tr key={t.id}>
                    <td><div className="pos-name">{t.role}</div></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="av" style={{ width:26, height:26, fontSize:9, background: colorFor(t.name)+'22', color: colorFor(t.name) }}>{initials(t.name)}</div>
                        <div style={{ fontSize:12, fontWeight:500 }}>{t.name}</div>
                      </div>
                    </td>
                    <td style={{ fontSize:11, color:'var(--tan)', whiteSpace:'nowrap' }}>{t.phone || '—'}</td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{t.email || '—'}</td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{t.dietary_restrictions || '—'}</td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{t.notes || '—'}</td>
                    <td style={{ textAlign:'right' }}>
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditTalent(t); setEditTalentForm({ name: t.name, role: t.role, phone: t.phone||'', email: t.email||'', notes: t.notes||'', dietaryRestrictions: t.dietary_restrictions||'' }); }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => deleteTalent(t.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }

      {/* Roster Look-Up */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:24 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Roster Look-Up</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAddCrew(true)}>+ New Person</button>
      </div>
      <input
        value={rosterQuery}
        onChange={e => setRosterQuery(e.target.value)}
        placeholder="Search by name, email, or company…"
        style={{ marginBottom:8 }}
      />
      {rosterQuery.trim().length > 0 && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
          {roster.filter(m => {
            const q = rosterQuery.toLowerCase();
            return m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.company?.toLowerCase().includes(q);
          }).slice(0,10).map(m => (
            <div key={m.id}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}
              onClick={() => openMember(m)}
            >
              <div className="av" style={{ width:28, height:28, fontSize:10, flexShrink:0, background: colorFor(m.name)+'22', color: colorFor(m.name) }}>{initials(m.name)}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:500 }}>{displayName(m)}</div>
                {displayName(m) !== m.name && <div style={{ fontSize:10, color:'var(--muted)' }}>Legal: {m.name}</div>}
                <div style={{ fontSize:10, color:'var(--muted)' }}>{[m.company, m.email].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
          {roster.filter(m => {
            const q = rosterQuery.toLowerCase();
            return m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.company?.toLowerCase().includes(q);
          }).length === 0 && <div className="empty" style={{ padding:'10px 14px' }}>No match found.</div>}
        </div>
      )}

      {/* Crew Member Detail Panel */}
      {selectedMember && memberDetail && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px 18px', marginBottom:12 }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div className="av" style={{ width:36, height:36, fontSize:12, flexShrink:0, background: colorFor(memberDetail.name)+'22', color: colorFor(memberDetail.name) }}>{initials(memberDetail.name)}</div>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{displayName(memberDetail)}</div>
                {displayName(memberDetail) !== memberDetail.name && <div style={{ fontSize:10, color:'var(--muted)' }}>Legal: {memberDetail.name}</div>}
                <div style={{ fontSize:11, color:'var(--muted)' }}>{[memberDetail.company, memberDetail.home_airport].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {!memberEditing && <button className="btn btn-ghost btn-sm" onClick={startEditMember}>Edit</button>}
              {!memberEditing && <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e08080)' }} onClick={deleteMember}>Delete</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => { setSelectedMember(null); setMemberEditing(false); }}>✕</button>
            </div>
          </div>

          {memberEditing ? (
            <form onSubmit={saveMember}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:6 }}>Contact</div>
              <div className="form-grid" style={{ marginBottom:14 }}>
                <div className="field span2"><label>Legal Full Name</label><input value={memberForm.name} onChange={e => setMemberForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Preferred First Name</label><input value={memberForm.preferredFirstName} onChange={e => setMemberForm(f=>({...f,preferredFirstName:e.target.value}))} placeholder="Leave blank to use legal name" /></div>
                <div className="field"><label>Preferred Last Name</label><input value={memberForm.preferredLastName} onChange={e => setMemberForm(f=>({...f,preferredLastName:e.target.value}))} placeholder="Leave blank to use legal name" /></div>
                <div className="field"><label>Email</label><input type="email" value={memberForm.email} onChange={e => setMemberForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={memberForm.phone} onChange={e => setMemberForm(f=>({...f,phone:e.target.value}))} /></div>
                <div className="field"><label>Company / Role</label><input value={memberForm.company} onChange={e => setMemberForm(f=>({...f,company:e.target.value}))} /></div>
                <div className="field"><label>Home Airport</label><input value={memberForm.homeAirport} onChange={e => setMemberForm(f=>({...f,homeAirport:e.target.value}))} placeholder="STL" /></div>
                <div className="field span2"><label>Dietary Restrictions</label><input value={memberForm.dietaryRestrictions} onChange={e => setMemberForm(f=>({...f,dietaryRestrictions:e.target.value}))} placeholder="Vegetarian, gluten-free, nut allergy…" /></div>
              </div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:6 }}>Travel Info</div>
              <div className="form-grid" style={{ marginBottom:14 }}>
                <div className="field"><label>Date of Birth</label><input type="date" value={memberForm.dateOfBirth} onChange={e => setMemberForm(f=>({...f,dateOfBirth:e.target.value}))} /></div>
                <div className="field"><label>Seat Preference</label>
                  <select value={memberForm.seatPreference} onChange={e => setMemberForm(f=>({...f,seatPreference:e.target.value}))}>
                    <option value="">— No preference —</option>
                    <option value="Window">Window</option>
                    <option value="Aisle">Aisle</option>
                    <option value="Middle">Middle</option>
                  </select>
                </div>
                <div className="field"><label>Passport Number</label><input value={memberForm.passportNumber} onChange={e => setMemberForm(f=>({...f,passportNumber:e.target.value}))} /></div>
                <div className="field"><label>Passport Expiry</label><input type="date" value={memberForm.passportExpiry} onChange={e => setMemberForm(f=>({...f,passportExpiry:e.target.value}))} /></div>
                <div className="field span2"><label>Known Traveler # (TSA PreCheck / Global Entry)</label><input value={memberForm.knownTravelerNumber} onChange={e => setMemberForm(f=>({...f,knownTravelerNumber:e.target.value}))} /></div>
                <div className="field span2"><label>FF Numbers &amp; Notes</label><textarea value={memberForm.notes} onChange={e => setMemberForm(f=>({...f,notes:e.target.value}))} rows={4} /></div>
              </div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:6 }}>Emergency Contact</div>
              <div className="form-grid" style={{ marginBottom:14 }}>
                <div className="field"><label>Name</label><input value={memberForm.emergencyContact} onChange={e => setMemberForm(f=>({...f,emergencyContact:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={memberForm.emergencyPhone} onChange={e => setMemberForm(f=>({...f,emergencyPhone:e.target.value}))} /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" disabled={memberSaving}>{memberSaving ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setMemberEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 24px', fontSize:12 }}>
              {(memberDetail.preferred_first_name || memberDetail.preferred_last_name) && <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--muted)' }}>Preferred Name </span>{[memberDetail.preferred_first_name, memberDetail.preferred_last_name].filter(Boolean).join(' ')}</div>}
              {memberDetail.email && <div><span style={{ color:'var(--muted)' }}>Email </span>{memberDetail.email}</div>}
              {memberDetail.phone && <div><span style={{ color:'var(--muted)' }}>Phone </span>{memberDetail.phone}</div>}
              {memberDetail.dietary_restrictions && <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--muted)' }}>Dietary </span>{memberDetail.dietary_restrictions}</div>}
              {memberDetail.date_of_birth && <div><span style={{ color:'var(--muted)' }}>DOB </span>{new Date(memberDetail.date_of_birth.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>}
              {memberDetail.seat_preference && <div><span style={{ color:'var(--muted)' }}>Seat </span>{memberDetail.seat_preference}</div>}
              {memberDetail.passport_number && <div><span style={{ color:'var(--muted)' }}>Passport </span>{memberDetail.passport_number}{memberDetail.passport_expiry ? ` (exp ${new Date(memberDetail.passport_expiry.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month:'short', year:'numeric' })})` : ''}</div>}
              {memberDetail.known_traveler_number && <div><span style={{ color:'var(--muted)' }}>KTN </span>{memberDetail.known_traveler_number}</div>}
              {memberDetail.emergency_contact && <div><span style={{ color:'var(--muted)' }}>Emergency </span>{memberDetail.emergency_contact}{memberDetail.emergency_phone ? ` · ${memberDetail.emergency_phone}` : ''}</div>}
              {memberDetail.notes && <div style={{ gridColumn:'1/-1', marginTop:4, whiteSpace:'pre-wrap', color:'var(--muted)', fontSize:11, borderTop:'1px solid var(--border)', paddingTop:6 }}>{memberDetail.notes}</div>}
              {memberDetail.assignments?.length > 0 && (
                <div style={{ gridColumn:'1/-1', marginTop:6, borderTop:'1px solid var(--border)', paddingTop:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:4 }}>Project History</div>
                  {memberDetail.assignments.map(a => (
                    <div key={a.id} style={{ fontSize:11, color:'var(--muted)', padding:'2px 0' }}>
                      <span style={{ color:'var(--text)', fontWeight:500 }}>{a.code}</span> · {a.title} · {a.position_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
                  <select value={slotForm.crewMemberId} onChange={e => {
                    const id = e.target.value;
                    const dates = flightDatesFor(id);
                    setSlotForm(f => ({ ...f, crewMemberId: id, startDate: dates.startDate || f.startDate, endDate: dates.endDate || f.endDate }));
                  }}>
                    <option value="">— Unassigned —</option>
                    {roster.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <span style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>Can't find them? Add via "New Person" first.</span>
                </div>
                <div className="field">
                  <label>Start Date</label>
                  <input type="date" value={slotForm.startDate} onChange={e => setSlotForm(f=>({...f,startDate:e.target.value}))} />
                </div>
                <div className="field">
                  <label>End Date</label>
                  <input type="date" value={slotForm.endDate} onChange={e => setSlotForm(f=>({...f,endDate:e.target.value}))} />
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

      {/* Edit Talent Modal */}
      {editTalent && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditTalent(null)}>
          <div className="modal">
            <div className="modal-title">Edit Talent — {editTalent.name}</div>
            <form onSubmit={saveEditTalent}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={editTalentForm.name} onChange={e => setEditTalentForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Role / Title</label><input value={editTalentForm.role} onChange={e => setEditTalentForm(f=>({...f,role:e.target.value}))} required /></div>
                <div className="field"><label>Phone</label><input value={editTalentForm.phone} onChange={e => setEditTalentForm(f=>({...f,phone:e.target.value}))} placeholder="555-123-4567" /></div>
                <div className="field"><label>Email</label><input type="email" value={editTalentForm.email} onChange={e => setEditTalentForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Dietary Restrictions</label><input value={editTalentForm.dietaryRestrictions} onChange={e => setEditTalentForm(f=>({...f,dietaryRestrictions:e.target.value}))} placeholder="Vegetarian, nut allergy…" /></div>
                <div className="field span2"><label>Notes</label><textarea value={editTalentForm.notes} onChange={e => setEditTalentForm(f=>({...f,notes:e.target.value}))} rows={3} /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditTalent(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Talent Modal */}
      {showTalentModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowTalentModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Talent</div>
            <form onSubmit={addTalent}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={talentForm.name} onChange={e => setTalentForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Role / Title</label><input value={talentForm.role} onChange={e => setTalentForm(f=>({...f,role:e.target.value}))} required /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Talent</button><button type="button" className="btn btn-ghost" onClick={() => setShowTalentModal(false)}>Cancel</button></div>
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
