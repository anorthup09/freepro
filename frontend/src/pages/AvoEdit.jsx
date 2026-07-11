import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { maybeMailNotice } from '../utils/mailNotice.js';
import { AvoHeader, EditorSelect, AVO, AVO_STATUSES, fmtV, stepV, VersionInput } from './Avo.jsx';
import { MILESTONES, milestoneText, milestoneRunners } from '../components/GanttChart.jsx';

const lbl = { fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4, display:'block' };
const KIND_STYLE = {
  comment: { border:`1px solid var(--border)`, background:'var(--bg2)' },
  rfr: { border:'1px solid rgba(230,194,41,0.5)', background:'rgba(230,194,41,0.06)' },
  sent: { border:'1px solid rgba(74,158,255,0.5)', background:'rgba(74,158,255,0.06)' },
};
const CATEGORIES = ['Event Recap', 'Opener', 'Sizzle', 'Interstitial', 'Documentary', 'Teaser', 'Social Cutdown', 'Photo Slideshow', 'Other'];

// Milestones that are the lead editor's deliverables — tagged with their name
// and fed to the Crew Calendar
export const EDITOR_TASKS = ['icr_v1_due', 'client_v1_due', 'client_v2_due', 'client_v3_due', 'color_audio_send', 'final_comp'];

// ── Timeline date math (business-day aware) ──
const addDaysStr = (dstr, n, skipWknd) => {
  const dt = new Date(dstr + 'T12:00:00');
  let left = n;
  while (left > 0) {
    dt.setDate(dt.getDate() + 1);
    if (!skipWknd || (dt.getDay() !== 0 && dt.getDay() !== 6)) left--;
  }
  return dt.toISOString().slice(0, 10);
};
const daysBetween = (a, b, skipWknd) => {
  let c = 0;
  const dt = new Date(a + 'T12:00:00'), end = new Date(b + 'T12:00:00');
  if (end <= dt) return 0;
  while (dt < end) {
    dt.setDate(dt.getDate() + 1);
    if (!skipWknd || (dt.getDay() !== 0 && dt.getDay() !== 6)) c++;
  }
  return c;
};
const fmtLongD = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });

