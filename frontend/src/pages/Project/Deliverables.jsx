import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';
import { EditorSelect, AVO_STATUSES } from '../Avo.jsx';

const STATUSES = ['WAITING_ON_ASSETS','IN_PROGRESS','ROUGH_CUT','IN_REVIEW','APPROVED','DELIVERED'];
const STATUS_LABEL = { WAITING_ON_ASSETS:'Waiting on Assets', IN_PROGRESS:'In Progress', ROUGH_CUT:'Rough Cut', IN_REVIEW:'In Review', APPROVED:'Approved', DELIVERED:'Delivered' };
const STATUS_DOT = { WAITING_ON_ASSETS:'wait', IN_PROGRESS:'prog', ROUGH_CUT:'prog', IN_REVIEW:'prog', APPROVED:'done', DELIVERED:'done' };

// Grouped by the Avo tracker Type; legacy category values map onto it
const TYPE_GROUPS = [['Pre-Event', '#4a9eff'], ['On-Site', '#e6c229'], ['Post-Event', '#9DC183'], ['Standard Edit', '#a78bfa']];
const LEGACY_TYPE = { PRE_PRODUCED:'Pre-Event', ON_SITE:'On-Site', POST_SHOOT:'Post-Event' };
const typeOf = item => item.tracker_type || LEGACY_TYPE[item.category] || item.category || null;
const AVO_CATEGORIES = ['Event Recap', 'Opener', 'Sizzle', 'Interstitial', 'Documentary', 'Teaser', 'Social Cutdown', 'Photo Slideshow', 'Other'];
export const BLANK_DELIVERABLE_FORM = { title:'', description:'', status:'COMING_SOON', trackerType:'', category:'', leadEditorId:'', pmId:'', aspectRatio:'', resolution:'', assetRef:'', musicRef:'', startDate:'', endDate:'', reviewLink:'', costEstimate:'' };

