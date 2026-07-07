import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const COLORS = ['#E8500A', '#5ABF80', '#4a9eff', '#e6c229', '#a78bfa', '#f87171', '#40A0A0', '#D0A030'];
const colorFor = str => { let h = 0; for (const c of str || '') h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return COLORS[Math.abs(h) % COLORS.length]; };
const day = d => new Date(String(d).slice(0, 10) + 'T12:00:00');
const MS_DAY = 86400000;

const DAY_W = 34;      // px per day column
const NAME_W = 170;    // sticky name column
const PAST_DAYS = 45;  // days of history shown
const FUTURE_DAYS = 240;

// Continuously scrolling timeline (ClickUp-style): one row per person,
// bars span assignment dates, auto-scrolled to today on load.
export default function CrewCalendar() {
  const [rows, setRows] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => { api.crewCalendar().then(setRows).catch(e => alert(e.message)); }, []);

  const today = new Date(); today.setHours(12, 0, 0, 0);
  const start = new Date(today.getTime() - PAST_DAYS * MS_DAY);
  const totalDays = PAST_DAYS + FUTURE_DAYS;
  const dayAt = i => new Date(start.getTime() + i * MS_DAY);
  const idxOf = d => Math.round((day(d) - start) / MS_DAY);

  // Auto-scroll so today sits near the left edge
  useEffect(() => {
    if (rows && scrollRef.current) scrollRef.current.scrollLeft = (PAST_DAYS - 3) * DAY_W;
  }, [rows]);

  const members = useMemo(() => {
    const byName = {};
    for (const r of rows || []) {
      const e = day(r.end_date || r.start_date);
      if (idxOf(r.start_date) > totalDays || idxOf(e) < 0) continue;
      (byName[r.member_name] ||= []).push(r);
    }
    return Object.entries(byName).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  // Month labels across the top
  const months = useMemo(() => {
    const out = [];
    for (let i = 0; i < totalDays; i++) {
      const d = dayAt(i);
      if (i === 0 || d.getDate() === 1) out.push({ i, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) });
    }
    return out;
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 18px 60px' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div className="page-title">Crew Calendar</div>
            <div className="page-sub">Unbridled Media employees on shoots &amp; edits</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (scrollRef.current) scrollRef.current.scrollTo({ left: (PAST_DAYS - 3) * DAY_W, behavior: 'smooth' }); }}>Today</button>
            <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>Back to Hub</Link>
          </div>
        </div>

        {!rows && <div className="empty">Loading…</div>}
        {rows && members.length === 0 && <div className="empty">No Unbridled crew assigned to shoots or edits yet.</div>}

        {members.length > 0 && (
          <div ref={scrollRef} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
            <div style={{ width: NAME_W + totalDays * DAY_W, position: 'relative' }}>
              {/* month row */}
              <div style={{ display: 'flex', height: 24, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: NAME_W, flexShrink: 0, position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 3, borderRight: '1px solid var(--border)' }} />
                <div style={{ position: 'relative', flex: 1 }}>
                  {months.map(m => (
                    <div key={m.i} style={{ position: 'absolute', left: m.i * DAY_W + 6, top: 5, fontSize: 10, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>{m.label}</div>
                  ))}
                </div>
              </div>
              {/* day header */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: NAME_W, flexShrink: 0, position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 3, borderRight: '1px solid var(--border)' }} />
                {Array.from({ length: totalDays }, (_, i) => {
                  const d = dayAt(i);
                  const wknd = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = i === PAST_DAYS;
                  return (
                    <div key={i} style={{ width: DAY_W, flexShrink: 0, textAlign: 'center', padding: '4px 0 5px', fontSize: 9, color: isToday ? 'var(--orange)' : wknd ? 'rgba(255,255,255,0.25)' : 'var(--muted)', fontWeight: isToday ? 800 : 600 }}>
                      <div>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}</div>
                      <div style={{ fontSize: 10 }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {/* member rows */}
              {members.map(([name, assigns]) => {
                // Double bookings drop to their own lane instead of overlapping
                const lanes = [];
                const laneOf = {};
                for (const a of [...assigns].sort((x, y) => day(x.start_date) - day(y.start_date))) {
                  const s2 = day(a.start_date), e2 = day(a.end_date || a.start_date);
                  let li = lanes.findIndex(end => end < s2);
                  if (li === -1) { li = lanes.length; lanes.push(e2); } else lanes[li] = e2;
                  laneOf[a.id] = li;
                }
                const laneCount = Math.max(1, lanes.length);
                const rowH = 12 + laneCount * 28;
                return (
                  <div key={name} style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative', minHeight: rowH }}>
                    <div style={{ width: NAME_W, flexShrink: 0, padding: '10px 12px', fontSize: 12, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 2, borderRight: '1px solid var(--border)' }}>{name}</div>
                    {/* weekend shading + today line */}
                    {Array.from({ length: totalDays }, (_, i) => {
                      const d = dayAt(i);
                      const wknd = d.getDay() === 0 || d.getDay() === 6;
                      if (!wknd) return null;
                      return <div key={i} style={{ position: 'absolute', left: NAME_W + i * DAY_W, top: 0, bottom: 0, width: DAY_W, background: 'rgba(255,255,255,0.02)' }} />;
                    })}
                    <div style={{ position: 'absolute', left: NAME_W + PAST_DAYS * DAY_W + DAY_W / 2, top: 0, bottom: 0, width: 1, background: 'var(--orange)', opacity: 0.45, zIndex: 1 }} />
                    {assigns.map(a => {
                      const from = Math.max(0, idxOf(a.start_date));
                      const to = Math.min(totalDays - 1, idxOf(a.end_date || a.start_date));
                      if (to < from) return null;
                      const c = a.kind === 'pto' ? '#4a9eff' : colorFor(a.project_code);
                      const isEdit = a.kind === 'edit';
                      return (
                        <a key={a.id} href={a.kind === 'pto' ? '/team' : isEdit ? `/avo/${a.project_id}` : `/projects/${a.project_id}`}
                          title={`${a.project_code || ''} · ${a.project_title || ''} — ${a.position_name}`}
                          style={{
                            position: 'absolute', top: 8 + (laneOf[a.id] || 0) * 28, height: 24, zIndex: 1,
                            left: NAME_W + from * DAY_W,
                            width: (to - from + 1) * DAY_W - 4,
                            background: `${c}2e`, border: `1px solid ${c}`, borderRadius: 6,
                            display: 'flex', alignItems: 'center', padding: '0 6px', overflow: 'hidden',
                            fontSize: 9, fontWeight: 700, color: c, whiteSpace: 'nowrap', textDecoration: 'none',
                          }}>
                          {isEdit ? '✂ ' : ''}{a.project_code} · {a.position_name}
                        </a>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12 }}>
          Scroll sideways through the schedule — bars show assignment start–end dates. Assigning someone (with dates) emails them an Outlook calendar hold automatically.
        </div>
      </div>
    </div>
  );
}
