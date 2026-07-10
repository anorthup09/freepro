import React, { useEffect, useState } from 'react';
import { PRODUCER_CHECKLISTS } from '../../data/producerChecklists.js';

const CARD_COLORS = ['#5ABF80', '#4a9eff', '#e6c229', '#d66a9b'];

// Producer Checklist — four production playbooks pulled from the master resources
// doc. Each button toggles its checklist open/closed; open ones move to the left
// of the row and clicking between them switches which checklist is displayed.
// Checks persist per project in the browser (no backend field needed).
export default function ProducerChecklist({ project }) {
  const storeKey = `producer-checklist:${project?.id || 'x'}`;
  const [open, setOpen] = useState([]);       // keys of open checklists, in open order
  const [active, setActive] = useState(null); // which open checklist is displayed
  const [checked, setChecked] = useState({});

  useEffect(() => {
    try { setChecked(JSON.parse(localStorage.getItem(storeKey) || '{}')); }
    catch { setChecked({}); }
  }, [storeKey]);

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
    l.sections.forEach((s, si) => s.items.forEach((it, ii) => {
      total++;
      if (checked[`${l.key}|${si}|${ii}`]) done++;
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
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 2 }}>{list.title}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
        Sourced from the Unbridled production resources master doc. Checks save to your browser for this project.
      </div>

      {list.sections.map((sec, si) => (
        <div key={si} style={{ marginBottom: 20 }}>
          {sec.section && (
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: accent, borderBottom: `1px solid ${accent}44`, paddingBottom: 5, marginBottom: 8 }}>
              {sec.section}
            </div>
          )}
          {sec.items.map((it, ii) => {
            const id = `${list.key}|${si}|${ii}`;
            const on = !!checked[id];
            return (
              <label key={ii} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 6px',
                borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => toggle(id)}
                  style={{ marginTop: 2, width: 15, height: 15, accentColor: accent, flexShrink: 0, cursor: 'pointer' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: on ? 'var(--muted)' : 'var(--text)',
                    textDecoration: on ? 'line-through' : 'none' }}>{it.label}</div>
                  {it.note && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, whiteSpace: 'pre-line', lineHeight: 1.4 }}>{it.note}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      ))}
      </>}
    </div>
  );
}
