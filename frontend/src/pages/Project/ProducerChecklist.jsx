import React, { useEffect, useState } from 'react';
import { PRODUCER_CHECKLISTS } from '../../data/producerChecklists.js';

const CARD_COLORS = ['#5ABF80', '#4a9eff', '#e6c229', '#d66a9b'];

// Producer Checklist — four production playbooks pulled from the master resources
// doc. Pick a checklist up top, then work each section. Checks persist per project
// in the browser (no backend field needed).
export default function ProducerChecklist({ project }) {
  const storeKey = `producer-checklist:${project?.id || 'x'}`;
  const [active, setActive] = useState(PRODUCER_CHECKLISTS[0].key);
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

  const list = PRODUCER_CHECKLISTS.find(l => l.key === active) || PRODUCER_CHECKLISTS[0];
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

  return (
    <div style={{ padding: '4px 2px 30px' }}>
      {/* Four selector boxes, one per document tab */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 22 }}>
        {PRODUCER_CHECKLISTS.map((l, i) => {
          const { total, done } = progressFor(l);
          const on = l.key === active;
          const color = CARD_COLORS[i];
          return (
            <button key={l.key} onClick={() => setActive(l.key)}
              style={{
                textAlign: 'left', cursor: 'pointer', borderRadius: 12, padding: '14px 16px',
                background: on ? `${color}1e` : 'var(--bg2)',
                border: `1px solid ${on ? color : 'var(--border)'}`,
                borderTop: `3px solid ${color}`,
              }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: on ? color : 'var(--text)' }}>{l.label}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.3 }}>{l.title}</div>
              <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: total ? `${Math.round((done / total) * 100)}%` : '0%', height: '100%', background: color }} />
              </div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>{done} / {total} done</div>
            </button>
          );
        })}
      </div>

      {/* Active checklist */}
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
    </div>
  );
}
