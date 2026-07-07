import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { displayName } from '../utils/displayName.js';

// Self-contained Roster Look-Up — same behavior as the one on FreePro's Crew
// tab (search, member detail, edit, delete, + New Person) against the same
// live crew roster.
const COLORS = ['#E8500A', '#5ABF80', '#4a9eff', '#e6c229', '#a78bfa', '#f87171', '#40A0A0', '#D0A030'];
const colorFor = str => { let h = 0; for (const c of str || '') h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return COLORS[Math.abs(h) % COLORS.length]; };
const initials = name => (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

export default function RosterLookup() {
  const [roster, setRoster] = useState([]);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name:'', email:'', phone:'', company:'' });

  useEffect(() => { api.getCrew().then(setRoster).catch(() => setRoster([])); }, []);

  const matches = roster.filter(m => {
    const q = query.toLowerCase();
    return displayName(m)?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.company?.toLowerCase().includes(q);
  });

  async function openMember(m) {
    setEditing(false);
    setDetail(await api.getCrewMember(m.id).catch(() => m));
    setQuery('');
  }

  function startEdit() {
    const d = detail;
    setForm({
      name: d.name || '',
      legalFirstName: d.legal_first_name || (d.name || '').trim().split(/\s+/)[0] || '',
      legalMiddleName: d.legal_middle_name || '',
      legalLastName: d.legal_last_name || ((d.name || '').trim().split(/\s+/).length > 1 ? (d.name || '').trim().split(/\s+/).slice(-1)[0] : ''),
      email: d.email || '', phone: d.phone || '', company: d.company || '',
      homeAirport: d.home_airport || '', notes: d.notes || '',
      dateOfBirth: d.date_of_birth?.slice(0, 10) || '',
      passportNumber: d.passport_number || '', passportExpiry: d.passport_expiry?.slice(0, 10) || '',
      knownTravelerNumber: d.known_traveler_number || '', seatPreference: d.seat_preference || '',
      emergencyContact: d.emergency_contact || '', emergencyPhone: d.emergency_phone || '',
      preferredFirstName: d.preferred_first_name || '', preferredLastName: d.preferred_last_name || '',
      dietaryRestrictions: d.dietary_restrictions || '',
    });
    setEditing(true);
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateCrewMember(detail.id, form);
      setRoster(r => r.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      setDetail(d => ({ ...d, ...updated }));
      setEditing(false);
    } catch (err) { alert(err.message); }
    setSaving(false);
  }

  async function remove() {
    if (!confirm(`Remove ${displayName(detail)} from the roster? This cannot be undone.`)) return;
    try {
      await api.deleteCrewMember(detail.id);
      setRoster(r => r.filter(m => m.id !== detail.id));
      setDetail(null); setEditing(false);
    } catch (err) { alert(err.message); }
  }

  async function addPerson(e) {
    e.preventDefault();
    try {
      const m = await api.createCrewMember(addForm);
      setRoster(r => [...r, m]);
      setShowAdd(false);
      setAddForm({ name:'', email:'', phone:'', company:'' });
      openMember(m);
    } catch (err) { alert(err.message); }
  }

  const setLegal = (k, v) => setForm(f => {
    const nf = { ...f, [k]: v };
    nf.name = [nf.legalFirstName, nf.legalMiddleName, nf.legalLastName].map(x => (x || '').trim()).filter(Boolean).join(' ');
    return nf;
  });

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Roster Look-Up</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)}>+ New Person</button>
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search by name, email, or company…" style={{ marginBottom:8 }} />
      {query.trim().length > 0 && (
        <div className="pos-table-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
          {matches.slice(0, 10).map(m => (
            <div key={m.id} onClick={() => openMember(m)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
              <div className="av" style={{ width:28, height:28, fontSize:10, flexShrink:0, background: colorFor(m.name)+'22', color: colorFor(m.name) }}>{initials(m.name)}</div>
              <div>
                <div style={{ fontSize:12, fontWeight:500 }}>{displayName(m)}</div>
                {displayName(m) !== m.name && <div style={{ fontSize:10, color:'var(--muted)' }}>Legal: {m.name}</div>}
                <div style={{ fontSize:10, color:'var(--muted)' }}>{[m.company, m.email].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          ))}
          {matches.length === 0 && <div className="empty" style={{ padding:'10px 14px' }}>No match found.</div>}
        </div>
      )}

      {detail && (
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'16px 18px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div className="av" style={{ width:36, height:36, fontSize:12, flexShrink:0, background: colorFor(detail.name)+'22', color: colorFor(detail.name) }}>{initials(detail.name)}</div>
              <div>
                <div style={{ fontWeight:600, fontSize:14 }}>{displayName(detail)}</div>
                {displayName(detail) !== detail.name && <div style={{ fontSize:10, color:'var(--muted)' }}>Legal: {detail.name}</div>}
                <div style={{ fontSize:11, color:'var(--muted)' }}>{[detail.company, detail.home_airport].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              {!editing && <button className="btn btn-ghost btn-sm" onClick={startEdit}>Edit</button>}
              {!editing && <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e08080)' }} onClick={remove}>Delete</button>}
              <button className="btn btn-ghost btn-sm" onClick={() => { setDetail(null); setEditing(false); }}>✕</button>
            </div>
          </div>

          {editing ? (
            <form onSubmit={save}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:6 }}>Contact</div>
              <div className="form-grid" style={{ marginBottom:14 }}>
                <div className="field"><label>Legal First Name</label><input value={form.legalFirstName || ''} onChange={e => setLegal('legalFirstName', e.target.value)} required /></div>
                <div className="field"><label>Middle Initial / Name</label><input value={form.legalMiddleName || ''} onChange={e => setLegal('legalMiddleName', e.target.value)} /></div>
                <div className="field span2"><label>Legal Last Name</label><input value={form.legalLastName || ''} onChange={e => setLegal('legalLastName', e.target.value)} required /></div>
                <div className="field"><label>Preferred First Name</label><input value={form.preferredFirstName} onChange={e => setForm(f=>({...f,preferredFirstName:e.target.value}))} placeholder="Leave blank to use legal name" /></div>
                <div className="field"><label>Preferred Last Name</label><input value={form.preferredLastName} onChange={e => setForm(f=>({...f,preferredLastName:e.target.value}))} /></div>
                <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))} /></div>
                <div className="field"><label>Company / Role</label><input value={form.company} onChange={e => setForm(f=>({...f,company:e.target.value}))} /></div>
                <div className="field"><label>Home Airport</label><input value={form.homeAirport} onChange={e => setForm(f=>({...f,homeAirport:e.target.value}))} placeholder="STL" /></div>
                <div className="field span2">
                  <label>Dietary Restrictions</label>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <input value={form.dietaryRestrictions === 'N/A' ? '' : form.dietaryRestrictions} onChange={e => setForm(f=>({...f,dietaryRestrictions:e.target.value}))} placeholder="Vegetarian, gluten-free, nut allergy…" disabled={form.dietaryRestrictions === 'N/A'} style={{ flex:1 }} />
                    <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--muted)', whiteSpace:'nowrap', cursor:'pointer' }}>
                      <input type="checkbox" checked={form.dietaryRestrictions === 'N/A'} onChange={e => setForm(f=>({...f,dietaryRestrictions: e.target.checked ? 'N/A' : ''}))} style={{ width:'auto', margin:0 }} />
                      N/A
                    </label>
                  </div>
                </div>
              </div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:6 }}>Travel Info</div>
              <div className="form-grid" style={{ marginBottom:14 }}>
                <div className="field"><label>Date of Birth</label><input type="date" value={form.dateOfBirth} onChange={e => setForm(f=>({...f,dateOfBirth:e.target.value}))} /></div>
                <div className="field"><label>Seat Preference</label>
                  <select value={form.seatPreference} onChange={e => setForm(f=>({...f,seatPreference:e.target.value}))}>
                    <option value="">— No preference —</option>
                    <option value="Window">Window</option>
                    <option value="Aisle">Aisle</option>
                    <option value="Middle">Middle</option>
                  </select>
                </div>
                <div className="field"><label>Passport Number</label><input value={form.passportNumber} onChange={e => setForm(f=>({...f,passportNumber:e.target.value}))} /></div>
                <div className="field"><label>Passport Expiry</label><input type="date" value={form.passportExpiry} onChange={e => setForm(f=>({...f,passportExpiry:e.target.value}))} /></div>
                <div className="field span2"><label>Known Traveler # (TSA PreCheck / Global Entry)</label><input value={form.knownTravelerNumber} onChange={e => setForm(f=>({...f,knownTravelerNumber:e.target.value}))} /></div>
                <div className="field span2"><label>FF Numbers &amp; Notes</label><textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} rows={4} /></div>
              </div>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:6 }}>Emergency Contact</div>
              <div className="form-grid" style={{ marginBottom:14 }}>
                <div className="field"><label>Name</label><input value={form.emergencyContact} onChange={e => setForm(f=>({...f,emergencyContact:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={form.emergencyPhone} onChange={e => setForm(f=>({...f,emergencyPhone:e.target.value}))} /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 24px', fontSize:12 }}>
              {(detail.preferred_first_name || detail.preferred_last_name) && <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--muted)' }}>Preferred Name </span>{[detail.preferred_first_name, detail.preferred_last_name].filter(Boolean).join(' ')}</div>}
              {detail.email && <div><span style={{ color:'var(--muted)' }}>Email </span>{detail.email}</div>}
              {detail.phone && <div><span style={{ color:'var(--muted)' }}>Phone </span>{detail.phone}</div>}
              {detail.dietary_restrictions && <div style={{ gridColumn:'1/-1' }}><span style={{ color:'var(--muted)' }}>Dietary </span>{detail.dietary_restrictions}</div>}
              {detail.date_of_birth && <div><span style={{ color:'var(--muted)' }}>DOB </span>{new Date(detail.date_of_birth.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</div>}
              {detail.seat_preference && <div><span style={{ color:'var(--muted)' }}>Seat </span>{detail.seat_preference}</div>}
              {detail.passport_number && <div><span style={{ color:'var(--muted)' }}>Passport </span>{detail.passport_number}{detail.passport_expiry ? ` (exp ${new Date(detail.passport_expiry.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month:'short', year:'numeric' })})` : ''}</div>}
              {detail.known_traveler_number && <div><span style={{ color:'var(--muted)' }}>KTN </span>{detail.known_traveler_number}</div>}
              {detail.emergency_contact && <div><span style={{ color:'var(--muted)' }}>Emergency </span>{detail.emergency_contact}{detail.emergency_phone ? ` · ${detail.emergency_phone}` : ''}</div>}
              {detail.notes && <div style={{ gridColumn:'1/-1', marginTop:4, whiteSpace:'pre-wrap', color:'var(--muted)', fontSize:11, borderTop:'1px solid var(--border)', paddingTop:6 }}>{detail.notes}</div>}
              {detail.assignments?.length > 0 && (
                <div style={{ gridColumn:'1/-1', marginTop:6, borderTop:'1px solid var(--border)', paddingTop:6 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:4 }}>Project History</div>
                  {detail.assignments.map(a => (
                    <div key={a.id} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:11, color:'var(--muted)', padding:'2px 0' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ color:'var(--text)', fontWeight:500 }}>{a.code}</span> · {a.title} · {a.position_name}
                        {a.start_date && <span> · {new Date(String(a.start_date).slice(0,10)+'T12:00:00').getFullYear()}</span>}
                      </div>
                      <div style={{ flexShrink:0, whiteSpace:'nowrap', textAlign:'right' }}>
                        {a.is_contractor && a.day_rate
                          ? <span style={{ color:'var(--green)', fontWeight:600 }}>${Number(a.day_rate).toLocaleString('en-US',{maximumFractionDigits:2})}/day{a.labor_days ? ` × ${Number(a.labor_days)}d` : ''}</span>
                          : a.is_contractor
                            ? <span>Contract · no rate</span>
                            : <span style={{ color:'var(--orange)' }}>Unbridled</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">New Person</div>
            <form onSubmit={addPerson}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Legal Name</label><input value={addForm.name} onChange={e => setAddForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Email</label><input type="email" value={addForm.email} onChange={e => setAddForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={addForm.phone} onChange={e => setAddForm(f=>({...f,phone:e.target.value}))} /></div>
                <div className="field span2"><label>Company / Role</label><input value={addForm.company} onChange={e => setAddForm(f=>({...f,company:e.target.value}))} /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Add</button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
