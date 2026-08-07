import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import HomeButton from '../components/HomeButton.jsx';
import { HubBottomNav } from './Hub.jsx';

const REPORTS = [
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
    title: 'Client Outstanding Invoice Report',
    desc: 'Deposit and final invoices for every live or closed project, grouped by close month.',
    accent: '#5ABF80', to: '/reports/client-invoices',
  },
  {
    title: 'All VCCs',
    desc: 'Every virtual card entry across all projects — live cards up top, closed cards filterable by close month.',
    accent: '#c084fc', to: '/reports/vcc',
  },
  {
    title: 'Gear Report',
    desc: "Every shoot reporting into FreePro for the Gear Manager — greyed until a gear request is in, with where the gear is coming from.",
    accent: '#E8500A', to: '/reports/gear',
  },
  {
    title: 'Vendor Contracts',
    desc: 'Every contractor being hired across production and post — estimated totals and whether their contract has been sent.',
    accent: '#a78bfa', to: '/reports/vendor-contracts',
  },
  {
    title: 'Hard Drives',
    desc: 'The drive roster and where every drive is right now — out on a shoot or home in the office.',
    accent: '#4a9eff', to: '/reports/drives',
  },
  {
    title: 'Music Resources',
    desc: "The team's shared music library — licensing platforms, go-to tracks, and playlists, grouped by category.",
    accent: '#e6c229', to: '/reports/music-resources',
  },
  {
    title: 'Video References',
    desc: 'Reference and inspiration videos — style frames, past work, and examples to share, grouped by category.',
    accent: '#a78bfa', to: '/reports/video-references',
  },
  {
    title: 'Subscriptions',
    desc: 'Post-production tools and logins, grouped by type. No passwords — use Bitwarden.',
    accent: '#c084fc', to: '/reports/subscriptions',
  },
  {
    title: 'Foodie Recs',
    desc: "The team's favorite restaurants from the road — ranked by the crew, with photos and a map of every spot.",
    accent: '#f0653c', to: '/reports/foodie',
  },
  {
    title: 'Team Days Off',
    desc: 'Days off per person from the PTO/OOO tracker — PTO and OOO totals side by side.',
    accent: '#d66a9b', to: '/reports/days-off',
  },
  {
    title: 'Weekly Finance Report',
    desc: 'Snapshot report of budgets and close months for the finance team.',
    accent: '#4a9eff', to: '/finance/report',
  },
];

// Admin-only reports
const ADMIN_REPORTS = [
  { title: 'Ways of Being', to: '/reports/ways-of-being' },
  { title: 'MediaMoments', to: '/reports/media-moments' },
];

// Category icons (stroke = currentColor)
const I = {
  finance: <svg viewBox="0 0 24 24"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  gear: <svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>,
  people: <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.1"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16.5 5.3a3.2 3.2 0 0 1 0 6.1"/><path d="M22 20a6 6 0 0 0-4-5.7"/></svg>,
  postpro: <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88"/><path d="M14.47 14.48L20 20"/><path d="M8.12 8.12L12 12"/></svg>,
  travel: <svg viewBox="0 0 24 24"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>,
  vendors: <svg viewBox="0 0 24 24"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/></svg>,
};

// Ordered categories; each lists its reports (by route) in display order.
const CATEGORIES = [
  { key: 'finance',  label: 'Finance',   icon: I.finance,  tos: ['/reports/vcc', '/reports/client-invoices', '/finance/overview', '/finance/report'] },
  { key: 'gear',     label: 'Gear',      icon: I.gear,     tos: ['/reports/gear', '/reports/drives'] },
  { key: 'people',   label: 'People',    icon: I.people,   tos: ['/reports/days-off', '/reports/media-moments', '/reports/ways-of-being'] },
  { key: 'postpro',  label: 'Post-Pro',  icon: I.postpro,  tos: ['/reports/music-resources', '/reports/video-references', '/reports/subscriptions'] },
  { key: 'travel',   label: 'Travel',    icon: I.travel,   tos: ['/reports/foodie'] },
  { key: 'vendors',  label: 'Vendors',   icon: I.vendors,  tos: ['/reports/vendor-contracts', '/reports/invoices'] },
];

