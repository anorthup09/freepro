import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

const TILES = [
  {
    key: 'finance',
    title: 'Project Finance',
    tagline: 'Budgets · Vendor Cost Control · Reconciliation',
    desc: 'Build client-ready budgets, track committed costs, and reconcile every project.',
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
    to: null,
    status: 'Under Construction',
  },
];

export default function Hub() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px' }}>
        <div>
          <div className="logo" style={{ fontSize:18 }}>Unbridled <em>Media</em></div>
          <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginTop:2 }}>Operating Platform</div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>Sign out</button>
        </div>
      </div>

      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 16px 60px' }}>
        <div style={{ width:'100%', maxWidth:1000 }}>
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
    </div>
  );
}
