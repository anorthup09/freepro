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
    status: 'In Development',
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
    status: 'In Development',
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

  async function removeUser(id, name) {
    if (!confirm(`Delete user ${name}?`)) return;
    try { await api.deleteUser(id); setUsers(us => us.filter(x => x.id !== id)); }
    catch (e) { alert(e.message); }
  }

  return (
    <div style={{ padding:'0 26px 22px', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
      {open && (
        <div style={{ width:'100%', maxWidth:720, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
          <table className="pos-table" style={{ width:'100%' }}>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
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
                  <td style={{ textAlign:'right' }}>
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
      )}
      <button onClick={toggle}
        style={{ background:'none', border:'1px solid var(--border)', borderRadius:14, padding:'4px 12px', color:'var(--muted)', fontSize:10, fontWeight:600, letterSpacing:'.05em', cursor:'pointer' }}>
        User Management {open ? '▾' : '▸'}
      </button>
    </div>
  );
}

export default function Hub() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10, position:'relative' }}>
        <div>
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:26, filter:'brightness(0) invert(1)', opacity:0.95, display:'block' }} />
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:5 }}>Operating Platform</div>
        </div>
        <div className="hub-pipeline-btn" style={{ display:'flex', gap:12 }}>
          <button onClick={() => nav('/pipeline')}
            style={{ background:'rgba(232,80,10,0.16)', border:'1.5px solid var(--orange)', color:'var(--orange)', borderRadius:12, padding:'12px 26px', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>⚡</span> Project Pipeline
          </button>
          <button onClick={() => nav('/crew-calendar')}
            style={{ background:'rgba(90,191,128,0.14)', border:'1.5px solid #5ABF80', color:'#5ABF80', borderRadius:12, padding:'12px 26px', fontSize:13, fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:16 }}>📅</span> Crew Calendar
          </button>
        </div>
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


        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 16px 60px' }}>
          <div style={{ width:'100%', maxWidth:1150 }}>
            <div style={{ textAlign:'center', marginBottom:28 }}>
              <div style={{ fontSize:22, fontWeight:800 }}>Where to today?</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Every project, from budget to delivery.</div>
            </div>
            <div className="hub-tiles" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
              {TILES.map(t => {
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
          </div>
        </div>

      {user?.role === 'ADMIN' && <UserManagement user={user} />}
    </div>
  );
}
