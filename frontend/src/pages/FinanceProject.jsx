import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { maybeMailNotice } from '../utils/mailNotice.js';
import { FinanceHeader, LogoField } from './Finance.jsx';
import HarbingerModal, { HarbingerView } from '../components/HarbingerModal.jsx';
import ClientSelect from '../components/ClientSelect.jsx';
import { useAuth } from '../App.jsx';

const fmt$ = (n, dec = 2) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec === 2 ? 2 : 0, maximumFractionDigits: dec });
const num = v => Number(v) || 0;

function lineSubtotal(l, sectionLines) {
  if (l.percent != null) {
    const base = sectionLines.filter(x => x.percent == null && !x.is_travel).reduce((s, x) => s + num(x.qty) * num(x.unit_cost), 0);
    return num(l.percent) * base * num(l.qty);
  }
  return num(l.qty) * num(l.unit_cost);
}

// Lines that stay visible in a collapsed production section even at qty 0
const ALWAYS_SHOWN = /^(equipment rental|post-production supervisor)$/i;

const BUDGET_OWNERS = [
  'Alex Northup',
  'Anabelle Porio',
  'Ben Lamb',
  'Derik Smith',
  'Joey Goldman',
  'Kelly Hueseman',
  'Mike Walsh',
  'Nate Woodard',
];

const cellIn = { background:'transparent', border:'1px solid transparent', borderRadius:4, padding:'3px 6px', fontSize:12, width:'100%', color:'var(--text)' };
const numIn = { ...cellIn, width:70, textAlign:'right' };

function MoneyInput({ value, onCommit, width = 85 }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  if (editing) {
    return (
      <input type="number" step="0.01" autoFocus value={draft}
        style={{ ...numIn, width, borderColor:'var(--border)' }}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        onBlur={() => { setEditing(false); onCommit(draft); }} />
    );
  }
  return (
    <div onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      style={{ ...numIn, width, cursor:'text', padding:'4px 6px' }}>
      {value === '' || value == null ? <span style={{ color:'var(--muted)' }}>—</span> : fmt$(value)}
    </div>
  );
}

export default function FinanceProject({ pidOverride }) {
  const { pid: pidParam } = useParams();
  const pid = pidOverride || pidParam;
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('budget');
  const [estimateMode, setEstimateMode] = useState(false);
  const [overview, setOverview] = useState(false);
  const [editProject, setEditProject] = useState(false);
  const [glass, setGlass] = useState(false);
  const [harbinger, setHarbinger] = useState(null);
  const [showHarbinger, setShowHarbinger] = useState(false);

  useEffect(() => {
    api.getHarbinger(pid).then(setHarbinger).catch(() => setHarbinger(null));
  }, [pid]);

  useEffect(() => {
    const onScroll = () => setGlass(window.scrollY > 170);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { api.financeBundle(pid).then(setData).catch(e => alert(e.message)); }, [pid]);

  if (!data) return <div style={{ minHeight:'100vh', background:'var(--bg)' }}><FinanceHeader /><div className="empty">Loading…</div></div>;
  const { project, budget, sections, lines, vcc, categories, estimates = [] } = data;

  const set = fn => setData(d => ({ ...d, ...fn(d) }));

  async function createBudget() {
    await api.createBudget(pid);
    setData(await api.financeBundle(pid));
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <FinanceHeader />
      <FinanceDock tab={tab} setTab={setTab} onHarbinger={() => {
        if (harbinger) { setShowHarbinger(true); return; }
        setTab('budget');
        setTimeout(() => window.dispatchEvent(new Event('fp-open-harbinger')), 60);
      }} />
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'6px 16px 80px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:14, position:'relative' }}>
          <div className="fp-idblock">
            <button className="fp-edit" onClick={() => setEditProject(true)}
              style={{ marginBottom:6, background:'none', border:'1px solid var(--border)', borderRadius:12, padding:'2px 12px', fontSize:10, fontWeight:600, color:'var(--muted)', cursor:'pointer' }}>
              ✎ Edit
            </button>
            <div className="fp-code" style={{ fontSize:10, color:'var(--muted)' }}>{project.code}</div>
            <div className="page-title">{project.title}</div>
            <div className="page-sub">{project.client}</div>

          </div>
          <div className="fp-actions" style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
            {budget && <BudgetVersions budget={budget} pid={pid} reload={() => api.financeBundle(pid).then(setData)} />}
            {budget && (
              <>
                <div className="fp-btnrow" style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  <button onClick={() => setEstimateMode(true)}
                    style={{ background:'rgba(230,194,41,0.15)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    + Add Estimate{estimates.length ? ` (${estimates.length})` : ''}
                  </button>
                  <ShareBudgetButton budget={budget} project={project} sections={sections} lines={lines} onOverview={() => setOverview(true)}
                    onModePicked={m => set(d => ({ budget: { ...d.budget, share_mode: m } }))} />
                </div>
              </>
            )}
          </div>
        </div>

        {!budget ? (
          <div className="empty" style={{ padding:'40px 20px', textAlign:'center' }}>
            <div style={{ marginBottom:14 }}>No budget yet for this project.</div>
            <button className="btn btn-primary" onClick={createBudget}>Create Budget from 2026 Template</button>
          </div>
        ) : tab === 'budget' ? (
          <BudgetTab budget={budget} sections={sections} lines={lines} vcc={vcc} project={project} set={set} reload={() => api.financeBundle(pid).then(setData)} />
        ) : (
          <VccTab pid={pid} budget={budget} sections={sections} lines={lines} vcc={vcc} categories={categories} set={set} />
        )}
      </div>
      {budget && (() => {
        const rate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;
        const grand = totals(sections, lines, rate).total;
        return (
          <div style={{
            position:'fixed', top:0, left:0, right:0, zIndex:80, pointerEvents:'none',
            opacity: glass ? 1 : 0, transform: glass ? 'translateY(0)' : 'translateY(-6px)',
            transition:'opacity .25s ease, transform .25s ease',
            backdropFilter:'blur(5px) saturate(140%)', WebkitBackdropFilter:'blur(5px) saturate(140%)',
            background:'rgba(10,10,8,0.18)',
            maskImage:'linear-gradient(to bottom, black 85%, transparent 100%)',
            WebkitMaskImage:'linear-gradient(to bottom, black 85%, transparent 100%)',
            padding:'12px 22px 20px', display:'flex', alignItems:'center', gap:14,
          }}>
            {project.client_logo
              ? <img src={project.client_logo} alt={project.client} style={{ height:22, maxWidth:120, objectFit:'contain' }} />
              : <span className="glass-client" style={{ fontSize:13, fontWeight:800, color:'#fff', whiteSpace:'nowrap' }}>{project.client}</span>}
            <span className="glass-mid" style={{ color:'rgba(255,255,255,0.25)' }}>|</span>
            <span className="glass-mid" style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.65)', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>{project.code}</span>
            <span className="glass-mid" style={{ color:'rgba(255,255,255,0.25)' }}>|</span>
            <span style={{ fontFamily:"'Syne', sans-serif", fontWeight:800, fontSize:15, color:'#fff', letterSpacing:'-0.3px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', minWidth:0 }}>{project.title}</span>
            <span style={{ marginLeft:'auto', textAlign:'right' }}>
              <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.1em', marginRight:8 }}>Total Estimate</span>
              <span style={{ fontSize:16, fontWeight:800, color:'#5ABF80', fontVariantNumeric:'tabular-nums' }}>{fmt$(grand)}</span>
            </span>
          </div>
        );
      })()}
      {showHarbinger && harbinger && <HarbingerView harbinger={harbinger} onClose={() => setShowHarbinger(false)} />}
      {editProject && (
        <EditProjectModal project={project} onClose={() => setEditProject(false)}
          onSaved={p2 => { set(() => ({ project: p2 })); setEditProject(false); }} />
      )}
      {estimateMode && (
        <EstimateMode pid={pid} estimates={estimates} onExit={() => setEstimateMode(false)}
          reload={() => api.financeBundle(pid).then(setData)} />
      )}
      {overview && budget && (
        <OverviewEstimateModal sections={sections} lines={lines} feeRate={Number(budget.mgmt_fee_rate ?? 0.15)}
          heading={`Budget Overview — ${project.title}`} onClose={() => setOverview(false)} />
      )}
    </div>
  );
}

function totals(sections, lines, mgmtRate) {
  let nonTravel = 0, travel = 0, photo = 0;
  const photoIds = new Set(sections.filter(s => s.kind === 'photo').map(s => s.id));
  const bySection = {};
  for (const l of lines) (bySection[l.section_id] ||= []).push(l);
  for (const [sid, secLines] of Object.entries(bySection)) {
    for (const l of secLines) {
      const st = lineSubtotal(l, secLines);
      if (photoIds.has(sid)) photo += st;
      else if (l.is_travel) travel += st;
      else nonTravel += st;
    }
  }
  const mgmt = mgmtRate * nonTravel;
  return { nonTravel, travel, photo, mgmt, video: nonTravel + travel + mgmt, total: nonTravel + travel + mgmt + photo };
}

function closeMonthRange() {
  const opts = [];
  const start = new Date();
  start.setMonth(start.getMonth() - 6, 1);
  for (let i = 0; i < 43; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    opts.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-US', { month: 'long' }) + ' ' + d.getFullYear(),
    });
  }
  return opts;
}

