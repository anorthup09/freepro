import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';
import { FinanceHeader } from './Finance.jsx';

const fmt$ = (n, dec = 2) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: dec === 2 ? 2 : 0, maximumFractionDigits: dec });
const num = v => Number(v) || 0;

function lineSubtotal(l, sectionLines) {
  if (l.percent != null) {
    const base = sectionLines.filter(x => x.percent == null && !x.is_travel).reduce((s, x) => s + num(x.qty) * num(x.unit_cost), 0);
    return num(l.percent) * base * num(l.qty);
  }
  return num(l.qty) * num(l.unit_cost);
}

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

export default function FinanceProject() {
  const { pid } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('budget');
  const [estimateMode, setEstimateMode] = useState(false);

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
      <FinanceHeader crumb={project.code} />
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'6px 16px 80px' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:10, color:'var(--muted)' }}>{project.code}</div>
            <div className="page-title">{project.title}</div>
            <div className="page-sub">{project.client}</div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button className={`btn btn-sm ${tab === 'budget' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('budget')}>Budget</button>
              <button className={`btn btn-sm ${tab === 'vcc' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('vcc')}>VCC</button>
            </div>
            {budget && (
              <button onClick={() => setEstimateMode(true)}
                style={{ background:'rgba(230,194,41,0.15)', border:'1px solid #e6c229', color:'#e6c229', borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                ⚡ Additional Estimate{estimates.length ? ` (${estimates.length})` : ''}
              </button>
            )}
          </div>
        </div>

        {!budget ? (
          <div className="empty" style={{ padding:'40px 20px', textAlign:'center' }}>
            <div style={{ marginBottom:14 }}>No budget yet for this project.</div>
            <button className="btn btn-primary" onClick={createBudget}>Create Budget from 2026 Template</button>
          </div>
        ) : tab === 'budget' ? (
          <BudgetTab budget={budget} sections={sections} lines={lines} vcc={vcc} set={set} reload={() => api.financeBundle(pid).then(setData)} />
        ) : (
          <VccTab pid={pid} budget={budget} sections={sections} lines={lines} vcc={vcc} categories={categories} set={set} />
        )}
      </div>
      {estimateMode && (
        <EstimateMode pid={pid} estimates={estimates} onExit={() => setEstimateMode(false)}
          reload={() => api.financeBundle(pid).then(setData)} />
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

function BudgetTab({ budget, sections, lines, vcc, set, reload }) {
  const closeMonthOptions = useMemo(closeMonthRange, []);
  const mgmtRate = budget.mgmt_fee_rate != null ? Number(budget.mgmt_fee_rate) : 0.15;
  const t = useMemo(() => totals(sections, lines, mgmtRate), [sections, lines, mgmtRate]);

  const patchLine = (id, fields) => set(d => ({ lines: d.lines.map(l => l.id === id ? { ...l, ...fields } : l) }));
  const saveLine = (id, data) => api.updateBudgetLine(id, data).catch(e => alert(e.message));
  const patchBudget = (fields) => set(d => ({ budget: { ...d.budget, ...fields } }));
  const saveBudget = (data) => api.updateBudget(budget.id, data).catch(e => alert(e.message));

  async function addLine(sid, isTravel) {
    const l = await api.addBudgetLine(sid, { isTravel });
    set(d => ({ lines: [...d.lines, l] }));
  }
  async function delLine(id) {
    await api.deleteBudgetLine(id);
    set(d => ({ lines: d.lines.filter(l => l.id !== id) }));
  }
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
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Mgmt Fee %</label>
          <input type="number" step="0.5" value={Math.round(mgmtRate * 1000) / 10} style={{ width:80, fontSize:12, textAlign:'right' }}
            onChange={e => patchBudget({ mgmt_fee_rate: Number(e.target.value) / 100 })}
            onBlur={e => saveBudget({ mgmtFeeRate: Number(e.target.value) / 100 })} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Status</label>
          <StatusPill value={budget.status || 'RFP'} onChange={v => { patchBudget({ status: v }); saveBudget({ status: v }); }} />
        </div>
        <ShareBudgetButton budget={budget} />
      </div>

      {(() => { const lastShootId = [...sections].filter(x => x.kind === 'shoot').map(x => x.id).pop(); return sections.map(sec => {
        const secLines = lines.filter(l => l.section_id === sec.id).sort((a, b) => a.sort - b.sort);
        const main = secLines.filter(l => !l.is_travel);
        const travel = secLines.filter(l => l.is_travel);
        const mainTotal = main.reduce((s, l) => s + lineSubtotal(l, secLines), 0);
        const travelTotal = travel.reduce((s, l) => s + lineSubtotal(l, secLines), 0);
        return (
          <div key={sec.id} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <input value={sec.title} style={{ ...cellIn, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.04em', color:'#5ABF80' }}
                  onChange={e => patchSection(sec.id, { title: e.target.value })}
                  onBlur={e => api.updateBudgetSection(sec.id, { title: e.target.value }).catch(() => {})} />
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
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
                  <input value={sec.subtitle || ''} placeholder="Description · City, State · Dates" style={{ ...cellIn, fontSize:11, color:'var(--muted)' }}
                    onChange={e => patchSection(sec.id, { subtitle: e.target.value })}
                    onBlur={e => api.updateBudgetSection(sec.id, { subtitle: e.target.value }).catch(() => {})} />
                </div>
              </div>
              <div style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>{fmt$(mainTotal + travelTotal)}</div>
              <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => delSection(sec.id)}>✕</button>
            </div>
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
                {main.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} />)}
                {travel.length > 0 && (
                  <tr><td colSpan={4} style={{ padding:'6px 6px 2px 14px', fontSize:9, color:'var(--tan)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Travel</td>
                    <td style={{ textAlign:'right', padding:'6px 6px 2px', fontSize:10, color:'var(--tan)', fontWeight:700 }}>{fmt$(travelTotal)}</td><td/></tr>
                )}
                {travel.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} />)}
              </tbody>
            </table>
            <div style={{ display:'flex', gap:8, padding:'6px 14px 10px', alignItems:'center' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => addLine(sec.id, false)}>+ Line</button>
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

      <div style={{ display:'flex', gap:10, marginBottom:18 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => addSection(true)}>+ Add Shoot Block</button>
        <button className="btn btn-ghost btn-sm" onClick={() => addSection(false)}>+ Add Section</button>
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
    </div>
  );
}

function LineRow({ l, secLines, patchLine, saveLine, delLine }) {
  const st = lineSubtotal(l, secLines);
  return (
    <tr style={{ borderTop:'1px solid rgba(255,255,255,0.03)' }}>
      <td style={{ padding:'2px 6px 2px 14px' }}>
        <input value={l.scope || ''} style={cellIn}
          onChange={e => patchLine(l.id, { scope: e.target.value })}
          onBlur={e => saveLine(l.id, { scope: e.target.value })} />
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
          <input type="number" step="0.5" value={l.qty ?? 0} style={numIn}
            onChange={e => patchLine(l.id, { qty: e.target.value })}
            onBlur={e => saveLine(l.id, { qty: e.target.value })} />
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

function VccTab({ pid, budget, sections, lines, vcc, categories, set }) {
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

  const byTrip = {};
  for (const e of vcc) (byTrip[e.trip || '—'] ||= []).push(e);
  const shootOpts = sections.filter(x => x.kind === 'shoot').map(x => {
    const nn = (x.shoot_code || '').split('-').pop() || '';
    return { value: x.trip || x.shoot_code, label: `${nn} - ${x.trip || 'Shoot ' + nn}` };
  });
  const extraTrips = [...new Set(vcc.map(e => e.trip).filter(t => t && !shootOpts.some(o => o.value === t)))];
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
      {/* profit summary + deposits */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:14, marginBottom:16 }}>
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
      </div>

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
                  <td colSpan={5} style={{ padding:'5px 14px', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80' }}>{trip}</td>
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
                      <select value={e.trip || ''} style={{ ...cellIn, fontSize:10, color:'var(--muted)' }}
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
      <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={sync}>{busy === 'sync' ? 'Syncing…' : '⟳ Sync FreePro Costs'}</button>
      <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>{busy === 'odc' ? 'Importing…' : '⬆ Import ODC Report'}</button>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={onFile} />
      {reviewCount > 0 && (
        <span style={{ fontSize:11, color:'#e05252', fontWeight:700 }}>⚠ {reviewCount} charge{reviewCount === 1 ? '' : 's'} need review</span>
      )}
      {msg && <span style={{ fontSize:11, color:'var(--muted)' }}>{msg}</span>}
    </div>
  );
}


function ShareBudgetButton({ budget }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      const { token } = await api.shareBudget(budget.id);
      const link = `${window.location.origin}/budget/${token}`;
      await navigator.clipboard?.writeText(link).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      if (!navigator.clipboard) prompt('Client budget link:', link);
    } catch (e) { alert(e.message); }
  }
  return (
    <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={share}>
        {copied ? '✓ Link copied' : '🔗 Client Budget Link'}
      </button>
    </div>
  );
}


const STATUS_OPTS = [
  ['RFP', '#e6c229', 'Waiting on client approval — shows in the RFP folder'],
  ['Live', '#5ABF80', 'Approved — moves to Live Projects'],
  ['Dead', '#e05252', 'Not approved — archived under RFP'],
  ['Reconciled', '#9DC183', 'Project closed out'],
];

function StatusPill({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const cur = STATUS_OPTS.find(o => o[0] === value) || STATUS_OPTS[0];
  return (
    <div style={{ position:'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ display:'inline-flex', alignItems:'center', gap:6, background:`${cur[1]}1c`, border:`1px solid ${cur[1]}`, color:cur[1], borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:800, letterSpacing:'0.05em', textTransform:'uppercase', cursor:'pointer' }}>
        {cur[0]} <span style={{ fontSize:8 }}>▼</span>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'110%', left:0, zIndex:50, background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:6, boxShadow:'0 8px 24px rgba(0,0,0,0.5)', minWidth:250 }}>
          {STATUS_OPTS.map(([name, color, hint]) => (
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
  const [feeDraft, setFeeDraft] = useState(Math.round(feeRate * 1000) / 10);

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
      <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 22px', borderBottom:'1px solid rgba(230,194,41,0.35)', flexWrap:'wrap' }}>
        <span style={{ color:YEL, fontWeight:800, fontSize:13, letterSpacing:'0.1em' }}>⚡ ESTIMATE MODE</span>
        <span style={{ fontSize:11, color:'var(--muted)' }}>Pricing only — nothing here feeds the approved budget until you move it over.</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <label style={{ fontSize:10, color:'var(--muted)', display:'flex', alignItems:'center', gap:6 }}>Mgmt Fee % (all estimates)
            <input type="number" step="0.5" value={feeDraft} style={{ width:70, fontSize:12, textAlign:'right' }}
              onChange={e => setFeeDraft(e.target.value)} onBlur={e => saveFeeAll(e.target.value)} />
          </label>
          {estimates.length > 1 && (
            <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:YEL, fontWeight:700 }}>
              <button className="btn btn-ghost btn-sm" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}>‹</button>
              {idx + 1} / {estimates.length}
              <button className="btn btn-ghost btn-sm" disabled={idx >= estimates.length - 1} onClick={() => setIdx(i => i + 1)}>›</button>
            </span>
          )}
          <button disabled={busy} onClick={addEstimate}
            style={{ background:'rgba(230,194,41,0.15)', border:'1px solid ' + YEL, color:YEL, borderRadius:20, padding:'4px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            + New Estimate
          </button>
          <button className="btn btn-ghost btn-sm" onClick={exit}>✕ Exit Estimate Mode</button>
        </div>
      </div>

      <div style={{ flex:1, overflow:'hidden' }}>
        <div style={{ display:'flex', height:'100%', width:'100%', transform:`translateX(-${idx * 100}%)`, transition:'transform .32s ease' }}>
          {estimates.map(est => (
            <div key={est.id} style={{ minWidth:'100%', height:'100%', overflowY:'auto', padding:'18px 26px 60px' }}>
              <EstimatePane est={est} feeRate={feeRate} reload={reload} onMerged={exit} />
            </div>
          ))}
          {!estimates.length && <div style={{ minWidth:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>Creating your first estimate…</div>}
        </div>
      </div>
    </div>
  );
}

function EstimatePane({ est, feeRate, reload, onMerged }) {
  const [sections, setSections] = useState(est.sections);
  const [lines, setLines] = useState(est.lines);
  const [label, setLabel] = useState(est.label || 'Estimate');
  const [busy, setBusy] = useState(false);

  const patchLine = (id, fields) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...fields } : l));
  const saveLine = (id, data) => api.updateBudgetLine(id, data).catch(e => alert(e.message));
  async function delLine(id) { await api.deleteBudgetLine(id); setLines(ls => ls.filter(l => l.id !== id)); }
  async function addLine(sid, isTravel) {
    const l = await api.addBudgetLine(sid, { isTravel });
    setLines(ls => [...ls, l]);
  }
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
        <span style={{ fontSize:12, color:'var(--muted)' }}>Total <b style={{ color:YEL }}>{fmt$(total)}</b></span>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button disabled={busy} onClick={merge}
            style={{ background:'rgba(90,191,128,0.15)', border:'1px solid #5ABF80', color:'#5ABF80', borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
            ✓ Move into Approved Budget
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text, #e08080)' }} disabled={busy} onClick={remove}>Delete Estimate</button>
        </div>
      </div>

      {sections.sort((a, b) => a.sort - b.sort).map(sec => {
        const secLines = lines.filter(l => l.section_id === sec.id).sort((a, b) => a.sort - b.sort);
        const main = secLines.filter(l => !l.is_travel);
        const trav = secLines.filter(l => l.is_travel);
        const secTotal = secLines.reduce((s2, l) => s2 + lineSubtotal(l, secLines), 0);
        return (
          <div key={sec.id} style={{ background:'var(--bg2)', border:'1px solid rgba(230,194,41,0.25)', borderRadius:10, marginBottom:14, overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <input value={sec.title} style={{ ...cellIn, fontWeight:700, fontSize:13, textTransform:'uppercase', letterSpacing:'0.04em', color:YEL }}
                  onChange={e => patchSection(sec.id, { title: e.target.value })}
                  onBlur={e => api.updateBudgetSection(sec.id, { title: e.target.value }).catch(() => {})} />
                <input value={sec.subtitle || ''} placeholder="Description · City, State · Dates" style={{ ...cellIn, fontSize:11, color:'var(--muted)' }}
                  onChange={e => patchSection(sec.id, { subtitle: e.target.value })}
                  onBlur={e => api.updateBudgetSection(sec.id, { subtitle: e.target.value }).catch(() => {})} />
              </div>
              <div style={{ fontSize:13, fontWeight:700, whiteSpace:'nowrap' }}>{fmt$(secTotal)}</div>
              <button className="btn btn-ghost btn-sm" style={{ color:'var(--red-text)' }} onClick={() => delSection(sec.id)}>✕</button>
            </div>
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
                {main.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} />)}
                {trav.length > 0 && (
                  <tr><td colSpan={6} style={{ padding:'6px 6px 2px 14px', fontSize:9, color:'var(--tan)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em' }}>Travel</td></tr>
                )}
                {trav.map(l => <LineRow key={l.id} l={l} secLines={secLines} patchLine={patchLine} saveLine={saveLine} delLine={delLine} />)}
              </tbody>
            </table>
            <div style={{ display:'flex', gap:8, padding:'6px 14px 10px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => addLine(sec.id, false)}>+ Line</button>
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
