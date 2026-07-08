import React, { useState } from 'react';

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

export const MILESTONES = [
  ['scripting_start', 'Scripting Start'], ['scripting_end', 'Creative/Scripting Complete'],
  ['icr_v1_due', 'ICR v1 Due'], ['icr_feedback', 'ICR Feedback'],
  ['client_v1_due', 'Client v1 Due'], ['client_v1_feedback', 'Client v1 Feedback'],
  ['client_v2_due', 'Client v2 Due'], ['client_v2_feedback', 'Client v2 Feedback'],
  ['client_v3_due', 'Client v3 Due'], ['client_v3_feedback', 'Client v3 Feedback'],
  ['color_audio_send', 'Send to Color & Audio'], ['color_audio_complete', 'Color & Audio Complete'],
  ['final_comp', 'Final Comp Complete'], ['final_delivery', 'Final Delivery'],
];
const MS_LABEL = Object.fromEntries(MILESTONES);

export const RUNNER_COLORS = ['#9DC183', '#4a9eff', '#e6c229', '#e8955a', '#a78bfa', '#f08080', '#40A0A0', '#d66a9b', '#5ABF80', '#E8500A', '#8ecae6', '#f4a261', '#c77dff'];

// Consecutive filled milestones chained into start→end runner segments
export function milestoneRunners(edit) {
  const ms = edit?.milestones || {};
  const filled = MILESTONES.filter(([k]) => ms[k]);
  const segs = [];
  for (let i = 1; i < filled.length; i++) {
    const [fk, fl] = filled[i - 1], [tk, tl] = filled[i];
    segs.push({ from: ms[fk], to: ms[tk], label: tl, title: `${fl} → ${tl}`, color: RUNNER_COLORS[(i - 1) % RUNNER_COLORS.length] });
  }
  return segs;
}

