import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';
import GearRequestModal from '../../components/GearRequestModal.jsx';

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

function detectCarrier(num) {
  if (!num) return null;
  const n = num.replace(/\s+/g, '');
  if (/^1Z[A-Z0-9]{16}$/i.test(n)) return { name: 'UPS', url: `https://www.ups.com/track?tracknum=${n}` };
  if (/^\d{12}$/.test(n) || /^\d{15}$/.test(n) || /^\d{20}$/.test(n)) return { name: 'FedEx', url: `https://www.fedex.com/fedextrack/?trknbr=${n}` };
  if (/^\d{22}$/.test(n) || /^9[2345]\d{20}$/.test(n) || /^(420\d{9})?9[4-5]\d{20}$/.test(n)) return { name: 'USPS', url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` };
  if (/^\d{10,11}$/.test(n)) return { name: 'DHL', url: `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}` };
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(n)) return { name: 'USPS', url: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}` };
  return null;
}

const BLANK_RENTAL = { renterName: '', confirmation: '', trackingNumber: '', cost: '', notes: '' };

export default function Gear({ project, setProject }) {
  const [gearRequest, setGearRequest] = useState(undefined); // undefined = loading, null = none
  const [showGearReq, setShowGearReq] = useState(false);
  useEffect(() => {
    api.gearRequestForProject(project.id).then(setGearRequest).catch(() => setGearRequest(null));
  }, [project.id]);

  const [onlineRentals, setOnlineRentals] = useState(project.onlineRentals || []);
  const [showAddRental, setShowAddRental] = useState(false);
  const [rentalForm, setRentalForm] = useState(BLANK_RENTAL);
  const [editRental, setEditRental] = useState(null);
  const [editRentalForm, setEditRentalForm] = useState(BLANK_RENTAL);
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
    rentalCost: '',
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
        rentalCost: g.rental_cost || '',
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

  async function addRental(e) {
    e.preventDefault();
    try {
      const r = await api.createOnlineRental(project.id, rentalForm);
      setOnlineRentals(rs => [...rs, r]);
      setRentalForm(BLANK_RENTAL);
      setShowAddRental(false);
    } catch(err) { alert(err.message); }
  }

  async function saveEditRental(e) {
    e.preventDefault();
    try {
      const r = await api.updateOnlineRental(project.id, editRental.id, editRentalForm);
      setOnlineRentals(rs => rs.map(x => x.id === r.id ? r : x));
      setEditRental(null);
    } catch(err) { alert(err.message); }
  }

  async function removeRental(id) {
    if (!confirm('Remove this online rental?')) return;
    await api.deleteOnlineRental(project.id, id);
    setOnlineRentals(rs => rs.filter(r => r.id !== id));
  }

  const assignedCrew = (project.crewAssignments || []).filter(a => a.crewMember);
  const gearPerson = assignedCrew.find(a => a.crewMember.id === gear.gearPersonId)?.crewMember || null;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div className="page-title" style={{ marginBottom:3 }}>Gear Management</div>
          <div className="page-sub">{project.client} · {project.code}</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {saving && <span style={{ fontSize:11, color:'var(--muted)' }}>Saving…</span>}
          {saved && !saving && <span style={{ fontSize:11, color:'var(--green-text,#4ade80)' }}>Saved</span>}
          <button onClick={() => setShowGearReq(true)}
            title={gearRequest ? 'Gear request submitted — click to view' : 'No gear request yet — click to fill one out'}
            style={gearRequest
              ? { background:'var(--orange)', border:'1px solid var(--orange)', color:'#fff', borderRadius:20, padding:'6px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }
              : { background:'var(--bg2)', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:20, padding:'6px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
            View Gear Request
          </button>
        </div>
      </div>
      {showGearReq && (
        <GearRequestModal projectId={project.id} existing={gearRequest || null}
          onClose={() => setShowGearReq(false)}
          onSubmitted={r => setGearRequest({ ...r, code: project.code, title: project.title })} />
      )}

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
      </div>

      {/* ── Online Rentals ── */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div className="sec-lbl" style={{ marginTop:0, marginBottom:0 }}>Online Rentals</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRental(true)}>+ Add</button>
        </div>

        {onlineRentals.length === 0 && !showAddRental && (
          <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No online rentals added yet.</div>
        )}

        {onlineRentals.map(r => {
          const carrier = detectCarrier(r.tracking_number);
          return (
            <div key={r.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  {r.renter_name && <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{r.renter_name}</span>}
                  {r.confirmation && <span style={{ fontSize:11, color:'var(--muted)' }}>Conf # {r.confirmation}</span>}
                  {r.cost && <span style={{ fontSize:11, color:'var(--green,#4ade80)', fontWeight:600 }}>${parseFloat(r.cost).toFixed(2)}</span>}
                </div>
                {r.tracking_number && (
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
                    <span>Tracking: <span style={{ color:'var(--text)' }}>{r.tracking_number}</span></span>
                    {carrier ? (
                      <a href={carrier.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'var(--orange)', color:'#000', fontWeight:700, textDecoration:'none' }}>
                        Track {carrier.name}
                      </a>
                    ) : (
                      <span style={{ fontSize:10, color:'var(--muted)', fontStyle:'italic' }}>Unknown carrier</span>
                    )}
                  </div>
                )}
                {r.notes && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3, fontStyle:'italic' }}>{r.notes}</div>}
              </div>
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }}
                  onClick={() => { setEditRental(r); setEditRentalForm({ renterName: r.renter_name||'', confirmation: r.confirmation||'', trackingNumber: r.tracking_number||'', cost: r.cost||'', notes: r.notes||'' }); }}>Edit</button>
                <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => removeRental(r.id)}>✕</button>
              </div>
            </div>
          );
        })}

        {showAddRental && (
          <form onSubmit={addRental} style={{ marginTop:12 }}>
            <div className="form-grid">
              <div className="field"><label>Renter Name</label><input value={rentalForm.renterName} onChange={e => setRentalForm(f=>({...f,renterName:e.target.value}))} placeholder="John Doe" /></div>
              <div className="field"><label>Rental Confirmation #</label><input value={rentalForm.confirmation} onChange={e => setRentalForm(f=>({...f,confirmation:e.target.value}))} placeholder="ORD-482910" /></div>
              <div className="field"><label>Shipping Tracking #</label><input value={rentalForm.trackingNumber} onChange={e => setRentalForm(f=>({...f,trackingNumber:e.target.value}))} placeholder="1Z999AA10123456784" /></div>
              <div className="field"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={rentalForm.cost} onChange={e => setRentalForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
              <div className="field span2"><label>Notes</label><input value={rentalForm.notes} onChange={e => setRentalForm(f=>({...f,notes:e.target.value}))} placeholder="B&H Photo — lens kit" /></div>
            </div>
            <div className="btn-row">
              <button className="btn btn-primary btn-sm">Add Rental</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowAddRental(false); setRentalForm(BLANK_RENTAL); }}>Cancel</button>
            </div>
          </form>
        )}
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
          <div className="field"><label>Cost Estimate ($)</label><input type="number" step="0.01" min="0" {...field('rentalCost')} placeholder="0.00" /></div>
        </div>
      </div>

      {editRental && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditRental(null)}>
          <div className="modal">
            <div className="modal-title">Edit Online Rental</div>
            <form onSubmit={saveEditRental}>
              <div className="form-grid">
                <div className="field"><label>Renter Name</label><input value={editRentalForm.renterName} onChange={e => setEditRentalForm(f=>({...f,renterName:e.target.value}))} placeholder="John Doe" /></div>
                <div className="field"><label>Rental Confirmation #</label><input value={editRentalForm.confirmation} onChange={e => setEditRentalForm(f=>({...f,confirmation:e.target.value}))} placeholder="ORD-482910" /></div>
                <div className="field"><label>Shipping Tracking #</label><input value={editRentalForm.trackingNumber} onChange={e => setEditRentalForm(f=>({...f,trackingNumber:e.target.value}))} placeholder="1Z999AA10123456784" /></div>
                <div className="field"><label>Cost ($)</label><input type="number" step="0.01" min="0" value={editRentalForm.cost} onChange={e => setEditRentalForm(f=>({...f,cost:e.target.value}))} placeholder="0.00" /></div>
                <div className="field span2"><label>Notes</label><input value={editRentalForm.notes} onChange={e => setEditRentalForm(f=>({...f,notes:e.target.value}))} placeholder="B&H Photo — lens kit" /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditRental(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
