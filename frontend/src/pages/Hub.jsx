import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';

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

function UserManagement({ user }) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const ROLES = ['PENDING', 'CREW', 'CLIENT', 'PRODUCER', 'ADMIN'];

  async function toggle() {
    if (!open) {
      try { setUsers(await api.getUsers()); } catch (e) { alert(e.message); return; }
    }
    setOpen(s => !s);
  }

  async function changeRole(id, role) {
    try {
      const u = await api.updateUserRole(id, role);
      setUsers(us => us.map(x => x.id === id ? { ...x, role: u.role } : x));
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
        User Management ▸
      </button>
    </div>
  );
}

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
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:800 }}>Project Hub</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search code, title, client…" style={{ width:240 }} />
      </div>
      {!projects && <div className="empty">Loading…</div>}
      {projects && shown.length === 0 && <div className="empty">No projects match.</div>}
      <div className="hub-tiles" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:14 }}>
        {shown.map(p => (
          <div key={p.id} onClick={() => nav(`/project-view/${p.id}`)}
            style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid rgba(232,232,232,0.35)', borderRadius:10, padding:'16px 18px', cursor:'pointer', transition:'transform .15s ease' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
            <div style={{ fontSize:11, fontWeight:800, color:'var(--muted)', letterSpacing:'0.04em' }}>{p.code}</div>
            <div style={{ fontSize:14, fontWeight:800, margin:'4px 0 2px' }}>{p.title}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>{p.client}</div>
            <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
              <span style={{ fontSize:9, fontWeight:800, color:'#5ABF80', border:'1px solid #5ABF8055', borderRadius:10, padding:'2px 8px' }}>{p.budget_status || 'No budget'}</span>
              {(p.shoots || []).length > 0 && <span style={{ fontSize:9, fontWeight:800, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.shoots.length} shoot{p.shoots.length !== 1 ? 's' : ''}</span>}
            </div>
          </div>
        ))}
      </div>
      {clients.length > 0 && (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:14, margin:'26px 0 10px' }}>
            <div style={{ fontSize:13, fontWeight:800 }}>Client Hub</div>
            <input value={cq} onChange={e => setCq(e.target.value)} placeholder="Search clients…" style={{ width:240 }} />
          </div>
          <div className="hub-tiles" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(250px, 1fr))', gap:14 }}>
            {shownClients.map(c => (
              <div key={c.name} onClick={() => nav(`/project-view/client/${encodeURIComponent(c.name)}`)}
                style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid rgba(74,158,255,0.5)', borderRadius:10, padding:'16px 18px', cursor:'pointer', transition:'transform .15s ease' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                <div style={{ fontSize:14, fontWeight:800 }}>{c.name}</div>
                <div style={{ fontSize:11, color:'var(--muted)', margin:'3px 0 10px' }}>{c.projects.length} project{c.projects.length !== 1 ? 's' : ''}</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {c.projects.slice(0, 4).map(p => (
                    <span key={p.id} style={{ fontSize:9, fontWeight:800, color:'#4a9eff', border:'1px solid rgba(74,158,255,0.4)', borderRadius:10, padding:'2px 8px' }}>{p.code}</span>
                  ))}
                  {c.projects.length > 4 && <span style={{ fontSize:9, color:'var(--muted)' }}>+{c.projects.length - 4} more</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
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

  useEffect(() => {
    api.dashboardToday().then(setDay).catch(() => setDay({ items: [] }));
    api.dashboardTeam().then(setTeam).catch(() => setTeam([]));
  }, []);

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const card = { background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px', minHeight:220 };
  const hdr = { fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:12 };

  return (
    <div className="hub-dash" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:22 }}>
      <div style={card}>
        <div style={hdr}>Day in Review <span style={{ color:'var(--muted)', fontWeight:600, textTransform:'none', letterSpacing:0 }}>· {dateLabel}</span></div>
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
        {day && (day.tasks || []).length > 0 && (
          <>
            <div style={{ ...hdr, fontSize:10, margin:'16px 0 6px', display:'flex', alignItems:'center', gap:8 }}>
              My Tasks
              {(day.tasks || []).some(t => !hiddenTasks.includes(t.id) && t.due_date && String(t.due_date).slice(0, 10) === new Date().toISOString().slice(0, 10)) && (
                <span style={{ background:'rgba(232,80,10,0.16)', border:'1px solid var(--orange)', color:'var(--orange)', borderRadius:10, padding:'1px 8px', fontSize:9, fontWeight:800, textTransform:'none', letterSpacing:0 }}>
                  (!) Task Due Today
                </span>
              )}
            </div>
            {(day.tasks || []).filter(t => !hiddenTasks.includes(t.id)).map(t => {
              const today = new Date().toISOString().slice(0, 10);
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
    </div>
  );
}

export default function Hub() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const isCrew = user?.role === 'CREW';
  const [mode, setMode] = useState(() => localStorage.getItem('hub_mode') || 'ops'); // 'projects' | 'ops'
  const setHubMode = m => { setMode(m); localStorage.setItem('hub_mode', m); };
  // Team Management sits below as a constant, elongated tile
  const teamTile = TILES.find(t => t.key === 'team');
  const opsTiles = isCrew
    ? TILES.filter(t => t.key !== 'profi' && t.key !== 'team').map(t => t.key === 'freepro' ? { ...t, to: '/crew-views', tagline: 'Crew Views' } : t)
    : TILES.filter(t => t.key !== 'team');
  const tiles = opsTiles;

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10, position:'relative' }}>
        <div>
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:26, filter:'brightness(0) invert(1)', opacity:0.95, display:'block' }} />
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:5 }}>Operating Platform</div>
        </div>
        {!isCrew && <div className="hub-pipeline-btn" style={{ display:'flex', gap:12 }}>
          <button onClick={() => nav('/crew-calendar')}
            style={{ background:'rgba(90,191,128,0.14)', border:'1.5px solid #5ABF80', color:'#5ABF80', borderRadius:12, padding:'12px 26px', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>📅</span> Crew Calendar
          </button>
          <button onClick={() => nav('/reports')}
            style={{ background:'rgba(230,194,41,0.12)', border:'1.5px solid #e6c229', color:'#e6c229', borderRadius:12, padding:'12px 26px', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>📈</span> Reports
          </button>
        </div>}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
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
            <div style={{ textAlign:'center', marginBottom:24 }}>
              <div style={{ fontSize:22, fontWeight:800 }}>Where to today?</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Every project, from budget to delivery.</div>
              {!isCrew && (
                <div style={{ display:'inline-flex', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden', marginTop:16 }}>
                  {[['projects', '🗂 Project View'], ['ops', '⚙ Operations View']].map(([k, label]) => (
                    <button key={k} onClick={() => setHubMode(k)}
                      style={{ background: mode === k ? 'rgba(255,255,255,0.09)' : 'transparent', border:'none',
                        color: mode === k ? 'var(--text)' : 'var(--muted)', fontSize:12, fontWeight:800, padding:'9px 22px', cursor:'pointer', letterSpacing:'0.03em' }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!isCrew && mode === 'projects' && <HubProjects />}
            {(isCrew || mode === 'ops') && (
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

      {user?.role === 'ADMIN' && <UserManagement user={user} />}
    </div>
  );
}
