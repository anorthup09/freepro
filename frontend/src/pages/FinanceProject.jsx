import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
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
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'6px 16px 80px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:14 }}>
          <div>
            <button onClick={() => setEditProject(true)}
              style={{ marginBottom:6, background:'none', border:'1px solid var(--border)', borderRadius:12, padding:'2px 12px', fontSize:10, fontWeight:600, color:'var(--muted)', cursor:'pointer' }}>
              ✎ Edit
            </button>
            <div style={{ fontSize:10, color:'var(--muted)' }}>{project.code}</div>
            <div className="page-title">{project.title}</div>
            <div className="page-sub">{project.client}</div>
            <div className="seg-toggle" style={{ display:'inline-flex', marginTop:8, border:'1px solid var(--border)', borderRadius:16, overflow:'hidden' }}>
              {[['budget', 'Budget'], ['vcc', 'VCC']].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  style={{ background: tab === k ? 'rgba(232,80,10,0.25)' : 'transparent', border:'none',
                    color: tab === k ? 'var(--orange)' : 'var(--muted)', fontSize:12, fontWeight:800, padding:'6px 18px', cursor:'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="fp-actions" style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
            {harbinger && (
              <button onClick={() => setShowHarbinger(true)}
                style={{ background:'rgba(90,191,128,0.12)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                View Harbinger
              </button>
            )}
            {budget && (
              <>
                <div className="fp-btnrow" style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  <button onClick={() => setEstimateMode(true)}
                    style={{ background:'rgba(230,194,41,0.15)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    + Add Estimate{estimates.length ? ` (${estimates.length})` : ''}
                  </button>
                  <button onClick={() => setOverview(true)}
                    style={{ background:'rgba(90,191,128,0.12)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    Budget Overview
                  </button>
                  <ShareBudgetButton budget={budget} />
                </div>
                <ShareModeToggle budget={budget}
                  patchBudget={fields => set(d => ({ budget: { ...d.budget, ...fields } }))}
                  saveBudget={data => api.updateBudget(budget.id, data).catch(e => alert(e.message))} />
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

function BudgetTab({ budget, sections, lines, vcc, project, set, reload }) {
  const { user } = useAuth();
  const [harbingerOpen, setHarbingerOpen] = useState(false);

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
    };
  }

  async function handleStatusChange(v) {
    if (v === 'Live' && (budget.status || 'RFP') === 'RFP') {
      try { await api.getHarbinger(project.id); } catch { setHarbingerOpen(true); return; }
    }
    patchBudget({ status: v });
    saveBudget({ status: v });
  }

  const closeMonthOptions = useMemo(closeMonthRange, []);
  const mgmtRate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;
  const t = useMemo(() => totals(sections, lines, mgmtRate), [sections, lines, mgmtRate]);
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
          ['Solutions Code', 'solutions_code', 'solutionsCode', 'text'],
        ].map(([label, key, apiKey, type]) => (
          <div key={key} style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
            <input type={type} value={budget[key] || ''} style={{ width: type === 'date' ? 140 : 130, fontSize:12 }}
              onChange={e => patchBudget({ [key]: e.target.value })}
              onBlur={e => saveBudget({ [apiKey]: e.target.value })} />
          </div>
        ))}
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
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Tagged</label>
          <TagRow budgetId={budget.id} ownerName={budget.media_rep} />
        </div>
        <div style={{ marginLeft:'auto', display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8 }}>
          <StatusPill value={budget.status || 'RFP'} onChange={handleStatusChange} small />
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
          <div key={sec.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <input value={sec.title} style={{ ...cellIn, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.04em', color:'#5ABF80' }}
                  onChange={e => patchSection(sec.id, { title: e.target.value })}
                  onBlur={e => api.updateBudgetSection(sec.id, { title: e.target.value }).catch(() => {})} />
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
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
                  {sec.kind === 'shoot' && sec.fp_start_date && (
                    <span title="Dates feed from the FreePro project"
                      style={{ fontSize:10, color:'var(--muted)', whiteSpace:'nowrap', flexShrink:0 }}>
                      🎬 {new Date(String(sec.fp_start_date).slice(0,10)+'T12:00:00').toLocaleDateString()} – {new Date(String(sec.fp_end_date || sec.fp_start_date).slice(0,10)+'T12:00:00').toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>{fmt$(mainTotal + travelTotal)}</div>
              {sec.kind === 'shoot' && sec.freepro_project_id && (
                <a href={`/projects/${sec.freepro_project_id}`}
                  style={{ fontSize:10, fontWeight:700, color:'var(--orange)', border:'1px solid rgba(232,80,10,0.45)', borderRadius:12, padding:'3px 10px', textDecoration:'none', whiteSpace:'nowrap', alignSelf:'center' }}>
                  Go to FreePro ›
                </a>
              )}
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
                    <td colSpan={4} style={{ padding:'6px 6px 6px 14px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5ABF80', borderTop:'1px solid rgba(90,191,128,0.5)' }}>Labor Subtotal</td>
                    <td style={{ padding:'6px 10px 6px 6px', textAlign:'right', fontSize:12, fontWeight:800, color:'#5ABF80', borderTop:'1px solid rgba(90,191,128,0.5)' }}>{fmt$(mainTotal)}</td>
                    <td style={{ borderTop:'1px solid rgba(90,191,128,0.5)' }} />
                  </tr>
                )}
                {travel.length > 0 && (
                  <tr><td colSpan={4} style={{ padding:'6px 6px 2px 14px', fontSize:9, color:'var(--tan)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Travel</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 2px', fontSize:10, color:'var(--tan)', fontWeight:700 }}></td><td/></tr>
                )}
                {travel.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} dupLine={dupLine} dragCtl={dragCtl} />)}
                {travel.length > 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding:'6px 6px 6px 14px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5ABF80', borderTop:'1px solid rgba(90,191,128,0.5)' }}>Travel Subtotal</td>
                    <td style={{ padding:'6px 10px 6px 6px', textAlign:'right', fontSize:12, fontWeight:800, color:'#5ABF80', borderTop:'1px solid rgba(90,191,128,0.5)' }}>{fmt$(travelTotal)}</td>
                    <td style={{ borderTop:'1px solid rgba(90,191,128,0.5)' }} />
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
              {sec.kind === 'shoot' && <button className="btn btn-ghost btn-sm" onClick={() => addLine(sec.id, true)}>+ Travel Line</button>}
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
        <button className="btn btn-ghost btn-sm" onClick={() => addSection(true)}>+ Add Shoot Block</button>
        <button className="btn btn-ghost btn-sm" onClick={() => addSection(false)}>+ Add Section</button>
        <div style={{ marginLeft:8, display:'flex', alignItems:'center', gap:6 }}>
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Mgmt Fee %</label>
          <input type="number" step="0.5" value={Math.round(mgmtRate * 1000) / 10} style={{ width:80, fontSize:12, textAlign:'right' }}
            onChange={e => patchBudget({ mgmt_fee_rate: Number(e.target.value) / 100 })}
            onBlur={e => saveBudget({ mgmtFeeRate: Number(e.target.value) / 100 })} />
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
        <HarbingerModal pid={project.id} initial={harbingerPrefill()}
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
  const mgmtRate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;
  const t = useMemo(() => totals(sections, lines, mgmtRate), [sections, lines, mgmtRate]);
  const [form, setForm] = useState({ entryDate:'', vendor:'', description:'', category:'', trip:'', amount:'', status:'HOLD' });

  const deposits = num(budget.deposit) + num(budget.additional_deposit);
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
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80', marginBottom:10 }}>Client Deposits</div>
          {(() => {
            const today = () => new Date().toISOString().slice(0, 10);
            const fmtD = d => d ? new Date(d.slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' }) : '';
            const send = (dateKey, apiKey) => {
              const d = today();
              patchBudget({ [dateKey]: d });
              saveBudget({ [apiKey]: d });
              alert('Coming soon: review the invoice email, attach the invoice, and send it to the client right from here.\n\nInvoice date recorded as today.');
            };
            const row = (label, amountEl, dateVal, onSend) => (
              <React.Fragment key={label}>
                <span style={{ color:'var(--muted)' }}>{label}</span>
                <span style={{ display:'flex', justifyContent:'flex-end' }}>{amountEl}</span>
                <span style={{ fontSize:10, color: dateVal ? 'var(--text)' : 'var(--muted)', textAlign:'center' }}>{dateVal ? fmtD(dateVal) : '—'}</span>
                <span>
                  {onSend && (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ whiteSpace:'nowrap' }} onClick={onSend}>✉ Send Invoice</button>
                  )}
                </span>
              </React.Fragment>
            );
            return (
              <div style={{ display:'grid', gridTemplateColumns:'auto 110px 64px auto', gap:'7px 10px', fontSize:11, alignItems:'center' }}>
                {row('Deposit',
                  <MoneyInput value={budget.deposit ?? ''} width={110} onCommit={v => { patchBudget({ deposit: v }); saveBudget({ deposit: v }); }} />,
                  budget.deposit_due, () => send('deposit_due', 'depositDue'))}
                {row('Additional',
                  <MoneyInput value={budget.additional_deposit ?? ''} width={110} onCommit={v => { patchBudget({ additional_deposit: v }); saveBudget({ additionalDeposit: v }); }} />,
                  budget.paid_date, () => send('paid_date', 'paidDate'))}
                {row('Final Invoice',
                  <span style={{ fontWeight:700, padding:'4px 6px' }}>{fmt$(finalInvoice)}</span>,
                  budget.final_inv_date, () => send('final_inv_date', 'finalInvDate'))}
                {row('Total Budget',
                  <span style={{ fontWeight:800, color:'#5ABF80', padding:'4px 6px' }}>{fmt$(t.total)}</span>,
                  null, null)}
              </div>
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
          <option value="HOLD">Hold</option><option value="POSTED">Posted</option>
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
                        <button onClick={() => { const s = e.status === 'HOLD' ? 'POSTED' : 'HOLD'; patchEntry(e.id, { status: s }); saveEntry(e.id, { status: s }); }}
                          style={{ background:'none', border:`1px solid ${e.status === 'POSTED' ? '#5ABF80' : '#e6c229'}55`, color: e.status === 'POSTED' ? '#5ABF80' : '#e6c229', borderRadius:10, padding:'1px 8px', fontSize:9, fontWeight:700, cursor:'pointer' }}>
                          {e.status === 'POSTED' ? 'Posted' : 'Hold'}
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

// ── Vendor invoices: per-project uploaded invoice files ──
function VendorInvoicesButton({ pid }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState(null);
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) api.vendorInvoices(pid).then(setFiles).catch(e => alert(e.message));
  }, [open, pid]);

  function pick(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return alert('File too large (20MB max)');
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
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #e6c229', borderRadius:12, width:'100%', maxWidth:620, maxHeight:'85vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:14, fontWeight:800 }}>🧾 Vendor Invoices</div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : '+ Upload Invoice'}</button>
                <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv,.doc,.docx" style={{ display:'none' }} onChange={pick} />
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
              </div>
            </div>
            <div style={{ overflowY:'auto', padding:'8px 18px 16px' }}>
              {!files && <div style={{ fontSize:11, color:'var(--muted)', padding:'12px 0' }}>Loading…</div>}
              {files && files.length === 0 && <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', padding:'14px 0' }}>No invoices uploaded yet — drop vendor invoice files here so they live with the project.</div>}
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


function ShareBudgetButton({ budget }) {
  async function share() {
    try {
      const { token } = await api.shareBudget(budget.id);
      window.open(`${window.location.origin}/budget/${token}`, '_blank');
    } catch (e) { alert(e.message); }
  }
  return (
    <button type="button" onClick={share} title="Open the client-facing budget page in a new window"
      style={{ background:'rgba(74,158,255,0.12)', border:'1px solid #4a9eff', color:'#4a9eff', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
      Client Budget
    </button>
  );
}

function ShareModeToggle({ budget, patchBudget, saveBudget }) {
  const mode = budget.share_mode || 'lines';
  function setMode(m) {
    patchBudget({ share_mode: m });
    saveBudget({ shareMode: m });
  }
  return (
    <div className="seg-toggle" title="What the client sees on the shared budget page"
      style={{ display:'flex', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
      {[['lines', 'Line Items'], ['buckets', 'Buckets']].map(([m, label]) => (
        <button key={m} type="button" onClick={() => setMode(m)}
          style={{ background: mode === m ? 'rgba(90,191,128,0.25)' : 'transparent', border:'none',
            color: mode === m ? '#5ABF80' : 'var(--muted)', fontSize:10, fontWeight:700, padding:'4px 10px', cursor:'pointer' }}>
          {label}
        </button>
      ))}
    </div>
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
            <button disabled={busy} onClick={merge}
              style={{ background:'rgba(90,191,128,0.15)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
              ✓ Move into Approved Budget
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
                    <td colSpan={4} style={{ padding:'6px 6px 6px 14px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5ABF80', borderTop:'1px solid rgba(90,191,128,0.5)' }}>Labor Subtotal</td>
                    <td style={{ padding:'6px 10px 6px 6px', textAlign:'right', fontSize:12, fontWeight:800, color:'#5ABF80', borderTop:'1px solid rgba(90,191,128,0.5)' }}>{fmt$(main.reduce((s2, l) => s2 + lineSubtotal(l, secLines), 0))}</td>
                    <td style={{ borderTop:'1px solid rgba(90,191,128,0.5)' }} />
                  </tr>
                )}
                {trav.length > 0 && (
                  <tr><td colSpan={6} style={{ padding:'6px 6px 2px 14px', fontSize:9, color:'var(--tan)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Travel</td></tr>
                )}
                {trav.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} dupLine={dupLine} dragCtl={dragCtl} />)}
                {trav.length > 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding:'6px 6px 6px 14px', fontSize:10, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.06em', color:'#5ABF80', borderTop:'1px solid rgba(90,191,128,0.5)' }}>Travel Subtotal</td>
                    <td style={{ padding:'6px 10px 6px 6px', textAlign:'right', fontSize:12, fontWeight:800, color:'#5ABF80', borderTop:'1px solid rgba(90,191,128,0.5)' }}>{fmt$(trav.reduce((s2, l) => s2 + lineSubtotal(l, secLines), 0))}</td>
                    <td style={{ borderTop:'1px solid rgba(90,191,128,0.5)' }} />
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
              {sec.kind === 'shoot' && <button className="btn btn-ghost btn-sm" onClick={() => addLine(sec.id, true)}>+ Travel Line</button>}
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
