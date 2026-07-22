import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';
import { VccTab } from './FinanceProject.jsx';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMonth = m => {
  if (!m) return 'No close month';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 15).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

function Header({ user, setUser, backTo, backLabel }) {
  return (
    <div className="no-print" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
        <Link to="/" style={{ display:'flex', alignItems:'center' }} title="Back to the Unbridled Media hub">
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
        </Link>
        <span style={{ fontSize:12, color:'#e6c229', fontWeight:700, letterSpacing:'0.04em' }}>Reports</span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
        <Link to={backTo} className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>‹ {backLabel}</Link>
      </div>
    </div>
  );
}

// /reports/vcc/:pid — the ProFi VCC tab, standalone. No budget tab, no
// access to the rest of the project's finance pages.
export function VccProjectPage() {
  const { pid } = useParams();
  const { user, setUser } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.financeBundle(pid).then(setData).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [pid]);
  const set = (updater) => setData(d => ({ ...d, ...(typeof updater === 'function' ? updater(d) : updater) }));

  // Opened as a PDF (?pdf=1) — auto-trigger the print dialog with a clean title.
  const isPdf = new URLSearchParams(useLocation().search).get('pdf') === '1';
  useEffect(() => {
    if (!isPdf || !data) return;
    const prev = document.title;
    document.title = `${data.project?.code || ''} — VCC`.trim();
    const t = setTimeout(() => window.print(), 600);
    return () => { clearTimeout(t); document.title = prev; };
  }, [isPdf, data]);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Header user={user} setUser={setUser} backTo="/reports/vcc" backLabel="All VCCs" />
      <div style={{ maxWidth:1150, margin:'0 auto', padding:'10px 16px 60px' }}>
        {err && <div className="empty">{err}</div>}
        {!err && !data && <div className="empty">Loading…</div>}
        {data && (
          <>
            <div style={{ display:'flex', alignItems:'baseline', gap:12, flexWrap:'wrap', marginBottom:6 }}>
              <div className="page-title" style={{ marginBottom:0 }}>VCC — {data.project?.code}</div>
              <span style={{ fontSize:13, color:'var(--muted)' }}>{data.project?.title}{data.project?.client ? ` · ${data.project.client}` : ''}</span>
              {data.budget?.status && (
                <span style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em',
                  color: data.budget.status === 'Closed' ? '#8a8f98' : '#5ABF80',
                  border:`1px solid ${data.budget.status === 'Closed' ? '#8a8f98' : '#5ABF80'}55`, borderRadius:20, padding:'2px 10px' }}>
                  {data.budget.status === 'Closed' ? 'Closed' : 'Live'}
                </span>
              )}
            </div>
            <VccTab pid={pid} budget={data.budget || {}} sections={data.sections || []} lines={data.lines || []} vcc={data.vcc || []} categories={data.categories || []} set={set} vccOnly />
          </>
        )}
      </div>
    </div>
  );
}

// /reports/vcc — every project's VCC, grouped by Live/Closed with a close
// month filter on the Closed side. Click a project to open its VCC view.
export default function VccReport() {
  const nav = useNavigate();
  const { user, setUser } = useAuth();
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState('Live');
  const [month, setMonth] = useState('');

  useEffect(() => { api.vccReport().then(setRows).catch(e => setErr(e.message)); }, []);

  const isClosed = r => r.budget_status === 'Closed';

  // One row per project
  const projects = useMemo(() => {
    const by = new Map();
    for (const r of rows || []) {
      if (!by.has(r.project_id)) by.set(r.project_id, { id: r.project_id, code: r.code, title: r.project_title, client: r.client, closed: isClosed(r), closeMonth: r.close_month, count: 0, total: 0 });
      const g = by.get(r.project_id);
      g.count += 1; g.total += Number(r.amount || 0);
    }
    return [...by.values()].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }, [rows]);

  const live = projects.filter(p => !p.closed);
  const closed = projects.filter(p => p.closed);
  const months = [...new Set(closed.map(p => p.closeMonth || ''))].sort().reverse();
  const shown = view === 'Live' ? live : closed.filter(p => !month || (p.closeMonth || '') === month);
  const total = shown.reduce((s, p) => s + p.total, 0);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <Header user={user} setUser={setUser} backTo="/reports" backLabel="Reports" />
      <div style={{ maxWidth:1050, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <div>
            <div className="page-title" style={{ marginBottom:2 }}>All VCCs</div>
            <div className="page-sub">Pick a project to open its VCC — virtual card entries only, no budgets</div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:20, overflow:'hidden' }}>
              {['Live', 'Closed'].map(v => (
                <button key={v} onClick={() => setView(v)}
                  style={{ background: view === v ? (v === 'Live' ? 'rgba(90,191,128,0.18)' : 'rgba(138,143,152,0.18)') : 'transparent',
                    border:'none', color: view === v ? (v === 'Live' ? '#5ABF80' : '#c7ccd4') : 'var(--muted)',
                    padding:'7px 20px', fontSize:12, fontWeight:800, cursor:'pointer' }}>
                  {v}{rows ? ` (${v === 'Live' ? live.length : closed.length})` : ''}
                </button>
              ))}
            </div>
            {view === 'Closed' && (
              <select value={month} onChange={e => setMonth(e.target.value)} style={{ width:'auto', fontSize:12 }}>
                <option value="">All months</option>
                {months.map(m => <option key={m || 'none'} value={m}>{fmtMonth(m)}</option>)}
              </select>
            )}
          </div>
        </div>

        {err && <div className="empty">{err}</div>}
        {!err && !rows && <div className="empty">Loading…</div>}
        {rows && shown.length === 0 && <div className="empty">No {view.toLowerCase()} VCCs{view === 'Closed' && month ? ` for ${fmtMonth(month)}` : ''}.</div>}

        {rows && shown.length > 0 && (
          <div style={{ fontSize:12, color:'var(--muted)', margin:'10px 0 14px' }}>
            {shown.length} project{shown.length === 1 ? '' : 's'} · <b style={{ color:'var(--text)' }}>{fmt$(total)}</b> total on card
          </div>
        )}

        <div className="proj-list">
          {shown.map(p => (
            <a key={p.id} href="#" className="proj-card" onClick={e => { e.preventDefault(); nav(`/reports/vcc/${p.id}`); }}>
              <div className="proj-card-info">
                <div className="proj-card-code">{p.code}</div>
                <div className="proj-card-title">{p.title}</div>
                <div className="proj-card-meta">
                  {p.client}{view === 'Closed' ? ` · ${fmtMonth(p.closeMonth)}` : ''} · {p.count} entr{p.count === 1 ? 'y' : 'ies'}
                </div>
              </div>
              <div style={{ fontSize:14, fontWeight:800, whiteSpace:'nowrap', flexShrink:0 }}>{fmt$(p.total)}</div>
              <span className={`pill ${view === 'Live' ? 'green' : ''}`}>{view.toUpperCase()}</span>
              <span className="proj-card-arrow">›</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
