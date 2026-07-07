import React from 'react';

const STATUS_COLORS = {
  FOCUS: '#e05252',
  ASSIGNED: '#4a9eff',
  COMING_SOON: '#e6c229',
  CLOSED: '#8a8f98',
};
const STATUS_LABELS = {
  FOCUS: 'Focus',
  ASSIGNED: 'Assigned',
  COMING_SOON: 'Coming Soon',
  CLOSED: 'Closed',
};

const day = d => new Date(String(d).slice(0, 10) + 'T12:00:00');
const MS_DAY = 86400000;
const fmt = d => day(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// Renders a horizontal timeline of edits (bars from start_date to end_date).
export default function GanttChart({ edits }) {
  const dated = (edits || []).filter(e => e.start_date);
  const undated = (edits || []).filter(e => !e.start_date);
  if (!dated.length && !undated.length) return <div className="empty">No edits to chart.</div>;

  let min = null, max = null;
  for (const e of dated) {
    const s = day(e.start_date), en = day(e.end_date || e.start_date);
    if (!min || s < min) min = s;
    if (!max || en > max) max = en;
  }
  // pad the window a little on both sides
  if (min) { min = new Date(min.getTime() - 2 * MS_DAY); max = new Date(max.getTime() + 2 * MS_DAY); }
  const span = min ? Math.max(1, Math.round((max - min) / MS_DAY) + 1) : 1;

  // month/tick header: one tick per day if short, weekly if long
  const ticks = [];
  if (min) {
    const step = span > 45 ? 7 : span > 20 ? 2 : 1;
    for (let i = 0; i < span; i += step) {
      const d = new Date(min.getTime() + i * MS_DAY);
      ticks.push({ i, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
  }

  const today = new Date();
  const todayIdx = min ? Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12) - min) / MS_DAY) : -1;
  const LABEL_W = 190;

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
      <div style={{ minWidth: 700 }}>
        {min && (
          <div style={{ position: 'relative', height: 26, borderBottom: '1px solid var(--border)', marginLeft: LABEL_W }}>
            {ticks.map(t => (
              <div key={t.i} style={{ position: 'absolute', left: `${(t.i / span) * 100}%`, top: 6, fontSize: 9, color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.label}</div>
            ))}
          </div>
        )}
        {dated.map(e => {
          const s = day(e.start_date), en = day(e.end_date || e.start_date);
          const from = Math.round((s - min) / MS_DAY);
          const len = Math.max(1, Math.round((en - s) / MS_DAY) + 1);
          const c = STATUS_COLORS[e.status] || '#9DC183';
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', minHeight: 42 }}>
              <div style={{ width: LABEL_W, flexShrink: 0, padding: '8px 12px', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>{e.lead_editor || 'Unassigned'} · V{e.version}{e.approved ? ' · ✓ Approved' : ''}</div>
              </div>
              <div style={{ flex: 1, position: 'relative', height: 42 }}>
                {todayIdx >= 0 && todayIdx <= span && (
                  <div style={{ position: 'absolute', left: `${(todayIdx / span) * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--orange)', opacity: 0.5 }} />
                )}
                <div title={`${e.title}: ${fmt(e.start_date)} – ${fmt(e.end_date || e.start_date)} (${STATUS_LABELS[e.status] || e.status})`}
                  style={{
                    position: 'absolute', top: 9, height: 24,
                    left: `${(from / span) * 100}%`, width: `calc(${(len / span) * 100}% - 2px)`,
                    background: `${c}2e`, border: `1px solid ${c}`, borderRadius: 6,
                    display: 'flex', alignItems: 'center', padding: '0 7px', overflow: 'hidden',
                    fontSize: 9, fontWeight: 700, color: c, whiteSpace: 'nowrap',
                  }}>
                  {fmt(e.start_date)} → {fmt(e.end_date || e.start_date)}
                </div>
              </div>
            </div>
          );
        })}
        {undated.map(e => (
          <div key={e.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', minHeight: 42 }}>
            <div style={{ width: LABEL_W, flexShrink: 0, padding: '8px 12px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{e.title}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)' }}>{e.lead_editor || 'Unassigned'} · V{e.version}</div>
            </div>
            <div style={{ flex: 1, padding: '0 12px', fontSize: 10, color: 'var(--muted)' }}>No dates set</div>
          </div>
        ))}
      </div>
    </div>
  );
}
