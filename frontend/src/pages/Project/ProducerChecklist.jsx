import React, { useEffect, useState } from 'react';
import { PRODUCER_CHECKLISTS } from '../../data/producerChecklists.js';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';

const HumanIcon = ({ color }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="7.5" r="3.5"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>
  </svg>
);

const CARD_COLORS = ['#5ABF80', '#4a9eff', '#e6c229', '#d66a9b'];

// Producer Checklist — four production playbooks pulled from the master resources
// doc. Each button toggles its checklist open/closed; open ones move to the left
// of the row and clicking between them switches which checklist is displayed.
// Checks persist per project in the browser (no backend field needed).
export default function ProducerChecklist({ project }) {
  const storeKey = `producer-checklist:${project?.id || 'x'}`;
  // Open checklists persist per project so switching tabs doesn't close them
  const openKey = storeKey + ':open';
  const [open, setOpen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(openKey) || '[]'); } catch { return []; }
  });
  const [active, setActive] = useState(() => {
    try { return JSON.parse(localStorage.getItem(openKey) || '[]').slice(-1)[0] || null; } catch { return null; }
  });
  useEffect(() => { try { localStorage.setItem(openKey, JSON.stringify(open)); } catch {} }, [open, openKey]);
  const [checked, setChecked] = useState({});
  // Assignments: checklist item -> the real project task it created
  const assignKey = storeKey + ':assigned';
  // Custom groups/items + deletions, per project (browser-local like checks)
  const customKey = storeKey + ':custom';
  const [custom, setCustom] = useState({});
  const [addForm, setAddForm] = useState(null);   // { kind:'group'|'item', group, text }
  const [assigned, setAssigned] = useState({});
  const [crew, setCrew] = useState([]);
  const [assigning, setAssigning] = useState(null);   // item id with the panel open
  const [aForm, setAForm] = useState({ assigneeId: '', due: '' });
  const [aSaving, setASaving] = useState(false);

  useEffect(() => {
    try { setChecked(JSON.parse(localStorage.getItem(storeKey) || '{}')); }
    catch { setChecked({}); }
    try { setAssigned(JSON.parse(localStorage.getItem(assignKey) || '{}')); }
    catch { setAssigned({}); }
    try { setCustom(JSON.parse(localStorage.getItem(customKey) || '{}')); }
    catch { setCustom({}); }
  }, [storeKey]);

  useEffect(() => {
    api.getCrew()
      .then(cs => setCrew(cs.filter(m => (m.company || '').toLowerCase().includes('unbridled'))
        .sort((a, b) => displayName(a).localeCompare(displayName(b)))))
      .catch(() => {});
  }, []);

  const curCustom = custom[active] || { groups: [], items: [], removed: [] };
  const saveCustom = next => setCustom(c => {
    const n = { ...c, [active]: next };
    try { localStorage.setItem(customKey, JSON.stringify(n)); } catch {}
    return n;
  });
  // Merge the playbook's sections with this project's custom groups and items,
  // dropping anything deleted
  function mergedSections(l, cust) {
    const removed = new Set(cust.removed || []);
    const secs = [
      ...l.sections.map((s2, si) => ({ label: s2.section || '', items: s2.items.map((it, ii) => ({ ...it, id: `${l.key}|${si}|${ii}` })) })),
      ...(cust.groups || []).map(g => ({ label: g, items: [], custom: true })),
    ];
    (cust.items || []).forEach((x, ci) => {
      const target = secs.find(s2 => (s2.label || '') === (x.group || '')) || secs[0];
      target.items.push({ label: x.label, id: `${l.key}|c|${ci}` });
    });
    for (const s2 of secs) s2.items = s2.items.filter(it => !removed.has(it.id));
    return secs;
  }

  function openAssign(id) {
    const a = assigned[id];
    setAForm({ assigneeId: a?.assigneeId || '', due: a?.due || '' });
    setAssigning(prev => prev === id ? null : id);
  }

  async function saveAssign(id, label, listLabel) {
    if (aSaving) return;
    setASaving(true);
    try {
      const a = assigned[id];
      let taskId = a?.taskId;
      if (!taskId) {
        const t = await api.addProjectTask(project.id, { text: `${listLabel}: ${label}` });
        taskId = t.id;
      }
      await api.updateProjectTask(taskId, { assigneeId: aForm.assigneeId || null, dueDate: aForm.due || null });
      const m = crew.find(c => c.id === aForm.assigneeId);
      const next = { ...assigned };
      if (aForm.assigneeId) next[id] = { taskId, assigneeId: aForm.assigneeId, name: m ? displayName(m) : '', due: aForm.due };
      else next[id] = { ...next[id], taskId, assigneeId: '', name: '', due: aForm.due };
      setAssigned(next);
      try { localStorage.setItem(assignKey, JSON.stringify(next)); } catch {}
      setAssigning(null);
    } catch (e) { alert(e.message); }
    setASaving(false);
  }

  function toggle(id) {
    setChecked(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function openList(key) {
    setOpen(o => o.includes(key) ? o : [...o, key]);
    setActive(key);
  }
  function closeList(key) {
    setOpen(o => {
      const next = o.filter(k => k !== key);
      setActive(a => a === key ? (next[next.length - 1] || null) : a);
      return next;
    });
  }

  const list = PRODUCER_CHECKLISTS.find(l => l.key === active) || null;
  const activeIdx = PRODUCER_CHECKLISTS.findIndex(l => l.key === active);
  const accent = CARD_COLORS[activeIdx] || CARD_COLORS[0];

  // Progress counts per checklist
  const progressFor = l => {
    let total = 0, done = 0;
    mergedSections(l, custom[l.key] || { groups: [], items: [], removed: [] }).forEach(s2 => s2.items.forEach(it => {
      total++;
      if (checked[it.id]) done++;
    }));
    return { total, done };
  };

  // Open checklists (in open order) lead on the left; closed pills trail on the right
  const openLists = open.map(k => PRODUCER_CHECKLISTS.find(l => l.key === k)).filter(Boolean);
  const closedLists = PRODUCER_CHECKLISTS.filter(l => !open.includes(l.key));

  return (
    <div style={{ padding: '4px 2px 30px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22, alignItems: 'flex-start' }}>
        {openLists.map(l => {
          const i = PRODUCER_CHECKLISTS.findIndex(x => x.key === l.key);
          const color = CARD_COLORS[i];
          const { total, done } = progressFor(l);
          const isActive = l.key === active;
          return (
            <div key={l.key} onClick={() => setActive(l.key)} title={isActive ? l.title : `View ${l.label}`}
              style={{
                position: 'relative', textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '12px 16px',
                minWidth: 200, maxWidth: 260,
                background: `${color}${isActive ? '2e' : '14'}`, border: `1px solid ${color}${isActive ? '' : '66'}`, borderTop: `3px solid ${color}`,
                opacity: isActive ? 1 : 0.75,
              }}>
              <button onClick={ev => { ev.stopPropagation(); closeList(l.key); }} title={`Close ${l.label}`}
                style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 11, cursor: 'pointer', padding: 2 }}>✕</button>
              <div style={{ fontSize: 13, fontWeight: 800, color }}>{l.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.3 }}>{l.title}</div>
              <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: total ? `${Math.round((done / total) * 100)}%` : '0%', height: '100%', background: color }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>{done} / {total} done</div>
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        {closedLists.map(l => (
          <button key={l.key} onClick={() => openList(l.key)} title={`Open ${l.title}`}
            style={{
              cursor: 'pointer', borderRadius: 16, padding: '6px 14px', background: '#0b0b0b',
              border: '1px solid var(--border)', color: 'var(--muted)',
              fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap',
            }}>
            {l.label}
          </button>
        ))}
      </div>

      {!list && (
        <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', padding: '30px 0' }}>
          Pick a checklist above to open it.
        </div>
      )}

      {list && <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{list.title}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
            onClick={() => setAddForm(f => f?.kind === 'group' ? null : { kind: 'group', text: '' })}>+ Add Group</button>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
            onClick={() => setAddForm(f => f?.kind === 'item' ? null : { kind: 'item', group: '', text: '' })}>+ Add Item</button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
        Sourced from the Unbridled production resources master doc. Checks, added items, and deletions save to your browser for this project.
      </div>
      {addForm && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: `1px solid ${accent}55`, borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}>
          {addForm.kind === 'item' && (
            <select value={addForm.group} onChange={e => setAddForm(f => ({ ...f, group: e.target.value }))} style={{ fontSize: 12, width: 200, flex: 'none' }}>
              <option value="">— Pick a group —</option>
              {mergedSections(list, curCustom).map((s2, i) => <option key={i} value={s2.label}>{s2.label || `Section ${i + 1}`}</option>)}
            </select>
          )}
          <input value={addForm.text} autoFocus
            placeholder={addForm.kind === 'group' ? 'New group name…' : 'New checklist item…'}
            onChange={e => setAddForm(f => ({ ...f, text: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && document.getElementById('pc-add-btn')?.click()}
            style={{ fontSize: 12, flex: 1, minWidth: 180 }} />
          <button id="pc-add-btn" className="btn btn-primary btn-sm" onClick={() => {
            const t = (addForm.text || '').trim();
            if (!t) return;
            if (addForm.kind === 'group') saveCustom({ ...curCustom, groups: [...(curCustom.groups || []), t] });
            else saveCustom({ ...curCustom, items: [...(curCustom.items || []), { group: addForm.group || '', label: t }] });
            setAddForm(f => ({ ...f, text: '' }));
          }}>Add</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setAddForm(null)}>Done</button>
        </div>
      )}

      {mergedSections(list, curCustom).map((sec, si) => (
        <div key={si} style={{ marginBottom: 20 }}>
          {sec.label && (
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: accent, borderBottom: `1px solid ${accent}44`, paddingBottom: 5, marginBottom: 8 }}>
              {sec.label}
            </div>
          )}
          {sec.items.length === 0 && sec.custom && (
            <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', padding: '4px 6px' }}>Empty group — use + Add Item to fill it.</div>
          )}
          {sec.items.map((it, ii) => {
            const id = it.id;
            const on = !!checked[id];
            const a = assigned[id];
            const hasAssignee = !!(a && a.assigneeId);
            return (
              <div key={ii} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative' }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 6px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={on} onChange={() => toggle(id)}
                    style={{ marginTop: 2, width: 15, height: 15, accentColor: accent, flexShrink: 0, cursor: 'pointer' }} />
                  <button onClick={ev => { ev.preventDefault(); ev.stopPropagation(); openAssign(id); }}
                    title={hasAssignee ? `Assigned to ${a.name}${a.due ? ' · due ' + a.due : ''}` : 'Assign this task to a teammate'}
                    style={{ background: 'none', border: 'none', padding: '1px 0 0', cursor: 'pointer', flexShrink: 0, lineHeight: 0 }}>
                    <HumanIcon color={hasAssignee ? accent : 'rgba(255,255,255,0.22)'} />
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: on ? 'var(--muted)' : 'var(--text)',
                      textDecoration: on ? 'line-through' : 'none' }}>{it.label}</div>
                    {it.note && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{it.note}</div>
                    )}
                    {hasAssignee && (
                      <div style={{ fontSize: 10, color: accent, marginTop: 2, fontWeight: 700 }}>
                        → {a.name}{a.due ? ` · due ${new Date(a.due + 'T12:00:00').toLocaleDateString()}` : ''}
                      </div>
                    )}
                  </div>
                  <button title="Delete this checklist item"
                    onClick={ev => { ev.preventDefault(); ev.stopPropagation();
                      if (confirm(`Delete "${it.label}" from this checklist?`)) saveCustom({ ...curCustom, removed: [...(curCustom.removed || []), id] }); }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 11, cursor: 'pointer', marginLeft: 'auto', flexShrink: 0, padding: '0 2px' }}>✕</button>
                </label>
                {assigning === id && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '4px 6px 10px 52px' }}>
                    <select value={aForm.assigneeId} onChange={e => setAForm(f => ({ ...f, assigneeId: e.target.value }))}
                      style={{ fontSize: 12, width: 180, flex: 'none' }}>
                      <option value="">— Unassigned —</option>
                      {crew.map(m => <option key={m.id} value={m.id}>{displayName(m)}</option>)}
                    </select>
                    <input type="date" value={aForm.due} onChange={e => setAForm(f => ({ ...f, due: e.target.value }))} style={{ fontSize: 12, width: 140, flex: 'none' }} />
                    <button className="btn btn-primary btn-sm" disabled={aSaving} onClick={() => saveAssign(id, it.label, list.label)}>
                      {aSaving ? 'Saving…' : 'Assign'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAssigning(null)}>Cancel</button>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Shows on their Hub to-do list.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      </>}
    </div>
  );
}
