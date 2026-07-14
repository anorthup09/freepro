import React, { useEffect, useRef } from 'react';

// Calendar-grid timeline of shoots for the Gear Report (one row per shoot,
// bars span the shoot dates, today's column highlighted).
export const fmtGD = d => d ? new Date(String(d).slice(0,10)+'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '—';
const dayMs = 86400000;
const gTime = d => new Date(String(d).slice(0,10)+'T00:00:00').getTime();
function daysUntilStart(d) {
  if (!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  return Math.round((gTime(d) - today.getTime()) / dayMs);
}
export function countdownLabel(d) {
  const n = daysUntilStart(d);
  if (n === null) return '—';
  if (n > 0) return `${n} day${n === 1 ? '' : 's'}`;
  if (n === 0) return 'Today';
  return 'Started';
}

// Calendar-grid timeline (like the Crew Calendar): one row per shoot, bars span
// the shoot dates, each labeled with its Shoot Title. Today's column is orange.
const G_DAY_W = 30;
const G_NAME_W = 190;
export default function GearGantt({ rows, onOpen }) {
  const scrollRef = useRef(null);
  const dated = (rows || []).filter(r => r.start_date);
  const today = new Date(); today.setHours(12, 0, 0, 0);

  const starts = dated.map(r => gTime(r.start_date));
  const ends = dated.map(r => gTime(r.end_date || r.start_date));
  const minMs = dated.length ? Math.min(today.getTime(), ...starts) : today.getTime();
  const maxMs = dated.length ? Math.max(today.getTime(), ...ends) : today.getTime();
  const startDate = new Date(minMs - 5 * dayMs); startDate.setHours(12, 0, 0, 0);
  const totalDays = Math.round((maxMs + 5 * dayMs - startDate.getTime()) / dayMs) + 1;
  const dayAt = i => new Date(startDate.getTime() + i * dayMs);
  const idxOf = d => Math.round((gTime(d) - startDate.getTime()) / dayMs);
  const todayIdx = Math.round((today.getTime() - startDate.getTime()) / dayMs);

  useEffect(() => {
    if (scrollRef.current && dated.length) scrollRef.current.scrollLeft = Math.max(0, (todayIdx - 3) * G_DAY_W);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!dated.length) return null;

  const months = [];
  for (let i = 0; i < totalDays; i++) { const d = dayAt(i); if (i === 0 || d.getDate() === 1) months.push({ i, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }); }
  const sorted = [...dated].sort((a, b) => gTime(a.start_date) - gTime(b.start_date));
  const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div ref={scrollRef} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflowX:'auto', overflowY:'auto', maxHeight: 24 + 34 + 5 * 40 + 2, marginBottom:16 }}>
      <div style={{ width: G_NAME_W + totalDays * G_DAY_W, position:'relative' }}>
        {/* month row */}
        <div style={{ display:'flex', height:24, borderBottom:'1px solid rgba(255,255,255,0.04)', position:'sticky', top:0, background:'var(--bg2)', zIndex:4 }}>
          <div style={{ width:G_NAME_W, flexShrink:0, position:'sticky', left:0, background:'var(--bg2)', zIndex:3, borderRight:'1px solid var(--border)' }} />
          <div style={{ position:'relative', flex:1 }}>
            {months.map(m => <div key={m.i} style={{ position:'absolute', left:m.i * G_DAY_W + 6, top:5, fontSize:10, fontWeight:800, color:'var(--text)', whiteSpace:'nowrap' }}>{m.label}</div>)}
          </div>
        </div>
        {/* day header */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', position:'sticky', top:24, background:'var(--bg2)', zIndex:4 }}>
          <div style={{ width:G_NAME_W, flexShrink:0, position:'sticky', left:0, background:'var(--bg2)', zIndex:3, borderRight:'1px solid var(--border)' }} />
          {Array.from({ length: totalDays }, (_, i) => {
            const d = dayAt(i); const wknd = d.getDay() === 0 || d.getDay() === 6; const isToday = i === todayIdx;
            return (
              <div key={i} style={{ width:G_DAY_W, flexShrink:0, textAlign:'center', padding:'4px 0 5px', fontSize:9, color: isToday ? 'var(--orange)' : wknd ? 'rgba(255,255,255,0.25)' : 'var(--muted)', fontWeight: isToday ? 800 : 600 }}>
                <div>{DOW[d.getDay()]}</div><div style={{ fontSize:10 }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        {/* shoot rows */}
        {sorted.map(r => {
          const from = Math.max(0, idxOf(r.start_date));
          const to = Math.min(totalDays - 1, idxOf(r.end_date || r.start_date));
          const title = r.subtitle || r.title || r.code;
          return (
            <div key={r.id} style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.04)', position:'relative', minHeight:40 }}>
              <div style={{ width:G_NAME_W, flexShrink:0, padding:'10px 12px', fontSize:12, fontWeight:700, position:'sticky', left:0, background:'var(--bg2)', zIndex:2, borderRight:'1px solid var(--border)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
              {Array.from({ length: totalDays }, (_, i) => {
                const d = dayAt(i); const wknd = d.getDay() === 0 || d.getDay() === 6;
                if (!wknd) return null;
                return <div key={i} style={{ position:'absolute', left:G_NAME_W + i * G_DAY_W, top:0, bottom:0, width:G_DAY_W, background:'rgba(255,255,255,0.02)' }} />;
              })}
              <div style={{ position:'absolute', left:G_NAME_W + todayIdx * G_DAY_W + G_DAY_W / 2, top:0, bottom:0, width:1, background:'var(--orange)', opacity:0.45, zIndex:1 }} />
              <div onClick={() => onOpen && onOpen(r.id)} title={`${title} · ${fmtGD(r.start_date)} – ${fmtGD(r.end_date || r.start_date)}`}
                style={{ position:'absolute', top:8, height:24, zIndex:1, left:G_NAME_W + from * G_DAY_W, width:(to - from + 1) * G_DAY_W - 4,
                  background:'rgba(232,80,10,0.2)', border:'1px solid var(--orange)', borderRadius:6, display:'flex', alignItems:'center', padding:'0 8px', overflow:'hidden', cursor:'pointer', fontSize:10, fontWeight:800, color:'var(--orange)', whiteSpace:'nowrap' }}>
                {title}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
