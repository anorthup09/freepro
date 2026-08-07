import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import { NewProjectModal } from './Finance.jsx';
import { recentProjectTimes } from '../utils/recentProjects.js';
import { moneyConfetti } from '../lib/confetti.js';
import { GongIcon } from './Avo.jsx';

const TILES = [
  {
    key: 'profi',
    title: 'ProFi',
    tagline: 'Project Finance · In High Fidelity',
    desc: 'Client-ready budgets, vendor cost control, and final reconciliation — mixed and mastered.',
    accent: '#c8873c',
    icon: '$',
    to: '/finance',
    status: null,
  },
  {
    key: 'freepro',
    title: 'FreePro',
    em: true,
    tagline: 'Production Management',
    desc: 'Call sheets, schedules, crew, travel, gear, shot lists, and client views.',
    accent: 'var(--orange)',
    icon: '🎬',
    to: '/projects',
    status: null,
  },
  {
    key: 'avo',
    title: 'AvocadoPost',
    tagline: 'Post-Production Management',
    desc: 'Edit pipelines, review & approval, versioning, and delivery.',
    accent: '#a89a86',
    icon: '🥑',
    to: '/avo',
    status: null,
  },
  {
    key: 'team',
    title: 'Team Management',
    tagline: 'People Operations',
    desc: 'PTO & OOO requests, approvals, and team availability.',
    accent: '#8a8f98',
    icon: '👥',
    to: '/team',
    status: null,
  },
];

export const STATUS_COLORS = {
  RFP: '#e6c229', Draft: 'var(--muted)', Sent: '#4a9eff', Live: '#5ABF80', Dead: '#e05252', Reconcile: '#9DC183', Reconciled: '#9DC183', Closed: '#8a8f98',
};

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// One fun, personal line per user per day — replaces the plain username
export function HubGreeting() {
  const [text, setText] = useState('');
  useEffect(() => { api.hubGreeting().then(r => setText(r.text || '')).catch(() => {}); }, []);
  if (!text) return null;
  // The heading now says "Hey <name>," so drop a duplicate greeting prefix.
  let t = text.replace(/^\s*hey\s+[^,:.!]+[,:]\s*/i, '');
  t = t ? t.charAt(0).toUpperCase() + t.slice(1) : text;
  return <span>{t}</span>;
}

// On the road today? Offer a one-tap jump to the public view for your role —
// producer view for admin/producers/agency, crew view for crew accounts
export function TripPrompt() {
  const [trip, setTrip] = useState(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => { api.onTrip().then(setTrip).catch(() => {}); }, []);
  if (!trip || hidden) return null;
  const dismissKey = `fp_trip_prompt_${trip.project.id}_${new Date().toDateString()}`;
  if (localStorage.getItem(dismissKey)) return null;
  const viewLabel = trip.viewType === 'crew' ? 'Crew View' : 'Producer View';
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, flexWrap:'wrap',
      background:'rgba(232,80,10,0.10)', border:'1px solid rgba(232,80,10,0.45)', borderRadius:12,
      padding:'12px 18px', margin:'0 auto 16px', maxWidth:620 }}>
      <div style={{ fontSize:13, minWidth:0 }}>
        <span style={{ fontWeight:800 }}>🎬 You're on the road — {trip.project.code} {trip.project.title}</span>
        {(() => {
          const loc = [trip.project.city, trip.project.state]
            .map(s => String(s || '').trim())
            .filter(s => s && /[A-Za-z]/.test(s))
            .join(', ');
          return loc ? <span style={{ color:'var(--muted)' }}> · {loc}</span> : null;
        })()}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <a href={`/share/${trip.token}`}
          style={{ background:'var(--orange)', color:'var(--text)', textDecoration:'none', fontSize:12, fontWeight:800,
            padding:'7px 16px', borderRadius:20, letterSpacing:'.02em', whiteSpace:'nowrap' }}>
          Open {viewLabel} →
        </a>
        <button onClick={() => { localStorage.setItem(dismissKey, '1'); setHidden(true); }}
          title="Hide for today"
          style={{ background:'none', border:'none', color:'var(--muted)', fontSize:14, cursor:'pointer', padding:2 }}>✕</button>
      </div>
    </div>
  );
}

