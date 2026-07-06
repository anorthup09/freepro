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

const cellIn = { background:'transparent', border:'1px solid transparent', borderRadius:4, padding:'3px 6px', fontSize:12, width:'100%', color:'var(--text)' };
const numIn = { ...cellIn, width:70, textAlign:'right' };

export default function FinanceProject() {
  const { pid } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('budget');

  useEffect(() => { api.financeBundle(pid).then(setData).catch(e => alert(e.message)); }, [pid]);

  if (!data) return <div style={{ minHeight:'100vh', background:'var(--bg)' }}><FinanceHeader /><div className="empty">Loading…</div></div>;
  const { project, budget, sections, lines, vcc, categories } = data;

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
          <div style={{ display:'flex', gap:8 }}>
            <button className={`btn btn-sm ${tab === 'budget' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('budget')}>Budget</button>
            <button className={`btn btn-sm ${tab === 'vcc' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('vcc')}>VCC</button>
          </div>
        </div>

        {!budget ? (
          <div className="empty" style={{ padding:'40px 20px', textAlign:'center' }}>
            <div style={{ marginBottom:14 }}>No budget yet for this project.</div>
            <button className="btn btn-primary" onClick={createBudget}>Create Budget from 2026 Template</button>
          </div>
        ) : tab === 'budget' ? (
          <BudgetTab budget={budget} sections={sections} lines={lines} set={set} />
        ) : (
          <VccTab pid={pid} budget={budget} sections={sections} lines={lines} vcc={vcc} categories={categories} set={set} />
        )}
      </div>
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

function BudgetTab({ budget, sections, lines, set }) {
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
  async function addSection(seedShoot) {
    const title = seedShoot ? 'PRODUCTION COSTS — New Shoot' : 'NEW SECTION';
    const r = await api.addBudgetSection(budget.id, { title, kind: seedShoot ? 'shoot' : 'general', seedShoot });
    set(d => ({ sections: [...d.sections, r.section], lines: [...d.lines, ...(r.lines || [])] }));
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
          ['Media Rep', 'media_rep', 'mediaRep', 'text'],
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
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Status</label>
          <select value={budget.status || 'Draft'} style={{ width:130, fontSize:12 }}
            onChange={e => { patchBudget({ status: e.target.value }); saveBudget({ status: e.target.value }); }}>
            {['Draft','Sent','Approved','Live','Reconciled'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <label style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Mgmt Fee %</label>
          <input type="number" step="0.5" value={Math.round(mgmtRate * 1000) / 10} style={{ width:80, fontSize:12, textAlign:'right' }}
            onChange={e => patchBudget({ mgmt_fee_rate: Number(e.target.value) / 100 })}
            onBlur={e => saveBudget({ mgmtFeeRate: Number(e.target.value) / 100 })} />
        </div>
      </div>

      {sections.map(sec => {
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
                <input value={sec.subtitle || ''} placeholder="Description · City, State · Dates" style={{ ...cellIn, fontSize:11, color:'var(--muted)' }}
                  onChange={e => patchSection(sec.id, { subtitle: e.target.value })}
                  onBlur={e => api.updateBudgetSection(sec.id, { subtitle: e.target.value }).catch(() => {})} />
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
            <div style={{ display:'flex', gap:8, padding:'6px 14px 10px' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => addLine(sec.id, false)}>+ Line</button>
              {sec.kind === 'shoot' && <button className="btn btn-ghost btn-sm" onClick={() => addLine(sec.id, true)}>+ Travel Line</button>}
            </div>
          </div>
        );
      })}

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
        <input type="number" step="0.5" value={l.qty ?? 0} style={numIn}
          onChange={e => patchLine(l.id, { qty: e.target.value })}
          onBlur={e => saveLine(l.id, { qty: e.target.value })} />
      </td>
      <td style={{ padding:'2px 6px', textAlign:'right' }}>
        {l.percent != null
          ? <span style={{ fontSize:11, color:'var(--muted)' }}>{Math.round(l.percent * 100)}% of section</span>
          : <input type="number" step="0.01" value={l.unit_cost ?? 0} style={{ ...numIn, width:85 }}
              onChange={e => patchLine(l.id, { unit_cost: e.target.value })}
              onBlur={e => saveLine(l.id, { unitCost: e.target.value })} />}
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
              <input type="number" value={budget.total_cap_co ?? 0} style={{ width:90, fontSize:11, textAlign:'right' }}
                onChange={e => patchBudget({ total_cap_co: e.target.value })}
                onBlur={e => saveBudget({ totalCapCo: e.target.value })} /></label>
            <label style={{ fontSize:10, color:'var(--muted)', display:'flex', alignItems:'center', gap:6 }}>Original Fee Est.
              <input type="number" value={budget.original_fee_estimate ?? ''} style={{ width:90, fontSize:11, textAlign:'right' }}
                onChange={e => patchBudget({ original_fee_estimate: e.target.value })}
                onBlur={e => saveBudget({ originalFeeEstimate: e.target.value })} /></label>
            <span style={{ fontSize:10, color:'var(--muted)', alignSelf:'center' }}>Media Revenue {fmt$(revenue)}</span>
          </div>
        </div>
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px' }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80', marginBottom:10 }}>Client Deposits</div>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr', gap:'6px 10px', fontSize:11, alignItems:'center' }}>
            <span style={{ color:'var(--muted)' }}>Deposit</span>
            <input type="number" value={budget.deposit ?? ''} style={{ fontSize:11, textAlign:'right' }}
              onChange={e => patchBudget({ deposit: e.target.value })} onBlur={e => saveBudget({ deposit: e.target.value })} />
            <input type="date" value={budget.deposit_due || ''} style={{ fontSize:11 }}
              onChange={e => patchBudget({ deposit_due: e.target.value })} onBlur={e => saveBudget({ depositDue: e.target.value })} />
            <span style={{ color:'var(--muted)' }}>Additional</span>
            <input type="number" value={budget.additional_deposit ?? ''} style={{ fontSize:11, textAlign:'right' }}
              onChange={e => patchBudget({ additional_deposit: e.target.value })} onBlur={e => saveBudget({ additionalDeposit: e.target.value })} />
            <input type="date" value={budget.final_inv_date || ''} title="Final invoice date" style={{ fontSize:11 }}
              onChange={e => patchBudget({ final_inv_date: e.target.value })} onBlur={e => saveBudget({ finalInvDate: e.target.value })} />
            <span style={{ color:'var(--muted)' }}>Final Invoice</span>
            <span style={{ textAlign:'right', fontWeight:700 }}>{fmt$(finalInvoice)}</span>
            <span />
            <span style={{ color:'var(--muted)' }}>Total Budget</span>
            <span style={{ textAlign:'right', fontWeight:800, color:'#5ABF80' }}>{fmt$(t.total)}</span>
            <span />
          </div>
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
        <input placeholder="Trip" value={form.trip} style={{ width:90, fontSize:11 }} onChange={e => setForm(f => ({ ...f, trip: e.target.value }))} />
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
              <th style={{ padding:6, textAlign:'right', width:90 }}>Amount</th>
              <th style={{ padding:6, width:70 }}>Status</th>
              <th style={{ width:34 }}></th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(byTrip).map(([trip, entries]) => (
              <React.Fragment key={trip}>
                <tr style={{ background:'rgba(90,191,128,0.06)' }}>
                  <td colSpan={4} style={{ padding:'5px 14px', fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'#5ABF80' }}>{trip}</td>
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
                    <td style={{ padding:'2px 6px', textAlign:'right' }}>
                      <input type="number" step="0.01" value={e.amount ?? 0} style={{ ...numIn, width:85 }}
                        onChange={ev => patchEntry(e.id, { amount: ev.target.value })}
                        onBlur={ev => saveEntry(e.id, { amount: ev.target.value })} />
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
            {vcc.length === 0 && <tr><td colSpan={7} style={{ padding:'14px', color:'var(--muted)', fontStyle:'italic' }}>No direct costs yet.</td></tr>}
            <tr style={{ borderTop:'1px solid var(--border)' }}>
              <td colSpan={4} style={{ padding:'8px 14px', fontWeight:700, textAlign:'right', fontSize:10, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--muted)' }}>Total Direct Costs</td>
              <td style={{ textAlign:'right', padding:'8px 6px', fontWeight:800, fontSize:13, color:'#e6c229' }}>{fmt$(billable)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

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