// List order fades gray (top) → Unbridled orange (bottom).
const GRAY = [122, 117, 101];
const ORANGE = [232, 80, 10];
const gradientAccent = (i, n) => {
  const t = n <= 1 ? 1 : i / (n - 1);
  const c = GRAY.map((g, k) => Math.round(g + (ORANGE[k] - g) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};

// Crew only see non-financial resources (no VCCs, invoices, or finance rollups).
const CREW_SAFE = new Set(['/reports/foodie', '/reports/music-resources', '/reports/video-references', '/reports/drives', '/reports/gear']);

const CSS = `
.rpt-dockwrap{display:flex;justify-content:center;margin:20px 0 28px}
.rpt-dock{position:relative;display:inline-flex;flex-wrap:nowrap;justify-content:center;align-items:stretch;gap:2px;padding:8px 12px;border-radius:26px;max-width:100%;overflow-x:auto;
  background:rgba(30,27,23,0.72);backdrop-filter:blur(22px) saturate(1.7);-webkit-backdrop-filter:blur(22px) saturate(1.7);
  border:1px solid rgba(255,255,255,0.12);box-shadow:0 12px 40px rgba(0,0,0,0.4),inset 0 1px 0 rgba(255,255,255,0.12);scrollbar-width:none}
.rpt-dock::-webkit-scrollbar{display:none}
.rpt-navitem{flex:0 0 auto}
@media (max-width:700px){.rpt-dock{padding:6px 8px}.rpt-navitem{padding:8px 10px}.rpt-navitem svg{width:20px;height:20px}}
.rpt-navbubble{position:absolute;z-index:0;background:rgba(255,255,255,0.10);border-radius:18px;pointer-events:none;
  transition:left .3s cubic-bezier(.34,1.3,.5,1),width .3s cubic-bezier(.34,1.3,.5,1),top .3s ease,height .3s ease}
.rpt-navitem{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;background:none;border:none;color:var(--muted);
  font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;cursor:pointer;padding:9px 16px;border-radius:18px;transition:color .18s ease}
.rpt-navitem svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;transition:transform .2s cubic-bezier(.34,1.45,.5,1)}
.rpt-navitem:hover{color:var(--text)}
.rpt-navitem:hover svg{transform:scale(1.18)}
.rpt-navitem.on{color:var(--orange)}
.rpt-list{display:flex;flex-direction:column;gap:9px;max-width:340px;margin:0 auto}
.rpt-tile{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--bg2);border:1px solid var(--border);
  border-left:4px solid var(--orange);border-radius:9px;padding:9px 14px;cursor:pointer;transition:transform .15s ease}
.rpt-tile:hover{transform:translateX(3px)}
@keyframes rptIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}
.rpt-tile{animation:rptIn .6s cubic-bezier(.22,.61,.36,1) backwards}
@media (prefers-reduced-motion: reduce){.rpt-tile{animation:none}}
`;

export default function Reports() {
  const nav = useNavigate();
  const { user } = useAuth();
  const isCrew = user?.role === 'CREW';
  const isAdmin = user?.role === 'ADMIN';

  // Reports this user can open, keyed by route.
  const all = [...REPORTS, ...(isAdmin ? ADMIN_REPORTS : [])];
  const accessible = isCrew ? all.filter(r => CREW_SAFE.has(r.to)) : all;
  const byTo = new Map(accessible.map(r => [r.to, r]));
  const reportsFor = cat => cat.tos.map(to => byTo.get(to)).filter(Boolean);

  const shownCats = CATEGORIES.filter(c => reportsFor(c).length > 0);
  const [active, setActive] = useState(shownCats[0]?.key || '');
  const activeCat = shownCats.find(c => c.key === active) || shownCats[0];
  const tiles = activeCat ? reportsFor(activeCat) : [];

  // Sliding selection bubble behind the active category (matches the app docks).
  const btnRefs = useRef({});
  const [bubble, setBubble] = useState(null);
  useEffect(() => {
    const measure = () => {
      const el = btnRefs.current[activeCat?.key];
      setBubble(el ? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight } : null);
    };
    measure();
    const t = setTimeout(measure, 320);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [activeCat?.key, shownCats.length]);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <style>{CSS}</style>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <HomeButton />
        </div>
      </div>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'10px 16px 120px' }}>
        <div className="page-title" style={{ textAlign:'center' }}>Reports &amp; Resources</div>
        <div className="page-sub" style={{ textAlign:'center' }}>Pick a category to see its reports</div>

        <div className="rpt-dockwrap">
          <div className="rpt-dock">
            {bubble && <div className="rpt-navbubble" style={{ left: bubble.left, top: bubble.top, width: bubble.width, height: bubble.height }} />}
            {shownCats.map(c => (
              <button key={c.key} ref={el => { btnRefs.current[c.key] = el; }}
                className={`rpt-navitem${activeCat?.key === c.key ? ' on' : ''}`} onClick={() => setActive(c.key)}>
                {c.icon}<span>{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rpt-list" key={activeCat?.key}>
          {tiles.map((r, i, arr) => {
            const accent = gradientAccent(i, arr.length);
            return (
              <div key={r.to} className="rpt-tile" style={{ borderLeftColor:accent, animationDelay:`${i * 0.09}s` }} onClick={() => nav(r.to)}>
                <div style={{ fontSize:13, fontWeight:800 }}>{r.title}</div>
                <div style={{ fontSize:10.5, color:accent, fontWeight:700, whiteSpace:'nowrap' }}>Open →</div>
              </div>
            );
          })}
        </div>
      </div>
      <HubBottomNav />
    </div>
  );
}