// Budget-level client contact: shows just the name here; email + address ride
// along into the Harbinger prefill. Name search autofills from past contacts.
function ClientContactField({ budget, patchBudget, saveBudget }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', address: '' });
  const [people, setPeople] = useState([]);
  const [sugOpen, setSugOpen] = useState(false);
  const c = budget.client_contact;

  function openForm() {
    setF({ name: c?.name || '', email: c?.email || '', address: c?.address || '' });
    api.clientContactPeople().then(setPeople).catch(() => {});
    setSugOpen(false);
    setOpen(true);
  }
  const suggestions = useMemo(() => {
    const q = (f.name || '').trim().toLowerCase();
    if (!q) return [];
    return people.filter(p => p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q).slice(0, 8);
  }, [people, f.name]);
  function pick(p) {
    setF(v => ({ name: p.name, email: p.email || v.email, address: p.address || v.address }));
    setSugOpen(false);
  }
  function save(next) {
    patchBudget({ client_contact: next });
    saveBudget({ clientContact: next });
    setOpen(false);
  }
  const inS = { width: '100%', fontSize: 12 };
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
      <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Client Contact</label>
      {c?.name ? (
        <button onClick={openForm} title={`${c.email || ''}${c.address ? ' · ' + c.address : ''}\nClick to edit`}
          style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', fontSize:12, fontWeight:600, padding:'6px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
          {c.name}
        </button>
      ) : (
        <button onClick={openForm}
          style={{ background:'none', border:'1px dashed var(--border)', borderRadius:6, color:'var(--muted)', fontSize:11, fontWeight:700, padding:'6px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
          + Add Client Contact
        </button>
      )}
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:130, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ width:'100%', maxWidth:420, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:800 }}>Client Contact</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ position:'relative' }}>
                <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Name</label>
                <input style={inS} value={f.name} autoFocus placeholder="Start typing to search past contacts…"
                  onChange={e => { setF(v => ({ ...v, name: e.target.value })); setSugOpen(true); }}
                  onBlur={() => setTimeout(() => setSugOpen(false), 150)} />
                {sugOpen && suggestions.length > 0 && (
                  <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:10, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', maxHeight:200, overflowY:'auto' }}>
                    {suggestions.map(p => (
                      <div key={p.name} onMouseDown={() => pick(p)}
                        style={{ padding:'7px 10px', fontSize:12, cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontWeight:700 }}>{p.name}</span>
                        {(p.company || p.email) && <span style={{ color:'var(--muted)', fontSize:10 }}> — {p.company || p.email}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Email</label>
                <input style={inS} type="email" value={f.email} onChange={e => setF(v => ({ ...v, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Address</label>
                <textarea style={{ ...inS, minHeight:52 }} value={f.address} onChange={e => setF(v => ({ ...v, address: e.target.value }))} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8, marginTop:2 }}>
                {c?.name
                  ? <button onClick={() => save(null)}
                      style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, color:'var(--red-text)', fontSize:11, padding:'6px 12px', cursor:'pointer' }}>Remove</button>
                  : <span />}
                <button className="btn btn-primary btn-sm" disabled={!f.name.trim()}
                  onClick={() => save({ name: f.name.trim(), email: f.email.trim(), address: f.address.trim() })}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Bottom-right liquid-glass dock: Budget / VCC navigation ──────────────
const FIN_DOCK_ICONS = {
  budget: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 .9-3 2.2c0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2s-3-1.1-3-2.5"/></svg>,
  vcc: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19M6 15h4"/></svg>,
  harbinger: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>,
};
function FinanceDock({ tab, setTab, onHarbinger }) {
  const btnRefs = useRef({});
  const [bubble, setBubble] = useState(null);
  const [shrunk, setShrunk] = useState(false);
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { setShrunk(window.innerWidth <= 700 && window.scrollY > 60); raf = null; });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  useEffect(() => {
    const measure = () => {
      const el = btnRefs.current[tab];
      if (el) setBubble({ left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight });
    };
    measure();
    const t = setTimeout(measure, 300);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [tab, shrunk]);
  return (
    <div className="fin-dock no-print" style={{
      position:'fixed', right:14, bottom:'calc(env(safe-area-inset-bottom, 0px) + 14px)',
      zIndex:110, display:'flex', alignItems:'center', gap:2, padding: shrunk ? '6px 10px' : '8px 12px', transition:'padding .25s ease',
      background:'rgba(24,22,19,0.81)', backdropFilter:'blur(18px) saturate(1.5)', WebkitBackdropFilter:'blur(18px) saturate(1.5)',
      border:'1px solid rgba(255,255,255,0.12)', borderRadius:32,
      boxShadow:'0 10px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
    }}>
      {bubble && (
        <div aria-hidden style={{
          position:'absolute', left:bubble.left, top:bubble.top, width:bubble.width, height:bubble.height,
          background:'rgba(255,255,255,0.10)', borderRadius:22, pointerEvents:'none',
          transition:'left .3s cubic-bezier(.34,1.3,.5,1), width .3s cubic-bezier(.34,1.3,.5,1), top .3s ease, height .3s ease',
        }} />
      )}
      {onHarbinger && (
        <button onClick={onHarbinger} aria-label="Harbinger"
          style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, position:'relative',
            background:'transparent', border:'none', cursor:'pointer', color:'#5ABF80',
            borderRadius:22, padding:'7px 14px 6px' }}>
          {FIN_DOCK_ICONS.harbinger}
          <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.02em', whiteSpace:'nowrap', maxHeight: shrunk ? 0 : 12, opacity: shrunk ? 0 : 1, overflow:'hidden', transition:'max-height .25s ease, opacity .2s ease' }}>Harbinger</span>
        </button>
      )}
      {[['budget', 'Budget'], ['vcc', 'VCC']].map(([k, label]) => {
        const on = tab === k;
        return (
          <button key={k} ref={el => { btnRefs.current[k] = el; }} onClick={() => { setTab(k); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            aria-label={label}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:3, position:'relative',
              background:'transparent', border:'none', cursor:'pointer',
              color: on ? 'var(--orange)' : 'rgba(255,255,255,0.55)',
              borderRadius:22, padding:'7px 14px 6px', transition:'color .25s ease',
            }}>
            {FIN_DOCK_ICONS[k]}
            <span style={{ fontSize:9, fontWeight:800, letterSpacing:'0.02em', whiteSpace:'nowrap', maxHeight: shrunk ? 0 : 12, opacity: shrunk ? 0 : 1, overflow:'hidden', transition:'max-height .25s ease, opacity .2s ease' }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Budget versioning: V-number dropdown next to Budget/VCC ──────────────
function BudgetVersions({ budget, pid, reload }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState(null);
  const [viewing, setViewing] = useState(null);   // frozen version being viewed
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    api.budgetVersions(pid).then(setVersions).catch(() => setVersions([]));
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, pid]);
  async function startVersion() {
    if (busy) return;
    if (!confirm(`Start Version ${Number(budget.version || 1) + 1}? The current budget is saved as a read-only Version ${budget.version || 1} snapshot and you keep editing from here.`)) return;
    setBusy(true);
    try { await api.startBudgetVersion(budget.id); setOpen(false); reload && reload(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  }
  return (
    <span ref={ref} className="fp-versions" style={{ position:'relative', display:'inline-block', marginLeft:8 }}>
      <button onClick={() => setOpen(o => !o)} title="Budget versions"
        style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:16, padding:'5px 12px', fontSize:11, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
        V{budget.version || 1} ▾
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:60, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, minWidth:230, boxShadow:'0 10px 30px rgba(0,0,0,0.5)', overflow:'hidden' }}>
          <div onClick={startVersion}
            style={{ padding:'9px 14px', fontSize:12, fontWeight:700, color:'#5ABF80', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
            {busy ? 'Duplicating…' : '+ Start New Version'}
            <div style={{ fontSize:10, fontWeight:400, color:'var(--muted)' }}>Duplicates the current budget to keep editing</div>
          </div>
          <div style={{ padding:'7px 14px', fontSize:11, color:'var(--text)', fontWeight:700 }}>
            Version {budget.version || 1} <span style={{ color:'#5ABF80', fontWeight:600 }}>· current</span>
          </div>
          {versions === null && <div style={{ padding:'7px 14px', fontSize:11, color:'var(--muted)' }}>Loading…</div>}
          {(versions || []).map(v => (
            <div key={v.id} onClick={() => { setViewing(v.id); setOpen(false); }}
              style={{ padding:'7px 14px', fontSize:11, color:'var(--muted)', cursor:'pointer', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
              Version {v.version} — {new Date(v.created_at).toLocaleDateString()}
              <span style={{ float:'right', color:'var(--tan)' }}>{fmt$(v.raw_total, 0)}</span>
            </div>
          ))}
          {versions && !versions.length && <div style={{ padding:'7px 14px 10px', fontSize:10, color:'var(--muted)' }}>No saved versions yet.</div>}
        </div>
      )}
      {viewing && <VersionViewer vid={viewing} onClose={() => setViewing(null)} />}
    </span>
  );
}

// Read-only pop-out of a frozen budget version
function VersionViewer({ vid, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => { api.budgetVersion(vid).then(setData).catch(e => alert(e.message)); }, [vid]);
  const b = data?.budget;
  const secs = data?.sections || [];
  const lines = data?.lines || [];
  const nonTravel = lines.filter(l => !l.is_travel).reduce((s2, l) => s2 + lineSubtotal(l, lines.filter(x => x.section_id === l.section_id)), 0);
  const travel = lines.filter(l => l.is_travel).reduce((s2, l) => s2 + lineSubtotal(l, lines.filter(x => x.section_id === l.section_id)), 0);
  const mgmt = nonTravel * num(b?.mgmt_fee_rate);
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:250, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid var(--orange)', borderRadius:12, width:'100%', maxWidth:760, maxHeight:'86vh', overflowY:'auto', padding:'20px 22px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <div style={{ fontSize:15, fontWeight:800 }}>Budget — Version {b?.version}{b ? ` · ${new Date(b.created_at).toLocaleDateString()}` : ''}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize:10, color:'var(--muted)', marginBottom:14 }}>Read-only snapshot — the live budget carries on separately.</div>
        {!data && <div style={{ fontSize:12, color:'var(--muted)' }}>Loading…</div>}
        {secs.map(sec => {
          const secLines = lines.filter(l => l.section_id === sec.id);
          const total = secLines.reduce((s2, l) => s2 + lineSubtotal(l, secLines), 0);
          return (
            <div key={sec.id} style={{ border:'1px solid var(--border)', borderRadius:8, marginBottom:10, overflow:'hidden' }}>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'var(--bg3)', fontSize:12, fontWeight:800 }}>
                <span>{sec.title}{sec.trip ? ` — ${sec.trip}` : ''}</span><span>{fmt$(total)}</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <tbody>
                  {secLines.map(l => (
                    <tr key={l.id} style={{ borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding:'4px 12px' }}>{l.scope}{l.is_travel ? ' ✈' : ''}</td>
                      <td style={{ padding:'4px 8px', color:'var(--muted)' }}>{l.notes}</td>
                      <td style={{ padding:'4px 8px', textAlign:'right', whiteSpace:'nowrap' }}>{l.percent != null ? `${Math.round(num(l.percent) * 100)}%` : `${num(l.qty)} × ${fmt$(l.unit_cost)}`}</td>
                      <td style={{ padding:'4px 12px', textAlign:'right', fontWeight:600, whiteSpace:'nowrap' }}>{fmt$(lineSubtotal(l, secLines))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
        {data && (
          <div style={{ background:'var(--bg)', border:'1px solid #5ABF8055', borderRadius:10, padding:'12px 16px', maxWidth:380, marginLeft:'auto' }}>
            {[['Production & Post (non-travel)', nonTravel], ['Travel', travel], [`Management Fee (${Math.round(num(b?.mgmt_fee_rate) * 1000) / 10}% of non-travel)`, mgmt]].map(([lbl2, val]) => (
              <div key={lbl2} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'2px 0', color:'var(--muted)' }}>
                <span>{lbl2}</span><span style={{ fontWeight:600, color:'var(--text)' }}>{fmt$(val)}</span>
              </div>
            ))}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:800, borderTop:'1px solid var(--border)', marginTop:6, paddingTop:8 }}>
              <span>TOTAL</span><span style={{ color:'#5ABF80' }}>{fmt$(nonTravel + travel + mgmt)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Adopt a hand-created FreePro shoot as this budget shoot: aligns its code to
// the section's shoot code, parents it under the ProFi project, and links it.
function LinkShootButton({ sec, onLinked }) {
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  async function openPicker() {
    setOpen(true);
    setCandidates(null);
    try { setCandidates(await api.linkShootCandidates(sec.id)); }
    catch (e) { alert(e.message); setOpen(false); }
  }
  async function link() {
    if (!pick || busy) return;
    setBusy(true);
    try {
      const r = await api.linkShootProject(sec.id, pick);
      setOpen(false);
      alert(`Linked. That shoot now carries the code ${r.code} and feeds this budget section.`);
      onLinked && onLinked();
    } catch (e) { alert(e.message); }
    setBusy(false);
  }
  return (
    <span style={{ position:'relative' }}>
      <button type="button" onClick={openPicker}
        title={sec.freepro_project_id ? 'Re-link this shoot to a different FreePro project' : 'Connect an existing FreePro shoot to this budget section'}
        style={{ fontSize:10, fontWeight:700, color:'var(--muted)', background:'none', border:'1px solid var(--border)', borderRadius:12, padding:'3px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
        🔗 {sec.freepro_project_id ? 'Re-link' : 'Link shoot'}
      </button>
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:140, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ width:'100%', maxWidth:440, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #e6c229', borderRadius:12, padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <div style={{ fontSize:14, fontWeight:800 }}>Link FreePro Shoot — {sec.shoot_code || sec.title}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12, lineHeight:1.5 }}>
              Pick the FreePro project that IS this shoot (e.g. one someone started by hand). It will take the shoot code
              {sec.shoot_code ? <b style={{ color:'#e6c229' }}> {sec.shoot_code}</b> : ''}, be filed under this production, and feed this budget section.
              {sec.freepro_project_id ? ' The tile currently linked here gets archived if it holds the code.' : ''}
            </div>
            {!candidates && <div style={{ fontSize:11, color:'var(--muted)' }}>Loading projects…</div>}
            {candidates && candidates.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No unlinked FreePro projects found.</div>}
            {candidates && candidates.length > 0 && (
              <>
                <select value={pick} onChange={e => setPick(e.target.value)}
                  style={{ width:'100%', fontSize:12, padding:'8px 10px', borderRadius:8, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', marginBottom:12 }}>
                  <option value="">— Select the shoot project —</option>
                  {candidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.title}{c.start_date ? ` (${new Date(String(c.start_date).slice(0,10)+'T12:00:00').toLocaleDateString()})` : ''}
                    </option>
                  ))}
                </select>
                <div className="btn-row">
                  <button className="btn btn-primary" disabled={!pick || busy} onClick={link}>{busy ? 'Linking…' : 'Link Shoot'}</button>
                  <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

function BudgetTab({ budget, sections, lines, vcc, project, set, reload }) {
  const { user } = useAuth();
  const [harbingerOpen, setHarbingerOpen] = useState(false);
  useEffect(() => {
    const f = () => setHarbingerOpen(true);
    window.addEventListener('fp-open-harbinger', f);
    return () => window.removeEventListener('fp-open-harbinger', f);
  }, []);

  // Prefill the Harbinger from the budget + estimate overview
  function harbingerPrefill() {
    const rate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;
    const t = totals(sections, lines, rate);
    const scopeLines = [];
    const summaryLines = [];
    for (const sec of sections) {
      const secLines = lines.filter(l => l.section_id === sec.id);
      let cost = 0;
      const inc = [];
      for (const l of secLines) {
        const st = lineSubtotal(l, secLines);
        if (st <= 0) continue;
        cost += st;
        inc.push((l.percent == null && num(l.qty) > 1 ? `${num(l.qty)}x ` : '') + (l.scope || ''));
      }
      if (cost <= 0) continue;
      const name = OVERVIEW_LABELS[sec.kind] || sec.title || 'Costs';
      scopeLines.push(`${name}:`, ...inc.map(x => `- ${x}`), '');
      summaryLines.push(`${name} — ${fmt$(cost)}`);
    }
    summaryLines.push(`Production Management — ${fmt$(t.mgmt)}`, `Total — ${fmt$(t.total)}`);
    const fmtD = d => d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString() : '';
    const shootSecs = sections.filter(x => x.kind === 'shoot');
    const shootName = (sec, i) => (sec.subtitle || '').trim() || (sec.trip || '').trim() || sec.shoot_code || `Shoot ${i + 1}`;
    // Budgeted positions grouped by shoot: every labor position within each shoot
    const positionsBlock = shootSecs.map((sec, i) => {
      const pos = [...new Set(lines
        .filter(l => l.section_id === sec.id && !l.is_travel && l.percent == null && num(l.qty) > 0 && l.scope)
        .map(l => (num(l.qty) > 1 ? `${num(l.qty)}x ` : '') + l.scope))];
      if (!pos.length) return null;
      return `${shootName(sec, i)}:\n${pos.map(p => `- ${p}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');
    // Every shoot's production dates
    const datesBlock = shootSecs.map((sec, i) => {
      if (!sec.fp_start_date) return null;
      const range = `${fmtD(sec.fp_start_date)}${sec.fp_end_date && sec.fp_end_date !== sec.fp_start_date ? ` – ${fmtD(sec.fp_end_date)}` : ''}`;
      return `${shootName(sec, i)}: ${range}`;
    }).filter(Boolean).join('\n');
    return {
      email: user?.email || '',
      invoiceCc: user?.email || '',
      clientCompany: project?.client || '',
      projectName: project?.title || '',
      proposedCode: project?.code || '',
      solutionsCode: budget.solutions_code || '',
      sow: scopeLines.join('\n').trim(),
      budgetSummary: summaryLines.join('\n'),
      mediaRevenue: fmt$(t.total - Number(budget.total_cap_co || 0)),
      capcoRevenue: Number(budget.total_cap_co || 0) ? fmt$(budget.total_cap_co) : '',
      budgetOwner: budget.media_rep || '',
      budgetLink: `${window.location.origin}/finance/${project?.id || ''}`,
      budgetedPositions: positionsBlock,
      productionDates: datesBlock,
      closeMonth: budget.close_month || '',
      primaryContactName: budget.client_contact?.name || '',
      primaryContactEmail: budget.client_contact?.email || '',
      mailingAddress: budget.client_contact?.address || '',
      finalDelivery: budget.est_final_delivery ? String(budget.est_final_delivery).slice(0, 10) : '',
    };
  }

  async function handleStatusChange(v) {
    if (v === 'Live' && (budget.status || 'RFP') === 'RFP') {
      try { await api.getHarbinger(project.id); } catch { setHarbingerOpen(true); return; }
    }
    const prev = budget.status || 'RFP';
    patchBudget({ status: v });
    try { await api.updateBudget(budget.id, { status: v }); }
    catch (e) { alert(e.message); patchBudget({ status: prev }); }
  }

  const closeMonthOptions = useMemo(closeMonthRange, []);
  const mgmtRate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;
  const t = useMemo(() => totals(sections, lines, mgmtRate), [sections, lines, mgmtRate]);
  const [dateEdit, setDateEdit] = useState(null);   // { secId, start, end } while editing a shoot's dates
  const [expandedSecs, setExpandedSecs] = useState({});
  const [revealed, setRevealed] = useState({});

  const patchLine = (id, fields) => set(d => ({ lines: d.lines.map(l => l.id === id ? { ...l, ...fields } : l) }));
  const saveLine = (id, data) => api.updateBudgetLine(id, data).catch(e => alert(e.message));
  const patchBudget = (fields) => set(d => ({ budget: { ...d.budget, ...fields } }));
  const saveBudget = (data) => api.updateBudget(budget.id, data).catch(e => alert(e.message));

  async function addLine(sid, isTravel) {
    const l = await api.addBudgetLine(sid, { isTravel });
    set(d => ({ lines: [...d.lines, l] }));
  }
  async function dupLine(l) {
    const nl = await api.addBudgetLine(l.section_id, {
      scope: l.scope || '', notes: l.notes || '', isTravel: l.is_travel === true,
      unitCost: l.unit_cost, percent: l.percent, qty: l.qty, afterLineId: l.id,
    });
    set(d => ({ lines: [...d.lines.map(x => x.section_id === l.section_id && Number(x.sort) > Number(l.sort) ? { ...x, sort: Number(x.sort) + 1 } : x), nl] }));
  }
  async function delLine(id) {
    await api.deleteBudgetLine(id);
    set(d => ({ lines: d.lines.filter(l => l.id !== id) }));
  }
  const dragLine = useRef(null);
  const dragCtl = {
    start: l => { dragLine.current = l; },
    end: () => { dragLine.current = null; },
    drop: target => {
      const src = dragLine.current;
      dragLine.current = null;
      if (!src || src.id === target.id) return;
      if (src.section_id !== target.section_id || !!src.is_travel !== !!target.is_travel) return;
      set(d => {
        const group = d.lines.filter(x => x.section_id === src.section_id && !!x.is_travel === !!src.is_travel)
          .sort((a, b) => a.sort - b.sort);
        const sorts = group.map(x => Number(x.sort));
        const rest = group.filter(x => x.id !== src.id);
        const ti = rest.findIndex(x => x.id === target.id);
        const si = group.findIndex(x => x.id === src.id);
        const insertAt = si < group.findIndex(x => x.id === target.id) ? ti + 1 : ti;
        rest.splice(insertAt, 0, group[si]);
        const bySortId = {};
        rest.forEach((x, i) => { if (Number(x.sort) !== sorts[i]) { bySortId[x.id] = sorts[i]; api.updateBudgetLine(x.id, { sort: sorts[i] }).catch(() => {}); } });
        return { lines: d.lines.map(x => bySortId[x.id] !== undefined ? { ...x, sort: bySortId[x.id] } : x) };
      });
    },
  };
  async function addSection(seedShoot, afterSectionId) {
    const title = seedShoot ? 'PRODUCTION COSTS — New Shoot' : 'NEW SECTION';
    await api.addBudgetSection(budget.id, { title, kind: seedShoot ? 'shoot' : 'general', seedShoot, afterSectionId });
    reload && reload();
  }
  async function delSection(sid) {
    if (!confirm('Delete this section and all its lines?')) return;
    await api.deleteBudgetSection(sid);
    set(d => ({ sections: d.sections.filter(s => s.id !== sid), lines: d.lines.filter(l => l.section_id !== sid) }));
  }
  const patchSection = (sid, fields) => set(d => ({ sections: d.sections.map(s => s.id === sid ? { ...s, ...fields } : s) }));

  return (
    <div>
      {/* header fields */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', gap:16, flexWrap:'wrap', alignItems:'flex-end' }}>
        {[
          ['Budget Dated', 'budget_date', 'budgetDate', 'date'],
          ...(budget.unbridled_solutions ? [['Solutions Code', 'solutions_code', 'solutionsCode', 'text']] : []),
        ].map(([label, key, apiKey, type]) => (
          <div key={key} style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
            <input type={type} value={budget[key] || ''} style={{ width: type === 'date' ? 140 : 130, fontSize:12 }}
              onChange={e => patchBudget({ [key]: e.target.value })}
              onBlur={e => saveBudget({ [apiKey]: e.target.value })} />
          </div>
        ))}
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Budget Owner</label>
          <select value={budget.media_rep || ''} style={{ width:160, fontSize:12 }}
            onChange={e => { patchBudget({ media_rep: e.target.value }); saveBudget({ mediaRep: e.target.value }); }}>
            <option value="">— Select —</option>
            {budget.media_rep && !BUDGET_OWNERS.includes(budget.media_rep) && <option value={budget.media_rep}>{budget.media_rep}</option>}
            {BUDGET_OWNERS.map(n => <option key={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Est. Final Delivery</label>
          <input type="date" value={budget.est_final_delivery ? String(budget.est_final_delivery).slice(0, 10) : ''} style={{ width:140, fontSize:12 }}
            onChange={e => { patchBudget({ est_final_delivery: e.target.value }); saveBudget({ estFinalDelivery: e.target.value }); }} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Close Month</label>
          <select value={budget.close_month || ''} style={{ width:150, fontSize:12 }}
            onChange={e => { patchBudget({ close_month: e.target.value }); saveBudget({ closeMonth: e.target.value }); }}>
            <option value="">— Select —</option>
            {budget.close_month && !closeMonthOptions.some(o => o.value === budget.close_month) && (
              <option value={budget.close_month}>{budget.close_month}</option>
            )}
            {closeMonthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <ClientContactField budget={budget} patchBudget={patchBudget} saveBudget={saveBudget} />
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Tagged</label>
          <TagRow budgetId={budget.id} ownerName={budget.media_rep} />
        </div>
        <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={() => { const on = !budget.unbridled_solutions; patchBudget({ unbridled_solutions: on }); saveBudget({ unbridledSolutions: on }); }}
              title="Reveals Solutions-specific fields (Solutions Code, commissions) in the budget and Harbinger"
              style={budget.unbridled_solutions
                ? { background:'rgba(74,158,255,0.15)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }
                : { background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              Unbridled Solutions{budget.unbridled_solutions ? ' ✓' : ''}
            </button>
            {(budget.status || 'RFP') === 'RFP' && (
              <button onClick={() => setHarbingerOpen(true)}
                title="Fill out and submit the Harbinger kickoff — moves the budget to Live"
                style={{ background:'rgba(232,80,10,0.14)', border:'1px solid var(--orange)', color:'var(--orange)',
                  borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
                Submit Harbinger
              </button>
            )}
            <StatusPill value={budget.status || 'RFP'} onChange={handleStatusChange} small />
          </div>
          <div style={{ textAlign:'right' }}>
            <span style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginRight:8 }}>Total Budget</span>
            <span style={{ fontSize:18, fontWeight:800, color:'#5ABF80', fontVariantNumeric:'tabular-nums' }}>{fmt$(t.total)}</span>
          </div>
        </div>
      </div>

      {(() => { const lastShootId = [...sections].filter(x => x.kind === 'shoot').map(x => x.id).pop(); return sections.map(sec => {
        const secLines = lines.filter(l => l.section_id === sec.id).sort((a, b) => a.sort - b.sort);
        const main = secLines.filter(l => !l.is_travel);
        const travel = secLines.filter(l => l.is_travel);
        const mainTotal = main.reduce((s, l) => s + lineSubtotal(l, secLines), 0);
        const travelTotal = travel.reduce((s, l) => s + lineSubtotal(l, secLines), 0);
        const isCollapsed = sec.kind === 'shoot' && !expandedSecs[sec.id];
        const hiddenMain = isCollapsed ? main.filter(l => l.percent == null && !(num(l.qty) > 0) && !revealed[l.id] && !ALWAYS_SHOWN.test((l.scope || '').trim())) : [];
        const shownMain = isCollapsed ? main.filter(l => l.percent != null || num(l.qty) > 0 || revealed[l.id] || ALWAYS_SHOWN.test((l.scope || '').trim())) : main;
        async function addPosition(val) {
          if (!val) return;
          if (val === '__custom') {
            const l = await api.addBudgetLine(sec.id, {});
            set(d => ({ lines: [...d.lines, l] }));
            setRevealed(r => ({ ...r, [l.id]: true }));
            return;
          }
          if (val.startsWith('reveal:')) { setRevealed(r => ({ ...r, [val.slice(7)]: true })); return; }
          if (val.startsWith('scope:')) {
            const scope = val.slice(6);
            const l = await api.addBudgetLine(sec.id, { scope });
            set(d => ({ lines: [...d.lines, l] }));
            setRevealed(r => ({ ...r, [l.id]: true }));
          }
        }
        return (
          <div key={sec.id} style={{ background:'var(--bg2)', border: sec.estimate_ref ? '1px solid #e6c229' : '1px solid var(--border)', boxShadow: sec.estimate_ref ? '0 0 10px rgba(230,194,41,0.25)' : 'none', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
            {sec.estimate_ref && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'6px 14px', background:'rgba(230,194,41,0.08)', borderBottom:'1px solid rgba(230,194,41,0.4)' }}>
                <span style={{ fontSize:10, fontWeight:800, color:'#e6c229', textTransform:'uppercase', letterSpacing:'0.06em' }}>Pending Estimate — counts toward the budget until removed</span>
                <button onClick={async () => {
                    if (!confirm('Remove this estimate from the budget? The estimate itself stays in Estimate Mode.')) return;
                    try { await api.removeTentativeEstimate(sec.estimate_ref); reload && reload(); } catch (e2) { alert(e2.message); }
                  }}
                  style={{ background:'rgba(230,194,41,0.15)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:14, padding:'3px 12px', fontSize:10, fontWeight:800, cursor:'pointer', whiteSpace:'nowrap' }}>
                  Remove from Budget
                </button>
              </div>
            )}
            <div className="shoot-head" style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border)', justifyContent:'space-between', flexWrap:'wrap' }}>
              <div className="shoot-head-left" style={{ flex:1, minWidth:200 }}>
                <input value={sec.title} style={{ ...cellIn, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.04em', color:'#5ABF80' }}
                  onChange={e => patchSection(sec.id, { title: e.target.value })}
                  onBlur={e => api.updateBudgetSection(sec.id, { title: e.target.value }).catch(() => {})} />
                <div className="sec-meta" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  {sec.shoot_code && (
                    <span title="Shoot code — used to tie VCC costs and FreePro planning to this shoot"
                      style={{ fontSize:10, fontWeight:800, letterSpacing:'0.05em', color:'#e6c229', border:'1px solid #e6c22955', borderRadius:6, padding:'2px 8px', whiteSpace:'nowrap', flexShrink:0 }}>
                      {sec.shoot_code}
                    </span>
                  )}
                  {sec.kind === 'shoot' && (
                    <input value={sec.trip || ''} placeholder="Trip (e.g. NYC)" title="Production trip descriptor — VCC entries with this trip roll up to this shoot"
                      style={{ ...cellIn, width:120, flexShrink:0, fontSize:11, color:'#e6c229', border:'1px solid rgba(230,194,41,0.25)' }}
                      onChange={e => patchSection(sec.id, { trip: e.target.value })}
                      onBlur={e => api.updateBudgetSection(sec.id, { trip: e.target.value }).catch(() => {})} />
                  )}
                  <input value={sec.subtitle || ''} placeholder={sec.kind === 'shoot' ? 'Shoot Description' : 'Description'}
                    style={{ ...cellIn, fontSize:11, color:'var(--muted)', ...(sec.kind === 'shoot' && sec.fp_start_date ? { width:'auto', flex:'0 1 260px' } : {}) }}
                    onChange={e => patchSection(sec.id, { subtitle: e.target.value })}
                    onBlur={e => api.updateBudgetSection(sec.id, { subtitle: e.target.value }).catch(() => {})} />
                </div>
              </div>
              <div className="shoot-head-right" style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>{fmt$(mainTotal + travelTotal)}</div>
                  <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => delSection(sec.id)}>✕</button>
                </div>
                {sec.kind === 'shoot' && (
                  <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {sec.freepro_project_id && (
                      <a href={`/projects/${sec.freepro_project_id}`}
                        style={{ fontSize:10, fontWeight:700, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.45)', borderRadius:12, padding:'3px 10px', textDecoration:'none', whiteSpace:'nowrap' }}>
                        Go to FreePro ›
                      </a>
                    )}
                    <LinkShootButton sec={sec} onLinked={() => reload && reload()} />
                  </span>
                )}
                {sec.kind === 'shoot' && sec.fp_start_date && (
                  dateEdit?.secId === sec.id ? (
                    <span style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                      <input type="date" value={dateEdit.start} onChange={e => setDateEdit(d => ({ ...d, start: e.target.value }))} style={{ width:'auto', fontSize:11, padding:'3px 6px' }} />
                      <span style={{ fontSize:10, color:'var(--muted)' }}>–</span>
                      <input type="date" value={dateEdit.end} onChange={e => setDateEdit(d => ({ ...d, end: e.target.value }))} style={{ width:'auto', fontSize:11, padding:'3px 6px' }} />
                      <button className="btn btn-primary btn-sm" style={{ fontSize:10, padding:'3px 10px' }}
                        onClick={async () => {
                          try {
                            await api.updateProject(sec.freepro_project_id, { startDate: dateEdit.start, endDate: dateEdit.end || dateEdit.start });
                            patchSection(sec.id, { fp_start_date: dateEdit.start, fp_end_date: dateEdit.end || dateEdit.start });
                            setDateEdit(null);
                          } catch (err) { alert(err.message); }
                        }}>Save</button>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize:10, padding:'3px 8px' }} onClick={() => setDateEdit(null)}>✕</button>
                    </span>
                  ) : (
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span title="Shoot dates — feed the FreePro project, call sheets, and gear views"
                        style={{ fontSize:10, color:'var(--muted)', whiteSpace:'nowrap' }}>
                        {new Date(String(sec.fp_start_date).slice(0,10)+'T12:00:00').toLocaleDateString()} – {new Date(String(sec.fp_end_date || sec.fp_start_date).slice(0,10)+'T12:00:00').toLocaleDateString()}
                      </span>
                      {sec.freepro_project_id && (
                        <button title="Edit the shoot dates — updates FreePro and every view fed by it"
                          onClick={() => setDateEdit({ secId: sec.id, start: String(sec.fp_start_date).slice(0,10), end: String(sec.fp_end_date || sec.fp_start_date).slice(0,10) })}
                          style={{ background:'none', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:8, padding:'2px 8px', fontSize:10, cursor:'pointer' }}>✎ Edit</button>
                      )}
                    </span>
                  )
                )}
              </div>
            </div>
            <div className="budget-tbl-wrap">
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left' }}>
                  <th style={{ padding:'6px 6px 6px 14px', width:'30%' }}>Scope of Work</th>
                  <th style={{ padding:6 }}>Notes</th>
                  <th style={{ padding:6, textAlign:'right', width:80 }}>Hrs/Days</th>
                  <th style={{ padding:6, textAlign:'right', width:90 }}>Unit Cost</th>
                  <th style={{ padding:6, textAlign:'right', width:100 }}>Subtotal</th>
                  <th style={{ width:34 }}></th>
                </tr>
              </thead>
              <tbody>
                {sec.kind === 'shoot' && shownMain.length > 0 && (
                  <tr><td colSpan={4} style={{ padding:'6px 6px 2px 14px', fontSize:9, color:'var(--tan)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Labor</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 2px', fontSize:10, color:'var(--tan)', fontWeight:700 }}></td><td/></tr>
                )}
                {shownMain.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} dupLine={dupLine} dragCtl={dragCtl} />)}
                {sec.kind === 'shoot' && (
                  <tr>
                    <td colSpan={6} style={{ padding:'6px 6px 6px 14px' }}>
                      <select value="" style={{ fontSize:11, width:240, color:'#5ABF80', border:'1px dashed rgba(90,191,128,0.45)', background:'transparent', borderRadius:6, padding:'4px 8px' }}
                        onChange={e => addPosition(e.target.value)}>
                        <option value="">+ Add Position…</option>
                        {isCollapsed
                          ? hiddenMain.map(l => <option key={l.id} value={'reveal:' + l.id}>{l.scope || 'Untitled position'}</option>)
                          : [...new Set(main.filter(l => l.percent == null && l.scope).map(l => l.scope))].map(s2 => <option key={s2} value={'scope:' + s2}>{s2}</option>)}
                        <option value="__custom">Custom position…</option>
                      </select>
                      {isCollapsed && hiddenMain.length > 0 && (
                        <span style={{ fontSize:10, color:'var(--muted)', marginLeft:10 }}>{hiddenMain.length} position option{hiddenMain.length !== 1 ? 's' : ''} hidden</span>
                      )}
                    </td>
                  </tr>
                )}
                {sec.kind === 'shoot' && (
                  <tr>
                    <td colSpan={4} style={{ padding:'6px 6px 6px 14px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5ABF80', borderBottom:'1px solid rgba(90,191,128,0.5)' }}>Labor Subtotal</td>
                    <td style={{ padding:'6px 10px 6px 6px', textAlign:'right', fontSize:12, fontWeight:800, color:'#5ABF80', borderBottom:'1px solid rgba(90,191,128,0.5)' }}>{fmt$(mainTotal)}</td>
                    <td style={{ borderBottom:'1px solid rgba(90,191,128,0.5)' }} />
                  </tr>
                )}
                {travel.length > 0 && (
                  <tr><td colSpan={4} style={{ padding:'6px 6px 2px 14px', fontSize:9, color:'var(--tan)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Travel</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 2px', fontSize:10, color:'var(--tan)', fontWeight:700 }}></td><td/></tr>
                )}
                {travel.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} dupLine={dupLine} dragCtl={dragCtl} />)}
                {sec.kind === 'shoot' && (
                  <tr>
                    <td colSpan={6} style={{ padding:'6px 6px 6px 14px' }}>
                      <button onClick={() => addLine(sec.id, true)}
                        style={{ fontSize:11, width:240, textAlign:'left', color:'#5ABF80', border:'1px dashed rgba(90,191,128,0.45)', background:'transparent', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>
                        + Travel Line…
                      </button>
                    </td>
                  </tr>
                )}
                {travel.length > 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding:'6px 6px 6px 14px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5ABF80', borderBottom:'1px solid rgba(90,191,128,0.5)' }}>Travel Subtotal</td>
                    <td style={{ padding:'6px 10px 6px 6px', textAlign:'right', fontSize:12, fontWeight:800, color:'#5ABF80', borderBottom:'1px solid rgba(90,191,128,0.5)' }}>{fmt$(travelTotal)}</td>
                    <td style={{ borderBottom:'1px solid rgba(90,191,128,0.5)' }} />
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div style={{ display:'flex', gap:8, padding:'6px 14px 10px', alignItems:'center' }}>
              {sec.kind !== 'shoot' && <button className="btn btn-ghost btn-sm" onClick={() => addLine(sec.id, false)}>+ Line</button>}
              {sec.kind === 'shoot' && (
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--muted)' }}
                  onClick={() => setExpandedSecs(x => ({ ...x, [sec.id]: !x[sec.id] }))}>
                  {isCollapsed ? '▸ Expand All Positions' : '▾ Collapse Positions'}
                </button>
              )}
              {sec.kind === 'shoot' && <TravelSync sec={sec} travelTotal={travelTotal} reload={reload} hasHold={(vcc || []).some(e => (e.source || '') === 'travelhold:' + sec.id)} hasActuals={travel.some(l => /Actuals from VCC/i.test(l.notes || ''))} />}
            </div>
          </div>
        );
      }).flatMap(el => {
        const sec = sections.find(x => x.id === el.key);
        if (sec && sec.id === lastShootId) {
          return [el, (
            <div key="add-production" style={{ display:'flex', justifyContent:'center', margin:'0 0 14px' }}>
              <button className="btn btn-ghost btn-sm" style={{ borderStyle:'dashed', color:'#5ABF80' }} onClick={() => addSection(true, sec.id)}>
                + Add New Production
              </button>
            </div>
          )];
        }
        return [el];
      }); })()}

      <div style={{ display:'flex', gap:10, marginBottom:18, alignItems:'center', flexWrap:'wrap' }}>
        {!sections.some(x => x.kind === 'shoot') && (
          <button className="btn btn-ghost btn-sm" style={{ borderStyle:'dashed', color:'#5ABF80' }} onClick={() => addSection(true)}>+ Add New Production</button>
        )}
        {/* Add Section + Mgmt Fee travel together so the fee stays to the
            button's right when the row wraps on phones */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'nowrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => addSection(false)}>+ Add Section</button>
          <div style={{ marginLeft:8, display:'flex', alignItems:'center', gap:6 }}>
            <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>Mgmt Fee %</label>
            <input type="number" step="0.5" value={Math.round(mgmtRate * 1000) / 10} style={{ width:70, fontSize:12, textAlign:'right' }}
              onChange={e => patchBudget({ mgmt_fee_rate: Number(e.target.value) / 100 })}
              onBlur={e => saveBudget({ mgmtFeeRate: Number(e.target.value) / 100 })} />
          </div>
        </div>
      </div>

      {/* summary */}
      <div style={{ background:'var(--bg2)', border:'1px solid #5ABF8055', borderRadius:10, padding:'14px 18px', maxWidth:420, marginLeft:'auto' }}>
        {[
          ['Production & Post (non-travel)', t.nonTravel],
          ['Travel', t.travel],
          [`Management Fee (${Math.round(mgmtRate * 1000) / 10}% of non-travel)`, t.mgmt],
          ['Video Subtotal', t.video],
          ['Photo Subtotal', t.photo],
        ].map(([label, val]) => (
          <div key={label} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', color: label.startsWith('Video') ? 'var(--text)' : 'var(--muted)' }}>
            <span>{label}</span><span style={{ fontWeight:600 }}>{fmt$(val)}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:800, borderTop:'1px solid var(--border)', marginTop:6, paddingTop:8 }}>
          <span>TOTAL PROJECT ESTIMATE</span><span style={{ color:'#5ABF80' }}>{fmt$(t.total)}</span>
        </div>
      </div>
      {harbingerOpen && (
        <HarbingerModal pid={project.id} solutionsOn={!!budget.unbridled_solutions} initial={harbingerPrefill()}
          onClose={() => setHarbingerOpen(false)}
          onSubmitted={() => { patchBudget({ status: 'Live' }); reload && reload(); }} />
      )}
    </div>
  );
}

function LineRow({ l, secLines, patchLine, saveLine, delLine, dupLine, dragCtl }) {
  const st = lineSubtotal(l, secLines);
  const [hover, setHover] = useState(false);
  const [over, setOver] = useState(false);
  const hoverBtn = { background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0, opacity: hover ? 1 : 0, transition:'opacity .12s ease' };
  return (
    <tr style={{ borderTop: over ? '2px solid #5ABF80' : '1px solid rgba(255,255,255,0.03)' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onDragOver={dragCtl ? e => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={dragCtl ? () => setOver(false) : undefined}
      onDrop={dragCtl ? e => { e.preventDefault(); setOver(false); dragCtl.drop(l); } : undefined}>
      <td style={{ padding:'2px 6px 2px 2px' }}>
        <div style={{ display:'flex', alignItems:'center' }}>
        <button type="button" title="Duplicate this line directly below"
          onClick={() => dupLine && dupLine(l)}
          style={{ ...hoverBtn, width:12, color:'#5ABF80', fontSize:12, fontWeight:800, opacity: hover && dupLine ? 1 : 0 }}>
          +
        </button>
        {dragCtl && (
          <span draggable title="Drag to reorder"
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; dragCtl.start(l); }}
            onDragEnd={() => dragCtl.end()}
            style={{ width:12, flexShrink:0, cursor:'grab', color:'var(--muted)', fontSize:10, letterSpacing:'-1px', opacity: hover ? 1 : 0, transition:'opacity .12s ease', userSelect:'none' }}>
            ⋮⋮
          </span>
        )}
        <input value={l.scope || ''} style={cellIn}
          onChange={e => patchLine(l.id, { scope: e.target.value })}
          onBlur={e => saveLine(l.id, { scope: e.target.value })} />
        </div>
      </td>
      <td style={{ padding:'2px 6px' }}>
        <input value={l.notes || ''} style={{ ...cellIn, color:'var(--muted)', fontSize:11 }}
          onChange={e => patchLine(l.id, { notes: e.target.value })}
          onBlur={e => saveLine(l.id, { notes: e.target.value })} />
      </td>
      <td style={{ padding:'2px 6px', textAlign:'right' }}>
        {l.percent != null ? (
          <button type="button" title={num(l.qty) > 0 ? 'Creative Direction applied — click to remove' : 'Click to apply Creative Direction to this section'}
            onClick={() => { const q = num(l.qty) > 0 ? 0 : 1; patchLine(l.id, { qty: q }); saveLine(l.id, { qty: q }); }}
            style={{
              background: num(l.qty) > 0 ? 'rgba(90,191,128,0.15)' : 'transparent',
              border: '1px solid ' + (num(l.qty) > 0 ? '#5ABF80' : 'var(--border)'),
              color: num(l.qty) > 0 ? '#5ABF80' : 'var(--muted)',
              borderRadius:20, padding:'2px 10px', fontSize:9, fontWeight:800, letterSpacing:'0.05em', textTransform:'uppercase', cursor:'pointer', whiteSpace:'nowrap',
            }}>
            {num(l.qty) > 0 ? '✓ On' : 'Off'}
          </button>
        ) : (
          <input type="number" step={l.is_travel ? '1' : '0.5'} value={l.qty ?? 0} style={numIn}
            onChange={e => patchLine(l.id, { qty: e.target.value })}
            onBlur={e => {
              const v = l.is_travel ? String(Math.round(num(e.target.value))) : e.target.value;
              if (v !== e.target.value) patchLine(l.id, { qty: v });
              saveLine(l.id, { qty: v });
            }} />
        )}
      </td>
      <td style={{ padding:'2px 6px', textAlign:'right' }}>
        {l.percent != null
          ? <span style={{ fontSize:11, color:'var(--muted)' }}>{Math.round(l.percent * 100)}% of section</span>
          : <MoneyInput value={l.unit_cost ?? 0} width={95}
              onCommit={v => { patchLine(l.id, { unit_cost: v }); saveLine(l.id, { unitCost: v }); }} />}
      </td>
      <td style={{ padding:'2px 10px 2px 6px', textAlign:'right', fontSize:12, fontWeight:600, color: st ? 'var(--text)' : 'var(--muted)' }}>{st ? fmt$(st) : '—'}</td>
      <td style={{ textAlign:'center' }}>
        <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => delLine(l.id)}>✕</button>
      </td>
    </tr>
  );
}

export function VccTab({ pid, budget, sections, lines, vcc, categories, set, vccOnly }) {
  const { user } = useAuth();
  const mgmtRate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;
  const t = useMemo(() => totals(sections, lines, mgmtRate), [sections, lines, mgmtRate]);
  const [form, setForm] = useState({ entryDate:'', vendor:'', description:'', category:'', trip:'', amount:'', status:'HOLD' });
  const [invForm, setInvForm] = useState(null);    // Add Invoice form state (null = closed)
  const [contactBook, setContactBook] = useState(null);   // every contact person used before, for autofill
  useEffect(() => {
    if (invForm && contactBook === null) api.clientContactPeople().then(setContactBook).catch(() => setContactBook([]));
  }, [invForm, contactBook]);
  const [invReview, setInvReview] = useState(null); // extra-deposit index being reviewed

  const deposits = num(budget.deposit) + num(budget.additional_deposit) + (Array.isArray(budget.extra_deposits) ? budget.extra_deposits : []).reduce((a, x) => a + num(x.amount), 0);
  const finalInvoice = Math.max(t.total - deposits, 0);
  const payments = t.total;
  const billable = vcc.reduce((s, e) => s + num(e.amount), 0);
  const revenue = t.total - num(budget.total_cap_co);
  const gp = payments - billable;

  const patchBudget = (fields) => set(d => ({ budget: { ...d.budget, ...fields } }));
  const saveBudget = (data) => api.updateBudget(budget.id, data).catch(e => alert(e.message));

  async function addEntry(e) {
    e.preventDefault();
    if (!form.description || !form.amount) return;
    const entry = await api.addVccEntry(pid, form);
    set(d => ({ vcc: [...d.vcc, entry] }));
    setForm(f => ({ ...f, description:'', amount:'' }));
  }
  const patchEntry = (id, fields) => set(d => ({ vcc: d.vcc.map(x => x.id === id ? { ...x, ...fields } : x) }));
  const saveEntry = (id, data) => api.updateVccEntry(id, data).catch(e => alert(e.message));
  async function delEntry(id) {
    await api.deleteVccEntry(id);
    set(d => ({ vcc: d.vcc.filter(x => x.id !== id) }));
  }

  // A shoot can be coded on entries by its shoot code or its trip name; both map
  // to one canonical option (the shoot code) shown as "NN - Trip", so it never
  // appears twice in the dropdown.
  const shootSecs = sections.filter(x => x.kind === 'shoot');
  const shootCodes = new Set(shootSecs.map(x => x.shoot_code).filter(Boolean));
  const shootTrips = new Set(shootSecs.map(x => x.trip).filter(Boolean));
  const canonTrip = t => shootSecs.find(x => x.trip && x.trip === t)?.shoot_code || t;
  const tripLabel = t => {
    const sec = shootSecs.find(x => x.shoot_code === t || (x.trip && x.trip === t));
    if (!sec) return t;
    const nn = (sec.shoot_code || '').split('-').pop() || '';
    return `${nn} - ${sec.trip || 'Shoot ' + nn}`;
  };
  const byTrip = {};
  for (const e of vcc) (byTrip[canonTrip(e.trip) || '—'] ||= []).push(e);
  const shootOpts = shootSecs.map(x => ({ value: x.shoot_code || x.trip, label: tripLabel(x.shoot_code || x.trip) }));
  const extraTrips = [...new Set(vcc.map(e => canonTrip(e.trip)).filter(t => t && !shootCodes.has(t) && !shootTrips.has(t) && !shootOpts.some(o => o.value === t)))];
  const tripOptions = [...shootOpts, ...['Pre-Pro', 'Post'].filter(t => !extraTrips.includes(t) && !shootOpts.some(o => o.value === t)).map(t => ({ value: t, label: t })), ...extraTrips.map(t => ({ value: t, label: t }))];
  const catTotals = {};
  for (const e of vcc) catTotals[e.category || 'Uncategorized'] = (catTotals[e.category || 'Uncategorized'] || 0) + num(e.amount);

  const kpi = (label, val, color) => (
    <div style={{ textAlign:'right' }}>
      <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
      <div style={{ fontSize:15, fontWeight:800, color: color || 'var(--text)' }}>{val}</div>
    </div>
  );

  return (
    <div>
      {/* profit summary + deposits (hidden in the VCC-only report view) */}
      {!vccOnly && <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14, marginBottom:16 }}>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px' }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80', marginBottom:10 }}>Profit Summary</div>
          <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
            {kpi('Payments', fmt$(payments))}
            {kpi('Billable', fmt$(billable), '#e6c229')}
            {kpi('Gross Profit', fmt$(gp), gp >= 0 ? '#5ABF80' : '#e05252')}
            {kpi('Profitability', revenue ? (gp / revenue * 100).toFixed(1) + '%' : '—', gp >= 0 ? '#5ABF80' : '#e05252')}
          </div>
          <div style={{ display:'flex', gap:14, marginTop:12, flexWrap:'wrap' }}>
            <label style={{ fontSize:10, color:'var(--muted)', display:'flex', alignItems:'center', gap:6 }}>Total Cap Co
              <MoneyInput value={budget.total_cap_co ?? 0} width={100}
                onCommit={v => { patchBudget({ total_cap_co: v }); saveBudget({ totalCapCo: v }); }} /></label>
            <label style={{ fontSize:10, color:'var(--muted)', display:'flex', alignItems:'center', gap:6 }}>Original Fee Est.
              <MoneyInput value={budget.original_fee_estimate ?? ''} width={100}
                onCommit={v => { patchBudget({ original_fee_estimate: v }); saveBudget({ originalFeeEstimate: v }); }} /></label>
            <span style={{ fontSize:10, color:'var(--muted)', alignSelf:'center' }}>Media Revenue {fmt$(revenue)}</span>
          </div>
        </div>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px' }}>
          {(() => {
            const extras = Array.isArray(budget.extra_deposits) ? budget.extra_deposits : [];
            const saveExtras = next => { patchBudget({ extra_deposits: next }); saveBudget({ extraDeposits: next }); };
            const today = () => new Date().toISOString().slice(0, 10);
            const fmtD = d => d ? new Date(d.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '';
            const sendMsg = async (label, amount, extra) => {
              try {
                const r = await api.sendClientInvoice(budget.id, label, amount, extra);
                alert(`Invoice email sent to ${Array.isArray(r.to) ? r.to.join(', ') : r.to}. Invoice date recorded as today.`);
              } catch (e2) {
                if (e2.status === 501 || /not connected|not configured/i.test(e2.message)) maybeMailNotice('The client invoice email');
                else alert(e2.message + '\n\nInvoice date still recorded as today.');
              }
            };
            const send = (dateKey, apiKey, label, amount) => {
              const d = today();
              patchBudget({ [dateKey]: d });
              saveBudget({ [apiKey]: d });
              sendMsg(label, amount);
            };
            const row = (key, label, amountEl, dateVal, onSend, onRemove) => (
              <React.Fragment key={key}>
                <span style={{ color:'var(--muted)' }}>{label}</span>
                <span style={{ display:'flex', justifyContent:'flex-end' }}>{amountEl}</span>
                <span style={{ fontSize:10, color: dateVal ? 'var(--text)' : 'var(--muted)', textAlign:'center' }}>{dateVal ? fmtD(dateVal) : '—'}</span>
                <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                  {onSend && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ whiteSpace:'nowrap' }} onClick={onSend}>✉ Send Invoice</button>
                  )}
                  {onRemove && (
                    <button type="button" title="Remove this deposit" onClick={onRemove}
                      style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11 }}>✕</button>
                  )}
                </span>
              </React.Fragment>
            );
            return (
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80' }}>Client Deposits</div>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize:10, whiteSpace:'nowrap' }}
                    onClick={() => setInvForm({ number: String(extras.length + 2), sendToName: '', sendToEmail: '', ccList: [], description: '', amount: '' })}>+ Add Invoice</button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'auto 110px 64px auto', gap:'7px 10px', fontSize:11, alignItems:'center' }}>
                  {row('dep0', 'Deposit',
                    <MoneyInput value={budget.deposit ?? ''} width={110} onCommit={v => { patchBudget({ deposit: v }); saveBudget({ deposit: v }); }} />,
                    budget.deposit_due, () => send('deposit_due', 'depositDue', 'Deposit', num(budget.deposit)))}
                  {extras.map((x, i) => row(`dep${i + 1}`,
                    (x.sendToEmail || x.description || x.sendToName)
                      ? <span onClick={() => setInvReview(i)} title="Review this invoice"
                          style={{ color:'#5ABF80', textDecoration:'underline', cursor:'pointer' }}>Deposit {x.number || i + 2}</span>
                      : `Deposit ${x.number || i + 2}`,
                    <MoneyInput value={x.amount ?? ''} width={110}
                      onCommit={v => saveExtras(extras.map((y, j) => j === i ? { ...y, amount: v } : y))} />,
                    x.date,
                    () => { saveExtras(extras.map((y, j) => j === i ? { ...y, date: today() } : y)); sendMsg(`Deposit ${x.number || i + 2}`, num(x.amount), { to: x.sendToEmail || undefined, cc: x.cc || undefined, description: x.description || undefined }); },
                    () => { if (confirm('Remove this deposit?')) saveExtras(extras.filter((_, j) => j !== i)); }))}
                  {row('final', 'Final Invoice',
                    <span style={{ fontWeight:700, padding:'4px 6px' }}>{fmt$(finalInvoice)}</span>,
                    budget.final_inv_date, () => send('final_inv_date', 'finalInvDate', 'Final Invoice', finalInvoice))}
                  {row('total', 'Total Budget',
                    <span style={{ fontWeight:800, color:'#5ABF80', padding:'4px 6px' }}>{fmt$(t.total)}</span>,
                    null, null)}
                </div>
                {invForm && (
                  <div className="modal-bg" onClick={e => e.target === e.currentTarget && setInvForm(null)} style={{ zIndex:250 }}>
                    <div className="modal" style={{ maxWidth:460 }}>
                      <div className="modal-title">Add Invoice</div>
                      <form onSubmit={e => {
                        e.preventDefault();
                        const ccJoined = (invForm.ccList || []).join(', ');
                        const entry = { amount: invForm.amount === '' ? null : Number(invForm.amount), date: null,
                          number: invForm.number.trim(), sendToName: invForm.sendToName.trim(), sendToEmail: invForm.sendToEmail.trim(),
                          cc: ccJoined, description: invForm.description.trim(),
                          requestedAt: today(), requestedBy: user?.name || user?.email || '' };
                        saveExtras([...extras, entry]);
                        // Remember these contacts platform-wide for future invoices
                        const known = new Set((contactBook || []).map(c => (c.email || '').toLowerCase()).filter(Boolean));
                        if (entry.sendToEmail && !known.has(entry.sendToEmail.toLowerCase()))
                          api.saveContactPerson({ name: entry.sendToName, email: entry.sendToEmail }).catch(() => {});
                        for (const em of (invForm.ccList || []))
                          if (!known.has(em.toLowerCase())) api.saveContactPerson({ email: em }).catch(() => {});
                        api.requestInvoice(budget.id, entry).catch(e2 => {
                          if (e2.status === 501 || /not connected|not configured/i.test(e2.message)) maybeMailNotice('The invoice request email to billing@unbridledmedia.com');
                          else alert('Invoice saved, but the billing email failed: ' + e2.message);
                        });
                        setInvForm(null);
                      }}>
                        <div className="form-grid" style={{ marginBottom:12 }}>
                          <div className="field"><label>Deposit #</label><input value={invForm.number} onChange={e => setInvForm(f=>({...f,number:e.target.value}))} required /></div>
                          <div className="field"><label>Amount</label><input type="number" step="0.01" value={invForm.amount} onChange={e => setInvForm(f=>({...f,amount:e.target.value}))} required /></div>
                          <SendToPicker contacts={contactBook} name={invForm.sendToName} email={invForm.sendToEmail}
                            onPick={(name, email) => setInvForm(f => ({ ...f, sendToName: name, sendToEmail: email }))} />
                          <CcPicker contacts={contactBook} list={invForm.ccList || []}
                            onChange={ccList => setInvForm(f => ({ ...f, ccList }))} />
                          <div className="field span2">
                            <label>Invoice Description <span style={{ color: invForm.description.length >= 35 ? '#e05252' : 'var(--muted)', textTransform:'none' }}>({invForm.description.length}/35)</span></label>
                            <input value={invForm.description} maxLength={35} onChange={e => setInvForm(f=>({...f,description:e.target.value.slice(0,35)}))} required />
                          </div>
                        </div>
                        <div className="btn-row">
                          <button className="btn btn-primary">Add Invoice</button>
                          <button type="button" className="btn btn-ghost" onClick={() => setInvForm(null)}>Cancel</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
                {invReview != null && extras[invReview] && (() => { const x = extras[invReview]; return (
                  <div className="modal-bg" onClick={e => e.target === e.currentTarget && setInvReview(null)} style={{ zIndex:250 }}>
                    <div className="modal" style={{ maxWidth:420 }}>
                      <div className="modal-title">Deposit {x.number || invReview + 2}</div>
                      <div style={{ display:'grid', gridTemplateColumns:'110px 1fr', gap:'7px 12px', fontSize:12, marginBottom:14 }}>
                        <span style={{ color:'var(--muted)' }}>Amount</span><span style={{ fontWeight:700, color:'#5ABF80' }}>{x.amount != null ? fmt$(x.amount) : '—'}</span>
                        <span style={{ color:'var(--muted)' }}>Send To</span><span>{[x.sendToName, x.sendToEmail].filter(Boolean).join(' — ') || '—'}</span>
                        <span style={{ color:'var(--muted)' }}>CC</span><span>{x.cc || '—'}</span>
                        <span style={{ color:'var(--muted)' }}>Description</span><span>{x.description || '—'}</span>
                        <span style={{ color:'var(--muted)' }}>Invoice Date</span><span>{x.date ? fmtD(x.date) : 'Not sent yet'}</span>
                      </div>
                      <div className="btn-row">
                        <button type="button" className="btn btn-ghost" onClick={() => setInvReview(null)}>Close</button>
                      </div>
                    </div>
                  </div>
                ); })()}
              </>
            );
          })()}
        </div>
      </div>}

      {/* tools */}
      <VccTools pid={pid} set={set} vcc={vcc} />

      {/* add entry */}
      <form onSubmit={addEntry} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <input type="date" value={form.entryDate} style={{ width:130, fontSize:11 }} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} />
        <input placeholder="Vendor" value={form.vendor} style={{ width:120, fontSize:11 }} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} />
        <input placeholder="Description" value={form.description} style={{ flex:1, minWidth:160, fontSize:11 }} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        <select value={form.category} style={{ width:180, fontSize:11 }} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          <option value="">Category…</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={form.trip} style={{ width:130, fontSize:11 }} onChange={e => setForm(f => ({ ...f, trip: e.target.value }))}>
          <option value="">Trip…</option>
          {tripOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="number" step="0.01" placeholder="Amount" value={form.amount} style={{ width:100, fontSize:11, textAlign:'right' }} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
        <select value={form.status} style={{ width:90, fontSize:11 }} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
          <option value="HOLD">Hold</option><option value="NOT_POSTED">Not Posted</option><option value="POSTED">Posted</option>
        </select>
        <button className="btn btn-primary btn-sm">Add</button>
      </form>

      {/* entries grouped by trip */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:16 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
          <thead>
            <tr style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left' }}>
              <th style={{ padding:'8px 6px 8px 14px', width:90 }}>Date</th>
              <th style={{ padding:6, width:110 }}>Vendor</th>
              <th style={{ padding:6 }}>Description</th>
              <th style={{ padding:6, width:190 }}>Category</th>
              <th style={{ padding:6, width:110 }}>Trip</th>
              <th style={{ padding:6, textAlign:'right', width:90 }}>Amount</th>
              <th style={{ padding:6, width:70 }}>Status</th>
              <th style={{ width:34 }}></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byTrip).map(([trip, entries]) => (
              <React.Fragment key={trip}>
                <tr style={{ background:'rgba(90,191,128,0.06)' }}>
                  <td colSpan={5} style={{ padding:'5px 14px', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80' }}>{tripLabel(trip)}</td>
                  <td style={{ textAlign:'right', padding:'5px 6px', fontWeight:700, color:'#5ABF80' }}>{fmt$(entries.reduce((s, e) => s + num(e.amount), 0))}</td>
                  <td colSpan={2} />
                </tr>
                {entries.map(e => (
                  <tr key={e.id} style={{ borderTop:'1px solid rgba(255,255,255,0.03)', background: e.review ? 'rgba(224,82,82,0.05)' : 'transparent' }}>
                    <td style={{ padding:'2px 6px 2px 14px', color:'var(--muted)' }}>{e.entry_date ? new Date(e.entry_date.slice(0,10)+'T12:00:00').toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'}) : '—'}</td>
                    <td style={{ padding:'2px 6px', color:'var(--muted)' }}>{e.vendor || '—'}</td>
                    <td style={{ padding:'2px 6px' }}>
                      <input value={e.description || ''} style={cellIn}
                        onChange={ev => patchEntry(e.id, { description: ev.target.value })}
                        onBlur={ev => saveEntry(e.id, { description: ev.target.value })} />
                      {e.flag && <div style={{ fontSize:9, color:'#e05252', padding:'0 6px 2px' }}>⚠ {e.flag}</div>}
                    </td>
                    <td style={{ padding:'2px 6px' }}>
                      <select value={e.category || ''} style={{ ...cellIn, fontSize:10, color:'var(--muted)' }}
                        onChange={ev => { patchEntry(e.id, { category: ev.target.value }); saveEntry(e.id, { category: ev.target.value }); }}>
                        <option value="">—</option>
                        {categories.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'2px 6px' }}>
                      <select value={canonTrip(e.trip) || ''} style={{ ...cellIn, fontSize:10, color:'var(--muted)' }}
                        onChange={ev => { patchEntry(e.id, { trip: ev.target.value }); saveEntry(e.id, { trip: ev.target.value }); }}>
                        <option value="">—</option>
                        {tripOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'2px 6px', textAlign:'right' }}>
                      <MoneyInput value={e.amount ?? 0} width={95}
                        onCommit={v => { patchEntry(e.id, { amount: v }); saveEntry(e.id, { amount: v }); }} />
                    </td>
                    <td style={{ padding:'2px 6px', whiteSpace:'nowrap' }}>
                      {e.review ? (
                        <button title={e.flag || 'Imported — confirm coding'} onClick={() => { patchEntry(e.id, { review: false, flag: null }); api.updateVccEntry(e.id, { review: false, flag: null }).catch(() => {}); }}
                          style={{ background:'rgba(224,82,82,0.12)', border:'1px solid #e05252', color:'#e05252', borderRadius:10, padding:'1px 8px', fontSize:9, fontWeight:700, cursor:'pointer' }}>
                          ✓ Accept
                        </button>
                      ) : (
                        <button title="Click to cycle Hold → Not Posted → Posted"
                          onClick={() => { const s = e.status === 'HOLD' ? 'NOT_POSTED' : e.status === 'NOT_POSTED' ? 'POSTED' : 'HOLD'; patchEntry(e.id, { status: s }); saveEntry(e.id, { status: s }); }}
                          style={{ background:'none', border:`1px solid ${e.status === 'POSTED' ? '#5ABF80' : e.status === 'NOT_POSTED' ? '#e8500a' : '#e6c229'}55`, color: e.status === 'POSTED' ? '#5ABF80' : e.status === 'NOT_POSTED' ? '#e8500a' : '#e6c229', borderRadius:10, padding:'1px 8px', fontSize:9, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                          {e.status === 'POSTED' ? 'Posted' : e.status === 'NOT_POSTED' ? 'Not Posted' : 'Hold'}
                        </button>
                      )}
                    </td>
                    <td style={{ textAlign:'center' }}>
                      <button style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:10 }} onClick={() => delEntry(e.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {vcc.length === 0 && <tr><td colSpan={8} style={{ padding:'14px', color:'var(--muted)', fontStyle:'italic' }}>No direct costs yet.</td></tr>}
            <tr style={{ borderTop:'1px solid var(--border)' }}>
              <td colSpan={5} style={{ padding:'8px 14px', fontWeight:700, textAlign:'right', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)' }}>Total Direct Costs</td>
              <td style={{ textAlign:'right', padding:'8px 6px', fontWeight:800, fontSize:13, color:'#e6c229' }}>{fmt$(billable)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      {/* travel by shoot */}
      {(() => {
        const shoots = sections.filter(x => x.kind === 'shoot');
        if (!shoots.length) return null;
        const TRAVEL_CATS = ['5900 Airfare (B)', '5180 Hotel Payments (B)', '5410 Per Diem (B)', '5255 Staff Travel Expenses (B)'];
        return (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12, marginBottom:16 }}>
            {shoots.map(sec => {
              const trips = [sec.trip, sec.shoot_code].filter(Boolean);
              const mine = vcc.filter(e => trips.includes(e.trip));
              const travelEntries = mine.filter(e => TRAVEL_CATS.includes(e.category) && !(e.source || '').startsWith('travelhold:'));
              const actuals = travelEntries.reduce((s2, e) => s2 + num(e.amount), 0);
              const catBreakdown = TRAVEL_CATS.map(cat => [cat, travelEntries.filter(e => e.category === cat).reduce((s2, e) => s2 + num(e.amount), 0)]).filter(([, v]) => v !== 0);
              const CAT_LABELS = { '5900 Airfare (B)': 'Airfare', '5180 Hotel Payments (B)': 'Hotel', '5410 Per Diem (B)': 'Per Diem', '5255 Staff Travel Expenses (B)': 'Transportation / T&E' };
              const hold = mine.filter(e => (e.source || '').startsWith('travelhold:')).reduce((s2, e) => s2 + num(e.amount), 0);
              const budgetTravel = lines.filter(l => l.section_id === sec.id && l.is_travel).reduce((s2, l) => s2 + num(l.qty) * num(l.unit_cost), 0);
              return (
                <div key={sec.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'11px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8 }}>
                    <span style={{ fontSize:10, fontWeight:800, letterSpacing:'0.05em', color:'#e6c229' }}>{sec.shoot_code}</span>
                    <span style={{ fontSize:10, color:'var(--muted)' }}>{sec.trip || '—'}</span>
                  </div>
                  <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:8 }}>Travel — this shoot</div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginTop:4 }}>
                    <span style={{ color:'var(--muted)' }}>Budget</span><span style={{ fontWeight:600 }}>{fmt$(budgetTravel)}</span>
                  </div>
                  {hold > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                      <span style={{ color:'var(--muted)' }}>Hold in VCC</span><span style={{ fontWeight:600, color:'#e6c229' }}>{fmt$(hold)}</span>
                    </div>
                  )}
                  {catBreakdown.map(([cat, v]) => (
                    <div key={cat} style={{ display:'flex', justifyContent:'space-between', fontSize:10, paddingLeft:10 }}>
                      <span style={{ color:'var(--muted)' }}>{CAT_LABELS[cat] || cat}</span><span style={{ color:'var(--text)' }}>{fmt$(v)}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginTop: catBreakdown.length ? 3 : 0 }}>
                    <span style={{ color:'var(--muted)' }}>Actuals</span><span style={{ fontWeight:700, color: actuals > budgetTravel ? '#e05252' : '#5ABF80' }}>{fmt$(actuals)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, borderTop:'1px solid var(--border)', marginTop:5, paddingTop:5 }}>
                    <span style={{ color:'var(--muted)' }}>Variance</span>
                    <span style={{ fontWeight:700, color: budgetTravel - actuals >= 0 ? '#5ABF80' : '#e05252' }}>{fmt$(budgetTravel - actuals)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* breakage by category */}
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', maxWidth:480 }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80', marginBottom:8 }}>Breakage — by Category</div>
        {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
          <div key={cat} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'2px 0' }}>
            <span style={{ color:'var(--muted)' }}>{cat}</span><span style={{ fontWeight:600 }}>{fmt$(total)}</span>
          </div>
        ))}
        {vcc.length === 0 && <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Nothing to break down yet.</div>}
      </div>
    </div>
  );
}


function VccTools({ pid, set, vcc }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const reviewCount = vcc.filter(e => e.review).length;

  async function sync() {
    setBusy('sync'); setMsg('');
    try {
      const r = await api.syncFreePro(pid);
      set(() => ({ vcc: r.vcc }));
      setMsg(`FreePro sync: ${r.created} added, ${r.updated} updated.`);
    } catch (e) { alert(e.message); }
    setBusy('');
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('odc'); setMsg('');
    try {
      const b64 = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1]);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      });
      const r = await api.importOdc(pid, b64, file.name);
      set(() => ({ vcc: r.vcc }));
      setMsg(`ODC import: ${r.imported} new charge${r.imported === 1 ? '' : 's'}${r.skipped ? `, ${r.skipped} already in the VCC` : ''}${r.aiUsed ? ' — coded by AI, review below.' : ' — coded from history where possible, review below.'}`);
    } catch (e2) { alert(e2.message); }
    setBusy('');
  }

  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
      <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === 'odc' ? 'Importing…' : '⬆ Import ODC Report'}</button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={onFile} />
      {reviewCount > 0 && (
        <span style={{ fontSize:11, color:'#e05252', fontWeight:700 }}>⚠ {reviewCount} charge{reviewCount === 1 ? '' : 's'} need review</span>
      )}
      {msg && <span style={{ fontSize:11, color:'var(--muted)' }}>{msg}</span>}
      <div style={{ flex:1 }} />
      <VendorInvoicesButton pid={pid} />
    </div>
  );
}

// ── Add Invoice contact pickers ──
// Send To: type-ahead over every contact person used anywhere on the platform;
// picking one fills name + email. New name/email pairs are saved on submit.
function SendToPicker({ contacts, name, email, onPick }) {
  const [open, setOpen] = useState(false);
  const matches = (q) => (contacts || [])
    .filter(c => c.email && (q === '' || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q)))
    .slice(0, 6);
  const list = open ? matches(name.trim().toLowerCase()) : [];
  return (
    <>
      <div className="field" style={{ position:'relative' }}>
        <label>Send To — Name</label>
        <input value={name} required autoComplete="off"
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => { onPick(e.target.value, email); setOpen(true); }} />
        {open && list.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:-10, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, zIndex:300, maxHeight:190, overflowY:'auto' }}>
            {list.map((c, i) => (
              <div key={i} onMouseDown={() => { onPick(c.name || '', c.email || ''); setOpen(false); }}
                style={{ padding:'7px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
                <div style={{ fontSize:12, fontWeight:600 }}>{c.name || c.email}{c.company ? <span style={{ color:'var(--muted)', fontWeight:400 }}> — {c.company}</span> : null}</div>
                {c.name && <div style={{ fontSize:10.5, color:'var(--muted)' }}>{c.email}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="field"><label>Send To — Email</label>
        <input type="email" value={email} required onChange={e => onPick(name, e.target.value)} /></div>
    </>
  );
}

// Who to CC: search existing contacts or type a new address; each pick becomes
// a removable pill. New addresses are saved as contacts on submit.
function CcPicker({ contacts, list, onChange }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const isEmail = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());
  const needle = q.trim().toLowerCase();
  const matches = (contacts || [])
    .filter(c => c.email && !list.includes(c.email)
      && (needle === '' || (c.name || '').toLowerCase().includes(needle) || (c.email || '').toLowerCase().includes(needle)))
    .slice(0, 6);
  const add = (em) => { if (em && !list.includes(em)) onChange([...list, em]); setQ(''); };
  return (
    <div className="field span2" style={{ position:'relative' }}>
      <label>Who to CC</label>
      <div style={{ display:'flex', gap:8 }}>
        <input value={q} autoComplete="off" placeholder="Search contacts or type an email…" style={{ flex:1 }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (isEmail(q)) add(q.trim());
              else if (matches.length === 1) add(matches[0].email);
            }
          }} />
        <button type="button" className="btn btn-ghost btn-sm" disabled={!isEmail(q)} title="Add this email as a new contact"
          onClick={() => add(q.trim())}>+ Add New</button>
      </div>
      {open && matches.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, zIndex:300, maxHeight:190, overflowY:'auto' }}>
          {matches.map((c, i) => (
            <div key={i} onMouseDown={() => add(c.email)}
              style={{ padding:'7px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:12, fontWeight:600 }}>{c.name || c.email}{c.company ? <span style={{ color:'var(--muted)', fontWeight:400 }}> — {c.company}</span> : null}</div>
              {c.name && <div style={{ fontSize:10.5, color:'var(--muted)' }}>{c.email}</div>}
            </div>
          ))}
        </div>
      )}
      {list.length > 0 && (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
          {list.map(em => (
            <span key={em} style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(90,191,128,0.12)', border:'1px solid rgba(90,191,128,0.5)', color:'#5ABF80', borderRadius:12, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
              {em}
              <span title="Remove" onClick={() => onChange(list.filter(x => x !== em))} style={{ cursor:'pointer', fontWeight:800, opacity:0.8 }}>✕</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Vendor invoices: per-project uploaded invoice files ──
function VendorInvoicesButton({ pid }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) api.vendorInvoices(pid).then(setFiles).catch(e => alert(e.message));
  }, [open, pid]);

  function uploadOne(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return alert(`${file.name}: file too large (20MB max)`);
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        const row = await api.uploadVendorInvoice(pid, { filename: file.name, mime: file.type, fileBase64: String(reader.result).split(',')[1] });
        setFiles(fs => [row, ...(fs || [])]);
      } catch (e) { alert(e.message); }
      setBusy(false);
    };
    reader.readAsDataURL(file);
  }

  function pick(ev) {
    const list = Array.from(ev.target.files || []);
    ev.target.value = '';
    list.forEach(uploadOne);
  }

  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  function onDrop(ev) {
    ev.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    Array.from(ev.dataTransfer?.files || []).forEach(uploadOne);
  }

  async function download(f) {
    try {
      const r = await fetch(`/api/finance/vendor-invoices/${f.id}/file`, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
      if (!r.ok) throw new Error('Download failed');
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = f.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { alert(e.message); }
  }

  async function remove(f) {
    if (!confirm(`Delete ${f.filename}?`)) return;
    try { await api.deleteVendorInvoice(f.id); setFiles(fs => fs.filter(x => x.id !== f.id)); }
    catch (e) { alert(e.message); }
  }

  const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ background:'rgba(230,194,41,0.12)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
        🧾 Vendor Invoices{files ? ` (${files.length})` : ''}
      </button>
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div
            onDragEnter={e => { e.preventDefault(); dragDepth.current += 1; setDragging(true); }}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
            onDragLeave={e => { e.preventDefault(); dragDepth.current -= 1; if (dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }}
            onDrop={onDrop}
            style={{ position:'relative', background:'var(--bg2)', border: dragging ? '1px dashed #e6c229' : '1px solid var(--border)', borderTop:'3px solid #e6c229', borderRadius:12, width:'100%', maxWidth:620, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {dragging && (
              <div style={{ position:'absolute', inset:0, zIndex:5, background:'rgba(230,194,41,0.10)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <div style={{ fontSize:14, fontWeight:800, color:'#e6c229', background:'var(--bg2)', border:'1px dashed #e6c229', borderRadius:10, padding:'12px 22px' }}>
                  Drop to upload invoice{`…`}
                </div>
              </div>
            )}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:14, fontWeight:800 }}>🧾 Vendor Invoices</div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : '+ Upload Invoice'}</button>
                <input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx" style={{ display:'none' }} onChange={pick} />
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>
            <div style={{ overflowY:'auto', padding:'8px 18px 16px' }}>
              {!files && <div style={{ fontSize:11, color:'var(--muted)', padding:'12px 0' }}>Loading…</div>}
              {files && files.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', padding:'14px 0' }}>No invoices uploaded yet — drag files anywhere onto this window (or use + Upload Invoice) so they live with the project.</div>}
              {files && files.length > 0 && <div style={{ fontSize:10, color:'var(--muted)', padding:'6px 0 2px', textAlign:'center' }}>Tip: drag & drop files anywhere on this window to upload.</div>}
              {(files || []).map(f => (
                <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div onClick={() => download(f)} style={{ fontSize:12, fontWeight:700, color:'#4a9eff', cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.filename}</div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>
                      {f.vendor_name && <span style={{ color:'var(--text)', fontWeight:700 }}>{f.vendor_name} · </span>}
                      {fmtSize(f.size)} · {f.uploaded_by || 'unknown'} · {new Date(f.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {f.amount != null && (
                    <div style={{ fontSize:13, fontWeight:800, color:'#e6c229', whiteSpace:'nowrap' }}>
                      {'$' + Number(f.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => download(f)}>⬇</button>
                  <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e05252)' }} onClick={() => remove(f)}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// Client Budget: pick how the client sees it (line items vs buckets) in a
// pop-out, then open the shared page. No standing toggle in the header.
// Project Estimate PDF: the Unbridled template auto-populated from the budget.
// Buckets: Pre-Production/Creative (scripting/storyboarding + mgmt fee),
// Production (shoots, photography, virtual recording, misc), Post-Production,
// Travel (every is_travel line). Opens a white print-ready page → Save as PDF.
function openEstimatePdf({ project, budget, sections, lines, preparedBy }) {
  const mgmtRate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;
  const bySection = {};
  for (const l of lines) (bySection[l.section_id] ||= []).push(l);
  let pre = 0, prod = 0, post = 0, travel = 0, photo = 0;
  for (const sec of sections) {
    const secLines = bySection[sec.id] || [];
    for (const l of secLines) {
      const st = lineSubtotal(l, secLines);
      if (l.is_travel) { travel += st; continue; }
      if (sec.kind === 'photo') { photo += st; continue; }
      if (sec.kind === 'shoot') { prod += st; continue; }
      const t = String(sec.title || '').toLowerCase();
      if (/post/.test(t)) post += st;
      else if (/script|storyboard|creative|concept/.test(t)) pre += st;
      else prod += st;
    }
  }
  // Coordination fee uses the same base as the budget total (non-travel, non-photo),
  // and lands in Pre-Production/Creative ("planning, logistics, and coordination").
  const mgmt = mgmtRate * (pre + prod + post);
  pre += mgmt;
  prod += photo;
  const total = pre + prod + post + travel;
  const money = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const today = new Date();
  const valid = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
  const fmtLong = d => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const ROWS = [
    ['Pre-Production / Creative Costs', 'Reflects costs associated with creative development, planning, logistics, and coordination.', pre],
    ['Production Costs', 'Crew, equipment, and resources required to capture content and execute shoot(s).', prod],
    ['Post-Production Costs', 'Editing, color, sound, motion graphics, revisions, and delivery of final assets.', post],
    ['Travel Costs', 'Projected costs associated with crew travel, including airfare, lodging, per diem, ground transportation, and insurance.', travel],
  ];
  const summary = [
    ['Client Company Name:', esc(project.client)],
    ['Project Title:', esc(project.title)],
    ['Total Estimated Investment:', money(total)],
    ['Date Estimate Sent:', fmtLong(today)],
    ['Estimate Valid Through:', fmtLong(valid)],
    ['Prepared By:', esc(preparedBy)],
  ];
  const w = window.open('', '_blank');
  if (!w) return alert('Pop-up blocked — allow pop-ups to generate the estimate PDF.');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Project Estimate — ${esc(project.code)}</title>
    <style>
      @page { size: letter; margin: 0; }   /* zero page margin = no browser URL/date header-footer */
      * { box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color:#2b2f33; margin:0; padding:32px 40px; background:#fff; }
      .hdr { display:flex; align-items:center; justify-content:space-between; border-bottom:3px solid #d95a1a; padding-bottom:14px; margin-bottom:18px; }
      .hdr img { height:44px; }
      .hdr .t { font-size:21px; font-weight:800; letter-spacing:0.12em; color:#3d4449; }
      .intro { font-size:11.5px; line-height:1.55; color:#444; margin-bottom:20px; }
      h2 { font-size:12.5px; letter-spacing:0.08em; color:#d95a1a; margin:22px 0 8px; text-transform:uppercase; }
      table { width:100%; border-collapse:collapse; font-size:11.5px; }
      .sum td { border:1px solid #cfd3d6; padding:7px 10px; }
      .sum td:first-child { width:38%; font-weight:700; background:#f4f5f6; }
      .inv th { border:1px solid #cfd3d6; padding:7px 10px; background:#3d4449; color:#fff; text-align:left; font-size:11px; letter-spacing:0.05em; }
      .inv th:last-child, .inv td.amt { text-align:right; width:130px; white-space:nowrap; }
      .inv td { border:1px solid #cfd3d6; padding:7px 10px; vertical-align:top; }
      .inv .cat { font-weight:800; }
      .inv .desc { font-size:10px; color:#666; margin-top:2px; line-height:1.4; }
      .inv tr.total td { background:#f4f5f6; font-weight:800; font-size:12.5px; }
      .next { font-size:11.5px; line-height:1.55; color:#444; margin-top:20px; }
      .next b { color:#d95a1a; letter-spacing:0.06em; }
      @media print { body { padding: 0.7in; } }
    </style></head><body>
    <div class="hdr"><img src="${window.location.origin}/unbridled-logo.png" alt="Unbridled Media"><div class="t">PROJECT ESTIMATE</div></div>
    <div class="intro">This estimate reflects the proposed SOW and associated costs for the project outlined below. Changes to scope, timeline, or deliverables may impact final pricing. Estimate is valid for 30 days from the date sent.</div>
    <h2>Estimate Summary</h2>
    <table class="sum"><tbody>${summary.map(([k, v]) => `<tr><td>${k}</td><td>${v || '&nbsp;'}</td></tr>`).join('')}</tbody></table>
    <h2>Project Investment</h2>
    <table class="inv"><thead><tr><th></th><th>Subtotal</th></tr></thead><tbody>
      ${ROWS.map(([cat, desc, amt]) => `<tr><td><div class="cat">${cat}</div><div class="desc">${desc}</div></td><td class="amt">${money(amt)}</td></tr>`).join('')}
      <tr class="total"><td>TOTAL PROJECT ESTIMATE:</td><td class="amt">${money(total)}</td></tr>
    </tbody></table>
    <div class="next"><b>NEXT STEPS:</b> Once these estimated costs are approved, Unbridled Media will follow up with a formal contract outlining full terms and conditions. The contract will include the final project estimate for review and signature prior to project kickoff.
    <br><br>Thank you for the opportunity to collaborate! Please don’t hesitate to reach out with any questions as you review this estimate.</div>
    <script>window.onload = () => setTimeout(() => window.print(), 350);</` + `script>
    </body></html>`);
  w.document.close();
}

function ShareBudgetButton({ budget, project, sections, lines, onModePicked, onOverview }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function share(mode) {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateBudget(budget.id, { shareMode: mode });
      onModePicked && onModePicked(mode);
      const { token } = await api.shareBudget(budget.id);
      setOpen(false);
      window.open(`${window.location.origin}/budget/${token}`, '_blank');
    } catch (e) { alert(e.message); }
    setBusy(false);
  }
  const current = budget.share_mode || 'lines';
  const OPTIONS = [
    ['lines', 'Line Items', 'The full budget line by line — every position, rate, and quantity.'],
    ['buckets', 'Buckets', 'Rolled-up section totals only — no individual line detail.'],
    ['items-nocost', 'Itemized — No Costs', 'Every line item and quantity, with all dollar figures removed.'],
  ];
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Open the client-facing budget page in a new window"
        style={{ background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
        Client Budget
      </button>
      {open && (
        <div onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{ position:'fixed', inset:0, zIndex:130, background:'rgba(0,0,0,0.72)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ width:'100%', maxWidth:420, background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #4a9eff', borderRadius:12, padding:'18px 20px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
              <div style={{ fontSize:14, fontWeight:800 }}>Client Budget</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>How should the client see this budget?</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <button type="button" onClick={() => { setOpen(false); onOverview && onOverview(); }}
                style={{ textAlign:'left', background:'var(--bg)', border:'1px solid #5ABF80', borderRadius:10, padding:'12px 14px', cursor:'pointer' }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#5ABF80' }}>Budget Overview</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>The client-facing summary — cost inclusions and headline numbers.</div>
              </button>
              {OPTIONS.map(([m, label, desc]) => (
                <button key={m} type="button" disabled={busy} onClick={() => share(m)}
                  style={{ textAlign:'left', background: current === m ? 'rgba(74,158,255,0.10)' : 'var(--bg)', border: current === m ? '1px solid #4a9eff' : '1px solid var(--border)',
                    borderRadius:10, padding:'12px 14px', cursor:'pointer', opacity: busy ? 0.6 : 1 }}>
                  <div style={{ fontSize:13, fontWeight:800, color: current === m ? '#4a9eff' : 'var(--text)' }}>
                    {label}{current === m && <span style={{ fontSize:10, fontWeight:700, color:'var(--muted)' }}> · last used</span>}
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{desc}</div>
                </button>
              ))}
              <button type="button" onClick={() => { setOpen(false); openEstimatePdf({ project, budget, sections, lines, preparedBy: user?.name || user?.email || '' }); }}
                style={{ textAlign:'left', background:'var(--bg)', border:'1px solid #e6c229', borderRadius:10, padding:'12px 14px', cursor:'pointer' }}>
                <div style={{ fontSize:13, fontWeight:800, color:'#e6c229' }}>Project Estimate PDF</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>The Unbridled estimate template auto-filled from this budget — opens print-ready, save as PDF.</div>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


const STATUS_OPTS = [
  ['RFP', '#e6c229', 'Waiting on client approval — shows in the RFP folder'],
  ['Live', '#5ABF80', 'Approved — moves to Live Projects'],
  ['Reconcile', '#9DC183', 'Project complete, finalize budget'],
  ['Closed', '#8a8f98', 'Finished — moves to the Archive folder'],
  ['Dead', '#e05252', 'Not approved — moves to the Archive folder'],
];
// Allowed paths: RFP → Live/Dead · Live → Reconcile/Closed · Reconcile → Closed
// (archived statuses can be reopened)
const STATUS_PATHS = {
  RFP: ['Live', 'Dead'],
  Live: ['Reconcile', 'Closed'],
  Reconcile: ['Closed', 'Live'],
  Closed: ['Live'],
  Dead: ['RFP'],
};

// Tag teammates onto a budget for visibility — initials icons + a "+ Tag" picker
const TAG_COLORS = ['#5ABF80', '#4a9eff', '#e6c229', '#e8955a', '#a78bfa', '#f08080', '#40A0A0', '#d66a9b'];
const tagColor = s => { let h = 0; for (const c of s || '') h = (h * 31 + c.charCodeAt(0)) & 0xffffffff; return TAG_COLORS[Math.abs(h) % TAG_COLORS.length]; };
const tagInitials = n => { const w = (n || '?').trim().split(/\s+/); return ((w[0]?.[0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); };

function TagRow({ budgetId, ownerName }) {
  const [tags, setTags] = useState([]);
  const [open, setOpen] = useState(false);

  // Re-fetch when the owner changes — setting an owner auto-tags them
  useEffect(() => {
    if (!budgetId) return;
    const t = setTimeout(() => {
      api.budgetTags(budgetId).then(setTags).catch(() => setTags([]));
    }, 400);
    return () => clearTimeout(t);
  }, [budgetId, ownerName]);

  // Options mirror the Budget Owner dropdown; hide names already tagged
  const tagged = tags.map(t => (t.name || '').toLowerCase());
  const available = BUDGET_OWNERS.filter(n => {
    const last = n.trim().toLowerCase().split(/\s+/).pop();
    return !tagged.some(t => t.split(/\s+/).pop() === last);
  });

  async function add(name) {
    setOpen(false);
    if (!name) return;
    try { setTags(await api.addBudgetTagByName(budgetId, name)); } catch (e) { alert(e.message); }
  }
  async function remove(t) {
    if (!confirm(`Remove ${t.name} from this budget?`)) return;
    try { await api.removeBudgetTag(budgetId, t.user_id); setTags(ts => ts.filter(x => x.user_id !== t.user_id)); }
    catch (e) { alert(e.message); }
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, position:'relative' }}>
      {tags.map(t => {
        const c = tagColor(t.name);
        return (
          <span key={t.user_id} title={`${t.name} — click to remove`} onClick={() => remove(t)}
            style={{ width:24, height:24, borderRadius:'50%', background:`${c}2e`, border:`1px solid ${c}`, color:c,
              display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:800, cursor:'pointer', flexShrink:0 }}>
            {tagInitials(t.name)}
          </span>
        );
      })}
      <button onClick={() => setOpen(o => !o)}
        style={{ background:'transparent', border:'1px dashed var(--border)', color:'var(--muted)', borderRadius:12, padding:'3px 10px', fontSize:10, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
        + Tag
      </button>
      {open && (
        <div style={{ position:'absolute', top:'110%', right:0, zIndex:50, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, minWidth:170, overflow:'hidden', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
          {available.length === 0 && <div style={{ padding:'8px 12px', fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>Everyone's tagged.</div>}
          {available.map(n => (
            <div key={n} onClick={() => add(n)}
              style={{ padding:'7px 12px', fontSize:12, cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ value, onChange, small }) {
  const [open, setOpen] = useState(false);
  const cur = STATUS_OPTS.find(o => o[0] === value) || STATUS_OPTS[0];
  return (
    <div style={{ position:'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display:'inline-flex', alignItems:'center', gap:5, background:`${cur[1]}1c`, border:`1px solid ${cur[1]}`, color:cur[1], borderRadius:20, padding: small ? '3px 10px' : '5px 14px', fontSize: small ? 9 : 11, fontWeight:800, letterSpacing:'0.05em', textTransform:'uppercase', cursor:'pointer' }}>
        {cur[0]} <span style={{ fontSize: small ? 7 : 8 }}>▼</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'110%', right:0, zIndex:50, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:6, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', minWidth:250 }}>
          {STATUS_OPTS.filter(([name]) => (STATUS_PATHS[value] || []).includes(name) || name === value).map(([name, color, hint]) => (
            <div key={name} onClick={() => { setOpen(false); if (name !== value) onChange(name); }}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'7px 10px', borderRadius:7, cursor:'pointer', background: name === value ? 'rgba(255,255,255,0.04)' : 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = name === value ? 'rgba(255,255,255,0.04)' : 'transparent'}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
              <div>
                <div style={{ fontSize:11, fontWeight:700, color }}>{name}</div>
                <div style={{ fontSize:10, color:'var(--muted)' }}>{hint}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function TravelSync({ sec, travelTotal, reload, hasHold, hasActuals }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const fmt = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mode = hasHold ? 'hold' : hasActuals ? 'actuals' : null;

  async function select(next) {
    if (busy || next === mode) return;
    setBusy(true); setMsg('');
    try {
      if (next === 'hold') {
        const r = await api.pushTravelHold(sec.id);
        setMsg(`Hold of ${fmt(r.amount)} pushed to VCC as "${sec.shoot_code} - Travel Hold".`);
      } else {
        const r = await api.pullTravelActuals(sec.id);
        if (!r.updated.length) setMsg('No coded travel actuals in the VCC for this shoot yet — hold left in place.');
        else setMsg(`Updated ${r.updated.map(u => u.scope).join(', ')} from VCC actuals; hold retired.`);
      }
      reload && reload();
    } catch (e) { alert(e.message); }
    setBusy(false);
  }

  const seg = (key, label, color) => {
    const active = mode === key;
    return (
      <button type="button" disabled={busy} onClick={() => select(key)}
        style={{ background: active ? color : 'transparent', color: active ? '#0b0b0b' : 'var(--muted)', border:'none', padding:'4px 12px', fontSize:10, fontWeight:800, letterSpacing:'0.05em', textTransform:'uppercase', cursor:'pointer' }}>
        {label}
      </button>
    );
  };

  return (
    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
      {msg && <span style={{ fontSize:10, color:'var(--muted)' }}>{msg}</span>}
      <span style={{ fontSize:10, color:'var(--tan)', fontWeight:700 }}>Travel {fmt(travelTotal)}</span>
      <div title="Hold pushes budgeted travel to the VCC as a hold line; Actuals pulls coded VCC travel back into these lines and retires the hold"
        style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
        {seg('hold', busy && mode !== 'hold' ? '…' : 'Hold', '#e6c229')}
        {seg('actuals', busy && mode !== 'actuals' ? '…' : 'Actuals', '#5ABF80')}
      </div>
    </div>
  );
}


const OVERVIEW_LABELS = { scripting:'Scripting / Storyboarding', virtual:'Virtual Recording', shoot:'Production', post:'Post-Production', misc:'Misc Costs', photo:'Photography' };
const MGMT_INCLUSIONS = [
  'Creative Consultation', 'Budget & Accounts Payable Management', 'Line Production',
  'Location Scouting and Management', 'Production/Post Timelines', 'Film Schedule & Call Sheets',
  'Catering/Crafty', 'Editor Sourcing and Management', 'Version Control',
];

function OverviewEstimateModal({ sections, lines, feeRate, heading, onClose }) {
  const tableRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const rows = [];
  let feeBase = 0;
  for (const s of sections) {
    const secLines = lines.filter(l => l.section_id === s.id);
    let cost = 0;
    const inclusions = [];
    const counts = new Map(); // scope → crew-member count (one line = one person)
    for (const l of secLines) {
      const st = lineSubtotal(l, secLines);
      if (st <= 0) continue;
      cost += st;
      if (s.kind !== 'photo' && !l.is_travel) feeBase += st;
      const scope = (l.scope || 'Line item').trim();
      counts.set(scope, (counts.get(scope) || 0) + 1);
    }
    for (const [scope, n] of counts) inclusions.push((n > 1 ? `${n}x ` : '') + scope);
    if (cost <= 0) continue;
    rows.push({ name: OVERVIEW_LABELS[s.kind] || s.title || 'Costs', cost, inclusions });
  }
  const fee = feeBase * feeRate;
  const total = rows.reduce((s, r) => s + r.cost, 0) + fee;
  const pct = Math.round(feeRate * 1000) / 10;

  async function copy() {
    const html = '<meta charset="utf-8">' + tableRef.current.outerHTML;
    const text = [
      ...rows.map(r => `${r.name}: ${fmt$(r.cost)}\n${r.inclusions.map(i => '  - ' + i).join('\n')}`),
      `Production Management: ${fmt$(fee)} (*${pct}% of Production and Post-Production Costs)`,
      `Total Cost: ${fmt$(total)}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
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

  const td = { border:'1px solid #999', padding:'10px 14px', verticalAlign:'top', fontSize:14, color:'#111' };
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:120, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, padding:'20px 22px', width:'100%', maxWidth:780, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:14, flexWrap:'wrap' }}>
          <div style={{ fontSize:15, fontWeight:800 }}>{heading || 'Overview Estimate'}</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={copy}
              style={{ background: copied ? '#5ABF80' : 'rgba(90,191,128,0.15)', border:'1px solid #5ABF80', color: copied ? '#0b0b0b' : '#5ABF80', borderRadius:20, padding:'5px 16px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
              {copied ? '✓ Copied' : '📋 Copy for Email'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ background:'#fff', borderRadius:8, padding:14, overflowX:'auto' }}>
          <table ref={tableRef} style={{ borderCollapse:'collapse', width:'100%', background:'#ffffff', fontFamily:'Arial, sans-serif' }}>
            <thead>
              <tr>
                <td style={td}></td>
                <td style={{ ...td, fontWeight:'bold' }}>Cost Estimate</td>
                <td style={{ ...td, fontWeight:'bold' }}>Cost Inclusions</td>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...td, fontWeight:'bold', textAlign:'center' }}>{r.name}</td>
                  <td style={{ ...td, textAlign:'center' }}>{fmt$(r.cost)}</td>
                  <td style={td}>
                    {r.inclusions.map((inc, j) => <div key={j} style={{ paddingLeft:24 }}>- {inc}</div>)}
                  </td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight:'bold', textAlign:'center' }}>Production Management</td>
                <td style={{ ...td, textAlign:'center' }}>{fmt$(fee)}</td>
                <td style={td}>
                  <div style={{ fontStyle:'italic' }}>*{pct}% of Production and Post-Production Costs</div>
                  {MGMT_INCLUSIONS.map((inc, j) => <div key={j} style={{ paddingLeft:24 }}>- {inc}</div>)}
                </td>
              </tr>
              <tr style={{ background:'#f7e8d8' }}>
                <td style={{ ...td, fontWeight:'bold', textAlign:'center' }}>Total Cost</td>
                <td style={{ ...td, fontWeight:'bold' }}>{fmt$(total)}</td>
                <td style={td}></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:10 }}>Copy pastes the formatted table straight into Outlook / Gmail.</div>
      </div>
    </div>
  );
}

function EditProjectModal({ project, onClose, onSaved }) {
  const [f, setF] = useState({
    code: project.code || '', title: project.title || '', client: project.client || '',
  });
  const [logo, setLogo] = useState(project.client_logo || null);
  const [saving, setSaving] = useState(false);
  const setV = k => e => setF(v => ({ ...v, [k]: e.target.value }));
  async function save() {
    setSaving(true);
    try {
      const payload = { clientLogo: logo };
      if (f.code !== (project.code || '')) payload.code = f.code;
      if (f.title !== (project.title || '')) payload.title = f.title;
      if (f.client !== (project.client || '')) payload.client = f.client;
      const p2 = await api.updateProject(project.id, payload);
      onSaved({ ...p2, code: payload.code || project.code });
    } catch (e) { alert(e.message); setSaving(false); }
  }
  const field = (label, k, type = 'text') => (
    <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', flex:1, minWidth:120 }}>
      {label}
      <input type={type} value={f[k]} onChange={setV(k)}
        style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', padding:'8px 10px', fontSize:13 }} />
    </label>
  );
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:110, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #5ABF80', borderRadius:12, padding:'22px 24px', width:'100%', maxWidth:560 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ fontSize:16, fontWeight:800 }}>Edit Project</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
            {field('Project Code', 'code')}
            <label style={{ display:'flex', flexDirection:'column', gap:4, fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', flex:1, minWidth:120 }}>
              Client
              <ClientSelect value={f.client} onChange={name => setF(v => ({ ...v, client: name }))} />
            </label>
          </div>
          {field('Project Name', 'title')}
          <LogoField value={logo} onChange={setLogo} />
          <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
            <button disabled={saving} onClick={save}
              style={{ background:'#5ABF80', color:'#0b0b0b', border:'none', borderRadius:8, padding:'8px 18px', fontSize:12, fontWeight:800, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const EST_TEMPLATES = [
  ['scripting', 'Scripting / Storyboarding'],
  ['virtual', 'Virtual Recording'],
  ['shoot', 'Production Costs'],
  ['post', 'Post-Production'],
  ['misc', 'Misc Costs'],
  ['photo', 'Photography'],
];
const YEL = '#e6c229';

function EstimateMode({ pid, estimates, onExit, reload }) {
  const [entered, setEntered] = useState(false);
  const [idx, setIdx] = useState(Math.max(estimates.length - 1, 0));
  const [busy, setBusy] = useState(false);
  const feeRate = estimates.length ? Number(estimates[0].mgmt_fee_rate ?? 0.15) : 0.15;
  const [overview, setOverview] = useState(false);
  // Live sections/lines reported up from each pane so the overview reflects edits
  const paneData = useRef({});

  useEffect(() => { requestAnimationFrame(() => setEntered(true)); }, []);
  useEffect(() => {
    if (!estimates.length && !busy) {
      setBusy(true);
      api.createEstimate(pid).then(() => reload()).finally(() => setBusy(false));
    }
  }, [estimates.length]);
  useEffect(() => { setIdx(i => Math.min(i, Math.max(estimates.length - 1, 0))); }, [estimates.length]);

  function exit() { setEntered(false); setTimeout(onExit, 320); }

  async function addEstimate() {
    setBusy(true);
    try { await api.createEstimate(pid); await reload(); setIdx(estimates.length); } catch (e) { alert(e.message); }
    setBusy(false);
  }
  async function saveFeeAll(v) {
    const rate = Number(v) / 100;
    try { await Promise.all(estimates.map(e => api.updateBudget(e.id, { mgmtFeeRate: rate }))); await reload(); } catch (e) { alert(e.message); }
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:90, background:'var(--bg)',
      border: '3px solid ' + YEL, boxSizing:'border-box',
      transform: entered ? 'translateX(0)' : 'translateX(100%)', transition:'transform .32s ease',
      display:'flex', flexDirection:'column',
    }}>
      <div style={{ display:'flex', justifyContent:'flex-end', padding:'8px 14px 0' }}>
        <button onClick={exit}
          style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
          ← Back to Budget
        </button>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'2px 22px 12px', borderBottom:'1px solid rgba(230,194,41,0.35)', flexWrap:'wrap' }}>
        <span style={{ color:YEL, fontWeight:800, fontSize:13, letterSpacing:'0.1em' }}>⚡ ESTIMATE MODE</span>
        <span style={{ fontSize:11, color:'var(--muted)' }}>Pricing only — nothing here feeds the approved budget until you move it over.</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          {estimates.length > 1 && (
            <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:YEL, fontWeight:700 }}>
              <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>‹</button>
              {idx + 1} / {estimates.length}
              <button className="btn btn-ghost btn-sm" disabled={idx >= estimates.length - 1} onClick={() => setIdx(i => i + 1)}>›</button>
            </span>
          )}
          {estimates[idx] && (
            <button onClick={() => setOverview(true)}
              style={{ background:'rgba(90,191,128,0.12)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              Estimate Overview
            </button>
          )}
          <button disabled={busy} onClick={addEstimate}
            style={{ background:'rgba(230,194,41,0.15)', border:'1px solid ' + YEL, color:YEL, borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            + New Estimate
          </button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'hidden' }}>
        <div style={{ display:'flex', height:'100%', width:'100%', transform:`translateX(-${idx * 100}%)`, transition:'transform .32s ease' }}>
          {estimates.map(est => (
            <div key={est.id} style={{ minWidth:'100%', height:'100%', overflowY:'auto', padding:'18px 26px 60px' }}>
              <EstimatePane est={est} feeRate={feeRate} saveFeeAll={saveFeeAll} reload={reload} onMerged={exit}
                onData={(secs, lns) => { paneData.current[est.id] = { sections: secs, lines: lns }; }} />
            </div>
          ))}
          {!estimates.length && <div style={{ minWidth:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>Creating your first estimate…</div>}
        </div>
      </div>
      {overview && estimates[idx] && (() => {
        const live = paneData.current[estimates[idx].id] || estimates[idx];
        return <OverviewEstimateModal sections={live.sections} lines={live.lines} feeRate={feeRate}
          heading={`Estimate Overview — ${estimates[idx].label || 'Estimate'}`} onClose={() => setOverview(false)} />;
      })()}
    </div>
  );
}

function EstimatePane({ est, feeRate, saveFeeAll, reload, onMerged, onData }) {
  const [feeDraft, setFeeDraft] = useState(Math.round(feeRate * 1000) / 10);
  useEffect(() => { setFeeDraft(Math.round(feeRate * 1000) / 10); }, [feeRate]);
  const [sections, setSections] = useState(est.sections);
  const [lines, setLines] = useState(est.lines);
  useEffect(() => { onData?.(sections, lines); }, [sections, lines]);
  const [label, setLabel] = useState(est.label || 'Estimate');
  const [busy, setBusy] = useState(false);
  const [expandedSecs, setExpandedSecs] = useState({});
  const [revealed, setRevealed] = useState({});

  const patchLine = (id, fields) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...fields } : l));
  const saveLine = (id, data) => api.updateBudgetLine(id, data).catch(e => alert(e.message));
  async function delLine(id) { await api.deleteBudgetLine(id); setLines(ls => ls.filter(l => l.id !== id)); }
  async function addLine(sid, isTravel) {
    const l = await api.addBudgetLine(sid, { isTravel });
    setLines(ls => [...ls, l]);
  }
  async function dupLine(l) {
    const nl = await api.addBudgetLine(l.section_id, {
      scope: l.scope || '', notes: l.notes || '', isTravel: l.is_travel === true,
      unitCost: l.unit_cost, percent: l.percent, qty: l.qty, afterLineId: l.id,
    });
    setLines(ls => [...ls.map(x => x.section_id === l.section_id && Number(x.sort) > Number(l.sort) ? { ...x, sort: Number(x.sort) + 1 } : x), nl]);
  }
  const dragLine = useRef(null);
  const dragCtl = {
    start: l => { dragLine.current = l; },
    end: () => { dragLine.current = null; },
    drop: target => {
      const src = dragLine.current;
      dragLine.current = null;
      if (!src || src.id === target.id) return;
      if (src.section_id !== target.section_id || !!src.is_travel !== !!target.is_travel) return;
      setLines(ls => {
        const group = ls.filter(x => x.section_id === src.section_id && !!x.is_travel === !!src.is_travel)
          .sort((a, b) => a.sort - b.sort);
        const sorts = group.map(x => Number(x.sort));
        const rest = group.filter(x => x.id !== src.id);
        const ti = rest.findIndex(x => x.id === target.id);
        const si = group.findIndex(x => x.id === src.id);
        const insertAt = si < group.findIndex(x => x.id === target.id) ? ti + 1 : ti;
        rest.splice(insertAt, 0, group[si]);
        const bySortId = {};
        rest.forEach((x, i) => { if (Number(x.sort) !== sorts[i]) { bySortId[x.id] = sorts[i]; api.updateBudgetLine(x.id, { sort: sorts[i] }).catch(() => {}); } });
        return ls.map(x => bySortId[x.id] !== undefined ? { ...x, sort: bySortId[x.id] } : x);
      });
    },
  };
  const patchSection = (sid, fields) => setSections(ss => ss.map(x => x.id === sid ? { ...x, ...fields } : x));
  async function delSection(sid) {
    if (!confirm('Delete this estimate section?')) return;
    await api.deleteBudgetSection(sid);
    setSections(ss => ss.filter(x => x.id !== sid));
    setLines(ls => ls.filter(l => l.section_id !== sid));
  }
  async function addTemplateSection(key) {
    if (!key) return;
    try {
      const r = await api.addBudgetSection(est.id, { template: key });
      setSections(ss => [...ss, r.section]);
      setLines(ls => [...ls, ...(r.lines || [])]);
    } catch (e) { alert(e.message); }
  }
  async function merge() {
    if (!confirm(`Move "${label}" into the approved budget? Its sections become part of the live budget and this estimate closes.`)) return;
    setBusy(true);
    try { await api.mergeEstimate(est.id); await reload(); onMerged && onMerged(); } catch (e) { alert(e.message); }
    setBusy(false);
  }
  async function remove() {
    if (!confirm(`Delete "${label}" and everything in it?`)) return;
    setBusy(true);
    try { await api.deleteEstimate(est.id); await reload(); } catch (e) { alert(e.message); }
    setBusy(false);
  }

  let nonTravel = 0, travel = 0;
  const bySec = {};
  for (const l of lines) (bySec[l.section_id] ||= []).push(l);
  for (const secLines of Object.values(bySec)) {
    for (const l of secLines) {
      const st = lineSubtotal(l, secLines);
      if (l.is_travel) travel += st; else nonTravel += st;
    }
  }
  const fee = feeRate * nonTravel;
  const total = nonTravel + travel + fee;

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:16 }}>
        <input value={label} onChange={e => setLabel(e.target.value)}
          onBlur={e => api.updateBudget(est.id, { label: e.target.value }).catch(() => {})}
          style={{ fontSize:18, fontWeight:800, background:'transparent', border:'1px solid transparent', borderRadius:6, padding:'4px 8px', color:YEL, width:280 }} />
        <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
          <div style={{ display:'flex', gap:8 }}>
            <button disabled={busy} title="Drop a removable, yellow-outlined copy of this estimate into the budget while it's pending"
              onClick={async () => {
                setBusy(true);
                try { await api.addTentativeEstimate(est.id); await reload(); alert(`"${label}" added to the budget as a pending (yellow) section — remove it from the budget tile any time.`); }
                catch (e) { alert(e.message); }
                setBusy(false);
              }}
              style={{ background:'rgba(230,194,41,0.15)', border:'1px solid ' + YEL, color:YEL, borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              Hold Estimate
            </button>
            <button disabled={busy} onClick={merge}
              style={{ background:'rgba(90,191,128,0.15)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              ✓ Approved: Add to Budget
            </button>
            <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e08080)' }} disabled={busy} onClick={remove}>Delete Estimate</button>
          </div>
          <span style={{ fontSize:12, color:'var(--muted)' }}>{label} Total: <b style={{ color:YEL }}>{fmt$(total)}</b></span>
        </div>
      </div>

      {sections.sort((a, b) => a.sort - b.sort).map(sec => {
        const secLines = lines.filter(l => l.section_id === sec.id).sort((a, b) => a.sort - b.sort);
        const main = secLines.filter(l => !l.is_travel);
        const trav = secLines.filter(l => l.is_travel);
        const secTotal = secLines.reduce((s2, l) => s2 + lineSubtotal(l, secLines), 0);
        const isCollapsed = sec.kind === 'shoot' && !expandedSecs[sec.id];
        const hiddenMain = isCollapsed ? main.filter(l => l.percent == null && !(num(l.qty) > 0) && !revealed[l.id] && !ALWAYS_SHOWN.test((l.scope || '').trim())) : [];
        const shownMain = isCollapsed ? main.filter(l => l.percent != null || num(l.qty) > 0 || revealed[l.id] || ALWAYS_SHOWN.test((l.scope || '').trim())) : main;
        async function addPosition(val) {
          if (!val) return;
          if (val === '__custom') {
            const l = await api.addBudgetLine(sec.id, {});
            setLines(ls => [...ls, l]);
            setRevealed(r => ({ ...r, [l.id]: true }));
            return;
          }
          if (val.startsWith('reveal:')) { setRevealed(r => ({ ...r, [val.slice(7)]: true })); return; }
          if (val.startsWith('scope:')) {
            const scope = val.slice(6);
            const l = await api.addBudgetLine(sec.id, { scope });
            setLines(ls => [...ls, l]);
            setRevealed(r => ({ ...r, [l.id]: true }));
          }
        }
        return (
          <div key={sec.id} style={{ background:'var(--bg2)', border:'1px solid rgba(230,194,41,0.25)', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <input value={sec.title} style={{ ...cellIn, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.04em', color:YEL }}
                  onChange={e => patchSection(sec.id, { title: e.target.value })}
                  onBlur={e => api.updateBudgetSection(sec.id, { title: e.target.value }).catch(() => {})} />
                <input value={sec.subtitle || ''} placeholder={sec.kind === 'shoot' ? 'Shoot Description' : 'Description'} style={{ ...cellIn, fontSize:11, color:'var(--muted)' }}
                  onChange={e => patchSection(sec.id, { subtitle: e.target.value })}
                  onBlur={e => api.updateBudgetSection(sec.id, { subtitle: e.target.value }).catch(() => {})} />
              </div>
              <div style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>{fmt$(secTotal)}</div>
              <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => delSection(sec.id)}>✕</button>
            </div>
            <div className="budget-tbl-wrap">
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left' }}>
                  <th style={{ padding:'6px 6px 6px 14px', width:'30%' }}>Scope of Work</th>
                  <th style={{ padding:6 }}>Notes</th>
                  <th style={{ padding:6, textAlign:'right', width:80 }}>Hrs/Days</th>
                  <th style={{ padding:6, textAlign:'right', width:90 }}>Unit Cost</th>
                  <th style={{ padding:6, textAlign:'right', width:100 }}>Subtotal</th>
                  <th style={{ width:34 }}></th>
                </tr>
              </thead>
              <tbody>
                {sec.kind === 'shoot' && shownMain.length > 0 && (
                  <tr><td colSpan={4} style={{ padding:'6px 6px 2px 14px', fontSize:9, color:'var(--tan)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Labor</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 2px', fontSize:10, color:'var(--tan)', fontWeight:700 }}></td><td/></tr>
                )}
                {shownMain.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} dupLine={dupLine} dragCtl={dragCtl} />)}
                {sec.kind === 'shoot' && (
                  <tr>
                    <td colSpan={6} style={{ padding:'6px 6px 6px 14px' }}>
                      <select value="" style={{ fontSize:11, width:240, color:YEL, border:'1px dashed rgba(230,194,41,0.45)', background:'transparent', borderRadius:6, padding:'4px 8px' }}
                        onChange={e => addPosition(e.target.value)}>
                        <option value="">+ Add Position…</option>
                        {isCollapsed
                          ? hiddenMain.map(l => <option key={l.id} value={'reveal:' + l.id}>{l.scope || 'Untitled position'}</option>)
                          : [...new Set(main.filter(l => l.percent == null && l.scope).map(l => l.scope))].map(s2 => <option key={s2} value={'scope:' + s2}>{s2}</option>)}
                        <option value="__custom">Custom position…</option>
                      </select>
                      {isCollapsed && hiddenMain.length > 0 && (
                        <span style={{ fontSize:10, color:'var(--muted)', marginLeft:10 }}>{hiddenMain.length} position option{hiddenMain.length !== 1 ? 's' : ''} hidden</span>
                      )}
                    </td>
                  </tr>
                )}
                {sec.kind === 'shoot' && (
                  <tr>
                    <td colSpan={4} style={{ padding:'6px 6px 6px 14px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5ABF80', borderBottom:'1px solid rgba(90,191,128,0.5)' }}>Labor Subtotal</td>
                    <td style={{ padding:'6px 10px 6px 6px', textAlign:'right', fontSize:12, fontWeight:800, color:'#5ABF80', borderBottom:'1px solid rgba(90,191,128,0.5)' }}>{fmt$(main.reduce((s2, l) => s2 + lineSubtotal(l, secLines), 0))}</td>
                    <td style={{ borderBottom:'1px solid rgba(90,191,128,0.5)' }} />
                  </tr>
                )}
                {trav.length > 0 && (
                  <tr><td colSpan={6} style={{ padding:'6px 6px 2px 14px', fontSize:9, color:'var(--tan)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Travel</td></tr>
                )}
                {trav.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} dupLine={dupLine} dragCtl={dragCtl} />)}
                {sec.kind === 'shoot' && (
                  <tr>
                    <td colSpan={6} style={{ padding:'6px 6px 6px 14px' }}>
                      <button onClick={() => addLine(sec.id, true)}
                        style={{ fontSize:11, width:240, textAlign:'left', color:'#5ABF80', border:'1px dashed rgba(90,191,128,0.45)', background:'transparent', borderRadius:6, padding:'4px 8px', cursor:'pointer' }}>
                        + Travel Line…
                      </button>
                    </td>
                  </tr>
                )}
                {trav.length > 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding:'6px 6px 6px 14px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5ABF80', borderBottom:'1px solid rgba(90,191,128,0.5)' }}>Travel Subtotal</td>
                    <td style={{ padding:'6px 10px 6px 6px', textAlign:'right', fontSize:12, fontWeight:800, color:'#5ABF80', borderBottom:'1px solid rgba(90,191,128,0.5)' }}>{fmt$(trav.reduce((s2, l) => s2 + lineSubtotal(l, secLines), 0))}</td>
                    <td style={{ borderBottom:'1px solid rgba(90,191,128,0.5)' }} />
                  </tr>
                )}
              </tbody>
            </table>
            </div>
            <div style={{ display:'flex', gap:8, padding:'6px 14px 10px', alignItems:'center' }}>
              {sec.kind !== 'shoot' && <button className="btn btn-ghost btn-sm" onClick={() => addLine(sec.id, false)}>+ Line</button>}
              {sec.kind === 'shoot' && (
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--muted)' }}
                  onClick={() => setExpandedSecs(x => ({ ...x, [sec.id]: !x[sec.id] }))}>
                  {isCollapsed ? '▸ Expand All Positions' : '▾ Collapse Positions'}
                </button>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
        <select defaultValue="" onChange={e => { addTemplateSection(e.target.value); e.target.value = ''; }}
          style={{ width:240, fontSize:12, border:'1px solid ' + YEL, color:YEL, background:'rgba(230,194,41,0.08)', borderRadius:8 }}>
          <option value="" disabled>+ New Estimate Section…</option>
          {EST_TEMPLATES.map(([k, label2]) => <option key={k} value={k} style={{ color:'var(--text)', background:'var(--bg)' }}>{label2}</option>)}
        </select>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
        <label style={{ fontSize:10, color:'var(--muted)', display:'flex', alignItems:'center', gap:6 }}>Mgmt Fee % (all estimates)
          <input type="number" step="0.5" value={feeDraft} style={{ width:70, fontSize:12, textAlign:'right' }}
            onChange={e => setFeeDraft(e.target.value)} onBlur={e => saveFeeAll(e.target.value)} />
        </label>
      </div>
      <div style={{ background:'var(--bg2)', border:'1px solid ' + YEL + '55', borderRadius:10, padding:'14px 18px', maxWidth:420, marginLeft:'auto' }}>
        {[
          ['Production & Post (non-travel)', nonTravel],
          ['Travel', travel],
          [`Management Fee (${Math.round(feeRate * 1000) / 10}% of non-travel)`, fee],
        ].map(([lbl2, val]) => (
          <div key={lbl2} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', color:'var(--muted)' }}>
            <span>{lbl2}</span><span style={{ fontWeight:600, color:'var(--text)' }}>{fmt$(val)}</span>
          </div>
        ))}
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:800, borderTop:'1px solid var(--border)', marginTop:6, paddingTop:8 }}>
          <span>ESTIMATE TOTAL</span><span style={{ color:YEL }}>{fmt$(total)}</span>
        </div>
      </div>
    </div>
  );
}
