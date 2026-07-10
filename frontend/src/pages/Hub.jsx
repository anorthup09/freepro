import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import { NewProjectModal } from './Finance.jsx';

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
  function pickAttachment(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setAttachment(ev.target.result);
    reader.readAsDataURL(file);
  }
  const openCount = items.filter(i => !i.done).length;
  return (
    <>
      {variant === 'banner' ? (
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, padding:'14px 16px 0' }}>
          <button onClick={toggle}
            style={{ background:'#e05252', border:'2px solid #ff6b6b', color:'#fff', borderRadius:12, padding:'10px 26px', fontSize:14, fontWeight:900, letterSpacing:'0.03em', cursor:'pointer', boxShadow:'0 4px 18px rgba(224,82,82,0.35)' }}>
            ! Testing - Feedback and Features !
          </button>
          {openCount > 0 && (
            <span onClick={toggle} title={`${openCount} unresolved item${openCount === 1 ? '' : 's'}`}
              style={{ background:'#e05252', color:'#fff', borderRadius:'50%', minWidth:26, height:26, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, cursor:'pointer', boxShadow:'0 2px 10px rgba(224,82,82,0.5)', padding:'0 6px' }}>
              {openCount}
            </span>
          )}
        </div>
      ) : (
        <button onClick={toggle} className="no-print" title="Testing — leave feedback or a feature request"
          style={{ position:'fixed', top:8, right:10, zIndex:125, background:'#e05252', border:'1px solid #ff6b6b', color:'#fff',
            borderRadius:12, padding:'3px 12px', fontSize:10, fontWeight:900, letterSpacing:'0.03em', cursor:'pointer', boxShadow:'0 2px 10px rgba(224,82,82,0.45)', display:'flex', alignItems:'center', gap:6 }}>
          Feedback{openCount > 0 && <span style={{ background:'#fff', color:'#e05252', borderRadius:8, padding:'0 6px', fontSize:9, fontWeight:900 }}>{openCount}</span>}
        </button>
      )}
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:130, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ width:'100%', maxWidth:640, maxHeight:'85vh', display:'flex', flexDirection:'column', background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #e05252', borderRadius:12, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:14, fontWeight:800 }}>Testing — Feedback & Features <span style={{ color:'var(--muted)', fontWeight:400 }}>· {openCount} open</span></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
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
                style={{ background:'#e05252', border:'none', color:'#fff', borderRadius:8, padding:'7px 16px', fontSize:12, fontWeight:800, cursor:'pointer', opacity: text.trim() ? 1 : 0.5 }}>
                Add
              </button>
            </div>
            <div style={{ overflowY:'auto', padding:'6px 18px 14px' }}>
              {items.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', padding:'12px 0' }}>Nothing yet — this is the one running list for testing feedback and feature requests.</div>}
              {items.map(i => (
                <div key={i.id} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.05)', opacity: i.done ? 0.5 : 1 }}>
                  <input type="checkbox" checked={i.done || false} style={{ width:'auto', accentColor:'#5ABF80', marginTop:2 }}
                    onChange={async e => {
                      try { const u = await api.updateFeedback(i.id, { done: e.target.checked }); setItems(xs => xs.map(x => x.id === i.id ? u : x)); }
                      catch (er) { alert(er.message); }
                    }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, textDecoration: i.done ? 'line-through' : 'none', overflowWrap:'anywhere' }}>{i.text}</div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>{i.created_by || 'someone'} · {new Date(i.created_at).toLocaleDateString('en-US', { month:'numeric', day:'numeric' })}</div>
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
      style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#e05252', border:'1px solid #ff6b6b', color:'#fff', borderRadius:20, padding:'5px 13px', fontSize:11, fontWeight:900, letterSpacing:'0.02em', cursor:'pointer', boxShadow:'0 2px 10px rgba(224,82,82,0.4)' }}>
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
    <div style={{ padding:'0 26px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
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
    </div>
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
  const list = [...(projects || [])].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
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
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', border:'1px solid var(--border)', borderRadius:12, marginBottom:22, overflow:'hidden' }}>
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
        <div style={{ ...hdr, marginBottom:2 }}>Day in Review</div>
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

      <div style={card}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ ...hdr, marginBottom:0 }}>Team Today</div>
          <button onClick={() => nav('/team')}
            style={{ background:'rgba(74,158,255,0.14)', border:'1.5px solid #4a9eff', color:'#4a9eff',
              borderRadius:12, padding:'6px 14px', fontSize:11, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:13 }}>👥</span> Team Management
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

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <FeedbackBoard />
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10, position:'relative' }}>
        <div>
          <div style={{ fontSize:14, fontWeight:800, letterSpacing:'0.02em' }}>Unbridled Media</div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:3 }}>Operating Platform</div>
        </div>
        {!isCrew && <div className="hub-pipeline-btn" style={{ display:'flex', gap:12 }}>
          {!isFinance && <button onClick={() => nav('/crew-calendar')}
            style={{ background:'rgba(90,191,128,0.14)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:9, padding:'6px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
            Crew Calendar
          </button>}
          <button onClick={() => nav('/reports')}
            style={{ background:'rgba(230,194,41,0.12)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:9, padding:'6px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
            Reports
          </button>
        </div>}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {realUser?.role === 'ADMIN' && <NewUserAlert onOpen={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })} />}
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
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
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        </div>
      </div>


        <div style={{ flex:1, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'20px 16px 60px' }}>
          <div style={{ width:'100%', maxWidth:1150 }}>
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:38, filter:'brightness(0) invert(1)', opacity:0.95, display:'inline-block' }} />
            </div>
            {!isCrew && !isFinance && (
              <div className="hub-controls" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:20 }}>
                <div style={{ display:'inline-flex', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>
                  {[['projects', 'Project View'], ['ops', 'Operations View']].map(([k, label]) => (
                    <button key={k} onClick={() => setHubMode(k)}
                      style={{ background: mode === k ? 'rgba(232,80,10,0.16)' : 'transparent', border:'none',
                        color: mode === k ? 'var(--orange)' : 'var(--muted)', fontSize:12, fontWeight:800, padding:'9px 22px', cursor:'pointer', letterSpacing:'0.03em',
                        boxShadow: mode === k ? '0 0 16px rgba(232,80,10,0.55)' : 'none',
                        transition:'box-shadow .15s ease, color .15s ease' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowNewProject(true)}
                  style={{ background:'#000', color:'#5ABF80', border:'1px solid #5ABF80', borderRadius:22,
                    padding:'10px 24px', fontSize:12.5, fontWeight:800, letterSpacing:'0.03em', cursor:'pointer',
                    boxShadow:'0 0 16px rgba(90,191,128,0.55)', transition:'box-shadow .15s ease, transform .15s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 24px rgba(90,191,128,0.85)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 0 16px rgba(90,191,128,0.55)'; e.currentTarget.style.transform = 'none'; }}>
                  + Start New Project
                </button>
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
      {user?.role === 'ADMIN' && <UserManagement user={user} />}
    </div>
  );
}
