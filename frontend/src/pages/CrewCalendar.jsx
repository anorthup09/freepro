import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const COLORS = ['#E8500A', '#5ABF80', '#4a9eff', '#e6c229', '#a78bfa', '#f87171', '#40A0A0', '#D0A030'];
const colorFor = str => { let h = 0; for (const c of str || '') h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return COLORS[Math.abs(h) % COLORS.length]; };
const day = d => new Date(String(d).slice(0, 10) + 'T12:00:00');

export default function CrewCalendar() {
  const [rows, setRows] = useState(null);
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });

  useEffect(() => { api.crewCalendar().then(setRows).catch(e => alert(e.message)); }, []);

  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const monthStart = new Date(month.y, month.m, 1, 12);
  const monthEnd = new Date(month.y, month.m, daysInMonth, 12);
  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const members = useMemo(() => {
    const byName = {};
    for (const r of rows || []) {
      const s = day(r.start_date), e = day(r.end_date || r.start_date);
      if (e < monthStart || s > monthEnd) continue;
      (byName[r.member_name] ||= []).push(r);
    }
    return Object.entries(byName).sort(([a], [b]) => a.localeCompare(b));
  }, [rows, month.y, month.m]);

  const today = new Date();
  const isThisMonth = today.getFullYear() === month.y && today.getMonth() === month.m;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 18px 60px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          <div>
            <div className="page-title">Crew Calendar</div>
            <div className="page-sub">Unbridled Media employees on shoots</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setMonth(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })}>‹</button>
            <div style={{ fontSize: 14, fontWeight: 800, minWidth: 150, textAlign: 'center' }}>{monthLabel}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setMonth(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })}>›</button>
            <Link to="/projects" className="btn btn-ghost btn-sm" style={{ textDecoration: 'none' }}>Back to FreePro</Link>
          </div>
        </div>

        {!rows && <div className="empty">Loading…</div>}
        {rows && members.length === 0 && <div className="empty">No Unbridled crew assigned to shoots in {monthLabel}.</div>}

        {members.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflowX: 'auto' }}>
            <div style={{ minWidth: 900 }}>
              {/* day header */}
              <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${daysInMonth}, 1fr)`, borderBottom: '1px solid var(--border)' }}>
                <div />
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = new Date(month.y, month.m, i + 1);
                  const wknd = d.getDay() === 0 || d.getDay() === 6;
                  const isToday = isThisMonth && today.getDate() === i + 1;
                  return (
                    <div key={i} style={{ textAlign: 'center', padding: '6px 0', fontSize: 9, color: isToday ? 'var(--orange)' : wknd ? 'rgba(255,255,255,0.25)' : 'var(--muted)', fontWeight: isToday ? 800 : 600 }}>
                      <div>{['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getDay()]}</div>
                      <div style={{ fontSize: 10 }}>{i + 1}</div>
                    </div>
                  );
                })}
              </div>
              {/* member rows */}
              {members.map(([name, assigns]) => (
                <div key={name} style={{ display: 'grid', gridTemplateColumns: `160px repeat(${daysInMonth}, 1fr)`, borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative', minHeight: 40 }}>
                  <div style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, position: 'sticky', left: 0, background: 'var(--bg2)', zIndex: 2, borderRight: '1px solid var(--border)' }}>{name}</div>
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const d = new Date(month.y, month.m, i + 1);
                    const wknd = d.getDay() === 0 || d.getDay() === 6;
                    return <div key={i} style={{ background: wknd ? 'rgba(255,255,255,0.015)' : 'transparent', borderLeft: '1px solid rgba(255,255,255,0.02)' }} />;
                  })}
                  {assigns.map(a => {
                    const s = day(a.start_date), e = day(a.end_date || a.start_date);
                    const from = Math.max(1, s <= monthStart ? 1 : s.getDate());
                    const to = Math.min(daysInMonth, e >= monthEnd ? daysInMonth : e.getDate());
                    if (to < from) return null;
                    const c = colorFor(a.project_code);
                    return (
                      <a key={a.id} href={`/projects/${a.project_id}`} title={`${a.project_code} · ${a.project_title} — ${a.position_name}`}
                        style={{
                          position: 'absolute', top: 8, height: 24, zIndex: 1,
                          left: `calc(160px + (100% - 160px) * ${(from - 1) / daysInMonth})`,
                          width: `calc((100% - 160px) * ${(to - from + 1) / daysInMonth} - 3px)`,
                          background: `${c}2e`, border: `1px solid ${c}`, borderRadius: 6,
                          display: 'flex', alignItems: 'center', padding: '0 6px', overflow: 'hidden',
                          fontSize: 9, fontWeight: 700, color: c, whiteSpace: 'nowrap', textDecoration: 'none',
                        }}>
                        {a.project_code} · {a.position_name}
                      </a>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 12 }}>
          Bars show assignment start–end dates. Assigning someone (with dates) emails them an Outlook calendar hold automatically.
        </div>
      </div>
    </div>
  );
}