// Same fields as the AvocadoPost edit form — one form for add and edit
export function AvoForm({ title, form, setForm, onSubmit, onCancel, saving, editId }) {
  const inp = (k, ph, type='text') => (
    <input type={type} value={form[k] || ''} placeholder={ph} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} />
  );
  // Contract editors (not on Unbridled staff) reveal a cost estimate + VCC hold
  const [roster, setRoster] = useState([]);
  const [holding, setHolding] = useState(false);
  const [held, setHeld] = useState(false);
  useEffect(() => { api.getCrew().then(setRoster).catch(() => {}); }, []);
  const leadEditor = roster.find(m => m.id === form.leadEditorId);
  const isContractEditor = !!leadEditor && !(leadEditor.company || '').toLowerCase().includes('unbridled');
  async function holdOnVcc() {
    if (!editId || holding) return;
    setHolding(true);
    try {
      await api.updateAvoEdit(editId, { costEstimate: form.costEstimate });
      await api.holdEditCost(editId);
      setHeld(true); setTimeout(() => setHeld(false), 2500);
    } catch (e) { alert(e.message); }
    setHolding(false);
  }
  return (
    <div className="modal-bg" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <div className="modal-title">{title}</div>
        <form onSubmit={onSubmit}>
          <div className="form-grid" style={{ marginBottom:12 }}>
            <div className="field span2"><label>Video Title</label><input value={form.title} required onChange={e => setForm(f=>({...f,title:e.target.value}))} /></div>
            <div className="field span2"><label>Description</label>{inp('description', 'Plays Day 4 GS · 2 min')}</div>
            <div className="field span2"><label>Status</label>
              <select value={form.status || 'COMING_SOON'} onChange={e => setForm(f=>({...f,status:e.target.value}))}>
                {AVO_STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </div>
            <div className="field"><label>Type</label>
              <select value={form.trackerType || ''} onChange={e => setForm(f=>({...f,trackerType:e.target.value}))}>
                <option value="">—</option>
                {TYPE_GROUPS.map(([t]) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field"><label>Category</label>
              <select value={form.category || ''} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
                <option value="">—</option>
                {form.category && !AVO_CATEGORIES.includes(form.category) && <option value={form.category}>{form.category}</option>}
                {AVO_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Lead Editor</label><EditorSelect value={form.leadEditorId} onChange={v => setForm(f=>({...f,leadEditorId:v}))} /></div>
            {isContractEditor && (
              <div className="field span2" style={{ background:'rgba(230,194,41,0.06)', border:'1px solid rgba(230,194,41,0.35)', borderRadius:8, padding:'10px 12px' }}>
                <label style={{ color:'#e6c229' }}>Contract Editor — Cost Estimate ($)</label>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <input type="number" min="0" step="0.01" value={form.costEstimate || ''} placeholder="0.00"
                    onChange={e => setForm(f => ({ ...f, costEstimate: e.target.value }))} style={{ flex:1 }} />
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!editId || !form.costEstimate || holding}
                    title={editId ? 'Adds a HOLD line to the project VCC' : 'Save this deliverable first, then hold the cost'}
                    onClick={holdOnVcc}
                    style={{ whiteSpace:'nowrap', borderColor:'#e6c229', color: held ? '#0b0b0b' : '#e6c229', background: held ? '#e6c229' : 'transparent' }}>
                    {held ? '✓ Held on VCC' : holding ? 'Holding…' : 'Hold Cost on VCC'}
                  </button>
                </div>
                {!editId && <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>Save first, then reopen to hold the cost on the VCC.</div>}
              </div>
            )}
            <div className="field"><label>Project Manager</label><EditorSelect value={form.pmId} placeholder="— No PM —" unbridledOnly onChange={v => setForm(f=>({...f,pmId:v}))} /></div>
            <div className="field"><label>Aspect Ratio</label>{inp('aspectRatio', '16:9')}</div>
            <div className="field"><label>Resolution</label>{inp('resolution', '1920×1080')}</div>
            <div className="field"><label>Asset Ref</label>{inp('assetRef', 'Asset #801_')}</div>
            <div className="field"><label>Music Ref</label>{inp('musicRef', 'C3 Recap Music')}</div>
            <div className="field"><label>Start Date</label>{inp('startDate', '', 'date')}</div>
            <div className="field"><label>Due Date</label>{inp('endDate', '', 'date')}</div>
            <div className="field span2"><label>Review Link</label>{inp('reviewLink', 'https://frame.io/…')}</div>
          </div>
          <div style={{ fontSize:10, color:'var(--muted)', marginBottom:10 }}>These fields mirror the AvocadoPost edit — changes here update the pipeline and vice versa.</div>
          <div className="btn-row">
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Deliverables({ project }) {
  const [items, setItems] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(BLANK_DELIVERABLE_FORM);
  const [editId, setEditId] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editItemId, setEditItemId] = useState(null);   // deliverable being edited
  const [editForm, setEditForm] = useState(BLANK_DELIVERABLE_FORM);
  const [saving, setSaving] = useState(false);
  const [detailItem, setDetailItem] = useState(null);

  const [ditId, setDitId] = useState(project.techSpecs?.dit_crew_member_id || '');
  const [ditSaving, setDitSaving] = useState(false);
  const [frameRate, setFrameRate] = useState(project.techSpecs?.frame_rate || '');
  const [brollFrameRate, setBrollFrameRate] = useState(project.techSpecs?.broll_frame_rate || '');
  const [aspectRatio, setAspectRatio] = useState(project.techSpecs?.aspect_ratio || '');
  const [resolution, setResolution] = useState(project.techSpecs?.resolution || '');

  useEffect(() => {
    api.getDeliverables(project.id).then(setItems);
  }, [project.id]);

  // Editor picks from the crew roster so the name always matches the Avo lead editor
  const [roster, setRoster] = useState([]);
  useEffect(() => { api.getCrew().then(setRoster).catch(() => setRoster([])); }, []);
  const editorNames = [...new Set(roster.map(m => displayName(m)).filter(Boolean))].sort();
  const EditorPick = ({ value, onChange }) => (
    <select value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">— Unassigned —</option>
      {value && !editorNames.includes(value) && <option value={value}>{value}</option>}
      {editorNames.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  );

  async function saveTechSpecsField(fields) {
    const existing = project.techSpecs || {};
    await api.saveTechSpecs(project.id, {
      aspectRatio: aspectRatio || existing.aspect_ratio || null,
      resolution: resolution || existing.resolution || null,
      quality: existing.quality || null,
      cameras: existing.cameras || null,
      execProducer: existing.exec_producer || null,
      onSiteEditor: existing.on_site_editor || null,
      notes: existing.notes || null,
      ditCrewMemberId: ditId || null,
      frameRate: frameRate || null,
      brollFrameRate: brollFrameRate || null,
      ...fields,
    });
  }

  async function saveDit(crewMemberId) {
    setDitId(crewMemberId);
    setDitSaving(true);
    try { await saveTechSpecsField({ ditCrewMemberId: crewMemberId || null }); }
    catch(err) { alert(err.message); }
    setDitSaving(false);
  }

  async function saveFrameRate(value) {
    setFrameRate(value);
    try { await saveTechSpecsField({ frameRate: value || null }); }
    catch(err) { alert(err.message); }
  }

  async function saveBrollFrameRate(value) {
    setBrollFrameRate(value);
    try { await saveTechSpecsField({ brollFrameRate: value || null }); }
    catch(err) { alert(err.message); }
  }

  async function saveAspectRatio(value) {
    setAspectRatio(value);
    try { await saveTechSpecsField({ aspectRatio: value || null }); }
    catch(err) { alert(err.message); }
  }

  async function saveResolution(value) {
    setResolution(value);
    try { await saveTechSpecsField({ resolution: value || null }); }
    catch(err) { alert(err.message); }
  }

  const reload = () => api.getDeliverables(project.id).then(setItems);

  async function add(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      // Creating through Avo keeps the pipeline and this list identical
      await api.createAvoEdit({ ...form, projectCode: project.code });
      await reload();
      setShowAdd(false);
      setForm(BLANK_DELIVERABLE_FORM);
    } catch(e) { alert(e.message); }
    setSaving(false);
  }

  async function updateStatus(id, status) {
    const updated = await api.updateDeliverable(project.id, id, { status });
    setItems(d => d.map(i => i.id === id ? updated : i));
    setEditId(null);
  }

  const isoD = d => d ? String(d).slice(0, 10) : '';
  function openEdit(item) {
    setEditItemId(item);
    setEditForm({
      title: item.title || '', description: item.description || '',
      status: item.avo_status || 'COMING_SOON',
      trackerType: item.tracker_type || LEGACY_TYPE[item.category] || '',
      category: item.avo_category || '',
      leadEditorId: item.lead_editor_id || '', pmId: item.pm_id || '',
      aspectRatio: item.aspect_ratio || '', resolution: item.resolution || '',
      assetRef: item.asset_ref || '', musicRef: item.music_ref || '',
      startDate: isoD(item.start_date), endDate: isoD(item.due_date), reviewLink: item.review_link || '',
      costEstimate: item.cost_estimate != null ? String(item.cost_estimate) : '',
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (editItemId.edit_id) {
        await api.updateAvoEdit(editItemId.edit_id, editForm);
      } else {
        await api.updateDeliverable(project.id, editItemId.id, {
          title: editForm.title, description: editForm.description,
          aspectRatio: editForm.aspectRatio, resolution: editForm.resolution,
          dueDate: editForm.endDate, musicRef: editForm.musicRef, category: editForm.trackerType,
        });
      }
      await reload();
      setEditItemId(null);
    } catch(e) { alert(e.message); }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Delete this deliverable?')) return;
    await api.deleteDeliverable(project.id, id);
    setItems(d => d.filter(i => i.id !== id));
  }

  return (
    <div>
      <div className="page-title" style={{ marginBottom:3 }}>Post-Production</div>
      <div className="page-sub">{project.client} · {project.code}</div>

      {/* ── DIT ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', marginBottom:20 }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', whiteSpace:'nowrap' }}>DIT</span>
        <select
          value={ditId}
          onChange={e => saveDit(e.target.value)}
          style={{ flex:1, maxWidth:320 }}
        >
          <option value="">— Unassigned —</option>
          {(project.crewAssignments || []).filter(a => a.crewMember).map(a => (
            <option key={a.crewMember.id} value={a.crewMember.id}>
              {displayName(a.crewMember)} — {a.position.name}
            </option>
          ))}
        </select>
        {ditSaving && <span style={{ fontSize:11, color:'var(--muted)' }}>Saving…</span>}
        {ditId && !ditSaving && (
          <span style={{ fontSize:11, color:'var(--muted)' }}>
            Managing data for this project
          </span>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>Deliverables <span style={{ fontWeight:400, color:'var(--muted)' }}>· {items.length} output{items.length !== 1 ? 's' : ''}</span></div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Deliverable</button>
      </div>

      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
        <table className="dtable">
          <thead><tr>
            <th>Deliverable</th>
            <th>Status</th>
            <th>Editor</th>
            <th className="dv-hide-m">Specs</th>
            <th className="dv-hide-m">Due</th>
            <th className="dv-hide-m"></th>
          </tr></thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={6} className="empty">No deliverables yet.</td></tr>
            )}
            {[...TYPE_GROUPS, ['No Type Yet', 'var(--muted)']].map(([t, color]) => {
              const catItems = t === 'No Type Yet'
                ? items.filter(i => !TYPE_GROUPS.some(([g]) => g === typeOf(i)))
                : items.filter(i => typeOf(i) === t);
              if (catItems.length === 0) return null;
              return (
                <React.Fragment key={t}>
                  <tr><td colSpan={6} style={{ padding:'8px 12px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'.12em', color, background:'rgba(255,255,255,0.04)' }}>{t}</td></tr>
                  {catItems.map(item => (
              <tr key={item.id} style={{ cursor:'pointer' }} title="Open this deliverable's edit form"
                onClick={() => window.matchMedia('(max-width: 640px)').matches ? setDetailItem(item) : openEdit(item)}>
                <td>
                  <div style={{ fontWeight:500 }}>{item.isUrgent && <span style={{ color:'var(--orange)' }}>⚠ </span>}{item.title}</div>
                  {item.description && <div style={{ fontSize:10, color:'var(--muted)' }}>{item.description}</div>}
                  {(item.music_ref || item.musicRef) && <div className="dv-hide-m" style={{ fontSize:10, color:'var(--purple-text)', marginTop:2 }}>♪ {item.music_ref || item.musicRef}</div>}
                </td>
                <td onClick={e => e.stopPropagation()}>
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
                <td><span className="epill">{item.editor_name || item.editorName || '—'}</span></td>
                <td className="dv-hide-m" style={{ fontSize:11, color:'var(--tan)' }}>
                  {item.aspect_ratio || item.aspectRatio}{item.resolution ? ` · ${item.resolution}` : ''}
                </td>
                <td className="dv-hide-m" style={{ fontSize:11, color: item.isUrgent ? 'var(--orange)' : 'var(--muted)', fontWeight: item.isUrgent ? 500 : 400 }}>
                  {item.due_date ? String(item.due_date).slice(0,10) : (item.dueDate || '—')}
                </td>
                <td className="dv-hide-m" style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => remove(item.id)}>✕</button>
                </td>
              </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile detail pop-out: tap a deliverable row to see everything */}
      {detailItem && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setDetailItem(null)}>
          <div className="modal">
            <div className="modal-title">{detailItem.isUrgent && <span style={{ color:'var(--orange)' }}>⚠ </span>}{detailItem.title}</div>
            {detailItem.description && <div style={{ fontSize:13, color:'var(--muted)', marginBottom:14, lineHeight:1.5 }}>{detailItem.description}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px', marginBottom:16 }}>
              {[
                ['Type', typeOf(detailItem) || '—'],
                ['Status', STATUS_LABEL[detailItem.status] || detailItem.status],
                ['Editor', detailItem.editor_name || '—'],
                ['Aspect Ratio', detailItem.aspect_ratio || '—'],
                ['Resolution', detailItem.resolution || '—'],
                ['Due Date', detailItem.due_date ? String(detailItem.due_date).slice(0,10) : '—'],
                ['Asset Ref', detailItem.asset_ref || '—'],
                ['Music Ref', detailItem.music_ref || '—'],
                ['Review Link', detailItem.review_link || '—'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize:9, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:13, color:'var(--text)', fontWeight:600 }}>{val}</div>
                </div>
              ))}
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={() => { openEdit(detailItem); setDetailItem(null); }}>Edit</button>
              <button className="btn btn-ghost" style={{ color:'var(--red-text)' }} onClick={() => { setDetailItem(null); remove(detailItem.id); }}>Delete</button>
              <button className="btn btn-ghost" onClick={() => setDetailItem(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {editItemId && (
        <AvoForm title="Edit Deliverable" form={editForm} setForm={setEditForm} editId={editItemId.edit_id}
          onSubmit={saveEdit} onCancel={() => setEditItemId(null)} saving={saving} />
      )}

      {showAdd && (
        <AvoForm title="Add Deliverable" form={form} setForm={setForm}
          onSubmit={add} onCancel={() => setShowAdd(false)} saving={saving} />
      )}
    </div>
  );
}
