import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';

function fmtTime(str) {
  if (!str) return '';
  if (/AM|PM/i.test(str)) return str;
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h)) return str;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function DietaryBadge({ value }) {
  const [show, setShow] = useState(false);
  if (!value || value === 'N/A') return <span style={{ color:'var(--muted)', fontSize:11 }}>—</span>;
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <span style={{ cursor:'pointer', fontSize:14 }} onClick={() => setShow(s => !s)} title={value}>⚠️</span>
      {show && (
        <div style={{ position:'absolute', right:0, top:'100%', marginTop:4, zIndex:99, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'6px 10px', fontSize:11, color:'var(--text)', whiteSpace:'nowrap', boxShadow:'0 4px 12px rgba(0,0,0,0.3)', minWidth:120 }}>
          {value}
          <div style={{ marginTop:4, fontSize:10, color:'var(--muted)', cursor:'pointer' }} onClick={() => setShow(false)}>✕ close</div>
        </div>
      )}
    </div>
  );
}

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
  const [slotForm, setSlotForm] = useState({ positionId:'', crewMemberId:'', slotNumber:1, startDate:'', endDate:'', isContractor:false, dayRate:'', laborDays:'', gearCost:'', gearDays:'' });
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
  const [talentForm, setTalentForm] = useState({ name:'', role:'', videoTitle:'', phone:'', email:'', notes:'', dietaryRestrictions:'', callTime:'', wardrobeNotes:'', arrivalNotes:'' });
  const [editTalent, setEditTalent] = useState(null);
  const [editTalentForm, setEditTalentForm] = useState({ name:'', role:'', videoTitle:'', phone:'', email:'', notes:'', dietaryRestrictions:'', callTime:'', wardrobeNotes:'', arrivalNotes:'' });
  const [talentDays, setTalentDays] = useState([]);
  const [addTalentDayCalls, setAddTalentDayCalls] = useState({});
  const [talentDayCallsForm, setTalentDayCallsForm] = useState({});
  const [contracts, setContracts] = useState([]);
  const [contractScope, setContractScope] = useState('');
  const [contractLink, setContractLink] = useState('');
  const [contractBusy, setContractBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [contractSent, setContractSent] = useState('');
  const [newContractor, setNewContractor] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getProjectCrew(project.id),
      api.getPositions(),
      api.getCrew(),
      api.getFlights(project.id),
    ]).then(([a, p, r, f]) => { setAssignments(a); setPositions(p); setRoster(r); setFlights(f); });
    api.getContracts(project.id).then(setContracts).catch(() => {});
  }, [project.id]);

  function contractFor(aid) {
    return contracts.find(c => c.crew_assignment_id === aid) || null;
  }

  function defaultScope(a) {
    const dates = [a.start_date, a.end_date].map(d => d ? new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : null);
    const when = dates[0] && dates[1] ? `${dates[0]} through ${dates[1]}` : (project.startDate || project.start_date ? `${new Date(String(project.startDate||project.start_date).slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} through ${new Date(String(project.endDate||project.end_date).slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : 'the project dates');
    return `Provide ${a.position.name} services for "${project.title}" (${project.code}), ${when}. Rates listed cover all services and equipment described. Contractor will submit an invoice against these agreed terms upon completion.`;
  }

  async function generateContract(aid, keepBusy) {
    if (!keepBusy) setContractBusy(true);
    try {
      const payload = {
        crewMemberId: editForm.crewMemberId || null,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        isContractor: true,
        dayRate: editForm.dayRate !== '' && editForm.dayRate != null ? Number(editForm.dayRate) : null,
        laborDays: editForm.laborDays !== '' && editForm.laborDays != null ? Number(editForm.laborDays) : null,
        gearCost: editForm.gearCost !== '' && editForm.gearCost != null ? Number(editForm.gearCost) : null,
        gearDays: editForm.gearDays !== '' && editForm.gearDays != null ? Number(editForm.gearDays) : null,
      };
      const updated = await api.updateCrewSlot(project.id, aid, payload);
      setAssignments(prev => prev.map(x => x.id === aid ? updated : x));
      const c = await api.createContract(project.id, aid, { scope: contractScope });
      setContracts(prev => [c, ...prev.filter(x => !(x.crew_assignment_id === aid && !x.signed_at))]);
      setContractLink(`${window.location.origin}/contract/${c.id}`);
      setLinkCopied(false);
      return c;
    } catch (e) { alert(e.message); return null; }
    finally { if (!keepBusy) setContractBusy(false); }
  }

  async function sendContractEmail(aid) {
    setContractBusy(true);
    setContractSent('');
    try {
      let c = contractFor(aid);
      if (c && c.signed_at) c = null;
      if (!c) c = await generateContract(aid, true);
      if (c) {
        const r = await api.emailContract(project.id, c.id);
        setContractSent(r.to);
      }
    } catch (e) { alert(e.message); }
    setContractBusy(false);
  }

  function copyContractLink() {
    navigator.clipboard?.writeText(contractLink).then(() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }).catch(() => {});
  }

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

  function isContractorMember(id) {
    if (!id) return null;
    const m = roster.find(x => x.id === id);
    if (!m) return null;
    return !(m.company || '').toLowerCase().includes('unbridled');
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
        isContractor: isContractorMember(slotForm.crewMemberId) === true,
        dayRate: isContractorMember(slotForm.crewMemberId) === true && slotForm.dayRate !== '' ? Number(slotForm.dayRate) : null,
        laborDays: isContractorMember(slotForm.crewMemberId) === true && slotForm.laborDays !== '' ? Number(slotForm.laborDays) : null,
        gearCost: isContractorMember(slotForm.crewMemberId) === true && slotForm.gearCost !== '' ? Number(slotForm.gearCost) : null,
        gearDays: isContractorMember(slotForm.crewMemberId) === true && slotForm.gearDays !== '' ? Number(slotForm.gearDays) : null,
      });
      setAssignments(prev => [...prev, a]);
      setShowAddSlot(false);
      setSlotForm({ positionId:'', crewMemberId:'', slotNumber:1, startDate:'', endDate:'', isContractor:false, dayRate:'', laborDays:'', gearCost:'', gearDays:'' });
    } catch(e) { alert(e.message); }
  }

  async function addSlotAndContract(send) {
    if (!slotForm.positionId) { alert('Select a position first.'); return; }
    if (!slotForm.crewMemberId) { alert('Select a crew member first.'); return; }
    setContractBusy(true);
    try {
      const a = await api.addCrewSlot(project.id, {
        positionId: slotForm.positionId,
        crewMemberId: slotForm.crewMemberId || null,
        slotNumber: parseInt(slotForm.slotNumber) || 1,
        startDate: slotForm.startDate || null,
        endDate: slotForm.endDate || null,
        isContractor: true,
        dayRate: slotForm.dayRate !== '' ? Number(slotForm.dayRate) : null,
        laborDays: slotForm.laborDays !== '' ? Number(slotForm.laborDays) : null,
        gearCost: slotForm.gearCost !== '' ? Number(slotForm.gearCost) : null,
        gearDays: slotForm.gearDays !== '' ? Number(slotForm.gearDays) : null,
      });
      setAssignments(prev => [...prev, a]);
      const scope = contractScope.trim() || defaultScope(a);
      const c = await api.createContract(project.id, a.id, { scope });
      setContracts(prev => [c, ...prev]);
      let sentTo = '';
      if (send) {
        const r = await api.emailContract(project.id, c.id);
        sentTo = r.to;
      }
      setShowAddSlot(false);
      setSlotForm({ positionId:'', crewMemberId:'', slotNumber:1, startDate:'', endDate:'', isContractor:false, dayRate:'', laborDays:'', gearCost:'', gearDays:'' });
      // open the edit modal on the new slot so the link/confirmation is visible
      setEditForm({
        crewMemberId: a.crewMember?.id || a.crew_member_id || '',
        startDate: (a.start_date || '').slice(0,10),
        endDate: (a.end_date || '').slice(0,10),
        isContractor: true,
        dayRate: a.day_rate ?? '',
        laborDays: a.labor_days ?? '',
        gearCost: a.gear_cost ?? '',
        gearDays: a.gear_days ?? '',
      });
      setContractScope(scope);
      setContractLink(`${window.location.origin}/contract/${c.id}`);
      setContractSent(sentTo);
      setLinkCopied(false);
      setEditId(a.id);
    } catch (e) { alert(e.message); }
    setContractBusy(false);
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

  function openEditSlot(a) {
    const cmId = a.crewMember?.id || a.crew_member_id || '';
    const dates = flightDatesFor(cmId);
    setEditForm({
      crewMemberId: cmId,
      startDate: (a.start_date || dates.startDate || '').slice(0,10),
      endDate: (a.end_date || dates.endDate || '').slice(0,10),
      isContractor: !!a.is_contractor,
      dayRate: a.day_rate ?? '',
      laborDays: a.labor_days ?? '',
      gearCost: a.gear_cost ?? '',
      gearDays: a.gear_days ?? '',
    });
    if (a.is_contractor) {
      const existing = contractFor(a.id);
      setContractScope(existing?.scope || defaultScope(a));
      setContractLink(existing ? `${window.location.origin}/contract/${existing.id}` : '');
      setLinkCopied(false);
      setContractSent('');
    }
    setEditId(a.id);
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      const payload = {
        crewMemberId: editForm.crewMemberId || null,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        isContractor: isContractorMember(editForm.crewMemberId) === true,
        dayRate: isContractorMember(editForm.crewMemberId) === true && editForm.dayRate !== '' ? Number(editForm.dayRate) : null,
        laborDays: isContractorMember(editForm.crewMemberId) === true && editForm.laborDays !== '' ? Number(editForm.laborDays) : null,
        gearCost: isContractorMember(editForm.crewMemberId) === true && editForm.gearCost !== '' ? Number(editForm.gearCost) : null,
        gearDays: isContractorMember(editForm.crewMemberId) === true && editForm.gearDays !== '' ? Number(editForm.gearDays) : null,
      };
      const updated = await api.updateCrewSlot(project.id, editId, payload);
      setAssignments(prev => prev.map(a => a.id === editId ? updated : a));
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
      const dayCalls = Object.entries(addTalentDayCalls)
        .filter(([, v]) => v)
        .map(([shootDayId, callTime]) => ({ shootDayId, callTime }));
      if (dayCalls.length) await api.saveTalentDayCalls(project.id, t.id, dayCalls).catch(() => {});
      if (onProjectUpdate) onProjectUpdate(p => ({ ...p, keyTalent: [...(p.keyTalent||[]), t] }));
      setShowTalentModal(false);
      setTalentForm({ name:'', role:'', videoTitle:'', phone:'', email:'', notes:'', dietaryRestrictions:'', callTime:'', wardrobeNotes:'', arrivalNotes:'' });
    } catch(e) { alert(e.message); }
  }

  async function saveEditTalent(e) {
    e.preventDefault();
    try {
      const dayCalls = Object.entries(talentDayCallsForm)
        .filter(([, v]) => v)
        .map(([shootDayId, callTime]) => ({ shootDayId, callTime }));
      const [t] = await Promise.all([
        api.updateTalent(project.id, editTalent.id, editTalentForm),
        api.saveTalentDayCalls(project.id, editTalent.id, dayCalls),
      ]);
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
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddSlot(true)}>+ Add Position</button>
      </div>

      {assignments.length === 0 && <div className="empty">No crew assigned yet. Add a position to get started.</div>}

      {assignments.length > 0 && (() => {
        const staff = assignments.filter(a => !a.is_contractor);
        const contractors = assignments.filter(a => a.is_contractor);
        const laborTotal = contractors.reduce((s, a) => s + (Number(a.day_rate) || 0) * (Number(a.labor_days) || 0), 0);
        const gearTotal = contractors.reduce((s, a) => s + (Number(a.gear_cost) || 0) * (Number(a.gear_days) || 0), 0);
        const fmt$ = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
        const renderRow = a => (
                <tr key={a.id}>
                  <td>
                    <div className="pos-name">{a.position.name}</div>
                    {a.slotNumber > 1 && <div className="pos-slot">Slot {a.slotNumber}</div>}
                  </td>
                  <td>
                    {a.crewMember ? (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {(() => {
                          if (!a.is_contractor) return <div style={{ width:8, height:8, flexShrink:0 }} />;
                          const c = contractFor(a.id);
                          const color = c?.signed_at ? 'var(--green)' : c ? '#e6c229' : '#e05252';
                          const label = c?.signed_at ? 'Contract accepted' : c ? 'Contract sent - awaiting signature' : 'Contract not sent';
                          return <div title={label} style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />;
                        })()}
                        <div className="av" style={{ width:26, height:26, fontSize:9, background: colorFor(a.crewMember.name)+'22', color: colorFor(a.crewMember.name) }}>
                          {initials(a.crewMember.name)}
                        </div>
                        <div style={{ fontSize:12, fontWeight:500 }}>{displayName(a.crewMember)}</div>
                      </div>
                    ) : <span style={{ color:'var(--muted)', fontSize:11 }}>— Unassigned —</span>}
                  </td>
                  <td style={{ fontSize:11, color:'var(--tan)', whiteSpace:'nowrap' }}>{a.crewMember?.phone || '—'}</td>
                  <td style={{ fontSize:11, color:'var(--muted)' }}>{a.crewMember?.email || '—'}</td>
                  <td style={{ fontSize:11 }}>
                    {a.crewMember?.dietaryRestrictions && a.crewMember.dietaryRestrictions !== 'N/A'
                      ? <span>⚠️ {a.crewMember.dietaryRestrictions}</span>
                      : <span style={{ color:'var(--muted)' }}>—</span>}
                  </td>
                  <td><span style={{ fontSize:11, color:'var(--orange)' }}>{fmtDate(a.start_date)}</span></td>
                  <td><span style={{ fontSize:11, color:'var(--orange)' }}>{fmtDate(a.end_date)}</span></td>
                  <td style={{ whiteSpace:'nowrap' }}>
                    {a.is_contractor && (a.day_rate || a.labor_days)
                      ? <span style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{fmt$((Number(a.day_rate)||0)*(Number(a.labor_days)||0))}</span>
                      : <span style={{ color:'var(--muted)', fontSize:11 }}>{a.is_contractor ? '—' : ''}</span>}
                  </td>
                  <td style={{ whiteSpace:'nowrap' }}>
                    {a.is_contractor && (a.gear_cost || a.gear_days)
                      ? <span style={{ fontSize:11, color:'var(--green)', fontWeight:600 }}>{fmt$((Number(a.gear_cost)||0)*(Number(a.gear_days)||0))}</span>
                      : <span style={{ color:'var(--muted)', fontSize:11 }}>{a.is_contractor ? '—' : ''}</span>}
                  </td>
                  <td style={{ textAlign:'right' }}>
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end', alignItems:'center' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEditSlot(a)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => removeSlot(a.id)}>✕</button>
                    </div>
                  </td>
                </tr>
        );
        const sectionRow = (label, color) => (
          <tr>
            <td colSpan={10} style={{ padding:'6px 14px', background:`${color}14`, borderTop:'1px solid var(--border)' }}>
              <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color }}>{label}</span>
            </td>
          </tr>
        );
        return (
        <div className="pos-table-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          <table className="pos-table" style={{ width:'100%' }}>
            <thead>
              <tr>
                <th>Position</th>
                <th>Crew Member</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Dietary</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.length > 0 && sectionRow('Unbridled Crew', 'var(--orange)')}
              {staff.map(renderRow)}
              {contractors.length > 0 && (
                <tr>
                  <td colSpan={7} style={{ padding:'6px 14px', background:'rgba(230,194,41,0.08)', borderTop:'1px solid var(--border)' }}>
                    <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#e6c229' }}>Contract Crew</span>
                  </td>
                  <td style={{ padding:'6px 8px', background:'rgba(230,194,41,0.08)', borderTop:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#e6c229' }}>Labor</span>
                  </td>
                  <td style={{ padding:'6px 8px', background:'rgba(230,194,41,0.08)', borderTop:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'#e6c229' }}>Gear</span>
                  </td>
                  <td style={{ background:'rgba(230,194,41,0.08)', borderTop:'1px solid var(--border)' }}></td>
                </tr>
              )}
              {contractors.map(renderRow)}
              {contractors.length > 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign:'right', padding:'8px 14px', borderTop:'1px solid var(--border)', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)' }}>Totals</td>
                  <td style={{ borderTop:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:10, color:'var(--muted)' }}>Labor </span>
                    <span style={{ fontSize:12, color:'var(--green)', fontWeight:700 }}>{fmt$(laborTotal)}</span>
                  </td>
                  <td style={{ borderTop:'1px solid var(--border)', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:10, color:'var(--muted)' }}>Gear </span>
                    <span style={{ fontSize:12, color:'var(--green)', fontWeight:700 }}>{fmt$(gearTotal)}</span>
                  </td>
                  <td style={{ borderTop:'1px solid var(--border)' }}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        );
      })()}

      {/* Talent */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:24, marginBottom:6 }}>
        <div className="sec-lbl" style={{ marginTop:0 }}>Talent</div>
        <button className="btn btn-primary btn-sm" onClick={() => {
          setAddTalentDayCalls({});
          api.getSchedule(project.id).then(setTalentDays).catch(() => {});
          setShowTalentModal(true);
        }}>+ Add Talent</button>
      </div>
      {(project.keyTalent||[]).length === 0
        ? <div className="empty" style={{ marginBottom:16 }}>No talent added yet.</div>
        : (
          <div className="pos-table-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
            <table className="pos-table" style={{ width:'100%' }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Video Title</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Dietary</th>
                  <th>Call Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(project.keyTalent||[]).map(t => (
                  <tr key={t.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="av" style={{ width:26, height:26, fontSize:9, background: colorFor(t.name)+'22', color: colorFor(t.name) }}>{initials(t.name)}</div>
                        <div style={{ fontSize:12, fontWeight:500 }}>{t.name}</div>
                      </div>
                    </td>
                    <td><div className="pos-name">{t.role}</div></td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{t.video_title || '—'}</td>
                    <td style={{ fontSize:11, color:'var(--tan)', whiteSpace:'nowrap' }}>{t.phone || '—'}</td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{t.email || '—'}</td>
                    <td style={{ fontSize:11, color:'var(--muted)' }}>{t.dietary_restrictions || '—'}</td>
                    <td style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>{t.call_time ? fmtTime(t.call_time) : '—'}</td>
                    <td style={{ textAlign:'right' }}>
                      <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          setEditTalent(t);
                          setEditTalentForm({ name: t.name, role: t.role, videoTitle: t.video_title||'', phone: t.phone||'', email: t.email||'', notes: t.notes||'', dietaryRestrictions: t.dietary_restrictions||'', callTime: t.call_time||'', wardrobeNotes: t.wardrobe_notes||'', arrivalNotes: t.arrival_notes||'' });
                          setTalentDayCallsForm({});
                          Promise.all([
                            api.getSchedule(project.id),
                            api.getTalentDayCalls(project.id, t.id),
                          ]).then(([days, calls]) => {
                            setTalentDays(days);
                            const m = {};
                            calls.forEach(c => { m[c.shoot_day_id] = c.call_time || ''; });
                            setTalentDayCallsForm(m);
                          }).catch(() => {});
                        }}>Edit</button>
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
        <div className="pos-table-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:12 }}>
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
                <div className="field span2">
                  <label>Dietary Restrictions</label>
                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                    <input value={memberForm.dietaryRestrictions === 'N/A' ? '' : memberForm.dietaryRestrictions} onChange={e => setMemberForm(f=>({...f,dietaryRestrictions:e.target.value}))} placeholder="Vegetarian, gluten-free, nut allergy…" disabled={memberForm.dietaryRestrictions === 'N/A'} style={{ flex:1 }} />
                    <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--muted)', whiteSpace:'nowrap', cursor:'pointer' }}>
                      <input type="checkbox" checked={memberForm.dietaryRestrictions === 'N/A'} onChange={e => setMemberForm(f=>({...f,dietaryRestrictions: e.target.checked ? 'N/A' : ''}))} style={{ width:'auto', margin:0 }} />
                      N/A
                    </label>
                  </div>
                </div>
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
                    setSlotForm(f => {
                      const next = { ...f, crewMemberId: id, startDate: dates.startDate || f.startDate, endDate: dates.endDate || f.endDate };
                      if (isContractorMember(id) === true) {
                        const posName = positions.find(x => x.id === next.positionId)?.name || 'crew';
                        setContractScope(defaultScope({ position: { name: posName }, start_date: next.startDate, end_date: next.endDate }));
                        setContractLink('');
                        setContractSent('');
                        setNewContractor(false);
                        api.getCrewMember(id).then(d => setNewContractor((d.assignments || []).length === 0)).catch(() => {});
                      } else {
                        setNewContractor(false);
                      }
                      return next;
                    });
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
                {slotForm.crewMemberId && isContractorMember(slotForm.crewMemberId) !== null && (
                  <div className="field span2">
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                      <span style={{
                        display:'inline-flex', alignItems:'center',
                        background: isContractorMember(slotForm.crewMemberId) ? 'rgba(230,194,41,0.15)' : 'rgba(255,140,0,0.12)',
                        border: `1px solid ${isContractorMember(slotForm.crewMemberId) ? '#e6c229' : 'var(--orange)'}`,
                        color: isContractorMember(slotForm.crewMemberId) ? '#e6c229' : 'var(--orange)',
                        borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase',
                      }}>
                        {isContractorMember(slotForm.crewMemberId) ? 'Contract Crew' : 'Unbridled Crew'}
                      </span>
                      {isContractorMember(slotForm.crewMemberId) && newContractor && (
                        <span title="First time hiring this contractor — request onboarding documents." style={{
                          display:'inline-flex', alignItems:'center', gap:5,
                          background:'rgba(224,82,82,0.12)', border:'1px solid #e05252', color:'#e05252',
                          borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase',
                        }}>
                          ★ New Contractor
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>Set by the roster — edit their company in Roster Look-Up to change.{isContractorMember(slotForm.crewMemberId) && newContractor ? ' First hire in the system — collect onboarding documents.' : ''}</span>
                  </div>
                )}
                {isContractorMember(slotForm.crewMemberId) === true && (
                  <>
                    <div className="field">
                      <label>Day Rate ($)</label>
                      <input type="number" min="0" step="0.01" placeholder="650" value={slotForm.dayRate} onChange={e => setSlotForm(f=>({...f,dayRate:e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Labor Days</label>
                      <input type="number" min="0" step="0.5" placeholder="3" value={slotForm.laborDays} onChange={e => setSlotForm(f=>({...f,laborDays:e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Gear Rate ($/day)</label>
                      <input type="number" min="0" step="0.01" placeholder="0" value={slotForm.gearCost} onChange={e => setSlotForm(f=>({...f,gearCost:e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Gear Days</label>
                      <input type="number" min="0" step="0.5" placeholder="3" value={slotForm.gearDays} onChange={e => setSlotForm(f=>({...f,gearDays:e.target.value}))} />
                    </div>
                    <div className="field" style={{ justifyContent:'flex-end' }}>
                      <label>Labor Total</label>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--green)', padding:'6px 0' }}>
                        ${((Number(slotForm.dayRate)||0) * (Number(slotForm.laborDays)||0)).toLocaleString('en-US', { maximumFractionDigits:2 })}
                      </div>
                    </div>
                    <div className="field" style={{ justifyContent:'flex-end' }}>
                      <label>Gear Total</label>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--green)', padding:'6px 0' }}>
                        ${((Number(slotForm.gearCost)||0) * (Number(slotForm.gearDays)||0)).toLocaleString('en-US', { maximumFractionDigits:2 })}
                      </div>
                    </div>
                    <div className="field span2" style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
                      <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:'#e05252', display:'inline-block' }} />
                        Contract — not sent
                      </label>
                      <textarea rows={4} value={contractScope} onChange={e => setContractScope(e.target.value)} style={{ marginTop:6 }} />
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, flexWrap:'wrap' }}>
                        <button type="button" className="btn btn-primary btn-sm" disabled={contractBusy} onClick={() => addSlotAndContract(true)}>
                          {contractBusy ? 'Working…' : 'Add & Send Contract'}
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={contractBusy} onClick={() => addSlotAndContract(false)}>
                          Add & Generate Link
                        </button>
                        <span style={{ fontSize:10, color:'var(--muted)' }}>Adds the position, then snapshots the rates &amp; scope above.</span>
                      </div>
                    </div>
                  </>
                )}
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

      {/* Edit Position Slot Modal */}
      {editId && (() => {
        const a = assignments.find(x => x.id === editId);
        if (!a) return null;
        return (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditId(null)}>
          <div className="modal">
            <div className="modal-title">Edit Position — {a.position?.name || a.position_name}{a.slot_number > 1 ? ` (Slot ${a.slot_number})` : ''}</div>
            <form onSubmit={saveEdit}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2">
                  <label>Crew Member</label>
                  <select value={editForm.crewMemberId || ''} onChange={e => {
                    const id = e.target.value;
                    const dates = flightDatesFor(id);
                    setEditForm(f => ({ ...f, crewMemberId: id, startDate: f.startDate || dates.startDate, endDate: f.endDate || dates.endDate }));
                  }}>
                    <option value="">— Unassigned —</option>
                    {roster.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <span style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>Can't find them? Add via "New Person" first.</span>
                </div>
                <div className="field">
                  <label>Start Date</label>
                  <input type="date" value={editForm.startDate || ''} onChange={e => setEditForm(f=>({...f,startDate:e.target.value}))} />
                </div>
                <div className="field">
                  <label>End Date</label>
                  <input type="date" value={editForm.endDate || ''} onChange={e => setEditForm(f=>({...f,endDate:e.target.value}))} />
                </div>
                {editForm.crewMemberId && isContractorMember(editForm.crewMemberId) !== null && (
                  <div className="field span2">
                    <span style={{
                      alignSelf:'flex-start', display:'inline-flex', alignItems:'center',
                      background: isContractorMember(editForm.crewMemberId) ? 'rgba(230,194,41,0.15)' : 'rgba(255,140,0,0.12)',
                      border: `1px solid ${isContractorMember(editForm.crewMemberId) ? '#e6c229' : 'var(--orange)'}`,
                      color: isContractorMember(editForm.crewMemberId) ? '#e6c229' : 'var(--orange)',
                      borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase',
                    }}>
                      {isContractorMember(editForm.crewMemberId) ? 'Contract Crew' : 'Unbridled Crew'}
                    </span>
                    <span style={{ fontSize:10, color:'var(--muted)', marginTop:3 }}>Set by the roster — edit their company in Roster Look-Up to change.</span>
                  </div>
                )}
                {isContractorMember(editForm.crewMemberId) === true && (
                  <>
                    <div className="field">
                      <label>Day Rate ($)</label>
                      <input type="number" min="0" step="0.01" placeholder="650" value={editForm.dayRate ?? ''} onChange={e => setEditForm(f=>({...f,dayRate:e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Labor Days</label>
                      <input type="number" min="0" step="0.5" placeholder="3" value={editForm.laborDays ?? ''} onChange={e => setEditForm(f=>({...f,laborDays:e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Gear Rate ($/day)</label>
                      <input type="number" min="0" step="0.01" placeholder="0" value={editForm.gearCost ?? ''} onChange={e => setEditForm(f=>({...f,gearCost:e.target.value}))} />
                    </div>
                    <div className="field">
                      <label>Gear Days</label>
                      <input type="number" min="0" step="0.5" placeholder="3" value={editForm.gearDays ?? ''} onChange={e => setEditForm(f=>({...f,gearDays:e.target.value}))} />
                    </div>
                    <div className="field" style={{ justifyContent:'flex-end' }}>
                      <label>Labor Total</label>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--green)', padding:'6px 0' }}>
                        ${((Number(editForm.dayRate)||0) * (Number(editForm.laborDays)||0)).toLocaleString('en-US', { maximumFractionDigits:2 })}
                      </div>
                    </div>
                    <div className="field" style={{ justifyContent:'flex-end' }}>
                      <label>Gear Total</label>
                      <div style={{ fontSize:14, fontWeight:700, color:'var(--green)', padding:'6px 0' }}>
                        ${((Number(editForm.gearCost)||0) * (Number(editForm.gearDays)||0)).toLocaleString('en-US', { maximumFractionDigits:2 })}
                      </div>
                    </div>
                    <div className="field span2" style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
                      {(() => {
                        const c = contractFor(a.id);
                        const signed = c && c.signed_at;
                        const dotColor = signed ? 'var(--green)' : c ? '#e6c229' : '#e05252';
                        const mailBody = encodeURIComponent(`Hi ${a.crewMember?.name?.split(' ')[0] || ''},\n\nPlease review and sign your agreement for ${project.title}:\n${contractLink}\n\nThanks!`);
                        const mailHref = `mailto:${a.crewMember?.email || ''}?subject=${encodeURIComponent(`${project.title} — Contractor Agreement`)}&body=${mailBody}`;
                        return (
                          <>
                            <label style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ width:8, height:8, borderRadius:'50%', background:dotColor, display:'inline-block' }} />
                              Contract — {signed ? `signed by ${c.signed_name} on ${new Date(c.signed_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : c ? 'sent, awaiting signature' : 'not sent'}
                            </label>
                            {!signed && (
                              <textarea rows={4} value={contractScope} onChange={e => setContractScope(e.target.value)} style={{ marginTop:6 }} />
                            )}
                            {contractLink && (
                              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                                <input readOnly value={contractLink} style={{ flex:1, fontSize:11 }} onFocus={e => e.target.select()} />
                                <button type="button" className="btn btn-ghost btn-sm" onClick={copyContractLink}>{linkCopied ? '✓ Copied' : 'Copy'}</button>
                                {a.crewMember?.email && !signed && <a className="btn btn-ghost btn-sm" href={mailHref} style={{ textDecoration:'none', display:'inline-flex', alignItems:'center' }}>Email</a>}
                              </div>
                            )}
                            {!signed && (
                              <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
                                <button type="button" className="btn btn-primary btn-sm" disabled={contractBusy} onClick={() => sendContractEmail(a.id)}>
                                  {contractBusy ? 'Working…' : 'Send Contract'}
                                </button>
                                <button type="button" className="btn btn-ghost btn-sm" disabled={contractBusy} onClick={() => generateContract(a.id)}>
                                  {contractLink ? 'Regenerate Link' : 'Generate Link Only'}
                                </button>
                                <span style={{ fontSize:10, color:'var(--muted)' }}>Snapshots the rates &amp; scope above.</span>
                              </div>
                            )}
                            {contractSent && !signed && <div style={{ fontSize:11, color:'var(--green)', marginTop:6 }}>✓ Emailed to {contractSent}</div>}
                            {signed && <a href={contractLink} target="_blank" rel="noopener noreferrer" style={{ fontSize:11, color:'#4a9eff', display:'inline-block', marginTop:6 }}>View signed contract ↗</a>}
                          </>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditId(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
        );
      })()}

      {/* Edit Talent Modal */}
      {editTalent && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditTalent(null)}>
          <div className="modal">
            <div className="modal-title">Edit Talent — {editTalent.name}</div>
            <form onSubmit={saveEditTalent}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name</label><input value={editTalentForm.name} onChange={e => setEditTalentForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Role / Title</label><input value={editTalentForm.role} onChange={e => setEditTalentForm(f=>({...f,role:e.target.value}))} required /></div>
                <div className="field span2"><label>Video Title</label><input value={editTalentForm.videoTitle} onChange={e => setEditTalentForm(f=>({...f,videoTitle:e.target.value}))} placeholder="Campaign name or video title…" /></div>
                <div className="field"><label>Phone</label><input value={editTalentForm.phone} onChange={e => setEditTalentForm(f=>({...f,phone:e.target.value}))} placeholder="555-123-4567" /></div>
                <div className="field"><label>Email</label><input type="email" value={editTalentForm.email} onChange={e => setEditTalentForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field span2"><label>Dietary Restrictions</label><input value={editTalentForm.dietaryRestrictions} onChange={e => setEditTalentForm(f=>({...f,dietaryRestrictions:e.target.value}))} placeholder="Vegetarian, nut allergy…" /></div>
                <div className="field span2"><label>Wardrobe Notes</label><textarea value={editTalentForm.wardrobeNotes} onChange={e => setEditTalentForm(f=>({...f,wardrobeNotes:e.target.value}))} rows={2} /></div>
                <div className="field span2"><label>Arrival Notes</label><textarea value={editTalentForm.arrivalNotes} onChange={e => setEditTalentForm(f=>({...f,arrivalNotes:e.target.value}))} rows={2} /></div>
              </div>
              {talentDays.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:8 }}>Call Times by Day</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px' }}>
                    {talentDays.map((day, i) => {
                      const dateLabel = day.date ? new Date(day.date.slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
                      return (
                        <React.Fragment key={day.id}>
                          <div style={{ display:'flex', alignItems:'center', fontSize:12, color:'var(--text)', fontWeight:500 }}>
                            Day {i+1}{dateLabel ? ` — ${dateLabel}` : ''}
                          </div>
                          <input type="time" value={talentDayCallsForm[day.id] || ''} onChange={e => setTalentDayCallsForm(m => ({ ...m, [day.id]: e.target.value }))} />
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
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
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="modal-title">Add Talent</div>
            <form onSubmit={addTalent}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Name *</label><input value={talentForm.name} onChange={e => setTalentForm(f=>({...f,name:e.target.value}))} required /></div>
                <div className="field"><label>Role / Title</label><input value={talentForm.role} onChange={e => setTalentForm(f=>({...f,role:e.target.value}))} /></div>
                <div className="field"><label>Email</label><input type="email" value={talentForm.email} onChange={e => setTalentForm(f=>({...f,email:e.target.value}))} /></div>
                <div className="field"><label>Phone</label><input value={talentForm.phone} onChange={e => setTalentForm(f=>({...f,phone:e.target.value}))} /></div>
                <div className="field"><label>Video Title</label><input value={talentForm.videoTitle} onChange={e => setTalentForm(f=>({...f,videoTitle:e.target.value}))} /></div>
                <div className="field"><label>Dietary Restrictions</label><input value={talentForm.dietaryRestrictions} onChange={e => setTalentForm(f=>({...f,dietaryRestrictions:e.target.value}))} /></div>
                <div className="field"><label>Wardrobe Notes</label><input value={talentForm.wardrobeNotes} onChange={e => setTalentForm(f=>({...f,wardrobeNotes:e.target.value}))} /></div>
                <div className="field span2"><label>Arrival Notes</label><input value={talentForm.arrivalNotes} onChange={e => setTalentForm(f=>({...f,arrivalNotes:e.target.value}))} /></div>
              </div>
              {talentDays.length > 0 && (
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:8 }}>Call Times by Day</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px' }}>
                    {talentDays.map((day, i) => {
                      const dateLabel = day.date ? new Date(day.date.slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '';
                      return (
                        <React.Fragment key={day.id}>
                          <div style={{ display:'flex', alignItems:'center', fontSize:12, color:'var(--text)', fontWeight:500 }}>
                            Day {i+1}{dateLabel ? ` — ${dateLabel}` : ''}
                          </div>
                          <input type="time" value={addTalentDayCalls[day.id] || ''} onChange={e => setAddTalentDayCalls(m => ({ ...m, [day.id]: e.target.value }))} />
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
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