// ── Month-calendar view of the timeline: runners span consecutive milestones ──
function MilestoneCalendarModal({ edit, onClose }) {
  const ms = edit.milestones || {};
  const filled = MILESTONES.filter(([k]) => ms[k]);
  const segs = milestoneRunners(edit);
  const first = filled.length ? new Date(ms[filled[0][0]] + 'T12:00:00') : new Date();
  const [month, setMonth] = useState({ y: first.getFullYear(), m: first.getMonth() });

  const d0 = new Date(month.y, month.m, 1, 12);
  const label = d0.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysIn = new Date(month.y, month.m + 1, 0).getDate();
  // Build week rows (Sunday-start)
  const weeks = [];
  let cur = new Date(month.y, month.m, 1 - d0.getDay(), 12);
  while (cur <= new Date(month.y, month.m, daysIn, 12)) {
    weeks.push(new Date(cur));
    cur = new Date(cur.getTime() + 7 * 86400000);
  }
  const dd = s => new Date(s + 'T12:00:00');
  const diff = (a, b) => Math.round((b - a) / 86400000);
  const today = new Date(); today.setHours(12, 0, 0, 0);
  // Same plane logic as the Gantt: runners butt at the shared milestone day
  // (drawn center-of-day to center-of-day) and share one lane; only truly
  // overlapping runners stack onto a lane above.
  const laneOf = []; const laneEnd = [];
  segs.forEach((sg, i) => {
    let l = 0;
    while (laneEnd[l] != null && dd(sg.from) < laneEnd[l]) l++;
    laneOf[i] = l; laneEnd[l] = dd(sg.to);
  });

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px', width:'100%', maxWidth:760, maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:12, flexWrap:'wrap' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>📅 {edit.title} — Timeline</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setMonth(({ y, m }) => m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 })}>‹</button>
            <div style={{ fontSize:13, fontWeight:800, minWidth:130, textAlign:'center' }}>{label}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setMonth(({ y, m }) => m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 })}>›</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        {!segs.length && <div className="empty">Fill in at least two timeline dates to see runners here.</div>}
        <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', borderBottom:'1px solid var(--border)' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} style={{ textAlign:'center', padding:'5px 0', fontSize:9, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{d}</div>
            ))}
          </div>
          {weeks.map((ws, wi) => {
            // bars overlapping this week; alternate lanes so touching runners don't collide
            const bars = segs.map((s, i) => ({ ...s, idx: i })).filter(s => diff(ws, dd(s.to)) >= 0 && diff(ws, dd(s.from)) <= 6);
            const lanes = Math.max(1, ...bars.map(b => laneOf[b.idx] + 1));
            return (
              <div key={wi} style={{ position:'relative', height: 30 + lanes * 18, borderBottom: wi < weeks.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(ws.getTime() + i * 86400000);
                  const inMonth = d.getMonth() === month.m;
                  const isToday = d.getTime() === today.getTime();
                  return (
                    <div key={i} style={{ position:'absolute', left:`${(i / 7) * 100}%`, width:`${100 / 7}%`, top:0, bottom:0, borderLeft: i ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isToday ? 'rgba(232,80,10,0.06)' : 'transparent' }}>
                      <div style={{ fontSize:10, fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--orange)' : inMonth ? 'var(--text)' : 'rgba(255,255,255,0.18)', padding:'4px 6px' }}>{d.getDate()}</div>
                    </div>
                  );
                })}
                {bars.map(b => {
                  const s = Math.max(0, diff(ws, dd(b.from)));
                  const e2 = Math.min(6, diff(ws, dd(b.to)));
                  const startsHere = diff(ws, dd(b.from)) >= 0;
                  const endsHere = diff(ws, dd(b.to)) <= 6;
                  const lane = laneOf[b.idx];
                  // center-of-day endpoints: back-to-back runners split the shared day
                  const L = s + (startsHere ? 0.5 : 0);
                  const R = e2 + (endsHere ? 0.5 : 1);
                  return (
                    <div key={b.idx} title={`${b.title}: ${b.from} → ${b.to}`}
                      style={{
                        position:'absolute', top: 24 + lane * 18, height:15,
                        left:`calc(${(L / 7) * 100}% + 1px)`, width:`calc(${((R - L) / 7) * 100}% - 3px)`,
                        background:`${b.color}30`, border:`1px solid ${b.color}`,
                        borderRadius: `${startsHere ? 8 : 0}px ${endsHere ? 8 : 0}px ${endsHere ? 8 : 0}px ${startsHere ? 8 : 0}px`,
                        display:'flex', alignItems:'center', justifyContent:'flex-end', padding:'0 6px', overflow:'hidden',
                        fontSize:8.5, fontWeight:800, color:b.color, whiteSpace:'nowrap',
                      }}>
                      {endsHere ? b.label : ''}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:10 }}>
          {segs.map((s, i) => (
            <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:9, color:'var(--muted)' }}>
              <span style={{ width:10, height:10, borderRadius:3, background:`${s.color}30`, border:`1px solid ${s.color}` }} />
              {s.title}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Currency input: displays $x,xxx.xx, switches to a raw number while editing
function MoneyField({ value, onCommit }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const fmt = v => (v === null || v === undefined || v === '') ? '' :
    '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <input
      value={editing ? raw : fmt(value)}
      placeholder="$0.00"
      onFocus={() => { setRaw(value === null || value === undefined ? '' : String(value)); setEditing(true); }}
      onChange={ev => setRaw(ev.target.value)}
      onBlur={() => {
        setEditing(false);
        const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
        onCommit(Number.isFinite(n) ? n : null);
      }} />
  );
}

// Runs of more than 3 consecutive log lines auto-collapse in the feed
function groupActivity(activity) {
  const out = [];
  let run = [];
  const flush = () => {
    if (run.length > 3) out.push({ group: true, key: run[0].id, logs: run });
    else out.push(...run);
    run = [];
  };
  for (const a of activity) {
    if (a.kind === 'log') run.push(a);
    else { flush(); out.push(a); }
  }
  flush();
  return out;
}

function CollapsedLogs({ logs, renderLog }) {
  const [open, setOpen] = useState(false);
  const authors = [...new Set(logs.map(a => a.author).filter(Boolean))];
  if (open) return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {logs.map(renderLog)}
      <button onClick={() => setOpen(false)}
        style={{ background:'none', border:'none', color:'var(--muted)', fontSize:10, fontWeight:700, cursor:'pointer', textAlign:'left', padding:0 }}>
        ▾ Collapse {logs.length} changes
      </button>
    </div>
  );
  return (
    <button onClick={() => setOpen(true)} title="Click to expand"
      style={{ background:'none', border:'none', color:'var(--muted)', fontSize:10, cursor:'pointer', textAlign:'left', padding:0, display:'flex', justifyContent:'space-between', gap:10, width:'100%' }}>
      <span style={{ fontWeight:700 }}>▸ {logs.length} changes{authors.length === 1 ? ` by ${authors[0]}` : ''}</span>
      <span style={{ whiteSpace:'nowrap' }}>{fmtDT(logs[logs.length - 1].created_at)}</span>
    </button>
  );
}

function TimelineShareModal({ edit, onClose }) {
  const tableRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const rows = MILESTONES.filter(([k]) => edit.milestones?.[k]);
  async function copy() {
    const html = '<meta charset="utf-8">' + tableRef.current.outerHTML;
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([milestoneText(edit)], { type: 'text/plain' }),
      })]);
    } catch {
      const range = document.createRange();
      range.selectNode(tableRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
      document.execCommand('copy'); sel.removeAllRanges();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const tdw = { border:'1px solid #999', padding:'9px 14px', fontSize:14, color:'#111' };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={ev => ev.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'20px 22px', width:'100%', maxWidth:620, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>Timeline — {edit.title}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={copy}
              style={{ background: copied ? AVO : `${AVO}26`, border:`1px solid ${AVO}`, color: copied ? '#0b0b0b' : AVO, borderRadius:20, padding:'5px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ background:'#fff', borderRadius:8, padding:14, overflowX:'auto' }}>
          <table ref={tableRef} style={{ borderCollapse:'collapse', width:'100%', background:'#ffffff', fontFamily:'Arial, sans-serif' }}>
            <thead>
              <tr>
                <td style={{ ...tdw, fontWeight:'bold' }}>Milestone</td>
                <td style={{ ...tdw, fontWeight:'bold' }}>Date</td>
              </tr>
            </thead>
            <tbody>
              {edit.start_date && (
                <tr>
                  <td style={{ ...tdw, fontWeight:'bold' }}>Edit Window</td>
                  <td style={tdw}>{fmtLongD(String(edit.start_date).slice(0, 10))} – {fmtLongD(String(edit.end_date || edit.start_date).slice(0, 10))}</td>
                </tr>
              )}
              {rows.map(([k, label]) => (
                <tr key={k}>
                  <td style={{ ...tdw, fontWeight:'bold' }}>{label}</td>
                  <td style={tdw}>{fmtLongD(edit.milestones[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const fmtDT = d => new Date(d).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });

// Copy the timeline dates from another edit on the same project
function CopyTimelineFrom({ edit, onCopied, save }) {
  const [options, setOptions] = useState(null);
  const base = (edit.project_code || '').replace(/-\d+$/, '');
  useEffect(() => {
    if (!edit.project_code) { setOptions([]); return; }
    api.avoEdits().then(all => {
      setOptions(all.filter(x => x.id !== edit.id
        && x.project_code && x.project_code.replace(/-\d+$/, '') === base
        && Object.values(parseMs(x.milestones)).some(Boolean)));
    }).catch(() => setOptions([]));
  }, [edit.id, edit.project_code]);
  function parseMsLocal(v) { return typeof v === 'string' ? JSON.parse(v || '{}') : (v || {}); }
  if (!options || options.length === 0) return null;
  return (
    <select value="" title="Copy the timeline dates from another edit on this project"
      onChange={ev => {
        const src = options.find(x => x.id === ev.target.value);
        if (!src) return;
        if (!confirm(`Copy the timeline dates from "${src.title}"? This overwrites this edit's dates.`)) return;
        const srcMs = parseMsLocal(src.milestones);
        // Full replace: every milestone key is sent (empty clears leftovers)
        const payload = Object.fromEntries(MILESTONES.map(([k]) => [k, srcMs[k] || '']));
        const clean = Object.fromEntries(Object.entries(srcMs).filter(([, v]) => v));
        const skips = Array.isArray(src.milestone_skips) ? src.milestone_skips : [];
        onCopied(clean, skips);
        save({ milestones: payload, milestoneSkips: skips });
      }}
      style={{ width:'auto', maxWidth:170, fontSize:11, flexShrink:0, border:`1px solid ${AVO}55`, borderRadius:14, color:AVO, background:'transparent', padding:'4px 8px' }}>
      <option value="">Copy Timeline From…</option>
      {options.map(x => <option key={x.id} value={x.id}>{x.title}</option>)}
    </select>
  );
}
const parseMs = v => typeof v === 'string' ? JSON.parse(v || '{}') : (v || {});

export default function AvoEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [e, setE] = useState(null);
  const [comment, setComment] = useState('');
  const [showTimeline, setShowTimeline] = useState(false);
  const [copied, setCopied] = useState('');
  const [shareTimeline, setShareTimeline] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [ptoFlagOpen, setPtoFlagOpen] = useState(null);   // milestone key with the PTO-conflict pop-out open
  const [projectPageId, setProjectPageId] = useState(null);   // Avo project page for this edit's code
  // Auto-fill knobs (defaults: business days, 2-day client reviews)
  const [tlOpts, setTlOpts] = useState({ skipWknd: true, editDaysAfterScript: 5, editDaysAfterFeedback: 3, reviewDays: 2 });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const feedRef = useRef(null);

  const load = () => api.avoEdit(id).then(setE).catch(err => alert(err.message));
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    const code = e?.project_code;
    if (!code) { setProjectPageId(null); return; }
    api.avoProjectByCode(code).then(pg => setProjectPageId(pg.id)).catch(() => setProjectPageId(null));
  }, [e?.project_code]);
  useEffect(() => { if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }, [e?.activity?.length]);

  if (!e) return <div style={{ minHeight:'100vh', background:'var(--bg)' }}><AvoHeader /><div className="empty">Loading…</div></div>;

  const patch = fields => setE(v => ({ ...v, ...fields }));
  const save = data => api.updateAvoEdit(id, data).then(full => setE(v => ({ ...v, ...full }))).catch(err => alert(err.message));

  async function post() {
    if (!comment.trim() || busy) return;
    setBusy(true);
    try { const activity = await api.avoComment(id, comment); setE(v => ({ ...v, activity })); setComment(''); }
    catch (err) { alert(err.message); }
    setBusy(false);
  }

  async function action(fn) {
    setBusy(true);
    try { const activity = await fn(); setE(v => ({ ...v, activity })); } catch (err) { alert(err.message); }
    setBusy(false);
  }

  // Push the contract editor's cost estimate onto the project VCC as a HOLD
  async function holdCost() {
    if (busy) return;
    setBusy(true);
    try {
      const entry = await api.holdEditCost(id);
      const full = await api.avoEdit(id);
      setE(full);
      alert(`Held $${Number(entry.amount).toLocaleString('en-US')} on the project's VCC for the contract editor.`);
    } catch (err) { alert(err.message); }
    setBusy(false);
  }

  function upload(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return alert('File too large (20MB max)');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api.avoUploadFile(id, { filename: file.name, mime: file.type, fileBase64: String(reader.result).split(',')[1] });
        load();
      } catch (err) { alert(err.message); }
    };
    reader.readAsDataURL(file);
  }

  const field = (label, key, apiKey, type = 'text') => (
    <div style={{ flex:1, minWidth:150 }}>
      <span style={lbl}>{label}</span>
      <input type={type} value={type === 'date' ? (e[key] ? String(e[key]).slice(0, 10) : '') : (e[key] || '')}
        onChange={ev => patch({ [key]: ev.target.value })}
        onBlur={ev => save({ [apiKey]: ev.target.value })} />
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <AvoHeader />
      <div style={{ maxWidth:1250, margin:'0 auto', padding:'6px 16px 80px' }}>
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          {projectPageId && (
            <button className="btn btn-ghost btn-sm" onClick={() => nav(`/avo/project/${projectPageId}`)}>‹ Back to Project</button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/avo')}>Full Pipeline — All Projects</button>
        </div>
        <div className="ae-cols" style={{ display:'flex', gap:18, flexWrap:'wrap', alignItems:'flex-start' }}>

          {/* ── Left: details ── */}
          <div style={{ flex:'1 1 480px', minWidth:320 }}>
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${AVO}`, borderRadius:12, padding:'18px 20px' }}>
              <div className="ae-titlebar" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <input value={e.title || ''} onChange={ev => patch({ title: ev.target.value })} onBlur={ev => save({ title: ev.target.value })}
                  style={{ fontSize:18, fontWeight:800, background:'transparent', border:'1px solid transparent', borderRadius:6, padding:'4px 8px', flex:'1 1 200px', minWidth:0 }} />
                <CopyTimelineFrom edit={e} onCopied={(ms, skips) => { patch({ milestones: ms, milestone_skips: skips }); }} save={save} />
                <button onClick={() => setShowCal(true)} title="Calendar view of the timeline dates"
                  style={{ background:'transparent', border:`1px solid ${AVO}55`, color:AVO, borderRadius:14, padding:'4px 10px', fontSize:12, cursor:'pointer', flexShrink:0 }}>
                  📅
                </button>
                <div style={{ display:'flex', border:`1px solid ${AVO}55`, borderRadius:14, overflow:'hidden', flexShrink:0 }}>
                  {[['details', 'Details'], ['timeline', 'Timeline']].map(([v, label]) => (
                    <button key={v} onClick={() => setShowTimeline(v === 'timeline')}
                      style={{ background: (v === 'timeline') === showTimeline ? `${AVO}2e` : 'transparent', border:'none', color: (v === 'timeline') === showTimeline ? AVO : 'var(--muted)', padding:'4px 12px', fontSize:10, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {shareTimeline && <TimelineShareModal edit={e} onClose={() => setShareTimeline(false)} />}
      {showCal && <MilestoneCalendarModal edit={e} onClose={() => setShowCal(false)} />}
      {showTimeline && (() => {
                const ms = e.milestones || {};
                const skips = Array.isArray(e.milestone_skips) ? e.milestone_skips : [];
                const toggleSkip = (k) => {
                  const next = skips.includes(k) ? skips.filter(x => x !== k) : [...skips, k];
                  if (!skips.includes(k) && ms[k]) {
                    patch({ milestone_skips: next, milestones: { ...ms, [k]: undefined } });
                    save({ milestoneSkips: next, milestones: { [k]: '' } });
                  } else {
                    patch({ milestone_skips: next });
                    save({ milestoneSkips: next });
                  }
                };
                const setOpt = (k, v) => setTlOpts(o => ({ ...o, [k]: v }));
                function autoFill() {
                  const end = ms.scripting_end;
                  if (!end) return alert('Set a Creative/Scripting Complete date first — the auto-fill builds forward from it.');
                  const { skipWknd, editDaysAfterScript, editDaysAfterFeedback, reviewDays } = tlOpts;
                  const next = { ...ms };
                  let cur = end;
                  // Skipped milestones are left out and the chain continues without them
                  const step = (key, days) => {
                    if (skips.includes(key)) { delete next[key]; return; }
                    cur = next[key] = addDaysStr(cur, days, skipWknd);
                  };
                  step('icr_v1_due', Number(editDaysAfterScript) || 0);
                  step('icr_feedback', Number(reviewDays) || 0);
                  for (const v of ['v1', 'v2', 'v3']) {
                    step(`client_${v}_due`, Number(editDaysAfterFeedback) || 0);
                    step(`client_${v}_feedback`, Number(reviewDays) || 0);
                  }
                  step('color_audio_send', Number(editDaysAfterFeedback) || 0);
                  step('color_audio_complete', 3);
                  step('final_comp', 2);
                  step('final_delivery', 1);
                  patch({ milestones: next });
                  save({ milestones: next });
                }
                // gap column: business days since the previous filled milestone
                let prevDate = null;
                const optIn = { width:44, fontSize:11, padding:'4px 6px', textAlign:'center' };
                const optLbl = { fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.05em' };
                return (
                <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px', marginTop:10 }}>
                  {/* auto-fill controls */}
                  <div style={{ display:'flex', alignItems:'flex-end', gap:8, flexWrap:'nowrap', padding:'2px 0 10px', borderBottom:'1px solid var(--border)', marginBottom:10 }}>
                    <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, cursor:'pointer', paddingBottom:6 }}>
                      <input type="checkbox" checked={tlOpts.skipWknd} onChange={ev => setOpt('skipWknd', ev.target.checked)} style={{ width:'auto', accentColor:AVO }} />
                      Exclude weekends
                    </label>
                    <div><div style={optLbl}>Edit days after script</div><input value={tlOpts.editDaysAfterScript} onChange={ev => setOpt('editDaysAfterScript', ev.target.value)} style={optIn} /></div>
                    <div><div style={optLbl}>Edit days after feedback</div><input value={tlOpts.editDaysAfterFeedback} onChange={ev => setOpt('editDaysAfterFeedback', ev.target.value)} style={optIn} /></div>
                    <div><div style={optLbl}>Client review days</div><input value={tlOpts.reviewDays} onChange={ev => setOpt('reviewDays', ev.target.value)} style={optIn} /></div>
                    <div style={{ flex:1 }} />
                    <button onClick={autoFill} title="Fill every milestone forward from Creative/Scripting Complete (color & audio 3 days, final comp +2, delivery +1)"
                      style={{ background:AVO, border:`1px solid ${AVO}`, color:'#0b0b0b', borderRadius:14, padding:'5px 12px', fontSize:10.5, fontWeight:800, cursor:'pointer', marginBottom:2, whiteSpace:'nowrap', flexShrink:0 }}>
                      ⚡ Auto-Fill
                    </button>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                    <span style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:AVO }}>Timeline Dates</span>
                    <div style={{ display:'flex', gap:6 }}>
                      <button className="btn btn-ghost btn-sm" title="Copy a public link showing these dates and the Gantt"
                        onClick={async () => {
                          try {
                            const { token } = await api.avoGanttShare('edit', id);
                            const url = `${window.location.origin}/gantt/${token}`;
                            await navigator.clipboard.writeText(url).catch(() => {});
                            window.open(url, '_blank');
                            setCopied('link'); setTimeout(() => setCopied(''), 2500);
                          } catch (err) { alert(err.message); }
                        }}>{copied === 'link' ? '✓ Link Copied' : 'Share Public Timeline'}</button>
                      <button className="btn btn-ghost btn-sm" title="Preview and copy the filled-in dates as an email-ready table"
                        onClick={() => setShareTimeline(true)}>Copy for Email</button>
                    </div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column' }}>
                    {MILESTONES.map(([k, label]) => {
                      const skipped = skips.includes(k);
                      const val = skipped ? null : ms[k];
                      let gap = null;
                      if (val && prevDate) gap = daysBetween(prevDate, val, tlOpts.skipWknd);
                      if (val) prevDate = val;
                      return (
                        <div key={k} style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 0', borderBottom:'1px solid rgba(255,255,255,0.04)', opacity: skipped ? 0.45 : 1 }}>
                          <span style={{ ...lbl, marginBottom:0, flex:1, textDecoration: skipped ? 'line-through' : 'none' }}>
                            {label}
                          </span>
                          {(() => {
                            const hits = (!skipped && val) ? (e.pto_conflicts || []).filter(c => String(c.start_date).slice(0,10) <= val && String(c.end_date).slice(0,10) >= val) : [];
                            if (!hits.length) return <span style={{ width:16, flexShrink:0 }} />;
                            return (
                              <span style={{ position:'relative', flexShrink:0 }}>
                                <button type="button" title="The lead editor has PTO / OOO on this date — click for details"
                                  onClick={() => setPtoFlagOpen(o => o === k ? null : k)}
                                  style={{ background:'rgba(224,49,49,0.15)', border:'1px solid #E03131', color:'#E03131',
                                    borderRadius:'50%', width:16, height:16, lineHeight:'13px', fontSize:10, fontWeight:900, cursor:'pointer', padding:0, display:'block' }}>!</button>
                                {ptoFlagOpen === k && (
                                  <span style={{ position:'absolute', top:20, left:0, zIndex:50, display:'block', background:'var(--bg2)', border:'1px solid #E03131',
                                    borderRadius:8, padding:'10px 14px', minWidth:250, boxShadow:'0 6px 20px rgba(0,0,0,0.4)', whiteSpace:'normal', textAlign:'left' }}>
                                    <span style={{ display:'block', fontSize:11, fontWeight:800, color:'#E03131', marginBottom:6 }}>
                                      ⚠ {e.lead_editor_name_resolved || e.lead_editor_name || 'The lead editor'} is unavailable on this date
                                    </span>
                                    {hits.map(c => (
                                      <span key={c.id} style={{ display:'block', fontSize:11.5, color:'var(--text)', padding:'4px 0', borderTop:'1px solid var(--border)' }}>
                                        <b>{c.pto_type || 'PTO'}</b>{c.title ? ` — ${c.title}` : ''}<br />
                                        <span style={{ color:'var(--muted)' }}>
                                          {String(c.start_date).slice(0,10)} → {String(c.end_date).slice(0,10)} · {c.status === 'APPROVED' ? 'Approved' : c.status === 'REVIEW' ? 'Pending approval' : c.status}
                                        </span>
                                      </span>
                                    ))}
                                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop:8, fontSize:10 }} onClick={() => setPtoFlagOpen(null)}>Close</button>
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                          <span title="Who's responsible for this task — shows on the Crew Calendar"
                            style={{ display:'inline-block', width:140, flexShrink:0 }}>
                            {EDITOR_TASKS.includes(k) && (
                              <EditorSelect value={e.milestone_assignees?.[k] || ''}
                                placeholder={e.lead_editor_name_resolved || e.lead_editor_name || 'Lead Editor'}
                                onChange={v => {
                                  patch({ milestone_assignees: { ...(e.milestone_assignees || {}), [k]: v || undefined } });
                                  save({ milestoneAssignees: { [k]: v } });
                                }} />
                            )}
                          </span>
                          <button type="button" onClick={() => toggleSkip(k)}
                            title={skipped ? 'Bring this milestone back into the timeline' : 'Skip this milestone — the timeline continues without it'}
                            style={{ flexShrink:0, background: skipped ? 'rgba(224,82,82,0.15)' : 'none', border:`1px solid ${skipped ? '#e05252' : 'var(--border)'}`, color: skipped ? '#e05252' : 'var(--muted)', borderRadius:10, padding:'1px 7px', fontSize:8.5, fontWeight:800, cursor:'pointer' }}>
                            {skipped ? 'Skipped ✕' : 'Skip'}
                          </button>
                          {skipped
                            ? <span style={{ width:'auto', minWidth:120, maxWidth:190, textAlign:'center', fontSize:10, color:'var(--muted)', fontStyle:'italic' }}>— skipped —</span>
                            : <input type="date" value={val || ''} style={{ width:'auto', maxWidth:190 }}
                                onChange={ev => {
                                  const v = ev.target.value;
                                  patch({ milestones: { ...ms, [k]: v || undefined } });
                                  save({ milestones: { [k]: v } });
                                }} />}
                          <span title="Time since the previous milestone"
                            style={{ flexShrink:0, width:46, fontSize:9, fontWeight:800, color:AVO, whiteSpace:'nowrap' }}>
                            {gap != null ? `${gap} Day${gap === 1 ? '' : 's'}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginTop:10, flexWrap:'wrap' }}>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>These dates appear as diamonds on the Gantt views; the public link and email copy only show dates that are filled in.</div>
                    <button onClick={() => {
                        if (!confirm('Clear all timeline dates?')) return;
                        const cleared = Object.fromEntries(MILESTONES.map(([k]) => [k, '']));
                        patch({ milestones: {} });
                        save({ milestones: cleared });
                      }}
                      style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--red-text, #e05252)', borderRadius:14, padding:'4px 12px', fontSize:10, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
                      Clear Dates
                    </button>
                  </div>
                </div>
                );
              })()}
              {!showTimeline && <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12 }}>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Status</span>
                    <select value={e.status} onChange={ev => { patch({ status: ev.target.value }); save({ status: ev.target.value }); }}>
                      {AVO_STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </div>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Version</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button className="btn btn-ghost btn-sm" title="Version down 0.1"
                        onClick={() => save({ version: stepV(e.version, -1) })}>−.1</button>
                      <span style={{ fontSize:16 }}>
                        <VersionInput value={e.version} onSave={n => save({ version: n })} style={{ width:44 }} />
                      </span>
                      <button className="btn btn-ghost btn-sm" title="Version up 0.1"
                        onClick={() => save({ version: stepV(e.version, 1) })}>+.1</button>
                    </div>
                  </div>
                  <div style={{ flex:1, minWidth:120 }}>
                    <span style={lbl}>Approved</span>
                    <button onClick={() => { const next = !e.approved; save({ approved: next }); if (next) maybeMailNotice("The approval email to the lead editor"); }}
                      style={{ background: e.approved ? 'rgba(90,191,128,0.15)' : 'transparent', border:`1px solid ${e.approved ? '#5ABF80' : 'var(--border)'}`,
                        color: e.approved ? '#5ABF80' : 'var(--muted)', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                      {e.approved ? '✓ Approved' : 'Not Approved'}
                    </button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {field('Project Code', 'project_code', 'projectCode')}
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Lead Editor</span>
                    <EditorSelect value={e.lead_editor_id} onChange={v => { patch({ lead_editor_id: v }); save({ leadEditorId: v }); }} />
                  </div>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Project Manager</span>
                    <EditorSelect value={e.pm_id} unbridledOnly onChange={v => { patch({ pm_id: v }); save({ pmId: v }); }} placeholder="— No PM —" />
                  </div>
                </div>
                <div>
                  <span style={lbl}>Description</span>
                  <textarea value={e.description || ''} style={{ minHeight:70 }}
                    onChange={ev => patch({ description: ev.target.value })}
                    onBlur={ev => save({ description: ev.target.value })} />
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {field('Aspect Ratio', 'aspect_ratio', 'aspectRatio')}
                  {field('Resolution', 'resolution', 'resolution')}
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Category</span>
                    <select value={e.category || ''} onChange={ev => { patch({ category: ev.target.value }); save({ category: ev.target.value }); }}>
                      <option value="">—</option>
                      {e.category && !CATEGORIES.includes(e.category) && <option value={e.category}>{e.category}</option>}
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  {field('Drive', 'drive', 'drive')}
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {field('Asset Ref', 'asset_ref', 'assetRef')}
                  {field('Music Ref', 'music_ref', 'musicRef')}
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'flex-end' }}>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Contract Editor Cost</span>
                    <MoneyField value={e.cost_estimate} onCommit={v => { patch({ cost_estimate: v }); save({ costEstimate: v }); }} />
                  </div>
                  <div style={{ flex:1, minWidth:150 }}>
                    <span style={lbl}>Hold to VCC</span>
                    <button disabled={busy || !(Number(e.cost_estimate) > 0)} onClick={holdCost}
                      title={!(e.project_id) ? 'Link this edit to a project code first' : Number(e.cost_estimate) > 0 ? 'Post this editor cost to the project VCC as a hold' : 'Enter a cost first'}
                      style={{ width:'100%', background:'rgba(90,191,128,0.12)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:8, padding:'8px 14px', fontSize:12, fontWeight:800, cursor: (busy || !(Number(e.cost_estimate) > 0)) ? 'default' : 'pointer', opacity: (busy || !(Number(e.cost_estimate) > 0)) ? 0.5 : 1 }}>
                      Hold Cost → VCC
                    </button>
                  </div>
                </div>
                <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                  {field('Start Date', 'start_date', 'startDate', 'date')}
                  {field('Due Date', 'end_date', 'endDate', 'date')}
                </div>
                <div>
                  <span style={lbl}>Current Review Link</span>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                    <input value={e.review_link || ''} style={{ flex:1, minWidth:200 }}
                      onChange={ev => patch({ review_link: ev.target.value })}
                      onBlur={ev => save({ reviewLink: ev.target.value })} />
                    {e.review_link && <a className="btn btn-ghost btn-sm" href={e.review_link} target="_blank" rel="noreferrer" style={{ textDecoration:'none' }}>▶ Open</a>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button disabled={busy} onClick={() => action(() => api.avoRfr(id))}
                    style={{ background:'rgba(230,194,41,0.12)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'6px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                    RFR — Ready For Review
                  </button>
                  <button disabled={busy} onClick={() => action(() => api.avoSent(id))}
                    style={{ background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:20, padding:'6px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
                    Sent to Client
                  </button>
                </div>
              </div>}
            </div>

            {/* ── Uploads ── */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 20px', marginTop:16 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div style={{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:AVO }}>Uploads</div>
                <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>+ Upload File</button>
                <input ref={fileRef} type="file" style={{ display:'none' }} onChange={upload} />
              </div>
              {(e.files || []).length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Drop creative briefs, music, logos, photos, clips here (20MB max each).</div>}
              {(e.files || []).map(f => (
                <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <a href={`/api/avo/files/${f.id}`} onClick={async ev => {
                    ev.preventDefault();
                    const r = await fetch(`/api/avo/files/${f.id}`, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
                    const blob = await r.blob();
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob); a.download = f.filename; a.click(); URL.revokeObjectURL(a.href);
                  }} style={{ color:'#4a9eff', fontSize:12, flex:1 }}>📎 {f.filename}</a>
                  <span style={{ fontSize:10, color:'var(--muted)' }}>{(f.size / 1024 / 1024).toFixed(1)}MB · {f.uploaded_by}</span>
                  <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }}
                    onClick={async () => { if (confirm(`Delete ${f.filename}?`)) { await api.avoDeleteFile(f.id); load(); } }}>✕</button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: activity — jumps to the top when the layout stacks ── */}
          <div className="ae-activity" style={{ flex:'1 1 380px', minWidth:300, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, display:'flex', flexDirection:'column', maxHeight:'80vh' }}>
            <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em' }}>Activity</div>
            <div ref={feedRef} style={{ flex:1, overflowY:'auto', padding:'12px 18px', display:'flex', flexDirection:'column', gap:8 }}>
              {groupActivity(e.activity || []).map(item => item.group ? (
                <CollapsedLogs key={item.key} logs={item.logs} renderLog={a => (
                  <div key={a.id} style={{ fontSize:10, color:'var(--muted)', display:'flex', justifyContent:'space-between', gap:10 }}>
                    <span>• {a.author && a.author !== 'system' ? `${a.author} ` : ''}{a.body}</span>
                    <span style={{ whiteSpace:'nowrap' }}>{fmtDT(a.created_at)}</span>
                  </div>
                )} />
              ) : item.kind === 'log' ? (() => { const a = item; return (
                <div key={a.id} style={{ fontSize:10, color:'var(--muted)', display:'flex', justifyContent:'space-between', gap:10 }}>
                  <span>• {a.author && a.author !== 'system' ? `${a.author} ` : ''}{a.body}</span>
                  <span style={{ whiteSpace:'nowrap' }}>{fmtDT(a.created_at)}</span>
                </div>
              ); })() : (() => { const a = item; return (
                <div key={a.id} style={{ ...KIND_STYLE[a.kind] || KIND_STYLE.comment, borderRadius:10, padding:'8px 12px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:10, marginBottom:3 }}>
                    <span style={{ fontSize:10, fontWeight:700, color: a.kind === 'rfr' ? '#e6c229' : a.kind === 'sent' ? '#4a9eff' : AVO }}>
                      {a.kind === 'rfr' ? '⚑ ' : a.kind === 'sent' ? '➤ ' : ''}{a.author}
                    </span>
                    <span style={{ fontSize:9, color:'var(--muted)', whiteSpace:'nowrap' }}>{fmtDT(a.created_at)}</span>
                  </div>
                  <div style={{ fontSize:12, whiteSpace:'pre-wrap' }}>{a.body}</div>
                </div>
              ); })())}
              {(e.activity || []).length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No activity yet.</div>}
            </div>
            <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)' }}>
              <textarea value={comment} placeholder="Write a comment… @Name to email someone"
                style={{ minHeight:52, marginBottom:8 }}
                onChange={ev => setComment(ev.target.value)}
                onKeyDown={ev => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) post(); }} />
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button disabled={!comment.trim() || busy} onClick={post}
                  style={{ background: comment.trim() ? AVO : 'var(--border)', color:'#0b0b0b', border:'none', borderRadius:8, padding:'7px 18px', fontSize:12, fontWeight:800, cursor: comment.trim() ? 'pointer' : 'default' }}>
                  Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