// MediaMoment weekly prompt. Two flavors:
//  - fact: your fun question of the week (skippable)
//  - wob:  "Ways of Being" shoutout — two people get this each week, and it
//    is NOT skippable: it comes back every visit until submitted.
function FunFactPrompt() {
  const [p, setP] = useState(null);
  const [answer, setAnswer] = useState('');
  const [who, setWho] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.funFactPrompt().then(r => {
      if (r.answered) return;
      if (r.kind !== 'wob' && localStorage.getItem('fp_funfact_wk') === r.week) return;
      setP(r);
    }).catch(() => {});
  }, []);
  if (!p) return null;
  const isWob = p.kind === 'wob';
  // Fun questions can be snoozed for the week; a Ways of Being just hides
  // until the next visit — it doesn't go away until it's written.
  const close = () => { if (!isWob) localStorage.setItem('fp_funfact_wk', p.week); setP(null); };
  async function submit() {
    if (saving) return;
    if (isWob) {
      if (!answer.trim() || !who) return;
      const member = (p.team || []).find(t => t.email === who);
      setSaving(true);
      try { await api.submitWob({ recipientEmail: who, recipientName: member?.name || who, text: answer.trim() }); setP(null); }
      catch (e) { alert(e.message); setSaving(false); }
      return;
    }
    if (!answer.trim()) return;
    setSaving(true);
    try { await api.submitFunFact(answer.trim()); close(); }
    catch (e) { alert(e.message); setSaving(false); }
  }
  return (
    <div onClick={e => e.target === e.currentTarget && close()}
      style={{ position:'fixed', inset:0, zIndex:210, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:440, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid var(--orange)', borderRadius:14, padding:'22px 24px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.12em', color:'var(--orange)' }}>{isWob ? 'WAYS OF BEING' : 'MEDIAMOMENT'}</div>
          <button className="btn btn-ghost btn-sm" onClick={close}>✕</button>
        </div>
        <div style={{ fontSize:16, fontWeight:800, margin:'12px 0 4px', lineHeight:1.35 }}>{p.prompt}</div>
        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>
          {isWob
            ? "You're one of two people chosen this week. Your shoutout lands on their hub and joins the MediaMoment rotation — this one can't be skipped."
            : "Your question of the week — your answer shows up in the team's daily MediaMoment."}
        </div>
        {isWob && (
          <select value={who} onChange={e => setWho(e.target.value)} style={{ width:'100%', fontSize:13, marginBottom:8 }}>
            <option value="">— Who went above and beyond? —</option>
            {(p.team || []).map(t => <option key={t.email} value={t.email}>{t.name}</option>)}
          </select>
        )}
        <textarea value={answer} onChange={e => setAnswer(e.target.value)} autoFocus
          placeholder={isWob ? 'What did they do? Make them blush…' : 'Spill it…'} style={{ width:'100%', minHeight:64, fontSize:13 }} />
        <div style={{ display:'flex', justifyContent: isWob ? 'flex-end' : 'space-between', marginTop:12 }}>
          {!isWob && <button className="btn btn-ghost btn-sm" onClick={close}>Maybe next week</button>}
          <button className="btn btn-primary btn-sm" disabled={!answer.trim() || (isWob && !who) || saving} onClick={submit}>
            {saving ? 'Saving…' : isWob ? 'Send the shoutout' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Shoutouts about YOU land on your hub — gold banner under the greeting
function WobBanner() {
  const [wobs, setWobs] = useState([]);
  useEffect(() => { api.myWobs().then(setWobs).catch(() => {}); }, []);
  if (!wobs.length) return null;
  const w = wobs[0];
  return (
    <div style={{ maxWidth:640, margin:'0 auto 16px', background:'linear-gradient(120deg, rgba(232,80,10,0.16), rgba(247,181,45,0.14))',
      border:'1px solid rgba(247,181,45,0.5)', borderRadius:14, padding:'14px 20px', textAlign:'center' }}>
      <div style={{ fontSize:10, fontWeight:900, letterSpacing:'0.16em', color:'#f7b52d' }}>🏆 WAYS OF BEING — SOMEONE NOTICED</div>
      <div style={{ fontSize:14, fontWeight:700, lineHeight:1.45, margin:'6px 0 4px' }}>“{w.text}”</div>
      <div style={{ fontSize:11, color:'var(--muted)' }}>— {w.giver_name}{wobs.length > 1 ? ` · +${wobs.length - 1} more this month` : ''}</div>
    </div>
  );
}

// Daily fun-fact blob: takes over the Team Today card once per day
function DailyFactBlob() {
  const [fact, setFact] = useState(null);
  useEffect(() => {
    const today = new Date().toDateString();
    if (localStorage.getItem('fp_funfact_day') === today) return;
    api.funFactToday().then(f => {
      if (f) { setFact(f); localStorage.setItem('fp_funfact_day', today); }
    }).catch(() => {});
  }, []);
  if (!fact) return null;
  return (
    <div style={{ position:'absolute', inset:0, zIndex:6, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(10,10,8,0.6)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)', borderRadius:12 }}>
      <button onClick={() => setFact(null)} aria-label="Close"
        style={{ position:'absolute', top:12, right:14, zIndex:2, background:'rgba(0,0,0,0.4)', border:'1px solid rgba(255,255,255,0.25)', color:'#fff', width:28, height:28, borderRadius:'50%', fontSize:13, fontWeight:900, cursor:'pointer', lineHeight:1 }}>✕</button>
      <div className="fun-blob" style={{ position:'relative', overflow:'hidden', width:'min(94%, 440px)', minHeight:210, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, padding:'34px 40px', textAlign:'center' }}>
        {/* Faint visual of whatever the answer is about — extra spice */}
        {fact.image?.type === 'photo' && (
          <img src={fact.image.value} alt="" aria-hidden
            style={{ position:'absolute', top:0, right:0, bottom:0, width:'58%', height:'100%', objectFit:'cover', opacity:0.4, pointerEvents:'none',
              WebkitMaskImage:'linear-gradient(to right, transparent, #000 65%)', maskImage:'linear-gradient(to right, transparent, #000 65%)' }} />
        )}
        {fact.image?.type === 'emoji' && (
          <div aria-hidden style={{ position:'absolute', top:0, right:0, bottom:0, width:'55%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:170, opacity:0.2, pointerEvents:'none', transform:'rotate(-8deg)',
            WebkitMaskImage:'linear-gradient(to right, transparent, #000 60%)', maskImage:'linear-gradient(to right, transparent, #000 60%)' }}>
            {fact.image.value}
          </div>
        )}
        <div style={{ fontSize:10, fontWeight:900, letterSpacing:'0.18em', color:'rgba(255,255,255,0.85)', position:'relative' }}>{fact.kind === 'wob' ? 'WAYS OF BEING' : 'MEDIAMOMENT'}</div>
        <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.9)', marginTop:4 }}>{fact.prompt}</div>
        <div style={{ fontFamily:"'Syne', sans-serif", fontSize:19, fontWeight:800, color:'#fff', lineHeight:1.3, textShadow:'0 2px 10px rgba(0,0,0,0.35)' }}>
          “{fact.answer}”
        </div>
        <div style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,0.92)', marginTop:2 }}>— {fact.name}</div>
      </div>
    </div>
  );
}

// The team roster as a ring of dots with the day's MediaMoment in the center.
// Full dot = in office, shrunk = out; orange = St. Louis, gray = Denver.
// Closing the moment spins the ring and parades the dots up into a row.
function MediaMomentOrbit() {
  const [fact, setFact] = useState(undefined); // undefined = loading, null = none
  const [intro, setIntro] = useState(false);   // Netflix-style logo reveal
  const started = React.useRef(false);
  useEffect(() => {
    api.funFactToday().then(f => setFact(f || null)).catch(() => setFact(null));
  }, []);
  // Play the logo intro once per session, once the moment has loaded
  useEffect(() => {
    if (fact === undefined || started.current) return;
    started.current = true;
    if (!fact) return;
    let played;
    try { played = sessionStorage.getItem('mm_intro_played'); } catch {}
    if (played) return;
    try { sessionStorage.setItem('mm_intro_played', '1'); } catch {}
    setIntro(true);
    const t = setTimeout(() => setIntro(false), 2700);
    return () => clearTimeout(t);
  }, [fact]);
  if (fact === undefined || !fact) return null;   // loading or no moment → hide
  const isWob = fact.kind === 'wob';
  return (
    <div className="mm-wrap">
      <div className="mm-banner">
        {fact.image?.type === 'photo' && <div className="mm-photo" style={{ backgroundImage:`url("${fact.image.value}")` }} aria-hidden />}
        <div className="mm-b-main">
          <div className="mm-kicker">{isWob ? 'WAYS OF BEING' : 'MEDIAMOMENT'}</div>
          {fact.prompt && <div className="mm-prompt">{fact.prompt}</div>}
          <div className="mm-answer">“{fact.answer}”</div>
          <div className="mm-name">— {fact.name}</div>
        </div>
      </div>
      {intro && (
        <div className="mm-intro" aria-hidden>
          <div className="mm-logo">
            <img className="mm-logo-word" src="/unbridled-logo.png" alt="" />
            <img className="mm-logo-ap" src="/unbridled-logo.png" alt="" />
          </div>
        </div>
      )}
    </div>
  );
}

function fmtCloseMonth(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 15).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function FeedbackBoard({ variant = 'banner' }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState(null);   // base64 image queued for the next comment
  const [viewer, setViewer] = useState(null);           // full-size attachment being viewed
  const [replyFor, setReplyFor] = useState(null);       // feedback item id with the reply box open
  const [replyText, setReplyText] = useState('');
  const [replyAttachment, setReplyAttachment] = useState(null); // photo queued for the answer being written
  const [editReply, setEditReply] = useState(null);     // { itemId, idx, text, attachment } while editing an answer
  const [editItem, setEditItem] = useState(null);       // { id, text, attachment } while editing a question
  function readImage(file, cb) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => cb(ev.target.result);
    reader.readAsDataURL(file);
  }
  async function saveReplyEdit() {
    if (!editReply || (!editReply.text.trim() && !editReply.attachment)) return;
    try {
      const u = await api.editFeedbackReply(editReply.itemId, editReply.idx, editReply.text.trim(), editReply.attachment ?? null);
      setItems(xs => xs.map(x => x.id === editReply.itemId ? u : x));
      setEditReply(null);
    } catch (e) { alert(e.message); }
  }
  async function saveItemEdit() {
    if (!editItem || (!editItem.text.trim() && !editItem.attachment)) return;
    try {
      const u = await api.updateFeedback(editItem.id, { text: editItem.text.trim(), attachment: editItem.attachment ?? null });
      setItems(xs => xs.map(x => x.id === editItem.id ? u : x));
      setEditItem(null);
    } catch (e) { alert(e.message); }
  }
  async function sendReply(id) {
    if (!replyText.trim() && !replyAttachment) return;
    try {
      const u = await api.replyFeedback(id, replyText.trim(), replyAttachment);
      setItems(xs => xs.map(x => x.id === id ? u : x));
      setReplyFor(null); setReplyText(''); setReplyAttachment(null);
    } catch (e) { alert(e.message); }
  }
  const load = () => api.feedbackList().then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);
  async function toggle() {
    if (!open) await load();
    setOpen(o => !o);
  }
  async function add() {
    if (!text.trim()) return;
    try { const i = await api.addFeedback(text.trim(), attachment); setItems(xs => [i, ...xs]); setText(''); setAttachment(null); }
    catch (e) { alert(e.message); }
  }
  function pickAttachment(file) { readImage(file, setAttachment); }
  const openCount = items.filter(i => !i.done).length;
  return (
    <>
      {variant === 'banner' ? (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, padding:'14px 16px 0' }}>
          <button onClick={toggle}
            style={{ background:'#e05252', border:'2px solid #ff6b6b', color:'var(--text)', borderRadius:12, padding:'10px 26px', fontSize:14, fontWeight:900, letterSpacing:'0.03em', cursor:'pointer', boxShadow:'0 4px 18px rgba(224,82,82,0.35)' }}>
            ! Testing - Feedback and Features !
          </button>
          {openCount > 0 && (
            <span onClick={toggle} title={`${openCount} unresolved item${openCount === 1 ? '' : 's'}`}
              style={{ background:'#e05252', color:'var(--text)', borderRadius:'50%', minWidth:26, height:26, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, cursor:'pointer', boxShadow:'0 2px 10px rgba(224,82,82,0.5)', padding:'0 6px' }}>
              {openCount}
            </span>
          )}
        </div>
      ) : (
        <span className="no-print fb-fab" style={{ position:'fixed', bottom:'calc(env(safe-area-inset-bottom, 0px) + 14px)', left:14, zIndex:125 }}>
          <span className="fb-fab-label" style={{ position:'absolute', bottom:'calc(100% + 8px)', left:0, background:'#e05252', color:'var(--text)',
            borderRadius:8, padding:'3px 10px', fontSize:10, fontWeight:900, letterSpacing:'0.03em', whiteSpace:'nowrap',
            opacity:0, pointerEvents:'none', transform:'translateY(4px)', transition:'opacity .18s ease, transform .18s ease' }}>
            Feedback
          </span>
          <button onClick={toggle} title="Testing — leave feedback or a feature request" aria-label="Feedback"
            style={{ width:36, height:36, borderRadius:'50%', background:'#e05252', border:'1px solid #ff6b6b', color:'var(--text)',
              fontSize: openCount > 0 ? 13 : 14, fontWeight:900, cursor:'pointer', boxShadow:'0 3px 12px rgba(224,82,82,0.5)',
              display:'flex', alignItems:'center', justifyContent:'center', padding:0 }}>
            {openCount > 0 ? openCount : 'F'}
          </button>
        </span>
      )}
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:130, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column', background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #e05252', borderRadius:12, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:14, fontWeight:800 }}>Testing — Feedback & Features <span style={{ color:'var(--muted)', fontWeight:400 }}>· {openCount} open</span></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div style={{ padding:'10px 18px', borderBottom:'1px solid var(--border)', fontSize:11, color:'var(--muted)', lineHeight:1.55 }}>
              If you have feedback or features, drop individual notes here — this little red button follows you across the platform.
              <b style={{ color:'var(--text)' }}> If you run into issues or bugs, please report immediately to Alex Northup to repair.</b> Your
              timely and honest feedback helps this project improve and succeed.
            </div>
            <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center' }}>
              <input value={text} placeholder="Add feedback or a feature request…" onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && add()} style={{ flex:1 }} />
              <label title="Attach a screenshot" className="btn btn-ghost btn-sm" style={{ whiteSpace:'nowrap', cursor:'pointer', margin:0 }}>
                {attachment ? '✓ Attached' : '+ Attachment'}
                <input type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => { pickAttachment(e.target.files[0]); e.target.value = ''; }} />
              </label>
              {attachment && (
                <img src={attachment} alt="attachment preview" title="Click to remove" onClick={() => setAttachment(null)}
                  style={{ height:34, width:48, objectFit:'cover', borderRadius:5, border:'1px solid var(--border)', cursor:'pointer' }} />
              )}
              <button onClick={add} disabled={!text.trim()}
                style={{ background:'#e05252', border:'none', color:'var(--text)', borderRadius:8, padding:'7px 16px', fontSize:12, fontWeight:800, cursor:'pointer', opacity: text.trim() ? 1 : 0.5 }}>
                Add
              </button>
            </div>
            <div style={{ overflowY:'auto', padding:'6px 18px 14px' }}>
              {items.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', padding:'12px 0' }}>Nothing yet — this is the one running list for testing feedback and feature requests.</div>}
              {items.map(i => (
                <div key={i.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', opacity: i.done ? 0.6 : 1 }}>
                  <input type="checkbox" checked={i.done || false} style={{ width:'auto', accentColor:'#5ABF80', marginTop:2 }}
                    onChange={async e => {
                      try { const u = await api.updateFeedback(i.id, { done: e.target.checked }); setItems(xs => xs.map(x => x.id === i.id ? u : x)); }
                      catch (er) { alert(er.message); }
                    }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    {editItem?.id === i.id ? (
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                          <input value={editItem.text} autoFocus onChange={e => setEditItem(v => ({ ...v, text: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && saveItemEdit()} style={{ flex:1, minWidth:140, fontSize:13 }} />
                          <label className="btn btn-ghost btn-sm" title="Add or change the photo" style={{ whiteSpace:'nowrap', cursor:'pointer', margin:0 }}>
                            {editItem.attachment ? '✓ Photo' : '+ Photo'}
                            <input type="file" accept="image/*" style={{ display:'none' }}
                              onChange={e => { readImage(e.target.files[0], v => setEditItem(x => ({ ...x, attachment: v }))); e.target.value = ''; }} />
                          </label>
                          <button onClick={saveItemEdit}
                            style={{ background:'#e05252', border:'none', color:'var(--text)', borderRadius:8, padding:'5px 12px', fontSize:11, fontWeight:800, cursor:'pointer' }}>Save</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditItem(null)}>✕</button>
                        </div>
                        {editItem.attachment && (
                          <img src={editItem.attachment} alt="photo" title="Click to remove photo" onClick={() => setEditItem(x => ({ ...x, attachment: null }))}
                            style={{ height:40, width:56, objectFit:'cover', borderRadius:5, border:'1px solid var(--border)', cursor:'pointer' }} />
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize:13, fontWeight:600, color: i.done ? '#5ABF80' : 'var(--text)', overflowWrap:'anywhere' }}>{i.text}</div>
                    )}
                    <div style={{ fontSize:10, color:'var(--muted)' }}>
                      {i.created_by || 'someone'} · {new Date(i.created_at).toLocaleDateString('en-US', { month:'numeric', day:'numeric' })}
                      <button onClick={() => { setReplyFor(r => r === i.id ? null : i.id); setReplyText(''); setReplyAttachment(null); }}
                        style={{ background:'none', border:'none', color:'var(--tan)', fontSize:10, fontWeight:800, cursor:'pointer', marginLeft:8, padding:0 }}>
                        {replyFor === i.id ? 'Cancel' : 'Reply'}
                      </button>
                      <button title="Edit this question / add a photo" onClick={() => setEditItem(editItem?.id === i.id ? null : { id: i.id, text: i.text, attachment: i.attachment || null })}
                        style={{ background:'none', border:'none', color:'var(--tan)', fontSize:10, fontWeight:800, cursor:'pointer', marginLeft:8, padding:0 }}>
                        {editItem?.id === i.id ? 'Cancel Edit' : '✎ Edit'}
                      </button>
                    </div>
                    {(Array.isArray(i.replies) ? i.replies : []).map((r, ri) => (
                      <div key={ri} style={{ marginTop:6, marginLeft:2, paddingLeft:10, borderLeft:'2px solid rgba(224,82,82,0.4)' }}>
                        {editReply && editReply.itemId === i.id && editReply.idx === ri ? (
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                            <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                              <input value={editReply.text} autoFocus
                                onChange={e => setEditReply(er => ({ ...er, text: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && saveReplyEdit()}
                                style={{ flex:1, minWidth:120, fontSize:12 }} />
                              <label className="btn btn-ghost btn-sm" title="Add or change the photo" style={{ whiteSpace:'nowrap', cursor:'pointer', margin:0 }}>
                                {editReply.attachment ? '✓ Photo' : '+ Photo'}
                                <input type="file" accept="image/*" style={{ display:'none' }}
                                  onChange={e => { readImage(e.target.files[0], v => setEditReply(er => ({ ...er, attachment: v }))); e.target.value = ''; }} />
                              </label>
                              <button onClick={saveReplyEdit} disabled={!editReply.text.trim() && !editReply.attachment}
                                style={{ background:'#e05252', border:'none', color:'var(--text)', borderRadius:8, padding:'5px 12px', fontSize:11, fontWeight:800, cursor:'pointer', opacity: (editReply.text.trim() || editReply.attachment) ? 1 : 0.5 }}>Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setEditReply(null)}>✕</button>
                            </div>
                            {editReply.attachment && (
                              <img src={editReply.attachment} alt="answer photo" title="Click to remove photo" onClick={() => setEditReply(er => ({ ...er, attachment: null }))}
                                style={{ height:36, width:52, objectFit:'cover', borderRadius:5, border:'1px solid var(--border)', cursor:'pointer' }} />
                            )}
                          </div>
                        ) : (
                          <>
                            {r.text && <div style={{ fontSize:12, overflowWrap:'anywhere' }}>{r.text}</div>}
                            {r.attachment && (
                              <img src={r.attachment} alt="answer photo" title="Click to view full size" onClick={() => setViewer(r.attachment)}
                                style={{ marginTop:4, height:40, width:56, objectFit:'cover', borderRadius:5, border:'1px solid var(--border)', cursor:'pointer' }} />
                            )}
                            <div style={{ fontSize:9.5, color:'var(--muted)' }}>
                              {r.by} · {new Date(r.at).toLocaleDateString('en-US', { month:'numeric', day:'numeric' })}{r.edited_at ? ' · edited' : ''}
                              <button title="Edit this answer" onClick={() => setEditReply({ itemId: i.id, idx: ri, text: r.text, attachment: r.attachment || null })}
                                style={{ background:'none', border:'none', color:'var(--tan)', fontSize:10, fontWeight:800, cursor:'pointer', marginLeft:8, padding:0 }}>✎ Edit</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    {replyFor === i.id && (
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginTop:8 }}>
                        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                          <input value={replyText} autoFocus placeholder="Write an answer…"
                            onChange={e => setReplyText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendReply(i.id)}
                            style={{ flex:1, minWidth:120, fontSize:12 }} />
                          <label className="btn btn-ghost btn-sm" title="Attach a photo to your answer" style={{ whiteSpace:'nowrap', cursor:'pointer', margin:0 }}>
                            {replyAttachment ? '✓ Photo' : '+ Photo'}
                            <input type="file" accept="image/*" style={{ display:'none' }}
                              onChange={e => { readImage(e.target.files[0], setReplyAttachment); e.target.value = ''; }} />
                          </label>
                          <button onClick={() => sendReply(i.id)} disabled={!replyText.trim() && !replyAttachment}
                            style={{ background:'#e05252', border:'none', color:'var(--text)', borderRadius:8, padding:'5px 12px', fontSize:11, fontWeight:800, cursor:'pointer', opacity: (replyText.trim() || replyAttachment) ? 1 : 0.5 }}>
                            Answer
                          </button>
                        </div>
                        {replyAttachment && (
                          <img src={replyAttachment} alt="answer photo" title="Click to remove photo" onClick={() => setReplyAttachment(null)}
                            style={{ height:36, width:52, objectFit:'cover', borderRadius:5, border:'1px solid var(--border)', cursor:'pointer' }} />
                        )}
                      </div>
                    )}
                  </div>
                  {i.attachment && (
                    <img src={i.attachment} alt="attachment" title="Click to view full size"
                      onClick={() => setViewer(i.attachment)}
                      style={{ height:44, width:64, objectFit:'cover', borderRadius:6, border:'1px solid var(--border)', cursor:'pointer', flexShrink:0 }} />
                  )}
                  <button title="Delete" onClick={async () => {
                    if (!confirm('Delete this item?')) return;
                    try { await api.deleteFeedback(i.id); setItems(xs => xs.filter(x => x.id !== i.id)); }
                    catch (er) { alert(er.message); }
                  }} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:12, cursor:'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {viewer && (
        <div onClick={() => setViewer(null)}
          style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, cursor:'zoom-out' }}>
          <img src={viewer} alt="attachment full size" style={{ maxWidth:'92vw', maxHeight:'90vh', borderRadius:8, boxShadow:'0 12px 40px rgba(0,0,0,0.6)' }} />
        </div>
      )}
    </>
  );
}

// Admin-only red flag in the Hub header when signups are awaiting a role
function NewUserAlert({ onOpen }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    api.getUsers().then(us => setCount(us.filter(u => u.role === 'PENDING').length)).catch(() => {});
  }, []);
  if (!count) return null;
  return (
    <button onClick={onOpen}
      title={`${count} pending signup${count === 1 ? '' : 's'} awaiting approval`}
      style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#e05252', border:'1px solid #ff6b6b', color:'var(--text)', borderRadius:20, padding:'5px 13px', fontSize:11, fontWeight:900, letterSpacing:'0.02em', cursor:'pointer', boxShadow:'0 2px 10px rgba(224,82,82,0.4)' }}>
      (!) New User{count > 1 ? `s · ${count}` : ''}
    </button>
  );
}

function UserManagement({ user }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    api.getUsers().then(us => setPendingCount(us.filter(u => u.role === 'PENDING').length)).catch(() => {});
  }, []);
  const ROLES = ['PENDING', 'CREW', 'AGENCY', 'FINANCE', 'PRODUCER', 'ADMIN'];
  const inviteBlurb = `You're invited to the Unbridled Operating Platform — budgets, call sheets, schedules, and post-production in one place.

1. Go to ${window.location.origin}/login
2. Click "Create one" and sign up with your name, work email, and a password
3. An admin will approve your account — once approved, sign in and you're set

Questions? Reply to whoever sent you this.`;
  async function copyInvite() {
    try { await navigator.clipboard.writeText(inviteBlurb); } catch { /* older browsers */ }
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2200);
  }

  async function toggle() {
    if (!open) {
      try { setUsers(await api.getUsers()); } catch (e) { alert(e.message); return; }
    }
    setOpen(s => !s);
  }

  async function changeRole(id, role) {
    try {
      const u = await api.updateUserRole(id, role);
      setUsers(us => {
        const next = us.map(x => x.id === id ? { ...x, role: u.role } : x);
        setPendingCount(next.filter(x => x.role === 'PENDING').length);
        return next;
      });
    } catch (e) { alert(e.message); }
  }

  async function setPassword(id, name) {
    const pw = prompt(`New password for ${name} (min 8 characters):`);
    if (pw == null) return;
    if (pw.length < 8) return alert('Password must be at least 8 characters');
    try { await api.setUserPassword(id, pw); alert(`Password updated for ${name}. Their old password is hashed and was never visible to anyone.`); }
    catch (e) { alert(e.message); }
  }

  async function removeUser(id, name) {
    if (!confirm(`Delete user ${name}?`)) return;
    try { await api.deleteUser(id); setUsers(us => us.filter(x => x.id !== id)); }
    catch (e) { alert(e.message); }
  }

  return (
    <>
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
        <div onClick={e => e.stopPropagation()}
          style={{ width:'100%', maxWidth:760, maxHeight:'85vh', display:'flex', flexDirection:'column', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ fontSize:14, fontWeight:800 }}>User Management</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
          </div>
          <div style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
            <div style={{ flex:1, minWidth:220, fontSize:11, color:'var(--muted)', lineHeight:1.5 }}>
              Invite someone: they create a login at <span style={{ color:'var(--text)', fontWeight:700 }}>{window.location.origin}/login</span> ("Create one"), then you approve them here by changing their role from PENDING.
            </div>
            <button onClick={copyInvite}
              style={{ background: copiedInvite ? '#5ABF80' : 'rgba(90,191,128,0.14)', border:'1px solid #5ABF80', color: copiedInvite ? '#0b0b0b' : '#5ABF80', borderRadius:14, padding:'6px 16px', fontSize:11, fontWeight:800, cursor:'pointer', flexShrink:0 }}>
              {copiedInvite ? '✓ Copied' : '📋 Copy Invite Blurb'}
            </button>
          </div>
          <div style={{ overflowY:'auto' }}>
          <table className="pos-table" style={{ width:'100%' }}>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>MFA</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight:600 }}>{u.name}{u.id === user.id && <span style={{ color:'var(--muted)', fontWeight:400 }}> (you)</span>}</td>
                  <td style={{ color:'var(--muted)' }}>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={e => changeRole(u.id, e.target.value)} style={{ width:'auto' }}>
                      {ROLES.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
                    </select>
                  </td>
                  <td style={{ whiteSpace:'nowrap' }}>
                    {u.mfa_enabled ? (
                      <span style={{ fontSize:10, fontWeight:800, color:'#5ABF80' }}>✓ Enabled</span>
                    ) : ['ADMIN','PRODUCER'].includes(u.role) ? (
                      <span style={{ fontSize:10, color:'var(--muted)' }} title="Admins and Producers are always required to set up MFA">Required (role)</span>
                    ) : (
                      <button title={u.mfa_required ? 'MFA required — they set it up on next sign-in. Click to remove.' : 'Require authenticator setup for this user'}
                        onClick={async () => {
                          try { const r = await api.setUserMfaRequired(u.id, !u.mfa_required); setUsers(us => us.map(x => x.id === u.id ? { ...x, ...r } : x)); }
                          catch (e) { alert(e.message); }
                        }}
                        style={u.mfa_required
                          ? { background:'rgba(74,158,255,0.15)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:10, padding:'2px 9px', fontSize:9, fontWeight:800, cursor:'pointer' }
                          : { background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:10, padding:'2px 9px', fontSize:9, fontWeight:700, cursor:'pointer' }}>
                        {u.mfa_required ? 'Required ✓' : 'Require MFA'}
                      </button>
                    )}
                  </td>
                  <td style={{ textAlign:'right', whiteSpace:'nowrap' }}>
                    <button onClick={() => setPassword(u.id, u.name)} title="Set a new password (the old one is hashed and never visible)"
                      style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, color:'var(--muted)', fontSize:11, padding:'3px 9px', cursor:'pointer', marginRight:6 }}>Set Password</button>
                    {u.id !== user.id && (
                      <button onClick={() => removeUser(u.id, u.name)}
                        style={{ background:'none', border:'1px solid var(--border)', borderRadius:5, color:'var(--red-text)', fontSize:11, padding:'3px 9px', cursor:'pointer' }}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        </div>
      )}
      <button onClick={toggle}
        style={{ background:'none', border:'1px solid var(--border)', borderRadius:14, padding:'4px 12px', color:'var(--muted)', fontSize:10, fontWeight:600, letterSpacing:'.05em', cursor:'pointer' }}>
        User Management{pendingCount > 0 && (
          <span title={`${pendingCount} pending signup${pendingCount === 1 ? '' : 's'} awaiting approval`}
            style={{ color:'#ff5c5c', fontWeight:800, marginLeft:6 }}>(!)</span>
        )} ▸
      </button>
    </>
  );
}

