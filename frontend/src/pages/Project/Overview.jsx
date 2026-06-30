import React, { useState } from 'react';
import { api } from '../../api.js';

const LOC_TYPES = ['PRIMARY_VENUE','CREW_HOTEL','SECONDARY','AIRPORT','OTHER'];
const LOC_LABELS = { PRIMARY_VENUE:'Primary Venue', CREW_HOTEL:'Crew Hotel', SECONDARY:'Secondary', AIRPORT:'Airport', OTHER:'Other' };
const LOC_TAG = { PRIMARY_VENUE:'main', CREW_HOTEL:'crew', SECONDARY:'sec', AIRPORT:'sec', OTHER:'sec' };

export default function Overview({ project, setProject }) {
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState({ title: project.title, client: project.client, city: project.city, state: project.state, startDate: project.startDate?.slice(0,10), endDate: project.endDate?.slice(0,10), status: project.status, notes: project.notes || '' });
  const [showLocModal, setShowLocModal] = useState(false);
  const [locForm, setLocForm] = useState({ name:'', address:'', type:'PRIMARY_VENUE', emoji:'' });
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactForm, setContactForm] = useState({ name:'', title:'', email:'', phone:'' });
  const [showTalentModal, setShowTalentModal] = useState(false);
  const [talentForm, setTalentForm] = useState({ name:'', role:'' });
  const [showSpecsModal, setShowSpecsModal] = useState(false);
  const [specsForm, setSpecsForm] = useState({ aspectRatio: project.techSpecs?.aspectRatio||'', resolution: project.techSpecs?.resolution||'', quality: project.techSpecs?.quality||'', cameras: project.techSpecs?.cameras||'', execProducer: project.techSpecs?.execProducer||'', onSiteEditor: project.techSpecs?.onSiteEditor||'' });

  async function saveInfo(e) {
    e.preventDefault();
    try {
      const updated = await api.updateProject(project.id, { ...info, startDate: new Date(info.startDate).toISOString(), endDate: new Date(info.endDate).toISOString() });
      setProject(p => ({ ...p, ...updated }));
      setEditInfo(false);
    } catch(e) { alert(e.message); }
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

  async function addTalent(e) {
    e.preventDefault();
    try {
      const t = await api.createTalent(project.id, talentForm);
      setProject(p => ({ ...p, keyTalent: [...p.keyTalent, t] }));
      setShowTalentModal(false); setTalentForm({ name:'', role:'' });
    } catch(e) { alert(e.message); }
  }

  async function deleteTalent(id) {
    await api.deleteTalent(project.id, id);
    setProject(p => ({ ...p, keyTalent: p.keyTalent.filter(t => t.id !== id) }));
  }

  async function saveSpecs(e) {
    e.preventDefault();
    try {
      const specs = await api.saveTechSpecs(project.id, specsForm);
      setProject(p => ({ ...p, techSpecs: specs }));
      setShowSpecsModal(false);
    } catch(e) { alert(e.message); }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', paddingBottom:18, borderBottom:'1px solid var(--border)', marginBottom:4 }}>
        <div>
          <div className="proj-code">{project.code}</div>
          <div className="proj-title">{project.title}</div>
          <div className="proj-meta">
            <div className="meta"><span className="dot6" />{project.city}, {project.state}</div>
            <div className="meta"><span className="dot6" />{new Date(project.startDate).toLocaleDateString()} – {new Date(project.endDate).toLocaleDateString()}</div>
            <div className="meta"><span className="dot6" />{project.client}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditInfo(true)}>Edit Info</button>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat"><div className="stat-lbl">Shoot Days</div><div className="stat-val">{Math.round((new Date(project.endDate) - new Date(project.startDate)) / 86400000) + 1}</div><div className="stat-sub">{new Date(project.startDate).toLocaleDateString()} – {new Date(project.endDate).toLocaleDateString()}</div></div>
        <div className="stat"><div className="stat-lbl">Crew</div><div className="stat-val">{project.crewAssignments?.length || 0}</div><div className="stat-sub">positions assigned</div></div>
        <div className="stat"><div className="stat-lbl">Deliverables</div><div className="stat-val">{project.deliverables?.length || 0}</div><div className="stat-sub">video outputs</div></div>
        <div className="stat"><div className="stat-lbl">Locations</div><div className="stat-val">{project.locations?.length || 0}</div><div className="stat-sub">venues</div></div>
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

      {/* Tech Specs */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="sec-lbl">Tech Specs</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSpecsModal(true)}>Edit</button>
      </div>
      {project.techSpecs ? (
        <div className="chips">
          {project.techSpecs.aspectRatio && <div className="chip"><strong>Format</strong>{project.techSpecs.aspectRatio}</div>}
          {project.techSpecs.resolution && <div className="chip"><strong>Resolution</strong>{project.techSpecs.resolution}</div>}
          {project.techSpecs.quality && <div className="chip"><strong>Quality</strong>{project.techSpecs.quality}</div>}
          {project.techSpecs.cameras && <div className="chip"><strong>Cameras</strong>{project.techSpecs.cameras}</div>}
          {project.techSpecs.execProducer && <div className="chip"><strong>Exec Producer</strong>{project.techSpecs.execProducer}</div>}
          {project.techSpecs.onSiteEditor && <div className="chip"><strong>On-Site Editor</strong>{project.techSpecs.onSiteEditor}</div>}
        </div>
      ) : <div className="empty" style={{ padding:'12px 0', textAlign:'left' }}>No tech specs yet.</div>}

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

      {/* Edit Info Modal */}
      {editInfo && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditInfo(false)}>
          <div className="modal">
            <div className="modal-title">Edit Project Info</div>
            <form onSubmit={saveInfo}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Title</label><input value={info.title} onChange={e => setInfo(i=>({...i,title:e.target.value}))} required /></div>
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

      {/* Add Talent Modal */}
      {showTalentModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowTalentModal(false)}>
          <div className="modal">
            <div className="modal-title">Add Key Talent</div>
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

      {/* Tech Specs Modal */}
      {showSpecsModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowSpecsModal(false)}>
          <div className="modal">
            <div className="modal-title">Tech Specs</div>
            <form onSubmit={saveSpecs}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Aspect Ratio</label><input value={specsForm.aspectRatio} onChange={e => setSpecsForm(f=>({...f,aspectRatio:e.target.value}))} placeholder="2.39:1" /></div>
                <div className="field"><label>Quality</label><input value={specsForm.quality} onChange={e => setSpecsForm(f=>({...f,quality:e.target.value}))} placeholder="4K" /></div>
                <div className="field span2"><label>Resolution</label><input value={specsForm.resolution} onChange={e => setSpecsForm(f=>({...f,resolution:e.target.value}))} placeholder="3672 × 1536" /></div>
                <div className="field span2"><label>Cameras</label><input value={specsForm.cameras} onChange={e => setSpecsForm(f=>({...f,cameras:e.target.value}))} placeholder="A, B, C + Drone" /></div>
                <div className="field"><label>Exec Producer</label><input value={specsForm.execProducer} onChange={e => setSpecsForm(f=>({...f,execProducer:e.target.value}))} /></div>
                <div className="field"><label>On-Site Editor</label><input value={specsForm.onSiteEditor} onChange={e => setSpecsForm(f=>({...f,onSiteEditor:e.target.value}))} /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save Specs</button><button type="button" className="btn btn-ghost" onClick={() => setShowSpecsModal(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
