import React, { useState } from 'react';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';

const LOC_TYPES = ['PRIMARY_VENUE','CREW_HOTEL','SECONDARY','AIRPORT','OTHER'];
const LOC_LABELS = { PRIMARY_VENUE:'Shooting Location', CREW_HOTEL:'Hotel', SECONDARY:'Rental Car Location', AIRPORT:'Airport', OTHER:'Other' };
const LOC_TAG = { PRIMARY_VENUE:'main', CREW_HOTEL:'crew', SECONDARY:'sec', AIRPORT:'sec', OTHER:'sec' };

const LOC_GROUPS = [
  { label: 'Shooting Locations', types: ['PRIMARY_VENUE','SECONDARY'], icon: '🎬' },
  { label: 'Hotels',             types: ['CREW_HOTEL'],                icon: '🏨' },
  { label: 'Airports',           types: ['AIRPORT'],                   icon: '✈️'  },
  { label: 'Rental Car',         types: ['OTHER'],                     icon: '🚗' },
];

function fmtDate(d) {
  if (!d) return '';
  return new Date(d.slice(0,10) + 'T12:00:00').toLocaleDateString();
}

export default function Overview({ project, setProject, onTabChange }) {
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState({ code: project.code, title: project.title, client: project.client, city: project.city, state: project.state, startDate: (project.start_date||project.startDate)?.slice(0,10), endDate: (project.end_date||project.endDate)?.slice(0,10), status: project.status, notes: project.notes || '' });
  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ name:'', address:'', type:'PRIMARY_VENUE', emoji:'' });
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [editContactId, setEditContactId] = useState(null);
  const [editContactForm, setEditContactForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [agencyForm, setAgencyForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [editAgencyId, setEditAgencyId] = useState(null);
  const [editAgencyForm, setEditAgencyForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [pocSaving, setPocSaving] = useState(false);

  async function saveInfo(e) {
    e.preventDefault();
    try {
      const updated = await api.updateProject(project.id, {
        ...info,
        startDate: info.startDate ? new Date(info.startDate + 'T12:00:00').toISOString() : undefined,
        endDate: info.endDate ? new Date(info.endDate + 'T12:00:00').toISOString() : undefined,
      });
      setProject(p => ({ ...p, ...updated }));
      setInfo({ code: updated.code, title: updated.title, client: updated.client, city: updated.city, state: updated.state, startDate: (updated.start_date||updated.startDate)?.slice(0,10), endDate: (updated.end_date||updated.endDate)?.slice(0,10), status: updated.status, notes: updated.notes || '' });
      setEditInfo(false);
    } catch(e) { alert(e.message); }
  }

  async function savePoc(crewMemberId) {
    setPocSaving(true);
    try {
      await api.updateProject(project.id, { pocCrewMemberId: crewMemberId || null });
      setProject(p => ({ ...p, poc_crew_member_id: crewMemberId || null }));
    } catch(e) { alert(e.message); }
    setPocSaving(false);
  }

  async function addLocation(e) {
    e.preventDefault();
    try {
      const loc = await api.createLocation(project.id, locForm);
      setProject(p => ({ ...p, locations: [...p.locations, loc] }));
      setShowLocModal(false); setLocForm({ name:'', address:'', type:'PRIMARY_VENUE', emoji:'' });
    } catch(e) { alert(e.message); }
  }

  async function deleteLocation(id) {
    if (!confirm('Remove this location?')) return;
    await api.deleteLocation(project.id, id);
    setProject(p => ({ ...p, locations: p.locations.filter(l => l.id !== id) }));
  }

  async function addContact(e) {
    e.preventDefault();
    try {
      const c = await api.createContact(project.id, contactForm);
      setProject(p => ({ ...p, clientContacts: [...p.clientContacts, c] }));
      setShowContactModal(false); setContactForm({ name:'', title:'', email:'', phone:'' });
    } catch(e) { alert(e.message); }
  }

  async function saveEditContact(e) {
    e.preventDefault();
    try {
      const c = await api.updateContact(project.id, editContactId, editContactForm);
      setProject(p => ({ ...p, clientContacts: p.clientContacts.map(x => x.id === editContactId ? c : x) }));
      setEditContactId(null);
    } catch(e) { alert(e.message); }
  }

  async function deleteContact(id) {
    await api.deleteContact(project.id, id);
    setProject(p => ({ ...p, clientContacts: p.clientContacts.filter(c => c.id !== id) }));
  }

  async function addAgencyContact(e) {
    e.preventDefault();
    try {
      const c = await api.createAgencyContact(project.id, agencyForm);
      setProject(p => ({ ...p, agencyContacts: [...(p.agencyContacts||[]), c] }));
      setShowAgencyModal(false); setAgencyForm({ name:'', title:'', email:'', phone:'' });
    } catch(e) { alert(e.message); }
  }

  async function saveEditAgency(e) {
    e.preventDefault();
    try {
      const c = await api.updateAgencyContact(project.id, editAgencyId, editAgencyForm);
      setProject(p => ({ ...p, agencyContacts: (p.agencyContacts||[]).map(x => x.id === editAgencyId ? c : x) }));
      setEditAgencyId(null);
    } catch(e) { alert(e.message); }
  }

  async function deleteAgencyContact(id) {
    await api.deleteAgencyContact(project.id, id);
    setProject(p => ({ ...p, agencyContacts: (p.agencyContacts||[]).filter(c => c.id !== id) }));
  }

  const assignedCrew = (project.crewAssignments || []).filter(a => a.crewMember);
  const pocId = project.poc_crew_member_id || '';
  const pocMember = assignedCrew.find(a => a.crewMember.id === pocId)?.crewMember || null;
  const gearPerson = project.gear?.gear_person_name ? {
    name: project.gear.gear_person_name,
    phone: project.gear.gear_person_phone,
    email: project.gear.gear_person_email,
  } : null;

  const startDate = project.start_date || project.startDate;
  const endDate = project.end_date || project.endDate;
  const shootDays = startDate && endDate
    ? Math.round((new Date(endDate.slice(0,10)+'T12:00:00') - new Date(startDate.slice(0,10)+'T12:00:00')) / 86400000) + 1
    : 0;

  const daysUntil = startDate
    ? Math.ceil((new Date(startDate.slice(0,10)+'T12:00:00') - new Date(new Date().toISOString().slice(0,10)+'T12:00:00')) / 86400000)
    : null;

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:18, borderBottom:'1px solid var(--border)', marginBottom:4 }}>
        <div>
          <div className="proj-code">{project.code}</div>
          <div className="proj-title">{project.title}</div>
          <div className="proj-meta">
            <div className="meta"><span className="dot6" />{project.city}, {project.state}</div>
            <div className="meta"><span className="dot6" />{fmtDate(startDate)} – {fmtDate(endDate)}</div>
            <div className="meta"><span className="dot6" />{project.client}</div>
          </div>
          {project.notes && (
            <div style={{ marginTop:10, fontSize:13, color:'var(--muted)', maxWidth:480, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{project.notes}</div>
          )}
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          {daysUntil != null && daysUntil > 0 && (
            <div style={{ textAlign:'right', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px' }}>
              <div style={{ fontSize:22, fontWeight:700, color:'var(--orange)', lineHeight:1 }}>{daysUntil}</div>
              <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:2 }}>days until {project.title}</div>
            </div>
          )}
          {daysUntil != null && daysUntil === 0 && (
            <div style={{ textAlign:'right', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'8px 14px' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--orange)' }}>Day 1 is today!</div>
            </div>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setEditInfo(true)}>Edit Info</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, margin:'20px 0' }}>
        <div className="stat" style={{ cursor:'pointer' }} onClick={() => onTabChange?.('schedule')}>
          <div className="stat-lbl">Shoot Days</div>
          <div className="stat-val">{shootDays}</div>
          <div className="stat-sub">{fmtDate(startDate)} – {fmtDate(endDate)}</div>
        </div>
        <div className="stat" style={{ cursor:'pointer' }} onClick={() => onTabChange?.('crew')}>
          <div className="stat-lbl">Crew</div>
          <div className="stat-val">{project.crewAssignments?.length || 0}</div>
          <div className="stat-sub">positions assigned</div>
        </div>
        <div className="stat" style={{ cursor:'pointer' }} onClick={() => onTabChange?.('post-production')}>
          <div className="stat-lbl">Deliverables</div>
          <div className="stat-val">{project.deliverables?.length || 0}</div>
          <div className="stat-sub">video outputs</div>
        </div>
      </div>

      {/* Main POC + Gear Person */}
      <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:12 }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', whiteSpace:'nowrap' }}>Main POC</span>
        <select value={pocId} onChange={e => savePoc(e.target.value)} style={{ flex:1, maxWidth:320 }}>
          <option value="">— Unassigned —</option>
          {assignedCrew.map(a => (
            <option key={a.crewMember.id} value={a.crewMember.id}>
              {displayName(a.crewMember)} — {a.position.name}
            </option>
          ))}
        </select>
        {pocSaving && <span style={{ fontSize:11, color:'var(--muted)' }}>Saving…</span>}
        {pocMember && !pocSaving && (
          <div style={{ fontSize:12, color:'var(--muted)', display:'flex', gap:16 }}>
            {pocMember.phone && <span style={{ color:'var(--tan)' }}>{pocMember.phone}</span>}
            {pocMember.email && <span>{pocMember.email}</span>}
          </div>
        )}
      </div>

      {/* Gear Person tile */}
      {gearPerson && (
        <div
          onClick={() => onTabChange?.('gear')}
          style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 16px', marginBottom:20, cursor:'pointer' }}
        >
          <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', whiteSpace:'nowrap' }}>Gear Contact</span>
          <span style={{ fontWeight:500, fontSize:13 }}>{gearPerson.name}</span>
          {gearPerson.phone && <span style={{ fontSize:12, color:'var(--tan)' }}>{gearPerson.phone}</span>}
          {gearPerson.email && <span style={{ fontSize:12, color:'var(--muted)' }}>{gearPerson.email}</span>}
        </div>
      )}

      {/* Contacts row: Client | Agency side by side */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:20 }}>
        {/* Client Contacts */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div className="sec-lbl">Client Contacts</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowContactModal(true)}>+ Add</button>
          </div>
          <div className="chips">
            {project.clientContacts?.map(c => (
              <div key={c.id} className="chip" style={{ position:'relative', paddingRight:50 }}>
                <strong>{c.title}</strong>
                {c.name} {c.phone && `· ${c.phone}`}
                {c.email && <><br /><span style={{ color:'var(--muted)' }}>{c.email}</span></>}
                <div style={{ position:'absolute', top:4, right:6, display:'flex', gap:4 }}>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => { setEditContactId(c.id); setEditContactForm({ name:c.name, title:c.title, email:c.email||'', phone:c.phone||'' }); }}>✎</button>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => deleteContact(c.id)}>✕</button>
                </div>
              </div>
            ))}
            {!project.clientContacts?.length && <span className="empty" style={{ padding:0, fontSize:12 }}>No client contacts yet.</span>}
          </div>
        </div>

        {/* Agency Contacts */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div className="sec-lbl">Agency Contacts</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAgencyModal(true)}>+ Add</button>
          </div>
          <div className="chips">
            {(project.agencyContacts||[]).map(c => (
              <div key={c.id} className="chip" style={{ position:'relative', paddingRight:50 }}>
                <strong>{c.title}</strong>
                {c.name} {c.phone && `· ${c.phone}`}
                {c.email && <><br /><span style={{ color:'var(--muted)' }}>{c.email}</span></>}
                <div style={{ position:'absolute', top:4, right:6, display:'flex', gap:4 }}>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => { setEditAgencyId(c.id); setEditAgencyForm({ name:c.name, title:c.title, email:c.email||'', phone:c.phone||'' }); }}>✎</button>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => deleteAgencyContact(c.id)}>✕</button>
                </div>
              </div>
            ))}
            {!(project.agencyContacts?.length) && <span className="empty" style={{ padding:0, fontSize:12 }}>No agency contacts yet.</span>}
          </div>
        </div>
      </div>

      {/* Locations */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div className="sec-lbl" style={{ marginBottom:0 }}>Locations</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowLocModal(true)}>+ Add</button>
      </div>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:20 }}>
        {!(project.locations?.length) && (
          <div style={{ padding:'12px 16px', fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No locations added yet.</div>
        )}
        {(project.locations || []).map((l, i) => (
          <div key={l.id} style={{ display:'grid', gridTemplateColumns:'160px 1fr 1fr auto', alignItems:'center', gap:12, padding:'10px 16px', borderBottom: i < project.locations.length - 1 ? '1px solid var(--border)' : 'none' }}>
            <span className={`tag ${LOC_TAG[l.type]}`} style={{ justifySelf:'start' }}>{LOC_LABELS[l.type]}</span>
            <span style={{ fontWeight:600, fontSize:13 }}>{l.name}</span>
            {l.address
              ? <a href={`https://maps.google.com/?q=${encodeURIComponent(l.address)}`} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--tan)', textDecoration:'none' }}>{l.address}</a>
              : <span style={{ fontSize:12, color:'var(--muted)' }}>—</span>
            }
            <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => deleteLocation(l.id)}>✕</button>
          </div>
        ))}
      </div>


      {/* Edit Info Modal */}
      {editInfo && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditInfo(false)}>
          <div className="modal">
            <div className="modal-title">Edit Project Info</div>
            <form onSubmit={saveInfo}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Project Code</label><input value={info.code} onChange={e => setInfo(i=>({...i,code:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={info.title} onChange={e => setInfo(i=>({...i,title:e.target.value}))} required /></div>
                <div className="field"><label>Client</label><input value={info.client} onChange={e => setInfo(i=>({...i,client:e.target.value}))} required /></div>
                <div className="field"><label>Status</label>
                  <select value={info.status} onChange={e => setInfo(i=>({...i,status:e.target.value}))}>
                    {['PLANNING','ACTIVE','WRAPPED','DELIVERED','ARCHIVED'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field"><label>City</label><input value={info.city} onChange={e => setInfo(i=>({...i,city:e.target.value}))} /></div>
                <div className="field"><label>State</label><input value={info.state} onChange={e => setInfo(i=>({...i,state:e.target.value}))} /></div>
                <div className="field"><label>Start Date</label><input type="date" value={info.startDate} onChange={e => setInfo(i=>({...i,startDate:e.target.value}))} /></div>
                <div className="field"><label>End Date</label><input type="date" value={info.endDate} onChange={e => setInfo(i=>({...i,endDate:e.target.value}))} /></div>
                <div className="field span2"><label>Notes</label><textarea value={info.notes} onChange={e => setInfo(i=>({...i,notes:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditInfo(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Location Modal */}
      {showLocModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowLocModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Location</div>
            <form onSubmit={addLocation}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Name</label><input value={locForm.name} onChange={e => setLocForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field span2"><label>Address</label><input value={locForm.address} onChange={e => setLocForm(f=>({...f,address:e.target.value}))} required /></div>
                <div className="field"><label>Type</label>
                  <select value={locForm.type} onChange={e => setLocForm(f=>({...f,type:e.target.value}))}>
                    <option value="PRIMARY_VENUE">Shooting Location</option>
                    <option value="SECONDARY">Secondary Location</option>
                    <option value="CREW_HOTEL">Hotel</option>
                    <option value="AIRPORT">Airport</option>
                    <option value="OTHER">Rental Car Location</option>
                  </select>
                </div>
                <div className="field"><label>Emoji</label><input value={locForm.emoji} onChange={e => setLocForm(f=>({...f,emoji:e.target.value}))} placeholder="🏛" /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Location</button><button type="button" className="btn btn-ghost" onClick={() => setShowLocModal(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Agency Contact Modal */}
      {showAgencyModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAgencyModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Agency Contact</div>
            <form onSubmit={addAgencyContact}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={agencyForm.name} onChange={e => setAgencyForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={agencyForm.title} onChange={e => setAgencyForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={agencyForm.email} onChange={e => setAgencyForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={agencyForm.phone} onChange={e => setAgencyForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Contact</button><button type="button" className="btn btn-ghost" onClick={() => setShowAgencyModal(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Agency Contact Modal */}
      {editAgencyId && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditAgencyId(null)}>
          <div className="modal">
            <div className="modal-title">Edit Agency Contact</div>
            <form onSubmit={saveEditAgency}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={editAgencyForm.name} onChange={e => setEditAgencyForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={editAgencyForm.title} onChange={e => setEditAgencyForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={editAgencyForm.email} onChange={e => setEditAgencyForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={editAgencyForm.phone} onChange={e => setEditAgencyForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditAgencyId(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Client Contact Modal */}
      {showContactModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowContactModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Client Contact</div>
            <form onSubmit={addContact}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={contactForm.name} onChange={e => setContactForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={contactForm.title} onChange={e => setContactForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={contactForm.email} onChange={e => setContactForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={contactForm.phone} onChange={e => setContactForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Contact</button><button type="button" className="btn btn-ghost" onClick={() => setShowContactModal(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Contact Modal */}
      {editContactId && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditContactId(null)}>
          <div className="modal">
            <div className="modal-title">Edit Client Contact</div>
            <form onSubmit={saveEditContact}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={editContactForm.name} onChange={e => setEditContactForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Title</label><input value={editContactForm.title} onChange={e => setEditContactForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={editContactForm.email} onChange={e => setEditContactForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={editContactForm.phone} onChange={e => setEditContactForm(f=>({...f,phone:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditContactId(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
