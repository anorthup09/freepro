import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';

function isoDateOf(ts) {
  if (!ts) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

// Returns [{...flight, _leg:'depart'|'arrive'}] for items that fall on dayDateStr
function flightLegsForDay(flights, dayDateStr) {
  if (!flights?.length || !dayDateStr) return [];
  const dayDate = dayDateStr.slice(0, 10);
  const legs = [];
  for (const f of flights) {
    if (f.depart_time && isoDateOf(f.depart_time) === dayDate) legs.push({ ...f, _leg:'depart' });
    if (f.arrive_time && isoDateOf(f.arrive_time) === dayDate) legs.push({ ...f, _leg:'arrive' });
  }
  return legs;
}

// Convert a display time string like "7:30 AM" or "08:35" to minutes since midnight for sorting
function timeToMinutes(str) {
  if (!str) return 9999;
  const ampm = /([0-9]{1,2}):([0-9]{2})\s*(AM|PM)/i.exec(str);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const pm = ampm[3].toUpperCase() === 'PM';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
    return h * 60 + m;
  }
  const hm = /([0-9]{1,2}):([0-9]{2})/.exec(str);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  return 9999;
}

function fmtTime(str) {
  if (!str) return '';
  // Already 12-hour format (legacy text entries)
  if (/AM|PM/i.test(str)) return str;
  // HH:MM from time input → 12-hour display
  const [h, m] = str.split(':').map(Number);
  if (isNaN(h)) return str;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

function legDisplayTime(leg) {
  if (leg._leg === 'arrive') {
    if (leg.arrive_display) return leg.arrive_display;
    if (leg.arrive_time) return new Date(leg.arrive_time).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
  } else {
    if (leg.depart_display) return leg.depart_display;
    if (leg.depart_time) return new Date(leg.depart_time).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
  }
  return '';
}

// Parse a stored date string as local noon to avoid UTC-to-local day shift
function parseDay(dateStr) {
  if (!dateStr) return new Date();
  return new Date(dateStr.slice(0, 10) + 'T12:00:00');
}

function wmoIcon(code) {
  if (code === 0) return '☀️';
  if (code <= 2) return '⛅';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌦️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '❄️';
  return '⛈️';
}

const TAG_TYPES = ['VIDEO','PHOTO','AUDIO','ALL_CREW','TALENT','CUSTOM'];
const TAG_CLASS = { VIDEO:'v', PHOTO:'p', AUDIO:'a', ALL_CREW:'a', TALENT:'t', CUSTOM:'v' };
const TAG_LABEL = { VIDEO:'Video', PHOTO:'Photo', AUDIO:'Audio', ALL_CREW:'All Crew', TALENT:'Talent', CUSTOM:'Custom' };

export default function Schedule({ project }) {
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [dayForm, setDayForm] = useState({ date:'', callTime:'', wrapTime:'', weather:'', notes:'' });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventForm, setEventForm] = useState({ startTime:'', endTime:'', title:'', detail:'', isAlert:false, tags:[] });
  const [editEventId, setEditEventId] = useState(null);
  const [editEventForm, setEditEventForm] = useState({ startTime:'', endTime:'', title:'', detail:'', isAlert:false, tags:[] });
  const [editCallId, setEditCallId] = useState(null);
  const [callTime, setCallTime] = useState('');
  const [dayMeta, setDayMeta] = useState({});
  const [flights, setFlights] = useState([]);
  const [weatherByDate, setWeatherByDate] = useState({});

  function refreshFlights() {
    api.getFlights(project.id).then(setFlights).catch(() => {});
  }

  useEffect(() => {
    refreshFlights();
    api.getSchedule(project.id).then(d => {
      setDays(d);
      if (d.length > 0) setActiveDay(d[0].id);
      const meta = {};
      d.forEach(day => { meta[day.id] = { crewLunch: day.crew_lunch||'', gearStorage: day.gear_storage||'', gsAudio: day.gs_audio||'' }; });
      setDayMeta(meta);
    });
  }, [project.id]);

  useEffect(() => {
    if (!project.city) return;
    async function fetchWeather() {
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(project.city)}&count=1&language=en&format=json`);
        const geo = await geoRes.json();
        if (!geo.results?.length) return;
        const { latitude, longitude } = geo.results[0];
        const dates = days.map(d => d.date?.slice(0,10)).filter(Boolean).sort();
        if (!dates.length) return;
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${dates[0]}&end_date=${dates[dates.length-1]}&forecast_days=16`);
        const w = await wRes.json();
        if (!w.daily?.time) return;
        const byDate = {};
        w.daily.time.forEach((date, i) => {
          byDate[date] = {
            high: Math.round(w.daily.temperature_2m_max[i]),
            low: Math.round(w.daily.temperature_2m_min[i]),
            precip: w.daily.precipitation_probability_max[i],
            code: w.daily.weathercode[i],
          };
        });
        setWeatherByDate(byDate);
      } catch(e) {}
    }
    if (days.length) fetchWeather();
  }, [days, project.city]);

  async function saveDayMeta(dayId, field, value) {
    setDayMeta(m => ({ ...m, [dayId]: { ...m[dayId], [field]: value } }));
    try { await api.updateDay(project.id, dayId, { [field]: value }); } catch(e) { alert(e.message); }
  }

  const currentDay = days.find(d => d.id === activeDay);

  async function addDay(e) {
    e.preventDefault();
    try {
      const sorted = [...days].sort((a, b) => (a.date||'').localeCompare(b.date||''));
      const day = await api.createDay(project.id, {
        ...dayForm,
        dayNumber: sorted.length + 1,
        date: new Date(dayForm.date + 'T12:00:00').toISOString(),
      });
      const newDays = [...days, { ...day, events: [], crewCalls: [] }].sort((a, b) => (a.date||'').localeCompare(b.date||''));
      setDays(newDays);
      setActiveDay(day.id);
      setShowAddDay(false);
      setDayForm({ date:'', callTime:'', wrapTime:'', weather:'', notes:'' });
      refreshFlights();
    } catch(e) { alert(e.message); }
  }

  async function deleteDay(dayId) {
    if (!confirm('Delete this shoot day and all its events?')) return;
    await api.deleteDay(project.id, dayId);
    const remaining = days.filter(d => d.id !== dayId);
    setDays(remaining);
    setActiveDay(remaining[0]?.id || null);
  }

  async function addEvent(e) {
    e.preventDefault();
    try {
      const ev = await api.createEvent(project.id, activeDay, eventForm);
      setDays(ds => ds.map(d => d.id === activeDay ? { ...d, events: [...d.events, ev].sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')) } : d));
      setShowAddEvent(false);
      setEventForm({ startTime:'', endTime:'', title:'', detail:'', isAlert:false, tags:[] });
    } catch(e) { alert(e.message); }
  }

  async function deleteEvent(eventId) {
    await api.deleteEvent(project.id, eventId);
    setDays(ds => ds.map(d => d.id === activeDay ? { ...d, events: d.events.filter(e => e.id !== eventId) } : d));
  }

  async function saveEditEvent(e) {
    e.preventDefault();
    try {
      const updated = await api.updateEvent(project.id, editEventId, editEventForm);
      setDays(ds => ds.map(d => d.id === activeDay ? {
        ...d,
        events: d.events.map(ev => ev.id === editEventId ? { ...ev, ...updated } : ev)
          .sort((a, b) => (a.start_time||'').localeCompare(b.start_time||''))
      } : d));
      setEditEventId(null);
    } catch(e) { alert(e.message); }
  }

  function openEditEvent(ev) {
    setEditEventId(ev.id);
    setEditEventForm({ startTime: ev.start_time || ev.startTime || '', endTime: ev.end_time || ev.endTime || '', title: ev.title || '', detail: ev.detail || '', isAlert: ev.is_alert || ev.isAlert || false, tags: ev.tags || [] });
  }

  function toggleEditTag(type) {
    setEditEventForm(f => ({
      ...f,
      tags: f.tags.some(t => t.type === type)
        ? f.tags.filter(t => t.type !== type)
        : [...f.tags, { type }]
    }));
  }

  async function saveCallTime(call) {
    try {
      const updated = await api.updateDayCall(project.id, call.id, { callTime });
      setDays(ds => ds.map(d => d.id === activeDay ? {
        ...d,
        crewCalls: d.crewCalls.map(c => c.id === call.id ? updated : c)
      } : d));
      setEditCallId(null);
    } catch(e) { alert(e.message); }
  }

  function toggleTag(type) {
    setEventForm(f => ({
      ...f,
      tags: f.tags.some(t => t.type === type)
        ? f.tags.filter(t => t.type !== type)
        : [...f.tags, { type }]
    }));
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div>
          <div className="page-title">Schedule</div>
          <div className="page-sub">{project.city}, {project.state} · {parseDay(project.start_date||project.startDate).toLocaleDateString()} – {parseDay(project.end_date||project.endDate).toLocaleDateString()}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAddDay(true)}>+ Add Day</button>
      </div>

      {days.length === 0 && <div className="empty">No shoot days yet — add a day to start building the schedule.</div>}

      {/* Day tabs — sorted by date, day number = index */}
      {days.length > 0 && (
        <div className="day-tabs">
          {[...days].sort((a,b) => (a.date||'').localeCompare(b.date||'')).map((d, i) => (
            <button key={d.id} className={`day-tab${d.id === activeDay ? ' on' : ''}`} onClick={() => setActiveDay(d.id)}>
              Day {i + 1} · {parseDay(d.date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
            </button>
          ))}
        </div>
      )}

      {/* Day detail */}
      {currentDay && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:15, display:'flex', alignItems:'center', gap:10 }}>
                  Day {[...days].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).findIndex(d=>d.id===currentDay.id)+1} · {parseDay(currentDay.date).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
                  {(() => {
                    const w = weatherByDate[currentDay.date?.slice(0,10)];
                    if (!w) return null;
                    return (
                      <span style={{ fontSize:12, fontWeight:400, color:'var(--tan)', display:'flex', alignItems:'center', gap:5 }}>
                        {wmoIcon(w.code)} {w.high}° / {w.low}°
                        {w.precip > 0 && <span style={{ color:'var(--muted)', fontSize:11 }}>· {w.precip}% precip</span>}
                      </span>
                    );
                  })()}
                </div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
                  {currentDay.callTime && `Call ${currentDay.callTime}`}
                  {currentDay.wrapTime && ` · Wrap ${currentDay.wrapTime}`}
                  {currentDay.weather && ` · ${currentDay.weather}`}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => deleteDay(currentDay.id)}>Delete Day</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              {[
                { label:'Crew Meal Location', field:'crewLunch' },
                { label:'Gear Storage', field:'gearStorage' },
                { label:'GS Audio Contact', field:'gsAudio' },
              ].map(({ label, field }) => (
                <div key={field} className="field" style={{ margin:0 }}>
                  <label style={{ fontSize:10 }}>{label}</label>
                  <input
                    value={dayMeta[currentDay.id]?.[field] || ''}
                    onChange={e => setDayMeta(m => ({ ...m, [currentDay.id]: { ...m[currentDay.id], [field]: e.target.value } }))}
                    onBlur={e => saveDayMeta(currentDay.id, field, e.target.value)}
                    placeholder={label === 'Crew Lunch' ? 'Chipotle · 12:30 PM' : label === 'Gear Storage' ? 'Room 104B' : 'Main stage L/R'}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Crew Calls */}
          {currentDay.crewCalls?.length > 0 && (
            <>
              <div className="sec-lbl">Crew Calls</div>
              <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:16 }}>
                <table className="pos-table" style={{ width:'100%' }}>
                  <thead><tr>
                    <th>Position</th><th>Crew Member</th><th>Call Time</th><th>Location</th>
                  </tr></thead>
                  <tbody>
                    {currentDay.crewCalls.map(c => (
                      <tr key={c.id}>
                        <td className="pos-name">{c.crewAssignment.position.name}{c.crewAssignment.slotNumber > 1 ? ` ${c.crewAssignment.slotNumber}` : ''}</td>
                        <td style={{ color:'var(--tan)', fontSize:12 }}>{c.crewAssignment.crewMember?.name || <span style={{ color:'var(--muted)' }}>Unassigned</span>}</td>
                        <td>
                          {editCallId === c.id ? (
                            <div style={{ display:'flex', gap:6 }}>
                              <input style={{ width:90 }} value={callTime} onChange={e => setCallTime(e.target.value)} placeholder="7:30 AM" autoFocus />
                              <button className="btn btn-primary btn-sm" onClick={() => saveCallTime(c)}>Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditCallId(null)}>✕</button>
                            </div>
                          ) : (
                            <span style={{ cursor:'pointer', color: c.callTime ? 'var(--orange)' : 'var(--muted)', fontSize:11, fontWeight:500 }}
                              onClick={() => { setEditCallId(c.id); setCallTime(c.callTime || ''); }}>
                              {c.callTime || '—'}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize:11, color:'var(--muted)' }}>{c.locationNote || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Merged timeline: events + flight legs sorted by time */}
          {(() => {
            const legs = flightLegsForDay(flights, currentDay.date);
            const eventItems = (currentDay.events || []).map(ev => ({ _type:'event', _sort: timeToMinutes(ev.start_time || ev.startTime), ...ev }));
            const flightItems = legs.map((leg, i) => ({ _type:'flight', _sort: timeToMinutes(legDisplayTime(leg)), _key: leg.id + leg._leg, ...leg }));
            const previewItems = (showAddEvent && (eventForm.title || eventForm.startTime))
              ? [{ _type:'preview', _sort: timeToMinutes(eventForm.startTime) || 9998, _key:'preview', ...eventForm }]
              : [];
            const items = [...eventItems, ...flightItems, ...previewItems].sort((a, b) => a._sort - b._sort);

            return (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div className="sec-lbl" style={{ margin:0 }}>Timeline</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddEvent(true)}>+ Add Event</button>
                </div>
                <div style={{ marginTop:10 }}>
                  {items.length === 0 && <div className="empty">No events yet for this day.</div>}
                  <div className="tl">
                    {items.map(item => item._type === 'preview' ? (
                      <div key="preview" className="ev" style={{ opacity:0.55 }}>
                        <div className="ev-time" style={{ fontStyle:'italic' }}>{fmtTime(item.startTime) || '—'}{item.endTime ? ` – ${fmtTime(item.endTime)}` : ''}</div>
                        <div className={`ev-body${item.isAlert ? ' warn' : ''}`} style={{ border:'1px dashed var(--border2)' }}>
                          <div className={`ev-title${item.isAlert ? ' alert' : ''}`} style={{ fontStyle:'italic' }}>
                            {item.isAlert ? '⚠ ' : ''}{item.title || 'New event…'}
                          </div>
                          {item.detail && <div className="ev-detail">{item.detail}</div>}
                          {item.tags?.length > 0 && (
                            <div className="ev-tags">
                              {item.tags.map(t => <span key={t.type} className={`etag ${TAG_CLASS[t.type]}`}>{TAG_LABEL[t.type]}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : item._type === 'flight' ? (
                      <div key={item._key} className="ev">
                        <div className="ev-time">✈ {legDisplayTime(item)}</div>
                        <div className="ev-body" style={{ borderLeft:'2px solid var(--orange)' }}>
                          <div className="ev-title">
                            {item._leg === 'depart' ? 'Departure' : 'Arrival'} — {item.crew_name || item.passenger_name}
                            {item.is_return && <span style={{ fontSize:10, marginLeft:6, color:'var(--muted)' }}>↩ return</span>}
                          </div>
                          <div className="ev-detail">
                            {item.origin} → {item.destination}
                            {(item.airline || item.flight_number) && (
                              <span style={{ color:'var(--muted)', marginLeft:8 }}>{[item.airline, item.flight_number].filter(Boolean).join(' ')}</span>
                            )}
                            {item.confirmation && <span style={{ color:'var(--muted)', marginLeft:8 }}>#{item.confirmation}</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div key={item.id} className="ev">
                        <div className="ev-time">{fmtTime(item.start_time || item.startTime)}{(item.end_time || item.endTime) ? ` – ${fmtTime(item.end_time || item.endTime)}` : ''}</div>
                        <div className={`ev-body${(item.is_alert||item.isAlert) ? ' warn' : ''}`} style={!(item.is_alert||item.isAlert) ? { borderLeft:'2px solid var(--orange)' } : {}}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                            <div className={`ev-title${(item.is_alert||item.isAlert) ? ' alert' : ''}`}>{(item.is_alert||item.isAlert) ? '⚠ ' : ''}{item.title}</div>
                            <div style={{ display:'flex', gap:4, flexShrink:0, marginLeft:8 }}>
                              <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => openEditEvent(item)}>✎</button>
                              <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }} onClick={() => deleteEvent(item.id)}>✕</button>
                            </div>
                          </div>
                          {item.detail && <div className="ev-detail">{item.detail}</div>}
                          {item.location && <div style={{ fontSize:10, color:'var(--tan)', marginTop:3 }}>📍 {item.location.name}</div>}
                          {item.tags?.length > 0 && (
                            <div className="ev-tags">
                              {item.tags.map(t => <span key={t.id} className={`etag ${TAG_CLASS[t.type]}`}>{TAG_LABEL[t.type]}</span>)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Add Day Modal */}
      {showAddDay && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAddDay(false)}>
          <div className="modal">
            <div className="modal-title">Add Shoot Day</div>
            <form onSubmit={addDay}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Date</label><input type="date" value={dayForm.date} onChange={e => setDayForm(f=>({...f,date:e.target.value}))} required /></div>
                <div className="field"><label>General Call Time</label><input value={dayForm.callTime} onChange={e => setDayForm(f=>({...f,callTime:e.target.value}))} placeholder="7:30 AM" /></div>
                <div className="field"><label>Wrap Time</label><input value={dayForm.wrapTime} onChange={e => setDayForm(f=>({...f,wrapTime:e.target.value}))} placeholder="10:00 PM" /></div>
                <div className="field"><label>Weather</label><input value={dayForm.weather} onChange={e => setDayForm(f=>({...f,weather:e.target.value}))} placeholder="80° ☀️" /></div>
                <div className="field"><label>Notes</label><input value={dayForm.notes} onChange={e => setDayForm(f=>({...f,notes:e.target.value}))} placeholder="Long day" /></div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Day</button><button type="button" className="btn btn-ghost" onClick={() => setShowAddDay(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowAddEvent(false)}>
          <div className="modal">
            <div className="modal-title">Add Event — Day {currentDay?.dayNumber}</div>
            <form onSubmit={addEvent}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Start Time</label><input type="time" value={eventForm.startTime} onChange={e => setEventForm(f=>({...f,startTime:e.target.value}))} required /></div>
                <div className="field"><label>End Time</label><input type="time" value={eventForm.endTime} onChange={e => setEventForm(f=>({...f,endTime:e.target.value}))} /></div>
                <div className="field span2"><label>Title</label><input value={eventForm.title} onChange={e => setEventForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field span2"><label>Detail / Notes</label><textarea value={eventForm.detail} onChange={e => setEventForm(f=>({...f,detail:e.target.value}))} /></div>
                <div className="field span2">
                  <label>Tags</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                    {TAG_TYPES.map(type => (
                      <button key={type} type="button"
                        className={`etag ${TAG_CLASS[type]}`}
                        style={{ cursor:'pointer', opacity: eventForm.tags.some(t=>t.type===type) ? 1 : 0.4, padding:'4px 10px' }}
                        onClick={() => toggleTag(type)}>
                        {TAG_LABEL[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field span2" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <input type="checkbox" id="isAlert" checked={eventForm.isAlert} onChange={e => setEventForm(f=>({...f,isAlert:e.target.checked}))} style={{ width:'auto' }} />
                  <label htmlFor="isAlert" style={{ textTransform:'none', letterSpacing:0, fontSize:12, color:'var(--text)' }}>Mark as urgent alert</label>
                </div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Add Event</button><button type="button" className="btn btn-ghost" onClick={() => setShowAddEvent(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editEventId && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setEditEventId(null)}>
          <div className="modal">
            <div className="modal-title">Edit Event</div>
            <form onSubmit={saveEditEvent}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field"><label>Start Time</label><input type="time" value={editEventForm.startTime} onChange={e => setEditEventForm(f=>({...f,startTime:e.target.value}))} required /></div>
                <div className="field"><label>End Time</label><input type="time" value={editEventForm.endTime} onChange={e => setEditEventForm(f=>({...f,endTime:e.target.value}))} /></div>
                <div className="field span2"><label>Title</label><input value={editEventForm.title} onChange={e => setEditEventForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field span2"><label>Detail / Notes</label><textarea value={editEventForm.detail} onChange={e => setEditEventForm(f=>({...f,detail:e.target.value}))} /></div>
                <div className="field span2">
                  <label>Tags</label>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:4 }}>
                    {TAG_TYPES.map(type => (
                      <button key={type} type="button"
                        className={`etag ${TAG_CLASS[type]}`}
                        style={{ cursor:'pointer', opacity: editEventForm.tags.some(t=>t.type===type) ? 1 : 0.4, padding:'4px 10px' }}
                        onClick={() => toggleEditTag(type)}>
                        {TAG_LABEL[type]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="field span2" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <input type="checkbox" id="editIsAlert" checked={editEventForm.isAlert} onChange={e => setEditEventForm(f=>({...f,isAlert:e.target.checked}))} style={{ width:'auto' }} />
                  <label htmlFor="editIsAlert" style={{ textTransform:'none', letterSpacing:0, fontSize:12, color:'var(--text)' }}>Mark as urgent alert</label>
                </div>
              </div>
              <div className="btn-row"><button className="btn btn-primary">Save</button><button type="button" className="btn btn-ghost" onClick={() => setEditEventId(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
