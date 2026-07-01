import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';

function Field({ label, value, onChange, onBlur, placeholder, type='text' }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} onChange={onChange} onBlur={onBlur} placeholder={placeholder} />
    </div>
  );
}

function Check({ id, label, checked, onChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0' }}>
      <input type="checkbox" id={id} checked={checked} onChange={onChange} style={{ width:'auto', accentColor:'var(--orange)' }} />
      <label htmlFor={id} style={{ textTransform:'none', letterSpacing:0, fontSize:13, color:'var(--text)', cursor:'pointer' }}>{label}</label>
    </div>
  );
}

export default function Gear({ project, setProject }) {
  const [gear, setGear] = useState({
    gearPersonId: '',
    internalRequestSubmitted: false,
    rentalCompany: '',
    rentalContact: '',
    rentalPhone: '',
    rentalEmail: '',
    coiReceived: false,
    rentalAgreementReceived: false,
    ccAuthReceived: false,
    deliveryDatetime: '',
    pickupDatetime: '',
    deliveryDriver: '',
    deliveryDriverPhone: '',
    cameraGear: '',
    gripGear: '',
    electricGear: '',
    audioGear: '',
    mediaManagementGear: '',
    editingGear: '',
    storageLocation: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (project.gear) {
      const g = project.gear;
      setGear({
        gearPersonId: g.gear_person_id || '',
        internalRequestSubmitted: g.internal_request_submitted || false,
        rentalCompany: g.rental_company || '',
        rentalContact: g.rental_contact || '',
        rentalPhone: g.rental_phone || '',
        rentalEmail: g.rental_email || '',
        coiReceived: g.coi_received || false,
        rentalAgreementReceived: g.rental_agreement_received || false,
        ccAuthReceived: g.cc_auth_received || false,
        deliveryDatetime: g.delivery_datetime || '',
        pickupDatetime: g.pickup_datetime || '',
        deliveryDriver: g.delivery_driver || '',
        deliveryDriverPhone: g.delivery_driver_phone || '',
        cameraGear: g.camera_gear || '',
        gripGear: g.grip_gear || '',
        electricGear: g.electric_gear || '',
        audioGear: g.audio_gear || '',
        mediaManagementGear: g.media_management_gear || '',
        editingGear: g.editing_gear || '',
        storageLocation: g.storage_location || '',
      });
    }
  }, [project.gear]);

  const save = useCallback(async (patch) => {
    setSaving(true);
    try {
      const updated = await api.saveGear(project.id, { ...gear, ...patch });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (setProject && updated) setProject(p => ({ ...p, gear: updated }));
    } catch(e) { alert(e.message); }
    setSaving(false);
  }, [gear, project.id, setProject]);

  function field(key) {
    return {
      value: gear[key],
      onChange: e => setGear(g => ({ ...g, [key]: e.target.value })),
      onBlur: e => save({ [key]: e.target.value }),
    };
  }

  function check(key) {
    return {
      checked: gear[key],
      onChange: e => {
        const val = e.target.checked;
        setGear(g => ({ ...g, [key]: val }));
        save({ [key]: val });
      },
    };
  }

  const assignedCrew = (project.crewAssignments || []).filter(a => a.crewMember);
  const gearPerson = assignedCrew.find(a => a.crewMember.id === gear.gearPersonId)?.crewMember || null;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div className="page-title" style={{ marginBottom:3 }}>Gear</div>
          <div className="page-sub">{project.client} · {project.code}</div>
        </div>
        {saving && <span style={{ fontSize:11, color:'var(--muted)' }}>Saving…</span>}
        {saved && !saving && <span style={{ fontSize:11, color:'var(--green-text,#4ade80)' }}>Saved</span>}
      </div>

      {/* ── Storage Location ── */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px', marginBottom:20 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Storage Location</div>
        <div className="field" style={{ margin:0 }}>
          <input {...field('storageLocation')} placeholder="Room 104B — locked cage near freight elevator" />
        </div>
      </div>

      {/* ── Person Responsible ── */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px', marginBottom:20 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Person Responsible for Gear</div>
        <div style={{ display:'flex', gap:16, alignItems:'flex-start', flexWrap:'wrap' }}>
          <div className="field" style={{ flex:'1 1 240px', margin:0 }}>
            <label>Crew Member</label>
            <select value={gear.gearPersonId} onChange={e => { setGear(g => ({ ...g, gearPersonId: e.target.value })); save({ gearPersonId: e.target.value }); }}>
              <option value="">— Unassigned —</option>
              {assignedCrew.map(a => (
                <option key={a.crewMember.id} value={a.crewMember.id}>{displayName(a.crewMember)} — {a.position.name}</option>
              ))}
            </select>
          </div>
          {gearPerson && (
            <div style={{ fontSize:12, display:'flex', flexDirection:'column', gap:4, paddingTop:22 }}>
              {gearPerson.phone && <span style={{ color:'var(--tan)' }}>{gearPerson.phone}</span>}
              {gearPerson.email && <span style={{ color:'var(--muted)' }}>{gearPerson.email}</span>}
            </div>
          )}
        </div>
        <div style={{ marginTop:10 }}>
          <Check id="internalReq" label="Internal gear request submitted" {...check('internalRequestSubmitted')} />
        </div>
      </div>

      {/* ── Rental House ── */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px', marginBottom:20 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Rental House Information</div>
        <div className="form-grid">
          <div className="field"><label>Rental Company</label><input {...field('rentalCompany')} placeholder="Keslow Camera" /></div>
          <div className="field"><label>Contact Name</label><input {...field('rentalContact')} placeholder="Jane Smith" /></div>
          <div className="field"><label>Phone Number</label><input {...field('rentalPhone')} placeholder="(314) 555-0100" /></div>
          <div className="field"><label>Email Address</label><input type="email" {...field('rentalEmail')} placeholder="jane@keslow.com" /></div>
        </div>
        <div style={{ marginTop:8 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:4 }}>Documents Submitted</div>
          <Check id="coi" label="COI" {...check('coiReceived')} />
          <Check id="rentalAgreement" label="Rental Agreement" {...check('rentalAgreementReceived')} />
          <Check id="ccAuth" label="CC Auth Form" {...check('ccAuthReceived')} />
        </div>
        <div className="form-grid" style={{ marginTop:12 }}>
          <div className="field"><label>Delivery Date / Time</label><input {...field('deliveryDatetime')} placeholder="Aug 5 · 2:00 PM" /></div>
          <div className="field"><label>Pick-up Date / Time</label><input {...field('pickupDatetime')} placeholder="Aug 9 · 10:00 AM" /></div>
          <div className="field"><label>Delivery Driver Name</label><input {...field('deliveryDriver')} placeholder="John Doe" /></div>
          <div className="field"><label>Delivery Driver Phone</label><input {...field('deliveryDriverPhone')} placeholder="(314) 555-0199" /></div>
        </div>
      </div>

      {/* ── Gear List ── */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px', marginBottom:20 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Gear List</div>
        <div className="form-grid">
          <div className="field"><label>Camera</label><textarea {...field('cameraGear')} placeholder="2x RED V-Raptor, 1x Sony FX3…" style={{ minHeight:64 }} /></div>
          <div className="field"><label>Grip</label><textarea {...field('gripGear')} placeholder="Dana Dolly, Doorway Dolly, Steadicam…" style={{ minHeight:64 }} /></div>
          <div className="field"><label>Electric</label><textarea {...field('electricGear')} placeholder="2x Aputure 600D, 4x Aputure 300X…" style={{ minHeight:64 }} /></div>
          <div className="field"><label>Audio</label><textarea {...field('audioGear')} placeholder="Sound Devices 833, 2x Lectrosonics…" style={{ minHeight:64 }} /></div>
          <div className="field"><label>Media Management</label><textarea {...field('mediaManagementGear')} placeholder="OWC Thunderbay 4, Archivist…" style={{ minHeight:64 }} /></div>
          <div className="field"><label>Editing</label><textarea {...field('editingGear')} placeholder="MacBook Pro 16-inch, Dell 4K monitor…" style={{ minHeight:64 }} /></div>
        </div>
      </div>

    </div>
  );
}
