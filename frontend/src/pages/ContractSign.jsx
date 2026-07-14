import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';

const fmt$ = n => '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

function fmtDate(d) {
  if (!d) return '—';
  return new Date(String(d).slice(0,10) + 'T12:00:00').toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
}

export default function ContractSign() {
  const { token } = useParams();
  const [contract, setContract] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    api.getContract(token).then(setContract).catch(e => setError(e.message || 'Contract not found'));
  }, [token]);

  async function sign(e) {
    e.preventDefault();
    if (!agree) { alert('Please check the agreement box.'); return; }
    setSigning(true);
    try {
      const signed = await api.signContract(token, name);
      setContract(signed);
    } catch (err) { alert(err.message); }
    setSigning(false);
  }

  if (error) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>{error}</div>;
  if (!contract) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)' }}>Loading…</div>;

  const laborTotal = (Number(contract.day_rate)||0) * (Number(contract.labor_days)||0);
  const gearTotal = (Number(contract.gear_rate)||0) * (Number(contract.gear_days)||0);
  // Post-production contracts carry a flat quoted total instead of day rates
  const grandTotal = Number(contract.quoted_total) || (laborTotal + gearTotal);
  const signed = !!contract.signed_at;

  const row = { display:'flex', justifyContent:'space-between', gap:12, padding:'7px 0', borderBottom:'1px solid var(--border)', fontSize:13 };
  const lbl = { color:'var(--muted)', fontSize:11, textTransform:'uppercase', letterSpacing:'0.05em', flexShrink:0 };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'32px 16px' }}>
      <div style={{ maxWidth:640, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:20 }}>
          <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:26, filter:'brightness(0) invert(1)', opacity:0.9 }} />
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:6, textTransform:'uppercase', letterSpacing:'0.1em' }}>Independent Contractor Agreement</div>
        </div>

        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'20px 22px', marginBottom:14 }}>
          <div style={{ fontSize:17, fontWeight:700, marginBottom:2 }}>{contract.project_title}</div>
          <div style={{ fontSize:11, color:'var(--muted)', marginBottom:14 }}>{contract.project_code}</div>

          <div style={row}><span style={lbl}>Contractor</span><span style={{ fontWeight:600 }}>{contract.contractor_name}</span></div>
          <div style={row}><span style={lbl}>Position</span><span>{contract.position_name}</span></div>
          <div style={row}><span style={lbl}>Dates</span><span>{fmtDate(contract.start_date)} – {fmtDate(contract.end_date)}</span></div>
          {Number(contract.day_rate) > 0 && (
            <div style={row}>
              <span style={lbl}>Labor</span>
              <span>{fmt$(contract.day_rate)}/day × {Number(contract.labor_days)||0} day{Number(contract.labor_days) === 1 ? '' : 's'} = <b style={{ color:'var(--green)' }}>{fmt$(laborTotal)}</b></span>
            </div>
          )}
          {(Number(contract.gear_rate) > 0 || Number(contract.gear_days) > 0) && (
            <div style={row}>
              <span style={lbl}>Gear</span>
              <span>{fmt$(contract.gear_rate)}/day × {Number(contract.gear_days)||0} day{Number(contract.gear_days) === 1 ? '' : 's'} = <b style={{ color:'var(--green)' }}>{fmt$(gearTotal)}</b></span>
            </div>
          )}
          <div style={{ ...row, borderBottom:'none' }}>
            <span style={lbl}>Total</span>
            <span style={{ fontWeight:700, fontSize:16, color:'var(--green)' }}>{fmt$(grandTotal)}</span>
          </div>
        </div>

        {contract.scope && (
          <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'16px 22px', marginBottom:14 }}>
            <div style={{ ...lbl, marginBottom:8 }}>Scope of Work</div>
            <div style={{ fontSize:13, whiteSpace:'pre-wrap', lineHeight:1.5 }}>{contract.scope}</div>
          </div>
        )}

        {signed ? (
          <div style={{ background:'rgba(90,191,128,0.08)', border:'1px solid rgba(90,191,128,0.4)', borderRadius:10, padding:'18px 22px', textAlign:'center' }}>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--green)', marginBottom:4 }}>✓ Agreed &amp; Signed</div>
            <div style={{ fontSize:13 }}>{contract.signed_name}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
              {new Date(contract.signed_at).toLocaleString('en-US', { month:'long', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' })}
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop:12 }} onClick={() => window.print()}>Print / Save PDF</button>
          </div>
        ) : (
          <form onSubmit={sign} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10, padding:'18px 22px' }}>
            <div style={{ ...lbl, marginBottom:8 }}>Sign &amp; Agree</div>
            <label style={{ display:'flex', gap:8, alignItems:'flex-start', fontSize:12, color:'var(--text)', cursor:'pointer', marginBottom:12, lineHeight:1.45 }}>
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ width:'auto', marginTop:2 }} />
              <span>I agree to provide the services described above at the listed rates. Invoices will be issued against these agreed terms.</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Type your full legal name" required style={{ marginBottom:10 }} />
            <button className="btn btn-primary" disabled={signing || !name.trim()} style={{ width:'100%' }}>
              {signing ? 'Signing…' : 'Agree & Sign'}
            </button>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:8, textAlign:'center' }}>
              Your typed name, the date, and your IP address are recorded as your electronic signature.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
