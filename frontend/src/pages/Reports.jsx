import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';

const REPORTS = [
  {
    title: 'Project Pipeline',
    desc: 'Every active project at a glance — where each one sits from pre-production through delivery.',
    accent: 'var(--orange)', to: '/pipeline',
  },
  {
    title: 'Project Finance Overview',
    desc: 'Every project with budget, direct costs, gross profit, and status — the full financial picture.',
    accent: '#5ABF80', to: '/finance/overview',
  },
  {
    title: 'Vendor Invoice Search',
    desc: 'Find any uploaded vendor invoice across all projects — by vendor, project code, or total — and preview the file.',
    accent: '#e6c229', to: '/reports/invoices',
  },
  {
    title: 'Client Invoice Report',
    desc: 'Deposit and final invoices for every live or closed project, grouped by close month.',
    accent: '#5ABF80', to: '/reports/client-invoices',
  },
  {
    title: 'All VCCs',
    desc: 'Every virtual card entry across all projects — live cards up top, closed cards filterable by close month.',
    accent: '#c084fc', to: '/reports/vcc',
  },
  {
    title: 'Weekly Finance Report',
    desc: 'Snapshot report of budgets and close months for the finance team.',
    accent: '#4a9eff', to: '/finance/report',
  },
];

export default function Reports() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <span style={{ fontSize:12, color:'#e6c229', fontWeight:700, letterSpacing:'0.04em' }}>Reports</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Back to Hub</Link>
        </div>
      </div>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div className="page-title">Reports</div>
        <div className="page-sub">Cross-project rollups and recurring reports</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16, marginTop:8 }}>
          {REPORTS.map(r => (
            <div key={r.title} onClick={() => nav(r.to)}
              style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:`3px solid ${r.accent}`, borderRadius:12, padding:'22px 22px 18px', cursor:'pointer', transition:'transform .15s ease' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
              <div style={{ fontSize:15, fontWeight:800, margin:'8px 0 4px' }}>{r.title}</div>
              <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5 }}>{r.desc}</div>
              <div style={{ fontSize:11, color:r.accent, fontWeight:600, marginTop:12 }}>Open →</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
