import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { api } from '../api.js';

const fmt$ = n => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

// Pop-out quick view: streams the file with auth and previews PDFs/images inline
function InvoicePreview({ file, onClose }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState('');
  const previewable = (file.mime || '').includes('pdf') || (file.mime || '').startsWith('image/');

  useEffect(() => {
    let obj;
    if (!previewable) return;
    fetch(`/api/finance/vendor-invoices/${file.id}/file?inline=1`, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } })
      .then(r => { if (!r.ok) throw new Error('Preview failed'); return r.blob(); })
      .then(b => { obj = URL.createObjectURL(b); setUrl(obj); })
      .catch(e => setErr(e.message));
    return () => obj && URL.revokeObjectURL(obj);
  }, [file.id]);

  async function download() {
    try {
      const r = await fetch(`/api/finance/vendor-invoices/${file.id}/file`, { headers: { Authorization: `Bearer ${localStorage.getItem('fp_token')}` } });
      const blob = await r.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { alert(e.message); }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:'fixed', inset:0, zIndex:130, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:12, width:'100%', maxWidth:860, height:'88vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'12px 16px', borderBottom:'1px solid var(--border)', flexWrap:'wrap' }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:800, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{file.filename}</div>
            <div style={{ fontSize:10, color:'var(--muted)' }}>
              {file.vendor_name ? `${file.vendor_name} · ` : ''}{file.code} · {file.amount != null ? fmt$(file.amount) + ' · ' : ''}{fmtSize(file.size)}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={download}>⬇ Download</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ flex:1, background:'#333', display:'flex', alignItems:'center', justifyContent:'center', overflow:'auto' }}>
          {!previewable && <div style={{ color:'#aaa', fontSize:12 }}>No inline preview for this file type — use Download.</div>}
          {previewable && err && <div style={{ color:'#e08080', fontSize:12 }}>{err}</div>}
          {previewable && !url && !err && <div style={{ color:'#aaa', fontSize:12 }}>Loading preview…</div>}
          {url && (file.mime || '').includes('pdf') && <iframe title="invoice" src={url} style={{ width:'100%', height:'100%', border:'none', background:'#fff' }} />}
          {url && (file.mime || '').startsWith('image/') && <img src={url} alt={file.filename} style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />}
        </div>
      </div>
    </div>
  );
}

export default function InvoiceSearch() {
  const { user, setUser } = useAuth();
  const [vendor, setVendor] = useState('');
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [rows, setRows] = useState(null);
  const [preview, setPreview] = useState(null);

  // Live search, debounced
  useEffect(() => {
    const t = setTimeout(() => {
      api.searchInvoices({ vendor, code, amount }).then(setRows).catch(e => alert(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [vendor, code, amount]);

  const th = { padding:'8px 12px', fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', whiteSpace:'nowrap' };
  const td = { padding:'8px 12px', fontSize:12, verticalAlign:'middle' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 26px', flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
          <Link to="/" style={{ display:'flex', alignItems:'center' }}>
            <img src="/unbridled-logo.png" alt="Unbridled Media" style={{ height:20, filter:'brightness(0) invert(1)', opacity:0.95 }} />
          </Link>
          <Link to="/reports" style={{ fontSize:12, color:'#e6c229', fontWeight:700, letterSpacing:'0.04em', textDecoration:'none' }}>Reports</Link>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.name}</span>
          <Link to="/reports" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>‹ Reports</Link>
          <Link to="/" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>Back to Hub</Link>
        </div>
      </div>
      <div style={{ maxWidth:1000, margin:'0 auto', padding:'10px 16px 60px' }}>
        <div className="page-title">Vendor Invoice Search</div>
        <div className="page-sub">Every uploaded vendor invoice, across all projects</div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16 }}>
          <div style={{ flex:2, minWidth:180 }}>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Vendor</div>
            <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor name or filename…" />
          </div>
          <div style={{ flex:1, minWidth:140 }}>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Project Code</div>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="02.LPL…" />
          </div>
          <div style={{ flex:1, minWidth:120 }}>
            <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Invoice Total</div>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1450.22" />
          </div>
        </div>

        {!rows && <div className="empty">Loading…</div>}
        {rows && rows.length === 0 && <div className="empty">No invoices match.</div>}
        {rows && rows.length > 0 && (
          <div className="budget-tbl-wrap" style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:10 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:720 }}>
              <thead>
                <tr>
                  <th style={th}>Vendor</th><th style={th}>File</th><th style={th}>Project</th>
                  <th style={{ ...th, textAlign:'right' }}>Total</th><th style={th}>Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} onClick={() => setPreview(r)} style={{ borderTop:'1px solid rgba(255,255,255,0.04)', cursor:'pointer' }}>
                    <td style={{ ...td, fontWeight:700 }}>{r.vendor_name || <span style={{ color:'var(--muted)', fontWeight:400 }}>—</span>}</td>
                    <td style={{ ...td, color:'#4a9eff', maxWidth:240, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.filename}</td>
                    <td style={td}><span style={{ fontWeight:700 }}>{r.code}</span> <span style={{ color:'var(--muted)', fontSize:11 }}>· {r.title}</span></td>
                    <td style={{ ...td, textAlign:'right', fontWeight:800, color:'#e6c229', whiteSpace:'nowrap' }}>{r.amount != null ? fmt$(r.amount) : '—'}</td>
                    <td style={{ ...td, fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>{new Date(r.created_at).toLocaleDateString()} · {r.uploaded_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize:10, color:'var(--muted)', marginTop:10 }}>Click any invoice to preview the file. Vendor and total are read automatically when invoices are uploaded on a project's VCC.</div>
      </div>
      {preview && <InvoicePreview file={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
