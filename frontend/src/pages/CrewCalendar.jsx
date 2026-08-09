import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import HomeButton from '../components/HomeButton.jsx';
import { HubBottomNav } from './Hub.jsx';

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
  const [openGroups, setOpenGroups] = useState(() => new Set()); // expanded edit stacks
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
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '24px 18px 60px' }}>
      <div style={{ maxWidth: 1300, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div className="page-title">Calendar</div>
            <div className="page-sub">Unbridled Media employees on shoots &amp; edits</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (scrollRef.current) scrollRef.current.scrollTo({ left: (PAST_DAYS - 3) * DAY_W, behavior: 'smooth' }); }}>Today</button>
            <HomeButton />
          </div>
        </div>

        {!rows && <div className="empty">Loading…</div>}
        {rows && members.length === 0 && <div className="empty">No Unbridled crew assigned to shoots or edits yet.</div>}

        {members.length > 0 && (
          <div ref={scrollRef} className="glass" style={{ borderRadius: 14, overflowX: 'auto' }}>
            <div style={{ width: NAME_W + totalDays * DAY_W, position: 'relative' }}>
              {/* month row */}
              <div style={{ display: 'flex', height: 24, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="cal-name" style={{ width: NAME_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, borderRight: '1px solid var(--border)' }} />
                <div style={{ position: 'relative', flex: 1 }}>
                  {months.map(m => (
                    <div key={m.i} style={{ position: 'absolute', left: m.i * DAY_W + 6, top: 5, fontSize: 10, fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>{m.label}</div>
                  ))}
                </div>
              </div>
              {/* day header */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                <div className="cal-name" style={{ width: NAME_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, borderRight: '1px solid var(--border)' }} />
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
                // Same-project edit stacks collapse into one hold tile spanning
                // the first edit's start to the last edit's end; clicking the
                // tile expands the individual edits below it.
                const editsByCode = {};
                const displayList = [];
                for (const a of assigns) {
                  if (a.kind === 'edit') (editsByCode[a.project_code || 'EDIT'] ||= []).push(a);
                  else displayList.push(a);
                }
                for (const [code, list] of Object.entries(editsByCode)) {
                  if (list.length === 1) { displayList.push(list[0]); continue; }
                  const gkey = `${name}||${code}`;
                  let start = list[0].start_date, end = list[0].end_date || list[0].start_date;
                  for (const a of list) {
                    if (day(a.start_date) < day(start)) start = a.start_date;
                    const ae = a.end_date || a.start_date;
                    if (day(ae) > day(end)) end = ae;
                  }
                  displayList.push({ id: `grp-${gkey}`, kind: 'editgroup', gkey, project_code: code,
                    project_title: `${list.length} edits`, position_name: `${list.length} edits`,
                    start_date: start, end_date: end });
                  if (openGroups.has(gkey)) displayList.push(...list);
                }
                // Double bookings drop to their own lane instead of overlapping
                const lanes = [];
                const laneOf = {};
                for (const a of [...displayList].sort((x, y) => day(x.start_date) - day(y.start_date))) {
                  const s2 = day(a.start_date), e2 = day(a.end_date || a.start_date);
                  let li = lanes.findIndex(end => end < s2);
                  if (li === -1) { li = lanes.length; lanes.push(e2); } else lanes[li] = e2;
                  laneOf[a.id] = li;
                }
                const laneCount = Math.max(1, lanes.length);
                const rowH = 12 + laneCount * 28;
                return (
                  <div key={name} style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative', minHeight: rowH }}>
                    <div className="cal-name" style={{ width: NAME_W, flexShrink: 0, padding: '10px 12px', fontSize: 12, fontWeight: 700, position: 'sticky', left: 0, zIndex: 2, borderRight: '1px solid var(--border)' }}>{name}</div>
                    {/* weekend shading + today line */}
                    {Array.from({ length: totalDays }, (_, i) => {
                      const d = dayAt(i);
                      const wknd = d.getDay() === 0 || d.getDay() === 6;
                      if (!wknd) return null;
                      return <div key={i} style={{ position: 'absolute', left: NAME_W + i * DAY_W, top: 0, bottom: 0, width: DAY_W, background: 'rgba(255,255,255,0.02)' }} />;
                    })}
                    <div style={{ position: 'absolute', left: NAME_W + PAST_DAYS * DAY_W + DAY_W / 2, top: 0, bottom: 0, width: 1, background: 'var(--orange)', opacity: 0.45, zIndex: 1 }} />
                    {displayList.map(a => {
                      const from = Math.max(0, idxOf(a.start_date));
                      const to = Math.min(totalDays - 1, idxOf(a.end_date || a.start_date));
                      if (to < from) return null;
                      const c = a.kind === 'pto' ? '#4a9eff' : a.kind === 'event' ? '#E8500A' : colorFor(a.project_code);
                      const isEdit = a.kind === 'edit';
                      if (a.kind === 'editgroup') {
                        const open = openGroups.has(a.gkey);
                        return (
                          <div key={a.id} className="cal-bar"
                            onClick={() => setOpenGroups(g => { const n = new Set(g); n.has(a.gkey) ? n.delete(a.gkey) : n.add(a.gkey); return n; })}
                            title={`${a.project_code} — ${a.project_title}. Click to ${open ? 'collapse' : 'expand'} the individual edits.`}
                            style={{
                              position: 'absolute', top: 8 + (laneOf[a.id] || 0) * 28, height: 24, zIndex: 1,
                              left: NAME_W + from * DAY_W,
                              width: (to - from + 1) * DAY_W - 4,
                              backgroundColor: `${c}2e`, border: `1px solid ${c}`, borderRadius: 6,
                              display: 'flex', alignItems: 'center', gap: 5, padding: '0 6px', overflow: 'hidden',
                              fontSize: 9, fontWeight: 700, color: c, whiteSpace: 'nowrap', cursor: 'pointer',
                            }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                              <path d="M3 6h18M3 12h18M3 18h18" />
                            </svg>
                            Multiple Edits · {a.project_code}{open ? ' ▴' : ' ▾'}
                          </div>
                        );
                      }
                      return (
                        <a key={a.id} className="cal-bar" href={a.kind === 'pto' ? '/team?view=pipeline' : a.kind === 'event' ? '/team?view=events' : isEdit ? `/avo/${a.project_id}` : `/projects/${a.project_id}`}
                          title={`${a.project_code || ''} · ${a.project_title || ''} — ${a.position_name}`}
                          style={{
                            position: 'absolute', top: 8 + (laneOf[a.id] || 0) * 28, height: 24, zIndex: 1,
                            left: NAME_W + from * DAY_W,
                            width: (to - from + 1) * DAY_W - 4,
                            backgroundColor: `${c}2e`, border: `1px solid ${c}`, borderRadius: 6,
                            display: 'flex', alignItems: 'center', padding: '0 6px', overflow: 'hidden',
                            fontSize: 9, fontWeight: 700, color: c, whiteSpace: 'nowrap', textDecoration: 'none',
                          }}>
                          {isEdit ? '✂ ' : a.kind === 'event' ? '★ ' : ''}{a.project_code} · {a.position_name}
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
      <HubBottomNav />
    </div>
  );
}