// Admin dashboard for the email automations: where each one comes from, who
// it goes to, and a preview of what the email looks like.
function Automations() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('automations'); // 'automations' | 'outbox'
  const [data, setData] = useState(null);          // { configured, automations }
  const [edits, setEdits] = useState({});           // key -> { from, to, cc }
  const [savedKey, setSavedKey] = useState(null);
  const [preview, setPreview] = useState(null);     // { title, kind, subject, html/text, sample }
  const [outbox, setOutbox] = useState(null);       // { entries, counts }
  const [obFilter, setObFilter] = useState(null);   // null | 'draft' | 'sent' | 'failed'

  async function toggle() {
    if (!open) {
      try { setData(await api.mailAutomations()); } catch (e) { alert(e.message); return; }
    }
    setOpen(s => !s);
  }

  async function loadOutbox(status) {
    setObFilter(status);
    try { setOutbox(await api.mailOutbox(status)); } catch (e) { alert(e.message); }
  }
  async function goOutbox() {
    setTab('outbox');
    if (!outbox) loadOutbox(null);
  }
  async function showOutboxEntry(id) {
    try {
      const r = await api.mailOutboxEntry(id);
      setPreview({ title: r.subject || '(no subject)', subject: r.subject || '', sample: false,
        kind: r.body_html ? 'html' : 'text', html: r.body_html, text: r.body_text || '' });
    } catch (e) { alert(e.message); }
  }
  async function deleteDraft(id) {
    if (!window.confirm('Delete this draft? It will not be sent when Outlook connects.')) return;
    try { await api.deleteMailDraft(id); loadOutbox(obFilter); } catch (e) { alert(e.message); }
  }

  const OB_BADGE = { draft: { bg:'rgba(232,176,75,0.16)', fg:'#e8b04b', label:'Draft' },
    sent: { bg:'rgba(90,191,128,0.16)', fg:'#5ABF80', label:'Sent' },
    failed: { bg:'rgba(224,82,82,0.16)', fg:'#e05252', label:'Failed' } };
  const fmtDate = s => s ? new Date(s).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';

  const val = (a, field) => (edits[a.key] && edits[a.key][field] !== undefined) ? edits[a.key][field] : (a[field] || '');
  const setVal = (key, field, v) => setEdits(es => ({ ...es, [key]: { ...es[key], [field]: v } }));
  const dirty = key => !!edits[key];

  async function save(a) {
    try {
      await api.updateMailAutomation(a.key, { fromAddr: val(a, 'from'), toAddrs: val(a, 'to'), ccAddrs: val(a, 'cc') });
      setData(await api.mailAutomations());
      setEdits(es => { const n = { ...es }; delete n[a.key]; return n; });
      setSavedKey(a.key); setTimeout(() => setSavedKey(k => k === a.key ? null : k), 2000);
    } catch (e) { alert(e.message); }
  }

  async function showPreview(a) {
    try { setPreview({ title: a.title, ...(await api.previewMailAutomation(a.key)) }); }
    catch (e) { alert(e.message); }
  }

  const inputStyle = { width:'100%', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', fontSize:11, padding:'5px 8px' };

  return (
    <>
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
        <div onClick={e => e.stopPropagation()}
          style={{ width:'100%', maxWidth:860, maxHeight:'85vh', display:'flex', flexDirection:'column', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              {[['automations','Automations'],['outbox','Outbox']].map(([k, label]) => (
                <button key={k} onClick={() => k === 'outbox' ? goOutbox() : setTab('automations')}
                  style={{ background: tab === k ? 'var(--bg)' : 'none', border:'1px solid', borderColor: tab === k ? 'var(--border)' : 'transparent',
                    borderRadius:8, padding:'4px 12px', fontSize:13, fontWeight:800, cursor:'pointer',
                    color: tab === k ? 'var(--text)' : 'var(--muted)' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              {data && !data.configured && (
                <span style={{ fontSize:10, fontWeight:700, color:'#e8b04b', border:'1px solid rgba(232,176,75,0.5)', borderRadius:10, padding:'2px 9px' }}>
                  ✉ Outlook not connected yet — {tab === 'outbox' ? 'these are held as drafts' : 'these go live once SMTP is set'}
                </span>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>
          {tab === 'automations' && (
          <div style={{ overflowY:'auto', padding:'6px 18px 16px' }}>
            {(data?.automations || []).map(a => (
              <div key={a.key} style={{ borderBottom:'1px solid var(--border)', padding:'12px 0', display:'grid', gridTemplateColumns:'190px 1fr auto', gap:12, alignItems:'start' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:800 }}>{a.title}</div>
                  <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.45, marginTop:3 }}>{a.desc}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:9, fontWeight:800, color:'var(--muted)', width:34, textAlign:'right', flexShrink:0 }}>FROM</span>
                    <input style={inputStyle} value={val(a, 'from')} onChange={e => setVal(a.key, 'from', e.target.value)} />
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:9, fontWeight:800, color:'var(--muted)', width:34, textAlign:'right', flexShrink:0 }}>TO</span>
                    {a.editable === true
                      ? <input style={inputStyle} value={val(a, 'to')} onChange={e => setVal(a.key, 'to', e.target.value)} placeholder="comma-separated emails" />
                      : <span style={{ fontSize:11, color:'var(--text)', opacity:0.85 }}>{a.toDesc}</span>}
                  </div>
                  {a.editable === true && !a.noCc && (
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:9, fontWeight:800, color:'var(--muted)', width:34, textAlign:'right', flexShrink:0 }}>CC</span>
                      <input style={inputStyle} value={val(a, 'cc')} onChange={e => setVal(a.key, 'cc', e.target.value)} placeholder="comma-separated emails" />
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6, alignItems:'stretch' }}>
                  <button onClick={() => showPreview(a)}
                    style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', fontSize:10, fontWeight:700, padding:'4px 12px', cursor:'pointer' }}>
                    Preview
                  </button>
                  {(dirty(a.key) || savedKey === a.key) && (
                    <button onClick={() => save(a)} disabled={savedKey === a.key}
                      style={{ background: savedKey === a.key ? '#5ABF80' : 'rgba(90,191,128,0.14)', border:'1px solid #5ABF80', color: savedKey === a.key ? '#0b0b0b' : '#5ABF80', borderRadius:6, fontSize:10, fontWeight:800, padding:'4px 12px', cursor:'pointer' }}>
                      {savedKey === a.key ? '✓ Saved' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
          {tab === 'outbox' && (
          <div style={{ display:'flex', flexDirection:'column', minHeight:0, flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 18px 8px', borderBottom:'1px solid var(--border)' }}>
              {[[null,'All'],['draft','Drafts'],['sent','Sent'],['failed','Failed']].map(([k, label]) => {
                const n = k && outbox?.counts ? Number(outbox.counts[k] || 0) : null;
                return (
                  <button key={label} onClick={() => loadOutbox(k)}
                    style={{ background: obFilter === k ? 'var(--bg)' : 'none', border:'1px solid', borderColor: obFilter === k ? 'var(--border)' : 'transparent',
                      borderRadius:8, padding:'3px 11px', fontSize:11, fontWeight:700, cursor:'pointer', color: obFilter === k ? 'var(--text)' : 'var(--muted)' }}>
                    {label}{n !== null ? ` (${n})` : ''}
                  </button>
                );
              })}
            </div>
            <div style={{ overflowY:'auto', padding:'4px 18px 16px' }}>
              {!outbox && <div style={{ fontSize:11, color:'var(--muted)', padding:'16px 0' }}>Loading…</div>}
              {outbox && outbox.entries.length === 0 && (
                <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', padding:'20px 0' }}>
                  {obFilter === 'draft' ? 'No drafts — nothing is waiting to go out.'
                    : obFilter ? `No ${obFilter} emails yet.`
                    : 'No emails yet. Automations will show up here as they fire.'}
                </div>
              )}
              {outbox && outbox.entries.map(e => {
                const b = OB_BADGE[e.status] || OB_BADGE.draft;
                return (
                  <div key={e.id} style={{ borderBottom:'1px solid var(--border)', padding:'10px 0', display:'grid', gridTemplateColumns:'auto 1fr auto', gap:12, alignItems:'center' }}>
                    <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'.04em', background:b.bg, color:b.fg, borderRadius:10, padding:'3px 9px', whiteSpace:'nowrap' }}>{b.label}</span>
                    <div style={{ minWidth:0, cursor:'pointer' }} onClick={() => showOutboxEntry(e.id)}>
                      <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.subject || '(no subject)'}</div>
                      <div style={{ fontSize:10, color:'var(--muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {e.to_addrs || '—'}{e.cc_addrs ? ` · cc ${e.cc_addrs}` : ''} · {fmtDate(e.sent_at || e.created_at)}
                        {e.status === 'failed' && e.error ? ` · ${e.error}` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => showOutboxEntry(e.id)}
                        style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--muted)', fontSize:10, fontWeight:700, padding:'4px 12px', cursor:'pointer' }}>
                        View
                      </button>
                      {e.status === 'draft' && (
                        <button onClick={() => deleteDraft(e.id)}
                          style={{ background:'rgba(224,82,82,0.12)', border:'1px solid rgba(224,82,82,0.5)', borderRadius:6, color:'#e05252', fontSize:10, fontWeight:800, padding:'4px 12px', cursor:'pointer' }}>
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
        </div>
      )}
      {preview && (
        <div onClick={e => e.target === e.currentTarget && setPreview(null)}
          style={{ position:'fixed', inset:0, zIndex:130, background:'rgba(0,0,0,0.78)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ width:'100%', maxWidth:680, maxHeight:'88vh', display:'flex', flexDirection:'column', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:800 }}>{preview.title}{preview.sample === false ? '' : ' — sample'}</div>
                <div style={{ fontSize:10, color:'var(--muted)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Subject: {preview.subject}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>✕</button>
            </div>
            {preview.kind === 'html' ? (
              <iframe title="Email preview" srcDoc={preview.html} sandbox=""
                style={{ flex:1, minHeight:'62vh', width:'100%', border:'none', background:'#fff' }} />
            ) : (
              <pre style={{ margin:0, padding:'16px 18px', overflow:'auto', fontSize:12, lineHeight:1.55, color:'var(--text)', whiteSpace:'pre-wrap', fontFamily:'inherit' }}>{preview.text}</pre>
            )}
          </div>
        </div>
      )}
      <button onClick={toggle}
        style={{ background:'none', border:'1px solid var(--border)', borderRadius:14, padding:'4px 12px', color:'var(--muted)', fontSize:10, fontWeight:600, letterSpacing:'.05em', cursor:'pointer' }}>
        Automations ▸
      </button>
    </>
  );
}

// Edge fade so tiles blur out at the sides of a scroll row
const SCROLL_FADE = 'linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 16px), transparent 100%)';

// The AGENCY role is presented to users as "Solutions" everywhere it's shown.
const roleLabel = r => r === 'AGENCY' ? 'SOLUTIONS' : r;

// Solutions role landing: a Project Hub scroll limited to projects whose budget
// is tagged "Unbridled Solutions". Tiles open the project page (no finance).
function SolutionsHub() {
  const nav = useNavigate();
  const { user } = useAuth();
  const isCrewRole = user?.role === 'CREW';
  const label = isCrewRole ? 'Crew' : 'Solutions';
  const [projects, setProjects] = useState(null);
  const [q, setQ] = useState('');
  useEffect(() => { api.solutionsProjects().then(setProjects).catch(e => alert(e.message)); }, []);
  const recent = recentProjectTimes();
  const list = [...(projects || [])].sort((a, b) =>
    (recent[b.id] || 0) - (recent[a.id] || 0) || (a.code || '').localeCompare(b.code || ''));
  const s = q.trim().toLowerCase();
  const shown = s ? list.filter(p => (p.code || '').toLowerCase().includes(s) || (p.title || '').toLowerCase().includes(s) || (p.client || '').toLowerCase().includes(s)) : list;
  return (
    <div className="hub-hubs" style={{ gridTemplateColumns:'1fr' }}>
      <div className="hub-hubtile hub-glow hub-anim-left" onMouseMove={glowMove} style={{ cursor:'default', paddingTop:16, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code, title, client…" style={{ flex:'0 0 34%', minWidth:160 }} />
          <span style={{ fontSize:9, fontWeight:800, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.4)', borderRadius:10, padding:'2px 8px', whiteSpace:'nowrap' }}>{label}</span>
        </div>
        {!projects && <div className="empty">Loading…</div>}
        {projects && shown.length === 0 && <div className="empty">No {isCrewRole ? '' : 'Solutions '}projects yet.</div>}
        {shown.length > 0 && (
          <div className="hub-scroll" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, WebkitMaskImage:SCROLL_FADE, maskImage:SCROLL_FADE }}>
            {shown.map(p => (
              <div key={p.id} onClick={() => nav(`/project-view/${p.id}`)}
                style={{ flex:'0 0 auto', width:180, background:'var(--bg)', border:'1px solid var(--border)', borderTop:'3px solid rgba(232,80,10,0.55)', borderRadius:10, padding:'11px 13px', cursor:'pointer', transition:'transform .15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize:10, fontWeight:800, color:'var(--muted)', letterSpacing:'0.04em' }}>{p.code}</div>
                <div style={{ fontSize:12.5, fontWeight:800, margin:'3px 0 2px' }}>{p.title}</div>
                <div style={{ fontSize:10.5, color:'var(--muted)' }}>{p.client}</div>
                <div style={{ display:'flex', gap:5, marginTop:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:9, fontWeight:800, color: HUB_STATUS[p.budget_status] || '#a89a86', border: `1px solid ${(HUB_STATUS[p.budget_status] || '#a89a86')}55`, borderRadius:10, padding:'2px 8px' }}>{p.budget_status || 'No budget'}</span>
                  {(p.shoots || []).length > 0 && <span style={{ fontSize:9, fontWeight:800, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.shoots.length} shoot{p.shoots.length !== 1 ? 's' : ''}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Project View mode: every project as a tile, sorted by code
// Moves the .hub-glow spotlight to the cursor by writing --gx/--gy on the tile.
const glowMove = e => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--gx', (e.clientX - r.left) + 'px');
  e.currentTarget.style.setProperty('--gy', (e.clientY - r.top) + 'px');
};

function HubProjects({ onNewProject, finance }) {
  const nav = useNavigate();
  const [projects, setProjects] = useState(null);
  const [q, setQ] = useState('');
  const [cq, setCq] = useState('');
  useEffect(() => { api.financeProjects().then(setProjects).catch(e => alert(e.message)); }, []);
  // Most recently viewed first; never-viewed projects follow in code order
  const recent = recentProjectTimes();
  const list = [...(projects || [])].sort((a, b) =>
    (recent[b.id] || 0) - (recent[a.id] || 0) || (a.code || '').localeCompare(b.code || ''));
  const s = q.trim().toLowerCase();
  const shown = s ? list.filter(p => (p.code || '').toLowerCase().includes(s) || (p.title || '').toLowerCase().includes(s) || (p.client || '').toLowerCase().includes(s)) : list;
  // Clients running more than one project at once get a mini-hub tile
  const byClient = new Map();
  for (const p of projects || []) {
    const name = (p.client || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byClient.has(key)) byClient.set(key, { name, projects: [] });
    byClient.get(key).projects.push(p);
  }
  const clients = [...byClient.values()].sort((a, b) => a.name.localeCompare(b.name));
  const cs = cq.trim().toLowerCase();
  const shownClients = cs ? clients.filter(c => c.name.toLowerCase().includes(cs)) : clients;
  const [view, setView] = useState('projects'); // 'projects' | 'clients'
  const [flips, setFlips] = useState(0);         // >0 once the user has flipped, so the
  const doSwitch = () => { setView(v => v === 'projects' ? 'clients' : 'projects'); setFlips(f => f + 1); };
  const [appOpen, setAppOpen] = useState(false); // app (≡) menu expanded
  const [mobile, setMobile] = useState(typeof window !== 'undefined' && window.innerWidth <= 700);
  useEffect(() => {
    const onR = () => setMobile(window.innerWidth <= 700);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  // On phones, hide the search field while the app menu is expanded so the row
  // stays clean instead of crushing the search into a sliver.
  const hideSearch = mobile && appOpen;

  const projectList = (
    <>
      {!projects && <div className="empty">Loading…</div>}
      {projects && shown.length === 0 && <div className="empty">No projects match.</div>}
      {shown.length > 0 && (
        <div className="hub-scroll" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, WebkitMaskImage:SCROLL_FADE, maskImage:SCROLL_FADE }}>
          {shown.map((p, i) => (
            <div key={p.id} onClick={() => nav(`/project-view/${p.id}`)}
              className={flips ? 'hub-cardflip' : ''}
              style={{ flex:'0 0 auto', width:180, background:'var(--bg)', border:'1px solid var(--border)', borderTop:'3px solid rgba(232,80,10,0.55)', borderRadius:10, padding:'11px 13px', cursor:'pointer', transition:'transform .15s ease', animationDelay:`${i * 0.045}s` }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--muted)', letterSpacing:'0.04em' }}>{p.code}</div>
              <div style={{ fontSize:12.5, fontWeight:800, margin:'3px 0 2px' }}>{p.title}</div>
              <div style={{ fontSize:10.5, color:'var(--muted)' }}>{p.client}</div>
              <div style={{ display:'flex', gap:5, marginTop:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, fontWeight:800, color: HUB_STATUS[p.budget_status] || '#a89a86', border: `1px solid ${(HUB_STATUS[p.budget_status] || '#a89a86')}55`, borderRadius:10, padding:'2px 8px' }}>{p.budget_status || 'No budget'}</span>
                {(p.shoots || []).length > 0 && <span style={{ fontSize:9, fontWeight:800, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.shoots.length} shoot{p.shoots.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const clientList = (
    <>
      {clients.length === 0 ? <div className="empty">No clients yet.</div> : (
        <div className="hub-scroll" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, WebkitMaskImage:SCROLL_FADE, maskImage:SCROLL_FADE }}>
          {shownClients.map((c, i) => (
            <div key={c.name} onClick={() => nav(`/project-view/client/${encodeURIComponent(c.name)}`)}
              className={flips ? 'hub-cardflip' : ''}
              style={{ flex:'0 0 auto', width:180, background:'var(--bg)', border:'1px solid var(--border)', borderTop:'3px solid #a89a86', borderRadius:10, padding:'11px 13px', cursor:'pointer', transition:'transform .15s ease', animationDelay:`${i * 0.045}s` }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'} onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <div style={{ fontSize:12.5, fontWeight:800 }}>{c.name}</div>
              <div style={{ fontSize:10.5, color:'var(--muted)', margin:'3px 0 8px' }}>{c.projects.length} project{c.projects.length !== 1 ? 's' : ''}</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {c.projects.slice(0, 4).map(p => <span key={p.id} style={{ fontSize:9, fontWeight:800, color:'#c9bcaa', border:'1px solid #a89a8655', borderRadius:10, padding:'2px 8px' }}>{p.code}</span>)}
                {c.projects.length > 4 && <span style={{ fontSize:9, color:'var(--muted)' }}>+{c.projects.length - 4} more</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // Single always-open tile that flips between Project Hub and Client Hub.
  const onProjects = view === 'projects';
  return (
    <div className="hub-hubs" style={{ gridTemplateColumns:'1fr' }}>
      <div className={`hub-hubtile hub-glow hub-anim-left${onProjects ? '' : ' neutral'}`} onMouseMove={glowMove} style={{ cursor:'default', paddingTop:16, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          {onNewProject && !finance && <NewProjectPill onClick={onNewProject} />}
          {!hideSearch && (onProjects
            ? <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code, title, client…" style={{ flex: finance ? '0 0 34%' : 1, minWidth: finance ? 160 : 0 }} />
            : <input value={cq} onChange={e => setCq(e.target.value)} placeholder="Search clients…" style={{ flex:1, minWidth:0 }} />)}
          {hideSearch && <div style={{ flex:1 }} />}
          {!finance && <HubSwitchPill label={onProjects ? 'Client Hub' : 'Project Hub'} neutral={onProjects}
            onClick={doSwitch} />}
          {!finance && <HubAppMenu open={appOpen} setOpen={setAppOpen} />}
          {finance && <FinancePill onClick={() => nav('/finance')} />}
        </div>
        <div key={flips}>
          {onProjects ? projectList : clientList}
        </div>
      </div>
    </div>
  );
}

// Icon-only pill that reveals its label on hover (mirrors NewProjectPill) — the
// Project ⇄ Client Hub flip switch, right-aligned in the hub tile's control row.
function HubSwitchPill({ label, onClick, neutral }) {
  const [open, setOpen] = useState(false);
  return (
    <button className={`np-pill hub-switch-pill${neutral ? ' neutral' : ''}${open ? ' open' : ''}`} title={`Switch to ${label}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onClick={onClick}>
      <span className="np-plus" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3l4 4-4 4"/><path d="M21 7H7a4 4 0 0 0-4 4"/><path d="M7 21l-4-4 4-4"/><path d="M3 17h14a4 4 0 0 0 4-4"/></svg>
      </span>
      <span className="np-label">{label}</span>
    </button>
  );
}

// One app shortcut inside the hub-tile app menu: icon-only, reveals its name on
// hover (same pattern as the + and switch pills).
function AppPill({ icon, label, accent, bg, onClick, i }) {
  return (
    <button className="np-pill hub-app-pill" title={label} onClick={onClick}
      style={{ background:bg, borderColor:accent, color:accent, animationDelay:`${i * 0.05}s` }}>
      <span className="np-plus" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>{icon}</span>
      <span className="np-label">{label}</span>
    </button>
  );
}

// Orange "≡" menu circle on the right of the hub tile. Clicking it expands the
// three app shortcuts (Project Finance / FreePro / Post Production) to its left.
function HubAppMenu({ open, setOpen }) {
  const nav = useNavigate();
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const dollar = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
  const camera = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>;
  const scissors = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88"/><path d="M14.47 14.48L20 20"/><path d="M8.12 8.12L12 12"/></svg>;
  const apps = [
    { label:'Project Finance', to:'/finance', icon:dollar, accent:'#c8873c', bg:'rgba(200,135,60,0.16)' },
    { label:'Production', to:'/projects', icon:camera, accent:'var(--orange)', bg:'rgba(232,80,10,0.16)' },
    { label:'Post-Production', to:'/avo', icon:scissors, accent:'#a89a86', bg:'rgba(168,154,134,0.18)' },
  ];
  return (
    <div ref={ref} style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
      <span style={{ width:1, height:26, background:'var(--border)', flexShrink:0 }} />
      {open && apps.map((a, i) => (
        <AppPill key={a.to} {...a} i={i} onClick={() => nav(a.to)} />
      ))}
      <button className={`np-pill hub-menu-pill${open ? ' active' : ''}`} title="Apps" onClick={() => setOpen(o => !o)}>
        <span className="np-plus" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </span>
      </button>
    </div>
  );
}

// Right-aligned $ shortcut to Project Finance (Finance-role hub), icon-only with
// a hover-revealed label, matching the other hub-tile pills.
function FinancePill({ onClick }) {
  return (
    <button className="np-pill hub-menu-pill" title="Project Finance" onClick={onClick} style={{ marginLeft:'auto' }}>
      <span className="np-plus" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
      </span>
      <span className="np-label">Project Finance</span>
    </button>
  );
}

// ── Lower dashboard: Day in Review (left) + team whereabouts (right) ──
const STATUS_BUBBLE = { out: '#e05252', shoot: '#e6c229', office: '#5ABF80' };
const KIND_DOT = { due: '#e8500a', shoot: '#e6c229', pto: '#4a9eff', work: '#9DC183' };

function HubDashboard() {
  const nav = useNavigate();
  const [day, setDay] = useState(null);
  const [team, setTeam] = useState(null);
  const [hiddenTasks, setHiddenTasks] = useState([]); // checked-off this session
  const [openTask, setOpenTask] = useState(null);      // expanded to show description/notes
  const [addTask, setAddTask] = useState(null);        // { projectId, text, dueDate } when the quick-add modal is open
  const [taskProjects, setTaskProjects] = useState(null);

  function openAddTask() {
    setAddTask({ projectId: '', text: '', dueDate: '', taggedId: '' });
    if (!taskProjects) api.getProjects().then(ps => setTaskProjects(ps.filter(p => p.status !== 'ARCHIVED'))).catch(() => setTaskProjects([]));
  }

  async function saveNewTask(e) {
    e.preventDefault();
    try {
      const t = await api.addMyTask({ projectId: addTask.projectId, text: addTask.text, dueDate: addTask.dueDate || null, taggedId: addTask.taggedId || null });
      setDay(d => ({ ...d, tasks: [...(d?.tasks || []), t] }));
      setAddTask(null);
    } catch (err) { alert(err.message); }
  }

  useEffect(() => {
    api.dashboardToday().then(setDay).catch(() => setDay({ items: [] }));
    api.dashboardTeam().then(setTeam).catch(() => setTeam([]));
  }, []);

  // Server sends 'today' in the business timezone — trust it over the browser clock
  const dateLabel = (day?.date ? new Date(day.date + 'T12:00:00') : new Date()).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px', minHeight:220 };
  const hdr = { fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 };

  return (
    <div className="hub-dash" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:16, marginTop:22 }}>
      <div className="hub-anim-drop hub-glow" onMouseMove={glowMove} style={{ ...card, animationDelay:'.1s' }}>
        <div style={{ ...hdr, marginBottom:2, color:'#e8500a' }}>Day in Review</div>
        <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:10 }}>{dateLabel}</div>
        {!day && <div style={{ fontSize:11, color:'var(--muted)' }}>Loading…</div>}
        {day && day.items.length === 0 && (
          <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>Nothing on your plate today — no shoots, due dates, or deadlines assigned to you.</div>
        )}
        {day && day.items.map((it, i) => (
          <div key={i} onClick={() => it.link && nav(it.link)}
            style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 4px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor: it.link ? 'pointer' : 'default' }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background: KIND_DOT[it.kind] || 'var(--muted)', marginTop:5, flexShrink:0 }} />
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:700 }}>{it.title}</div>
              {it.subtitle && <div style={{ fontSize:10, color:'var(--muted)', marginTop:1 }}>{it.subtitle}</div>}
            </div>
          </div>
        ))}
        {day && (day.tomorrow || []).length > 0 && (
          <>
            <div style={{ ...hdr, fontSize:10, margin:'16px 0 6px' }}>
              Coming Tomorrow
              <span style={{ color:'var(--muted)', fontWeight:600, textTransform:'none', letterSpacing:0 }}>
                {' '}· {day.tomorrowDate ? new Date(day.tomorrowDate + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' }) : ''}
              </span>
            </div>
            {day.tomorrow.map((it, i) => (
              <div key={i} onClick={() => it.link && nav(it.link)}
                style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'6px 4px', borderBottom:'1px solid rgba(255,255,255,0.04)', cursor: it.link ? 'pointer' : 'default', opacity:0.75 }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background: KIND_DOT[it.kind] || 'var(--muted)', marginTop:5, flexShrink:0, opacity:0.7 }} />
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700 }}>{it.title}</div>
                  {it.subtitle && <div style={{ fontSize:10, color:'var(--muted)', marginTop:1 }}>{it.subtitle}</div>}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="hub-anim-drop hub-glow" onMouseMove={glowMove} style={{ ...card, animationDelay:'.18s' }}>
        <div style={{ ...hdr, marginBottom:12, color:'#e8500a', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          My Tasks
          <button onClick={openAddTask} title="Add a task to your list"
            style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:10,
              padding:'1px 8px', fontSize:9, fontWeight:800, cursor:'pointer', textTransform:'none', letterSpacing:0 }}>
            + Add New
          </button>
          {day && (day.tasks || []).some(t => !hiddenTasks.includes(t.id) && t.due_date && String(t.due_date).slice(0, 10) === (day?.date || new Date().toISOString().slice(0, 10))) && (
            <span style={{ background:'rgba(232,80,10,0.16)', border:'1px solid var(--orange)', color:'var(--orange)', borderRadius:10, padding:'1px 8px', fontSize:9, fontWeight:800, textTransform:'none', letterSpacing:0 }}>
              (!) Task Due Today
            </span>
          )}
        </div>
        {!day && <div style={{ fontSize:11, color:'var(--muted)' }}>Loading…</div>}
        {day && (day.tasks || []).filter(t => !hiddenTasks.includes(t.id)).length === 0 && (
          <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No tasks on your list.</div>
        )}
        {day && (
            <div style={{ maxHeight:280, overflowY:'auto' }}>
            {(day.tasks || []).filter(t => !hiddenTasks.includes(t.id)).map(t => {
              const today = day?.date || new Date().toISOString().slice(0, 10);
              const dueToday = t.due_date && String(t.due_date).slice(0, 10) === today;
              const overdue = t.due_date && String(t.due_date).slice(0, 10) < today;
              return (
                <React.Fragment key={t.id}>
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 4px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                  <input type="checkbox" checked={false} style={{ width:'auto', accentColor:'#5ABF80', flexShrink:0 }}
                    onChange={() => {
                      api.updateProjectTask(t.id, { done: true }).catch(e => alert(e.message));
                      setHiddenTasks(h => [...h, t.id]);
                    }} />
                  <div style={{ flex:1, minWidth:0, cursor:'pointer' }} onClick={() => setOpenTask(o => o === t.id ? null : t.id)}
                    title="Click to view the description / notes">
                    <div style={{ fontSize:12, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {t.text || '—'} <span style={{ color:'var(--muted)', fontWeight:400, fontSize:10 }}>{openTask === t.id ? '▾' : '▸'}</span>
                    </div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>{t.project_code} · {t.project_title}</div>
                  </div>
                  {t.due_date && (
                    <span style={{ fontSize:10, fontWeight:700, color: overdue ? '#e05252' : dueToday ? 'var(--orange)' : 'var(--muted)', whiteSpace:'nowrap' }}>
                      {dueToday ? '❗ Due Today' : `Due ${new Date(String(t.due_date).slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric' })}`}
                    </span>
                  )}
                </div>
                {openTask === t.id && (
                  <div onClick={() => nav(`/project-view/${t.project_id}`)}
                    style={{ margin:'0 4px 8px 28px', padding:'8px 10px', background:'rgba(255,255,255,0.03)', border:'1px solid var(--border)', borderRadius:7, fontSize:11, lineHeight:1.5, cursor:'pointer', whiteSpace:'pre-wrap' }}>
                    {t.notes ? t.notes : <span style={{ color:'var(--muted)', fontStyle:'italic' }}>No description yet — click to open the project's Overview.</span>}
                  </div>
                )}
                </React.Fragment>
              );
            })}
            </div>
        )}
      </div>

      <div className="hub-anim-drop hub-glow" onMouseMove={glowMove} style={{ ...card, position:'relative', overflow:'hidden', animationDelay:'.26s' }}>
        <div style={{ ...hdr, marginBottom:12, color:'#e8500a' }}>Team Today</div>
        {!team && <div style={{ fontSize:11, color:'var(--muted)' }}>Loading…</div>}
        {team && team.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No Unbridled team members on the roster yet.</div>}
        <div className="team-grid" style={{ display:'grid', gridTemplateColumns:'1fr', columnGap:18 }}>
          {(team || []).map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 4px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              <span title={m.status === 'out' ? 'Out of Office / PTO' : m.status === 'shoot' ? 'Traveling / on a shoot' : 'In office'}
                style={{ width:10, height:10, borderRadius:'50%', background: STATUS_BUBBLE[m.status], boxShadow:`0 0 6px ${STATUS_BUBBLE[m.status]}66`, flexShrink:0 }} />
              <span style={{ fontSize:12, fontWeight:700, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
              <span style={{ fontSize:10, color:'var(--muted)', flexShrink:0 }}>{m.detail !== 'In office' ? `${m.detail} · ` : ''}{m.location}</span>
            </div>
          ))}
        </div>
      </div>

      {addTask && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setAddTask(null)}>
          <div className="modal" style={{ maxWidth:420 }}>
            <div className="modal-title">Add Task</div>
            <form onSubmit={saveNewTask}>
              <div className="form-grid" style={{ marginBottom:12 }}>
                <div className="field span2"><label>Project</label>
                  <select value={addTask.projectId} onChange={e => setAddTask(f => ({ ...f, projectId: e.target.value }))} required>
                    <option value="">{taskProjects ? '— Select a project —' : 'Loading projects…'}</option>
                    {(taskProjects || []).map(p => <option key={p.id} value={p.id}>{p.code} — {p.title}</option>)}
                  </select>
                </div>
                <div className="field span2"><label>Task</label>
                  <input value={addTask.text} onChange={e => setAddTask(f => ({ ...f, text: e.target.value }))} required placeholder="What needs doing?" autoFocus />
                </div>
                <div className="field span2"><label>Due Date (optional)</label>
                  <input type="date" value={addTask.dueDate} onChange={e => setAddTask(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div className="field span2"><label>Tag a Teammate (optional)</label>
                  <select value={addTask.taggedId} onChange={e => setAddTask(f => ({ ...f, taggedId: e.target.value }))}>
                    <option value="">— No one — just me —</option>
                    {(team || []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  {addTask.taggedId && <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>This task will also appear on their My Tasks list, noted as tagged by you.</div>}
                </div>
              </div>
              <div className="btn-row">
                <button className="btn btn-primary">Add Task</button>
                <button type="button" className="btn btn-ghost" onClick={() => setAddTask(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Redesign scaffolding: liquid-glass bottom nav, expand-on-hover FAB,
// scroll-reveal, and an orange/neutral palette ──────────────────────────────
const HUB_CSS = `
.hub-topbar{position:absolute;top:16px;left:22px;display:flex;align-items:center;gap:10px;z-index:30}
.hub-brand{display:flex;flex-direction:column;align-items:center;gap:10px;margin:26px 0 6px}
/* Faint Unbridled logo as a top masthead header */
.hub-masthead{display:flex;justify-content:flex-end;padding-top:2px;margin-bottom:0}
.hub-logo-top{height:32px;filter:brightness(0) invert(1);opacity:.25}
/* Left-aligned serif heading + tagline, dropped down from the masthead */
.hub-header{margin:54px 0 10px}
.hub-h1{font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:700;letter-spacing:-.01em;line-height:1.05;margin:0}
.hub-tagline{text-align:left;font-size:14px;font-weight:600;color:var(--tan);max-width:560px;margin:8px 0 0;line-height:1.45}
/* Mobile: pin the hero (heading/tagline/media moment) and let the tiles below
   scroll up over it (they carry a solid bg + higher z-index). The tagline and
   media moment are slid off sideways via JS refs as the page scrolls. */
@media(max-width:700px){
  .dash-hero{position:sticky;top:6px;z-index:1;overflow-x:clip}
  .dash-hero .hub-header,.dash-hero .hub-anim-drop{will-change:transform,opacity}
  .dash-scroll{position:relative;z-index:3;background:var(--bg);will-change:transform}
}
/* MediaMoment orbit: ring of team dots with the moment in the middle */
/* MediaMoment banner: a wide horizontal card with a Netflix-style logo reveal */
.mm-wrap{position:relative;margin:8px 0 22px}
.mm-banner{position:relative;display:flex;flex-direction:column;overflow:hidden;padding:15px 20px;border-radius:16px;border:1px solid var(--border);
  background:linear-gradient(120deg, rgba(232,80,10,0.16), rgba(232,80,10,0.03) 58%, transparent), var(--bg2);
  animation:mmCardIn .7s cubic-bezier(.22,.61,.36,1) both}
.mm-banner::after{content:'';position:absolute;right:-46px;top:-46px;width:190px;height:190px;border-radius:50%;
  background:radial-gradient(circle, rgba(232,80,10,0.13), transparent 70%);pointer-events:none}
.mm-photo{position:absolute;top:0;right:0;bottom:0;width:48%;z-index:0;background-size:cover;background-position:center;opacity:.5;pointer-events:none;
  -webkit-mask-image:linear-gradient(90deg, transparent, #000 58%);mask-image:linear-gradient(90deg, transparent, #000 58%)}
.mm-b-main{position:relative;z-index:1;min-width:0}
.mm-kicker{font-size:9px;font-weight:900;letter-spacing:.18em;color:var(--orange)}
.mm-prompt{font-size:10.5px;font-weight:700;color:var(--muted);margin-top:4px;line-height:1.3}
.mm-answer{font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:700;line-height:1.4;margin-top:5px;color:var(--text)}
.mm-name{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:800;color:var(--muted);white-space:nowrap;text-align:right;margin-top:4px}
@keyframes mmCardIn{from{opacity:0;transform:scale(.97) translateY(6px)}to{opacity:1;transform:none}}
@media(max-width:640px){.mm-answer{font-size:13px}}

/* ── Netflix-style intro: assemble the logo, then the aperture zooms + turns ── */
.mm-intro{position:absolute;inset:0;z-index:6;border-radius:16px;overflow:hidden;background:var(--bg2);
  display:flex;align-items:center;justify-content:center;animation:mmIntroOut .55s ease 1.95s forwards}
@keyframes mmIntroOut{to{opacity:0;visibility:hidden}}
/* Real logo, split into two layers of the same PNG so each animates on its own:
   the wordmark (whitened for the dark card) wipes in from the left, the orange
   aperture slides in from the right, then the aperture zooms + turns to reveal. */
.mm-logo{position:relative;width:210px;height:46px}
.mm-logo img{position:absolute;left:0;top:0;height:46px;width:auto}
.mm-logo-word{clip-path:inset(0 0 0 28%);filter:brightness(0) invert(1);
  animation:mmWordIn .6s cubic-bezier(.22,.61,.36,1) both, mmFade .35s ease 1.2s forwards}
.mm-logo-ap{clip-path:inset(0 74% 0 0);transform-origin:12% 50%;
  animation:mmApIn .6s cubic-bezier(.22,.61,.36,1) both, mmApZoom 1s cubic-bezier(.6,0,.25,1) 1.3s forwards}
@keyframes mmWordIn{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
@keyframes mmApIn{from{opacity:0;transform:translateX(54px) scale(.7)}to{opacity:1;transform:none}}
@keyframes mmApZoom{from{opacity:1;transform:scale(1) rotate(0deg)}to{opacity:0;transform:scale(22) rotate(210deg)}}
@keyframes mmFade{to{opacity:0}}
@media(max-width:640px){.hub-h1{font-size:28px}.hub-header{margin:42px 0 10px}.hub-logo-top{height:28px}}

.hub-reveal{opacity:0;transform:translateY(20px);transition:opacity .55s cubic-bezier(.22,.61,.36,1),transform .55s cubic-bezier(.22,.61,.36,1)}
.hub-reveal.in{opacity:1;transform:none}

/* Liquid-glass bottom nav */
.hub-bottomnav{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:120;display:flex;align-items:stretch;gap:2px;padding:8px 12px;border-radius:26px;
  background:rgba(30,27,23,0.52);backdrop-filter:blur(22px) saturate(1.7);-webkit-backdrop-filter:blur(22px) saturate(1.7);
  border:1px solid rgba(255,255,255,0.12);box-shadow:0 12px 40px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.12);transition:padding .28s ease}
.hub-bottomnav.condensed{padding:7px 9px}
/* Lifted clear of a page's own bottom dock (e.g. Team's GlassDock) so the global nav doesn't overlap it */
.hub-bottomnav.raised{bottom:96px}
@media (max-width:700px){.hub-bottomnav.raised{bottom:104px}}
.hub-navitem{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:none;border:none;color:var(--muted);
  font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;padding:7px 16px;border-radius:18px;transition:color .15s ease,background .15s ease,padding .28s ease}
.hub-navitem:hover{color:var(--text);background:rgba(255,255,255,0.07)}
.hub-navitem.active{color:var(--orange)}
.hub-navitem svg{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.hub-navitem .lbl{max-height:12px;opacity:1;overflow:hidden;transition:max-height .28s ease,opacity .2s ease}
.hub-bottomnav.condensed .hub-navitem{padding:9px 13px}
.hub-bottomnav.condensed .hub-navitem .lbl{max-height:0;opacity:0}
.hub-navpop{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);background:rgba(30,27,23,0.92);backdrop-filter:blur(18px);
  border:1px solid rgba(255,255,255,0.14);border-radius:14px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.6);min-width:172px}
.hub-navpop button{display:block;width:100%;text-align:left;background:none;border:none;color:var(--muted);font-size:12px;font-weight:800;padding:11px 16px;cursor:pointer}
.hub-navpop button:hover{background:rgba(255,255,255,0.06);color:var(--text)}
.hub-navpop button.on{color:var(--orange)}

/* Expand-on-hover new-project FAB */
.hub-fab{position:fixed;right:26px;bottom:26px;z-index:120;display:flex;align-items:center;height:56px;border-radius:28px;padding:0;
  background:#0d0c0a;border:1px solid var(--orange);color:var(--orange);cursor:pointer;overflow:hidden;
  box-shadow:0 0 18px rgba(232,80,10,0.5);transition:box-shadow .2s ease,transform .2s ease}
.hub-fab .plus{flex:0 0 auto;width:56px;height:56px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:300}
.hub-fab .fab-label{max-width:0;overflow:hidden;white-space:nowrap;font-size:13px;font-weight:800;letter-spacing:.02em;transition:max-width .3s ease,padding .3s ease}
.hub-fab:hover{box-shadow:0 0 30px rgba(232,80,10,0.85);transform:translateY(-1px)}
.hub-fab:hover .fab-label{max-width:200px;padding-right:24px}
/* On narrow screens the centered nav grows wide enough to reach the corner FAB — lift it above the bar */
@media(max-width:640px){.hub-fab{bottom:96px;right:20px}}

/* Expandable Project / Client hub tiles */
.hub-hubs{display:grid;gap:14px;margin:0 auto 22px;transition:grid-template-columns .3s ease,max-width .35s ease}
.hub-hubs-roll{animation:hubRollOut .4s cubic-bezier(.22,.61,.36,1)}
.hub-hubs-roll .hub-hubtile{min-width:0}
@keyframes hubRollOut{from{max-width:540px;opacity:.5;transform:translateY(8px)}to{max-width:100%;opacity:1;transform:translateY(0)}}
@media(max-width:640px){
  .hub-hubs:not(.hub-hubs-roll){grid-template-columns:1fr !important;max-width:100% !important;gap:10px}
  .hub-hubs-roll{grid-template-columns:1fr !important;max-width:100% !important;animation:hubRollMobile .42s cubic-bezier(.22,.61,.36,1)}
  .hub-hubtile{padding:13px 12px}
  .hub-hubtile .hh-title{font-size:12.5px !important}
  .hub-hubtile .hh-titlerow{margin-bottom:12px !important}
  .hub-hubtile .hh-arrow svg{width:14px !important;height:14px !important}
  .hub-hubtile .hh-clientrow{gap:9px !important}
  .hub-hubtile .hh-stat{min-width:0 !important}
  .hub-hubtile .hh-statn{font-size:18px !important}
  .hub-hubtile .hh-statl{font-size:7px !important;letter-spacing:.01em !important}
  .hub-hubtile .hh-icon{width:30px !important;height:30px !important;font-size:16px !important;border-radius:9px !important}
  .hub-hubtile .hh-sub{font-size:9.5px !important}
  .hub-hubtile .hub-expandbtn{width:22px;height:22px;font-size:13px;top:9px;right:9px}
}
@keyframes hubRollMobile{from{opacity:0;transform:translateY(16px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
.hub-hubtile{position:relative;background:var(--bg2);border:1px solid var(--border);border-top:3px solid var(--orange);border-radius:14px;padding:20px 22px;cursor:pointer;transition:transform .15s ease,border-color .15s ease,box-shadow .15s ease}
.hub-hubtile:hover{transform:translateY(-2px);box-shadow:0 8px 26px rgba(0,0,0,0.4)}
/* Small, subtle orange spotlight that follows the cursor across the tiles
   (hub tile + the 3 dashboard tiles). --gx/--gy are set on mousemove; it sits
   above the tile background but below all text/children. */
.hub-glow{position:relative;overflow:hidden}
.hub-glow::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;opacity:0;
  background:radial-gradient(120px circle at var(--gx, 50%) var(--gy, 40%), rgba(232,80,10,0.08), transparent 68%);
  transition:opacity .3s ease}
.hub-glow:hover::before{opacity:1}
.hub-glow > *{position:relative;z-index:1}
@media (prefers-reduced-motion: reduce){.hub-glow::before{transition:none}}
.hub-hubtile.neutral{border-top-color:#a89a86}
.hub-expandbtn{position:absolute;top:14px;right:14px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--muted);font-size:17px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s ease}
.hub-expandbtn:hover{color:var(--orange);border-color:var(--orange)}
/* Subtle side arrow beside the hub titles (opens the full view) */
.hh-arrow{display:inline-flex;align-items:center;justify-content:center;color:var(--muted);opacity:.55;transition:opacity .15s ease,transform .15s ease}
.hh-arrow svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hub-hubtile:hover .hh-arrow{opacity:1;transform:translateX(3px);color:var(--orange)}
.hub-hubtile.neutral:hover .hh-arrow{color:#c9bcaa}
/* Condensed New Project pill: "+" that expands to reveal the label */
.np-pill{flex:0 0 auto;display:inline-flex;align-items:center;height:38px;border-radius:19px;background:rgba(90,191,128,0.14);border:1.5px solid #5ABF80;color:#5ABF80;cursor:pointer;overflow:hidden;padding:0;transition:box-shadow .2s ease}
.np-pill:hover{box-shadow:0 0 14px rgba(90,191,128,0.35)}
.np-plus{flex:0 0 auto;width:36px;height:38px;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:400;line-height:1}
.np-label{max-width:0;overflow:hidden;white-space:nowrap;font-size:12px;font-weight:800;transition:max-width .3s ease,padding .3s ease}
.np-pill.open .np-label,.np-pill:hover .np-label{max-width:150px;padding-right:16px}
/* Project ⇄ Client flip switch — icon-only, reveals its label on hover like the
   New Project pill. Orange when it will switch to the Project Hub, tan when it
   will switch to the Client Hub. */
.hub-switch-pill{background:rgba(232,80,10,0.14);border-color:var(--orange);color:var(--orange)}
.hub-switch-pill:hover{box-shadow:0 0 14px rgba(232,80,10,0.35)}
.hub-switch-pill.neutral{background:rgba(168,154,134,0.16);border-color:#a89a86;color:#c9bcaa}
.hub-switch-pill.neutral:hover{box-shadow:0 0 14px rgba(168,154,134,0.35)}
/* Orange app-menu (≡) circle + the app shortcuts it expands to its left */
.hub-menu-pill{background:rgba(232,80,10,0.14);border-color:var(--orange);color:var(--orange)}
.hub-menu-pill:hover,.hub-menu-pill.active{box-shadow:0 0 14px rgba(232,80,10,0.4)}
@keyframes hubAppIn{from{opacity:0;transform:translateX(14px) scale(.8)}to{opacity:1;transform:none}}
.hub-app-pill{animation:hubAppIn .26s cubic-bezier(.34,.75,.35,1) backwards}
/* Switching hubs flips each card in on its left edge, staggered left→right, so
   the orange project cards give way to the gray client cards (and back). */
@keyframes hubCardFlip{0%{transform:perspective(700px) rotateY(-90deg);opacity:0}55%{opacity:1}100%{transform:perspective(700px) rotateY(0);opacity:1}}
.hub-cardflip{animation:hubCardFlip .45s cubic-bezier(.34,.75,.35,1) backwards;transform-origin:left center;will-change:transform}
@media (prefers-reduced-motion: reduce){.hub-cardflip{animation:none}}
/* Dashboard open animations: Media Moment / Day in Review / Team Today drop in
   from the top; Project Hub flies in from the left, Client Hub from the right.
   fill-mode:backwards holds the start frame during any delay and then releases
   the element to its normal styles (so the hubtile hover-lift still works). */
@keyframes hubDropIn{from{opacity:0;transform:translateY(-26px)}to{opacity:1;transform:none}}
@keyframes hubFlyLeft{from{opacity:0;transform:translateX(-52px)}to{opacity:1;transform:none}}
@keyframes hubFlyRight{from{opacity:0;transform:translateX(52px)}to{opacity:1;transform:none}}
.hub-anim-drop{animation:hubDropIn .6s cubic-bezier(.22,.61,.36,1) backwards}
.hub-anim-left{animation:hubFlyLeft .62s cubic-bezier(.22,.61,.36,1) backwards}
.hub-anim-right{animation:hubFlyRight .62s cubic-bezier(.22,.61,.36,1) backwards}
@media (prefers-reduced-motion: reduce){
  .hub-anim-drop,.hub-anim-left,.hub-anim-right{animation:none}
}
`;

// Orange/neutral status palette for the hub (keeps the rest of the app untouched)
const HUB_STATUS = { RFP: '#c8873c', Draft: '#8a8f98', Sent: '#a89a86', Live: '#E8500A', Dead: '#e05252', Reconcile: '#c9a35c', Reconciled: '#a89a86', Closed: '#8a8f98' };

// Minimal monochrome nav icons (stroke = currentColor)
const NAV_ICONS = {
  view: <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  home: <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/></svg>,
  calendar: <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>,
  reports: <svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>,
  team: <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1"/><path d="M16.5 5.3a3.2 3.2 0 0 1 0 6.1"/><path d="M21.5 20v-1a5 5 0 0 0-3.2-4.4"/></svg>,
};

function useScrolled(threshold = 44) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', on, { passive: true });
    on();
    return () => window.removeEventListener('scroll', on);
  }, [threshold]);
  return scrolled;
}

// Fade/slide a section in the first time it scrolls into view
function Reveal({ children, style }) {
  const ref = React.useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`hub-reveal${seen ? ' in' : ''}`} style={style}>{children}</div>;
}

// Persistent bottom nav shared by the Dashboard and the pages it links to
// (Calendar, Reports, Team). On the Dashboard (`home`) the first slot is the
// View toggle; on the linked pages it becomes a Home button back to the
// Dashboard. Calendar/Reports/Team follow the same role permissions everywhere
// and derive isCrew/isFinance from the signed-in user, so any page can drop in
// <HubBottomNav /> with no extra wiring. It injects its own CSS so it renders
// correctly on pages that don't include the full HUB_CSS (Calendar/Reports/Team).
export function HubBottomNav({ raised = false }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const isFinance = user?.role === 'FINANCE';
  const scrolled = useScrolled();
  const path = loc.pathname;
  const items = [
    { key: 'home', label: 'Home', icon: NAV_ICONS.home, to: '/', active: path === '/' },
    ...(!isFinance ? [{ key: 'calendar', label: 'Calendar', icon: NAV_ICONS.calendar, to: '/crew-calendar', active: path.startsWith('/crew-calendar') }] : []),
    { key: 'reports', label: 'Reports', icon: NAV_ICONS.reports, to: '/reports', active: path.startsWith('/reports') },
    { key: 'team', label: 'Team', icon: NAV_ICONS.team, to: '/team', active: path.startsWith('/team') },
  ];
  const activeKey = (items.find(i => i.active) || {}).key;
  const btnRefs = useRef({});
  const [bubble, setBubble] = useState(null);
  useEffect(() => {
    const measure = () => {
      const el = btnRefs.current[activeKey];
      setBubble(el ? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight } : null);
    };
    measure();
    const t = setTimeout(measure, 320);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [activeKey, scrolled, items.length]);
  return (
    <>
      <style>{NAV_CSS}</style>
      <div className={`hub-bottomnav${scrolled ? ' condensed' : ''}${raised ? ' raised' : ''}`}>
        {bubble && <div className="hub-navbubble" style={{ left: bubble.left, top: bubble.top, width: bubble.width, height: bubble.height }} />}
        {items.map(it => (
          <button key={it.key} ref={el => { btnRefs.current[it.key] = el; }}
            className={`hub-navitem${it.active ? ' active' : ''}`} onClick={() => nav(it.to)}>
            {it.icon}<span className="lbl">{it.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

// Self-contained styles for the bottom nav (duplicated from HUB_CSS so the nav
// works on any page).
const NAV_CSS = `
.hub-bottomnav{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:120;display:flex;align-items:stretch;gap:2px;padding:8px 12px;border-radius:26px;
  background:rgba(30,27,23,0.72);backdrop-filter:blur(22px) saturate(1.7);-webkit-backdrop-filter:blur(22px) saturate(1.7);
  border:1px solid rgba(255,255,255,0.12);box-shadow:0 12px 40px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.12);transition:padding .28s ease}
.hub-bottomnav.condensed{padding:7px 9px}
.hub-bottomnav.raised{bottom:96px}
@media (max-width:700px){.hub-bottomnav.raised{bottom:104px}}
.hub-navitem{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:none;border:none;color:var(--muted);
  font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;padding:7px 16px;border-radius:18px;transition:color .15s ease,padding .28s ease}
.hub-navitem:hover{color:var(--text)}
.hub-navitem.active{color:var(--orange)}
.hub-navitem svg{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.hub-navitem .lbl{max-height:12px;opacity:1;overflow:hidden;transition:max-height .28s ease,opacity .2s ease}
.hub-bottomnav.condensed .hub-navitem{padding:9px 13px}
.hub-bottomnav.condensed .hub-navitem .lbl{max-height:0;opacity:0}
.hub-navbubble{position:absolute;z-index:0;background:rgba(255,255,255,0.10);border-radius:18px;pointer-events:none;
  transition:left .3s cubic-bezier(.34,1.3,.5,1),width .3s cubic-bezier(.34,1.3,.5,1),top .3s ease,height .3s ease}
`;

function NewProjectFab({ onClick }) {
  return (
    <button className="hub-fab" onClick={onClick} title="Start a new project">
      <span className="plus">+</span>
      <span className="fab-label">Start New Project</span>
    </button>
  );
}

// Condensed "+" that expands to "New Project" on hover (desktop) or first tap
// (mobile); the next click starts a new project.
function NewProjectPill({ onClick }) {
  const [open, setOpen] = useState(false);
  return (
    <button className={`np-pill${open ? ' open' : ''}`} title="Start a new project"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onClick={() => { if (open) onClick(); else setOpen(true); }}>
      <span className="np-plus">+</span>
      <span className="np-label">New Project</span>
    </button>
  );
}

// V1-approval celebration. Recipients get a queue of gold-confetti drops (one
// per congratulator); everyone else gets a ringing-gong announcement with a
// reciprocal "send congrats" button. Mounted on the dashboard.
function V1Celebration() {
  const [data, setData] = useState(null);   // { announcements, drops }
  const [ai, setAi] = useState(0);          // announcement index
  const [di, setDi] = useState(0);          // drop index
  const [thanks, setThanks] = useState(false);
  useEffect(() => { api.getCelebrations().then(setData).catch(() => {}); }, []);

  const drops = data?.drops || [];
  const anns = data?.announcements || [];
  const recipientMode = drops.length > 0;

  // Recipient: rain gold confetti each time a new drop is shown.
  useEffect(() => {
    if (recipientMode && di < drops.length) moneyConfetti(5000, { money: false, count: 300 });
  }, [recipientMode, di, drops.length]);

  if (!data) return null;
  const first = n => (n || '').trim().split(/\s+/)[0] || 'them';

  const wrap = { position:'fixed', inset:0, zIndex:400, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 };
  const card = { background:'var(--bg2)', border:'1px solid #e6c229', borderTop:'3px solid #e6c229', borderRadius:16, width:'100%', maxWidth:440, padding:'28px 26px', textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.6)' };

  // ── Recipient: one confetti drop per congratulator ──
  if (recipientMode) {
    if (di >= drops.length) return null;
    const d = drops[di];
    const finish = async () => {
      if (di + 1 >= drops.length) { try { await api.markDropsSeen(drops.map(x => x.id)); } catch {} }
      setDi(i => i + 1);
    };
    return (
      <div style={wrap}>
        <style>{V1_CSS}</style>
        <div style={card}>
          <div style={{ fontSize:46 }}>🎉</div>
          <div style={{ fontSize:19, fontWeight:800, margin:'8px 0 6px', color:'#e6c229' }}>{d.celebrator_name} is celebrating your V1 approval!</div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>{d.edit_title}{d.project_title ? ` — ${d.project_title}` : ''}</div>
          <button className="btn btn-sm" onClick={finish}
            style={{ marginTop:20, background:'#e6c229', border:'1px solid #e6c229', color:'#0a0a08', fontWeight:800 }}>
            {di + 1 < drops.length ? `Next (${di + 1} of ${drops.length}) →` : 'Woohoo!'}
          </button>
        </div>
      </div>
    );
  }

  // ── Everyone else: gong announcement + reciprocal congrats ──
  if (ai >= anns.length) return null;
  const a = anns[ai];
  const advance = () => { setThanks(false); setAi(i => i + 1); };
  const congrats = async () => {
    try { await api.celebrateApproval(a.id); } catch {}
    moneyConfetti(4000, { money: false, count: 300 });
    setThanks(true);
    setTimeout(advance, 2600);
  };
  const skip = async () => { try { await api.markAnnouncementSeen(a.id); } catch {} advance(); };
  return (
    <div style={wrap}>
      <style>{V1_CSS}</style>
      <div style={card}>
        <div className="v1-gong" style={{ color:'#e6c229', display:'inline-flex' }}><GongIcon size={54} /></div>
        {thanks ? (
          <div style={{ fontSize:18, fontWeight:800, margin:'10px 0', color:'#e6c229' }}>Congrats sent to {first(a.recipient_name)}! 🎉</div>
        ) : (
          <>
            <div style={{ fontSize:9, fontWeight:900, letterSpacing:'0.18em', color:'#e6c229', marginTop:8 }}>V1 APPROVAL</div>
            <div style={{ fontSize:19, fontWeight:800, margin:'6px 0 6px' }}>{a.recipient_name} received approval on a V1!</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:20 }}>{a.edit_title}{a.project_title ? ` — ${a.project_title}` : ''}{a.project_code ? ` (${a.project_code})` : ''}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button className="btn btn-sm" onClick={congrats}
                style={{ background:'#e6c229', border:'1px solid #e6c229', color:'#0a0a08', fontWeight:800, padding:'9px 14px' }}>
                Tell {first(a.recipient_name)} congrats on the V1 approval!
              </button>
              <button className="btn btn-ghost btn-sm" onClick={skip} style={{ color:'var(--muted)' }}>Dismiss</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const V1_CSS = `@keyframes v1GongRing{0%,55%,100%{transform:translateX(0) rotate(0)}8%{transform:translateX(-2.5px) rotate(-2.5deg)}16%{transform:translateX(2.5px) rotate(2.5deg)}24%{transform:translateX(-2px) rotate(-1.5deg)}32%{transform:translateX(2px) rotate(1.5deg)}40%{transform:translateX(-1px)}48%{transform:translateX(1px)}}
.v1-gong{transform-origin:50% 50%;animation:v1GongRing 1.6s ease-in-out infinite}
@media(prefers-reduced-motion:reduce){.v1-gong{animation:none}}`;

export default function Hub() {
  const nav = useNavigate();
  const { user, setUser, realUser, preview, setPreview } = useAuth();
  const isCrew = ['CREW','AGENCY'].includes(user?.role);
  const isFinance = user?.role === 'FINANCE';
  const [showNewProject, setShowNewProject] = useState(false);
  const isAgency = user?.role === 'AGENCY';
  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'there';

  // Mobile scroll parallax: as the page scrolls, slide the tagline off to the
  // left and the Media Moment off to the right (the tiles below are layered on
  // top and scroll over them). Driven straight off refs to avoid re-rendering
  // the whole dashboard on every scroll frame.
  const heroLeftRef = useRef(null);   // heading + tagline slide left
  const mmRef = useRef(null);         // media moment slides right
  useEffect(() => {
    let raf = null;
    const apply = () => {
      raf = null;
      const mob = window.innerWidth <= 700;
      const s = window.scrollY;
      if (heroLeftRef.current) {
        heroLeftRef.current.style.transform = mob ? `translate3d(${-s * 1.2}px,0,0)` : '';
        heroLeftRef.current.style.opacity = mob ? String(Math.max(0, 1 - s / 140)) : '';
      }
      if (mmRef.current) {
        mmRef.current.style.transform = mob ? `translate3d(${s * 1.25}px,0,0)` : '';
        mmRef.current.style.opacity = mob ? String(Math.max(0, 1 - s / 160)) : '';
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    apply();
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', position:'relative' }}>
      <style>{HUB_CSS}</style>
      <V1Celebration />
      {(preview || realUser?.role === 'ADMIN') && (
        <div className="hub-topbar">
          {preview && (
            <button className="btn btn-ghost btn-sm" title="Stop previewing and return to your admin view"
              onClick={() => setPreview('')}
              style={{ color:'#a78bfa', border:'1px solid #a78bfa' }}>Previewing as {roleLabel(preview)} · Exit</button>
          )}
          {realUser?.role === 'ADMIN' && <NewUserAlert onOpen={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} />}
        </div>
      )}

        <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'8px 16px 120px' }}>
          <div style={{ width:'100%', maxWidth:1150 }}>
            <div className="hub-masthead">
              <img className="hub-logo-top" src="/unbridled-logo.png" alt="Unbridled Media" />
            </div>
            <div className="dash-hero">
              <div className="hub-header" ref={heroLeftRef}>
                <h1 className="hub-h1">Hey {firstName},</h1>
                <div className="hub-tagline"><HubGreeting /></div>
              </div>
              {!isCrew && <div className="hub-anim-drop" ref={mmRef}><MediaMomentOrbit /></div>}
            </div>
            <div className="dash-scroll">
              <TripPrompt />
              <WobBanner />
              <FunFactPrompt />
              {/* Solutions + Crew both get the project-scroll dashboard (all projects, no finance) */}
              {isCrew && <SolutionsHub />}
              {!isAgency && !isCrew && !isFinance && <HubProjects onNewProject={() => setShowNewProject(true)} />}
              {isFinance && <HubProjects finance />}

              <Reveal><HubDashboard /></Reveal>
            </div>
          </div>
        </div>

      <HubBottomNav />

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={p => { setShowNewProject(false); nav(`/project-view/${p.id}`); }}
        />
      )}
      {realUser?.role === 'ADMIN' && <AdminPanel user={realUser} />}
    </div>
  );
}

// Single Admin button (above Sign out) that unfolds User Management and
// Automations — admin role only.
function AdminPanel({ user }) {
  const { preview, setPreview } = useAuth();
  const [open, setOpen] = useState(false);
  async function backup() {
    try {
      const r = await fetch('/api/admin/backup', { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
      if (!r.ok) throw new Error('Backup failed');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `freepro-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { alert(e.message); }
  }
  return (
    <div style={{ padding:'0 26px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      {open && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'stretch', gap:8, width:'100%', maxWidth:300 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <UserManagement user={user} />
            <Automations />
          </div>
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
            <div style={{ fontSize:11, fontWeight:800, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:12 }}>Platform</div>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Preview as role</div>
            <select value={preview || ''} title="Preview the platform as another role"
              onChange={e => setPreview(e.target.value)}
              style={{ width:'100%', fontSize:12, padding:'6px 8px', borderRadius:8, background:'var(--bg)', color: preview ? '#a78bfa' : 'var(--muted)', border:`1px solid ${preview ? '#a78bfa' : 'var(--border)'}`, marginBottom:12 }}>
              <option value="">View as… (off)</option>
              {['PRODUCER', 'FINANCE', 'CREW', 'AGENCY'].map(r => <option key={r} value={r}>View as {roleLabel(r)}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" style={{ width:'100%' }} onClick={backup}
              title="Download a full database backup (all projects, budgets, contracts, roster)">⬇ Backup Database</button>
          </div>
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        style={{ background:'none', border:'1px solid var(--border)', borderRadius:14, padding:'4px 14px', color:'var(--muted)', fontSize:10, fontWeight:700, letterSpacing:'.05em', cursor:'pointer' }}>
        ⚙ Admin {open ? '▾' : '▸'}
      </button>
    </div>
  );
}
