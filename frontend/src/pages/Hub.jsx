import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import { NewProjectModal } from './Finance.jsx';
import { recentProjectTimes } from '../utils/recentProjects.js';

const TILES = [
  {
    key: 'profi',
    title: 'ProFi',
    tagline: 'Project Finance · In High Fidelity',
    desc: 'Client-ready budgets, vendor cost control, and final reconciliation — mixed and mastered.',
    accent: '#5ABF80',
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
    accent: '#9DC183',
    icon: '🥑',
    to: '/avo',
    status: null,
  },
  {
    key: 'team',
    title: 'Team Management',
    tagline: 'People Operations',
    desc: 'PTO & OOO requests, approvals, and team availability.',
    accent: '#4a9eff',
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
  return (
    <div style={{ textAlign:'center', fontSize:15, fontWeight:700, color:'var(--tan)', margin:'0 auto 12px', maxWidth:560, lineHeight:1.4 }}>
      {text}
    </div>
  );
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
        {trip.project.city && <span style={{ color:'var(--muted)' }}> · {[trip.project.city, trip.project.state].filter(Boolean).join(', ')}</span>}
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
            style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.13, pointerEvents:'none', borderRadius:'inherit' }} />
        )}
        {fact.image?.type === 'emoji' && (
          <div aria-hidden style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:150, opacity:0.12, pointerEvents:'none', transform:'rotate(-8deg)' }}>
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
  const ROLES = ['PENDING', 'CREW', 'AGENCY', 'CLIENT', 'FINANCE', 'PRODUCER', 'ADMIN'];
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
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
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