const day = d => new Date(String(d).slice(0, 10) + 'T12:00:00');
const MS_DAY = 86400000;
const fmt = d => day(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const fmtLong = d => day(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

// Table of an edit's filled-in milestone dates (empty ones are hidden).
export function MilestoneTable({ edit, title }) {
  const rows = MILESTONES.filter(([k]) => edit?.milestones?.[k]);
  if (!rows.length) return null;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {title && <div style={{ padding: '10px 14px', fontSize: 12, fontWeight: 800, borderBottom: '1px solid var(--border)' }}>{title}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(([k, label]) => (
            <tr key={k} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '7px 14px', fontSize: 11, fontWeight: 700 }}>{label}</td>
              <td style={{ padding: '7px 14px', fontSize: 11, color: 'var(--muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtLong(edit.milestones[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Plain-text version for pasting into a message or email.
export function milestoneText(edit) {
  const rows = MILESTONES.filter(([k]) => edit?.milestones?.[k]);
  const lines = [`${edit.title} — Timeline`];
  if (edit.start_date) lines.push(`Edit Window: ${fmtLong(edit.start_date)} – ${fmtLong(edit.end_date || edit.start_date)}`);
  for (const [k, label] of rows) lines.push(`${label}: ${fmtLong(edit.milestones[k])}`);
  return lines.join('\n');
}

// Renders a horizontal timeline of edits (bars from start_date to end_date).
export default function GanttChart({ edits }) {
  const [info, setInfo] = useState(null);   // { key, text, x, y } — tapped runner info bubble
  const [zoom, setZoom] = useState(1);      // 1 = fit everything; higher = fewer days per screen
  const hasMs = e => MILESTONES.some(([k]) => e.milestones?.[k]);
  const dated = (edits || []).filter(e => e.start_date || hasMs(e));
  const undated = (edits || []).filter(e => !e.start_date && !hasMs(e));
  if (!dated.length && !undated.length) return <div className="empty">No edits to chart.</div>;

  let min = null, max = null;
  for (const e of edits || []) {
    const dates = [];
    if (e.start_date) dates.push(day(e.start_date), day(e.end_date || e.start_date));
    for (const [k] of MILESTONES) if (e.milestones?.[k]) dates.push(day(e.milestones[k]));
    for (const d of dates) {
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
  }
  // pad the window a little on both sides
  if (min) { min = new Date(min.getTime() - 2 * MS_DAY); max = new Date(max.getTime() + 2 * MS_DAY); }
  const span = min ? Math.max(1, Math.round((max - min) / MS_DAY) + 1) : 1;

  // month/tick header: one tick per day if short, weekly if long
  const ticks = [];
  if (min) {
    const effSpan = span / zoom;   // days visible per viewport at this zoom
    const step = effSpan > 45 ? 7 : effSpan > 20 ? 2 : 1;
    for (let i = 0; i < span; i += step) {
      const d = new Date(min.getTime() + i * MS_DAY);
      ticks.push({ i, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
  }

  const today = new Date();
  const todayIdx = min ? Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12) - min) / MS_DAY) : -1;
  const LABEL_W = 190;

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, padding: '8px 12px 0' }}>
        <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Timeline zoom</span>
        {[['−', () => setZoom(z => Math.max(1, Math.round(z / 1.5 * 100) / 100))],
          ['Fit', () => setZoom(1)],
          ['+', () => setZoom(z => Math.min(8, Math.round(z * 1.5 * 100) / 100))]].map(([label, fn]) => (
          <button key={label} onClick={fn}
            style={{ background: (label === 'Fit' && zoom === 1) ? 'rgba(157,193,131,0.25)' : 'transparent', border: '1px solid var(--border)', color: 'var(--text, #ddd)', borderRadius: 8, padding: '2px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: Math.round(700 * zoom), width: zoom > 1 ? `${Math.round(zoom * 100)}%` : undefined }}>
        {min && (
          <div style={{ position: 'relative', height: 26, borderBottom: '1px solid var(--border)', marginLeft: LABEL_W }}>
            {ticks.map(t => (
              <div key={t.i} style={{ position: 'absolute', left: `${(t.i / span) * 100}%`, top: 6, fontSize: 9, color: 'var(--muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{t.label}</div>
            ))}
          </div>
        )}
        {dated.map(e => {
          const s = e.start_date ? day(e.start_date) : null;
          const en = e.start_date ? day(e.end_date || e.start_date) : null;
          const from = s ? Math.round((s - min) / MS_DAY) : 0;
          const len = s ? Math.max(1, Math.round((en - s) / MS_DAY) + 1) : 0;
          const c = STATUS_COLORS[e.status] || '#9DC183';
          const runners = milestoneRunners(e);
          const ms = runners.length ? [] : MILESTONES.filter(([k]) => e.milestones?.[k]);
          const rowH = 42 + (runners.length ? 38 : 0);
          return (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', minHeight: rowH }}>
              <div style={{ width: LABEL_W, flexShrink: 0, padding: '8px 12px', borderRight: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>{e.lead_editor || 'Unassigned'} · V{e.version}{e.approved ? ' · ✓ Approved' : ''}</div>
              </div>
              <div style={{ flex: 1, position: 'relative', height: rowH }}>
                {todayIdx >= 0 && todayIdx <= span && (
                  <div style={{ position: 'absolute', left: `${(todayIdx / span) * 100}%`, top: 0, bottom: 0, width: 1, background: 'var(--orange)', opacity: 0.5 }} />
                )}
                {s && (
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
                )}
                {ms.map(([k, label]) => {
                  const idx = Math.round((day(e.milestones[k]) - min) / MS_DAY);
                  return (
                    <div key={k} title={`${label} — ${fmt(e.milestones[k])}`}
                      style={{
                        position: 'absolute', top: 15, width: 12, height: 12, zIndex: 2,
                        left: `calc(${((idx + 0.5) / span) * 100}% - 6px)`,
                        background: '#9DC183', border: '1px solid #0b0b0b',
                        transform: 'rotate(45deg)', borderRadius: 2, cursor: 'default',
                      }} />
                  );
                })}
                {runners.map((r, i) => {
                  const rf = Math.round((day(r.from) - min) / MS_DAY);
                  const rt = Math.round((day(r.to) - min) / MS_DAY);
                  const lane = 0;   // split-day segments butt cleanly — one shared plane
                  // Segments run center-of-day to center-of-day, so back-to-back
                  // runners split the shared day at the milestone instead of overlapping
                  const narrow = (rt - rf) <= 3;   // short runner: show an info icon instead of clipped text
                  const infoKey = `${e.id}-${i}`;
                  return (
                    <div key={i} title={`${r.title}: ${fmt(r.from)} → ${fmt(r.to)}`}
                      style={{
                        position: 'absolute', top: 38 + lane * 18, height: 15, zIndex: 2,
                        left: `${((rf + 0.5) / span) * 100}%`,
                        width: `calc(${(Math.max(0.9, rt - rf) / span) * 100}% - 2px)`,
                        background: `${r.color}30`, border: `1px solid ${r.color}`, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 5px', overflow: 'hidden',
                        fontSize: 8, fontWeight: 800, color: r.color, whiteSpace: 'nowrap',
                        cursor: narrow ? 'pointer' : 'default',
                      }}
                      onClick={narrow ? ev => {
                        ev.stopPropagation();
                        const rect = ev.currentTarget.getBoundingClientRect();
                        setInfo(info?.key === infoKey ? null : { key: infoKey, text: `${r.title}: ${fmt(r.from)} → ${fmt(r.to)}`, x: rect.left + rect.width / 2, y: rect.top, color: r.color });
                      } : undefined}>
                      {narrow ? 'ⓘ' : r.label}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {info && (
          <div onClick={() => setInfo(null)}
            style={{ position:'fixed', zIndex:200, left: Math.max(8, Math.min(info.x - 90, window.innerWidth - 190)), top: info.y - 40,
              background:'var(--bg2, #16160f)', border:`1px solid ${info.color}`, borderRadius:8, padding:'6px 10px',
              fontSize:11, fontWeight:700, color:'var(--text, #eee)', boxShadow:'0 8px 20px rgba(0,0,0,0.5)', whiteSpace:'nowrap', cursor:'pointer' }}>
            {info.text}
          </div>
        )}
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
    </div>
  );
}
