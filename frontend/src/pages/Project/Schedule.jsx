import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { displayName } from '../../utils/displayName.js';

function isoDateOf(ts) {
  if (!ts) return null;
  return new Date(ts).toISOString().slice(0, 10);
}

// Parse month/day from display strings like "Aug 9, 10:00 AM"
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function displayMD(str) {
  if (!str) return null;
  const m = str.match(/^(\w{3})\s+(\d+)/);
  if (!m) return null;
  const mi = MONTHS.indexOf(m[1]);
  return mi >= 0 ? `${String(mi + 1).padStart(2,'0')}-${String(parseInt(m[2])).padStart(2,'0')}` : null;
}

// Returns [{...flight, _leg:'depart'|'arrive'}] for items that fall on dayDateStr
function flightLegsForDay(flights, dayDateStr) {
  if (!flights?.length || !dayDateStr) return [];
  const dayDate = dayDateStr.slice(0, 10); // "YYYY-MM-DD"
  const dayMD = dayDate.slice(5);           // "MM-DD"
  const legs = [];
  const seen = new Set();
  for (const f of flights) {
    const departMD = f.depart_display ? displayMD(f.depart_display) : null;
    const arriveMD = f.arrive_display ? displayMD(f.arrive_display) : null;
    const departMatch =
      (departMD && departMD === dayMD) ||
      (f.depart_time && isoDateOf(f.depart_time) === dayDate);
    const arriveMatch =
      (arriveMD && arriveMD === dayMD) ||
      (f.arrive_time && isoDateOf(f.arrive_time) === dayDate);
    if (departMatch && !seen.has(f.id + 'd')) { legs.push({ ...f, _leg:'depart' }); seen.add(f.id + 'd'); }
    if (arriveMatch && !seen.has(f.id + 'a')) { legs.push({ ...f, _leg:'arrive' }); seen.add(f.id + 'a'); }
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

function flightStatusLabel(f) {
  const st = (f.status || '').toUpperCase();
  if (st === 'CANCELLED') return { label:'Cancelled', color:'#ef4444', alert:true };
  if (st === 'DELAYED')   return { label:'Delayed',   color:'#f59e0b', alert:true };
  const depart = f.depart_time ? new Date(f.depart_time) : null;
  const arrive = f.arrive_time ? new Date(f.arrive_time) : null;
  const now = new Date();
  if (!depart) return { label:'Status Coming Soon', color:'var(--orange)', dot:null };
  if (now < depart) return { label:'Pre-flight', color:'#6b7280', dot:'#6b7280' };
  if (arrive && now < arrive) return { label:'In-flight', color:'#60a5fa', dot:'#60a5fa' };
  return { label:'Arrived', color:'#22c55e', dot:'#22c55e' };
}

// Shot list scene styling — mirrors ShotList.jsx
const SL_SCENE_STYLES = {
  interior: { bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.35)', badge: 'rgba(96,165,250,0.18)', color: '#60a5fa', label: 'INT.' },
  exterior: { bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.35)', badge: 'rgba(74,222,128,0.14)', color: '#4ade80', label: 'EXT.' },
};

function slCalcWrap(startTime, shots) {
  if (!startTime) return null;
  const match = startTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let [, h, m, meridiem] = match;
  h = parseInt(h); m = parseInt(m);
  if (meridiem.toUpperCase() === 'PM' && h !== 12) h += 12;
  if (meridiem.toUpperCase() === 'AM' && h === 12) h = 0;
  const total = h * 60 + m + shots.reduce((s, sh) => s + (sh.est_minutes || 0), 0);
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  const period = endH >= 12 ? 'PM' : 'AM';
  return `${endH % 12 || 12}:${String(endM).padStart(2, '0')} ${period}`;
}

// "THU, AUG 6, 2026" → "2026-08-06" for date comparison
const _SL_MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function slDateToISO(str) {
  if (!str) return null;
  const m = str.match(/\w+,\s+(\w+)\s+(\d+),\s+(\d{4})/);
  if (!m) return null;
  const mi = _SL_MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (!mi) return null;
  return `${m[3]}-${String(mi).padStart(2,'0')}-${String(parseInt(m[2])).padStart(2,'0')}`;
}

const DAY_TYPES = [
  { value:'SHOOT',        label:'Shoot Day' },
  { value:'TRAVEL',       label:'Travel Day' },
  { value:'TRAVEL_SHOOT', label:'Travel/Shoot Day' },
  { value:'SCOUT',        label:'Scout Day' },
];

const MEAL_COLORS = {
  BREAKFAST: { color:'#fbbf24', bg:'rgba(251,191,36,0.10)', emoji:'🍳', label:'Breakfast' },
  DINNER:    { color:'#f87171', bg:'rgba(248,113,113,0.10)', emoji:'🍽️', label:'Dinner' },
  LUNCH:     { color:'#4ade80', bg:'rgba(74,222,128,0.08)',  emoji:'🥗', label:'Lunch' },
};

const TAG_TYPES = ['VIDEO','PHOTO','AUDIO','ALL_CREW','TALENT','CUSTOM'];
const TAG_CLASS = { VIDEO:'v', PHOTO:'p', AUDIO:'a', ALL_CREW:'a', TALENT:'t', CUSTOM:'v' };
const TAG_LABEL = { VIDEO:'Video', PHOTO:'Photo', AUDIO:'Audio', ALL_CREW:'All Crew', TALENT:'Talent', CUSTOM:'Custom' };

const SYNTHETIC_META = {
  ct:  { color:'#4a9eff', bg:'rgba(74,158,255,0.08)',  notesKey:'callTimeNotes',      tagsKey:'callTimeTags',      locationKey:'callTimeLocationId' },
  sct: { color:'#ff8c00', bg:'rgba(255,140,0,0.10)',   notesKey:'shootingCallNotes',  tagsKey:'shootingCallTags',  locationKey:'shootingCallLocationId' },
  lt:  { color:'#4ade80', bg:'rgba(74,222,128,0.08)',  notesKey:'lunchNotes',         tagsKey:'lunchTags',         locationKey:'lunchLocationId' },
  wt:  { color:'#a78bfa', bg:'rgba(167,139,250,0.08)', notesKey:'wrapTimeNotes',      tagsKey:'wrapTimeTags',      locationKey:'wrapTimeLocationId' },
};

export default function Schedule({ project, showCateringGrid, setShowCateringGrid, onCateringTabChange, showShotList, setShowShotList, onShotListTabChange, showTravel, setShowTravel, onTravelTabChange }) {
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(null);
  const [showAddDay, setShowAddDay] = useState(false);
  const [dayForm, setDayForm] = useState({ date:'', callTime:'', wrapTime:'', weather:'', notes:'' });
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventForm, setEventForm] = useState({ startTime:'', endTime:'', title:'', detail:'', roomSpace:'', isAlert:false, isFilming:false, tags:[], audience:[], locationId:'' });
  const [editEventId, setEditEventId] = useState(null);
  const [editEventForm, setEditEventForm] = useState({ startTime:'', endTime:'', title:'', detail:'', roomSpace:'', isAlert:false, isFilming:false, tags:[], audience:[], locationId:'' });
  const [dayCardCollapsed, setDayCardCollapsed] = useState(false);
  const [keyTalent, setKeyTalent] = useState([]);
  const [editCallId, setEditCallId] = useState(null);
  const [callTime, setCallTime] = useState('');
  const [dayTimesForm, setDayTimesForm] = useState({});
  const [editingSyntheticKey, setEditingSyntheticKey] = useState(null);
  const [dayMeta, setDayMeta] = useState({});
  const [flights, setFlights] = useState([]);
  const [weatherByDate, setWeatherByDate] = useState({});
  const [cateringModal, setCateringModal] = useState(null);
  const [cateringForm, setCateringForm] = useState({ mealTypes:[], name:'', address:'', orderNumber:'', deliveryTime:'' });
  const [shotListScenes, setShotListScenes] = useState([]);
  const [slDays, setSlDays] = useState([]);
  const [savedToast, setSavedToast] = useState(false);
  const savedToastTimer = React.useRef(null);
  function flashSaved() {
    setSavedToast(true);
    clearTimeout(savedToastTimer.current);
    savedToastTimer.current = setTimeout(() => setSavedToast(false), 1800);
  }

  function refreshFlights() {
    api.getFlights(project.id).then(setFlights).catch(() => {});
  }

  useEffect(() => {
    api.getTalent(project.id).then(setKeyTalent).catch(() => {});
    api.getShotList(project.id).then(setShotListScenes).catch(() => {});
    api.getDays(project.id).then(setSlDays).catch(() => {});
  }, [project.id]);

  useEffect(() => {
    refreshFlights();
    api.getSchedule(project.id).then(d => {
      setDays(d);
      if (d.length > 0) setActiveDay(d[0].id);
      const meta = {};
      const times = {};
      d.forEach(day => {
        meta[day.id] = { crewLunch: day.crew_lunch||'', gearStorage: day.gear_storage||'', gsAudio: day.gs_audio||'' };
        times[day.id] = {
          callTime: day.call_time||'', shootingCallTime: day.shooting_call_time||'', lunchTime: day.lunch_time||'', wrapTime: day.wrap_time||'',
          callTimeNotes: day.call_time_notes||'', callTimeTags: day.call_time_tags||[],
          shootingCallNotes: day.shooting_call_notes||'', shootingCallTags: day.shooting_call_tags||[],
          lunchNotes: day.lunch_notes||'', lunchTags: day.lunch_tags||[],
          wrapTimeNotes: day.wrap_time_notes||'', wrapTimeTags: day.wrap_time_tags||[],
          callTimeLocationId: day.call_time_location_id||'',
          shootingCallLocationId: day.shooting_call_location_id||'',
          lunchLocationId: day.lunch_location_id||'',
          wrapTimeLocationId: day.wrap_time_location_id||'',
        };
      });
      setDayMeta(meta);
      setDayTimesForm(times);
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

  async function saveDayType(dayId, value) {
    setDays(ds => ds.map(d => d.id === dayId ? { ...d, day_type: value } : d));
    try { await api.updateDay(project.id, dayId, { dayType: value }); flashSaved(); } catch(e) { alert(e.message); }
  }

  function openCateringModal(dayId) {
    const day = days.find(d => d.id === dayId);
    const existing = day?.catering || [];
    const mealTypes = existing.map(c => c.meal_type);
    const first = existing[0] || {};
    setCateringForm({ mealTypes, name: first.name||'', address: first.address||'', orderNumber: first.order_number||'', deliveryTime: first.delivery_time||'' });
    setCateringModal(dayId);
  }

  async function saveCatering(e) {
    e.preventDefault();
    const dayId = cateringModal;
    const { mealTypes, name, address, orderNumber, deliveryTime } = cateringForm;
    const day = days.find(d => d.id === dayId);
    const existingTypes = (day?.catering || []).map(c => c.meal_type);
    const deleteMealTypes = existingTypes.filter(mt => !mealTypes.includes(mt));
    try {
      const results = await api.saveCatering(project.id, dayId, { mealTypes, name, address, orderNumber, deliveryTime, deleteMealTypes });
      setDays(ds => ds.map(d => {
        if (d.id !== dayId) return d;
        const kept = (d.catering||[]).filter(c => !mealTypes.includes(c.meal_type) && !deleteMealTypes.includes(c.meal_type));
        return { ...d, catering: [...kept, ...results] };
      }));
      setCateringModal(null);
      flashSaved();
    } catch(e) { alert(e.message); }
  }

  function toggleMealType(mt) {
    setCateringForm(f => ({
      ...f,
      mealTypes: f.mealTypes.includes(mt) ? f.mealTypes.filter(x => x !== mt) : [...f.mealTypes, mt],
    }));
  }

  async function saveDayMeta(dayId, field, value) {
    setDayMeta(m => ({ ...m, [dayId]: { ...m[dayId], [field]: value } }));
    try { await api.updateDay(project.id, dayId, { [field]: value }); flashSaved(); } catch(e) { alert(e.message); }
  }

  async function saveDayTime(dayId, field, value) {
    setDayTimesForm(m => ({ ...m, [dayId]: { ...m[dayId], [field]: value } }));
    try {
      const updated = await api.updateDay(project.id, dayId, { [field]: value || null });
      if (updated) {
        setDayTimesForm(m => ({ ...m, [dayId]: { ...m[dayId],
          callTimeTags:     updated.call_time_tags     ?? m[dayId]?.callTimeTags     ?? [],
          shootingCallTags: updated.shooting_call_tags ?? m[dayId]?.shootingCallTags ?? [],
          lunchTags:        updated.lunch_tags         ?? m[dayId]?.lunchTags        ?? [],
          wrapTimeTags:     updated.wrap_time_tags     ?? m[dayId]?.wrapTimeTags     ?? [],
        }}));
      }
      flashSaved();
    } catch(e) { alert(e.message); }
  }

  async function saveSyntheticMeta(dayId, key) {
    const t = dayTimesForm[dayId] || {};
    const meta = SYNTHETIC_META[key];
    try {
      await api.updateDay(project.id, dayId, {
        [meta.notesKey]: t[meta.notesKey]||null,
        [meta.tagsKey]: t[meta.tagsKey]||[],
        [meta.locationKey]: t[meta.locationKey]||null,
      });
      flashSaved();
    } catch(e) { alert(e.message); }
    setEditingSyntheticKey(null);
  }

  async function applyMetaToAll(field, value) {
    const otherDays = days.filter(d => d.id !== currentDay.id);
    otherDays.forEach(d => setDayMeta(m => ({ ...m, [d.id]: { ...m[d.id], [field]: value } })));
    try {
      await Promise.all(otherDays.map(d => api.updateDay(project.id, d.id, { [field]: value })));
      flashSaved();
    } catch(e) { alert(e.message); }
  }

  const currentDay = days.find(d => d.id === activeDay);

  async function addDay(e) {
    e.preventDefault();
    try {
      const sorted = [...days].sort((a, b) => (a.date||'').localeCompare(b.date||''));
      const day = await api.createDay(project.id, {
        notes: dayForm.notes,
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
    if (!activeDay) return alert('No shoot day selected.');
    try {
      const ev = await api.createEvent(project.id, activeDay, eventForm);
      setDays(ds => ds.map(d => d.id === activeDay ? { ...d, events: [...d.events, ev].sort((a,b) => (a.start_time||'').localeCompare(b.start_time||'')) } : d));
      setShowAddEvent(false);
      setEventForm({ startTime:'', endTime:'', title:'', detail:'', isAlert:false, isFilming:false, tags:[], audience:[] });
    } catch(e) {
      if (e.message?.includes('foreign key') || e.message?.includes('fkey')) {
        alert('This shoot day no longer exists. Please refresh the page and try again.');
      } else {
        alert(e.message);
      }
    }
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
    setEditEventForm({ startTime: ev.start_time || ev.startTime || '', endTime: ev.end_time || ev.endTime || '', title: ev.title || '', detail: ev.detail || '', roomSpace: ev.room_space || '', isAlert: ev.is_alert || ev.isAlert || false, isFilming: ev.is_filming || ev.isFilming || false, tags: ev.tags || [], audience: ev.audience || [], locationId: ev.location_id || '' });
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
      {savedToast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:'#22c55e', color:'#fff', fontSize:13, fontWeight:600, padding:'8px 18px', borderRadius:20, zIndex:9999, boxShadow:'0 2px 12px rgba(0,0,0,0.25)', pointerEvents:'none', letterSpacing:'.02em' }}>
          ✓ Saved
        </div>
      )}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div>
          <div className="page-title">Schedule</div>
          <div className="page-sub">{project.city}, {project.state} · {parseDay(project.start_date||project.startDate).toLocaleDateString()} – {parseDay(project.end_date||project.endDate).toLocaleDateString()}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
          <button className="btn btn-primary" onClick={() => setShowAddDay(true)}>+ Add Day</button>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
            <button
              onClick={() => { if (!showTravel) { setShowTravel(true); onTravelTabChange?.(); } else { setShowTravel(false); } }}
              style={{ fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:6, border:`1px solid ${showTravel ? '#a78bfa' : 'var(--border2)'}`, background: showTravel ? 'rgba(167,139,250,0.15)' : 'var(--bg2)', color: showTravel ? '#a78bfa' : 'var(--muted)', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}
            >
              {showTravel ? '✓ Travel' : '+ Travel'}
            </button>
            <button
              onClick={() => { if (!showCateringGrid) { setShowCateringGrid(true); onCateringTabChange?.(); } else { setShowCateringGrid(false); } }}
              style={{ fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:6, border:`1px solid ${showCateringGrid ? '#22c55e' : 'var(--border2)'}`, background: showCateringGrid ? 'rgba(34,197,94,0.15)' : 'var(--bg2)', color: showCateringGrid ? '#22c55e' : 'var(--muted)', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}
            >
              {showCateringGrid ? '✓ Catering/Meals Grid' : '+ Catering/Meals Grid'}
            </button>
            <button
              onClick={() => { if (!showShotList) { setShowShotList(true); onShotListTabChange?.(); } else { setShowShotList(false); } }}
              style={{ fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:6, border:`1px solid ${showShotList ? '#60a5fa' : 'var(--border2)'}`, background: showShotList ? 'rgba(96,165,250,0.15)' : 'var(--bg2)', color: showShotList ? '#60a5fa' : 'var(--muted)', cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap' }}
            >
              {showShotList ? '✓ Shot List' : '+ Shot List'}
            </button>
          </div>
        </div>
      </div>

      {days.length === 0 && <div className="empty">No shoot days yet — add a day to start building the schedule.</div>}

      {/* Day tabs — sorted by date, day number = index */}
      {days.length > 0 && (
        <div className="day-tabs">
          {[...days].sort((a,b) => (a.date||'').localeCompare(b.date||'')).map((d, i) => (
            <button key={d.id} className={`day-tab${d.id === activeDay ? ' on' : ''}`} onClick={() => { setActiveDay(d.id); }}>
              Day {i + 1} · {parseDay(d.date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}
            </button>
          ))}
        </div>
      )}

      {/* Day detail */}
      {currentDay && (
        <div>
          <div className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: dayCardCollapsed ? 0 : 12 }}>
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
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <select
                  value={currentDay.day_type || 'SHOOT'}
                  onChange={e => saveDayType(currentDay.id, e.target.value)}
                  style={{ fontSize:11, fontWeight:600, padding:'4px 10px', borderRadius:12, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--orange)', cursor:'pointer', appearance:'none', WebkitAppearance:'none' }}
                >
                  {DAY_TYPES.map(dt => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm" onClick={() => setDayCardCollapsed(c => !c)} style={{ color:'var(--muted)', fontSize:11 }}>
                  {dayCardCollapsed ? '▸ Expand' : '▾ Collapse'}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => deleteDay(currentDay.id)}>Delete Day</button>
              </div>
            </div>
            {!dayCardCollapsed && <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:10 }}>
                {[
                  { label:'Call Time', field:'callTime' },
                  { label:'Shooting Call Time', field:'shootingCallTime' },
                  { label:'Lunch', field:'lunchTime' },
                  { label:'Est. Wrap Time', field:'wrapTime' },
                ].map(({ label, field }) => (
                  <div key={field} className="field" style={{ margin:0 }}>
                    <label style={{ fontSize:10 }}>{label}</label>
                    <input type="time"
                      value={dayTimesForm[currentDay.id]?.[field] || ''}
                      onChange={e => setDayTimesForm(m => ({ ...m, [currentDay.id]: { ...m[currentDay.id], [field]: e.target.value } }))}
                      onBlur={e => saveDayTime(currentDay.id, field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                {[
                  { label:'Crew Meal Location', field:'crewLunch' },
                  { label:'Gear Storage', field:'gearStorage' },
                  { label:'GS Audio Contact', field:'gsAudio' },
                ].map(({ label, field }) => (
                  <div key={field} className="field" style={{ margin:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                      <label style={{ fontSize:10, margin:0 }}>{label}</label>
                      {days.length > 1 && (
                        <button type="button"
                          style={{ fontSize:9, padding:'1px 7px', borderRadius:10, border:'1px solid var(--border2)', background:'var(--bg3)', color:'var(--muted)', cursor:'pointer', fontWeight:600, lineHeight:'16px' }}
                          onClick={() => applyMetaToAll(field, dayMeta[currentDay.id]?.[field] || '')}>
                          Apply to All
                        </button>
                      )}
                    </div>
                    <input
                      value={dayMeta[currentDay.id]?.[field] || ''}
                      onChange={e => setDayMeta(m => ({ ...m, [currentDay.id]: { ...m[currentDay.id], [field]: e.target.value } }))}
                      onBlur={e => saveDayMeta(currentDay.id, field, e.target.value)}
                      placeholder="Insert Info"
                    />
                  </div>
                ))}
              </div>
            </>}
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
                        <td style={{ color:'var(--tan)', fontSize:12 }}>{c.crewAssignment.crewMember ? displayName(c.crewAssignment.crewMember) : <span style={{ color:'var(--muted)' }}>Unassigned</span>}</td>
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
                              {c.callTime ? fmtTime(c.callTime) : '—'}
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
            const dayTimes = dayTimesForm[currentDay.id] || {};
            const syntheticItems = [
              dayTimes.callTime         && { _type:'synthetic', _key:'ct',  _sort: timeToMinutes(dayTimes.callTime),         startTime: dayTimes.callTime,         title:'General Call Time', notes: dayTimes.callTimeNotes,     tags: dayTimes.callTimeTags||[] },
              dayTimes.shootingCallTime && { _type:'synthetic', _key:'sct', _sort: timeToMinutes(dayTimes.shootingCallTime), startTime: dayTimes.shootingCallTime, title:'Shooting Call',      notes: dayTimes.shootingCallNotes, tags: dayTimes.shootingCallTags||[] },
              dayTimes.lunchTime        && { _type:'synthetic', _key:'lt',  _sort: timeToMinutes(dayTimes.lunchTime),        startTime: dayTimes.lunchTime,        title:'Lunch',              notes: dayTimes.lunchNotes,        tags: dayTimes.lunchTags||[] },
              dayTimes.wrapTime         && { _type:'synthetic', _key:'wt',  _sort: timeToMinutes(dayTimes.wrapTime),         startTime: dayTimes.wrapTime,         title:'Est. Wrap',          notes: dayTimes.wrapTimeNotes,     tags: dayTimes.wrapTimeTags||[] },
            ].filter(Boolean);
            const previewItems = (showAddEvent && (eventForm.title || eventForm.startTime))
              ? [{ _type:'preview', _sort: timeToMinutes(eventForm.startTime) || 9998, _key:'preview', ...eventForm }]
              : [];
            const cateringItems = (currentDay.catering || [])
              .filter(c => c.meal_type !== 'LUNCH' && (c.name || c.address || c.delivery_time))
              .map(c => ({ _type:'catering', _sort: timeToMinutes(c.delivery_time) || 9997, _key:`cat-${c.id}`, ...c }));
            const lunchCateringRaw = (currentDay.catering || []).find(c => c.meal_type === 'LUNCH');
            const lunchCatering = lunchCateringRaw && (lunchCateringRaw.name || lunchCateringRaw.address || lunchCateringRaw.delivery_time) ? lunchCateringRaw : null;
            // Shot list scenes: only show scenes whose shot list day matches this schedule day by date
            const currentDayISO = currentDay.date?.slice(0, 10);
            const matchingSlDayIds = new Set(
              slDays.filter(sd => slDateToISO(sd.date) === currentDayISO).map(sd => sd.id)
            );
            const sceneItems = shotListScenes
              .filter(s => {
                if (!s.est_start_time) return false;
                return matchingSlDayIds.has(s.day_id);
              })
              .map(s => ({ _type: 'scene', _sort: timeToMinutes(s.est_start_time), _key: `scene-${s.id}`, ...s }));
            const items = [...syntheticItems, ...eventItems, ...flightItems, ...cateringItems, ...previewItems, ...sceneItems].sort((a, b) => a._sort - b._sort);

            return (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div className="sec-lbl" style={{ margin:0 }}>Timeline</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowAddEvent(true)}>+ Add Event</button>
                </div>
                <div style={{ marginTop:10 }}>
                  {items.length === 0 && <div className="empty">No events yet for this day.</div>}
                  <div className="tl">
                    {items.map(item => item._type === 'synthetic' ? (() => {
                      const sm = SYNTHETIC_META[item._key];
                      const isEditing = editingSyntheticKey === item._key;
                      const dt = dayTimesForm[currentDay.id] || {};
                      return (
                        <div key={item._key} className="ev">
                          <div className="ev-time" style={{ color: sm.color }}>{fmtTime(item.startTime)}</div>
                          <div className="ev-body" style={{ borderLeft:`2px solid ${sm.color}`, background: sm.bg, cursor:'pointer' }}
                            onClick={() => setEditingSyntheticKey(isEditing ? null : item._key)}>
                            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                              <div style={{ flex:1 }}>
                                <div className="ev-title" style={{ color: sm.color }}>{item.title}</div>
                                {item.notes && !isEditing && <div className="ev-detail">{item.notes}</div>}
                                {item.tags?.length > 0 && !isEditing && (
                                  <div className="ev-tags" style={{ marginTop:4 }}>
                                    {item.tags.map(t => <span key={t} className={`etag ${TAG_CLASS[t]}`}>{TAG_LABEL[t]}</span>)}
                                  </div>
                                )}
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2, marginLeft:8, flexShrink:0 }}>
                                {!isEditing && dt[sm.locationKey] && (() => {
                                  const loc = (project.locations||[]).find(l => l.id === dt[sm.locationKey]);
                                  return loc ? (
                                    <div style={{ textAlign:'right', marginBottom:4 }}>
                                      <div style={{ fontSize:10, color:'var(--tan)', fontWeight:600 }}>📍 {loc.name}</div>
                                      {loc.address && <div style={{ fontSize:10, color:'var(--muted)' }}>{loc.address}</div>}
                                    </div>
                                  ) : null;
                                })()}
                              {!isEditing && item._key === 'lt' && lunchCatering && (
                                <div style={{ textAlign:'right' }}>
                                  <div style={{ fontSize:10, fontWeight:600, color:'var(--text)' }}>{lunchCatering.name}</div>
                                  {lunchCatering.address && <div style={{ fontSize:10, color:'var(--muted)' }}>{lunchCatering.address}</div>}
                                  {lunchCatering.order_number && <div style={{ fontSize:10, color:'var(--muted)' }}>Order #{lunchCatering.order_number}</div>}
                                  {lunchCatering.delivery_time && <div style={{ fontSize:10, color:'#4ade80' }}>🚚 {fmtTime(lunchCatering.delivery_time)}</div>}
                                </div>
                              )}
                                <span style={{ fontSize:10, color: sm.color, opacity:0.7 }}>{isEditing ? '▲' : '✎'}</span>
                              </div>
                            </div>
                            {isEditing && (
                              <div style={{ marginTop:8 }} onClick={e => e.stopPropagation()}>
                                <textarea
                                  style={{ width:'100%', fontSize:11, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 6px', color:'var(--text)', resize:'vertical', minHeight:48, boxSizing:'border-box' }}
                                  placeholder="Notes…"
                                  value={dt[sm.notesKey]||''}
                                  onChange={e => setDayTimesForm(m => ({ ...m, [currentDay.id]: { ...m[currentDay.id], [sm.notesKey]: e.target.value } }))}
                                />
                                {(project.locations||[]).length > 0 && (
                                  <select
                                    style={{ width:'100%', marginTop:6, fontSize:11, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:4, padding:'4px 6px', color:'var(--text)' }}
                                    value={dt[sm.locationKey]||''}
                                    onChange={e => setDayTimesForm(m => ({ ...m, [currentDay.id]: { ...m[currentDay.id], [sm.locationKey]: e.target.value } }))}>
                                    <option value="">— No location —</option>
                                    {(project.locations||[]).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                                  </select>
                                )}
                                <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap', alignItems:'center' }}>
                                  {['VIDEO','PHOTO'].map(tag => {
                                    const sel = (dt[sm.tagsKey]||[]).includes(tag);
                                    return (
                                      <button key={tag} type="button"
                                        className={`etag ${TAG_CLASS[tag]}`}
                                        style={{ opacity: sel ? 1 : 0.35, cursor:'pointer', padding:'3px 10px' }}
                                        onClick={() => setDayTimesForm(m => {
                                          const cur = m[currentDay.id]?.[sm.tagsKey]||[];
                                          return { ...m, [currentDay.id]: { ...m[currentDay.id], [sm.tagsKey]: sel ? cur.filter(x=>x!==tag) : [...cur, tag] } };
                                        })}>
                                        {TAG_LABEL[tag]}
                                      </button>
                                    );
                                  })}
                                  <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                                    <button className="btn btn-primary btn-sm" onClick={() => saveSyntheticMeta(currentDay.id, item._key)}>Save</button>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingSyntheticKey(null)}>Cancel</button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })() : item._type === 'preview' ? (
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
                    ) : item._type === 'scene' ? (() => {
                      const st = SL_SCENE_STYLES[item.scene_type] || SL_SCENE_STYLES.interior;
                      const wrapTime = slCalcWrap(item.est_start_time, item.shots || []);
                      return (
                        <div key={item._key} className="ev" style={{ cursor: 'pointer' }} onClick={() => onShotListTabChange?.()}>
                          <div className="ev-time" style={{ color: st.color }}>{item.est_start_time}</div>
                          <div className="ev-body" style={{ borderLeft: `2px solid ${st.border}`, background: st.bg, padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: st.color, background: st.badge, border: `1px solid ${st.border}`, borderRadius: 4, padding: '2px 7px', whiteSpace: 'nowrap', letterSpacing: '.08em', flexShrink: 0 }}>
                                  {st.label} · Scene {item.scene_number}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                                {item.description && <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {item.description}</span>}
                                <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: `${st.badge}`, border: `1px solid ${st.border}`, borderRadius: 100, padding: '1px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {item.shots?.length || 0} shots
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                                {wrapTime && (
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Est. Wrap</div>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: st.color, fontVariantNumeric: 'tabular-nums' }}>{wrapTime}</div>
                                  </div>
                                )}
                                <span style={{ fontSize: 10, color: st.color, opacity: 0.6 }}>→ Shot List</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })() : item._type === 'catering' ? (() => {
                      const mc = MEAL_COLORS[item.meal_type] || MEAL_COLORS.BREAKFAST;
                      return (
                        <div key={item._key} className="ev">
                          <div className="ev-time" style={{ color: mc.color }}>{item.delivery_time ? fmtTime(item.delivery_time) : '—'}</div>
                          <div className="ev-body" style={{ borderLeft:`2px solid ${mc.color}`, background: mc.bg }}>
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                              <div className="ev-title" style={{ color: mc.color }}>{mc.emoji} {mc.label}</div>
                              <div style={{ textAlign:'right' }}>
                                {item.name && <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{item.name}</div>}
                                {item.address && <div style={{ fontSize:10, color:'var(--muted)' }}>{item.address}</div>}
                                {item.order_number && <div style={{ fontSize:10, color:'var(--muted)' }}>Order #{item.order_number}</div>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })() : item._type === 'flight' ? (() => {
                      const fs = flightStatusLabel(item);
                      return (
                        <div key={item._key} className="ev">
                          <div className="ev-time">✈ {legDisplayTime(item)}</div>
                          <div className="ev-body" style={{ borderLeft:`2px solid ${fs.alert ? fs.color : 'var(--orange)'}`, ...(fs.alert ? { background:`${fs.color}11` } : {}) }}>
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                              <div>
                                <div className="ev-title" style={fs.alert ? { color:fs.color } : {}}>
                                  {fs.alert && '❗ '}{item._leg === 'depart' ? 'Departure' : 'Arrival'} — {item.crew_name || item.passenger_name}
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
                              {item._leg === 'depart' && (
                                <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0, background:'rgba(0,0,0,0.2)', borderRadius:20, padding:'3px 10px' }}>
                                  {fs.dot && <div style={{ width:6, height:6, borderRadius:'50%', background:fs.dot }} />}
                                  <span style={{ fontSize:10, fontWeight:600, color:fs.color, textTransform:'uppercase', letterSpacing:'.06em' }}>{fs.label}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div key={item.id} className="ev">
                        <div className="ev-time">{fmtTime(item.start_time || item.startTime)}{(item.end_time || item.endTime) ? ` – ${fmtTime(item.end_time || item.endTime)}` : ''}</div>
                        <div className={`ev-body${(item.is_alert||item.isAlert) ? ' warn' : ''}`}
                          style={{ cursor:'pointer', ...(!(item.is_alert||item.isAlert) ? { borderLeft:'2px solid var(--orange)', ...(item.is_filming||item.isFilming ? { background:'linear-gradient(90deg, rgba(255,140,0,0.12) 0%, transparent 100%)', borderRadius:'0 6px 6px 0' } : {}) } : {}) }}
                          onClick={() => openEditEvent(item)}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div className={`ev-title${(item.is_alert||item.isAlert) ? ' alert' : ''}`} style={(item.is_filming||item.isFilming) ? { color:'var(--orange)' } : {}}>{(item.is_alert||item.isAlert) ? '⚠ ' : ''}{(item.is_filming||item.isFilming) ? '🎬 ' : ''}{item.title}</div>
                              {item.detail && <div className="ev-detail">{item.detail}</div>}
                              {item.tags?.length > 0 && (
                                <div className="ev-tags">
                                  {item.tags.map(t => <span key={t.id} className={`etag ${TAG_CLASS[t.type]}`}>{TAG_LABEL[t.type]}</span>)}
                                </div>
                              )}
                            </div>
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                              {item.room_space && (
                                <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', whiteSpace:'nowrap' }}>
                                  <span style={{ fontWeight:400, color:'var(--muted)', fontSize:11 }}>Room/Space: </span>{item.room_space}
                                </div>
                              )}
                              {item.location && (
                                <div style={{ textAlign:'right' }}>
                                  <div style={{ fontSize:10, color:'var(--tan)', fontWeight:600 }}>📍 {item.location.name}</div>
                                  {item.location.address && <div style={{ fontSize:10, color:'var(--muted)' }}>{item.location.address}</div>}
                                </div>
                              )}
                              <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }}
                                onClick={e => { e.stopPropagation(); deleteEvent(item.id); }}>✕</button>
                            </div>
                          </div>
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
                <div className="field span2"><label>Date</label><input type="date" value={dayForm.date} onChange={e => setDayForm(f=>({...f,date:e.target.value}))} required autoFocus /></div>
                <div className="field span2"><label>Notes</label><input value={dayForm.notes} onChange={e => setDayForm(f=>({...f,notes:e.target.value}))} placeholder="Long day" /></div>
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
                <div className="field span2" style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <button type="button" onClick={() => setEventForm(f=>({...f,isFilming:!f.isFilming}))}
                    style={{ padding:'5px 14px', borderRadius:6, border: eventForm.isFilming ? '1.5px solid var(--orange)' : '1px solid var(--border)', background: eventForm.isFilming ? 'rgba(255,140,0,0.15)' : 'transparent', color: eventForm.isFilming ? 'var(--orange)' : 'var(--muted)', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'.04em', textTransform:'uppercase' }}>
                    Filming
                  </button>
                </div>
                <div className="field"><label>Start Time</label><input type="time" value={eventForm.startTime} onChange={e => setEventForm(f=>({...f,startTime:e.target.value}))} required /></div>
                <div className="field"><label>End Time</label><input type="time" value={eventForm.endTime} onChange={e => setEventForm(f=>({...f,endTime:e.target.value}))} /></div>
                <div className="field span2"><label>Title</label><input value={eventForm.title} onChange={e => setEventForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Room / Space</label><input value={eventForm.roomSpace} onChange={e => setEventForm(f=>({...f,roomSpace:e.target.value}))} placeholder="Ballroom 3" /></div>
                <div className="field"><label>Detail / Notes</label><textarea value={eventForm.detail} onChange={e => setEventForm(f=>({...f,detail:e.target.value}))} /></div>
                <div className="field span2">
                  <label>Location</label>
                  {(project.locations||[]).length === 0
                    ? <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', paddingTop:4 }}>No locations added yet — add them in the Overview tab.</div>
                    : <select value={eventForm.locationId} onChange={e => setEventForm(f=>({...f,locationId:e.target.value}))}>
                        <option value="">— No location —</option>
                        {(project.locations||[]).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                  }
                </div>
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
                  {eventForm.tags.some(t=>t.type==='TALENT') && keyTalent.length > 0 && (
                    <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                      {keyTalent.map(t => {
                        const sel = eventForm.audience.includes(t.name);
                        return (
                          <button key={t.id} type="button"
                            style={{ fontSize:11, padding:'3px 10px', borderRadius:12, border:'1px solid var(--orange)', background: sel ? 'var(--orange)' : 'transparent', color: sel ? '#fff' : 'var(--orange)', cursor:'pointer', fontWeight:600 }}
                            onClick={() => setEventForm(f => ({ ...f, audience: sel ? f.audience.filter(n=>n!==t.name) : [...f.audience, t.name] }))}>
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
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

      {/* Catering Modal */}
      {cateringModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setCateringModal(null)}>
          <div className="modal">
            <div className="modal-title">Add Catering Info</div>
            <form onSubmit={saveCatering}>
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)', marginBottom:8 }}>Meal(s)</div>
                <div style={{ display:'flex', gap:10 }}>
                  {['BREAKFAST','LUNCH','DINNER'].map(mt => {
                    const mc = MEAL_COLORS[mt];
                    const sel = cateringForm.mealTypes.includes(mt);
                    return (
                      <button key={mt} type="button"
                        onClick={() => toggleMealType(mt)}
                        style={{ flex:1, padding:'8px 6px', borderRadius:8, border:`2px solid ${sel ? mc.color : 'var(--border)'}`, background: sel ? mc.bg : 'var(--bg)', color: sel ? mc.color : 'var(--muted)', fontWeight:700, fontSize:12, cursor:'pointer', transition:'all .12s' }}>
                        {mc.emoji} {mc.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Name of Catering / Restaurant</label><input value={cateringForm.name} onChange={e => setCateringForm(f=>({...f,name:e.target.value}))} placeholder="Catering Co." /></div>
                <div className="field span2"><label>Address</label><input value={cateringForm.address} onChange={e => setCateringForm(f=>({...f,address:e.target.value}))} placeholder="123 Main St" /></div>
                <div className="field"><label>Order Number</label><input value={cateringForm.orderNumber} onChange={e => setCateringForm(f=>({...f,orderNumber:e.target.value}))} placeholder="#12345" /></div>
                <div className="field"><label>Est. Delivery Time</label><input type="time" value={cateringForm.deliveryTime} onChange={e => setCateringForm(f=>({...f,deliveryTime:e.target.value}))} /></div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary" type="submit">Save Catering</button>
                <button type="button" className="btn btn-ghost" onClick={() => setCateringModal(null)}>Cancel</button>
              </div>
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
                <div className="field span2" style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <button type="button" onClick={() => setEditEventForm(f=>({...f,isFilming:!f.isFilming}))}
                    style={{ padding:'5px 14px', borderRadius:6, border: editEventForm.isFilming ? '1.5px solid var(--orange)' : '1px solid var(--border)', background: editEventForm.isFilming ? 'rgba(255,140,0,0.15)' : 'transparent', color: editEventForm.isFilming ? 'var(--orange)' : 'var(--muted)', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'.04em', textTransform:'uppercase' }}>
                    Filming
                  </button>
                </div>
                <div className="field"><label>Start Time</label><input type="time" value={editEventForm.startTime} onChange={e => setEditEventForm(f=>({...f,startTime:e.target.value}))} required /></div>
                <div className="field"><label>End Time</label><input type="time" value={editEventForm.endTime} onChange={e => setEditEventForm(f=>({...f,endTime:e.target.value}))} /></div>
                <div className="field span2"><label>Title</label><input value={editEventForm.title} onChange={e => setEditEventForm(f=>({...f,title:e.target.value}))} required /></div>
                <div className="field"><label>Room / Space</label><input value={editEventForm.roomSpace} onChange={e => setEditEventForm(f=>({...f,roomSpace:e.target.value}))} placeholder="Ballroom 3" /></div>
                <div className="field"><label>Detail / Notes</label><textarea value={editEventForm.detail} onChange={e => setEditEventForm(f=>({...f,detail:e.target.value}))} /></div>
                <div className="field span2">
                  <label>Location</label>
                  {(project.locations||[]).length === 0
                    ? <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic', paddingTop:4 }}>No locations added yet — add them in the Overview tab.</div>
                    : <select value={editEventForm.locationId} onChange={e => setEditEventForm(f=>({...f,locationId:e.target.value}))}>
                        <option value="">— No location —</option>
                        {(project.locations||[]).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                  }
                </div>
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
                  {editEventForm.tags.some(t=>t.type==='TALENT') && keyTalent.length > 0 && (
                    <div style={{ marginTop:8, display:'flex', gap:6, flexWrap:'wrap' }}>
                      {keyTalent.map(t => {
                        const sel = editEventForm.audience.includes(t.name);
                        return (
                          <button key={t.id} type="button"
                            style={{ fontSize:11, padding:'3px 10px', borderRadius:12, border:'1px solid var(--orange)', background: sel ? 'var(--orange)' : 'transparent', color: sel ? '#fff' : 'var(--orange)', cursor:'pointer', fontWeight:600 }}
                            onClick={() => setEditEventForm(f => ({ ...f, audience: sel ? f.audience.filter(n=>n!==t.name) : [...f.audience, t.name] }))}>
                            {t.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
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
