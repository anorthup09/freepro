import React, { useState } from 'react';
import { api } from '../../api.js';

const LOC_TYPES = ['PRIMARY_VENUE','CREW_HOTEL','SECONDARY','AIRPORT','OTHER'];
const LOC_LABELS = { PRIMARY_VENUE:'Primary Venue', CREW_HOTEL:'Crew Hotel', SECONDARY:'Secondary', AIRPORT:'Airport', OTHER:'Other' };
const LOC_TAG = { PRIMARY_VENUE:'main', CREW_HOTEL:'crew', SECONDARY:'sec', AIRPORT:'sec', OTHER:'sec' };

export default function Overview({ project, setProject }) {
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState({ code: project.code, title: project.title, client: project.client, city: project.city, state: project.state, startDate: (project.start_date||project.startDate)?.slice(0,10), endDate: (project.end_date||project.endDate)?.slice(0,10), status: project.status, notes: project.notes || '' });
  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ name:'', address:'', type:'PRIMARY_VENUE', emoji:'' });
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [agencyForm, setAgencyForm] = useState({ name:'', title:'', email:'', phone:'' });
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

  async function deleteAgencyContact(id) {
    await api.deleteAgencyContact(project.id, id);
    setProject(p => ({ ...p, agencyContacts: (p.agencyContacts||[]).filter(c => c.id !== id) }));
  }

  const assignedCrew = (project.crewAssignments || []).filter(a => a.crewMember);
  const pocId = project.poc_crew_member_id || '';
  const pocMember = assignedCrew.find(a => a.crewMember.id === pocId)?.crewMember || null;

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:18, borderBottom:'1px solid var(--border)', marginBottom:4 }}>
        <div>
          <div className="proj-code">{project.code}</div>
          <div className="proj-title">{project.title}</div>
          <div className="proj-meta">
            <div className="meta"><span className="dot6" />{project.city}, {project.state}</div>
            <div className="meta"><span className="dot6" />{new Date(project.start_date||project.startDate).toLocaleDateString()} – {new Date(project.end_date||project.endDate).toLocaleDateString()}</div>
            <div className="meta"><span className="dot6" />{project.client}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditInfo(true)}>Edit Info</button>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat"><div className="stat-lbl">Shoot Days</div><div className="stat-val">{Math.round((new Date(project.end_date||project.endDate) - new Date(project.start_date||project.startDate)) / 86400000) + 1}</div><div className="stat-sub">{new Date(project.start_date||project.startDate).toLocaleDateString()} – {new Date(project.end_date||project.endDate).toLocaleDateString()}</div></div>
        <div className="stat"><div className="stat-lbl">Crew</div><div className="stat-val">{project.crewAssignments?.length || 0}</div><div className="stat-sub">positions assigned</div></div>
        <div className="stat"><div className="stat-lbl">Deliverables</div><div className="stat-val">{project.deliverables?.length || 0}</div><div className="stat-sub">video outputs</div></div>
        <div className="stat"><div className="stat-lbl">Locations</div><div className="stat-val">{project.locations?.length || 0}</div><div className="stat-sub">venues</div></div>
      </div>

      {/* Main POC */}
      <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:20 }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', whiteSpace:'nowrap' }}>Main POC</span>
        <select value={pocId} onChange={e => savePoc(e.target.value)} style={{ flex:1, maxWidth:320 }}>
          <option value="">— Unassigned —</option>
          {assignedCrew.map(a => (
            <option key={a.crewMember.id} value={a.crewMember.id}>
              {a.crewMember.name} — {a.position.name}
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

      {/* Locations */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="sec-lbl">Shooting Locations</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowLocModal(true)}>+ Add</button>
      </div>
      <div className="loc-grid" style={{ marginBottom:4 }}>
        {project.locations?.map(l => (
          <div key={l.id} className="loc">
            <div className="loc-ico">{l.emoji || '📍'}</div>
            <div style={{ flex:1 }}>
              <div className="loc-name">{l.name}</div>
              <div className="loc-addr">{l.address}</div>
              <span className={`tag ${LOC_TAG[l.type]}`}>{LOC_LABELS[l.type]}</span>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ padding:'2px 6px', color:'var(--muted)' }} onClick={() => deleteLocation(l.id)}>✕</button>
          </div>
        ))}
      </div>

      {/* Hotel Blocks */}
      {project.hotelBlocks?.length > 0 && (
        <>
          <div className="sec-lbl">Hotel Accommodations</div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
            {project.hotelBlocks.map(hb => (
              <div key={hb.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px' }}>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:2 }}>🏨 {hb.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:hb.guests?.length ? 8 : 0 }}>{hb.address}{hb.phone ? ` · ${hb.phone}` : ''}</div>
                {hb.guests?.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {hb.guests.map(g => (
                      <div key={g.id} style={{ fontSize:11, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'3px 8px' }}>
                        <span style={{ fontWeight:500 }}>{g.guest_name}</span>
                        <span style={{ color:'var(--muted)', marginLeft:6 }}>
                          {g.check_in ? new Date(g.check_in).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ''}
                          {g.check_out ? ` – ${new Date(g.check_out).toLocaleDateString('en-US',{month:'short',day:'numeric'})}` : ''}
                        </span>
                        {g.confirmation && <span style={{ color:'var(--tan)', marginLeft:6 }}>#{g.confirmation}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Client Contacts */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="sec-lbl">Client Contacts</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowContactModal(true)}>+ Add</button>
      </div>
      <div className="chips">
        {project.clientContacts?.map(c => (
          <div key={c.id} className="chip" style={{ position:'relative' }}>
            <strong>{c.title}</strong>
            {c.name} {c.phone && `· ${c.phone}`}
            {c.email && <><br /><span style={{ color:'var(--muted)' }}>{c.email}</span></>}
            <button style={{ position:'absolute', top:4, right:6, background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => deleteContact(c.id)}>✕</button>
          </div>
        ))}
      </div>

      {/* Agency Contacts */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="sec-lbl">Agency Contacts</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAgencyModal(true)}>+ Add</button>
      </div>
      <div className="chips">
        {(project.agencyContacts||[]).map(c => (
          <div key={c.id} className="chip" style={{ position:'relative' }}>
            <strong>{c.title}</strong>
            {c.name} {c.phone && `· ${c.phone}`}
            {c.email && <><br /><span style={{ color:'var(--muted)' }}>{c.email}</span></>}
            <button style={{ position:'absolute', top:4, right:6, background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => deleteAgencyContact(c.id)}>✕</button>
          </div>
        ))}
        {!(project.agencyContacts?.length) && <span className="empty" style={{ padding:0, fontSize:12 }}>No agency contacts yet.</span>}
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
                    {LOC_TYPES.map(t => <option key={t} value={t}>{LOC_LABELS[t]}</option>)}
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

      {/* Add Contact Modal */}
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

    </div>
  );
}