// Project View mode: every project as a tile, sorted by code
function HubProjects() {
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
  return (
    <div className="hub-2col" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', border:'1px solid var(--border)', borderRadius:12, marginBottom:22, overflow:'hidden' }}>
      {/* Project Hub — aligns with Day in Review below */}
      <div style={{ padding:'16px 18px', borderRight:'1px solid var(--border)', minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <div onClick={() => nav('/project-view')} title="Open the full Project View — every project"
            style={{ fontSize:13, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', textDecoration:'underline', textUnderlineOffset:3, textDecorationColor:'var(--border)' }}>Project Hub</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code, title, client…" style={{ flex:1, minWidth:0 }} />
        </div>
        {!projects && <div className="empty">Loading…</div>}
        {projects && shown.length === 0 && <div className="empty">No projects match.</div>}
        {shown.length > 0 && (
        <div className="hub-scroll" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, WebkitMaskImage:SCROLL_FADE, maskImage:SCROLL_FADE }}>
          {shown.map(p => (
            <div key={p.id} onClick={() => nav(`/project-view/${p.id}`)}
              style={{ flex:'0 0 auto', width:180, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid rgba(232,232,232,0.35)', borderRadius:10, padding:'11px 13px', cursor:'pointer', transition:'transform .15s ease' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <div style={{ fontSize:10, fontWeight:800, color:'var(--muted)', letterSpacing:'0.04em' }}>{p.code}</div>
              <div style={{ fontSize:12.5, fontWeight:800, margin:'3px 0 2px' }}>{p.title}</div>
              <div style={{ fontSize:10.5, color:'var(--muted)' }}>{p.client}</div>
              <div style={{ display:'flex', gap:5, marginTop:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:9, fontWeight:800, color: STATUS_COLORS[p.budget_status] || '#5ABF80', border: `1px solid ${STATUS_COLORS[p.budget_status] || '#5ABF80'}55`, borderRadius:10, padding:'2px 8px' }}>{p.budget_status || 'No budget'}</span>
                {(p.shoots || []).length > 0 && <span style={{ fontSize:9, fontWeight:800, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.shoots.length} shoot{p.shoots.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
          ))}
        </div>
        )}
      </div>
      {/* Client Hub — aligns with Team Today below */}
      <div style={{ padding:'16px 18px', minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <div onClick={() => nav('/project-view')} title="Open the full Project View — every client"
            style={{ fontSize:13, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap', textDecoration:'underline', textUnderlineOffset:3, textDecorationColor:'var(--border)' }}>Client Hub</div>
          <input value={cq} onChange={e => setCq(e.target.value)} placeholder="Search clients…" style={{ flex:1, minWidth:0 }} />
        </div>
        {clients.length === 0
          ? <div className="empty">No clients yet.</div>
          : (
          <div className="hub-scroll" style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:8, WebkitMaskImage:SCROLL_FADE, maskImage:SCROLL_FADE }}>
            {shownClients.map(c => (
              <div key={c.name} onClick={() => nav(`/project-view/client/${encodeURIComponent(c.name)}`)}
                style={{ flex:'0 0 auto', width:180, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid rgba(74,158,255,0.5)', borderRadius:10, padding:'11px 13px', cursor:'pointer', transition:'transform .15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize:12.5, fontWeight:800 }}>{c.name}</div>
                <div style={{ fontSize:10.5, color:'var(--muted)', margin:'3px 0 8px' }}>{c.projects.length} project{c.projects.length !== 1 ? 's' : ''}</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                  {c.projects.slice(0, 4).map(p => (
                    <span key={p.id} style={{ fontSize:9, fontWeight:800, color:'#4a9eff', border:'1px solid rgba(74,158,255,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.code}</span>
                  ))}
                  {c.projects.length > 4 && <span style={{ fontSize:9, color:'var(--muted)' }}>+{c.projects.length - 4} more</span>}
                </div>
              </div>
            ))}
          </div>
          )}
      </div>
    </div>
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
    <div className="hub-dash" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:22 }}>
      <div style={card}>
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
        {day && (
          <>
            <div style={{ ...hdr, fontSize:10, margin:'16px 0 6px', display:'flex', alignItems:'center', gap:8 }}>
              My Tasks
              <button onClick={openAddTask} title="Add a task to your list"
                style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:10,
                  padding:'1px 8px', fontSize:9, fontWeight:800, cursor:'pointer', textTransform:'none', letterSpacing:0 }}>
                + Add New
              </button>
              {(day.tasks || []).some(t => !hiddenTasks.includes(t.id) && t.due_date && String(t.due_date).slice(0, 10) === (day?.date || new Date().toISOString().slice(0, 10))) && (
                <span style={{ background:'rgba(232,80,10,0.16)', border:'1px solid var(--orange)', color:'var(--orange)', borderRadius:10, padding:'1px 8px', fontSize:9, fontWeight:800, textTransform:'none', letterSpacing:0 }}>
                  (!) Task Due Today
                </span>
              )}
            </div>
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
          </>
        )}
      </div>

      <div style={{ ...card, position:'relative', overflow:'hidden' }}>
        <DailyFactBlob />
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ ...hdr, marginBottom:0 }}>Team Today</div>
          <button onClick={() => nav('/team')}
            style={{ background:'rgba(74,158,255,0.14)', border:'1.5px solid #4a9eff', color:'#4a9eff',
              borderRadius:12, padding:'6px 14px', fontSize:11, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            Team Management
          </button>
        </div>
        {!team && <div style={{ fontSize:11, color:'var(--muted)' }}>Loading…</div>}
        {team && team.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>No Unbridled team members on the roster yet.</div>}
        <div className="team-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', columnGap:18 }}>
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

export default function Hub() {
  const nav = useNavigate();
  const { user, setUser, realUser, preview, setPreview } = useAuth();
  const isCrew = ['CREW','AGENCY'].includes(user?.role);
  const isFinance = user?.role === 'FINANCE';
  const [mode, setMode] = useState(() => localStorage.getItem('hub_mode') || 'ops'); // 'projects' | 'ops'
  const setHubMode = m => { setMode(m); localStorage.setItem('hub_mode', m); };
  const [showNewProject, setShowNewProject] = useState(false);
  // Team Management sits below as a constant, elongated tile
  const teamTile = TILES.find(t => t.key === 'team');
  const isAgency = user?.role === 'AGENCY';
  const opsTiles = isAgency
    ? TILES.filter(t => t.key !== 'profi' && t.key !== 'team')
    : isCrew
    ? TILES.filter(t => t.key !== 'profi' && t.key !== 'team').map(t => t.key === 'freepro' ? { ...t, to: '/crew-views', tagline: 'Crew Views' } : t)
    : isFinance
    ? TILES.filter(t => t.key === 'profi')
    : TILES.filter(t => t.key !== 'team');
  const tiles = opsTiles;

  const [viewMenu, setViewMenu] = useState(false);
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div className="hub-head" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10, position:'relative' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, letterSpacing:'0.02em' }}>Unbridled Media</div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:3 }}>Operating Platform</div>
        </div>
        <div className="hub-head-right" style={{ display:'flex', alignItems:'center', gap:12 }}>
          {realUser?.role === 'ADMIN' && <NewUserAlert onOpen={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} />}
          {realUser?.role === 'ADMIN' && (
            <select value={preview || ''} title="Preview the platform as another role"
              onChange={e => setPreview(e.target.value)}
              style={{ width:'auto', fontSize:11, padding:'5px 8px', borderRadius:8, background:'var(--bg2)', color: preview ? '#a78bfa' : 'var(--muted)', border:`1px solid ${preview ? '#a78bfa' : 'var(--border)'}` }}>
              <option value="">View as…</option>
              {['PRODUCER', 'FINANCE', 'CREW', 'AGENCY', 'CLIENT'].map(r => <option key={r} value={r}>View as {r}</option>)}
            </select>
          )}
          {user?.role === 'ADMIN' && (
            <button className="btn btn-ghost btn-sm" title="Download a full database backup (all projects, budgets, contracts, roster)"
              onClick={async () => {
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
              }}>⬇ Backup</button>
          )}
        </div>
      </div>


        <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 16px 60px' }}>
          <div style={{ width:'100%', maxWidth:1150 }}>
            <div style={{ textAlign:'center', marginBottom:14 }}>
              <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:52, filter:'brightness(0) invert(1)', opacity:0.97, display:'inline-block' }} />
            </div>
            <HubGreeting />
            <TripPrompt />
            <WobBanner />
            <FunFactPrompt />
            {!isCrew && (
              <div className="hub-controls" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:20 }}>
                {/* View ▾ · Calendar · Reports — one pill */}
                <div style={{ position:'relative', display:'inline-flex', border:'1px solid var(--border)', borderRadius:20, overflow:'visible' }}>
                  {!isFinance && (
                    <button onClick={() => setViewMenu(m => !m)}
                      style={{ background:'rgba(232,80,10,0.16)', border:'none', borderRight:'1px solid var(--border)',
                        color:'var(--orange)', fontSize:12, fontWeight:800, padding:'9px 20px', cursor:'pointer', letterSpacing:'0.03em',
                        borderRadius:'20px 0 0 20px', boxShadow:'0 0 16px rgba(232,80,10,0.35)' }}>
                      View {viewMenu ? '▾' : '▸'}
                    </button>
                  )}
                  {!isFinance && (
                    <button onClick={() => nav('/crew-calendar')}
                      style={{ background:'transparent', border:'none', borderRight:'1px solid var(--border)',
                        color:'#5ABF80', fontSize:12, fontWeight:800, padding:'9px 20px', cursor:'pointer', letterSpacing:'0.03em' }}>
                      Calendar
                    </button>
                  )}
                  <button onClick={() => nav('/reports')}
                    style={{ background:'transparent', border:'none',
                      color:'#e6c229', fontSize:12, fontWeight:800, padding:'9px 20px', cursor:'pointer', letterSpacing:'0.03em',
                      borderRadius: isFinance ? 20 : '0 20px 20px 0' }}>
                    Reports
                  </button>
                  {viewMenu && (
                    <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:60, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'0 10px 28px rgba(0,0,0,0.55)', minWidth:170 }}>
                      {[['projects', 'Project View'], ['ops', 'Operations View']].map(([k, label]) => (
                        <button key={k} onClick={() => { setHubMode(k); setViewMenu(false); }}
                          style={{ display:'block', width:'100%', textAlign:'left', background: mode === k ? 'rgba(232,80,10,0.16)' : 'transparent', border:'none',
                            color: mode === k ? 'var(--orange)' : 'var(--muted)', fontSize:12, fontWeight:800, padding:'10px 16px', cursor:'pointer' }}>
                          {label}{mode === k ? ' ✓' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {!isFinance && (
                <button onClick={() => setShowNewProject(true)} className="hub-newproj"
                  style={{ background:'#000', color:'#5ABF80', border:'1px solid #5ABF80', borderRadius:22,
                    padding:'10px 24px', fontSize:12.5, fontWeight:800, letterSpacing:'0.03em', cursor:'pointer',
                    boxShadow:'0 0 16px rgba(90,191,128,0.55)', transition:'box-shadow .15s ease, transform .15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 24px rgba(90,191,128,0.85)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 16px rgba(90,191,128,0.55)'; e.currentTarget.style.transform = 'none'; }}>
                  + Start New Project
                </button>
                )}
              </div>
            )}
            {user?.role === 'CREW' && (
              <div className="hub-controls" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, flexWrap:'wrap', marginBottom:20 }}>
                {/* Calendar · Reports — crew only reach FreePro & Avo, so no View toggle */}
                <div style={{ display:'inline-flex', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>
                  <button onClick={() => nav('/crew-calendar')}
                    style={{ background:'transparent', border:'none', borderRight:'1px solid var(--border)',
                      color:'#5ABF80', fontSize:12, fontWeight:800, padding:'9px 20px', cursor:'pointer', letterSpacing:'0.03em', borderRadius:'20px 0 0 20px' }}>
                    Calendar
                  </button>
                  <button onClick={() => nav('/reports')}
                    style={{ background:'transparent', border:'none',
                      color:'#e6c229', fontSize:12, fontWeight:800, padding:'9px 20px', cursor:'pointer', letterSpacing:'0.03em', borderRadius:'0 20px 20px 0' }}>
                    Reports
                  </button>
                </div>
              </div>
            )}
            {!isCrew && !isFinance && mode === 'projects' && <HubProjects />}
            {(isCrew || isFinance || mode === 'ops') && (
            <div className="hub-tiles" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
              {tiles.map(t => {
                const clickable = !!t.to;
                return (
                  <div key={t.key}
                    onClick={() => clickable && nav(t.to)}
                    style={{
                      background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${t.accent}`,
                      borderRadius:12, padding:'26px 24px 22px', cursor: clickable ? 'pointer' : 'default',
                      opacity: clickable ? 1 : 0.65, transition:'transform .15s ease, border-color .15s ease',
                      display:'flex', flexDirection:'column', minHeight:200,
                    }}
                    onMouseEnter={e => { if (clickable) e.currentTarget.style.transform = 'translateY(-3px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                  >
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:`${t.accent}22`, color:t.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:800 }}>
                        {t.icon}
                      </div>
                      {t.status && (
                        <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:t.accent, border:`1px solid ${t.accent}55`, borderRadius:20, padding:'3px 10px' }}>
                          {t.status}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:17, fontWeight:800 }}>
                      {t.em ? <>Free<em style={{ color:'var(--orange)', fontStyle:'normal' }}>Pro</em></> : t.title}
                    </div>
                    <div style={{ fontSize:10, color:t.accent, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', margin:'3px 0 10px' }}>{t.tagline}</div>
                    <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.55, flex:1 }}>{t.desc}</div>
                    {clickable && <div style={{ fontSize:11, color:t.accent, fontWeight:600, marginTop:14 }}>Open →</div>}
                  </div>
                );
              })}
            </div>
            )}

            <HubDashboard />
          </div>
        </div>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={p => { setShowNewProject(false); nav(`/project-view/${p.id}`); }}
        />
      )}
      {user?.role === 'ADMIN' && <AdminPanel user={user} />}
    </div>
  );
}

// Single Admin button (above Sign out) that unfolds User Management and
// Automations — admin role only.
function AdminPanel({ user }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ padding:'0 26px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
      {open && (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <UserManagement user={user} />
          <Automations />
        </div>
      )}
      <button onClick={() => setOpen(o => !o)}
        style={{ background:'none', border:'1px solid var(--border)', borderRadius:14, padding:'4px 14px', color:'var(--muted)', fontSize:10, fontWeight:700, letterSpacing:'.05em', cursor:'pointer' }}>
        ⚙ Admin {open ? '▾' : '▸'}
      </button>
    </div>
  );
}
